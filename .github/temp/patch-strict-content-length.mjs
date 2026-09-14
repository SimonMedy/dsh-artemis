import { readFile } from 'node:fs/promises'

const sourcePath = 'src/host/artemis-http.mjs'
const source = await readFile(sourcePath, 'utf8')
const before = `  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ArtemisProtocolError(\`${endpoint} response exceeded the configured size limit\`, { code: 'response-too-large' })
  }`
const after = `  const declaredText = response.headers.get('content-length')
  if (declaredText !== null) {
    if (!/^\\d+$/.test(declaredText)) {
      throw new ArtemisProtocolError(\`${endpoint} returned an invalid Content-Length\`, { code: 'invalid-content-length' })
    }
    const declared = Number(declaredText)
    if (!Number.isSafeInteger(declared)) {
      throw new ArtemisProtocolError(\`${endpoint} returned an invalid Content-Length\`, { code: 'invalid-content-length' })
    }
    if (declared > maxBytes) {
      throw new ArtemisProtocolError(\`${endpoint} response exceeded the configured size limit\`, { code: 'response-too-large' })
    }
  }`
const count = source.split(before).length - 1
if (count !== 1) throw new Error(`Expected exactly one Host Content-Length block, found ${count}`)
const patched = source.replace(before, after)

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
  'user-agent': 'dsh-artemis-content-length-fix',
}
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}
const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before strict Content-Length patch commit')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: parent.tree.sha,
    tree: [{ path: sourcePath, mode: '100644', type: 'blob', content: patched }],
  }),
})
const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: 'fix: require decimal Host Content-Length', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }),
})
const verifyRef = await api(refPath)
if (verifyRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before strict Content-Length ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
