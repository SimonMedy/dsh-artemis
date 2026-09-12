import { LIVE_ROUTE } from '../shared/protocol.mjs'

export const LIVE_MAX_RETRIES = 4
const LIVE_RETRY_BASE_MS = 750
const LIVE_RETRY_MAX_MS = 3_000

function validWebLocation(locationLike) {
  return locationLike && (locationLike.protocol === 'http:' || locationLike.protocol === 'https:')
}

export function liveEndpoint(locationLike = globalThis.location) {
  if (!validWebLocation(locationLike)) return null
  return new URL(LIVE_ROUTE, locationLike.origin).href
}

export function liveRetryDelay(attempt, { baseMs = LIVE_RETRY_BASE_MS, maxMs = LIVE_RETRY_MAX_MS } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('attempt must be a positive integer')
  if (!Number.isInteger(baseMs) || baseMs <= 0) throw new TypeError('baseMs must be a positive integer')
  if (!Number.isInteger(maxMs) || maxMs <= 0) throw new TypeError('maxMs must be a positive integer')
  return Math.min(maxMs, baseMs * (2 ** (attempt - 1)))
}

export const liveClientDefaults = Object.freeze({
  maxRetries: LIVE_MAX_RETRIES,
  retryBaseMs: LIVE_RETRY_BASE_MS,
  retryMaxMs: LIVE_RETRY_MAX_MS,
})
