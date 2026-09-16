import { parseDecimalContentLength } from '../shared/content-length.mjs'
import { isJsonContentType } from '../shared/json-content-type.mjs'
import { BoundedByteBuffer } from './bounded-byte-buffer.mjs'
const DEFAULT_BASE_URL = 'http://127.0.0.1:8000'
const DEFAULT_TIMEOUT_MS = 2_000
const DEFAULT_SNAPSHOT_TIMEOUT_MS = 4_000
const DEFAULT_MAX_JSON_BYTES = 1_048_576
const DEFAULT_MAX_FRAME_BYTES = 8_388_608
const MAX_MULTIPART_HEADER_BYTES = 16_384
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]'])
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
  if (typeof value !== 'string') {
    throw new ArtemisProtocolError('ARTEMIS returned a non-string protocol field', { code: 'invalid-json' })
  }
  const text = value.trim()
  return text || null
}

function normalizeDevice(value) {
  const item = expectObject(value, '/api/devices')
  const serial = optionalString(item.serial ?? item.device_serial ?? item.device_id)
  if (!serial) throw new ArtemisProtocolError('/api/devices contained a device without a serial number')
  const state = (optionalString(item.state ?? item.status) ?? 'unknown').toLowerCase()
  const busyValue = item.busy ?? item.is_busy
  if (busyValue !== null && busyValue !== undefined && typeof busyValue !== 'boolean') {
    throw new ArtemisProtocolError('/api/devices contained a device with a non-boolean busy field', { code: 'invalid-json' })
  }
  return Object.freeze({
    serial,
    state,
    model: optionalString(item.model),
    product: optionalString(item.product),
    busy: busyValue ?? ['busy', 'running', 'locked'].includes(state),
  })
}

async function cancelBodyQuietly(body) {
  try { await body?.cancel?.() } catch {}
}

async function readJsonWithinLimit(response, endpoint, maxBytes) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!isJsonContentType(contentType)) {
    await cancelBodyQuietly(response.body)
    throw new ArtemisProtocolError(`${endpoint} returned an unexpected content type`, { code: 'unexpected-content-type' })
  }
  const declaredText = response.headers.get('content-length')
  if (declaredText !== null) {
    let declared
    try {
      declared = parseDecimalContentLength(declaredText)
    } catch {
      await cancelBodyQuietly(response.body)
      throw new ArtemisProtocolError(`${endpoint} returned an invalid Content-Length`, { code: 'invalid-content-length' })
    }
    if (declared > maxBytes) {
      await cancelBodyQuietly(response.body)
      throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
    }
  }
  if (!response.body) throw new ArtemisProtocolError(`${endpoint} returned an empty response body`)
  let reader
  try {
    reader = response.body.getReader()
  } catch (error) {
    await cancelBodyQuietly(response.body)
    throw error
  }
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new ArtemisProtocolError(`${endpoint} returned an invalid JSON response body`, { code: 'invalid-json' })
      }
      size += value.byteLength
      if (size > maxBytes) {
        try { await reader.cancel() } catch {}
        throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock?.() } catch {}
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (cause) {
    throw new ArtemisProtocolError(`${endpoint} returned invalid JSON`, { code: 'invalid-json', cause })
  }
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

