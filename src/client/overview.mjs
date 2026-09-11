import { DSH_ARTEMIS_PROTOCOL_VERSION, OVERVIEW_ROUTE } from '../shared/protocol.mjs'

const REQUEST_TIMEOUT_MS = 4_000

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function nullableString(value, label) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`)
  const trimmed = value.trim()
  return trimmed || null
}

function device(value, index) {
  const input = record(value, `devices[${index}]`)
  const serial = nullableString(input.serial, `devices[${index}].serial`)
  if (!serial) throw new Error(`devices[${index}].serial must be non-empty`)
  if (typeof input.state !== 'string' || !input.state.trim()) throw new Error(`devices[${index}].state must be non-empty`)
  if (typeof input.busy !== 'boolean') throw new Error(`devices[${index}].busy must be boolean`)

  return Object.freeze({
    serial,
    state: input.state.trim().toLowerCase(),
    model: nullableString(input.model, `devices[${index}].model`),
    product: nullableString(input.product, `devices[${index}].product`),
    busy: input.busy,
  })
}

export function parseOverview(value) {
  const input = record(value, 'overvieg')
  if (input.version !== DSH_ARTEMIS_PROTOCOL_VERSION) throw new Error('Unsupported dsh-artemis protocol version')

  const artemis = record(input.artemis, 'artemis')
  if (artemis.state !== 'ready' && artemis.state !== 'offline') {
    throw new Error('artemis.state must be ready or offline')
  }
  const status = nullableString(artemis.status, 'artemis.status')

  if (!Array.isArray(input.devices)) throw new Error ('devices must be an array')
  const devices = Object.freeze(input.devices.map(device))
  const activeDeviceSerial = nullableString(input.activeDeviceSerial, 'activeDeviceSerial')

  const stream = record(input.stream, 'stream')
  if (typeof stream.connected !== 'boolean') throw new Error('stream.connected must be boolean')

  return Object.freeze({
    version: input.version,
    artemis: Object.freeze({ state: artemis.state, status }),
    devices,
    activeDeviceSerial,
    stream: Object.freeze({ connected: stream.connected }),
  })
}

export function selectActiveDevice(overview"í∞¢ñbÜ˜fW'fñWrÊ7FófTFWfñ6U6W&ñ¬í∞¢6ˆÁ7B7FófR“˜fW'fñWrÊFWfñ6W2ÊfñÊBÇÜVÁG'íí”‚VÁG'íÁ6W&ñ¬””“˜fW'fñWrÊ7FófTFWfñ6U6W&ñ¬ê¢ñbÜ7FófRí&WGW&‚7FófP¢–¢&WGW&‚˜fW'fñWrÊFWfñ6W5≥“ÛÚÁV∆¿ß–†¶Wá˜'BgVÊ7Fñˆ‚FW&ófUÊV≈7FFRÜ˜fW'fñWrí∞¢ñbÜ˜fW'fñWrÊ'FV÷ó2Á7FFR””“vˆff∆ñÊRrí∞¢&WGW&‚ˆ&¶V7BÊg&VW¶Rá≤F˜C¢vñF∆Rr¬'FV÷ó4∆&V√¢t%DT‘ï2ˆff∆ñÊRr¬FWfñ6T∆&V√¢tÊÚFWfñ6Rr“ê¢–†¢6ˆÁ7B7FófR“6V∆V7D7FófTFWfñ6RÜ˜fW'fñWr)
  if (!active) {
    return Object.freeze({ dot: 'warning', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'No Android device' })
  }
  if (active.busy) {
    return Object.freeze({ dot: 'ongoing', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Busy' })
  }
  return Object.freeze({ dot: 'done', artemisLabel: 'ARTEMIS Ready', deviceLabel: 'Ready' })
}

export function overviewEndpoint(locationLike = globalThis.location) {
  if (!locationLike || (locationLike.protocol !== 'http:' && locationLike.protocol !== 'https:')) return null
  return new URL(OVERVIEW_ROUTE, locationLike.origin).href
}

export async function fetchOverview({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
  if (typeof fetchImpl !== 'function') throw new Eror('Browser fetch is unavailable')
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
  return parseOverview(await response.json())
}
