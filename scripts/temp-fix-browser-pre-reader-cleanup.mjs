import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

fs.writeFileSync('src/client/response-body-cleanup.mjs', `export async function cancelBodyQuietly(body) {
  try { await body?.cancel?.() } catch {}
}
`)

const boundedPath = 'src/client/bounded-json.mjs'
let bounded = fs.readFileSync(boundedPath, 'utf8')
bounded = replaceExact(
  bounded,
  "import { isJsonContentType } from '../shared/json-content-type.mjs'\n",
  "import { isJsonContentType } from '../shared/json-content-type.mjs'\nimport { cancelBodyQuietly } from './response-body-cleanup.mjs'\n",
  'bounded JSON cleanup import',
)
bounded = replaceExact(
  bounded,
  `  assertJsonContentType(response, label)\n  assertDeclaredLength(response, maxBytes, label)\n\n  const reader = response?.body?.getReader?.()\n  if (!reader) throw new Error(\`${'${label}'} returned a non-streamable response body\`)`,
  `  try {\n    assertJsonContentType(response, label)\n    assertDeclaredLength(response, maxBytes, label)\n  } catch (error) {\n    await cancelBodyQuietly(response?.body)\n    throw error\n  }\n\n  let reader\n  try {\n    reader = response?.body?.getReader?.()\n  } catch (error) {\n    await cancelBodyQuietly(response?.body)\n    throw error\n  }\n  if (!reader) {\n    await cancelBodyQuietly(response?.body)\n    throw new Error(\`${'${label}'} returned a non-streamable response body\`)\n  }`,
  'bounded JSON pre-reader cleanup',
)
fs.writeFileSync(boundedPath, bounded)

const evidencePath = 'src/client/evidence-data.mjs'
let evidence = fs.readFileSync(evidencePath, 'utf8')
evidence = replaceExact(
  evidence,
  "import { readBoundedJsonResponse } from './bounded-json.mjs'\n",
  "import { readBoundedJsonResponse } from './bounded-json.mjs'\nimport { cancelBodyQuietly } from './response-body-cleanup.mjs'\n",
  'evidence cleanup import',
)
evidence = replaceExact(
  evidence,
  `  if (!response.ok) throw new Error(\`${'${errorLabel}'} returned HTTP ${'${response.status}'}\`)`,
  `  if (!response.ok) {\n    await cancelBodyQuietly(response.body)\n    throw new Error(\`${'${errorLabel}'} returned HTTP ${'${response.status}'}\`)\n  }`,
  'evidence HTTP cleanup',
)
fs.writeFileSync(evidencePath, evidence)

const overviewPath = 'src/client/overview.mjs'
let overview = fs.readFileSync(overviewPath, 'utf8')
overview = replaceExact(
  overview,
  "import { readBoundedJsonResponse } from './bounded-json.mjs'\n",
  "import { readBoundedJsonResponse } from './bounded-json.mjs'\nimport { cancelBodyQuietly } from './response-body-cleanup.mjs'\n",
  'overview cleanup import',
)
overview = replaceExact(
  overview,
  `  if (!response.ok) throw new Error(\`dsh-artemis overview returned HTTP ${'${response.status}'}\`)`,
  `  if (!response.ok) {\n    await cancelBodyQuietly(response.body)\n    throw new Error(\`dsh-artemis overview returned HTTP ${'${response.status}'}\`)\n  }`,
  'overview HTTP cleanup',
)
fs.writeFileSync(overviewPath, overview)

