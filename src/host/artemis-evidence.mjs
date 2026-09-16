import { parseDecimalContentLength } from '../shared/content-length.mjs'
import { isJsonContentType } from '../shared/json-content-type.mjs'
import { ArtemisProtocolError } from './artemis-http.mjs'
import { DSH_ARTEMIS_PROTOCOL_VERSION, EVIDENCE_ROUTE, TRACE_EVIDENCE_ROUTE } from '../shared/protocol.mjs'

const MAX_GOAL_CHARS = 512
const MAX_ACTION_CHARS = 160
const MAX_TRACE_NAME_CHARS = 80
const MAX_TRACE_TYPE_CHARS = 40
const MAX_TRACE_STATUS_CHARS = 40
const MAX_TRACES = 8
const MAX_TRACE_TREE_NODES = 64
const MAX_TRACE_TREE_DEPTH = 6
const MAX_TRACE_CHILDREN = 16
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const TASK_STATES = new Set(['idle', 'running', 'paused'])

function expectObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArtemisProtocolError(`${label} must be a JSON object`)
  }
  return value
}

function boundedOptionalString(value, maxChars, label) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new ArtemisProtocolError(`${label} must be a string or null`)
  const text = value.trim()
  if (!text) return null
  return text.slice(0, maxChars)
}

function normalizeIdentifier(value, label) {
  const identifier = boundedOptionalString(value, 128, label)
  if (identifier === null) return null
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new ArtemisProtocolError(`ARTEMIS returned an invalid ${label}`, { code: 'invalid-evidence' })
  }
  return identifier
}

function arrayCount(value, label) {
  if (value === null || value === undefined) return 0
  if (!Array.isArray(value)) throw new ArtemisProtocolError(`${label} must be an array`, { code: 'invalid-evidence' })
  return value.length
}

async function cancelBodyQuietly(body) {
  try { await body?.cancel?.() } catch {}
}

async function readJsonWithinLimit(response, endpoint, maxBytes) {
  const contentType = response.headers.get('content-type') ?? ''
  if (!isJsonContentType(contentType)) {
    await cancelBodyQuietly(response.body)
    throw new ArtemisProtocolError(`${endpoint} returned an unexpected content type`, { code: 'unexpected-content-type' })
  }
  const declaredText = response.headers.get('content-length')
  if (declaredText !== null) {
    let declared
    try {
      declared = parseDecimalContentLength(declaredText)
    } catch {
      await cancelBodyQuietly(response.body)
      throw new ArtemisProtocolError(`${endpoint} returned an invalid Content-Length`, { code: 'invalid-evidence' })
    }
    if (declared > maxBytes) {
      await cancelBodyQuietly(response.body)
      throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
    }
  }
  if (!response.body) throw new ArtemisProtocolError(`${endpoint} returned an empty response body`, { code: 'invalid-evidence' })
  let reader
  try {
    reader = response.body.getReader()
  } catch (error) {
    await cancelBodyQuietly(response.body)
    throw error
  }
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new ArtemisProtocolError(`${endpoint} returned an invalid JSON response body`, { code: 'invalid-json' })
      }
      size += value.byteLength
      if (size > maxBytes) {
        throw new ArtemisProtocolError(`${endpoint} response exceeded the configured size limit`, { code: 'response-too-large' })
      }
      chunks.push(value)
    }
  } catch (error) {
    try { await reader.cancel?.() } catch {}
    throw error
  } finally {
    try { reader.releaseLock?.() } catch {}
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (cause) {
    throw new ArtemisProtocolError(`${endpoint} returned invalid JSON`, { code: 'invalid-json', cause })
  }
}

