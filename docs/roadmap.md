# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This roadmap is the execution tracker: it should answer **what is done, what is active, what is next, and what blocks release**.

> **Status rule:** update this file whenever a PR changes a phase materially. A phase is only marked `DONE` when its exit criteria are satisfied on `main`. Experimental work on a preparation branch does not make a phase complete.

## Current project status

Last updated: 2026-09-12

| Phase | Status | What is already on `main` | Active / next gate |
| --- | --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Package/bootstrap, pinned upstreams, security/architecture/maintainability docs, secure ARTEMIS adapter, trust fence, overview route, MCP config generator, rules skill, compatibility CI | Keep pins and evidence current |
| 1 — minimal native panel | **DONE** | Native Android right-sidebar panel, packaged client bundle, Ready/Offline/Busy/device/stream state, refresh/polling, deterministic real-Harness Chromium E2E | Maintain compatibility evidence as the pinned Harness evolves |
| 1.5 — explicit screenshot observation | **NEXT** | ARTEMIS multipart screenshot contract, Harness attachment/model capability contracts and safe ephemeral snapshot design have been inspected | Implement the bounded ephemeral snapshot/preview path on a fresh branch from current `main`; do not persist orphan images or invent a private Session handoff |
| 2 — live human screen | **PLANNED** | ARTEMIS public multipart `device-live` stream contract verified | Add live viewer only after the explicit one-frame path is stable |
| 3 — bounded device controls | **PLANNED** | Security policy and narrow-operation requirement defined | Verify exact upstream contracts for Back/Home/Recents/Rotate |
| 4 — tasks, traces & visual QA | **PLANNED** | ARTEMIS task/trace MCP surface and screenshot evidence behavior inspected | Surface task/trace evidence and bounded visual checkpoints |
| 5 — installation & agent experience | **PARTIAL** | MCP config generator + rules-skill adapter merged | Unify setup/status UX and capability-aware affordances |
| 6 — autonomous mobile computer-use | **PLANNED** | Product loop, hybrid testing policy and safety constraints documented | Build bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Pinned Harness compatibility CI, real browser E2E and docs-as-code | Broaden supported revisions only from tested evidence |

### Recently completed milestones

- Secure ARTEMIS loopback HTTP adapter with strict URL, redirect, content-type, timeout and body-size policies.
- Harness browser trust fence applied before every `dsh-artemis` browser route touches ARTEMIS.
- `GET|HEAD /dsh-artemis/v1/overview` with stable project-owned DTOs.
- Real package installation validated against the pinned Harness build/profile.
- ARTEMIS stdio MCP configuration generation and native `artemis-mobile-testing` runtime skill.
- Native Android sidebar panel merged through PR #15 after repository CI and full pinned Harness + Chromium E2E passed on the exact head.
- Deterministic browser E2E uses public Harness Workspace/Session/settings/credentials APIs and loopback fake ARTEMIS/DeepSeek services; it does not mutate private stores or contact an external model endpoint.
- Hybrid testing strategy: deterministic tests first; ARTEMIS + multimodal verification where real-device, adaptive or visual behavior matters.

### Current critical path

```text
merge/reconcile PR #16 documentation
        ↓
Phase 1.5: bounded one-frame ARTEMIS snapshot
        ↓
manual human preview in native Android panel
        ↓
real Harness + Chromium snapshot E2E
        ↓
verify a public Session-owned image handoff before any model injection
        ↓
capability-driven vision integration when a supported seam exists
```

## Phase 0 — investigation and bootstrap

**Status: DONE**

Completed:
- [x] Verify Harness external plugin package/loading contract.
- [x] Verify right-sidebar registry/slot signatures and Host↔Client communication primitives.
- [x] Inventory ARTEMIS device/task/trace APIs and `artemis-client`.
- [x] Establish security/maintainability policies and upstream pins.
- [x] Prove packaged installation/composition against pinned Harness.
- [x] Add ARTEMIS MCP config generator and native rules-skill adapter.

Exit criteria:
- [x] No guessed Harness/ARTEMIS API in merged runtime.
- [x] Pinned upstream SHAs documented.
- [x] Package installs into the pinned Harness profile in CI.
- [x] Browser routes cross the Harness trust fence before upstream access.
- [x] MCP and human UI planes remain architecturally independent.

## Phase 1 — minimal native panel

**Status: DONE — merged through PR #15**

Delivered:
- [x] Native Android right-sidebar page/guide entry.
- [x] ARTEMIS Connecting / Ready / Offline / Unavailable states.
- [x] Active device serial/model/state/product.
- [x] Busy / Ready / No-device states and stream connectivity indicator.
- [x] Manual Refresh + bounded light polling.
- [x] Native Harness primitives/tokens and packaged lazy-CJS browser artifact.
- [x] Clean profile package installation and Cordis composition against pinned Harness.
- [x] Deterministic real Harness + Chromium journey using public Harness lifecycle APIs.
- [x] Android panel renders known fake ARTEMIS device state and Refresh works in Chromium.
- [x] No private DOM injection, generic proxy, generic ADB RPC or trust-boundary regression.

Compatibility note: the pinned Harness RC has a verified intermittent `ClientModuleRegistry.registerWebCarrier` startup race. CI permits one retry only for the exact known `webServer`/`registerWebCarrier` signature; functional browser failures are never retried.

## Phase 1.5 — explicit screenshot observation

**Status: NEXT — implementation preparation validated, not yet merged**

Verified groundwork:
- [x] ARTEMIS public `device-live` stream uses bounded multipart PNG frames with `Content-Length`.
- [x] ARTEMIS MCP/trace flows can produce screenshot evidence.
- [x] Harness exposes native image admission/storage and model `inputModalities` metadata.
- [x] The public Session prompt contract does **not** currently accept an existing attachment id as image input.
- [x] A durable plugin-created image without Session ownership can become orphan state; therefore preview must remain ephemeral until a supported lifecycle exists.

