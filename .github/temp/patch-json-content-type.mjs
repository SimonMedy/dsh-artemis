import { readFile, writeFile } from 'node:fs/promises'

function replaceExactly(source, before, after, expected, label) {
  const count = source.split(before).length - 1
  if (count !== expected) throw new Error(`Expected ${expected} ${label} occurrence(s), found ${count}`)
  return source.split(before).join(after)
}

async function patchClient() {
  const path = 'src/client/bounded-json.mjs'
  let source = await readFile(path, 'utf8')
  if (!source.includes("from '../shared/json-content-type.mjs'")) {
    source = `import { isJsonContentType } from '../shared/json-content-type.mjs'\n\n${source}`
  }
  source = replaceExactly(
    source,
    "if (!contentType.startsWith('application/json')) {",
    'if (!isJsonContentType(contentType)) {',
    1,
    'browser JSON MIME check',
  )
  await writeFile(path, source)
}

async function patchHost(path, importPath, label) {
  let source = await readFile(path, 'utf8')
  if (!source.includes(`from '${importPath}'`)) {
    source = `import { isJsonContentType } from '${importPath}'\n${source}`
  }
  source = replaceExactly(
    source,
    "!contentType.toLowerCase().includes('application/json')",
    '!isJsonContentType(contentType)',
    1,
    `${label} JSON MIME check`,
  )
  await writeFile(path, source)
}

await patchClient()
await patchHost('src/host/artemis-http.mjs', '../shared/json-content-type.mjs', 'Host')
await patchHost('src/host/artemis-evidence.mjs', '../shared/json-content-type.mjs', 'evidence')

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
  'user-agent': 'dsh-artemis-json-mime-fix',
}
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}

const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before JSON MIME patch commit')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const files = ['src/client/bounded-json.mjs', 'src/host/artemis-http.mjs', 'src/host/artemis-evidence.mjs']
const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: parent.tree.sha,
    tree: await Promise.all(files.map(async (path) => ({ path, mode: '100644', type: 'blob', content: await readFile(path, 'utf8') }))),
  }),
})
const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: 'fix: enforce exact JSON content types', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }),
})
const verifyRef = await api(refPath)
if (verifyRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before JSON MIME ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
