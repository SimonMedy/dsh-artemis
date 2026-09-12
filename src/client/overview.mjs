import { readBoundedJsonResponse } from './bounded-json.mjs'
import { PANEL_METADATA_LIMITS } from '../shared/panel-metadata-limits.mjs'
import { DSH_ARTEMIS_PROTOCOL_VERSION, OVERVIEW_ROUTE } from '../shared/protocol.mjs'

const REQUEST_TIMEOUT_MS = 4_000
const ROOT_STATES = new Set(['validated', 'not-supplied', 'invalid'])
const PYTHON_STATES = new Set(['validated-explicit', 'profile-managed', 'unknown', 'invalid'])

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}
function nullableString(value, label, maxChars) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`)
  const trimmed = value.trim()
  if (trimmed.length > maxChars) throw new Error(`${label} exceeds the supported length`)
  return trimmed || null
}
function requiredString(value, label, maxChars) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must be non-empty`)
  if (trimmed.length > maxChars) throw new Error(`${label} exceeds the supported length`)
  return trimmed
}
function device(value, index) {
  const input = record(value, `devices[${index}]`)
  const serial = requiredString(input.serial, `devices[${index}].serial`, PANEL_METADATA_LIMITS.maxSerialChars)
  const state = requiredString(input.state, `devices[${index}].state`, PANEL_METADATA_LIMITS.maxStateChars)
  if (typeof input.busy !== 'boolean') throw new Error(`devices[${index}].busy must be boolean`)
  return Object.freeze({
    serial,
    state: state.toLowerCase(),
    model: nullableString(input.model, `devices[${index}].model`, PANEL_METADATA_LIMITS.maxModelChars),
    product: nullableString(input.product, `devices[${index}].product`, PANEL_METADATA_LIMITS.maxProductChars),
    busy: input.busy,
  })
}
function setupStatus(value) {
  const input = record(value, 'setup')
  if (!ROOT_STATES.has(input.artemisRoot)) throw new Error('setup.artemisRoot is invalid')
  if (!PYTHON_STATES.has(input.python)) throw new Error('setup.python is invalid')
  if (input.mcpRuntime !== 'unobservable') throw new Error('setup.mcpRuntime must be unobservable')
  return Object.freeze({ artemisRoot: input.artemisRoot, python: input.python, mcpRuntime: input.mcpRuntime })
}

export function parseOverview(value) {
  const input = record(value, 'overview')
  if (input.version !== DSH_ARTEMIS_PROTOCOL_VERSION) throw new Error('Unsupported dsh-artemis protocol version')
  const artemis = record(input.artemis, 'artemis')
  if (artemis.state !== 'ready' && artemis.state !== 'offline') throw new Error('artemis.state must be ready or offline')
  const status = nullableString(artemis.status, 'artemis.status', PANEL_METADATA_LIMITS.maxStatusChars)
  const setup = setupStatus(input.setup)
  if (!Array.isArray(input.devices)) throw new Error('devices must be an array')
  if (input.devices.length > PANEL_METADATA_LIMITS.maxDevices) throw new Error('devices exceeds the supported count')
  const devices = Object.freeze(input.devices.map(device))
  const activeDeviceSerial = nullableString(input.activeDeviceSerial, 'activeDeviceSerial', PANEL_METADATA_LIMITS.maxSerialChars)
  const stream = record(input.stream, 'stream')
  if (typeof stream.connected !== 'boolean') throw new Error('stream.connected must be boolean')
  return Object.freeze({
    version: input.version,
    artemis: Object.freeze({ state: artemis.state, status }),
    setup,
    devices,
    activeDeviceSerial,
    stream: Object.freeze({ connected: stream.connected }),
  })
}
export function selectActiveDevice(overview) {
  if (overview.activeDeviceSerial) {
    const active = overview.devices.find((entry) => entry.serial === overview.activeDeviceSerial)
    if (active) return active
  }
  return overview.devices[0] ?? null
}
export function derivePanelState(overview) {
  if (overview.artemis.state === 'offline') return Object.freeze({ dot: 'idle', artemisLabel: 'ARTEMIS Offline', deviceLabel: 'No device' })
  const active = selectActiveDevice(overview)
  if (!active) return Object.freeze({ dot: 'warning', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'No Android device' })
  if (active.busy) return Object.freeze({ dot: 'ongoing', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Busy' })
  return Object.freeze({ dot: 'done', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Ready' })
}
export function overviewEndpoint(locationLike = globalThis.location) {
  if (!locationLike || (locationLike.protocol !== 'http:' && locationLike.protocol !== 'https:')) return null
  return new URL(OVERVIEW_ROUTE, locationLike.origin).href
}
export async function fetchOverview({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Browser fetch is unavailable')
  const endpoint = overviewEndpoint(locationLike)
  if (!endpoint) throw new Error('The Android panel currently requires the Harness Web profile')
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`dsh-artemis overview returned HTTP ${response.status}`)
  return parseOverview(await readBoundedJsonResponse(response, { label: 'dsh-artemis overview' }))
}
