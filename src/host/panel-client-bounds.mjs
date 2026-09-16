import { ArtemisProtocolError } from './artemis-http.mjs'
import { PANEL_METADATA_LIMITS } from '../shared/panel-metadata-limits.mjs'

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
    serial: boundedString(value.serial, PANEL_METADATA_LIMITS.maxSerialChars, 'device.serial'),
    state: boundedString(value.state, PANEL_METADATA_LIMITS.maxStateChars, 'device.state').toLowerCase(),
    model: boundedString(value.model, PANEL_METADATA_LIMITS.maxModelChars, 'device.model', { nullable: true }),
    product: boundedString(value.product, PANEL_METADATA_LIMITS.maxProductChars, 'device.product', { nullable: true }),
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
      if (typeof value.reachable !== 'boolean') throw protocolError('health.reachable')
      return Object.freeze({
        reachable: value.reachable,
        status: boundedString(value.status, PANEL_METADATA_LIMITS.maxStatusChars, 'health.status'),
      })
    },

    async listDevices() {
      const values = await client.listDevices()
      if (!Array.isArray(values)) throw protocolError('devices')
      if (values.length > PANEL_METADATA_LIMITS.maxDevices) throw protocolError('devices')
      return Object.freeze(values.map(boundedDevice))
    },

    async getStreamState() {
      const value = await client.getStreamState()
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolError('stream state')
      if (typeof value.connected !== 'boolean') throw protocolError('stream.connected')
      return Object.freeze({
        connected: value.connected,
        serial: boundedString(value.serial, PANEL_METADATA_LIMITS.maxSerialChars, 'stream.serial', { nullable: true }),
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

export const panelMetadataLimits = PANEL_METADATA_LIMITS
