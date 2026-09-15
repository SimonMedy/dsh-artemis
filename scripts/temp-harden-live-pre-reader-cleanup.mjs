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
  `async function* readPngFrames(response, maxFrameBytes) {\n  const boundary = parseMultipartBoundary(response.headers.get('content-type') ?? '')\n  if (!response.body) throw new ArtemisProtocolError('/api/stream/device-live returned an empty response body')\n`,
  `async function* readPngFrames(response, maxFrameBytes) {\n  let boundary\n  try {\n    boundary = parseMultipartBoundary(response.headers.get('content-type') ?? '')\n  } catch (error) {\n    await cancelBodyQuietly(response.body)\n    throw error\n  }\n  if (!response.body) throw new ArtemisProtocolError('/api/stream/device-live returned an empty response body')\n`,
  'live global metadata cleanup',
)
source = replaceExact(
  source,
  `  const reader = response.body.getReader()\n  const buffered = new BoundedByteBuffer(maxBuffered)\n`,
  `  let reader\n  try {\n    reader = response.body.getReader()\n  } catch (error) {\n    await cancelBodyQuietly(response.body)\n    throw error\n  }\n  const buffered = new BoundedByteBuffer(maxBuffered)\n`,
  'live reader acquisition cleanup',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/artemis-http-cleanup-errors.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

function liveResponse({ contentType = 'multipart/x-mixed-replace; boundary=frame', body }) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? contentType : null
      },
    },
    body,
  }
}

test('live stream pre-reader metadata rejection cancels the unread body without masking protocol errors', async (t) => {
  for (const [name, contentType, code, cancelImpl] of [
    ['unexpected content type', 'text/plain', 'unexpected-content-type', () => { throw new Error('cancel failed') }],
    ['missing boundary', 'multipart/x-mixed-replace', 'invalid-multipart', () => Promise.reject(new Error('cancel failed'))],
  ]) {
    await t.test(name, async () => {
      let cancelled = false
      const client = new ArtemisHttpClient({
        fetchImpl: async () => liveResponse({
          contentType,
          body: {
            cancel() {
              cancelled = true
              return cancelImpl()
            },
          },
        }),
      })
      const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
      await assert.rejects(
        iterator.next(),
        (error) => error instanceof ArtemisProtocolError && error.code === code,
      )
      assert.equal(cancelled, true)
    })
  }
})

test('live stream reader acquisition failure cancels the unread body and preserves the original error', async () => {
  const readerFailure = new Error('reader acquisition failed')
  let cancelled = false
  const client = new ArtemisHttpClient({
    fetchImpl: async () => liveResponse({
      body: {
        getReader() { throw readerFailure },
        cancel() {
          cancelled = true
          return Promise.reject(new Error('cancel failed'))
        },
      },
    }),
  })
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(iterator.next(), (error) => error === readerFailure)
  assert.equal(cancelled, true)
})
`
fs.writeFileSync(testPath, tests)

const docsPath = 'docs/live-viewer.md'
let docs = fs.readFileSync(docsPath, 'utf8')
docs = replaceExact(
  docs,
  '- Every upstream multipart frame is parsed and validated independently.\n',
  '- Global multipart metadata is validated before reader acquisition; rejection or reader-acquisition failure cancels the unread ARTEMIS response body without masking the primary error.\n- Every upstream multipart frame is parsed and validated independently.\n',
  'live pre-reader cleanup documentation',
)
fs.writeFileSync(docsPath, docs)
