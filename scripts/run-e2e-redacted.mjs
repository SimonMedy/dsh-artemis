import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_CAPTURE_CHARS = 64 * 1024
const PHASE_PATTERN = /\[dsh-artemis-e2e\]\s+phase=([a-z0-9-]{1,80})(?:\s|$)/g

export function extractSafeE2ePhase(value) {
  const text = typeof value === 'string' ? value : String(value ?? '')
  let phase = 'unknown'
  for (const match of text.matchAll(PHASE_PATTERN)) phase = match[1]
  return phase
}

function appendTail(current, chunk) {
  const next = `${current}${chunk}`
  return next.length > MAX_CAPTURE_CHARS ? next.slice(-MAX_CAPTURE_CHARS) : next
}

export function runRedactedE2e(scriptPath, { spawnImpl = spawn } = {}) {
  if (typeof scriptPath !== 'string' || !scriptPath.trim()) {
    return Promise.reject(new TypeError('E2E script path is required'))
  }
  return new Promise((resolve) => {
    let captured = ''
    let settled = false
    const child = spawnImpl(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const capture = (stream) => {
      stream?.setEncoding?.('utf8')
      stream?.on?.('data', (chunk) => {
        captured = appendTail(captured, chunk)
      })
    }
    capture(child.stdout)
    capture(child.stderr)
    child.once('error', () => {
      if (settled) return
      settled = true
      process.stderr.write('[dsh-artemis-e2e] failure phase=unknown reason=spawn-failed output=suppressed\n')
      resolve(1)
    })
    child.once('close', (code) => {
      if (settled) return
      settled = true
      if (code === 0) {
        resolve(0)
        return
      }
      const phase = extractSafeE2ePhase(captured)
      const exitCode = Number.isSafeInteger(code) && code > 0 && code < 256 ? code : 1
      process.stderr.write(`[dsh-artemis-e2e] failure phase=${phase} exit=${exitCode} output=suppressed\n`)
      resolve(exitCode)
    })
  })
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null
if (invokedPath === import.meta.url) {
  const code = await runRedactedE2e(process.argv[2]).catch(() => {
    process.stderr.write('[dsh-artemis-e2e] failure phase=unknown reason=runner-failed output=suppressed\n')
    return 1
  })
  process.exitCode = code
}
