import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_COUNT = 999_999
const MAX_REPORTED_BYTES = 999_999_999

function increment(value) {
  return value >= MAX_COUNT ? MAX_COUNT : value + 1
}

export async function summarizeArtemisLog(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new TypeError('ARTEMIS log path is required')

  let info
  try {
    info = await stat(filePath)
  } catch {
    return Object.freeze({
      present: false,
      bytes: 0,
      lines: 0,
      errors: 0,
      warnings: 0,
      traceback: false,
      exception: false,
      adb: false,
    })
  }

  if (!info.isFile()) throw new Error('ARTEMIS log path is not a regular file')

  const summary = {
    present: true,
    bytes: Math.min(info.size, MAX_REPORTED_BYTES),
    lines: 0,
    errors: 0,
    warnings: 0,
    traceback: false,
    exception: false,
    adb: false,
  }

  const input = createReadStream(filePath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      summary.lines = increment(summary.lines)
      if (/error/i.test(line)) summary.errors = increment(summary.errors)
      if (/warn/i.test(line)) summary.warnings = increment(summary.warnings)
      if (/traceback/i.test(line)) summary.traceback = true
      if (/exception/i.test(line)) summary.exception = true
      if (/\badb\b/i.test(line)) summary.adb = true
    }
  } finally {
    lines.close()
    input.destroy()
  }

  return Object.freeze(summary)
}

export function formatArtemisLogSummary(summary) {
  return [
    '[dsh-artemis-real-daemon] log-summary',
    `present=${summary.present}`,
    `bytes=${summary.bytes}`,
    `lines=${summary.lines}`,
    `errors=${summary.errors}`,
    `warnings=${summary.warnings}`,
    `traceback=${summary.traceback}`,
    `exception=${summary.exception}`,
    `adb=${summary.adb}`,
  ].join(' ')
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  const summary = await summarizeArtemisLog(process.argv[2]).catch(() => ({
    present: false,
    bytes: 0,
    lines: 0,
    errors: 0,
    warnings: 0,
    traceback: false,
    exception: false,
    adb: false,
  }))
  process.stdout.write(`${formatArtemisLogSummary(summary)}\n`)
}
