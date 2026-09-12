import { createElement as h, useCallback, useEffect, useRef, useState } from 'react'
import { Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE } from '../shared/protocol.mjs'

const POLL_INTERVAL_MS = 5_000
const REQUEST_TIMEOUT_MS = 4_000
const TASK_STATES = new Set(['idle', 'running', 'paused', 'unknown'])

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

function expectObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}
function nullableString(value, maxChars, label) {
  if (value === null) return null
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`)
  const text = value.trim()
  if (!text || text.length > maxChars) throw new Error(`${label} is invalid`)
  return text
}
function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
  return value
}
function normalizeTrace(value, index) {
  const trace = expectObject(value, `trace[${index}]`)
  return Object.freeze({
    name: nullableString(trace.name, 80, `trace[${index}].name`) ?? 'trace',
    type: nullableString(trace.type, 40, `trace[${index}].type`),
    status: nullableString(trace.status, 40, `trace[${index}].status`),
  })
}
function normalizeLatestStep(value) {
  if (value === null) return null
  const step = expectObject(value, 'latestStep')
  const stepNumber = step.stepNumber === null ? null : count(step.stepNumber, 'latestStep.stepNumber')
  const action = nullableString(step.action, 160, 'latestStep.action')
  const traceCount = count(step.traceCount, 'latestStep.traceCount')
  if (!Array.isArray(step.traces) || step.traces.length > 8 || step.traces.length > traceCount) throw new Error('latestStep.traces is invalid')
  return Object.freeze({ stepNumber, action, traceCount, traces: Object.freeze(step.traces.map(normalizeTrace)) })
}

export function parseEvidence(value) {
  const input = expectObject(value, 'evidence')
  if (input.version !== DSH_ARTEMIS_PROTOCOL_VERSION) throw new Error('Unsupported dsh-artemis evidence protocol version')
  const task = expectObject(input.task, 'task')
  if (typeof task.status !== 'string' || !TASK_STATES.has(task.status)) throw new Error('task.status is invalid')
  const normalizedTask = Object.freeze({
    status: task.status,
    goal: nullableString(task.goal, 512, 'task.goal'),
    sessionId: nullableString(task.sessionId, 128, 'task.sessionId'),
    queueCount: count(task.queueCount, 'task.queueCount'),
    activeCount: count(task.activeCount, 'task.activeCount'),
    backgroundCount: count(task.backgroundCount, 'task.backgroundCount'),
  })
  return Object.freeze({ version: input.version, task: normalizedTask, latestStep: normalizeLatestStep(input.latestStep) })
}

export function evidenceEndpoint(locationLike = globalThis.location) {
  if (!locationLike || (locationLike.protocol !== 'http:' && locationLike.protocol !== 'https:')) return null
  return new URL(EVIDENCE_ROUTE, locationLike.origin).href
}

export async function fetchEvidence({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Browser fetch is unavailable')
  const endpoint = evidenceEndpoint(locationLike)
  if (!endpoint) throw new Error('ARTEMIS task evidence currently requires the Harness Web profile')
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`ARTEMIS task evidence returned HTTP ${response.status}`)
  return parseEvidence(await response.json())
}

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
