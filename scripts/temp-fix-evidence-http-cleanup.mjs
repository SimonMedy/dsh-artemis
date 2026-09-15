import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const sourcePath = 'src/host/artemis-evidence.mjs'
let source = fs.readFileSync(sourcePath, 'utf8')
source = replaceExact(
  source,
  `async function readJsonWithinLimit(response, endpoint, maxBytes) {\n`,
  `async function cancelBodyQuietly(body) {\n  try { await body?.cancel?.() } catch {}\n}\n\nasync function readJsonWithinLimit(response, endpoint, maxBytes) {\n`,
  'cancel helper insertion',
)
source = replaceExact(
  source,
  `  if (!isJsonContentType(contentType)) {\n    throw new ArtemisProtocolError(\`${'${endpoint}'} returned an unexpected content type\`, { code: 'unexpected-content-type' })\n  }`,
  `  if (!isJsonContentType(contentType)) {\n    await cancelBodyQuietly(response.body)\n    throw new ArtemisProtocolError(\`${'${endpoint}'} returned an unexpected content type\`, { code: 'unexpected-content-type' })\n  }`,
  'content type cleanup',
)
source = replaceExact(
  source,
  `    } catch {\n      throw new ArtemisProtocolError(\`${'${endpoint}'} returned an invalid Content-Length\`, { code: 'invalid-evidence' })\n    }\n    if (declared > maxBytes) {\n      throw new ArtemisProtocolError(\`${'${endpoint}'} response exceeded the configured size limit\`, { code: 'response-too-large' })\n    }`,
  `    } catch {\n      await cancelBodyQuietly(response.body)\n      throw new ArtemisProtocolError(\`${'${endpoint}'} returned an invalid Content-Length\`, { code: 'invalid-evidence' })\n    }\n    if (declared > maxBytes) {\n      await cancelBodyQuietly(response.body)\n      throw new ArtemisProtocolError(\`${'${endpoint}'} response exceeded the configured size limit\`, { code: 'response-too-large' })\n    }`,
  'content length cleanup',
)
source = replaceExact(
  source,
  `  if (!response.ok) {\n    const code = response.status === 404 ? 'not-found' : 'http-error'\n    throw new ArtemisProtocolError(\`ARTEMIS returned HTTP ${'${response.status}'} for ${'${endpoint}'}\`, { code })\n  }`,
  `  if (!response.ok) {\n    const code = response.status === 404 ? 'not-found' : 'http-error'\n    await cancelBodyQuietly(response.body)\n    throw new ArtemisProtocolError(\`ARTEMIS returned HTTP ${'${response.status}'} for ${'${endpoint}'}\`, { code })\n  }`,
  'http error cleanup',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/artemis-evidence-json-stream.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

function responseWithBody({ ok = true, status = 200, contentType = 'application/json', contentLength = null, cancel }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        const normalized = name.toLowerCase()
        if (normalized === 'content-type') return contentType
        if (normalized === 'content-length') return contentLength
        return null
      },
    },
    body: { cancel },
  }
}

function evidenceClientWithResponse(response, { maxJsonBytes = 1_048_576 } = {}) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    maxJsonBytes,
    fetchImpl: async () => response,
  })
}

test('evidence HTTP errors cancel response bodies without masking the protocol error', async () => {
  let cancelled = false
  const response = responseWithBody({
    ok: false,
    status: 503,
    cancel() {
      cancelled = true
      throw new Error('cancel failed')
    },
  })

  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(response)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'http-error',
  )
  assert.equal(cancelled, true)
})

test('evidence metadata rejection cancels the response body before reader acquisition', async () => {
  let wrongTypeCancelled = false
  const wrongType = responseWithBody({
    contentType: 'text/plain',
    cancel() { wrongTypeCancelled = true },
  })
  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(wrongType)),
    (error) => error instanceof ArtemisProtocolError && error.code === 'unexpected-content-type',
  )
  assert.equal(wrongTypeCancelled, true)

  let oversizedCancelled = false
  const oversized = responseWithBody({
    contentLength: '5',
    cancel() {
      oversizedCancelled = true
      return Promise.reject(new Error('cancel failed'))
    },
  })
  await assert.rejects(
    getTaskStatus(evidenceClientWithResponse(oversized, { maxJsonBytes: 4 })),
    (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large',
  )
  assert.equal(oversizedCancelled, true)
})
`
fs.writeFileSync(testPath, tests)