const snapshotPath = 'src/client/snapshot.mjs'
let snapshot = fs.readFileSync(snapshotPath, 'utf8')
snapshot = replaceExact(
  snapshot,
  "import { SNAPSHOT_ROUTE } from '../shared/protocol.mjs'\n",
  "import { SNAPSHOT_ROUTE } from '../shared/protocol.mjs'\nimport { cancelBodyQuietly } from './response-body-cleanup.mjs'\n",
  'snapshot cleanup import',
)
snapshot = replaceExact(
  snapshot,
  `  const declaredText = response.headers.get('content-length')\n  if (declaredText !== null) {\n    if (!/^\\d+$/.test(declaredText)) throw new Error('Android snapshot returned an invalid Content-Length')\n    const declared = Number(declaredText)\n    if (!Number.isSafeInteger(declared) || declared <= 0) throw new Error('Android snapshot returned an invalid Content-Length')\n    if (declared > maxBytes) throw new Error('Android snapshot exceeded the browser size limit')\n  }\n  if (!response.body) throw new Error('Android snapshot returned an empty body')\n\n  const reader = response.body.getReader()`,
  `  const declaredText = response.headers.get('content-length')\n  if (declaredText !== null) {\n    try {\n      if (!/^\\d+$/.test(declaredText)) throw new Error('Android snapshot returned an invalid Content-Length')\n      const declared = Number(declaredText)\n      if (!Number.isSafeInteger(declared) || declared <= 0) throw new Error('Android snapshot returned an invalid Content-Length')\n      if (declared > maxBytes) throw new Error('Android snapshot exceeded the browser size limit')\n    } catch (error) {\n      await cancelBodyQuietly(response.body)\n      throw error\n    }\n  }\n  if (!response.body) throw new Error('Android snapshot returned an empty body')\n\n  let reader\n  try {\n    reader = response.body.getReader()\n  } catch (error) {\n    await cancelBodyQuietly(response.body)\n    throw error\n  }`,
  'snapshot Content-Length cleanup',
)
snapshot = replaceExact(
  snapshot,
  `  if (!response.ok) throw new Error(\`Android snapshot returned HTTP ${'${response.status}'}\`)\n  if ((response.headers.get('content-type') ?? '').toLowerCase() !== 'image/png') {\n    throw new Error('Android snapshot returned an unexpected content type')\n  }`,
  `  if (!response.ok) {\n    await cancelBodyQuietly(response.body)\n    throw new Error(\`Android snapshot returned HTTP ${'${response.status}'}\`)\n  }\n  if ((response.headers.get('content-type') ?? '').toLowerCase() !== 'image/png') {\n    await cancelBodyQuietly(response.body)\n    throw new Error('Android snapshot returned an unexpected content type')\n  }`,
  'snapshot HTTP and MIME cleanup',
)
fs.writeFileSync(snapshotPath, snapshot)

const boundedTestPath = 'test/bounded-json.test.mjs'
let boundedTests = fs.readFileSync(boundedTestPath, 'utf8')
boundedTests += `

test('browser JSON pre-reader metadata rejection cancels the body without masking the primary error', async () => {
  for (const [headers, expected] of [
    [{ 'content-type': 'text/plain' }, /content type/],
    [{ 'content-type': 'application/json', 'content-length': '1000' }, /size limit/],
    [{ 'content-type': 'application/json', 'content-length': '2x' }, /content length/],
  ]) {
    let cancelled = false
    const response = {
      headers: new Headers(headers),
      body: {
        cancel() {
          cancelled = true
          throw new Error('cancel failed')
        },
      },
    }
    await assert.rejects(readBoundedJsonResponse(response, { maxBytes: 16 }), expected)
    assert.equal(cancelled, true)
  }
})

test('browser JSON non-streamable bodies are cancelled when possible', async () => {
  let cancelled = false
  const response = {
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      cancel() {
        cancelled = true
        return Promise.reject(new Error('cancel failed'))
      },
    },
  }
  await assert.rejects(readBoundedJsonResponse(response), /non-streamable response body/)
  assert.equal(cancelled, true)
})
`
fs.writeFileSync(boundedTestPath, boundedTests)

