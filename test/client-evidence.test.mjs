import assert from 'node:assert/strict'
import test from 'node:test'
import { evidenceEndpoint, fetchEvidence, fetchTraceEvidence, parseEvidence, parseTraceEvidence, traceEvidenceEndpoint } from '../src/client/evidence-data.mjs'

const locationLike = { protocol: 'http:', origin: 'http://127.0.0.1:3080' }
const fixture = {
  version: 1,
  task: { status: 'running', goal: 'Verify Android task evidence', sessionId: 'session-e2e', queueCount: 1, activeCount: 1, backgroundCount: 0 },
  latestStep: { stepNumber: 1, action: 'press_key', traceCount: 1, traces: [{ name: 'press_key', type: 'tool', status: 'success' }] },
}
const traceFixture = {
  version: 1,
  step: { stepNumber: 1, action: 'press_key', nodeCount: 2, traceTree: [{ name: 'press_key', type: 'tool', status: 'success', children: [{ name: 'device_observation', type: 'thinking', status: 'success', children: [] }] }] },
  truncated: false,
}

test('evidence endpoints are same-origin and Web-only', () => {
  assert.equal(evidenceEndpoint(locationLike), 'http://127.0.0.1:3080/dsh-artemis/v1/evidence')
  assert.equal(traceEvidenceEndpoint(locationLike), 'http://127.0.0.1:3080/dsh-artemis/v1/evidence/latest-traces')
  assert.equal(evidenceEndpoint({ protocol: 'file:', origin: 'null' }), null)
  assert.equal(traceEvidenceEndpoint({ protocol: 'file:', origin: 'null' }), null)
})

test('evidence parser accepts only the bounded project DTO', () => {
  assert.deepEqual(parseEvidence(fixture), fixture)
  assert.throws(() => parseEvidence({ ...fixture, task: { ...fixture.task, queueCount: -1 } }), /non-negative integer/)
  assert.throws(() => parseEvidence({ ...fixture, latestStep: { ...fixture.latestStep, traces: Array.from({ length: 9 }, () => fixture.latestStep.traces[0]) } }), /invalid/)
  assert.throws(() => parseEvidence({ ...fixture, task: { ...fixture.task, goal: 'x'.repeat(513) } }), /invalid/)
})

test('trace evidence parser independently bounds tree shape and node count', () => {
  assert.deepEqual(parseTraceEvidence(traceFixture), traceFixture)
  assert.throws(() => parseTraceEvidence({ ...traceFixture, step: { ...traceFixture.step, nodeCount: 3 } }), /does not match/)
  assert.throws(() => parseTraceEvidence({ ...traceFixture, step: { ...traceFixture.step, traceTree: [{ ...traceFixture.step.traceTree[0], children: Array.from({ length: 17 }, () => ({ name: 'x', type: null, status: null, children: [] })) }] } }), /too many children/)
})

test('evidence fetch uses same-origin no-store semantics', async () => {
  let seen = null
  const parsed = await fetchEvidence({
    locationLike,
    fetchImpl: async (url, init) => {
      seen = { url, init }
      return new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(seen.url, 'http://127.0.0.1:3080/dsh-artemis/v1/evidence')
  assert.equal(seen.init.method, 'GET')
  assert.equal(seen.init.credentials, 'same-origin')
  assert.equal(seen.init.cache, 'no-store')
  assert.equal(seen.init.redirect, 'error')
  assert.equal(seen.init.headers.accept, 'application/json')
  assert.equal(parsed.latestStep.traces[0].name, 'press_key')
})

test('trace evidence fetch is explicit same-origin no-store and returns only parsed metadata', async () => {
  let seen = null
  const parsed = await fetchTraceEvidence({
    locationLike,
    fetchImpl: async (url, init) => {
      seen = { url, init }
      return new Response(JSON.stringify({ ...traceFixture, ignoredSecret: 'must-not-survive-parser' }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(seen.url, 'http://127.0.0.1:3080/dsh-artemis/v1/evidence/latest-traces')
  assert.equal(seen.init.method, 'GET')
  assert.equal(seen.init.credentials, 'same-origin')
  assert.equal(seen.init.cache, 'no-store')
  assert.equal(seen.init.redirect, 'error')
  assert.equal(parsed.step.traceTree[0].children[0].name, 'device_observation')
  assert.doesNotMatch(JSON.stringify(parsed), /must-not-survive-parser/)
})


test('evidence HTTP rejection cancels the unread browser response body', async () => {
  let cancelled = false
  await assert.rejects(fetchEvidence({
    locationLike,
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      body: {
        cancel() {
          cancelled = true
          return Promise.reject(new Error('cancel failed'))
        },
      },
    }),
  }), /HTTP 503/)
  assert.equal(cancelled, true)
})
