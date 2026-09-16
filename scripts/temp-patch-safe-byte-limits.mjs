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
  "const MAX_MULTIPART_HEADER_BYTES = 16_384\n",
  "const MAX_MULTIPART_HEADER_BYTES = 16_384\nconst MAX_MULTIPART_BOUNDARY_CHARS = 70\n// A JavaScript UTF-16 code unit encodes to at most three UTF-8 bytes. Multipart buffering also retains `--`, CRLF separators and the header terminator.\nconst MAX_MULTIPART_BUFFER_OVERHEAD_BYTES = MAX_MULTIPART_HEADER_BYTES + 2 + (MAX_MULTIPART_BOUNDARY_CHARS * 3) + 2 + 4 + 2\nconst MAX_CONFIGURED_FRAME_BYTES = Number.MAX_SAFE_INTEGER - MAX_MULTIPART_BUFFER_OVERHEAD_BYTES\n",
  'multipart constants',
)
http = replaceOnce(
  http,
  "  if (!boundary || boundary.length > 70 || /[\\r\\n]/.test(boundary)) {",
  "  if (!boundary || boundary.length > MAX_MULTIPART_BOUNDARY_CHARS || /[\\r\\n]/.test(boundary)) {",
  'boundary length',
)
http = replaceOnce(
  http,
  "    if (!Number.isInteger(maxJsonBytes) || maxJsonBytes <= 0) throw new TypeError('maxJsonBytes must be a positive integer')\n    if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0) throw new TypeError('maxFrameBytes must be a positive integer')",
  "    if (!Number.isSafeInteger(maxJsonBytes) || maxJsonBytes <= 0) throw new TypeError('maxJsonBytes must be a positive safe integer')\n    if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes <= 0 || maxFrameBytes > MAX_CONFIGURED_FRAME_BYTES) {\n      throw new TypeError('maxFrameBytes must be a positive safe integer with multipart overhead headroom')\n    }",
  'constructor byte limits',
)
writeFileSync(httpPath, http)

const evidencePath = 'src/host/artemis-evidence.mjs'
let evidence = readFileSync(evidencePath, 'utf8')
evidence = replaceOnce(
  evidence,
  "  const maxBytes = Number.isInteger(client.maxJsonBytes) && client.maxJsonBytes > 0 ? client.maxJsonBytes : 1_048_576",
  "  const maxBytes = Number.isSafeInteger(client.maxJsonBytes) && client.maxJsonBytes > 0 ? client.maxJsonBytes : 1_048_576",
  'evidence max bytes fallback',
)
writeFileSync(evidencePath, evidence)

const httpTestPath = 'test/artemis-http.test.mjs'
let httpTest = readFileSync(httpTestPath, 'utf8')
const httpMarker = "test('health and device list use the ARTEMIS baseline endpoints', async () => {"
if (httpTest.split(httpMarker).length !== 2) throw new Error('expected one HTTP test marker')
const httpAddition = `test('byte limits require safe integer arithmetic headroom', () => {
  assert.throws(
    () => new ArtemisHttpClient({ maxJsonBytes: Number.MAX_SAFE_INTEGER + 1 }),
    /maxJsonBytes must be a positive safe integer/,
  )
  assert.doesNotThrow(() => new ArtemisHttpClient({ maxJsonBytes: Number.MAX_SAFE_INTEGER }))

  const maxSafeFrameBytes = Number.MAX_SAFE_INTEGER - 16_604
  assert.doesNotThrow(() => new ArtemisHttpClient({ maxFrameBytes: maxSafeFrameBytes }))
  assert.throws(
    () => new ArtemisHttpClient({ maxFrameBytes: maxSafeFrameBytes + 1 }),
    /maxFrameBytes must be a positive safe integer with multipart overhead headroom/,
  )
})

`
httpTest = httpTest.replace(httpMarker, httpAddition + httpMarker)
writeFileSync(httpTestPath, httpTest)

const evidenceTestPath = 'test/artemis-evidence-json-stream.test.mjs'
let evidenceTest = readFileSync(evidenceTestPath, 'utf8')
const evidenceMarker = "test('evidence JSON reader rejects non-byte stream chunks before size accounting', async () => {"
if (evidenceTest.split(evidenceMarker).length !== 2) throw new Error('expected one evidence test marker')
const evidenceAddition = `test('evidence fallback ignores unsafe custom JSON byte limits', async () => {
  let cancelled = false
  let readerAcquired = false
  const client = {
    baseUrl: new URL('http://127.0.0.1:8000'),
    maxJsonBytes: Number.MAX_SAFE_INTEGER + 1,
    timeoutMs: 2_000,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: headers(String(1_048_577)),
      body: {
        getReader() {
          readerAcquired = true
          throw new Error('reader should not be acquired')
        },
        cancel() { cancelled = true },
      },
    }),
  }

  await assert.rejects(
    getTaskStatus(client),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(cancelled, true)
  assert.equal(readerAcquired, false)
})

`
evidenceTest = evidenceTest.replace(evidenceMarker, evidenceAddition + evidenceMarker)
writeFileSync(evidenceTestPath, evidenceTest)
