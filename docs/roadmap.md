# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This roadmap is the execution tracker: it should answer **what is done, what is active, what is next, and what blocks release**.

> **Status rule:** update this file whenever a PR changes a phase materially. A phase is only marked `DONE` when its exit criteria are satisfied on `main`; work that exists only in an open PR stays `ACTIVE`.

## Current project status

Last updated: 2026-09-11

| Phase | Status | What is already on `main` | Active / next gate |
| --- | --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Package/bootstrap, pinned upstreams, architecture/security/maintainability docs, Host trust fence, secure ARTEMIS HTTP adapter, overview route, real Harness package/install compatibility CI, ARTEMIS MCP config generator, native ARTEMIS rules skill, product vision | Keep upstream pins and compatibility evidence current |
| 1 — minimal native panel | **ACTIVE** | Host overview API and secure browser trust boundary are merged | PR #15: native Android sidebar panel + packaged browser bundle + real Harness/Chromium E2E. Merge only after the current full compatibility gate is green |
| 1.5 — explicit screenshot observation | **NEXT** | Architecture verified against pinned Harness/ARTEMIS: ARTEMIS can produce local screenshots; Harness exposes native image attachments and model image-capability metadata | Implement a bounded Host screenshot→Harness attachment bridge after Phase 1 merges |
| 2 — live human screen | **PLANNED** | ARTEMIS public multipart `device-live` stream contract verified | Add native live viewer only after the one-frame path is stable |
| 3 — bounded device controls | **PLANNED** | Security policy and narrow-operation requirement defined | Verify exact upstream contracts for Back/Home/Recents/Rotate before exposing anything |
| 4 — tasks, traces & visual QA | **PLANNED** | ARTEMIS task/trace MCP surface and screenshot evidence behavior inspected | Surface current task, trace evidence and bounded visual checkpoints |
| 5 — installation & agent experience | **PARTIAL** | MCP config generator + rules-skill adapter merged | Unify setup/status UX and add vision capability-aware affordances |
| 6 — autonomous mobile computer-use | **PLANNED** | Product loop and safety constraints documented | Implement bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Pinned Harness compatibility CI and docs-as-code exist | Broaden supported revisions/configurations only from tested evidence |

### Recently completed milestones

- Secure ARTEMIS loopback HTTP adapter with strict URL, redirect, content-type, timeout and body-size policies.
- Harness browser trust fence applied before every `dsh-artemis` browser route touches ARTEMIS.
- `GET|HEAD /dsh-artemis/v1/overview` with stable project-owned DTOs.
- Real package installation validated against the pinned Harness build/profile.
- Official ARTEMIS stdio MCP integration documented and generated through `dsh-artemis-mcp-config`.
- Upstream `mcp_server/rules.md` exposed as the native runtime skill `artemis-mobile-testing`.
- Product direction formalized as Android mobile computer-use / visual verification, not a replacement automation engine.
- Hybrid testing strategy prepared in PR #16: deterministic tests first; ARTEMIS + multimodal verification where real-device/adaptive/visual behavior matters.

### Current critical path

```text
PR #15 native panel
        ↓
full pinned Harness + Chromium E2E green
        ↓
merge Phase 1
        ↓
reconcile/merge PR #16 docs
        ↓
Phase 1.5: explicit screenshot observation
        ↓
native Harness image attachment + vision-capability gating
```

## Phase 0 — investigation and bootstrap

**Status: DONE**

Completed:
- verify Harness external plugin package/loading contract;
- verify right-sidebar registry/slot signatures;
- verify Host↔Client communication primitives;
- inventory ARTEMIS device/task/trace APIs and `artemis-client`;
- establish security/maintainability policies and compatibility pins;
- prove packaged installation/composition against pinned Harness;
- add ARTEMIS MCP config generator and native rules-skill adapter.

Exit criteria:
- [x] No guessed Harness/ARTEMIS API in merged runtime.
- [x] Pinned upstream SHAs documented.
- [x] Package can be installed into the pinned Harness profile in CI.
- [x] Browser routes cross the Harness trust fence before upstream access.
- [x] MCP and human UI planes are architecturally independent.

## Phase 1 — minimal native panel

**Status: ACTIVE — PR #15**

Merged prerequisites:
- [x] native Host overview route;
- [x] secure ARTEMIS status/device normalization;
- [x] browser trust fence;
- [x] external package/client loading contract.

Implemented in PR #15:
- [x] native Android right-sidebar page/guide entry;
- [x] ARTEMIS Connecting / Ready / Offline / Unavailable states;
- [x] active device serial/model/state/product;
- [x] Busy / Ready / No-device states;
- [x] stream connectivity indicator;
- [x] manual Refresh + bounded light polling;
- [x] native Harness primitives/tokens;
- [x] packaged lazy-CJS browser artifact;
- [x] fake-ARTEMIS Playwright journey against a real built Harness.

Still required before `DONE`:
- [ ] current pinned Harness + Chromium compatibility job green on the exact PR head;
- [ ] PR #15 merged to `main`.

Exit criteria:
- [ ] A clean profile can install the packed plugin.
- [ ] Harness Web can create/open a normal workspace/session.
- [ ] The Android right-sidebar entry is visible through native Harness registration.
- [ ] The panel renders Ready + known fake device state in Chromium.
- [ ] Refresh works and the panel occupies a usable sidebar surface.
- [ ] No private DOM injection, generic proxy, generic ADB RPC or trust-boundary regression.

