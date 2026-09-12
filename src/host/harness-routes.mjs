import { ArtemisProtocolError } from './artemis-http.mjs'
import {
  DSH_ARTEMIS_PROTOCOL_VERSION,
  HOST_ROUTE_PREFIX,
  LIVE_ROUTE,
  OVERVIEW_ROUTE,
  SNAPSHOT_ROUTE,
} from '../shared/protocol.mjs'

export { HOST_ROUTE_PREFIX, LIVE_ROUTE, OVERVIEW_ROUTE, SNAPSHOT_ROUTE }

const LIVE_BOUNDARY = 'dsh-artemis-frame'
const DEFAULT_SETUP_STATUS = Object.freeze({
  artemisRoot: 'not-supplied',
  python: 'profile-managed',
  mcpRuntime: 'unobservable',
})
const ROOT_STATES = new Set(['validated', 'not-supplied', 'invalid'])
const PYTHON_STATES = new Set(['validated-explicit', 'profile-managed', 'unknown', 'invalid'])
function writeJson(res, status, value, { head = false, extraHeaders = {} } = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  })
  if (head) res.end()
  else res.end(body)
}
function writePng(res, data) {
  res.writeHead(200, {
    'content-type': 'image/png',
    'cache-control': 'no-store',
    'content-length': data.byteLength,
    'x-content-type-options': 'nosniff',
  })
  res.end(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
}
function rejectUntrustedRequest(req, res, requestRejection) {
  if (typeof requestRejection !== 'function') return false
  const rejection = requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.setHeader('cache-control', 'no-store')
  res.end()
  return true
}
function safeError(error) {
  if (error instanceof ArtemisProtocolError) {
    if (error.code === 'unavailable') {
      return { status: 503, body: { error: { code: 'artemis-unavailable', message: 'ARTEMIS is unavailable' } } }
    }
    return { status: 502, body: { error: { code: 'artemis-protocol-error', message: 'ARTEMIS returned an invalid response' } } }
  }
  return { status: 500, body: { error: { code: 'internal-error', message: 'Internal dsh-artemis error' } } }
}
function normalizeSetupStatus(value) {
  if (!value || typeof value !== 'object') return DEFAULT_SETUP_STATUS
  const artemisRoot = ROOT_STATES.has(value.artemisRoot) ? value.artemisRoot : 'invalid'
  const python = PYTHON_STATES.has(value.python) ? value.python : 'unknown'
  return Object.freeze({ artemisRoot, python, mcpRuntime: 'unobservable' })
}
async function resolveSetupStatus(value) {
  try {
    return normalizeSetupStatus(await Promise.resolve(value))
  } catch {
    return Object.freeze({ artemisRoot: 'invalid', python: 'unknown', mcpRuntime: 'unobservable' })
  }
}
function waitForWritable(res, signal) {
  if (signal.aborted || res.destroyed) return Promise.resolve(false)
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      res.off('drain', onDrain)
      res.off('close', onClose)
      signal.removeEventListener('abort', onAbort)
      resolve(value)
    }
    const onDrain = () => finish(true)
    const onClose = () => finish(false)
    const onAbort = () => finish(false)
    res.once('drain', onDrain)
    res.once('close', onClose)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
async function writeStreamChunk(res, chunk, signal) {
  if (signal.aborted || res.destroyed) return false
  if (res.write(chunk)) return true
  return waitForWritable(res, signal)
}
async function writeLiveFrame(res, frame, signal) {
  const header = Buffer.from(`--${LIVE_BOUNDARY}\r\nContent-Type: image/png\r\nContent-Length: ${frame.data.byteLength}\r\n\r\n`)
  if (!await writeStreamChunk(res, header, signal)) return false
  if (!await writeStreamChunk(res, Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength), signal)) return false
  return writeStreamChunk(res, Buffer.from('\r\n'), signal)
}
export async function buildOverview(client, { setupStatus = DEFAULT_SETUP_STATUS } = {}) {
  const setup = await resolveSetupStatus(setupStatus)
  let health
  try {
    health = await client.health()
  } catch (error) {
    if (error instanceof ArtemisProtocolError && error.code === 'unavailable') {
      return Object.freeze({
        version: DSH_ARTEMIS_PROTOCOL_VERSION,
        artemis: Object.freeze({ state: 'offline', status: null }),
        setup,
        devices: Object.freeze([]),
        activeDeviceSerial: null,
        stream: Object.freeze({ connected: false }),
      })
    }
    throw error
  }
  const [devicesResult, streamResult] = await Promise.allSettled([client.listDevices(), client.getStreamState()])
  const devices = devicesResult.status === 'fulfilled' ? devicesResult.value : []
  const stream = streamResult.status === 'fulfilled' ? { connected: streamResult.value.connected } : { connected: false }
  const activeDeviceSerial = streamResult.status === 'fulfilled' ? streamResult.value.serial : null
  return Object.freeze({
    version: DSH_ARTEMIS_PROTOCOL_VERSION,
    artemis: Object.freeze({ state: 'ready', status: health.status }),
    setup,
    devices,
    activeDeviceSerial,
    stream: Object.freeze(stream),
  })
}
export function createOverviewHandler(client, { requestRejection, setupStatus } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, { extraHeaders: { allow: 'GET, HEAD' } })
      return
    }
    try {
      writeJson(res, 200, await buildOverview(client, { setupStatus }), { head: req.method === 'HEAD' })
    } catch (error) {
      const mapped = safeError(error)
      writeJson(res, mapped.status, mapped.body, { head: req.method === 'HEAD' })
    }
  }
}
export function createSnapshotHandler(client, { requestRejection } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return
    if (req.method !== 'GET') {
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, { extraHeaders: { allow: 'GET' } })
      return
    }
    try {
      const snapshot = await client.getSnapshot()
      writePng(res, snapshot.data)
    } catch (error) {
      const mapped = safeError(error)
      writeJson(res, mapped.status, mapped.body)
    }
  }
}
export function createLiveHandler(client, { requestRejection } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return
    if (req.method !== 'GET') {
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, { extraHeaders: { allow: 'GET' } })
      return
    }
    const controller = new AbortController()
    const abort = () => controller.abort()
    req.once('aborted', abort)
    res.once('close', abort)
    const iterator = client.streamSnapshots({ signal: controller.signal })[Symbol.asyncIterator]()
    try {
      const first = await iterator.next()
      if (first.done) throw new ArtemisProtocolError('ARTEMIS live stream ended before a frame arrived', { code: 'incomplete-frame' })
      if (controller.signal.aborted) return
      res.writeHead(200, {
        'content-type': `multipart/x-mixed-replace; boundary=${LIVE_BOUNDARY}`,
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      })
      if (!await writeLiveFrame(res, first.value, controller.signal)) return
      while (!controller.signal.aborted) {
        const next = await iterator.next()
        if (next.done) break
        if (!await writeLiveFrame(res, next.value, controller.signal)) return
      }
      if (!res.destroyed) res.end()
    } catch (error) {
      if (controller.signal.aborted) return
      if (res.headersSent) {
        res.destroy()
        return
      }
      const mapped = safeError(error)
      writeJson(res, mapped.status, mapped.body)
    } finally {
      controller.abort()
      req.off('aborted', abort)
      res.off('close', abort)
      await iterator.return?.().catch(() => {})
    }
  }
}
export function registerArtemisHostRoutes(ctx, client, { setupStatus } = {}) {
  if (!ctx?.webServer || typeof ctx.webServer.register !== 'function') {
    throw new TypeError('A Harness webServer service is required')
  }
  if (!ctx?.connection || typeof ctx.connection.requestRejection !== 'function') {
    throw new TypeError('A Harness connection trust service is required')
  }
  if (!client || typeof client.health !== 'function' || typeof client.listDevices !== 'function' || typeof client.getStreamState !== 'function' || typeof client.getSnapshot !== 'function' || typeof client.streamSnapshots !== 'function') {
    throw new TypeError('An ARTEMIS client implementing the read-only panel contract is required')
  }
  const requestRejection = (req) => ctx.connection.requestRejection(req)
  const disposers = [
    ctx.webServer.register({ kind: 'exact', path: OVERVIEW_ROUTE, handler: createOverviewHandler(client, { requestRejection, setupStatus }) }),
    ctx.webServer.register({ kind: 'exact', path: SNAPSHOT_ROUTE, handler: createSnapshotHandler(client, { requestRejection }) }),
    ctx.webServer.register({ kind: 'exact', path: LIVE_ROUTE, handler: createLiveHandler(client, { requestRejection }) }),
  ]
  return () => {
    for (const dispose of disposers.reverse()) dispose?.()
  }
}
