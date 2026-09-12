import assert from 'node:assert/strict'
import test from 'node:test'
import { captureVisualCheckpoint, summarizeCheckpointEvidence } from '../src/client/visual-qa-data.mjs'

const evidence = Object.freeze({
  version: 1,
  task: Object.freeze({ status: 'running', goal: 'Verify checkout', sessionId: 'session-secret-id', queueCount: 2, activeCount: 1, backgroundCount: 0 }),
  latestStep: Object.freeze({ stepNumber: 7, action: 'tap', traceCount: 3, traces: Object.freeze([]) }),
})

test('visual checkpoint summary intentionally drops ARTEMIS session and trace details', () => {
  const summary = summarizeCheckpointEvidence(evidence)
  assert.deepEqual(summary, {
    task: { status: 'running', goal: 'Verify checkout', queueCount: 2, activeCount: 1, backgroundCount: 0 },
    latestStep: { stepNumber: 7, action: 'tap', traceCount: 3 },
  })
  assert.doesNotMatch(JSON.stringify(summary), /session-secret-id|traces/)
})

test('visual checkpoint captures evidence and snapshot concurrently and returns revocable ephemeral state', async () => {
  const calls = []
  let revoked = 0
  const snapshot = { mediaType: 'image/png', data: new Uint8Array([137, 80, 78, 71]), bytes: 4 }
  const checkpoint = await captureVisualCheckpoint({
    fetchEvidenceImpl: async () => { calls.push('evidence'); return evidence },
    fetchSnapshotImpl: async () => { calls.push('snapshot'); return snapshot },
    createObjectUrlImpl: (value) => { assert.equal(value, snapshot); return { url: 'blob:qa-checkpoint', revoke() { revoked += 1 } } },
    nowImpl: () => Date.UTC(2026, 8, 12, 16, 30, 0),
  })
  assert.deepEqual(calls.sort(), ['evidence', 'snapshot'])
  assert.equal(checkpoint.imageUrl, 'blob:qa-checkpoint')
  assert.equal(checkpoint.capturedAt, '2026-09-12T16:30:00.000Z')
  assert.equal(checkpoint.task.goal, 'Verify checkout')
  assert.equal(checkpoint.latestStep.stepNumber, 7)
  checkpoint.revoke()
  assert.equal(revoked, 1)
})

test('visual checkpoint revokes a newly created URL when post-capture metadata construction fails', async () => {
  let revoked = 0
  await assert.rejects(captureVisualCheckpoint({
    fetchEvidenceImpl: async () => evidence,
    fetchSnapshotImpl: async () => ({ mediaType: 'image/png', data: new Uint8Array([137]), bytes: 1 }),
    createObjectUrlImpl: () => ({ url: 'blob:temporary', revoke() { revoked += 1 } }),
    nowImpl: () => Number.NaN,
  }), /invalid timestamp/)
  assert.equal(revoked, 1)
})
