import assert from 'node:assert/strict'
import test from 'node:test'
import { evidenceEndpoint, fetchEvidence, parseEvidence } from '../src/client/evidence-data.mjs'

const locationLike = { protocol: 'http:', origin: 'http://127.0.0.1:3080' }
const fixture = {
  version: 1,
  task: { status: 'running', goal: 'Verify Android task evidence', sessionId: 'session-e2e', queueCount: 1, activeCount: 1, backgroundCount: 0 },
  latestStep: { stepNumber: 1, action: 'press_key', traceCount: 1, traces: [{ name: 'press_key', type: 'tool', status: 'success' }] },
}

test('evidence endpoint is same-origin and Web-only', () => {
  assert.equal(evidenceEndpoint(locationLike), 'http://127.0.0.1:3080/dsh-artemis/v1/evidence')
  assert.equal(evidenceEndpoint({ protocol: 'file:', origin: 'null' }), null)
})

test('evidence parser accepts only the bounded project DTO', () => {
  assert.deepEqual(parseEvidence(fixture), fixture)
  assert.throws(() => parseEvidence({ ...fixture, task: { ...fixture.task, queueCount: -1 } }), /non-negative integer/)
  assert.throws(() => parseEvidence({ ...fixture, latestStep: { ...fixture.latestStep, traces: Array.from({ length: 9 }, () => fixture.latestStep.traces[0]) } }), /invalid/)
  assert.throws(() => parseEvidence({ ...fixture, task: { ...fixture.task, goal: 'x'.repeat(513) } }), /invalid/)
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
