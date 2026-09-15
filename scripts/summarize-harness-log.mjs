import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_COUNT = 999_999
const MAX_REPORTED_BYTES = 999_999_999
const DEFAULT_MAX_SCAN_BYTES = 8 * 1024 * 1024
const MODES = new Set(['build', 'web'])

function increment(value) {
  return value >= MAX_COUNT ? MAX_COUNT : value + 1
}

function emptySummary(mode, present = false) {
  return {
    mode,
    present,
    bytes: 0,
    scannedBytes: 0,
    truncated: false,
    lines: 0,
    errors: 0,
    warnings: 0,
    packageErrors: 0,
    exceptions: 0,
    startupRace: false,
    authUrlPresent: false,
  }
}

export async function summarizeHarnessLog(filePath, { mode = 'build', maxScanBytes = DEFAULT_MAX_SCAN_BYTES } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('DeepSeek Harness log path is required')
  if (!MODES.has(mode)) throw new TypeError('DeepSeek Harness log mode must be build or web')
  if (!Number.isSafeInteger(maxScanBytes) || maxScanBytes <= 0) throw new TypeError('maxScanBytes must be a positive safe integer')

  let info
  try {
    info = await stat(filePath)
  } catch {
    return Object.freeze(emptySummary(mode))
  }
  if (!info.isFile()) throw new Error('DeepSeek Harness log path is not a regular file')

  const summary = emptySummary(mode, true)
  summary.bytes = Math.min(info.size, MAX_REPORTED_BYTES)
  summary.scannedBytes = Math.min(info.size, maxScanBytes)
  summary.truncated = info.size > maxScanBytes
  if (summary.scannedBytes === 0) return Object.freeze(summary)

  let raceWebServer = false
  let raceCarrier = false
  const input = createReadStream(filePath, {
    encoding: 'utf8',
    end: summary.scannedBytes - 1,
  })
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      summary.lines = increment(summary.lines)
      if (/error/i.test(line)) summary.errors = increment(summary.errors)
      if (/warn/i.test(line)) summary.warnings = increment(summary.warnings)
      if (/ERR_PNPM|ELIFECYCLE|npm ERR!/i.test(line)) summary.packageErrors = increment(summary.packageErrors)
      if (/exception|traceback/i.test(line)) summary.exceptions = increment(summary.exceptions)
      if (line.includes('cannot get property "webServer" without inject')) raceWebServer = true
      if (line.includes('registerWebCarrier')) raceCarrier = true
      if (/^dsh web: http:\/\/127\.0\.0\.1:3080\/\?token=[^\s]+/.test(line)) summary.authUrlPresent = true
    }
  } finally {
    lines.close()
    input.destroy()
  }

  summary.startupRace = raceWebServer && raceCarrier
  return Object.freeze(summary)
}

export function formatHarnessLogSummary(summary) {
  return [
    '[dsh-artemis-deepseek-harness] log-summary',
    `mode=${summary.mode}`,
    `present=${summary.present}`,
    `bytes=${summary.bytes}`,
    `scannedBytes=${summary.scannedBytes}`,
    `truncated=${summary.truncated}`,
    `lines=${summary.lines}`,
    `errors=${summary.errors}`,
    `warnings=${summary.warnings}`,
    `packageErrors=${summary.packageErrors}`,
    `exceptions=${summary.exceptions}`,
    `startupRace=${summary.startupRace}`,
    `authUrlPresent=${summary.authUrlPresent}`,
  ].join(' ')
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  const mode = process.argv[3] ?? 'build'
  const summary = await summarizeHarnessLog(process.argv[2], { mode }).catch(() => emptySummary(MODES.has(mode) ? mode : 'build'))
  process.stdout.write(`${formatHarnessLogSummary(summary)}\n`)
}