async function getJson(client, endpoint) {
  if (!client || typeof client.fetchImpl !== 'function' || !(client.baseUrl instanceof URL)) {
    throw new TypeError('A configured ARTEMIS HTTP client is required')
  }
  const maxBytes = Number.isInteger(client.maxJsonBytes) && client.maxJsonBytes > 0 ? client.maxJsonBytes : 1_048_576
  const timeoutMs = Number.isInteger(client.timeoutMs) && client.timeoutMs > 0 ? client.timeoutMs : 2_000
  let response
  try {
    response = await client.fetchImpl(new URL(endpoint, client.baseUrl), {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    })
  } catch (cause) {
    throw new ArtemisProtocolError(`ARTEMIS request failed for ${endpoint}`, { code: 'unavailable', cause })
  }
  if (!response.ok) {
    const code = response.status === 404 ? 'not-found' : 'http-error'
    await cancelBodyQuietly(response.body)
    throw new ArtemisProtocolError(`ARTEMIS returned HTTP ${response.status} for ${endpoint}`, { code })
  }
  return readJsonWithinLimit(response, endpoint, maxBytes)
}

export async function getTaskStatus(client) {
  const payload = expectObject(await getJson(client, '/api/status'), '/api/status')
  const rawStatus = boundedOptionalString(payload.status, 32, 'status')
  if (!rawStatus) throw new ArtemisProtocolError('/api/status omitted task status', { code: 'invalid-evidence' })
  const normalizedStatus = rawStatus.toLowerCase()
  return Object.freeze({
    status: TASK_STATES.has(normalizedStatus) ? normalizedStatus : 'unknown',
    goal: boundedOptionalString(payload.goal, MAX_GOAL_CHARS, 'goal'),
    sessionId: normalizeIdentifier(payload.session_id, 'session_id'),
    queueCount: arrayCount(payload.queue, 'queue'),
    activeCount: arrayCount(payload.active_tasks, 'active_tasks'),
    backgroundCount: arrayCount(payload.background_tasks, 'background_tasks'),
  })
}

function normalizeAction(value) {
  if (typeof value === 'string') return boundedOptionalString(value, MAX_ACTION_CHARS, 'action_taken')
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  for (const key of ['action', 'action_name', 'name', 'type', 'tool']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, MAX_ACTION_CHARS)
  }
  return null
}

function normalizeTrace(value) {
  const trace = expectObject(value, 'generic_tools trace')
  return Object.freeze({
    name: boundedOptionalString(trace.name, MAX_TRACE_NAME_CHARS, 'trace.name') ?? 'trace',
    type: boundedOptionalString(trace.type, MAX_TRACE_TYPE_CHARS, 'trace.type'),
    status: boundedOptionalString(trace.status, MAX_TRACE_STATUS_CHARS, 'trace.status'),
  })
}

function normalizeStep(value) {
  const step = expectObject(value, 'step')
  const number = step.step_number
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new ArtemisProtocolError('step.step_number must be a non-negative safe integer', { code: 'invalid-evidence' })
  }
  const stepNumber = number
  const rawTraces = step.generic_tools ?? []
  if (!Array.isArray(rawTraces)) {
    throw new ArtemisProtocolError('step.generic_tools must be an array', { code: 'invalid-evidence' })
  }
  const traces = rawTraces.slice(-MAX_TRACES).map(normalizeTrace)
  return Object.freeze({
    stepNumber,
    action: normalizeAction(step.action_taken),
    traceCount: rawTraces.length,
    traces: Object.freeze(traces),
  })
}

async function getRawSessionSteps(client, sessionId) {
  if (!IDENTIFIER_PATTERN.test(sessionId)) throw new TypeError('sessionId must be a validated ARTEMIS session id')
  let payload
  try {
    payload = await getJson(client, `/api/sessions/${encodeURIComponent(sessionId)}/steps`)
  } catch (error) {
    if (error instanceof ArtemisProtocolError && error.code === 'not-found') return Object.freeze([])
    throw error
  }
  if (!Array.isArray(payload)) throw new ArtemisProtocolError('ARTEMIS steps response must be an array', { code: 'invalid-evidence' })
  return Object.freeze(payload)
}

export async function getSessionSteps(client, sessionId) {
  const payload = await getRawSessionSteps(client, sessionId)
  return Object.freeze(payload.map(normalizeStep))
}

