import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { fetchEvidence } from './evidence-data.mjs'

const POLL_INTERVAL_MS = 5_000

const styles = Object.freeze({
  root: {
    display: 'flex',
    flex: '0 0 auto',
    flexDirection: 'column',
    gap: 8,
    maxHeight: '42%',
    padding: '12px 16px 16px',
    overflow: 'auto',
    borderTop: '0.5px solid var(--dsw-alias-border-l3)',
    color: 'var(--dsw-alias-label-primary)',
    background: 'var(--dsw-alias-bg-base)',
  },
  header: { display: 'flex', gap: 8, alignItems: 'center' },
  title: { flex: '1 1 auto', minWidth: 0, fontSize: 13 },
  goal: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.5 },
  facts: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 10px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 },
  value: { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-secondary)', textAlign: 'right', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  traces: { display: 'flex', flexDirection: 'column', gap: 4 },
  trace: { display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, fontSize: 11 },
  traceName: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  secondary: { color: 'var(--dsw-alias-label-tertiary)' },
  warning: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 11, lineHeight: 1.4 },
})

function taskDot(status) {
  if (status === 'running') return 'ongoing'
  if (status === 'paused') return 'warning'
  return 'idle'
}

function taskLabel(status) {
  if (status === 'running') return 'Running'
  if (status === 'paused') return 'Paused'
  if (status === 'idle') return 'Idle'
  return 'Unknown'
}

export function TaskEvidenceCard() {
  const [evidence, setEvidence] = useState(null)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const next = await fetchEvidence()
      if (!alive.current) return
      setEvidence(next)
      setError(null)
    } catch {
      if (alive.current) setError('Task evidence unavailable')
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = globalThis.setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    return () => {
      alive.current = false
      globalThis.clearInterval(timer)
    }
  }, [refresh])

  if (!evidence) {
    return h('section', { style: styles.root, 'aria-label': 'ARTEMIS task evidence' },
      h('div', { style: styles.header }, h(StateDot, { state: error ? 'error' : 'ongoing' }), h('span', { style: styles.title }, 'ARTEMIS task evidence')),
      h('p', { style: styles.warning }, error ?? 'Loading task evidence…'),
    )
  }

  const { task, latestStep } = evidence
  return h('section', { style: styles.root, 'aria-label': 'ARTEMIS task evidence' },
    h('div', { style: styles.header },
      h(StateDot, { state: taskDot(task.status) }),
      h('span', { style: styles.title }, 'ARTEMIS task'),
      h(Pill, null, taskLabel(task.status)),
    ),
    task.goal ? h('p', { style: styles.goal }, task.goal) : h('p', { style: styles.goal }, 'No active task goal.'),
    h('div', { style: styles.facts },
      h('span', null, 'Active'), h('span', { style: styles.value }, String(task.activeCount)),
      h('span', null, 'Queued'), h('span', { style: styles.value }, String(task.queueCount)),
      h('span', null, 'Background'), h('span', { style: styles.value }, String(task.backgroundCount)),
      latestStep ? h('span', null, 'Latest step') : null,
      latestStep ? h('span', { style: styles.value }, latestStep.stepNumber === null ? 'Recorded' : `Step ${latestStep.stepNumber}`) : null,
      latestStep?.action ? h('span', null, 'Action') : null,
      latestStep?.action ? h('span', { style: styles.value }, latestStep.action) : null,
    ),
    latestStep?.traces.length
      ? h('div', { style: styles.traces, 'aria-label': 'Latest step traces' },
          ...latestStep.traces.map((trace, index) => h('div', { key: `${trace.name}:${index}`, style: styles.trace },
            h('span', { style: styles.traceName }, trace.name),
            trace.status ? h('span', { style: styles.secondary }, trace.status) : null,
          )),
        )
      : null,
    latestStep && latestStep.traceCount > latestStep.traces.length
      ? h('p', { style: styles.warning }, `${latestStep.traceCount - latestStep.traces.length} earlier traces omitted from this bounded view.`)
      : null,
    error ? h('p', { style: styles.warning, role: 'alert' }, `Last evidence refresh failed. ${error}.`) : null,
  )
}
