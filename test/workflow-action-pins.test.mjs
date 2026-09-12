import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'

const workflowsDir = fileURLToPath(new URL('../.github/workflows/', import.meta.url))
const IMMUTABLE_SHA = /^[0-9a-f]{40}$/i

function externalActionUses(source) {
  return [...source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith('./') && !value.startsWith('docker://'))
}

test('third-party GitHub Actions are pinned to immutable full commit SHAs', async () => {
  const files = (await readdir(workflowsDir))
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort()

  assert.ok(files.length > 0, 'expected at least one GitHub Actions workflow')

  for (const file of files) {
    const source = await readFile(path.join(workflowsDir, file), 'utf8')
    for (const action of externalActionUses(source)) {
      const at = action.lastIndexOf('@')
      assert.ok(at > 0, `${file}: external action ${action} must include an immutable revision`)
      const revision = action.slice(at + 1)
      assert.match(
        revision,
        IMMUTABLE_SHA,
        `${file}: external action ${action} must be pinned to a full 40-character commit SHA`,
      )
    }
  }
})
