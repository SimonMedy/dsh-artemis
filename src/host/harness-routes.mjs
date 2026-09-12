import { ArtemisProtocolError } from './artemis-http.mjs'
import {
  DSH_ARTEMIS_PROTOCOL_VERSION,
  HOST_ROUTE_PREFIX,
  OVERVIEW_ROUTE,
  SNAPSHOT_ROUTE,
} from '../shared/protocol.mjs'

export { HOST_ROUTE_PREFIX, OVERVIEW_ROUTE, SNAPSHOT_ROUTE }

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

export async function buildOverview(client) {
  let health
  try {
    health = await client.health()
  } catch (error) {
    if (error instanceof ArtemisProtocolError && error.code === 'unavailable') {
      return Object.freeze({
        version: DSH_ARTEMIS_PROTOCOL_VERSION,
        artemis: Object.freeze({ state: 'offline', status: null }),
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
    devices,
    activeDeviceSerial,
    stream: Object.freeze(stream),
  })
}

export function createOverviewHandler(client, { requestRejection } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, {
        extraHeaders: { allow: 'GET, HEAD' },
      })
      return
    }
    try {
      writeJson(res, 200, await buildOverview(client), { head: req.method === 'HEAD' })
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
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, {
        extraHeaders: { allow: 'GET' },
      })
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

export function registerArtemisHostRoutes(ctx, client) {
  if (!ctx?.webServer || typeof ctx.webServer.register !== 'function') {
    throw new TypeError('A Harness webServer service is required')
  }
  if (!ctx?.connection || typeof ctx.connection.requestRejection !== 'function') {
    throw new TypeError('A Harness connection trust service is required')
  }
  if (!client || typeof client.health !== 'function' || typeof client.listDevices !== 'function' || typeof client.getStreamState !== 'function' || typeof client.getSnapshot !== 'function') {
    throw new TypeError('An ARTEMIS client implementing the read-only panel contract is required')
  }
  const requestRejection = (req) => ctx.connection.requestRejection(req)
  const disposers = [
    ctx.webServer.register({ kind: 'exact', path: OVERVIEW_ROUTE, handler: createOverviewHandler(client, { requestRejection }) }),
    ctx.webServer.register({ kind: 'exact', path: SNAPSHOT_ROUTE, handler: createSnapshotHandler(client, { requestRejection }) }),
  ]
  return () => {
    for (const dispose of disposers.reverse()) dispose?.()
  }
}
