import { registerArtemisEvidenceRoute } from './host/artemis-evidence.mjs'
import { createProductArtemisHttpClient } from './host/artemis-product-client.mjs'
import { withBrowserResponseSecurity } from './host/browser-response-security.mjs'
import { registerArtemisHostRoutes } from './host/harness-routes.mjs'
import { createBoundedPanelClient } from './host/panel-client-bounds.mjs'
import { inspectArtemisSetup } from './integration/artemis-setup-status.mjs'

export const name = 'dsh-artemis'
export const inject = ['webServer', 'connection']

/**
 * Static Harness Host face.
 *
 * Keep construction here intentionally small: feature logic lives behind the
 * ARTEMIS adapters and named Harness routes so upstream churn stays isolated.
 */
export function apply(ctx) {
  const client = createProductArtemisHttpClient()
  const panelClient = createBoundedPanelClient(client)
  const setupStatus = inspectArtemisSetup()
  ctx.effect(
    () => {
      const routeContext = {
        webServer: withBrowserResponseSecurity(ctx.webServer),
        connection: ctx.connection,
      }
      const disposeHostRoutes = registerArtemisHostRoutes(routeContext, panelClient, { setupStatus })
      const disposeEvidence = registerArtemisEvidenceRoute(routeContext, client)
      return () => {
        disposeEvidence?.()
        disposeHostRoutes?.()
      }
    },
    'dsh-artemis: host routes',
  )
}
