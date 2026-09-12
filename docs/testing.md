# Testing strategy

## Layer 1 — repository checks

Fast checks run on every PR: repository invariants, JSON validity and lightweight tests with no Android/Harness dependency.

## Layer 2 — unit/contract tests

- shared protocol parsing/validation;
- ARTEMIS response normalization;
- Offline / Ready / Busy / No-device state derivation;
- error and reconnect behavior;
- package/browser bundle shape.

Use fixtures rather than requiring ARTEMIS or ADB for these tests.

## Layer 3 — fake ARTEMIS integration

Run against a small local HTTP server matching only routes verified from ARTEMIS source. This checks request paths, status handling, timeout/error behavior and verified multipart PNG frame handling without requiring Python, ADB, a model provider or an emulator.

The fake server is the default adapter integration target.

## Layer 4 — pinned Harness compatibility

`.github/workflows/harness-compat.yml` checks out DeepSeek Harness at the exact SHA in `docs/upstreams.md`, uses the upstream pnpm version and runs the real source CLI.

The job:

1. installs and builds the pinned Harness checkout;
2. packs `dsh-artemis` into a tarball so publication `files`/exports are tested rather than workspace symlinks;
3. verifies the Harness lazy-CJS browser bundle is present in that tarball;
4. installs it through `dsh plugin --profile web add ...` into an isolated `DSH_HOME`;
5. runs `dsh web --dump-config` and requires the `dsh-artemis` Cordis row.

We do not vendor or submodule Harness into `dsh-artemis`.

## Layer 5 — real Harness browser E2E

The same compatibility job starts two deterministic loopback fixtures before booting the **real built `dsh web`** with the packaged plugin installed:

- fake ARTEMIS on `127.0.0.1:8000` for the Android/device boundary;
- fake DeepSeek on `127.0.0.1:8001` for one deterministic provider response.

Harness itself starts with its normal profile and no provider-specific environment overrides. After authentication and first-run onboarding, the browser test configures the already-mounted DeepSeek provider through the public Host APIs: it updates the `llm-deepseek` settings namespace with the loopback `baseURL` and stores a fixed dummy `DEEPSEEK_API_KEY` through the public `credentials.set` Remote. No external model endpoint, real credential or model billing is involved, and the credential value is never read back or logged.

The browser test creates a real Workspace and Session through the public Harness RPC transport, then submits one short prompt through `session.prompt`. That prompt exists only to make the Session non-blank using the same public lifecycle as production: pinned Harness intentionally hides Session header chrome (and therefore the right-sidebar expand button) while a Session is still blank. The local fake provider emits a minimal valid SSE completion and no tool call.

After `session.list` reports that exact Session as non-blank, the test reloads, opens the Session through the native Workspace browser, opens Android through the shipped right-sidebar guide entry, then verifies:

- the plugin browser bundle was loaded by the real Harness module table;
- the native Android page opens through the right-sidebar registry/slot path;
- ARTEMIS Ready, model, serial and stream state render from the fake Host boundary;
- the native Refresh button performs another successful status read;
- the panel occupies a usable sidebar surface.

A screenshot is retained for three days only on browser-test failure. The raw Harness log containing the launch token is never uploaded. Local fake-provider credentials are fixed test data and grant no external access.

## Layer 6 — real ARTEMIS + Android smoke

A separate heavier workflow should eventually run one supported emulator/device path with real ARTEMIS. It should not gate every small PR initially because Android virtualization and ARTEMIS runtime/model dependencies are substantially heavier and may require credentials or infrastructure unavailable to ordinary PRs.

This smoke becomes important for releases and changes touching streaming, ADB/device control or trace integration.

## CI policy

GitHub Actions is the primary reproducible environment. Contributors should not be required to manually run installation/build/E2E steps that can be encoded in CI.
