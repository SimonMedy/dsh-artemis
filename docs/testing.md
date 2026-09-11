# Testing strategy

## Layer 1 — repository checks

Fast checks run on every PR: repository invariants, JSON validity and lightweight tests with no Android/Harness dependency.

## Layer 2 — unit/contract tests

Once implementation starts:

- shared DTO parsing/validation;
- ARTEMIS response normalization;
- state-machine behavior for Offline / Booting / Ready / Busy;
- error and reconnect behavior;
- host command mapping.

Use fixtures rather than requiring ARTEMIS or ADB for these tests.

## Layer 3 — ARTEMIS adapter integration

Run against a small fake HTTP server matching verified ARTEMIS routes. This checks request paths, status handling, MJPEG metadata where applicable, timeouts and malformed responses without booting Android.

## Layer 4 — Harness compatibility integration

CI should check out the pinned DeepSeek Harness SHA and verify that the plugin builds/loads against the actual current plugin interfaces. We will add this only after the package contract is verified rather than guessing a build command.

## Layer 5 — browser E2E

For UI milestones, use Playwright in GitHub Actions against Harness with the plugin enabled and a fake ARTEMIS service. Cover sidebar tab creation, resize, offline/ready transitions, refresh/reconnect and screen preview.

## Layer 6 — real Android smoke

A real emulator/ARTEMIS smoke test is desirable but should not gate every PR initially because Android virtualization and ARTEMIS model/runtime dependencies are heavier. Add a dedicated workflow when the MVP is stable. It should validate one supported emulator/device path and publish traces/screenshots on failure.

## CI policy

GitHub Actions is the primary reproducible environment. Do not require the user to manually run build/test steps that can be encoded in CI.
