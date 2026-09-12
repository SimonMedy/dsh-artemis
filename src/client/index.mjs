import { AndroidPanel } from './panel.mjs'
import { registerAndroidClient, inject } from './register.mjs'

export { ANDROID_TAB_ID, ANDROID_TAB_KIND, androidTabDefinition } from './definition.mjs'
export { inject }

export function apply(ctx) {
  registerAndroidClient(ctx, AndroidPanel)
}