## Phase 1.5 — explicit screenshot observation

**Status: NEXT — contracts verified, implementation not started**

Verified groundwork:
- [x] ARTEMIS `mobile_get_device_state("screenshot")` writes a local JPEG.
- [x] ARTEMIS trace inspection can expose before/after/action-overlay screenshots.
- [x] Harness exposes native `ctx.attachments` image admission/storage.
- [x] Harness model metadata exposes `inputModalities`, including `image`.
- [x] Vision gating can therefore be capability-driven, not model-name-driven.
- [x] Screenshot provenance can be constrained to a validated ARTEMIS project root.

Planned implementation:
- [ ] narrow Host operation for one explicit Android frame;
- [ ] resolve and confine the source path under the configured ARTEMIS root;
- [ ] strict file type/size/time limits before reading;
- [ ] delegate image normalization/limits/storage to Harness attachments;
- [ ] refreshable human screenshot preview;
- [ ] native session/model image-input path for vision-capable models;
- [ ] graceful fallback when image capability is absent or unknown;
- [ ] deterministic tests proving the human preview and admitted model observation refer to the same frame;
- [ ] no automatic persistence of every frame and no image/base64 logging.

Exit criteria:
- [ ] A user can explicitly capture one Android observation.
- [ ] The Host rejects arbitrary filesystem paths and unsupported/oversized images.
- [ ] A supported vision model receives the observation through native Harness image semantics.
- [ ] Non-vision models retain ARTEMIS MCP/hierarchy/trace workflows.

## Phase 2 — live human screen

**Status: PLANNED**

- proxy/consume the verified ARTEMIS multipart `device-live` stream through the cleanest supported Host path;
- preserve device aspect ratio and sidebar resize behavior;
- recover from dropped stream/restarts;
- keep continuous video human-facing; model observations remain discrete checkpoints.

Exit criteria:
- [ ] Live viewer is stable under reconnect/restart.
- [ ] No browser-direct ARTEMIS access is required.
- [ ] Live frames are not silently persisted or added to model context.

## Phase 3 — bounded device controls

**Status: PLANNED**

- Back, Home, Recents and Rotate;
- explicit busy/error feedback;
- narrow allow-listed Host/ARTEMIS actions only;
- no generic ADB/shell surface;
- no duplication of ARTEMIS agent automation semantics.

Exit criteria:
- [ ] Every exposed control maps to an inspected upstream contract.
- [ ] No arbitrary command/path/URL can be supplied by browser input.
- [ ] Controls are covered by unit/contract tests and relevant browser E2E.

## Phase 4 — tasks, traces and visual QA loop

**Status: PLANNED**

- current ARTEMIS task status;
- result/failure summary;
- trace/replay entry points using supported ARTEMIS APIs;
- action → screenshot observation → model evaluation → optional follow-up action;
- attach existing ARTEMIS evidence to task/trace summaries instead of creating a parallel screenshot archive.

Exit criteria:
- [ ] Human can inspect current task and trace evidence natively.
- [ ] Visual checks use explicit bounded checkpoints.
- [ ] Failure evidence is useful without leaking image/base64 content into logs.

## Phase 5 — installation and agent experience

**Status: PARTIAL**

Already merged:
- [x] non-destructive ARTEMIS MCP config generator;
- [x] native ARTEMIS rules-skill adapter;
- [x] independent UI/MCP architecture.

Remaining:
- [ ] one explicit setup flow around the configured ARTEMIS root;
- [ ] independent UI-daemon and MCP status presentation;
- [ ] capability-aware vision affordances;
- [ ] supported profile/setup documentation based on real compatibility tests.

Exit criteria:
- [ ] A new user can reach a working UI + MCP setup without hand-authoring fragile config.
- [ ] Setup never scans arbitrary filesystem locations or exposes secrets.

## Phase 6 — autonomous mobile computer-use workflows

**Status: PLANNED**

- “implement and visually verify” Android UI changes;
- reproducible bug-reproduction loop with screenshot + trace evidence;
- bounded regression journeys with explicit visual checkpoints;
- optional visual acceptance criteria supplied by the user/repository;
- retry/stop budgets to avoid unbounded agent/device loops;
- deterministic tests remain first-class and run before expensive real-device/vision checks where appropriate.

Exit criteria:
- [ ] Agent can close a bounded code→build→install→ARTEMIS→observe→verify loop.
- [ ] Evidence and stop conditions are explicit.
- [ ] ARTEMIS MCP remains the action authority.

## Phase 7 — compatibility and polish

**Status: ONGOING / LATE-STAGE FOCUS**

- light/dark theme and native Harness components/tokens;
- documented supported Harness/ARTEMIS/model revisions/capabilities;
- full integration smoke workflow with real ARTEMIS + Android emulator where CI infrastructure permits;
- performance, privacy and screenshot-retention review;
- release/versioning policy for a developer-preview upstream.

Exit criteria:
- [ ] Supported revisions are backed by reproducible CI evidence.
- [ ] Security/privacy expectations are documented and tested.
- [ ] Release process does not depend on unpublished local state.
