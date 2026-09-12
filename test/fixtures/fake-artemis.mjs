import { createServer } from 'node:http'

const HOST = '127.0.0.1'
const PORT = 8000
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl3sAAAAASUVORK5CYII=', 'base64')
function sendJson(res, value, status = 200) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
  res.end(body)
}
function frameBytes() {
  const header = Buffer.from(`--frame\r\nContent-Type: image/png\r\nContent-Length: ${ONE_PIXEL_PNG.byteLength}\r\n\r\n`)
  return Buffer.concat([header, ONE_PIXEL_PNG, Buffer.from('\r\n')])
}
function sendDeviceLiveStream(res) {
  res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'cache-control': 'no-store' })
  const frame = frameBytes()
  res.write(frame)
  const timer = setInterval(() => { if (!res.destroyed) res.write(frame) }, 80)
  res.once('close', () => clearInterval(timer))
}
const stepsFixture = [{
  step_id: 'step-1',
  session_id: 'session-e2e',
  step_number: 1,
  action_taken: { action: 'press_key', key: 'home', secret: 'action-secret-must-not-leak' },
  pre_screenshot_bytes: 'screenshot-bytes-must-not-leak',
  generic_tools: [{
    trace_id: 'trace-1',
    type: 'tool',
    name: 'press_key',
    status: 'success',
    payload: { secret: 'trace-payload-must-not-leak' },
  }],
}]
const traceTreeFixture = [{
  trace_id: 'trace-root-secret-id',
  parent_trace_id: null,
  step_id: 'step-1',
  type: 'tool',
  name: 'press_key',
  status: 'success',
  payload: { secret: 'trace-tree-payload-must-not-leak' },
  children: [{
    trace_id: 'trace-child-secret-id',
    parent_trace_id: 'trace-root-secret-id',
    step_id: 'step-1',
    type: 'thinking',
    name: 'device_observation',
    status: 'success',
    payload: { text: 'raw-thinking-must-not-leak', screenshot: 'file:///tmp/trace-path-must-not-leak.png' },
    llm_call: { output: 'llm-output-must-not-leak' },
    children: [],
  }],
}]
const server = createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
  switch (req.url) {
    case '/api/status':
      sendJson(res, {
        status: 'running',
        goal: 'Verify Android task evidence',
        session_id: 'session-e2e',
        queue: [],
        background_tasks: [],
        active_tasks: [{ id: 'task-e2e', secret: 'active-task-secret-must-not-leak' }],
        model_info: { secret: 'model-info-must-not-leak' },
      })
      return
    case '/api/sessions/session-e2e/steps': sendJson(res, stepsFixture); return
    case '/api/steps/step-1/traces': sendJson(res, traceTreeFixture); return
    case '/api/devices': sendJson(res, { devices: [{ serial: 'emulator-5554', state: 'device', model: 'Pixel_9', product: 'sdk_gphone64_x86_64', busy: false }] }); return
    case '/api/stream/device-state': sendJson(res, { connected: true, serial: 'emulator-5554', live_stream_url: '/api/stream/device-live' }); return
    case '/api/stream/device-live': sendDeviceLiveStream(res); return
    default: sendJson(res, { error: 'not-found' }, 404)
  }
})
server.listen(PORT, HOST)
function shutdown() {
  server.close((error) => { if (error) { console.error(error); process.exitCode = 1 } })
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
