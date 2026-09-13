import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowUrl = new URL('../.github/workflows/harness-compat.yml', import.meta.url)
const e2eUrl = new URL('../test/e2e/native-panel.e2e.mjs', import.meta.url)

test('browser failure upload is restricted to the explicit screenshot allow-list', async () => {
  const [workflow, e2e] = await Promise.all([
    readFile(workflowUrl, 'utf8'),
    readFile(e2eUrl, 'utf8'),
  ])

  assert.match(
    workflow,
    /name: Upload browser failure evidence[\s\S]*?path: \$\{\{ runner\.temp \}\}\/dsh-artemis-e2e\/native-panel-failure\.png/,
  )
  assert.doesNotMatch(
    workflow,
    /path: \$\{\{ runner\.temp \}\}\/dsh-artemis-e2e\s*$/m,
  )
  assert.match(workflow, /retention-days: 3/)
  assert.match(e2e, /join\(artifactDir, 'native-panel-failure\.png'\)/)
})