Next implementation batch:
- [ ] Port the safe snapshot work from the preparation branch onto a fresh branch from current `main` rather than replaying its experimental history.
- [ ] Host reads exactly one verified ARTEMIS PNG frame with strict boundary/header/type/size/time limits and cancels the upstream stream after the frame.
- [ ] Expose only same-origin `GET /dsh-artemis/v1/snapshot`, behind the Harness trust fence, with `no-store` and `nosniff`.
- [ ] Browser applies independent timeout/type/size/signature checks.
- [ ] Add explicit **Capture screen** preview to the native panel; no automatic image polling.
- [ ] Use an ephemeral Blob/Object URL and revoke it on replacement/unmount.
- [ ] Extend fake ARTEMIS and real Harness/Chromium E2E to exercise the full multipart→Host→browser path without route mocking.
- [ ] Make `lib/client.js` reproducibly generated with a pinned toolchain before expanding client functionality; do not rely on floating build dependencies.
- [ ] Keep image bytes/base64 out of logs.

Model handoff gate:
- [ ] Do not persist standalone screenshots through `ctx.attachments.saveImages()` merely for preview.
- [ ] Do not fabricate Session events, touch private Session stores or re-base64 a stored image to force it through `session.prompt()`.
- [ ] Only add model injection after a public Harness seam can atomically admit an existing image into a Session-owned prompt/lifecycle.
- [ ] When that seam exists, gate vision by `LlmModelInfo.inputModalities`: explicit `image` enables it; explicit modalities without `image` disable it; missing metadata remains unknown.

Exit criteria:
- [ ] A user can explicitly capture and inspect one Android frame in the native panel.
- [ ] Arbitrary upstream URLs/paths and unsupported/oversized frames are rejected.
- [ ] Browser/Host tests prove bounded behavior and Object URL cleanup.
- [ ] Full pinned Harness + Chromium E2E proves the real snapshot path.
- [ ] Any future model-facing observation uses a supported Session-owned Harness contract.

## Phase 2 — live human screen

**Status: PLANNED**

- Consume the verified ARTEMIS multipart `device-live` stream through the cleanest supported Host path.
- Preserve device aspect ratio and sidebar resize behavior.
- Recover from dropped streams/restarts.
- Keep continuous video human-facing; model observations remain discrete checkpoints.

Exit criteria:
- [ ] Live viewer is stable under reconnect/restart.
- [ ] No browser-direct ARTEMIS access is required.
- [ ] Live frames are not silently persisted or added to model context.

## Phase 3 — bounded device controls

**Status: PLANNED**

- Back, Home, Recents and Rotate.
- Explicit busy/error feedback.
- Narrow allow-listed Host/ARTEMIS actions only.
- No generic ADB/shell surface and no duplicate ARTEMIS agent automation engine.

Exit criteria:
- [ ] Every exposed control maps to an inspected upstream contract.
- [ ] No arbitrary command/path/URL can be supplied by browser input.
- [ ] Relevant unit/contract tests and browser E2E cover the controls.

## Phase 4 — tasks, traces and visual QA loop

**Status: PLANNED**

- Current ARTEMIS task status and result/failure summary.
- Trace/replay entry points using supported ARTEMIS APIs.
- Action → screenshot observation → model evaluation → optional bounded follow-up action.
- Reuse existing ARTEMIS evidence instead of building a parallel screenshot archive.

Exit criteria:
- [ ] Human can inspect current task and trace evidence natively.
- [ ] Visual checks use explicit bounded checkpoints.
- [ ] Failure evidence is useful without leaking image/base64 content into logs.

## Phase 5 — installation and agent experience

**Status: PARTIAL**

Already merged:
- [x] Non-destructive ARTEMIS MCP config generator.
- [x] Native ARTEMIS rules-skill adapter.
- [x] Independent UI/MCP architecture.

Remaining:
- [ ] One explicit setup flow around the configured ARTEMIS root.
- [ ] Independent UI-daemon and MCP status presentation.
- [ ] Capability-aware vision affordances.
- [ ] Supported profile/setup documentation based on real compatibility tests.

Exit criteria:
- [ ] A new user can reach a working UI + MCP setup without hand-authoring fragile config.
- [ ] Setup never scans arbitrary filesystem locations or exposes secrets.

## Phase 6 — autonomous mobile computer-use workflows

**Status: PLANNED**

- “Implement and visually verify” Android UI changes.
- Reproducible bug-reproduction loop with screenshot + trace evidence.
- Bounded regression journeys with explicit visual checkpoints.
- Optional visual acceptance criteria supplied by the user/repository.
- Retry/stop budgets to avoid unbounded agent/device loops.
- Deterministic tests remain first-class and run before expensive real-device/vision checks where appropriate.

Exit criteria:
- [ ] Agent can close a bounded code→build→install→ARTEMIS→observe→verify loop.
- [ ] Evidence and stop conditions are explicit.
- [ ] ARTEMIS MCP remains the action authority.

## Phase 7 — compatibility and polish

**Status: ONGOING / LATE-STAGE FOCUS**

- Light/dark theme and native Harness components/tokens.
- Document supported Harness/ARTEMIS/model revisions/capabilities.
- Full integration smoke workflow with real ARTEMIS + Android emulator where CI infrastructure permits.
- Performance, privacy and screenshot-retention review.
- Release/versioning policy for a developer-preview upstream.

Exit criteria:
- [ ] Supported revisions are backed by reproducible CI evidence.
- [ ] Security/privacy expectations are documented and tested.
- [ ] Release process does not depend on unpublished local state.
