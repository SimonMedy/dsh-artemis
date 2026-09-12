import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE, TRACE_EVIDENCE_ROUTE } from '../shared/protocol.mjs'

const REQUEST_TIMEOUT_MS = 4_000
const TASK_STATES = new Set(['idle', 'running', 'paused', 'unknown'])
const MAX_TRACE_TREE_NODES = 64
const MAX_TRACE_TREE_DEPTH = 6
const MAX_TRACE_CHILDREN = 16

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

function normalizeTraceTree(value) {
  if (!Array.isArray(value)) throw new Error('traceTree must be an array')
  let nodeCount = 0
  function walk(nodes, depth) {
    if (depth > MAX_TRACE_TREE_DEPTH) throw new Error('traceTree exceeds maximum depth')
    if (nodes.length > MAX_TRACE_CHILDREN) throw new Error('traceTree has too many children')
    return Object.freeze(nodes.map((value, index) => {
      nodeCount += 1
      if (nodeCount > MAX_TRACE_TREE_NODES) throw new Error('traceTree has too many nodes')
      const trace = expectObject(value, `traceTree[${index}]`)
      return Object.freeze({
        name: nullableString(trace.name, 80, `traceTree[${index}].name`) ?? 'trace',
        type: nullableString(trace.type, 40, `traceTree[${index}].type`),
        status: nullableString(trace.status, 40, `traceTree[${index}].status`),
        children: walk(trace.children, depth + 1),
      })
    }))
  }
  const traceTree = walk(value, 1)
  return { traceTree, nodeCount }
}

export function parseTraceEvidence(value) {
  const input = expectObject(value, 'traceEvidence')
  if (input.version !== DSH_ARTEMIS_PROTOCOL_VERSION) throw new Error('Unsupported dsh-artemis trace evidence protocol version')
  if (typeof input.truncated !== 'boolean') throw new Error('traceEvidence.truncated must be boolean')
  if (input.step === null) return Object.freeze({ version: input.version, step: null, truncated: input.truncated })
  const step = expectObject(input.step, 'traceEvidence.step')
  const stepNumber = step.stepNumber === null ? null : count(step.stepNumber, 'traceEvidence.step.stepNumber')
  const action = nullableString(step.action, 160, 'traceEvidence.step.action')
  const expectedNodeCount = count(step.nodeCount, 'traceEvidence.step.nodeCount')
  const normalized = normalizeTraceTree(step.traceTree)
  if (normalized.nodeCount !== expectedNodeCount) throw new Error('traceEvidence.step.nodeCount does not match traceTree')
  return Object.freeze({
    version: input.version,
    step: Object.freeze({ stepNumber, action, nodeCount: normalized.nodeCount, traceTree: normalized.traceTree }),
    truncated: input.truncated,
  })
}

function endpointFor(route, locationLike = globalThis.location) {
  if (!locationLike || (locationLike.protocol !== 'http:' && locationLike.protocol !== 'https:')) return null
  return new URL(route, locationLike.origin).href
}
export function evidenceEndpoint(locationLike = globalThis.location) {
  return endpointFor(EVIDENCE_ROUTE, locationLike)
}
export function traceEvidenceEndpoint(locationLike = globalThis.location) {
  return endpointFor(TRACE_EVIDENCE_ROUTE, locationLike)
}
async function fetchJson(endpoint, errorLabel, parse, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Browser fetch is unavailable')
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${errorLabel} returned HTTP ${response.status}`)
  return parse(await response.json())
}
export async function fetchEvidence({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
  const endpoint = evidenceEndpoint(locationLike)
  if (!endpoint) throw new Error('ARTEMIS task evidence currently requires the Harness Web profile')
  return fetchJson(endpoint, 'ARTEMIS task evidence', parseEvidence, { fetchImpl })
}
export async function fetchTraceEvidence({ fetchImpl = globalThis.fetch, locationLike = globalThis.location } = {}) {
  const endpoint = traceEvidenceEndpoint(locationLike)
  if (!endpoint) throw new Error('ARTEMIS trace evidence currently requires the Harness Web profile')
  return fetchJson(endpoint, 'ARTEMIS trace evidence', parseTraceEvidence, { fetchImpl })
}
