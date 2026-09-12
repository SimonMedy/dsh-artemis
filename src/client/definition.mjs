export const ANDROID_TAB_ID = 'dsh-artemis:android'
export const ANDROID_TAB_KIND = 'android'

export function androidTabDefinition() {
  return {
    id: ANDROID_TAB_ID,
    kind: ANDROID_TAB_KIND,
    priority: 'extension',
    title: () => 'Android',
    guide: [{
      order: 40,
      title: () => 'Android',
      description: () => 'Inspect ARTEMIS and the active Android device',
    }],
  }
}