async function* readPngFrames(response, maxFrameBytes) {
  let boundary
  try {
    boundary = parseMultipartBoundary(response.headers.get('content-type') ?? '')
  } catch (error) {
    await cancelBodyQuietly(response.body)
    throw error
  }
  if (!response.body) throw new ArtemisProtocolError('/api/stream/device-live returned an empty response body')
  const boundaryBytes = new TextEncoder().encode(`--${boundary}\r\n`)
  const headerTerminator = Uint8Array.from([13, 10, 13, 10])
  const maxBuffered = maxFrameBytes + MAX_MULTIPART_HEADER_BYTES + boundaryBytes.byteLength + headerTerminator.byteLength + 2
  let reader
  try {
    reader = response.body.getReader()
  } catch (error) {
    await cancelBodyQuietly(response.body)
    throw error
  }
  const buffered = new BoundedByteBuffer(maxBuffered)
  let buffer = buffered.view()
  let bodyStart = -1
  let contentLength = null

  try {
    while (true) {
      let produced
      do {
        produced = false
        if (bodyStart < 0) {
          const boundaryStart = indexOfBytes(buffer, boundaryBytes)
          if (boundaryStart >= 0) {
            if (boundaryStart !== 0) {
              throw new ArtemisProtocolError('ARTEMIS live stream contained an unexpected multipart preamble', { code: 'invalid-multipart' })
            }
            const headerStart = boundaryBytes.byteLength
            const headerEnd = indexOfBytes(buffer, headerTerminator, headerStart)
            if (headerEnd >= 0) {
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
            } else if (buffer.byteLength - headerStart > MAX_MULTIPART_HEADER_BYTES) {
              throw new ArtemisProtocolError('ARTEMIS live frame headers exceeded the configured limit', { code: 'invalid-multipart' })
            }
          } else if (buffer.byteLength > MAX_MULTIPART_HEADER_BYTES) {
            throw new ArtemisProtocolError('ARTEMIS live stream did not expose a bounded multipart header', { code: 'invalid-multipart' })
          }
        }

        if (bodyStart >= 0 && buffer.byteLength >= bodyStart + contentLength + 2) {
          const frameEnd = bodyStart + contentLength
          if (buffer[frameEnd] !== 13 || buffer[frameEnd + 1] !== 10) {
            throw new ArtemisProtocolError('ARTEMIS live frame omitted its trailing CRLF', { code: 'invalid-multipart' })
          }
          const frame = buffer.slice(bodyStart, frameEnd)
          if (!hasPngSignature(frame)) {
            throw new ArtemisProtocolError('ARTEMIS live frame did not contain a valid PNG signature', { code: 'invalid-image' })
          }
          buffered.consume(frameEnd + 2)
          buffer = buffered.view()
          bodyStart = -1
          contentLength = null
          produced = true
          yield Object.freeze({ mediaType: 'image/png', data: frame, bytes: frame.byteLength })
        }
      } while (produced)

      const { value, done } = await reader.read()
      if (done) {
        if (buffer.byteLength === 0) return
        throw new ArtemisProtocolError('ARTEMIS live stream ended before a complete frame arrived', { code: 'incomplete-frame' })
      }
      if (!(value instanceof Uint8Array)) {
        throw new ArtemisProtocolError('ARTEMIS live stream returned an invalid response body', { code: 'invalid-multipart' })
      }
      if (buffer.byteLength + value.byteLength > maxBuffered) {
        throw new ArtemisProtocolError('ARTEMIS live frame exceeded the configured size limit', { code: 'frame-too-large' })
      }
      buffered.append(value)
      buffer = buffered.view()
    }
  } finally {
    try { await reader.cancel() } catch {}
    try { reader.releaseLock?.() } catch {}
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
      await cancelBodyQuietly(response.body)
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

  async *streamSnapshots({ signal } = {}) {
    const controller = new AbortController()
    const forwardAbort = () => controller.abort(signal?.reason)
    if (signal?.aborted) controller.abort(signal.reason)
    else signal?.addEventListener('abort', forwardAbort, { once: true })
    const connectTimer = setTimeout(() => controller.abort(), this.snapshotTimeoutMs)
    let response
    try {
      response = await this.fetchImpl(new URL('/api/stream/device-live', this.baseUrl), {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { accept: 'multipart/x-mixed-replace' },
      })
    } catch (cause) {
      throw new ArtemisProtocolError('ARTEMIS request failed for /api/stream/device-live', { code: 'unavailable', cause })
    } finally {
      clearTimeout(connectTimer)
    }
    try {
      if (!response.ok) {
        throw new ArtemisProtocolError(`ARTEMIS returned HTTP ${response.status} for /api/stream/device-live`, { code: 'http-error' })
      }
      yield* readPngFrames(response, this.maxFrameBytes)
    } finally {
      controller.abort()
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  async getSnapshot() {
    const iterator = this.streamSnapshots({ signal: AbortSignal.timeout(this.snapshotTimeoutMs) })[Symbol.asyncIterator]()
    try {
      const first = await iterator.next()
      if (first.done) {
        throw new ArtemisProtocolError('ARTEMIS live stream ended before a frame arrived', { code: 'incomplete-frame' })
      }
      return first.value
    } catch (cause) {
      if (cause instanceof ArtemisProtocolError) throw cause
      throw new ArtemisProtocolError('ARTEMIS snapshot request failed', { code: 'unavailable', cause })
    } finally {
      try { await iterator.return?.() } catch {}
    }
  }
}

export const artemisHttpDefaults = Object.freeze({
  baseUrl: DEFAULT_BASE_URL,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  snapshotTimeoutMs: DEFAULT_SNAPSHOT_TIMEOUT_MS,
  maxJsonBytes: DEFAULT_MAX_JSON_BYTES,
  maxFrameBytes: DEFAULT_MAX_FRAME_BYTES,
})
