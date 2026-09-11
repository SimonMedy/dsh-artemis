import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError, resolveArtemisBaseUrl } from '../src/host/artemis-http.mjs'

async function withServer(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function json(res, value, status = 200) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

test('base URL defaults and rejects non-loopback hosts', () => {
  assert.equal(resolveArtemisBaseUrl().href, 'http://127.0.0.1:8000/')
  assert.throws(() => resolveArtemisBaseUrl('http://example.com:8000'), (error) => {
    assert.equal(error.code, 'non-loopback-base-url')
    return true
  })
})

test('health and device list use the ARTEMIS client baseline endpoints', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/status') return json(res, { status: 'ready', queue: [] })
    if (req.url === '/api/devices') {
      return json(res, { devices: [
        { serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: 'sdk_gphone', busy: false },
        { device_serial: 'device-2', status: 'running' },
      ] })
    }
    res.writeHead(404).end()
  }, async (baseUrl) => {
    const client = new ArtemisHttpClient({ baseUrl })
    assert.deepEqual(await client.health(), { reachable: true, status: 'ready' })
    assert.deepEqual(await client.listDevices(), [
      { serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: 'sdk_gphone', busy: false },
      { serial: 'device-2', state: 'running', model: null, product: null, busy: true },
    ])
  })
})

test('stream state is normalized without exposing arbitrary URLs', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/stream/device-state') {
      return json(res, { connected: true, serial: 'emulator-5554', live_stream_url: '/api/stream/device-live' })
    }
    res.writeHead(404).end()
  }, async (baseUrl) => {
    const client = new ArtemisHttpClient({ baseUrl })
    assert.deepEqual(await client.getStreamState(), {
      connected: true,
      serial: 'emulator-5554',
      liveStreamPath: '/api/stream/device-live',
    })
  })
})

test('oversized JSON is rejected before parsing', async () => {
  await withServer((_req, res) => {
    json(res, { payload: 'x'.repeat(256) })
  }, async (baseUrl) => {
    const client = new ArtemisHttpClient({ baseUrl, maxJsonBytes: 32 })
    await assert.rejects(client.health(), (error) => {
      assert.ok(error instanceof ArtemisProtocolError)
      assert.equal(error.code, 'response-too-large')
      return true
    })
  })
})

test('unexpected stream paths are rejected', async () => {
  await withServer((_req, res) => {
    json(res, { connected: true, serial: 'emulator-5554', live_stream_url: 'https://evil.invalid/frame' })
  }, async (baseUrl) => {
    const client = new ArtemisHttpClient({ baseUrl })
    await assert.rejects(client.getStreamState(), /unexpected live stream path/)
  })
})
