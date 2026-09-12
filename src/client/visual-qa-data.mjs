import { fetchEvidence } from './evidence-data.mjs'
import { createSnapshotObjectUrl, fetchSnapshot } from './snapshot.mjs'

function finiteTimestamp(nowImpl) {
  const value = nowImpl()
  if (!Number.isFinite(value) || value < 0) throw new Error('Checkpoint clock returned an invalid timestamp')
  return new Date(value).toISOString()
}

export function summarizeCheckpointEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || !evidence.task) throw new TypeError('Validated ARTEMIS evidence is required')
  const task = evidence.task
  const latestStep = evidence.latestStep
  return Object.freeze({
    task: Object.freeze({
      status: task.status,
      goal: task.goal,
      queueCount: task.queueCount,
      activeCount: task.activeCount,
      backgroundCount: task.backgroundCount,
    }),
    latestStep: latestStep
      ? Object.freeze({
          stepNumber: latestStep.stepNumber,
          action: latestStep.action,
          traceCount: latestStep.traceCount,
        })
      : null,
  })
}

export async function captureVisualCheckpoint({
  fetchEvidenceImpl = fetchEvidence,
  fetchSnapshotImpl = fetchSnapshot,
  createObjectUrlImpl = createSnapshotObjectUrl,
  nowImpl = Date.now,
} = {}) {
  if (typeof fetchEvidenceImpl !== 'function' || typeof fetchSnapshotImpl !== 'function' || typeof createObjectUrlImpl !== 'function' || typeof nowImpl !== 'function') {
    throw new TypeError('Visual checkpoint dependencies must be functions')
  }
  const [evidence, snapshot] = await Promise.all([fetchEvidenceImpl(), fetchSnapshotImpl()])
  const summary = summarizeCheckpointEvidence(evidence)
  const image = createObjectUrlImpl(snapshot)
  try {
    const capturedAt = finiteTimestamp(nowImpl)
    return Object.freeze({
      imageUrl: image.url,
      capturedAt,
      task: summary.task,
      latestStep: summary.latestStep,
      revoke: image.revoke,
    })
  } catch (error) {
    image.revoke()
    throw error
  }
}
