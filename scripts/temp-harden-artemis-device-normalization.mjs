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
  `function optionalString(value) {\n  if (value === null || value === undefined) return null\n  const text = String(value).trim()\n  return text || null\n}`,
  `function optionalString(value) {\n  if (value === null || value === undefined) return null\n  if (typeof value !== 'string') {\n    throw new ArtemisProtocolError('ARTEMIS returned a non-string protocol field', { code: 'invalid-json' })\n  }\n  const text = value.trim()\n  return text || null\n}`,
  'strict optional protocol string',
)
source = replaceExact(
  source,
  `  const busyValue = item.busy ?? item.is_busy\n  return Object.freeze({\n    serial,\n    state,\n    model: optionalString(item.model),\n    product: optionalString(item.product),\n    busy: Boolean(busyValue) || ['busy', 'running', 'locked'].includes(state),\n  })`,
  `  const busyValue = item.busy ?? item.is_busy\n  if (busyValue !== null && busyValue !== undefined && typeof busyValue !== 'boolean') {\n    throw new ArtemisProtocolError('/api/devices contained a device with a non-boolean busy field', { code: 'invalid-json' })\n  }\n  return Object.freeze({\n    serial,\n    state,\n    model: optionalString(item.model),\n    product: optionalString(item.product),\n    busy: busyValue ?? ['busy', 'running', 'locked'].includes(state),\n  })`,
  'strict device busy field',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/artemis-http.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

test('device normalization rejects implicit protocol type coercion', async (t) => {
  await t.test('busy string is rejected instead of becoming truthy', async () => {
    await withServer((_req, res) => json(res, { devices: [{ serial: 'emulator-5554', state: 'device', busy: 'false' }] }), async (baseUrl) => {
      await assert.rejects(
        new ArtemisHttpClient({ baseUrl }).listDevices(),
        (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
      )
    })
  })

  await t.test('structured serial is rejected instead of being stringified', async () => {
    await withServer((_req, res) => json(res, { devices: [{ serial: { raw: 'emulator-5554' }, state: 'device', busy: false }] }), async (baseUrl) => {
      await assert.rejects(
        new ArtemisHttpClient({ baseUrl }).listDevices(),
        (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
      )
    })
  })

  await t.test('numeric status is rejected instead of being stringified', async () => {
    await withServer((_req, res) => json(res, { status: 1 }), async (baseUrl) => {
      await assert.rejects(
        new ArtemisHttpClient({ baseUrl }).health(),
        (error) => error instanceof ArtemisProtocolError && error.code === 'invalid-json',
      )
    })
  })
})
`
fs.writeFileSync(testPath, tests)

const docsPath = 'docs/architecture.md'
let docs = fs.readFileSync(docsPath, 'utf8')
docs = replaceExact(
  docs,
  'Owns local connectivity, ARTEMIS discovery/status, device metadata and user-initiated device controls. It is the compatibility boundary for ARTEMIS and host-side Harness APIs.\n',
  'Owns local connectivity, ARTEMIS discovery/status, device metadata and user-initiated device controls. It is the compatibility boundary for ARTEMIS and host-side Harness APIs. ARTEMIS response fields are type-checked at this boundary without implicit string/boolean coercion so malformed upstream values fail closed before they reach panel DTOs.\n',
  'Host protocol validation architecture invariant',
)
fs.writeFileSync(docsPath, docs)
