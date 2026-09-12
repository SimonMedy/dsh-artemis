import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { fetchEvidence, fetchTraceEvidence } from './evidence-data.mjs'

const POLL_INTERVAL_MS = 5_000
const styles = Object.freeze({
  root: { display: 'flex', flex: '0 0 auto', flexDirection: 'column', gap: 8, maxHeight: '42%', padding: '12px 16px 16px', overflow: 'auto', borderTop: '0.5px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)' },
  header: { display: 'flex', gap: 8, alignItems: 'center' },
  title: { flex: '1 1 auto', minWidth: 0, fontSize: 13 },
  goal: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: 1.5 },
  facts: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 10px', color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 },
  value: { minWidth: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-secondary)', textAlign: 'right', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  traces: { display: 'flex', flexDirection: 'column', gap: 4 },
  trace: { display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, fontSize: 11 },
  traceName: { flex: '1 1 auto', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  secondary: { color: 'var(--dsw-alias-label-tertiary)' },
  traceActions: { display: 'flex', alignItems: 'center', gap: 8 },
  traceTree: { display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 0 2px' },
  traceTreeRow: { display: 'flex', gap: 8, alignItems: 'center', minWidth: 0, fontSize: 11 },
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
function stepKey(step) {
  if (!step) return 'none'
  return `${step.stepNumber ?? 'recorded'}:${step.action ?? ''}:${step.traceCount}`
}
function renderTraceTree(nodes, depth = 0, prefix = 'trace') {
  const rendered = []
  nodes.forEach((trace, index) => {
    const key = `${prefix}:${index}:${trace.name}`
    rendered.push(h('div', { key, style: { ...styles.traceTreeRow, paddingLeft: depth * 12 } },
      h('span', { style: styles.traceName }, trace.name),
      trace.status ? h('span', { style: styles.secondary }, trace.status) : null,
    ))
    rendered.push(...renderTraceTree(trace.children, depth + 1, key))
  })
  return rendered
}

export function TaskEvidenceCard() {
  const [evidence, setEvidence] = useState(null)
  const [error, setError] = useState(null)
  const [traceDetails, setTraceDetails] = useState(null)
  const [tracePending, setTracePending] = useState(false)
  const [traceError, setTraceError] = useState(null)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const traceInFlight = useRef(false)
  const currentStepKey = useRef('none')
  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const next = await fetchEvidence()
      if (!alive.current) return
      const nextKey = stepKey(next.latestStep)
      if (nextKey !== currentStepKey.current) {
        currentStepKey.current = nextKey
        setTraceDetails(null)
        setTraceError(null)
      }
      setEvidence(next)
      setError(null)
    } catch {
      if (alive.current) setError('Task evidence unavailable')
    } finally {
      inFlight.current = false
    }
  }, [])
  const inspectTraces = useCallback(async () => {
    if (traceInFlight.current) return
    traceInFlight.current = true
    if (alive.current) { setTracePending(true); setTraceError(null) }
    try {
      const next = await fetchTraceEvidence()
      if (!alive.current) return
      if (next.step && stepKey({ stepNumber: next.step.stepNumber, action: next.step.action, traceCount: evidence?.latestStep?.traceCount ?? 0 }) !== currentStepKey.current) {
        setTraceDetails(null)
        setTraceError('Latest step changed; refresh evidence before inspecting traces')
        return
      }
      setTraceDetails(next)
    } catch {
      if (alive.current) setTraceError('Trace structure unavailable')
    } finally {
      traceInFlight.current = false
      if (alive.current) setTracePending(false)
    }
  }, [evidence])
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
    latestStep && latestStep.traceCount > 0
      ? h('div', { style: styles.traceActions },
          h(Button, { variant: 'toolbar', size: 'sm', disabled: tracePending, onClick: () => { void inspectTraces() }, 'aria-label': 'Inspect latest traces' }, tracePending ? 'Inspecting…' : 'Inspect traces'),
          h('span', { style: styles.secondary }, 'Structure only'),
        )
      : null,
    traceDetails?.step
      ? h('div', { style: styles.traceTree, role: 'region', 'aria-label': 'Latest trace structure' },
          h('span', { style: styles.secondary }, `${traceDetails.step.nodeCount} bounded metadata node${traceDetails.step.nodeCount === 1 ? '' : 's'}`),
          ...renderTraceTree(traceDetails.step.traceTree),
          traceDetails.truncated ? h('p', { style: styles.warning }, 'Additional trace structure omitted by safety bounds.') : null,
        )
      : null,
    traceDetails && !traceDetails.step ? h('p', { style: styles.warning }, 'No latest trace structure is available.') : null,
    traceError ? h('p', { style: styles.warning, role: 'alert' }, traceError) : null,
    error ? h('p', { style: styles.warning, role: 'alert' }, `Last evidence refresh failed. ${error}.`) : null,
  )
}
