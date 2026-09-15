import assert from 'node:assert/strict'
import test from 'node:test'
import {
  derivePanelState,
  fetchOverview,
  overviewEndpoint,
  parseOverview,
  selectActiveDevice,
} from '../src/client/overview.mjs'
import { PANEL_METADATA_LIMITS } from '../src/shared/panel-metadata-limits.mjs'

function readyOverview(overrides = {}) {
  return {
    version: 1,
    artemis: { state: 'ready', status: 'ready' },
    setup: { artemisRoot: 'not-supplied', python: 'profile-managed', mcpRuntime: 'unobservable' },
    devices: [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: 'sdk_gphone', busy: false }],
    activeDeviceSerial: 'emulator-5554',
    stream: { connected: true },
    ...overrides,
  }
}
test('parses the versioned overview into project-owned normalized state', () => {
  const overview = parseOverview(readyOverview())
  assert.deepEqual(overview, readyOverview())
  assert.equal(selectActiveDevice(overview)?.model, 'Pixel_9')
  assert.deepEqual(derivePanelState(overview), {
    dot: 'done',
    artemisLabel: 'ARTEMIS Ready',
    deviceLabel: 'Ready',
  })
})
test('busy active device maps to the Harness ongoing semantic', () => {
  const overview = parseOverview(readyOverview({
    devices: [{ serial: 'emulator-5554', state: 'running', model: null, product: null, busy: true }],
  }))
  assert.equal(derivePanelState(overview).dot, 'ongoing')
  assert.equal(derivePanelState(overview).deviceLabel, 'Busy')
})
test('offline and no-device states remain distinct', () => {
  const offline = parseOverview({
    version: 1,
    artemis: { state: 'offline', status: null },
    setup: { artemisRoot: 'invalid', python: 'unknown', mcpRuntime: 'unobservable' },
    devices: [],
    activeDeviceSerial: null,
    stream: { connected: false },
  })
  assert.deepEqual(derivePanelState(offline), {
    dot: 'idle',
    artemisLabel: 'ARTEMIS Offline',
    deviceLabel: 'No device',
  })
  const noDevice = parseOverview(readyOverview({ devices: [], activeDeviceSerial: null, stream: { connected: false } }))
  assert.equal(derivePanelState(noDevice).dot, 'warning')
  assert.equal(derivePanelState(noDevice).deviceLabel, 'No Android device')
})
test('rejects unsupported protocol, malformed setup and malformed device state', () => {
  assert.throws(() => parseOverview({ ...readyOverview(), version: 2 }), /Unsupported/)
  assert.throws(() => parseOverview(readyOverview({ setup: { artemisRoot: '/private/path', python: 'profile-managed', mcpRuntime: 'unobservable' } })), /setup.artemisRoot/)
  assert.throws(() => parseOverview(readyOverview({ setup: { artemisRoot: 'validated', python: 'profile-managed', mcpRuntime: 'connected' } })), /mcpRuntime/)
  assert.throws(() => parseOverview(readyOverview({ devices: [{ serial: '', state: 'device', busy: false }] })), /serial/)
})
test('browser parser independently enforces the panel metadata limits', () => {
  const extraDevices = Array.from({ length: PANEL_METADATA_LIMITS.maxDevices + 1 }, (_, index) => ({
    serial: `emulator-${index}`,
    state: 'device',
    model: null,
    product: null,
    busy: false,
  }))
  assert.throws(() => parseOverview(readyOverview({ devices: extraDevices })), /devices exceeds/)
  assert.throws(() => parseOverview(readyOverview({ artemis: { state: 'ready', status: 'x'.repeat(PANEL_METADATA_LIMITS.maxStatusChars + 1) } })), /artemis.status/)
  assert.throws(() => parseOverview(readyOverview({ activeDeviceSerial: 'x'.repeat(PANEL_METADATA_LIMITS.maxSerialChars + 1) })), /activeDeviceSerial/)

  for (const [field, limit] of [
    ['serial', PANEL_METADATA_LIMITS.maxSerialChars],
    ['state', PANEL_METADATA_LIMITS.maxStateChars],
    ['model', PANEL_METADATA_LIMITS.maxModelChars],
    ['product', PANEL_METADATA_LIMITS.maxProductChars],
  ]) {
    assert.throws(() => parseOverview(readyOverview({
      devices: [{ serial: 'emulator-5554', state: 'device', model: null, product: null, busy: false, [field]: 'x'.repeat(limit + 1) }],
    })), new RegExp(field))
  }
})
test('overview endpoint is same-origin for Web and unavailable for non-Web carriers', () => {
  assert.equal(
    overviewEndpoint({ protocol: 'http:', origin: 'http://127.0.0.1:3080' }),
    'http://127.0.0.1:3080/dsh-artemis/v1/overview',
  )
  assert.equal(overviewEndpoint({ protocol: 'file:', origin: 'null' }), null)
})


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
