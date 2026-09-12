import assert from 'node:assert/strict'
import test from 'node:test'
import { ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { createBoundedPanelClient, panelMetadataLimits } from '../src/host/panel-client-bounds.mjs'

function validDevice(overrides = {}) {
  return {
    serial: 'emulator-5554',
    state: 'device',
    model: 'Pixel_9',
    product: 'sdk_gphone',
    busy: false,
    ...overrides,
  }
}

function fakeClient(overrides = {}) {
  return {
    async health() { return { reachable: true, status: 'ready' } },
    async listDevices() { return [validDevice()] },
    async getStreamState() { return { connected: true, serial: 'emulator-5554', liveStreamPath: '/api/stream/device-live' } },
    async getSnapshot() { return { mediaType: 'image/png', data: new Uint8Array([1]) } },
    async *streamSnapshots() { yield { mediaType: 'image/png', data: new Uint8Array([1]) } },
    ...overrides,
  }
}

function isPanelMetadataError(error) {
  return error instanceof ArtemisProtocolError && error.code === 'panel-metadata-invalid'
}

test('panel adapter preserves normal bounded device metadata', async () => {
  const client = createBoundedPanelClient(fakeClient())
  assert.deepEqual(await client.health(), { reachable: true, status: 'ready' })
  assert.deepEqual(await client.listDevices(), [validDevice()])
  assert.deepEqual(await client.getStreamState(), { connected: true, serial: 'emulator-5554' })
})

test('panel adapter rejects oversized device collections', async () => {
  const devices = Array.from({ length: panelMetadataLimits.maxDevices + 1 }, (_, index) => validDevice({ serial: `emulator-${index}` }))
  const client = createBoundedPanelClient(fakeClient({ async listDevices() { return devices } }))
  await assert.rejects(client.listDevices(), isPanelMetadataError)
})

test('panel adapter rejects oversized browser-visible strings instead of truncating', async (t) => {
  await t.test('health status', async () => {
    const client = createBoundedPanelClient(fakeClient({
      async health() { return { reachable: true, status: 'x'.repeat(panelMetadataLimits.maxStatusChars + 1) } },
    }))
    await assert.rejects(client.health(), isPanelMetadataError)
  })

  for (const [field, limit] of [
    ['serial', panelMetadataLimits.maxSerialChars],
    ['state', panelMetadataLimits.maxStateChars],
    ['model', panelMetadataLimits.maxModelChars],
    ['product', panelMetadataLimits.maxProductChars],
  ]) {
    await t.test(`device ${field}`, async () => {
      const client = createBoundedPanelClient(fakeClient({
        async listDevices() { return [validDevice({ [field]: 'x'.repeat(limit + 1) })] },
      }))
      await assert.rejects(client.listDevices(), isPanelMetadataError)
    })
  }

  await t.test('stream serial', async () => {
    const client = createBoundedPanelClient(fakeClient({
      async getStreamState() {
        return { connected: true, serial: 'x'.repeat(panelMetadataLimits.maxSerialChars + 1) }
      },
    }))
    await assert.rejects(client.getStreamState(), isPanelMetadataError)
  })
})

test('panel adapter rejects malformed upstream types', async () => {
  await assert.rejects(
    createBoundedPanelClient(fakeClient({ async listDevices() { return [{ ...validDevice(), busy: 'false' }] } })).listDevices(),
    isPanelMetadataError,
  )
  await assert.rejects(
    createBoundedPanelClient(fakeClient({ async getStreamState() { return { connected: 'yes', serial: null } } })).getStreamState(),
    isPanelMetadataError,
  )
})

test('snapshot and live transport remain delegated to the validated ARTEMIS client', async () => {
  let snapshotCalls = 0
  const source = fakeClient({
    async getSnapshot() {
      snapshotCalls += 1
      return { mediaType: 'image/png', data: new Uint8Array([7]) }
    },
  })
  const client = createBoundedPanelClient(source)
  assert.deepEqual(await client.getSnapshot(), { mediaType: 'image/png', data: new Uint8Array([7]) })
  assert.equal(snapshotCalls, 1)
  const iterator = client.streamSnapshots()[Symbol.asyncIterator]()
  assert.deepEqual((await iterator.next()).value, { mediaType: 'image/png', data: new Uint8Array([1]) })
})
