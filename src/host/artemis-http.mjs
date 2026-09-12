const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const DEFAULT_TIMEOUT_MS = 2_000
const DEFAULT_SNAPSHOT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_JSON_BYTES = 1_048_576
const DEFAULT_MAX_FRAME_BYTES = 8_388_608
const MAX_MULTIPART_HEADER_BYTES = 16_384
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

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

function appendBytes(left, right, maxBytes) {
  const size = left.byteLength + right.byteLength
  if (size > maxBytes) {
    throw new ArtemisProtocolError('ARTEMIS live frame exceeded the configured size limit', { code: 'frame-too-large' })
  }
  const combined = new Uint8Array(size)
  combined.set(left)
  combined.set(right, left.byteLength)
  return combined
}

function indexOfBytes(haystack, needle, from = 0) {
  outer: for (let i = from; i <= haystack.byteLength - needle.byteLength; i += 1) {
    for (let j = 0; j < needle.byteLength; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function parseMultipartBoundary(contentType) {
  const parts = contentType.split(';').map((part) => part.trim())
  if (parts[0]?.toLowerCase() !== 'multipart/x-mixed-replace') {
    throw new ArtemisProtocolError('/api/stream/device-live returned an unexpected content type', { code: 'unexpected-content-type' })
  }
  const entry = parts.slice(1).find((part) => part.toLowerCase().startsWith('boundary='))
  if (!entry) {
    throw new ArtemisProtocolError('/api/stream/device-live omitted its multipart boundary', { code: 'invalid-multipart' })
  }
  let boundary = entry.slice(entry.indexOf('=') + 1).trim()
  if (boundary.startsWith('"') && boundary.endsWith('"')) boundary = boundary.slice(1, -1)
  if (!boundary || boundary.length > 70 || /[\r\n]/.test(boundary)) {
    throw new ArtemisProtocolError('/api/stream/device-live returned an invalid multipart boundary', { code: 'invalid-multipart' })
  }
  return boundary
}

function parsePartHeaders(bytes) {
  const headers = new Map()
  for (const line of new TextDecoder('latin1').decode(bytes).split('\r\n')) {
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator <= 0) {
      throw new ArtemisProtocolError('ARTEMIS live frame contained malformed multipart headers', { code: 'invalid-multipart' })
    }
    const name = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()
    if (!name || headers.has(name)) {
      throw new ArtemisProtocolError('ARTEMIS live frame contained invalid multipart headers', { code: 'invalid-multipart' })
    }
    headers.set(name, value)
  }
  return headers
}

function hasPngSignature(bytes) {
  return bytes.byteLength >= PNG_SIGNATURE.byteLength
    && PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

async function readFirstPngFrame(response, maxFrameBytes) {
  const boundary = parseMultipartBoundary(response.headers.get('content-type') ?? '')
  if (!response.body) throw new ArtemisProtocolError('/api/stream/device-live returned an empty response body')

  const boundaryBytes = new TextEncoder().encode(`--${boundary}\r\n`)
  const headerTerminator = Uint8Array.from([13, 10, 13, 10])
  const maxBuffered = maxFrameBytes + MAX_MULTIPART_HEADER_BYTES + boundaryBytes.byteLength + headerTerminator.byteLength
  const reader = response.body.getReader()
  let buffer = new Uint8Array(0)
  let bodyStart = -1
  let contentLength = null

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        throw new ArtemisProtocolError('ARTEMIS live stream ended before a complete frame arrived', { code: 'incomplete-frame' })
      }
      buffer = appendBytes(buffer, value, maxBuffered)

      if (bodyStart < 0) {
        const boundaryStart = indexOfBytes(buffer, boundaryBytes)
        if (boundaryStart < 0) {
          if (buffer.byteLength > MAX_MULTIPART_HEADER_BYTES) {
            throw new ArtemisProtocolError('ARTEMIS live stream did not expose a bounded multipart header', { code: 'invalid-multipart' })
          }
          continue
        }
        const headerStart = boundaryStart + boundaryBytes.byteLength
        const headerEnd = indexOfBytes(buffer, headerTerminator, headerStart)
        if (headerEnd < 0) {
          if (buffer.byteLength - headerStart > MAX_MULTIPART_HEADER_BYTES) {
            throw new ArtemisProtocolError('ARTEMIS live frame headers exceeded the configured limit', { code: 'invalid-multipart' })
          }
          continue
        }
        const headers = parsePartHeaders(buffer.slice(headerStart, headerEnd))
        if ((headers.get('content-type') ?? '').toLowerCase() !== 'image/png') {
          throw new ArtemisProtocolError('ARTEMIS live frame was not PNG', { code: 'unexpected-content-type' })
        }
        const lengthText = headers.get('content-length')
        if (!lengthText || !/^\d+$/.test(lengthText)) {
          throw new ArtemisProtocolError('ARTEMIS live frame omitted a valid Content-Length', { code: 'invalid-multipart' })
        }
        contentLength = Number(lengthText)
        if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
          throw new ArtemisProtocolError('ARTEMIS live frame declared an invalid Content-Length', { code: 'invalid-multipart' })
        }
        if (contentLength > maxFrameBytes) {
          throw new ArtemisProtocolError('ARTEMIS live frame exceeded the configured size limit', { code: 'frame-too-large' })
        }
        bodyStart = headerEnd + headerTerminator.byteLength
      }

      if (buffer.byteLength >= bodyStart + contentLength) {
        const frame = buffer.slice(bodyStart, bodyStart + contentLength)
        if (!hasPngSignature(frame)) {
          throw new ArtemisProtocolError('ARTEMIS live frame did not contain a valid PNG signature', { code: 'invalid-image' })
        }
        return Object.freeze({ mediaType: 'image/png', data: frame, bytes: frame.byteLength })
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export class ArtemisHttpClient {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    snapshotTimeoutMs = DEFAULT_SNAPSHOT_TIMEOUT_MS,
    maxJsonBytes = DEFAULT_MAX_JSON_BYTES,
    maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
    fetchImpl = globalThis.fetch,
  } = {}) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer')
    if (!Number.isInteger(snapshotTimeoutMs) || snapshotTimeoutMs <= 0) throw new TypeError('snapshotTimeoutMs must be a positive integer')
    if (!Number.isInteger(maxJsonBytes) || maxJsonBytes <= 0) throw new TypeError('maxJsonBytes must be a positive integer')
    if (!Number.isInteger(maxFrameBytes) || maxFrameBytes <= 0) throw new TypeError('maxFrameBytes must be a positive integer')
    this.baseUrl = resolveArtemisBaseUrl(baseUrl)
    this.timeoutMs = timeoutMs
    this.snapshotTimeoutMs = snapshotTimeoutMs
    this.maxJsonBytes = maxJsonBytes
    this.maxFrameBytes = maxFrameBytes
    this.fetchImpl = fetchImpl
  }

  async #request(endpoint, { accept, timeoutMs = this.timeoutMs } = {}) {
    const url = new URL(endpoint, this.baseUrl)
    try {
      return await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept },
      })
    } catch (cause) {
      throw new ArtemisProtocolError(`ARTEMIS request failed for ${endpoint}`, { code: 'unavailable', cause })
    }
  }

  async #getJson(endpoint) {
    const response = await this.#request(endpoint, { accept: 'application/json' })
    if (!response.ok) {
      throw new ArtemisProtocolError(`ARTEMIS returned HTTP ${response.status} for ${endpoint}`, { code: 'http-error' })
    }
    return readJsonWithinLimit(response, endpoint, this.maxJsonBytes)
  }

  async health() {
    const payload = expectObject(await this.#getJson('/api/status'), '/api/status')
    return Object.freeze({ reachable: true, status: optionalString(payload.status) ?? 'unknown' })
  }

  async listDevices() {
    const payload = await this.#getJson('/api/devices')
    const rawDevices = Array.isArray(payload) ? payload : expectObject(payload, '/api/devices').devices ?? []
    if (!Array.isArray(rawDevices)) throw new ArtemisProtocolError('/api/devices response must contain a device list')
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
    return Object.freeze({ connected: payload.connected, serial, liveStreamPath })
  }

  async getSnapshot() {
    const response = await this.#request('/api/stream/device-live', {
      accept: 'multipart/x-mixed-replace',
      timeoutMs: this.snapshotTimeoutMs,
    })
    if (!response.ok) {
      throw new ArtemisProtocolError(`ARTEMIS returned HTTP ${response.status} for /api/stream/device-live`, { code: 'http-error' })
    }
    return readFirstPngFrame(response, this.maxFrameBytes)
  }
}

export const artemisHttpDefaults = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  snapshotTimeoutMs: DEFAULT_SNAPSHOT_TIMEOUT_MS,
  maxJsonBytes: DEFAULT_MAX_JSON_BYTES,
  maxFrameBytes: DEFAULT_MAX_FRAME_BYTES,
})
