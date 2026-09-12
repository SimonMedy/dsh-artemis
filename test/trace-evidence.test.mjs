import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisHttpClient } from '../src/host/artemis-http.mjs'
import { buildTraceEvidence, createTraceEvidenceHandler, evidenceLimits } from '../src/host/artemis-evidence.mjs'
import { TRACE_EVIDENCE_ROUTE } from '../src/shared/protocol.mjs'

function jsonResponse(value, status = 200) {
  const body = JSON.stringify(value)
  return new Response(body, { status, headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) } })
}
function clientFor(routes, seen = []) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    fetchImpl: async (url) => {
      seen.push(url.pathname)
      const handler = routes.get(url.pathname)
      return handler ? jsonResponse(handler()) : jsonResponse({ error: 'not-found' }, 404)
    },
  })
}
async function serve(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address()
  try { await run(`http://127.0.0.1:${port}`) } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('trace evidence derives the latest step and strips ids, payloads, thinking and paths', async () => {
  const seen = []
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: 'session-e2e', queue: [], active_tasks: [], background_tasks: [] })],
    ['/api/sessions/session-e2e/steps', () => ([
      { step_id: 'step-1', step_number: 1, action_taken: { action: 'tap' }, generic_tools: [] },
      { step_id: 'step-2', step_number: 2, action_taken: { action: 'press_key', secret: 'action-secret' }, generic_tools: [{ name: 'press_key' }] },
    ])],
    ['/api/steps/step-2/traces', () => ([{
      trace_id: 'trace-root-secret-id',
      parent_trace_id: null,
      step_id: 'step-2',
      name: 'press_key',
      type: 'tool',
      status: 'success',
      payload: { secret: 'trace-payload-secret' },
      children: [{
        trace_id: 'trace-child-secret-id',
        parent_trace_id: 'trace-root-secret-id',
        name: 'device_observation',
        type: 'thinking',
        status: 'success',
        payload: { text: 'raw-thinking-secret', screenshot: 'file:///private/trace.png' },
        children: [],
      }],
    }])],
  ])
  const evidence = await buildTraceEvidence(clientFor(routes, seen))
  assert.deepEqual(seen, ['/api/status', '/api/sessions/session-e2e/steps', '/api/steps/step-2/traces'])
  assert.equal(evidence.version, 1)
  assert.equal(evidence.step.stepNumber, 2)
  assert.equal(evidence.step.action, 'press_key')
  assert.equal(evidence.step.nodeCount, 2)
  assert.equal(evidence.step.traceTree[0].name, 'press_key')
  assert.equal(evidence.step.traceTree[0].children[0].name, 'device_observation')
  assert.equal(evidence.truncated, false)
  assert.doesNotMatch(JSON.stringify(evidence), /trace-root-secret-id|trace-child-secret-id|step-2|trace-payload-secret|raw-thinking-secret|file:\/\/\/private/)
})

test('trace evidence bounds depth, children and total nodes', async () => {
  const tooManyChildren = Array.from({ length: evidenceLimits.maxTraceChildren + 3 }, (_, index) => ({ name: `child-${index}`, type: 'tool', status: 'done', children: [] }))
  let deep = { name: 'leaf', type: 'tool', status: 'done', children: tooManyChildren }
  for (let depth = 0; depth < evidenceLimits.maxTraceTreeDepth + 2; depth += 1) deep = { name: `depth-${depth}`, type: 'tool', status: 'done', children: [deep] }
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: 'session-bound', queue: [], active_tasks: [], background_tasks: [] })],
    ['/api/sessions/session-bound/steps', () => ([{ step_id: 'step-bound', step_number: 1, generic_tools: [{ name: 'tool' }] }])],
    ['/api/steps/step-bound/traces', () => ([deep])],
  ])
  const evidence = await buildTraceEvidence(clientFor(routes))
  assert.equal(evidence.truncated, true)
  assert.ok(evidence.step.nodeCount <= evidenceLimits.maxTraceTreeNodes)
  let cursor = evidence.step.traceTree[0]
  let depth = 1
  while (cursor?.children?.length) { cursor = cursor.children[0]; depth += 1 }
  assert.ok(depth <= evidenceLimits.maxTraceTreeDepth)
})

test('trace evidence rejects malformed server-derived step ids before trace interpolation', async () => {
  const seen = []
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: 'session-e2e', queue: [], active_tasks: [], background_tasks: [] })],
    ['/api/sessions/session-e2e/steps', () => ([{ step_id: '../private', step_number: 1, generic_tools: [] }])],
  ])
  await assert.rejects(buildTraceEvidence(clientFor(routes, seen)), /invalid step_id/)
  assert.deepEqual(seen, ['/api/status', '/api/sessions/session-e2e/steps'])
})

test('trace evidence route trusts Harness first and accepts no browser identifiers', async () => {
  let upstreamCalls = 0
  const client = new ArtemisHttpClient({ baseUrl: 'http://127.0.0.1:8000', fetchImpl: async () => { upstreamCalls += 1; throw new Error('private upstream detail') } })
  await serve(createTraceEvidenceHandler(client, { requestRejection: () => 403 }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${TRACE_EVIDENCE_ROUTE}`)
    assert.equal(response.status, 403)
    assert.equal(upstreamCalls, 0)
  })
  await serve(createTraceEvidenceHandler(client), async (baseUrl) => {
    const query = await fetch(`${baseUrl}${TRACE_EVIDENCE_ROUTE}?step_id=attacker`)
    assert.equal(query.status, 400)
    assert.equal(upstreamCalls, 0)
    const denied = await fetch(`${baseUrl}${TRACE_EVIDENCE_ROUTE}`, { method: 'POST' })
    assert.equal(denied.status, 405)
    assert.equal(upstreamCalls, 0)
    const failed = await fetch(`${baseUrl}${TRACE_EVIDENCE_ROUTE}`)
    assert.equal(failed.status, 503)
    assert.doesNotMatch(await failed.text(), /private upstream detail/)
  })
})
