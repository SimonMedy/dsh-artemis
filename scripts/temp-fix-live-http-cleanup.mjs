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
  `    if (!response.ok) {\n      throw new ArtemisProtocolError(\`ARTEMIS returned HTTP \${response.status} for /api/stream/device-live\`, { code: 'http-error' })\n    }\n    try {\n      yield* readPngFrames(response, this.maxFrameBytes)\n    } finally {\n      controller.abort()\n      signal?.removeEventListener('abort', forwardAbort)\n    }`,
  `    try {\n      if (!response.ok) {\n        throw new ArtemisProtocolError(\`ARTEMIS returned HTTP \${response.status} for /api/stream/device-live\`, { code: 'http-error' })\n      }\n      yield* readPngFrames(response, this.maxFrameBytes)\n    } finally {\n      controller.abort()\n      signal?.removeEventListener('abort', forwardAbort)\n    }`,
  'live HTTP cleanup block',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/artemis-http-cleanup-errors.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

test('live stream HTTP errors abort the internal request signal', async () => {
  let requestSignal
  const client = new ArtemisHttpClient({
    fetchImpl: async (_url, options) => {
      requestSignal = options.signal
      return {
        ok: false,
        status: 503,
        headers: { get() { return null } },
        body: null,
      }
    },
  })

  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  await assert.rejects(
    iterator.next(),
    (error) => error instanceof ArtemisProtocolError && error.code === 'http-error',
  )
  assert.ok(requestSignal)
  assert.equal(requestSignal.aborted, true)
})
`
fs.writeFileSync(testPath, tests)
