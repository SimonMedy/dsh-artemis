import { ArtemisProtocolError } from './artemis-http.mjs'

export const HOST_ROUTE_PREFIX = '/dsh-artemis/v1'
export const OVERVIEW_ROUTE = `${HOST_ROUTE_PREFIX}/overview`

function writeJson(res, status, value, { head = false } = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
  })
  if (head) res.end()
  else res.end(body)
}

function methodAllowed(req) {
  return req.method === 'GET' || req.method === 'HEAD'
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

function rejectUntrustedRequest(req, res, requestRejection) {
  if (typeof requestRejection !== 'function') return false
  const rejection = requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.setHeader('cache-control', 'no-store')
  res.end()
  return true
}

export async function buildOverview(client) {
  let health
  try {
    health = await client.health()
  } catch (error) {
    if (error instanceof ArtemisProtocolError && error.code === 'unavailable') {
      return Object.freeze({
        version: 1,
        artemis: Object.freeze({ state: 'offline', status: null }),
        devices: Object.freeze([]),
        activeDeviceSerial: null,
        stream: Object.freeze({ connected: false }),
      })
    }
    throw error
  }

  const [devicesResult, streamResult] = await Promise.allSettled([
    client.listDevices(),
    client.getStreamState(),
  ])

  const devices = devicesResult.status === 'fulfilled' ? devicesResult.value : []
  const stream = streamResult.status === 'fulfilled'
    ? { connected: streamResult.value.connected }
    : { connected: false }
  const activeDeviceSerial = streamResult.status === 'fulfilled' ? streamResult.value.serial : null

  return Object.freeze({
    version: 1,
    artemis: Object.freeze({ state: 'ready', status: health.status }),
    devices,
    activeDeviceSerial,
    stream: Object.freeze(stream),
  })
}

export function createOverviewHandler(client, { requestRejection } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return

    if (!methodAllowed(req)) {
      res.setHeader('allow', 'GET, HEAD')
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } })
      return
    }

    try {
      const overview = await buildOverview(client)
      writeJson(res, 200, overview, { head: req.method === 'HEAD' })
    } catch (error) {
      const mapped = safeError(error)
      writeJson(res, mapped.status, mapped.body, { head: req.method === 'HEAD' })
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
  if (!client || typeof client.health !== 'function' || typeof client.listDevices !== 'function' || typeof client.getStreamState !== 'function') {
    throw new TypeError('An ARTEMIS client implementing the read-only MVP contract is required')
  }

  return ctx.webServer.register({
    kind: 'exact',
    path: OVERVIEW_ROUTE,
    handler: createOverviewHandler(client, {
      requestRejection: (req) => ctx.connection.requestRejection(req),
    }),
  })
}
