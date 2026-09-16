import { readFileSync, writeFileSync } from 'node:fs'

const sourcePath = 'src/host/panel-client-bounds.mjs'
let source = readFileSync(sourcePath, 'utf8')
const oldHealth = `      return Object.freeze({
        reachable: Boolean(value.reachable),
        status: boundedString(value.status, PANEL_METADATA_LIMITS.maxStatusChars, 'health.status'),
      })`
const newHealth = `      if (typeof value.reachable !== 'boolean') throw protocolError('health.reachable')
      return Object.freeze({
        reachable: value.reachable,
        status: boundedString(value.status, PANEL_METADATA_LIMITS.maxStatusChars, 'health.status'),
      })`
if (source.split(oldHealth).length !== 2) throw new Error('expected one panel health block')
writeFileSync(sourcePath, source.replace(oldHealth, newHealth))

const testPath = 'test/panel-client-bounds.test.mjs'
let test = readFileSync(testPath, 'utf8')
const oldTest = `test('panel adapter rejects malformed upstream types', async () => {
  await assert.rejects(
    createBoundedPanelClient(fakeClient({ async listDevices() { return [{ ...validDevice(), busy: 'false' }] } })).listDevices(),
    isPanelMetadataError,
  )
  await assert.rejects(
    createBoundedPanelClient(fakeClient({ async getStreamState() { return { connected: 'yes', serial: null } } })).getStreamState(),
    isPanelMetadataError,
  )
})`
const newTest = `test('panel adapter rejects malformed upstream types', async (t) => {
  await t.test('health reachable', async () => {
    for (const reachable of ['false', 1, null, undefined]) {
      await assert.rejects(
        createBoundedPanelClient(fakeClient({ async health() { return { reachable, status: 'ready' } } })).health(),
        isPanelMetadataError,
      )
    }
  })
  await t.test('device busy', async () => {
    await assert.rejects(
      createBoundedPanelClient(fakeClient({ async listDevices() { return [{ ...validDevice(), busy: 'false' }] } })).listDevices(),
      isPanelMetadataError,
    )
  })
  await t.test('stream connected', async () => {
    await assert.rejects(
      createBoundedPanelClient(fakeClient({ async getStreamState() { return { connected: 'yes', serial: null } } })).getStreamState(),
      isPanelMetadataError,
    )
  })
})`
if (test.split(oldTest).length !== 2) throw new Error('expected one malformed-types test block')
writeFileSync(testPath, test.replace(oldTest, newTest))
