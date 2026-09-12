import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { OVERVIEW_ROUTE, SNAPSHOT_ROUTE, createOverviewHandler, createSnapshotHandler, registerArtemisHostRoutes } from '../src/host/harness-routes.mjs'

async function serve(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function pngFixture() { return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x41]) }
function readyClient() {
  return {
    async health() { return { reachable: true, status: 'ready' } },
    async listDevices() { return [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: null, busy: false }] },
    async getStreamState() { return { connected: true, serial: 'emulator-5554', liveStreamPath: '/api/stream/device-live' } },
    async getSnapshot() { const data = pngFixture(); return { mediaType: 'image/png', data, bytes: data.byteLength } },
  }
}

function trustedContext(registrations, disposals = []) {
  return {
    webServer: { register(route) { registrations.push(route); return () => disposals.push(route.path) } },
    connection: { requestRejection() { return undefined } },
  }
}

test('registers exact overview and snapshot routes behind Harness connection trust', () => {
  const registrations = []
  const disposals = []
  const dispose = registerArtemisHostRoutes(trustedContext(registrations, disposals), readyClient())
  assert.deepEqual(registrations.map((route) => [route.kind, route.path]), [['exact', OVERVIEW_ROUTE], ['exact', SNAPSHOT_ROUTE]])
  dispose()
  assert.deepEqual(disposals, [SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
})

test('registration refuses routes without Harness connection trust', () => {
  assert.throws(() => registerArtemisHostRoutes({ webServer: { register() {} } }, readyClient()), /connection trust service/)
})

test('overview exposes normalized state', async () => {
  await serve(createOverviewHandler(readyClient()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).activeDeviceSerial, 'emulator-5554')
  })
})

test('snapshot returns one no-store PNG without exposing ARTEMIS location', async () => {
  const frame = pngFixture()
  await serve(createSnapshotHandler(readyClient()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(frame))
  })
})

test('Harness trust rejection happens before snapshot ARTEMIS access', async () => {
  let called = false
  const client = readyClient()
  client.getSnapshot = async () => { called = true; return { data: pngFixture() } }
  await serve(createSnapshotHandler(client, { requestRejection: () => 403 }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`)
    assert.equal(response.status, 403)
    assert.equal(called, false)
  })
})

test('snapshot accepts GET only and sanitizes protocol failures', async () => {
  let called = false
  const client = readyClient()
  client.getSnapshot = async () => { called = true; throw new ArtemisProtocolError('private detail') }
  await serve(createSnapshotHandler(client), async (baseUrl) => {
    const denied = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`, { method: 'POST' })
    assert.equal(denied.status, 405)
    assert.equal(called, false)
    const failed = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`)
    assert.equal(failed.status, 502)
    assert.doesNotMatch(await failed.text(), /private detail/)
  })
})
