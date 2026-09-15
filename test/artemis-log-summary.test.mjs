import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { formatArtemisLogSummary, summarizeArtemisLog } from '../scripts/summarize-artemis-log.mjs'

const scriptPath = fileURLToPath(new URL('../scripts/summarize-artemis-log.mjs', import.meta.url))

test('summarizes ARTEMIS daemon logs without reproducing raw content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-log-'))
  const log = path.join(root, 'real-artemis.log')
  const secretSerial = 'device-serial-SECRET-123'
  const secretPath = '/home/runner/work/private/secret-model-path'
  const secretUrl = 'https://example.invalid/private?token=SECRET'
  await writeFile(log, [
    `INFO device=${secretSerial} path=${secretPath}`,
    `WARNING upstream=${secretUrl}`,
    'RuntimeError: adb transport unavailable',
    'Traceback: private stack details',
    'RuntimeException: hidden details',
    '',
  ].join('\n'))

  const summary = await summarizeArtemisLog(log)
  assert.equal(summary.present, true)
  assert.equal(summary.scannedBytes, summary.bytes)
  assert.equal(summary.truncated, false)
  assert.equal(summary.lines, 5)
  assert.equal(summary.errors, 1)
  assert.equal(summary.warnings, 1)
  assert.equal(summary.traceback, true)
  assert.equal(summary.exception, true)
  assert.equal(summary.adb, true)

  const output = formatArtemisLogSummary(summary)
  assert.equal(output.includes(secretSerial), false)
  assert.equal(output.includes(secretPath), false)
  assert.equal(output.includes(secretUrl), false)
})

test('ARTEMIS log scanning stops at the configured byte bound', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-log-bound-'))
  const log = path.join(root, 'real-artemis.log')
  const prefix = 'WARN before\n'
  await writeFile(log, `${prefix}RuntimeError: after-boundary\n`)

  const summary = await summarizeArtemisLog(log, { maxScanBytes: Buffer.byteLength(prefix) })
  assert.equal(summary.present, true)
  assert.equal(summary.scannedBytes, Buffer.byteLength(prefix))
  assert.equal(summary.truncated, true)
  assert.equal(summary.warnings, 1)
  assert.equal(summary.errors, 0)
  assert.equal(formatArtemisLogSummary(summary).includes('truncated=true'), true)
})

test('CLI output never echoes daemon paths, URLs or device identifiers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-log-cli-'))
  const log = path.join(root, 'real-artemis.log')
  await writeFile(log, 'RuntimeError device=SERIAL-SECRET url=https://secret.invalid path=/private/path\n')
  const result = spawnSync(process.execPath, [scriptPath, log], { encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^\[dsh-artemis-real-daemon\] log-summary /)
  assert.match(result.stdout, /errors=1/)
  assert.equal(result.stdout.includes('SERIAL-SECRET'), false)
  assert.equal(result.stdout.includes('https://secret.invalid'), false)
  assert.equal(result.stdout.includes('/private/path'), false)
})

test('ARTEMIS compatibility workflow emits only the safe summary, never raw daemon tails', async () => {
  const workflow = await readFile(new URL('../.github/workflows/artemis-compat.yml', import.meta.url), 'utf8')
  assert.match(workflow, /node dsh-artemis\/scripts\/summarize-artemis-log\.mjs "\$RUNNER_TEMP\/real-artemis\.log"/)
  assert.doesNotMatch(workflow, /tail\s+-n\s+\d+\s+"\$RUNNER_TEMP\/real-artemis\.log"/)
})
