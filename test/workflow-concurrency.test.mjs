import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/harness-compat.yml',
  '.github/workflows/artemis-compat.yml',
]

const open = '$' + '{' + '{'
const expectedGroup = `  group: ${open} github.workflow }}-${open} github.event.pull_request.number || github.ref }}`

test('CI workflows cancel superseded runs for the same PR or ref', async () => {
  for (const path of workflows) {
    const source = await readFile(path, 'utf8')
    assert.equal((source.match(/^concurrency:/gm) ?? []).length, 1, `${path} should define concurrency exactly once`)
    assert.match(source, /^concurrency:\n  group: .*\n  cancel-in-progress: true$/m, `${path} should cancel superseded runs`)
    assert.ok(source.includes(expectedGroup), `${path} should group by workflow and PR/ref`)
  }
})
