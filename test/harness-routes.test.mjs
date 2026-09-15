import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { LIVE_ROUTE, OVERVIEW_ROUTE, SNAPSHOT_ROUTE, createLiveHandler, createOverviewHandler, createSnapshotHandler, registerArtemisHostRoutes } from '../src/host/harness-routes.mjs'

async function serve(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function pngFixture(fill = 0x41) { return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, fill]) }
function readyClient() {
  return {
    async health() { return { reachable: true, status: 'ready' } },
    async listDevices() { return [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: null, busy: false }] },
    async getStreamState() { return { connected: true, serial: 'emulator-5554', liveStreamPath: '/api/stream/device-live' } },
    async getSnapshot() { const data = pngFixture(); return { mediaType: 'image/png', data, bytes: data.byteLength } },
    async *streamSnapshots() {
      for (const data of [pngFixture(0x41), pngFixture(0x42)]) yield { mediaType: 'image/png', data, bytes: data.byteLength }
    },
  }
}
function trustedContext(registrations, disposals = []) {
  return {
    webServer: { register(route) { registrations.push(route); return () => disposals.push(route.path) } },
    connection: { requestRejection() { return undefined } },
  }
}

test('registers exact overview, snapshot and live routes behind Harness connection trust', () => {
  const registrations = []
  const disposals = []
  const dispose = registerArtemisHostRoutes(trustedContext(registrations, disposals), readyClient())
  assert.deepEqual(registrations.map((route) => [route.kind, route.path]), [['exact', OVERVIEW_ROUTE], ['exact', SNAPSHOT_ROUTE], ['exact', LIVE_ROUTE]])
  dispose()
  assert.deepEqual(disposals, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
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

test('live route re-emits normalized no-store multipart PNG frames', async () => {
  await serve(createLiveHandler(readyClient()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${LIVE_ROUTE}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'multipart/x-mixed-replace; boundary=dsh-artemis-frame')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    const body = Buffer.from(await response.arrayBuffer())
    assert.equal(body.toString('latin1').match(/--dsh-artemis-frame\r\n/g)?.length, 2)
    assert.equal(body.toString('latin1').match(/Content-Type: image\/png\r\n/g)?.length, 2)
  })
})

test('Harness trust rejection happens before snapshot and live ARTEMIS access', async () => {
  let snapshotCalled = false
  let liveCalled = false
  const client = readyClient()
  client.getSnapshot = async () => { snapshotCalled = true; return { data: pngFixture() } }
  client.streamSnapshots = async function* () { liveCalled = true; yield { data: pngFixture() } }
  await serve(createSnapshotHandler(client, { requestRejection: () => 403 }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`)
    assert.equal(response.status, 403)
  })
  await serve(createLiveHandler(client, { requestRejection: () => 403 }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${LIVE_ROUTE}`)
    assert.equal(response.status, 403)
  })
  assert.equal(snapshotCalled, false)
  assert.equal(liveCalled, false)
})

test('snapshot and live accept GET only and sanitize protocol failures', async () => {
  let snapshotCalled = false
  let liveCalled = false
  const client = readyClient()
  client.getSnapshot = async () => { snapshotCalled = true; throw new ArtemisProtocolError('private detail') }
  client.streamSnapshots = async function* () { liveCalled = true; throw new ArtemisProtocolError('private live detail') }
  await serve(createSnapshotHandler(client), async (baseUrl) => {
    const denied = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`, { method: 'POST' })
    assert.equal(denied.status, 405)
    assert.equal(snapshotCalled, false)
    const failed = await fetch(`${baseUrl}${SNAPSHOT_ROUTE}`)
    assert.equal(failed.status, 502)
    assert.doesNotMatch(await failed.text(), /private detail/)
  })
  await serve(createLiveHandler(client), async (baseUrl) => {
    const denied = await fetch(`${baseUrl}${LIVE_ROUTE}`, { method: 'POST' })
    assert.equal(denied.status, 405)
    assert.equal(liveCalled, false)
    const failed = await fetch(`${baseUrl}${LIVE_ROUTE}`)
    assert.equal(failed.status, 502)
    assert.doesNotMatch(await failed.text(), /private live detail/)
  })
})


test('Host route disposer attempts all routes once and preserves the first cleanup error', () => {
  const registrations = []
  const cleanupFailure = new Error('live cleanup failed')
  const disposed = []
  const ctx = {
    webServer: {
      register(route) {
        registrations.push(route)
        return () => {
          disposed.push(route.path)
          if (route.path === LIVE_ROUTE) throw cleanupFailure
        }
      },
    },
    connection: { requestRejection() { return undefined } },
  }

  const dispose = registerArtemisHostRoutes(ctx, readyClient())
  assert.throws(() => dispose(), (error) => error === cleanupFailure)
  assert.deepEqual(disposed, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
  dispose()
  assert.deepEqual(disposed, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
})
