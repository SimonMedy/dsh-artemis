export function parseDecimalContentLength(value) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new TypeError('Content-Length must be a decimal integer')
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError('Content-Length must be a safe integer')
  }
  return parsed
}
