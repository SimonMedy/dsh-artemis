import { readFile, writeFile } from 'node:fs/promises'

const workflowPath = '.github/workflows/harness-compat.yml'
let source = await readFile(workflowPath, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`Expected exactly one ${label} block, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
`          run_quiet() {
            local name="$1"
            shift
            local log="$RUNNER_TEMP/${name}.log"
            if ! "$@" > "$log" 2>&1; then
              echo "::error title=${name} failed::Showing the final build lines"
              tail -n 120 "$log"
              exit 1
            fi
          }`,
`          run_quiet() {
            local name="$1"
            shift
            local log="$RUNNER_TEMP/${name}.log"
            if ! "$@" > "$log" 2>&1; then
              echo "::error title=${name} failed::Raw upstream output suppressed; see bounded summary"
              node "$GITHUB_WORKSPACE/dsh-artemis/scripts/summarize-harness-log.mjs" "$log" build
              exit 1
            fi
          }`,
  'build log handler',
)

replaceOnce(
`          redact_log() {
            local log="$1"
            sed -E 's/(token=)[^[:space:]]+/\\1<redacted>/g' "$log" | tail -n 80 | tr '\\n' ' ' | sed -E 's/::/%3A%3A/g; s/%/%25/g; s/\\r/%0D/g; s/\\n/%0A/g'
          }
          fail_start() {
            local log="$1"
            local detail
            detail=$(redact_log "$log")
            echo "::error title=Harness Web failed to start::$detail"
            return 1
          }`,
`          fail_start() {
            local log="$1"
            echo "::error title=Harness Web failed to start::Raw upstream output suppressed; see bounded summary"
            node "$GITHUB_WORKSPACE/dsh-artemis/scripts/summarize-harness-log.mjs" "$log" web
            return 1
          }`,
  'web log handler',
)

await writeFile(workflowPath, source)

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
const headers = {
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json',
  'x-github-api-version': '2026-03-10',
  'user-agent': 'dsh-artemis-harness-log-fix',
}
async function api(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!response.ok) throw new Error(`GitHub API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`)
  return response.status === 204 ? null : response.json()
}

const refPath = `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`
const currentRef = await api(refPath)
if (currentRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before DeepSeek Harness log patch commit')
const parent = await api(`/repos/${owner}/${repo}/git/commits/${process.env.EXPECTED_PARENT}`)
const tree = await api(`/repos/${owner}/${repo}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({
    base_tree: parent.tree.sha,
    tree: [{ path: workflowPath, mode: '100644', type: 'blob', content: await readFile(workflowPath, 'utf8') }],
  }),
})
const commit = await api(`/repos/${owner}/${repo}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: 'ci: suppress raw DeepSeek Harness failure logs', tree: tree.sha, parents: [process.env.EXPECTED_PARENT] }),
})
const verifyRef = await api(refPath)
if (verifyRef.object.sha !== process.env.EXPECTED_PARENT) throw new Error('Working branch moved before DeepSeek Harness log ref update')
await api(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(process.env.TARGET_BRANCH)}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.sha, force: false }),
})
