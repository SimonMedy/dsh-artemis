# Ephemeral visual QA checkpoint

Phase 4 adds an explicit human-facing visual QA checkpoint without creating a new screenshot archive or model-facing image channel.

## Behavior

**Capture checkpoint** concurrently requests the existing bounded task evidence and the existing validated PNG snapshot. The browser then holds one in-memory checkpoint containing:
- an ephemeral Blob/Object URL for the validated PNG;
- task status, bounded goal and queue/active/background counts;
- latest step number/action/trace count when available;
- a browser-local capture timestamp.

The checkpoint deliberately drops the ARTEMIS session id and all trace details. Replacing the checkpoint revokes the previous Object URL, and unmounting the panel revokes the current one.

## Privacy and lifecycle

The checkpoint is:
- explicit rather than automatic;
- same-origin through the already-trusted snapshot/evidence routes;
- browser-memory-only;
- never uploaded or persisted by `dsh-artemis`;
- never turned into a Harness attachment;
- never inserted into model context;
- never treated as replay evidence.

A page reload or panel teardown loses the checkpoint by design. Durable visual evidence remains blocked until a retention/lifecycle policy and supported Harness Session-owned image handoff exist.
