import fs from 'node:fs'
function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}
const sourcePath = 'src/host/artemis-http.mjs'
let source = fs.readFileSync(sourcePath, 'utf8')
source = replaceExact(source,
  `async function readJsonWithinLimit(response, endpoint, maxBytes) {\n`,
  `async function cancelBodyQuietly(body) {\n  try { await body?.cancel?.() } catch {}\n}\n\nasync function readJsonWithinLimit(response, endpoint, maxBytes) {\n`,
  'cancel helper insertion')
source = replaceExact(source,
  `  if (!isJsonContentType(contentType)) {\n    throw new ArtemisProtocolError(\`${'${endpoint}'} returned an unexpected content type\`, { code: 'unexpected-content-type' })\n  }`,
  `  if (!isJsonContentType(contentType)) {\n    await cancelBodyQuietly(response.body)\n    throw new ArtemisProtocolError(\`${'${endpoint}'} returned an unexpected content type\`, { code: 'unexpected-content-type' })\n  }`,
  'content type cleanup')
source = replaceExact(source,
  `    } catch {\n      throw new ArtemisProtocolError(\`${'${endpoint}'} returned an invalid Content-Length\`, { code: 'invalid-content-length' })\n    }\n    if (declared > maxBytes) {\n      throw new ArtemisProtocolError(\`${'${endpoint}'} response exceeded the configured size limit\`, { code: 'response-too-large' })\n    }`,
  `    } catch {\n      await cancelBodyQuietly(response.body)\n      throw new ArtemisProtocolError(\`${'${endpoint}'} returned an invalid Content-Length\`, { code: 'invalid-content-length' })\n    }\n    if (declared > maxBytes) {\n      await cancelBodyQuietly(response.body)\n      throw new ArtemisProtocolError(\`${'${endpoint}'} response exceeded the configured size limit\`, { code: 'response-too-large' })\n    }`,
  'content length cleanup')
source = replaceExact(source,
  `    if (!response.ok) {\n      throw new ArtemisProtocolError(\`ARTEMIS returned HTTP ${'${response.status}'} for ${'${endpoint}'}\`, { code: 'http-error' })\n    }`,
  `    if (!response.ok) {\n      await cancelBodyQuietly(response.body)\n      throw new ArtemisProtocolError(\`ARTEMIS returned HTTP ${'${response.status}'} for ${'${endpoint}'}\`, { code: 'http-error' })\n    }`,
  'http error cleanup')
fs.writeFileSync(sourcePath, source)
const testPath = 'test/artemis-http-json-stream.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

function responseWithBody({ ok = true, status = 200, contentType = 'application/json', contentLength = null, cancel }) {
  return {
    ok,
    status,
    headers: { get(name) {
      const normalized = name.toLowerCase()
      if (normalized === 'content-type') return contentType
      if (normalized === 'content-length') return contentLength
      return null
    } },
    body: { cancel },
  }
}

test('Host JSON pre-reader rejections cancel response bodies without masking primary errors', async () => {
  const cases = [
    { response: responseWithBody({ ok: false, status: 503, cancel() { throw new Error('cancel failed') } }), code: 'http-error' },
    { response: responseWithBody({ contentType: 'text/plain', cancel() { return Promise.reject(new Error('cancel failed')) } }), code: 'unexpected-content-type' },
    { response: responseWithBody({ contentLength: '5', cancel() { throw new Error('cancel failed') } }), code: 'response-too-large', maxJsonBytes: 4 },
  ]
  for (const { response, code, maxJsonBytes } of cases) {
    let cancelled = false
    const originalCancel = response.body.cancel
    response.body.cancel = () => {
      cancelled = true
      return originalCancel()
    }
    const client = new ArtemisHttpClient({
      ...(maxJsonBytes ? { maxJsonBytes } : {}),
      fetchImpl: async () => response,
    })
    await assert.rejects(client.health(), (error) => error instanceof ArtemisProtocolError && error.code === code)
    assert.equal(cancelled, true)
  }
})
`
fs.writeFileSync(testPath, tests)
