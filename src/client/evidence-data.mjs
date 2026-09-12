import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE } from '../shared/protocol.mjs'

const REQUEST_TIMEOUT_MS = 4_000
const TASK_STATES = new Set(['idle', 'running', 'paused', 'unknown'])

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