function selectLatestByStepNumber(values, normalize) {
  if (values.length === 0) return null
  let latest = values[0]
  let latestNormalized = normalize(latest)
  let latestIndex = 0
  for (let index = 1; index < values.length; index += 1) {
    const candidate = values[index]
    const candidateNormalized = normalize(candidate)
    const currentNumber = latestNormalized.stepNumber
    const candidateNumber = candidateNormalized.stepNumber
    if ((candidateNumber !== null && (currentNumber === null || candidateNumber > currentNumber)) || (candidateNumber === currentNumber && index > latestIndex)) {
      latest = candidate
      latestNormalized = candidateNormalized
      latestIndex = index
    }
  }
  return { raw: latest, normalized: latestNormalized }
}

function selectLatestStep(steps) {
  const selected = selectLatestByStepNumber(steps, (step) => step)
  return selected?.normalized ?? null
}

export async function buildEvidence(client) {
  const task = await getTaskStatus(client)
  const rawSteps = task.sessionId ? await getRawSessionSteps(client, task.sessionId) : []
  const selected = selectLatestByStepNumber(rawSteps, normalizeStep)
  return Object.freeze({
    version: DSH_ARTEMIS_PROTOCOL_VERSION,
    task,
    latestStep: selected?.normalized ?? null,
  })
}

function sanitizeTraceTree(value) {
  if (!Array.isArray(value)) throw new ArtemisProtocolError('ARTEMIS trace tree must be an array', { code: 'invalid-evidence' })
  let nodeCount = 0
  let truncated = false
  function walk(nodes, depth) {
    const output = []
    for (let index = 0; index < nodes.length; index += 1) {
      if (output.length >= MAX_TRACE_CHILDREN || nodeCount >= MAX_TRACE_TREE_NODES) {
        truncated = true
        break
      }
      const trace = expectObject(nodes[index], 'trace tree node')
      const rawChildren = trace.children ?? []
      if (!Array.isArray(rawChildren)) throw new ArtemisProtocolError('trace.children must be an array', { code: 'invalid-evidence' })
      nodeCount += 1
      let children = Object.freeze([])
      if (rawChildren.length > 0) {
        if (depth >= MAX_TRACE_TREE_DEPTH) truncated = true
        else children = walk(rawChildren, depth + 1)
      }
      output.push(Object.freeze({
        name: boundedOptionalString(trace.name, MAX_TRACE_NAME_CHARS, 'trace.name') ?? 'trace',
        type: boundedOptionalString(trace.type, MAX_TRACE_TYPE_CHARS, 'trace.type'),
        status: boundedOptionalString(trace.status, MAX_TRACE_STATUS_CHARS, 'trace.status'),
        children,
      }))
    }
    return Object.freeze(output)
  }
  const traceTree = walk(value, 1)
  return Object.freeze({ traceTree, nodeCount, truncated })
}

export async function buildTraceEvidence(client) {
  const task = await getTaskStatus(client)
  if (!task.sessionId) {
    return Object.freeze({ version: DSH_ARTEMIS_PROTOCOL_VERSION, step: null, truncated: false })
  }
  const rawSteps = await getRawSessionSteps(client, task.sessionId)
  const selected = selectLatestByStepNumber(rawSteps, normalizeStep)
  if (!selected) return Object.freeze({ version: DSH_ARTEMIS_PROTOCOL_VERSION, step: null, truncated: false })
  const step = expectObject(selected.raw, 'step')
  const stepId = normalizeIdentifier(step.step_id, 'step_id')
  if (!stepId) throw new ArtemisProtocolError('Latest ARTEMIS step omitted step_id', { code: 'invalid-evidence' })
  const rawTraceTree = await getJson(client, `/api/steps/${encodeURIComponent(stepId)}/traces`)
  const sanitized = sanitizeTraceTree(rawTraceTree)
  return Object.freeze({
    version: DSH_ARTEMIS_PROTOCOL_VERSION,
    step: Object.freeze({
      stepNumber: selected.normalized.stepNumber,
      action: selected.normalized.action,
      nodeCount: sanitized.nodeCount,
      traceTree: sanitized.traceTree,
    }),
    truncated: sanitized.truncated,
  })
}

