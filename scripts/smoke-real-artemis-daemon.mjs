import assert from 'node:assert/strict'
import { buildOverview } from '../src/host/harness-routes.mjs'
import { createBoundedPanelClient } from '../src/host/panel-client-bounds.mjs'
import { createProductArtemisHttpClient } from '../src/host/artemis-product-client.mjs'

const baseUrl = process.env.ARTEMIS_BASE_URL ?? 'http://127.0.0.1:8000'
const source = createProductArtemisHttpClient({ baseUrl, timeoutMs: 5_000 })
const client = createBoundedPanelClient(source)

const health = await client.health()
assert.equal(health.reachable, true)
assert.equal(health.status, 'idle', 'fresh pinned ARTEMIS daemon should be idle')

const devices = await client.listDevices()
assert.deepEqual(devices, [], 'GitHub-hosted daemon smoke should not discover an Android device')

const stream = await client.getStreamState()
assert.deepEqual(stream, { connected: false, serial: null })

const overview = await buildOverview(client)
assert.equal(overview.version, 1)
assert.deepEqual(overview.artemis, { state: 'ready', status: 'idle' })
assert.deepEqual(overview.devices, [])
assert.equal(overview.activeDeviceSerial, null)
assert.deepEqual(overview.stream, { connected: false })
assert.deepEqual(overview.setup, {
  artemisRoot: 'not-supplied',
  python: 'profile-managed',
  mcpRuntime: 'unobservable',
})

console.log('Pinned real ARTEMIS daemon compatibility smoke passed.')
