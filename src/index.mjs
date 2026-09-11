import { ArtemisHttpClient } from './host/artemis-http.mjs'
import { registerArtemisHostRoutes } from './host/harness-routes.mjs'

export const name = 'dsh-artemis'
export const inject = ['webServer', 'connection']

/**
 * Static Harness Host face.
 *
 * Keep construction here intentionally small: feature logic lives behind the
 * ARTEMIS adapter and named Harness routes so upstream churn stays isolated.
 */
export function apply(ctx) {
  const client = new ArtemisHttpClient()
  ctx.effect(
    () => registerArtemisHostRoutes(ctx, client),
    'dsh-artemis: host routes',
  )
}
