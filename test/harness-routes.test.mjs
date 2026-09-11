import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisProtocolError } from '../src/host/artemis-http.mjs'
import { OVERVIEW_ROUTE, createOverviewHandler, registerArtemisHostRoutes } from '../src/host/harness-routes.mjs'

async function serve(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function readyClient() {
  return {
    async health() { return { reachable: true, status: 'ready' } },
    async listDevices() {
      return [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: null, busy: false }]
    },
    async getStreamState() {
      return { connected: true, serial: 'emulator-5554', liveStreamPath: '/api/stream/device-live' }
    },
  }
}

function trustedContext(registrations, dispose) {
  return {
    webServer: { register(route) { registrations.push(route); return dispose } },
    connection: { requestRejection() { return undefined } },
  }
}

test('registers one exact overview route behind Harness connection trust', () => {
  const registrations = []
  const dispose = () => {}
  const ctx = trustedContext(registrations, dispose)

  assert.equal(registerArtemisHostRoutes(ctx, readyClient()), dispose)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].kind, 'exact')
  assert.equal(registrations[0].path, OVERVIEW_ROUTE)
})

test('registration refuses to expose a route without Harness connection trust', () => {
  const ctx = { webServer: { register() { throw new Error('must not register') } } }
  assert.throws(() => registerArtemisHostRoutes(ctx, readyClient()), /connection trust service/)
})

test('overview exposes normalized state and not the upstream stream URL', async () => {
  await serve(createOverviewHandler(readyClient()), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), {
      version: 1,
      artemis: { state: 'ready', status: 'ready' },
      devices: [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: null, busy: false }],
      activeDeviceSerial: 'emulator-5554',
      stream: { connected: true },
    })
  })
})

test('Harness trust rejection happens before method handling or ARTEMIS access', async () => {
  let called = false
  const client = readyClient()
  client.health = async () => { called = true; return { reachable: true, status: 'ready' } }
  const handler = createOverviewHandler(client, { requestRejection: () => 403 })

  await serve(handler, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`, { method: 'POST' })
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(called, false)
    assert.equal(await response.text(), '')
  })
})

test('ARTEMIS connection failure degrades to an offline overview', async () => {
  const client = readyClient()
  client.health = async () => { throw new ArtemisProtocolError('connect failed', { code: 'unavailable' }) }

  await serve(createOverviewHandler(client), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      version: 1,
      artemis: { state: 'offline', status: null },
      devices: [],
      activeDeviceSerial: null,
      stream: { connected: false },
    })
  })
})

test('non-GET methods are rejected without touching ARTEMIS', async () => {
  let called = false
  const client = readyClient()
  client.health = async () => { called = true; return { reachable: true, status: 'ready' } }

  await serve(createOverviewHandler(client), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`, { method: 'POST' })
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET, HEAD')
    assert.equal(called, false)
    assert.deepEqual(await response.json(), {
      error: { code: 'method-not-allowed', message: 'Method not allowed' },
    })
  })
})

test('protocol failures return bounded errors without upstream details', async () => {
  const client = readyClient()
  client.health = async () => { throw new ArtemisProtocolError('secret upstream detail') }

  await serve(createOverviewHandler(client), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${OVERVIEW_ROUTE}`)
    assert.equal(response.status, 502)
    const text = await response.text()
    assert.doesNotMatch(text, /secret upstream detail/)
    assert.deepEqual(JSON.parse(text), {
      error: { code: 'artemis-protocol-error', message: 'ARTEMIS returned an invalid response' },
    })
  })
})
