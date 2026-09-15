import { registerArtemisEvidenceRoute } from './host/artemis-evidence.mjs'
import { createProductArtemisHttpClient } from './host/artemis-product-client.mjs'
import { withBrowserResponseSecurity } from './host/browser-response-security.mjs'
import { registerArtemisHostRoutes } from './host/harness-routes.mjs'
import { createBoundedPanelClient } from './host/panel-client-bounds.mjs'
import { createRouteRegistrationTransaction } from './host/route-registration-transaction.mjs'
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
      const transaction = createRouteRegistrationTransaction(ctx.webServer)
      try {
        const routeContext = {
          webServer: withBrowserResponseSecurity(transaction.webServer),
          connection: ctx.connection,
        }
        registerArtemisHostRoutes(routeContext, panelClient, { setupStatus })
        registerArtemisEvidenceRoute(routeContext, client)
        return transaction.commit()
      } catch (error) {
        transaction.rollback()
        throw error
      }
    },
    'dsh-artemis: host routes',
  )
}
