# Investigation log

## Verified so far

### DeepSeek Harness

- Repository default branch: `master`.
- Harness is TypeScript and developer-preview; compatibility must be pinned by SHA.
- The project has distinct host/client TypeScript configurations and a plugin-oriented Cordis architecture.
- The exact current plugin loading/build contract and right-sidebar registration signatures still need source-level verification at the pinned SHA before implementation.

### ARTEMIS

- Repository default branch: `main`.
- The current admin console exposes `GET /api/stream/device-live` as multipart MJPEG and `GET /api/stream/device-state` for stream/device state.
- Live frames are currently produced from ADB screenshot capture (`exec-out screencap -p`).
- This provides a concrete MVP path, but route stability and browser consumption from Harness still need validation.

## Open questions before Phase 1 implementation

1. What package/distribution shape does current Harness expect for an external Cordis plugin?
2. What are the exact current signatures for right-sidebar tab registration and `sidebar.right.pane.tab` rendering?
3. What are the exact Host↔Client primitives and lifecycle semantics in the pinned Harness revision?
4. Is direct browser access to ARTEMIS `localhost:8000` compatible with Harness CSP/origin/runtime topology?
5. Which ARTEMIS APIs are intended for external consumption for device, task and trace state versus admin-console internals?
6. Does `packages/artemis-client` provide a better stable boundary for any of these operations?
7. How should reconnect, multiple devices and ARTEMIS-not-running states be represented?

## Decision gate

Do not add framework-bound plugin source until questions 1–3 have concrete source references. Screen live transport is a separate decision gate after the Phase 1 static/refresh preview works.
