# Testing strategy

## Layer 1 — repository checks

Fast checks run on every PR: repository invariants, JSON validity and lightweight tests with no Android/DeepSeek Harness dependency.

## Layer 2 — unit/contract tests

- shared protocol parsing/validation;
- ARTEMIS response normalization and browser-facing metadata bounds;
- Offline / Ready / Busy / No-device state derivation;
- error and reconnect behavior;
- bounded browser JSON/MIME/UTF-8 handling;
- npm package surface and browser bundle shape;
- immutable GitHub Action pins.

Use fixtures rather than requiring ARTEMIS or ADB for these tests.

## Layer 3 — fake ARTEMIS integration

Run against a small local HTTP server matching only routes verified from ARTEMIS source. This checks request paths, status handling, timeout/error behavior and verified multipart PNG frame handling without requiring Python, ADB, a model provider or an emulator.

The fake server is the default adapter integration target.

## Layer 4 — pinned DeepSeek Harness compatibility

`.github/workflows/harness-compat.yml` checks out DeepSeek Harness at the exact SHA in `docs/upstreams.md`, uses the pinned pnpm version and runs the real source CLI.

The job:

1. installs and builds the pinned DeepSeek Harness checkout;
2. rebuilds the browser client from `src/client` into a temporary directory;
3. requires that generated bundle to match checked-in `lib/client.js` byte-for-byte;
4. packs `dsh-artemis` only after that integrity check, so the tarball contains exactly the tested browser artifact;
5. validates package exports/surface and installs the tarball through `dsh plugin --profile web add ...` into an isolated `DSH_HOME`;
6. resolves the packaged rules-skill subpath and runs `dsh web --dump-config` to require the `dsh-artemis` Cordis row;
7. boots authenticated DeepSeek Harness Web and runs the real Chromium journey.

We do not vendor or submodule DeepSeek Harness into `dsh-artemis`.

The pinned DeepSeek Harness revision has a verified intermittent bootstrap race in `ClientModuleRegistry.registerWebCarrier`: the process can exit before publishing its authenticated URL with both `registerWebCarrier` and `cannot get property "webServer" without inject` in the startup log. The compatibility workflow permits exactly one second boot attempt only for that exact signature. Any other startup failure fails immediately, a repeated occurrence fails on the second attempt, and browser E2E itself is never retried.

## Layer 5 — real DeepSeek Harness browser E2E

The same compatibility job starts two deterministic loopback fixtures before booting the **real built `dsh web`** with the packaged plugin installed:

- fake ARTEMIS on `127.0.0.1:8000` for the Android/device boundary;
- fake DeepSeek on `127.0.0.1:8001` for one deterministic provider response.

DeepSeek Harness starts with its normal profile and no provider-specific environment override. After authentication and first-run onboarding, the browser test configures the already-mounted DeepSeek provider through public Host APIs: it updates the `llm-deepseek` settings namespace with the loopback `baseURL` and stores a fixed dummy `DEEPSEEK_API_KEY` through the public `credentials.set` Remote.

No external model endpoint, real credential or model billing is involved, and the credential value is never read back or logged.

The browser test creates a real Workspace and Session through public DeepSeek Harness RPC, then submits one short prompt through `session.prompt`. That prompt exists only to make the Session non-blank using the same public lifecycle as production. The local fake provider emits a minimal valid SSE completion and no tool call.

After `session.list` reports that exact Session as non-blank, the test reloads, opens the Session through the native Workspace browser, opens Android through the shipped right-sidebar guide entry, then verifies the native panel, setup/status state, device metadata, task/trace evidence, screenshot/live behavior and visual QA flows covered by the current feature set.

A screenshot is retained for three days only on browser-test failure. The raw DeepSeek Harness log containing the launch token is never uploaded. Local fake-provider credentials are fixed test data and grant no external access.

## Layer 6 — real ARTEMIS + Android smoke

A separate heavier workflow should eventually run one supported emulator/device path with real ARTEMIS. It should not gate every small PR initially because Android virtualization and ARTEMIS runtime/model dependencies are substantially heavier and may require credentials or infrastructure unavailable to ordinary PRs.

This smoke becomes important for releases and changes touching streaming, device control or trace integration.

## CI policy

GitHub Actions is the primary reproducible environment. Contributors should not be required to manually run installation/build/E2E steps that can be encoded in CI.
