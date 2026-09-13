import { readFile, writeFile } from 'node:fs/promises'

const hostPath = 'src/host/artemis-http.mjs'
let source = await readFile(hostPath, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`Expected exactly one ${label} block, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
`      const { value, done } = await reader.read()
      if (done) {
        if (buffer.byteLength === 0) return
        throw new ArtemisProtocolError('ARTEMIS live stream ended before a complete frame arrived', { code: 'incomplete-frame' })
      }
      buffer = appendBytes(buffer, value, maxBuffered)`,
`      const { value, done } = await reader.read()
      if (done) {
        if (buffer.byteLength === 0) return
        throw new ArtemisProtocolError('ARTEMIS live stream ended before a complete frame arrived', { code: 'incomplete-frame' })
      }
      if (!(value instanceof Uint8Array)) {
        throw new ArtemisProtocolError('ARTEMIS live stream returned an invalid response body', { code: 'invalid-multipart' })
      }
      buffer = appendBytes(buffer, value, maxBuffered)`,
  'live stream chunk handling',
)

replaceOnce(
`  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}`,
`  } finally {
    await reader.cancel().catch(() => {})
    try { reader.releaseLock?.() } catch {}
  }
}`,
  'live stream cleanup',
)

await writeFile(hostPath, source)

const test = `import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError } from '../src/host/artemis-http.mjs'

function multipartResponse(reader) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'multipart/x-mixed-replace; boundary=frame' }),
    body: { getReader: () => reader },
  }
}

test('Host live stream rejects non-byte chunks before multipart buffering', async () => {
  let cancelled = false
  let released = false
  const reader = {
    reads: 0,
    async read() {
      this.reads += 1
      return this.reads === 1 ? { done: false, value: 'not-bytes' } : { done: true }
    },
    async cancel() { cancelled = true },
    releaseLock() { released = true },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => multipartResponse(reader) })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-multipart',
  )
  assert.equal(cancelled, true)
  assert.equal(released, true)
})

test('Host live stream preserves protocol errors when releaseLock cleanup fails', async () => {
  let cancelled = false
  const reader = {
    async read() { return { done: false, value: 'not-bytes' } },
    async cancel() { cancelled = true },
    releaseLock() { throw new Error('release failed') },
  }
  const client = new ArtemisHttpClient({ fetchImpl: async () => multipartResponse(reader) })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-multipart',
  )
  assert.equal(cancelled, true)
})
`
await writeFile('test/artemis-http-live-stream-integrity.test.mjs', test)

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
  'user-agent': 'dsh-artemis-live-stream-fix',
}
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}

const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before Host live-stream patch commit')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: parent.tree.sha,
    tree: [
      { path: hostPath, mode: '100644', type: 'blob', content: await readFile(hostPath, 'utf8') },
      { path: 'test/artemis-http-live-stream-integrity.test.mjs', mode: '100644', type: 'blob', content: await readFile('test/artemis-http-live-stream-integrity.test.mjs', 'utf8') },
    ],
  }),
})
const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: 'fix: harden Host live-stream integrity', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }),
})
const verifyRef = await api(refPath)
if (verifyRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before Host live-stream ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
