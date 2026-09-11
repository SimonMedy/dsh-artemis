export const ANDROID_TAB_ID = 'dsh-artemis:android'
export const ANDROID_TAB_KIND = 'android'

export const inject = ['slots', 'sidebarRightTabs']

function AndroidPanelBootstrap() {
  return null
}

export function androidTabDefinition() {
  return {
    id: ANDROID_TAB_ID,
    kind: ANDROID_TAB_KIND,
    priority: 'extension',
    title: () => 'Android',
  }
}

/**
 * Browser face used only to prove the current Harness package and sidebar
 * contracts. The real panel lands in the next UI milestone; this body is a
 * native keyed seat registration rather than DOM injection.
 */
export function apply(ctx) {
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
        AndroidPanelBootstrap,
      ),
    ),
    'dsh-artemis: Android tab body',
  )
}
