# Testing strategy

## Layer 1 — repository checks

Fast checks run on every PR: repository invariants, JSON validity and lightweight tests with no Android/DeepSeek Harness dependency.

The repository invariants include immutable third-party Action pins and exact consistency between the documented DeepSeek Harness/ARTEMIS SHAs, compatibility workflow pins and the browser-client build pin.

## Layer 2 — unit/contract tests

- shared protocol parsing/validation;
- ARTEMIS response normalization and browser-facing metadata bounds;
- Offline / Ready / Busy / No-device state derivation;
- error and reconnect behavior;
- bounded browser JSON/MIME/UTF-8 handling;
- npm package surface and browser bundle shape;
- immutable GitHub Action and upstream compatibility pins.

Use fixtures rather than requiring ARTEMIS or ADB for these tests.

## Layer 3 — fake ARTEMIS integration

Run against a small local HTTP server matching only routes verified from ARTEMIS source. This checks request paths, status handling, timeout/error behavior and verified multipart PNG frame handling without requiring Python, ADB, a model provider or an emulator.

The fake server remains the default adapter integration target because it is deterministic and can deliberately carry malformed/secret data for privacy tests.

## Layer 4 — pinned DeepSeek Harness compatibility

`.github/workflows/harness-compat.yml` checks out DeepSeek Harness at the exact SHA in `docs/upstreams.md`, uses the pinned pnpm version and runs the real source CLI.

The job:
1. installs and builds the pinned DeepSeek Harness checkout;
2. rebuilds the browser client into a temporary directory;
3. requires byte-for-byte equality with checked-in `lib/client.js`;
4. packs `dsh-artemis` only after that integrity check;
5. installs the tarball through `dsh plugin --profile web add ...` into an isolated `DSH_HOME`;
6. resolves the packaged rules-skill subpath and verifies the composed Cordis tree;
7. boots authenticated DeepSeek Harness Web and runs the real Chromium journey.

We do not vendor or submodule DeepSeek Harness into `dsh-artemis`.

The pinned DeepSeek Harness revision has a verified intermittent `registerWebCarrier`/`webServer` bootstrap race. The workflow permits exactly one second boot attempt only for that exact signature. Browser functional E2E is never retried.

## Layer 5 — real DeepSeek Harness browser E2E

The compatibility job starts deterministic loopback fixtures before booting the **real built `dsh web`** with the packaged plugin installed:

- fake ARTEMIS on `127.0.0.1:8000` for deterministic Android/device behavior;
- fake DeepSeek on `127.0.0.1:8001` for one deterministic provider response.

DeepSeek Harness is configured only through public Host APIs. The browser test creates a real Workspace and Session through public RPC, submits one short prompt to make the Session non-blank, reloads through the native Workspace lifecycle, opens Android through the shipped right-sidebar entry, then verifies the panel, setup/status, device metadata, task/trace evidence, screenshot/live behavior and visual QA flows.

No external model endpoint, real credential or model billing is involved. A screenshot is retained for three days only on browser-test failure; the raw DeepSeek Harness startup log containing the launch token is never uploaded.

## Layer 6 — real pinned ARTEMIS daemon compatibility

`.github/workflows/artemis-compat.yml` checks out the exact ARTEMIS SHA in `docs/upstreams.md` and runs a real upstream daemon on a GitHub-hosted runner.

The job:
1. sets up Python 3.12 and pinned `uv`;
2. runs ARTEMIS' own dependency-source checker before installation;
3. installs the locked runtime with `uv sync --locked --no-dev`;
4. starts the real Admin daemon on literal loopback without a model/API key;
5. exercises `/api/status`, `/api/devices` and `/api/stream/device-state` through the real `dsh-artemis` product HTTP client, bounded panel adapter and overview builder.

This smoke is intentionally read-only: it does not launch tasks, capture/stream frames, issue ADB/device controls or call a model. It validates the real daemon/API contract while remaining runnable without dedicated Android infrastructure.

The test does **not** require the runner to expose zero devices. If ARTEMIS discovers devices, their browser-visible metadata must satisfy the same product bounds; a freshly started daemon must still be idle and must not start a live stream implicitly.

## Layer 7 — real ARTEMIS + Android device/emulator smoke

A separate heavier workflow should eventually run one supported emulator/device path with real ARTEMIS. Pinned ARTEMIS itself keeps its device/end-to-end suites off ordinary GitHub-hosted runners because they require dedicated infrastructure, so Layer 6 must not be described as device E2E.

This device smoke becomes important for releases and changes touching real streaming, device controls or trace behavior. It should use dedicated infrastructure with the narrowest necessary permissions and no unnecessary model credentials.

## CI policy

GitHub Actions is the primary reproducible environment. Contributors should not be required to manually run installation/build/E2E steps that can be encoded safely in CI.
