export const DEFAULT_BROWSER_JSON_LIMIT_BYTES = 128 * 1024

function responseHeader(response, name) {
  const value = response?.headers?.get?.(name)
  return typeof value === 'string' ? value.trim() : ''
}

function assertJsonContentType(response, label) {
  const contentType = responseHeader(response, 'content-type').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    throw new Error(`${label} returned an invalid content type`)
  }
}

function assertDeclaredLength(response, maxBytes, label) {
  const raw = responseHeader(response, 'content-length')
  if (!raw) return
  if (!/^\d+$/.test(raw)) throw new Error(`${label} returned an invalid content length`)
  const length = Number(raw)
  if (!Number.isSafeInteger(length) || length > maxBytes) {
    throw new Error(`${label} exceeded the response size limit`)
  }
}

function parseJsonBytes(bytes, label) {
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} returned invalid UTF-8`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} returned invalid JSON`)
  }
}

export async function readBoundedJsonResponse(response, {
  maxBytes = DEFAULT_BROWSER_JSON_LIMIT_BYTES,
  label = 'JSON response',
} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new TypeError('maxBytes must be a positive safe integer')
  assertJsonContentType(response, label)
  assertDeclaredLength(response, maxBytes, label)

  const reader = response?.body?.getReader?.()
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer())
    if (buffer.byteLength > maxBytes) throw new Error(`${label} exceeded the response size limit`)
    return parseJsonBytes(buffer, label)
  }

  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) throw new Error(`${label} returned an invalid response body`)
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error(`${label} exceeded the response size limit`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock?.()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return parseJsonBytes(bytes, label)
}
