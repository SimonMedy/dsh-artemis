import {
  ArtemisHttpClient,
  ArtemisProtocolError,
  resolveArtemisBaseUrl,
} from './artemis-http.mjs'

const LITERAL_LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]'])

export function resolveProductArtemisBaseUrl(value) {
  const url = resolveArtemisBaseUrl(value)
  if (!LITERAL_LOOPBACK_HOSTS.has(url.hostname)) {
    throw new ArtemisProtocolError(
      'ARTEMIS product base URL must use a literal loopback address',
      { code: 'non-literal-loopback-base-url' },
    )
  }
  return url
}

export function createProductArtemisHttpClient(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('ARTEMIS client options must be an object')
  }
  const baseUrl = resolveProductArtemisBaseUrl(options.baseUrl).href
  return new ArtemisHttpClient({ ...options, baseUrl })
}