function writeJson(res, status, value, { head = false, extraHeaders = {} } = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  })
  if (head) res.end()
  else res.end(body)
}

function rejectUntrustedRequest(req, res, requestRejection) {
  if (typeof requestRejection !== 'function') return false
  const rejection = requestRejection(req)
  if (rejection === undefined) return false
  res.statusCode = rejection
  res.setHeader('cache-control', 'no-store')
  res.end()
  return true
}

function mapError(error, noun = 'task evidence') {
  if (error instanceof ArtemisProtocolError) {
    if (error.code === 'unavailable') {
      return { status: 503, body: { error: { code: 'artemis-unavailable', message: 'ARTEMIS is unavailable' } } }
    }
    return { status: 502, body: { error: { code: 'artemis-protocol-error', message: `ARTEMIS returned invalid ${noun}` } } }
  }
  return { status: 500, body: { error: { code: 'internal-error', message: 'Internal dsh-artemis error' } } }
}

function createReadOnlyJsonHandler(client, build, { requestRejection, queryMessage, errorNoun } = {}) {
  return async (req, res) => {
    if (rejectUntrustedRequest(req, res, requestRejection)) return
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeJson(res, 405, { error: { code: 'method-not-allowed', message: 'Method not allowed' } }, { extraHeaders: { allow: 'GET, HEAD' } })
      return
    }
    if (typeof req.url === 'string' && req.url.includes('?')) {
      writeJson(res, 400, { error: { code: 'invalid-request', message: queryMessage } }, { head: req.method === 'HEAD' })
      return
    }
    try {
      writeJson(res, 200, await build(client), { head: req.method === 'HEAD' })
    } catch (error) {
      const mapped = mapError(error, errorNoun)
      writeJson(res, mapped.status, mapped.body, { head: req.method === 'HEAD' })
    }
  }
}

export function createEvidenceHandler(client, { requestRejection } = {}) {
  return createReadOnlyJsonHandler(client, buildEvidence, {
    requestRejection,
    queryMessage: 'Evidence route accepts no query parameters',
    errorNoun: 'task evidence',
  })
}

export function createTraceEvidenceHandler(client, { requestRejection } = {}) {
  return createReadOnlyJsonHandler(client, buildTraceEvidence, {
    requestRejection,
    queryMessage: 'Trace evidence route accepts no query parameters',
    errorNoun: 'trace evidence',
  })
}

export function registerArtemisEvidenceRoute(ctx, client) {
  if (!ctx?.webServer || typeof ctx.webServer.register !== 'function') throw new TypeError('A Harness webServer service is required')
  if (!ctx?.connection || typeof ctx.connection.requestRejection !== 'function') throw new TypeError('A Harness connection trust service is required')
  const requestRejection = (req) => ctx.connection.requestRejection(req)
  const disposeEvidence = ctx.webServer.register({
    kind: 'exact',
    path: EVIDENCE_ROUTE,
    handler: createEvidenceHandler(client, { requestRejection }),
  })
  try {
    const disposeTraceEvidence = ctx.webServer.register({
      kind: 'exact',
      path: TRACE_EVIDENCE_ROUTE,
      handler: createTraceEvidenceHandler(client, { requestRejection }),
    })
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      let firstError
      try { disposeTraceEvidence?.() } catch (error) { firstError ??= error }
      try { disposeEvidence?.() } catch (error) { firstError ??= error }
      if (firstError) throw firstError
    }
  } catch (error) {
    try { disposeEvidence?.() } catch {}
    throw error
  }
}

export const evidenceLimits = Object.freeze({
  maxGoalChars: MAX_GOAL_CHARS,
  maxActionChars: MAX_ACTION_CHARS,
  maxTraces: MAX_TRACES,
  maxTraceTreeNodes: MAX_TRACE_TREE_NODES,
  maxTraceTreeDepth: MAX_TRACE_TREE_DEPTH,
  maxTraceChildren: MAX_TRACE_CHILDREN,
})
