const BASELINE_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
})

function applyBaselineHeaders(res) {
  if (!res || typeof res.setHeader !== 'function' || res.headersSent) return
  for (const [name, value] of Object.entries(BASELINE_HEADERS)) res.setHeader(name, value)
}
export function withBrowserResponseSecurity(webServer) {
  if (!webServer || typeof webServer.register !== 'function') {
    throw new TypeError('A Harness webServer service is required')
  }
  return Object.freeze({
    register(route) {
      if (!route || typeof route !== 'object' || typeof route.handler !== 'function') {
        throw new TypeError('A web route with a handler is required')
      }
      const handler = route.handler
      return webServer.register.call(webServer, {
        ...route,
        handler(req, res) {
          applyBaselineHeaders(res)
          return handler(req, res)
        },
      })
    },
  })
}
export const browserResponseSecurityHeaders = BASELINE_HEADERS
