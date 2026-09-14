import { readFile } from 'node:fs/promises'

async function patch(path, transform) {
  const source = await readFile(path, 'utf8')
  const next = transform(source)
  if (next === source) throw new Error(`No changes applied to ${path}`)
  return next
}

function addImport(source, line) {
  if (source.includes(line)) return source
  return `${line}\n${source}`
}

const client = await patch('src/client/bounded-json.mjs', (input) => {
  let source = addImport(input, "import { parseDecimalContentLength } from '../shared/content-length.mjs'")
  const pattern = /  if \(!\/\^\\d\+\$\/\.test\(raw\)\) throw new Error\(`\$\{label\} returned an invalid content length`\)\n  const length = Number\(raw\)\n  if \(!Number\.isSafeInteger\(length\) \|\| length > maxBytes\) \{\n    throw new Error\(`\$\{label\} exceeded the response size limit`\)\n  \}/
  if (!pattern.test(source)) throw new Error('Browser Content-Length block not found')
  return source.replace(pattern, `  let length\n  try {\n    length = parseDecimalContentLength(raw)\n  } catch {\n    throw new Error(\`\${label} returned an invalid content length\`)\n  }\n  if (length > maxBytes) {\n    throw new Error(\`\${label} exceeded the response size limit\`)\n  }`)
})

const host = await patch('src/host/artemis-http.mjs', (input) => {
  let source = addImport(input, "import { parseDecimalContentLength } from '../shared/content-length.mjs'")
  const pattern = /  const declaredText = response\.headers\.get\('content-length'\)\n  if \(declaredText !== null\) \{\n    if \(!\/\^\\d\+\$\/\.test\(declaredText\)\) \{\n      throw new ArtemisProtocolError\(`\$\{endpoint\} returned an invalid Content-Length`, \{ code: 'invalid-content-length' \}\)\n    \}\n    const declared = Number\(declaredText\)\n    if \(!Number\.isSafeInteger\(declared\)\) \{\n      throw new ArtemisProtocolError\(`\$\{endpoint\} returned an invalid Content-Length`, \{ code: 'invalid-content-length' \}\)\n    \}/
  if (!pattern.test(source)) throw new Error('Host Content-Length block not found')
  return source.replace(pattern, `  const declaredText = response.headers.get('content-length')\n  if (declaredText !== null) {\n    let declared\n    try {\n      declared = parseDecimalContentLength(declaredText)\n    } catch {\n      throw new ArtemisProtocolError(\`\${endpoint} returned an invalid Content-Length\`, { code: 'invalid-content-length' })\n    }`)
})

const evidence = await patch('src/host/artemis-evidence.mjs', (input) => {
  let source = addImport(input, "import { parseDecimalContentLength } from '../shared/content-length.mjs'")
  const pattern = /  const declaredText = response\.headers\.get\('content-length'\)\n  if \(declaredText !== null\) \{\n    if \(!\/\^\\d\+\$\/\.test\(declaredText\)\) \{\n      throw new ArtemisProtocolError\(`\$\{endpoint\} returned an invalid Content-Length`, \{ code: 'invalid-evidence' \}\)\n    \}\n    const declared = Number\(declaredText\)\n    if \(!Number\.isSafeInteger\(declared\) \|\| declared < 0 \|\| declared > maxBytes\) \{/
  if (!pattern.test(source)) throw new Error('Evidence Content-Length block not found')
  return source.replace(pattern, `  const declaredText = response.headers.get('content-length')\n  if (declaredText !== null) {\n    let declared\n    try {\n      declared = parseDecimalContentLength(declaredText)\n    } catch {\n      throw new ArtemisProtocolError(\`\${endpoint} returned an invalid Content-Length\`, { code: 'invalid-evidence' })\n    }\n    if (declared > maxBytes) {`)
})

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = { accept: 'application/vnd.github+json', authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'content-type': 'application/json', 'x-github-api-version': '2026-03-10', 'user-agent': 'dsh-artemis-shared-content-length' }
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}
const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before shared Content-Length patch')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const tree = await api(`/repos/${owner}/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree: [
  { path: 'src/client/bounded-json.mjs', mode: '100644', type: 'blob', content: client },
  { path: 'src/host/artemis-http.mjs', mode: '100644', type: 'blob', content: host },
  { path: 'src/host/artemis-evidence.mjs', mode: '100644', type: 'blob', content: evidence },
] }) })
const commit = await api(`/repos/${owner}/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: 'refactor: share Content-Length parsing', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }) })
const verify = await api(refPath)
if (verify.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before shared Content-Length ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
