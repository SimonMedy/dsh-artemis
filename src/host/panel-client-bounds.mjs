import { ArtemisProtocolError } from './artemis-http.mjs'

const MAX_DEVICES = 32
const MAX_STATUS_CHARS = 64
const MAX_SERIAL_CHARS = 256
const MAX_STATE_CHARS = 64
const MAX_MODEL_CHARS = 256
const MAX_PRODUCT_CHARS = 256

function protocolError(label) {
  return new ArtemisProtocolError(`${label} exceeded the browser panel metadata contract`, {
    code: 'panel-metadata-invalid',
  })
}

function boundedString(value, maxChars, label, { nullable = false } = {}) {
  if (value === null || value === undefined) {
    if (nullable) return null
    throw protocolError(label)
  }
  if (typeof value !== 'string') throw protocolError(label)
  const text = value.trim()
  if (!text) {
    if (nullable) return null
    throw protocolError(label)
  }
  if (text.length > maxChars) throw protocolError(label)
  return text
}

function boundedDevice(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw protocolError('device')
  }
  if (typeof value.busy !== 'boolean') throw protocolError('device.busy')
  return Object.freeze({
    serial: boundedString(value.serial, MAX_SERIAL_CHARS, 'device.serial'),
    state: boundedString(value.state, MAX_STATE_CHARS, 'device.state').toLowerCase(),
    model: boundedString(value.model, MAX_MODEL_CHARS, 'device.model', { nullable: true }),
    product: boundedString(value.product, MAX_PRODUCT_CHARS, 'device.product', { nullable: true }),
    busy: value.busy,
  })
}

export function createBoundedPanelClient(client) {
  if (!client
    || typeof client.health !== 'function'
    || typeof client.listDevices !== 'function'
    || typeof client.getStreamState !== 'function'
    || typeof client.getSnapshot !== 'function'
    || typeof client.streamSnapshots !== 'function') {
    throw new TypeError('A complete ARTEMIS panel client is required')
  }

  return Object.freeze({
    async health() {
      const value = await client.health()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolError('health')
      return Object.freeze({
        reachable: Boolean(value.reachable),
        status: boundedString(value.status, MAX_STATUS_CHARS, 'health.status'),
      })
    },

    async listDevices() {
      const values = await client.listDevices()
      if (!Array.isArray(values)) throw protocolError('devices')
      if (values.length > MAX_DEVICES) throw protocolError('devices')
      return Object.freeze(values.map(boundedDevice))
    },

    async getStreamState() {
      const value = await client.getStreamState()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolError('stream state')
      if (typeof value.connected !== 'boolean') throw protocolError('stream.connected')
      return Object.freeze({
        connected: value.connected,
        serial: boundedString(value.serial, MAX_SERIAL_CHARS, 'stream.serial', { nullable: true }),
      })
    },

    getSnapshot(...args) {
      return client.getSnapshot(...args)
    },

    streamSnapshots(...args) {
      return client.streamSnapshots(...args)
    },
  })
}

export const panelMetadataLimits = Object.freeze({
  maxDevices: MAX_DEVICES,
  maxStatusChars: MAX_STATUS_CHARS,
  maxSerialChars: MAX_SERIAL_CHARS,
  maxStateChars: MAX_STATE_CHARS,
  maxModelChars: MAX_MODEL_CHARS,
  maxProductChars: MAX_PRODUCT_CHARS,
})
