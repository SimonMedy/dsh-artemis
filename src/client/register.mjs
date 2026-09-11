import { ANDROID_TAB_ID, androidTabDefinition } from './definition.mjs'

export const inject = ['slots', 'sidebarRightTabs']

export function registerAndroidClient(ctx, AndroidPanel) {
  if (typeof AndroidPanel !== 'function') throw new TypeError('AndroidPanel must be a component')

  ctx.effect(
    () => ctx.sidebarRightTabs.register(androidTabDefinition()),
    'dsh-artemis: Android tab type',
  )

  ctx.effect(
    () => ctx.slots.inject(
      'sidebar.right.pane.tab',
      () => ctx.slots.register(
        {
          name: 'sidebar.right.pane.tab',
          key: ANDROID_TAB_ID,
        },
        AndroidPanel,
      ),
    ),
    'dsh-artemis: Android tab body',
  )
}
