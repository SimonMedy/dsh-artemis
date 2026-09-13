import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { extractSafeE2ePhase } from '../scripts/run-e2e-redacted.mjs'

const runnerPath = fileURLToPath(new URL('../scripts/run-e2e-redacted.mjs', import.meta.url))

test('extracts only an allow-listed E2E phase token', () => {
  assert.equal(extractSafeE2ePhase('[dsh-artemis-e2e] phase=assert-ready-state error=secret'), 'assert-ready-state')
  assert.equal(extractSafeE2ePhase('[dsh-artemis-e2e] phase=BAD_PHASE error=secret'), 'unknown')
  assert.equal(extractSafeE2ePhase('unstructured secret output'), 'unknown')
})

test('redacted E2E runner suppresses raw stdout/stderr while preserving safe phase and exit', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-e2e-runner-'))
  const fixture = path.join(root, 'failing-e2e.mjs')
  await writeFile(fixture, [
    "console.log('stdout-secret-must-not-leak')",
    "console.error('[dsh-artemis-e2e] phase=assert-ready-state error=stderr-secret-must-not-leak')",
    'process.exitCode = 7',
    '',
  ].join('\n'))

  const result = spawnSync(process.execPath, [runnerPath, fixture], {
    encoding: 'utf8',
    env: { ...process.env },
  })
  assert.equal(result.status, 7)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /phase=assert-ready-state/)
  assert.match(result.stderr, /exit=7/)
  assert.match(result.stderr, /output=suppressed/)
  assert.equal(result.stderr.includes('stdout-secret-must-not-leak'), false)
  assert.equal(result.stderr.includes('stderr-secret-must-not-leak'), false)
})

test('DeepSeek Harness workflow executes the browser E2E through the redacted runner', async () => {
  const workflow = await readFile(new URL('../.github/workflows/harness-compat.yml', import.meta.url), 'utf8')
  assert.match(
    workflow,
    /node "\$GITHUB_WORKSPACE\/dsh-artemis\/scripts\/run-e2e-redacted\.mjs" \.\/dsh-artemis-native-panel\.e2e\.mjs/,
  )
  assert.doesNotMatch(workflow, /pnpm exec node \.\/dsh-artemis-native-panel\.e2e\.mjs/)
})
