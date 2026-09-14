const APPLICATION_JSON_PATTERN = /^application\/(?:json|[!#$%&'*+\-.^_`|~0-9a-z]+\+json)$/i

export function jsonMimeType(value) {
  if (typeof value !== 'string') return null
  const mime = value.split(';', 1)[0]?.trim() ?? ''
  if (!APPLICATION_JSON_PATTERN.test(mime)) return null
  return mime.toLowerCase()
}

export function isJsonContentType(value) {
  return jsonMimeType(value) !== null
}
