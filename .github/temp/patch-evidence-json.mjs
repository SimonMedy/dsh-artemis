import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = 'src/host/artemis-evidence.mjs'
let source = await readFile(sourcePath, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`Expected exactly one ${label} block, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
`      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new ArtemisProtocolError(\`${endpoint} response exceeded the configured size limit\`, { code: 'response-too-large' })
      }
      chunks.push(value)`,
`      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new ArtemisProtocolError(\`${endpoint} returned an invalid JSON response body\`, { code: 'invalid-json' })
      }
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new ArtemisProtocolError(\`${endpoint} response exceeded the configured size limit\`, { code: 'response-too-large' })
      }
      chunks.push(value)`,
  'evidence stream accounting',
)

replaceOnce(
`  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)`,
`  } finally {
    try { reader.releaseLock?.() } catch {}
  }
  const bytes = new Uint8Array(size)`,
  'evidence reader cleanup',
)

replaceOnce(
  '    return JSON.parse(new TextDecoder().decode(bytes))',
  "    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))",
  'evidence JSON decoder',
)

await writeFile(sourcePath, source)

const test = `import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { getTaskStatus } from '../src/host/artemis-evidence.mjs'

function headers(contentLength = null) {
  return {
    get(name) {
      const normalized = name.toLowerCase()
      if (normalized === 'content-type') return 'application/json'
      if (normalized === 'content-length') return contentLength
      return null
    },
  }
}

function responseWithReader(reader, contentLength = null) {
  return {
    ok: true,
    status: 200,
    headers: headers(contentLength),
    body: { getReader: () => reader },
  }
}

function evidenceClient(reader, { maxJsonBytes = 1_048_576 } = {}) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    maxJsonBytes,
    fetchImpl: async () => responseWithReader(reader),
  })
}

test('evidence JSON reader rejects non-byte stream chunks before size accounting', async () => {
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
  assert.equal(released, true)
})

test('evidence JSON reader preserves response-too-large when cancellation fails', async () => {
  let cancelled = false
  let released = false
  const reader = {
    async read() { return { done: false, value: Uint8Array.from([1, 2, 3, 4, 5]) } },
    async cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
    releaseLock() { released = true },
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader, { maxJsonBytes: 4 })),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('evidence JSON reader rejects invalid UTF-8 before JSON parsing', async () => {
  const invalidUtf8Json = Uint8Array.from([0x7b, 0x22, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1
        ? { done: false, value: invalidUtf8Json }
        : { done: true, value: undefined }
    },
    releaseLock() {},
  }
  await assert.rejects(
    getTaskStatus(evidenceClient(reader)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
  )
})
`
await writeFile('test/artemis-evidence-json-stream.test.mjs', test)

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
  'user-agent': 'dsh-artemis-evidence-json-fix',
}
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}

const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before evidence JSON patch commit')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: parent.tree.sha,
    tree: [
      { path: sourcePath, mode: '100644', type: 'blob', content: await readFile(sourcePath, 'utf8') },
      { path: 'test/artemis-evidence-json-stream.test.mjs', mode: '100644', type: 'blob', content: await readFile('test/artemis-evidence-json-stream.test.mjs', 'utf8') },
    ],
  }),
})
const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: 'fix: harden evidence JSON stream integrity', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }),
})
const verifyRef = await api(refPath)
if (verifyRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before evidence JSON ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
