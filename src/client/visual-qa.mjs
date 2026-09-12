import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { captureVisualCheckpoint } from './visual-qa-data.mjs'

const styles = Object.freeze({
  root: { display: 'flex', flex: '0 0 auto', flexDirection: 'column', gap: 8, padding: '12px 16px 16px', borderTop: '0.5px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)' },
  header: { display: 'flex', gap: 8, alignItems: 'center' },
  title: { flex: '1 1 auto', minWidth: 0, fontSize: 13 },
  image: { display: 'block', width: '100%', maxHeight: 260, objectFit: 'contain', border: '0.5px solid var(--dsw-alias-border-l4)', borderRadius: 10, background: 'var(--dsw-alias-bg-layer-2)' },
  facts: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 10px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 },
  value: { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-secondary)', textAlign: 'right', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  note: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, lineHeight: 1.45 },
  warning: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 11, lineHeight: 1.45 },
})

function checkpointLabel(checkpoint) {
  if (!checkpoint) return 'No checkpoint captured.'
  return checkpoint.latestStep?.stepNumber === null || checkpoint.latestStep?.stepNumber === undefined
    ? 'Recorded state'
    : `Step ${checkpoint.latestStep.stepNumber}`
}

export function VisualQACheckpointCard() {
  const [checkpoint, setCheckpoint] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const handle = useRef(null)

  const capture = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    if (alive.current) { setPending(true); setError(null) }
    try {
      const next = await captureVisualCheckpoint()
      if (!alive.current) { next.revoke(); return }
      const previous = handle.current
      handle.current = next
      setCheckpoint(next)
      previous?.revoke()
    } catch {
      if (alive.current) setError('Visual QA checkpoint unavailable')
    } finally {
      inFlight.current = false
      if (alive.current) setPending(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      const current = handle.current
      handle.current = null
      current?.revoke()
    }
  }, [])

  return h('section', { style: styles.root, 'aria-label': 'ARTEMIS visual QA checkpoint' },
    h('div', { style: styles.header },
      h(StateDot, { state: checkpoint ? 'success' : error ? 'error' : 'idle' }),
      h('span', { style: styles.title }, 'Visual QA checkpoint'),
      checkpoint ? h(Pill, null, checkpointLabel(checkpoint)) : null,
      h(Button, { variant: 'toolbar', size: 'sm', disabled: pending, onClick: () => { void capture() }, 'aria-label': 'Capture visual QA checkpoint' }, pending ? 'Capturing…' : checkpoint ? 'Replace checkpoint' : 'Capture checkpoint'),
    ),
    checkpoint
      ? h('img', { src: checkpoint.imageUrl, alt: 'Android visual QA checkpoint', style: styles.image })
      : h('p', { style: styles.note }, 'Capture one explicit, ephemeral screenshot together with bounded task metadata.'),
    checkpoint
      ? h('div', { style: styles.facts },
          h('span', null, 'Task'), h('span', { style: styles.value }, checkpoint.task.status),
          checkpoint.task.goal ? h('span', null, 'Goal') : null,
          checkpoint.task.goal ? h('span', { style: styles.value }, checkpoint.task.goal) : null,
          h('span', null, 'Checkpoint'), h('span', { style: styles.value }, checkpointLabel(checkpoint)),
          checkpoint.latestStep?.action ? h('span', null, 'Action') : null,
          checkpoint.latestStep?.action ? h('span', { style: styles.value }, checkpoint.latestStep.action) : null,
          h('span', null, 'Captured'), h('time', { style: styles.value, dateTime: checkpoint.capturedAt }, checkpoint.capturedAt),
        )
      : null,
    error ? h('p', { style: styles.warning, role: 'alert' }, error) : null,
    h('p', { style: styles.note }, 'Ephemeral browser memory only. Not uploaded, archived, replayed, or added to model context.'),
  )
}
