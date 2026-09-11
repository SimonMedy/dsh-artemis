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

## Layer 3 — fake ARTEMIS integration

Run against a small local HTTP server matching only routes we have verified from ARTEMIS source. This checks request paths, status handling, timeout/error behavior and later MJPEG handling without requiring Python, ADB, a model provider or an emulator.

The fake server is the default adapter integration test target.

## Layer 4 — pinned Harness compatibility

GitHub Actions checks out DeepSeek Harness into a sibling directory at the SHA in `docs/upstreams.md`. The plugin is then built/installed using the actual supported external-plugin mechanism. This job must fail when upstream types or installation semantics drift.

We do not vendor or submodule Harness into `dsh-artemis`.

## Layer 5 — browser E2E

Use Playwright against a real pinned Harness web instance with `dsh-artemis` enabled and fake ARTEMIS behind it. Cover:

- Android tab registration/opening;
- native sidebar layout and resize;
- Offline → Ready and error transitions;
- refresh/reconnect;
- screenshot/preview rendering;
- controls when introduced;
- no console/runtime errors.

Publish Playwright report, screenshots and traces on failure with short artifact retention.

## Layer 6 — real ARTEMIS + Android smoke

A separate heavier workflow should eventually run one supported emulator/device path with real ARTEMIS. It should not gate every small PR initially because Android virtualization and ARTEMIS runtime/model dependencies are substantially heavier and may require credentials or infrastructure unavailable to ordinary PRs.

This smoke becomes important for releases and changes touching streaming, ADB/device control or trace integration.

## CI policy

GitHub Actions is the primary reproducible environment. Contributors should not be required to manually run installation/build/E2E steps that can be encoded in CI.
