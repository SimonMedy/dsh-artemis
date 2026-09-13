import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { formatHarnessLogSummary, summarizeHarnessLog } from '../scripts/summarize-harness-log.mjs'

const scriptPath = fileURLToPath(new URL('../scripts/summarize-harness-log.mjs', import.meta.url))

test('summarizes DeepSeek Harness logs without reproducing raw content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-harness-log-'))
  const log = path.join(root, 'harness.log')
  const secretPath = '/home/runner/work/private/SECRET-PATH'
  const secretUrl = 'https://example.invalid/private?token=SECRET-TOKEN'
  await writeFile(log, [
    `WARN path=${secretPath}`,
    `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL url=${secretUrl}`,
    'RuntimeException: hidden details',
    'cannot get property "webServer" without inject',
    'registerWebCarrier internal details',
    'dsh web: http://127.0.0.1:3080/?token=AUTH-SECRET',
    '',
  ].join('\n'))

  const summary = await summarizeHarnessLog(log, { mode: 'web' })
  assert.equal(summary.present, true)
  assert.equal(summary.lines, 6)
  assert.equal(summary.warnings, 1)
  assert.equal(summary.packageErrors, 1)
  assert.equal(summary.exceptions, 1)
  assert.equal(summary.startupRace, true)
  assert.equal(summary.authUrlPresent, true)

  const output = formatHarnessLogSummary(summary)
  assert.equal(output.includes(secretPath), false)
  assert.equal(output.includes(secretUrl), false)
  assert.equal(output.includes('AUTH-SECRET'), false)
})

test('CLI output never echoes DeepSeek Harness paths, URLs or tokens', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-harness-log-cli-'))
  const log = path.join(root, 'harness.log')
  await writeFile(log, 'ERROR path=/private/path url=https://secret.invalid/?token=SECRET\n')
  const result = spawnSync(process.execPath, [scriptPath, log, 'build'], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^\[dsh-artemis-deepseek-harness\] log-summary /)
  assert.match(result.stdout, /errors=1/)
  assert.equal(result.stdout.includes('/private/path'), false)
  assert.equal(result.stdout.includes('https://secret.invalid'), false)
  assert.equal(result.stdout.includes('SECRET'), false)
})

test('DeepSeek Harness compatibility workflow never emits raw upstream log tails', async () => {
  const workflow = await readFile(new URL('../.github/workflows/harness-compat.yml', import.meta.url), 'utf8')
  assert.match(workflow, /summarize-harness-log\.mjs" "\$log" build/)
  assert.match(workflow, /summarize-harness-log\.mjs" "\$log" web/)
  assert.doesNotMatch(workflow, /tail\s+-n\s+120\s+"\$log"/)
  assert.doesNotMatch(workflow, /redact_log\(\)/)
})
