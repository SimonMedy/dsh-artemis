import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { ArtemisHttpClient } from '../src/host/artemis-http.mjs'
import { buildEvidence, createEvidenceHandler, evidenceLimits } from '../src/host/artemis-evidence.mjs'
import { EVIDENCE_ROUTE } from '../src/shared/protocol.mjs'

function jsonResponse(value, status = 200) {
  const body = JSON.stringify(value)
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) },
  })
}

function evidenceClient(routes, { maxJsonBytes = 1_048_576 } = {}) {
  return new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    maxJsonBytes,
    fetchImpl: async (url) => {
      const handler = routes.get(url.pathname)
      if (!handler) return jsonResponse({ error: 'not-found' }, 404)
      return jsonResponse(handler())
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

test('evidence derives current session and exposes only bounded task/trace metadata', async () => {
  const longGoal = 'g'.repeat(evidenceLimits.maxGoalChars + 40)
  const routes = new Map([
    ['/api/status', () => ({
      status: 'running',
      goal: longGoal,
      session_id: 'session-e2e',
      queue: [{ id: 1 }],
      active_tasks: [{ secret: 'active-payload-must-not-leak' }],
      background_tasks: [{ id: 1 }, { id: 2 }],
      model_info: { secret: 'model-must-not-leak' },
    })],
    ['/api/sessions/session-e2e/steps', () => ([
      { step_number: 1, action_taken: { action: 'tap' }, generic_tools: [] },
      {
        step_number: 2,
        action_taken: { action: 'press_key', key: 'home', secret: 'action-secret' },
        pre_screenshot_bytes: 'must-not-leak',
        generic_tools: Array.from({ length: 10 }, (_, index) => ({
          name: `tool-${index}`,
          type: 'tool',
          status: index === 9 ? 'success' : 'done',
          payload: { secret: `payload-${index}` },
        })),
      },
    ])],
  ])

  const evidence = await buildEvidence(evidenceClient(routes))
  assert.equal(evidence.version, 1)
  assert.equal(evidence.task.status, 'running')
  assert.equal(evidence.task.goal.length, evidenceLimits.maxGoalChars)
  assert.equal(evidence.task.sessionId, 'session-e2e')
  assert.deepEqual({ queue: evidence.task.queueCount, active: evidence.task.activeCount, background: evidence.task.backgroundCount }, { queue: 1, active: 1, background: 2 })
  assert.equal(evidence.latestStep.stepNumber, 2)
  assert.equal(evidence.latestStep.action, 'press_key')
  assert.equal(evidence.latestStep.traceCount, 10)
  assert.equal(evidence.latestStep.traces.length, evidenceLimits.maxTraces)
  assert.equal(evidence.latestStep.traces.at(-1).name, 'tool-9')
  assert.equal(evidence.latestStep.traces.at(-1).status, 'success')
  const serialized = JSON.stringify(evidence)
  assert.doesNotMatch(serialized, /payload-9|must-not-leak|model-must-not-leak|action-secret/)
})

test('evidence tolerates a session with no recorded steps', async () => {
  const routes = new Map([
    ['/api/status', () => ({ status: 'idle', session_id: 'session-empty', queue: [], active_tasks: [], background_tasks: [] })],
  ])
  const evidence = await buildEvidence(evidenceClient(routes))
  assert.equal(evidence.task.status, 'idle')
  assert.equal(evidence.latestStep, null)
})

test('evidence rejects malformed upstream identifiers before interpolating a path', async () => {
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: '../etc/passwd', queue: [], active_tasks: [], background_tasks: [] })],
  ])
  await assert.rejects(buildEvidence(evidenceClient(routes)), /invalid session_id/)
})

test('evidence honors the configured bounded JSON budget', async () => {
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', goal: 'x'.repeat(512), queue: [], active_tasks: [], background_tasks: [] })],
  ])
  await assert.rejects(buildEvidence(evidenceClient(routes, { maxJsonBytes: 64 })), (error) => error.code === 'response-too-large')
})

test('evidence route trusts Harness first, accepts no browser identifiers and sanitizes errors', async () => {
  let upstreamCalls = 0
  const client = new ArtemisHttpClient({
    baseUrl: 'http://127.0.0.1:8000',
    fetchImpl: async () => { upstreamCalls += 1; throw new Error('private upstream detail') },
  })

  await serve(createEvidenceHandler(client, { requestRejection: () => 403 }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}${EVIDENCE_ROUTE}`)
    assert.equal(response.status, 403)
    assert.equal(upstreamCalls, 0)
  })

  await serve(createEvidenceHandler(client), async (baseUrl) => {
    const query = await fetch(`${baseUrl}${EVIDENCE_ROUTE}?session_id=attacker`)
    assert.equal(query.status, 400)
    assert.equal(upstreamCalls, 0)
    const denied = await fetch(`${baseUrl}${EVIDENCE_ROUTE}`, { method: 'POST' })
    assert.equal(denied.status, 405)
    assert.equal(upstreamCalls, 0)
    const failed = await fetch(`${baseUrl}${EVIDENCE_ROUTE}`)
    assert.equal(failed.status, 503)
    assert.doesNotMatch(await failed.text(), /private upstream detail/)
  })
})
