import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const httpPath = 'src/host/artemis-http.mjs'
let http = readFileSync(httpPath, 'utf8')
http = replaceOnce(
  http,
  "import { parseDecimalContentLength } from '../shared/content-length.mjs'\n",
  "import { parseDecimalContentLength } from '../shared/content-length.mjs'\nimport { isValidTimerDelay, MAX_TIMER_DELAY_MS } from '../shared/timer-delay.mjs'\n",
  'http timer import',
)
http = replaceOnce(
  http,
  "    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer')\n    if (!Number.isInteger(snapshotTimeoutMs) || snapshotTimeoutMs <= 0) throw new TypeError('snapshotTimeoutMs must be a positive integer')",
  "    if (!isValidTimerDelay(timeoutMs)) throw new TypeError(`timeoutMs must be a positive integer no greater than ${MAX_TIMER_DELAY_MS}`)\n    if (!isValidTimerDelay(snapshotTimeoutMs)) throw new TypeError(`snapshotTimeoutMs must be a positive integer no greater than ${MAX_TIMER_DELAY_MS}`)",
  'http timeout validation',
)
writeFileSync(httpPath, http)

const evidencePath = 'src/host/artemis-evidence.mjs'
let evidence = readFileSync(evidencePath, 'utf8')
evidence = replaceOnce(
  evidence,
  "import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE, TRACE_EVIDENCE_ROUTE } from '../shared/protocol.mjs'\n",
  "import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE, TRACE_EVIDENCE_ROUTE } from '../shared/protocol.mjs'\nimport { isValidTimerDelay } from '../shared/timer-delay.mjs'\n",
  'evidence timer import',
)
evidence = replaceOnce(
  evidence,
  "  const timeoutMs = Number.isInteger(client.timeoutMs) && client.timeoutMs > 0 ? client.timeoutMs : 2_000",
  "  const timeoutMs = isValidTimerDelay(client.timeoutMs) ? client.timeoutMs : 2_000",
  'evidence timeout fallback',
)
writeFileSync(evidencePath, evidence)

const httpTestPath = 'test/artemis-http.test.mjs'
let httpTest = readFileSync(httpTestPath, 'utf8')
const httpMarker = "test('byte limits require safe integer arithmetic headroom', () => {"
if (httpTest.split(httpMarker).length !== 2) throw new Error('expected one byte-limit test marker')
const httpAddition = `test('timeouts stay within the Node timer delay range', () => {
  const maxTimerDelayMs = 2_147_483_647
  assert.doesNotThrow(() => new ArtemisHttpClient({ timeoutMs: maxTimerDelayMs, snapshotTimeoutMs: maxTimerDelayMs }))
  assert.throws(
    () => new ArtemisHttpClient({ timeoutMs: maxTimerDelayMs + 1 }),
    /timeoutMs must be a positive integer no greater than 2147483647/,
  )
  assert.throws(
    () => new ArtemisHttpClient({ snapshotTimeoutMs: maxTimerDelayMs + 1 }),
    /snapshotTimeoutMs must be a positive integer no greater than 2147483647/,
  )
})

`
httpTest = httpTest.replace(httpMarker, httpAddition + httpMarker)
writeFileSync(httpTestPath, httpTest)

const evidenceTestPath = 'test/artemis-evidence-json-stream.test.mjs'
let evidenceTest = readFileSync(evidenceTestPath, 'utf8')
const evidenceMarker = "test('evidence fallback ignores unsafe custom JSON byte limits', async () => {"
if (evidenceTest.split(evidenceMarker).length !== 2) throw new Error('expected one evidence fallback marker')
const evidenceAddition = `test('evidence fallback ignores timer delays that Node would overflow', async () => {
  let observedSignal
  let reads = 0
  const payload = new TextEncoder().encode(JSON.stringify({ status: 'idle' }))
  const client = {
    baseUrl: new URL('http://127.0.0.1:8000'),
    maxJsonBytes: 1_048_576,
    timeoutMs: 2_147_483_648,
    fetchImpl: async (_url, options) => {
      observedSignal = options.signal
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.equal(observedSignal.aborted, false)
      return responseWithReader({
        async read() {
          reads += 1
          return reads === 1 ? { done: false, value: payload } : { done: true }
        },
        releaseLock() {},
      }, String(payload.byteLength))
    },
  }

  const status = await getTaskStatus(client)
  assert.equal(status.status, 'idle')
  assert.equal(observedSignal.aborted, false)
})

`
evidenceTest = evidenceTest.replace(evidenceMarker, evidenceAddition + evidenceMarker)
writeFileSync(evidenceTestPath, evidenceTest)
