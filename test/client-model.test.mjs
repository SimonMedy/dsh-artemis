import assert from 'node:assert/strict'
import test from 'node:test'
import {
  derivePanelState,
  overviewEndpoint,
  parseOverview,
  selectActiveDevice,
} from '../src/client/overview.mjs'
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
test('overview endpoint is same-origin for Web and unavailable for non-Web carriers', () => {
  assert.equal(
    overviewEndpoint({ protocol: 'http:', origin: 'http://127.0.0.1:3080' }),
    'http://127.0.0.1:3080/dsh-artemis/v1/overview',
  )
  assert.equal(overviewEndpoint({ protocol: 'file:', origin: 'null' }), null)
})
