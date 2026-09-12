import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisHttpClient, ArtemisProtocolError, resolveArtemisBaseUrl } from '../src/host/artemis-http.mjs'

async function withServer(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  try { await run(`http://127.0.0.1:${address.port}`) } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

function json(res, value, status = 200) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
  res.end(body)
}

function pngFixture(extra = 0) {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(extra, 0x41)])
}

function multipartFrame(frame, { contentType = 'image/png', declaredLength = frame.byteLength } = {}) {
  return Buffer.concat([
    Buffer.from(`--frame\r\nContent-Type: ${contentType}\r\nContent-Length: ${declaredLength}\r\n\r\n`),
    frame,
    Buffer.from('\r\n'),
  ])
}

test('base URL defaults and rejects non-loopback hosts', () => {
  assert.equal(resolveArtemisBaseUrl().href, 'http://127.0.0.1:8000/')
  assert.throws(() => resolveArtemisBaseUrl('http://example.com:8000'), (error) => error.code === 'non-loopback-base-url')
})

test('health and device list use the ARTEMIS baseline endpoints', async () => {
  await withServer((req, res) => {
    if (req.url === '/api/status') return json(res, { status: 'ready' })
    if (req.url === '/api/devices') return json(res, { devices: [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: 'sdk_gphone', busy: false }] })
    res.writeHead(404).end()
  }, async (baseUrl) => {
    const client = new ArtemisHttpClient({ baseUrl })
    assert.deepEqual(await client.health(), { reachable: true, status: 'ready' })
    assert.equal((await client.listDevices())[0].serial, 'emulator-5554')
  })
})

test('stream state rejects arbitrary live stream URLs', async () => {
  await withServer((_req, res) => json(res, { connected: true, serial: 'emulator-5554', live_stream_url: 'https://evil.invalid/frame' }), async (baseUrl) => {
    await assert.rejects(new ArtemisHttpClient({ baseUrl }).getStreamState(), /unexpected live stream path/)
  })
})

test('oversized JSON is rejected before parsing', async () => {
  await withServer((_req, res) => json(res, { payload: 'x'.repeat(256) }), async (baseUrl) => {
    await assert.rejects(new ArtemisHttpClient({ baseUrl, maxJsonBytes: 32 }).health(), (error) => error instanceof ArtemisProtocolError && error.code === 'response-too-large')
  })
})

test('snapshot extracts exactly one bounded PNG multipart frame', async () => {
  const frame = pngFixture(128)
  await withServer((req, res) => {
    assert.equal(req.url, '/api/stream/device-live')
    res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' })
    const payload = multipartFrame(frame)
    res.write(payload.subarray(0, 31))
    setTimeout(() => res.end(payload.subarray(31)), 5)
  }, async (baseUrl) => {
    const snapshot = await new ArtemisHttpClient({ baseUrl }).getSnapshot()
    assert.equal(snapshot.mediaType, 'image/png')
    assert.deepEqual(Buffer.from(snapshot.data), frame)
  })
})

test('snapshot rejects oversize, unexpected part type and invalid PNG signature', async (t) => {
  await t.test('oversize', async () => {
    const frame = pngFixture(64)
    await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' })
      res.end(multipartFrame(frame, { declaredLength: 4096 }))
    }, async (baseUrl) => {
      await assert.rejects(new ArtemisHttpClient({ baseUrl, maxFrameBytes: 128 }).getSnapshot(), (error) => error.code === 'frame-too-large')
    })
  })
  await t.test('part type', async () => {
    const frame = pngFixture()
    await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' })
      res.end(multipartFrame(frame, { contentType: 'image/jpeg' }))
    }, async (baseUrl) => {
      await assert.rejects(new ArtemisHttpClient({ baseUrl }).getSnapshot(), (error) => error.code === 'unexpected-content-type')
    })
  })
  await t.test('signature', async () => {
    const frame = Buffer.from('not-a-png')
    await withServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame' })
      res.end(multipartFrame(frame))
    }, async (baseUrl) => {
      await assert.rejects(new ArtemisHttpClient({ baseUrl }).getSnapshot(), (error) => error.code === 'invalid-image')
    })
  })
})
