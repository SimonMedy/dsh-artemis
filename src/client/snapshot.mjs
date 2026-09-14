import { SNAPSHOT_ROUTE } from '../shared/protocol.mjs'

const SNAPSHOT_TIMEOUT_MS = 6_000
const MAX_SNAPSHOT_BYTES = 8_388_608
const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function validWebLocation(locationLike) {
  return locationLike && (locationLike.protocol === 'http:' || locationLike.protocol === 'https:')
}

export function snapshotEndpoint(locationLike = globalThis.location) {
  if (!validWebLocation(locationLike)) return null
  return new URL(SNAPSHOT_ROUTE, locationLike.origin).href
}

function hasPngSignature(bytes) {
  return bytes.byteLength >= PNG_SIGNATURE.byteLength
    && PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

async function readResponseBytes(response, maxBytes) {
  const declaredText = response.headers.get('content-length')
  if (declaredText !== null) {
    if (!/^\d+$/.test(declaredText)) throw new Error('Android snapshot returned an invalid Content-Length')
    const declared = Number(declaredText)
    if (!Number.isSafeInteger(declared) || declared <= 0) throw new Error('Android snapshot returned an invalid Content-Length')
    if (declared > maxBytes) throw new Error('Android snapshot exceeded the browser size limit')
  }
  if (!response.body) throw new Error('Android snapshot returned an empty body')

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error('Android snapshot returned an invalid response body')
      size += value.byteLength
      if (size > maxBytes) {
        try { await reader.cancel() } catch {}
        throw new Error('Android snapshot exceeded the browser size limit')
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock?.() } catch {}
  }
  if (size === 0) throw new Error('Android snapshot returned an empty body')
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }
  return data
}

export async function fetchSnapshot({
  fetchImpl = globalThis.fetch,
  locationLike = globalThis.location,
  timeoutMs = SNAPSHOT_TIMEOUT_MS,
  maxBytes = MAX_SNAPSHOT_BYTES,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Browser fetch is unavailable')
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer')
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new TypeError('maxBytes must be a positive integer')
  const endpoint = snapshotEndpoint(locationLike)
  if (!endpoint) throw new Error('Android snapshot currently requires the Harness Web profile')

  const response = await fetchImpl(endpoint, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { accept: 'image/png' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Android snapshot returned HTTP ${response.status}`)
  if ((response.headers.get('content-type') ?? '').toLowerCase() !== 'image/png') {
    throw new Error('Android snapshot returned an unexpected content type')
  }
  const data = await readResponseBytes(response, maxBytes)
  if (!hasPngSignature(data)) throw new Error('Android snapshot was not a valid PNG')
  return Object.freeze({ mediaType: 'image/png', data, bytes: data.byteLength })
}

export function createSnapshotObjectUrl(snapshot, { BlobImpl = globalThis.Blob, URLImpl = globalThis.URL } = {}) {
  if (!snapshot || snapshot.mediaType !== 'image/png' || !(snapshot.data instanceof Uint8Array)) {
    throw new TypeError('A validated PNG snapshot is required')
  }
  if (typeof BlobImpl !== 'function' || !URLImpl || typeof URLImpl.createObjectURL !== 'function' || typeof URLImpl.revokeObjectURL !== 'function') {
    throw new Error('Browser object URLs are unavailable')
  }
  const blob = new BlobImpl([snapshot.data], { type: 'image/png' })
  const url = URLImpl.createObjectURL(blob)
  let revoked = false
  return Object.freeze({
    url,
    revoke() {
      if (revoked) return
      revoked = true
      URLImpl.revokeObjectURL(url)
    },
  })
}

export const snapshotClientDefaults = Object.freeze({ timeoutMs: SNAPSHOT_TIMEOUT_MS, maxBytes: MAX_SNAPSHOT_BYTES })
