import { ArtemisHttpClient } from './host/artemis-http.mjs'
import { registerArtemisEvidenceRoute } from './host/artemis-evidence.mjs'
import { registerArtemisHostRoutes } from './host/harness-routes.mjs'

export const name = 'dsh-artemis'
export const inject = ['webServer', 'connection']

/**
 * Static Harness Host face.
 *
 * Keep construction here intentionally small: feature logic lives behind the
 * ARTEMIS adapters and named Harness routes so upstream churn stays isolated.
 */
export function apply(ctx) {
  const client = new ArtemisHttpClient()
  ctx.effect(
    () => {
      const disposeHostRoutes = registerArtemisHostRoutes(ctx, client)
      const disposeEvidence = registerArtemisEvidenceRoute(ctx, client)
      return () => {
        disposeEvidence?.()
        disposeHostRoutes?.()
      }
    },
    'dsh-artemis: host routes',
  )
}
