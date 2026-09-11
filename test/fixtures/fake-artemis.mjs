import { createServer } from 'node:http'

const HOST = '127.0.0.1'
const PORT = 8000

function sendJson(res, value, status = 200) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

const server = createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { allow: 'GET' })
    res.end()
    return
  }

  switch (req.url) {
    case '/api/status':
      sendJson(res, { status: 'ready' })
      return
    case '/api/devices':
      sendJson(res, {
        devices: [{
          serial: 'emulator-5554',
          state: 'device',
          model: 'Pixel_9',
          product: 'sdk_gphone64_x86_64',
          busy: false,
        }],
      })
      return
    case '/api/stream/device-state':
      sendJson(res, {
        connected: true,
        serial: 'emulator-5554',
        live_stream_url: '/api/stream/device-live',
      })
      return
    default:
      sendJson(res, { error: 'not-found' }, 404)
  }
})

server.listen(PORT, HOST)

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error)
      process.exitCode = 1
    }
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
