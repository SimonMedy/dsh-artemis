import assert from 'node:assert/strict'
import { buildOverview } from '../src/host/harness-routes.mjs'
import { createBoundedPanelClient } from '../src/host/panel-client-bounds.mjs'
import { createProductArtemisHttpClient } from '../src/host/artemis-product-client.mjs'
import { panelMetadataLimits } from '../src/host/panel-client-bounds.mjs'

const baseUrl = process.env.ARTEMIS_BASE_URL ?? 'http://127.0.0.1:8000'
const source = createProductArtemisHttpClient({ baseUrl, timeoutMs: 5_000 })
const client = createBoundedPanelClient(source)

const health = await client.health()
assert.equal(health.reachable, true)
assert.equal(health.status, 'idle', 'fresh pinned ARTEMIS daemon should be idle')

const devices = await client.listDevices()
assert.ok(Array.isArray(devices))
assert.ok(devices.length <= panelMetadataLimits.maxDevices)
for (const device of devices) {
  assert.equal(typeof device.serial, 'string')
  assert.ok(device.serial.length > 0 && device.serial.length <= panelMetadataLimits.maxSerialChars)
  assert.equal(typeof device.state, 'string')
  assert.ok(device.state.length > 0 && device.state.length <= panelMetadataLimits.maxStateChars)
  assert.equal(typeof device.busy, 'boolean')
}

const stream = await client.getStreamState()
assert.deepEqual(stream, { connected: false, serial: null }, 'fresh daemon should not start a live stream implicitly')

const overview = await buildOverview(client)
assert.equal(overview.version, 1)
assert.deepEqual(overview.artemis, { state: 'ready', status: 'idle' })
assert.deepEqual(overview.devices, devices)
assert.equal(overview.activeDeviceSerial, null)
assert.deepEqual(overview.stream, { connected: false })
assert.deepEqual(overview.setup, {
  artemisRoot: 'not-supplied',
  python: 'profile-managed',
  mcpRuntime: 'unobservable',
})

console.log(`Pinned real ARTEMIS daemon compatibility smoke passed with ${devices.length} discovered device(s).`)
