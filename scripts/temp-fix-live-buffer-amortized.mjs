import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const sourcePath = 'src/host/artemis-http.mjs'
let source = fs.readFileSync(sourcePath, 'utf8')
source = replaceExact(
  source,
  "import { isJsonContentType } from '../shared/json-content-type.mjs'\n",
  "import { isJsonContentType } from '../shared/json-content-type.mjs'\nimport { BoundedByteBuffer } from './bounded-byte-buffer.mjs'\n",
  'bounded buffer import',
)
source = replaceExact(
  source,
  `function appendBytes(left, right, maxBytes) {\n  const size = left.byteLength + right.byteLength\n  if (size > maxBytes) {\n    throw new ArtemisProtocolError('ARTEMIS live frame exceeded the configured size limit', { code: 'frame-too-large' })\n  }\n  const combined = new Uint8Array(size)\n  combined.set(left)\n  combined.set(right, left.byteLength)\n  return combined\n}\n\n`,
  '',
  'appendBytes helper removal',
)
source = replaceExact(
  source,
  `  const reader = response.body.getReader()\n  let buffer = new Uint8Array(0)\n  let bodyStart = -1\n`,
  `  const reader = response.body.getReader()\n  const buffered = new BoundedByteBuffer(maxBuffered)\n  let buffer = buffered.view()\n  let bodyStart = -1\n`,
  'live parser buffer initialization',
)
source = replaceExact(
  source,
  `          buffer = buffer.slice(frameEnd + 2)\n          bodyStart = -1\n`,
  `          buffered.consume(frameEnd + 2)\n          buffer = buffered.view()\n          bodyStart = -1\n`,
  'live parser consume',
)
source = replaceExact(
  source,
  `      buffer = appendBytes(buffer, value, maxBuffered)\n`,
  `      if (buffer.byteLength + value.byteLength > maxBuffered) {\n        throw new ArtemisProtocolError('ARTEMIS live frame exceeded the configured size limit', { code: 'frame-too-large' })\n      }\n      buffered.append(value)\n      buffer = buffered.view()\n`,
  'live parser append',
)
fs.writeFileSync(sourcePath, source)

const integrityPath = 'test/artemis-http-live-stream-integrity.test.mjs'
let integrity = fs.readFileSync(integrityPath, 'utf8')
integrity += `

test('Host live stream accepts a valid frame fragmented into one-byte reads', async () => {
  const frame = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41, 0x42, 0x43, 0x44])
  const header = new TextEncoder().encode('--frame\\r\\nContent-Type: image/png\\r\\nContent-Length: 12\\r\\n\\r\\n')
  const trailer = Uint8Array.of(13, 10)
  const payload = new Uint8Array(header.byteLength + frame.byteLength + trailer.byteLength)
  payload.set(header)
  payload.set(frame, header.byteLength)
  payload.set(trailer, header.byteLength + frame.byteLength)
  let offset = 0
  const reader = {
    async read() {
      if (offset >= payload.byteLength) return { done: true }
      const value = payload.subarray(offset, offset + 1)
      offset += 1
      return { done: false, value }
    },
    async cancel() {},
    releaseLock() {},
  }

  const snapshot = await new ArtemisHttpClient({
    fetchImpl: async () => multipartResponse(reader),
  }).getSnapshot()
  assert.deepEqual([...snapshot.data], [...frame])
})
`
fs.writeFileSync(integrityPath, integrity)

const docsPath = 'docs/live-viewer.md'
let docs = fs.readFileSync(docsPath, 'utf8')
docs = replaceExact(
  docs,
  '- Boundary and part-header sizes remain bounded.\n',
  '- Boundary and part-header sizes remain bounded.\n- Fragmented upstream chunks accumulate in a bounded growable buffer with amortized capacity growth, so fragmentation cannot force a full-frame copy on every read.\n',
  'live viewer fragmentation invariant',
)
fs.writeFileSync(docsPath, docs)
