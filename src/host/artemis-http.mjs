const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const DEFAULT_TIMEOUT_MS = 2_000
const DEFAULT_MAX_JSON_BYTES = 1_048_576
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export class ArtemisProtocolError extends Error {
  constructor(message, { code = 'protocol-error', cause } = {}) {
    super(message, { cause })
    this.name = 'ArtemisProtocolError'
    this.code = code
  }
}

export function resolveArtemisBaseUrl(value = DEFAULT_BASE_URL) {
  let url
  try {
    url = new URL(value)
  } catch (cause) {
    throw new ArtemisProtocolError('ARTEMIS base URL is invalid', { code: 'invalid-base-url', cause })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ArtemisProtocolError('ARTEMIS base URL must use HTTP or HTTPS', { code: 'invalid-base-url' })
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new ArtemisProtocolError('ARTEMIS base URL must resolve to an explicit loopback host', { code: 'non-loopback-base-url' })
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ArtemisProtocolError('ARTEMIS base URL must not contain credentials, query parameters, or fragments', { code: 'invalid-base-url' })
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ArtemisProtocolError('ARTEMIS base URL must not contain a path', { code: 'invalid-base-url' })
  }

  url.pathname = '/'
  return url
}

function expectObject(value, endpoint) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArtemisProtocolError(`${endpoint} response must be a JSON object`)
  }
  return value
}

function optionalString(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function normalizeDevice(value) {
  const item = expectObject(value, '/api/devices')
  const serial = optionalString(item.serial ?? item.device_serial ?? item.device_id)
  if (!serial) throw new ArtemisProtocolError('/api/devices contained a device without a serial number')

  const state = (optionalString(item.state ?? item.status) ?? 'unknown').toLowerCase()
  const busyValue = item.busy ?? item.is_busy
  return Object.freeze({
    serial,
    state,
    model: optionalString(item.model),
    product: optionalString(item.product),
    busy: Boolean(busyValue) || ['busy', 'running', 'locked'].includes(state),
  })
}

async function readJsonWithinLimit(response, endpoint, maxBytes) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ArtemisProtocolError(`${endpoint} returned an unexpected content type`, { code: 'unexpected-content-type' })
  }

  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
  }

  if (!response.body) throw new ArtemisProtocolError(`${endpoint} returned an empty response body`)

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch (cause) {
    throw new ArtemisProtocolError(`${endpoint} returned invalid JSON`, { code: 'invalid-json', cause })
  }
}

export class ArtemisHttpClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxJsonBytes = DEFAULT_MAX_JSON_BYTES,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer')
    if (!Number.isInteger(maxJsonBytes) || maxJsonBytes <= 0) throw new TypeError('maxJsonBytes must be a positive integer')

    this.baseUrl = resolveArtemisBaseUrl(baseUrl)
    this.timeoutMs = timeoutMs
    this.maxJsonBytes = maxJsonBytes
    this.fetchImpl = fetchImpl
  }

  async #getJson(endpoint) {
    const url = new URL(endpoint, this.baseUrl)
    let response
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json' },
      })
    } catch (cause) {
      throw new ArtemisProtocolError(`ARTEMIS request failed for ${endpoint}`, { code: 'unavailable', cause })
    }

    if (!response.ok) {
      throw new ArtemisProtocolError(`ARTEMIS returned HTTP ${response.status} for ${endpoint}`, { code: 'http-error' })
    }
    return readJsonWithinLimit(response, endpoint, this.maxJsonBytes)
  }

  async health() {
    const payload = expectObject(await this.#getJson('/api/status'), '/api/status')
    return Object.freeze({
      reachable: true,
      status: optionalString(payload.status) ?? 'unknown',
    })
  }

  async listDevices() {
    const payload = await this.#getJson('/api/devices')
    const rawDevices = Array.isArray(payload)
      ? payload
      : expectObject(payload, '/api/devices').devices ?? []
    if (!Array.isArray(rawDevices)) {
      throw new ArtemisProtocolError('/api/devices response must contain a device list')
    }
    return Object.freeze(rawDevices.map(normalizeDevice))
  }

  async getStreamState() {
    const payload = expectObject(await this.#getJson('/api/stream/device-state'), '/api/stream/device-state')
    if (typeof payload.connected !== 'boolean') {
      throw new ArtemisProtocolError('/api/stream/device-state must contain a boolean connected field')
    }

    const serial = optionalString(payload.serial)
    const liveStreamPath = optionalString(payload.live_stream_url)
    if (liveStreamPath !== null && !liveStreamPath.startsWith('/api/stream/')) {
      throw new ArtemisProtocolError('/api/stream/device-state returned an unexpected live stream path')
    }

    return Object.freeze({
      connected: payload.connected,
      serial,
      liveStreamPath,
    })
  }
}

export const artemisHttpDefaults = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxJsonBytes: DEFAULT_MAX_JSON_BYTES,
})