const evidenceTestPath = 'test/client-evidence.test.mjs'
let evidenceTests = fs.readFileSync(evidenceTestPath, 'utf8')
evidenceTests += `

test('evidence HTTP rejection cancels the unread browser response body', async () => {
  let cancelled = false
  await assert.rejects(fetchEvidence({
    locationLike,
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      body: {
        cancel() {
          cancelled = true
          return Promise.reject(new Error('cancel failed'))
        },
      },
    }),
  }), /HTTP 503/)
  assert.equal(cancelled, true)
})
`
fs.writeFileSync(evidenceTestPath, evidenceTests)

const modelTestPath = 'test/client-model.test.mjs'
let modelTests = fs.readFileSync(modelTestPath, 'utf8')
modelTests = replaceExact(
  modelTests,
  `  derivePanelState,\n  overviewEndpoint,\n  parseOverview,`,
  `  derivePanelState,\n  fetchOverview,\n  overviewEndpoint,\n  parseOverview,`,
  'overview fetch test import',
)
modelTests += `

test('overview HTTP rejection cancels the unread browser response body', async () => {
  let cancelled = false
  await assert.rejects(fetchOverview({
    locationLike: { protocol: 'http:', origin: 'http://127.0.0.1:3080' },
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      body: {
        cancel() {
          cancelled = true
          throw new Error('cancel failed')
        },
      },
    }),
  }), /HTTP 502/)
  assert.equal(cancelled, true)
})
`
fs.writeFileSync(modelTestPath, modelTests)

const snapshotTestPath = 'test/client-snapshot-stream.test.mjs'
let snapshotTests = fs.readFileSync(snapshotTestPath, 'utf8')
snapshotTests += `

function rejectedSnapshotResponse({ ok = true, status = 200, contentType = 'image/png', contentLength = null, cancel }) {
  return {
    ok,
    status,
    headers: new Headers({
      'content-type': contentType,
      ...(contentLength === null ? {} : { 'content-length': contentLength }),
    }),
    body: { cancel },
  }
}

test('snapshot pre-reader rejection cancels unread bodies and preserves primary errors', async () => {
  const cases = [
    { response: rejectedSnapshotResponse({ ok: false, status: 503, cancel() { throw new Error('cancel failed') } }), expected: /HTTP 503/ },
    { response: rejectedSnapshotResponse({ contentType: 'text/plain', cancel() { return Promise.reject(new Error('cancel failed')) } }), expected: /unexpected content type/ },
    { response: rejectedSnapshotResponse({ contentLength: '999', cancel() { throw new Error('cancel failed') } }), expected: /browser size limit/, maxBytes: 16 },
    { response: rejectedSnapshotResponse({ contentLength: '2x', cancel() { return Promise.reject(new Error('cancel failed')) } }), expected: /invalid Content-Length/ },
  ]
  for (const { response, expected, maxBytes } of cases) {
    let cancelled = false
    const originalCancel = response.body.cancel
    response.body.cancel = () => {
      cancelled = true
      return originalCancel()
    }
    await assert.rejects(fetchSnapshot({
      locationLike,
      ...(maxBytes ? { maxBytes } : {}),
      fetchImpl: async () => response,
    }), expected)
    assert.equal(cancelled, true)
  }
})
`
fs.writeFileSync(snapshotTestPath, snapshotTests)

const architecturePath = 'docs/architecture.md'
let architecture = fs.readFileSync(architecturePath, 'utf8')
architecture = replaceExact(
  architecture,
  'Owns the native Harness UI surface, right-sidebar registration, rendering, reconnect/refresh UX and screen viewer. It is the compatibility boundary for Harness client APIs.\n',
  'Owns the native Harness UI surface, right-sidebar registration, rendering, reconnect/refresh UX and screen viewer. It is the compatibility boundary for Harness client APIs. Browser response bodies are bounded and explicitly cancelled on pre-reader HTTP/metadata rejection so failed requests do not retain unread transport resources.\n',
  'browser cleanup architecture invariant',
)
fs.writeFileSync(architecturePath, architecture)
