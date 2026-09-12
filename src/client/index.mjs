import { createElement as h } from 'react'
import { TaskEvidenceCard } from './evidence.mjs'
import { AndroidPanel } from './panel.mjs'
import { registerAndroidClient, inject } from './register.mjs'
import { VisualQACheckpointCard } from './visual-qa.mjs'

export { ANDROID_TAB_ID, ANDROID_TAB_KIND, androidTabDefinition } from './definition.mjs'
export { inject }

const shellStyles = Object.freeze({
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  panel: { flex: '1 1 auto', minHeight: 0 },
})

function IntegratedAndroidPanel() {
  return h('div', { style: shellStyles.root, 'data-dsh-artemis-integrated-panel': '' },
    h('div', { style: shellStyles.panel }, h(AndroidPanel)),
    h(TaskEvidenceCard),
    h(VisualQACheckpointCard),
  )
}

export function apply(ctx) {
  registerAndroidClient(ctx, IntegratedAndroidPanel)
}
