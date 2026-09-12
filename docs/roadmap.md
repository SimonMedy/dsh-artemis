# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This file tracks execution status and exit criteria.

> A phase is `DONE` only when its exit criteria are satisfied on `main`. Work on a branch is `ACTIVE`, not complete.

Last updated: 2026-09-12

## Status

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Pinned upstreams, secure adapter, trust fence, package installation, MCP config and rules skill merged |
| 1 — minimal native panel | **DONE** | Native Android sidebar + deterministic real Harness/Chromium E2E merged through PR #15 |
| 1.5 — explicit screenshot observation | **DONE** | Bounded snapshot route, ephemeral preview, reproducible client build and real Harness/Chromium capture merged through PR #17 |
| 2 — live human screen | **ACTIVE** | Validated multi-frame Host transport + explicit Start/Stop viewer + bounded reconnect are under validation on `gpt/phase-2-live-viewer` |
| 3 — bounded device controls | **NEXT** | Verify exact upstream contracts for Back/Home/Recents/Rotate before exposing any action |
| 4 — tasks, traces & visual QA | **PLANNED** | Surface ARTEMIS task/trace evidence and explicit visual checkpoints |
| 5 — installation & agent experience | **PARTIAL** | MCP config + rules skill merged; setup/status UX remains |
| 6 — autonomous mobile computer-use | **PLANNED** | Build bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Keep supported revisions backed by reproducible CI evidence |

## Completed foundations

- ARTEMIS HTTP access defaults to explicit loopback and rejects arbitrary browser-selected upstreams.
- All browser-facing plugin routes cross the Harness connection trust fence before upstream access.
- Native Android right-sidebar UI uses Harness primitives/tokens rather than DOM injection or a parallel design system.
- Agent automation stays in ARTEMIS MCP; the plugin UI does not reimplement an agent/device automation engine.
- Real package installation, Cordis composition and Chromium journeys are tested against pinned Harness.
- Browser E2E uses public Harness Workspace/Session/settings/credentials lifecycle APIs and deterministic loopback fixtures.
- The pinned Harness `registerWebCarrier` startup race has one narrowly-scoped retry; browser functional failures are never retried.
- Client bundle generation is reproducible from `src/client` with the pinned Harness toolchain before packaging/E2E.

## Phase 1.5 — explicit screenshot observation

**Status: DONE — merged through PR #17**

Delivered:
- [x] Read exactly one validated ARTEMIS multipart PNG frame.
- [x] Bound multipart headers, frame size and time-to-first-frame.
- [x] Same-origin `GET /dsh-artemis/v1/snapshot` behind the Harness trust fence.
- [x] Browser-side independent content-type, size and PNG-signature checks.
- [x] Explicit **Capture screen** only; no automatic image polling.
- [x] Ephemeral Blob/Object URL with replacement/device-change/unmount cleanup.
- [x] Fake ARTEMIS + real packaged Harness/Chromium E2E exercises the full upstream→Host→browser path.
- [x] Image bytes/base64 stay out of logs.
- [x] No durable preview attachment or private Session handoff.

Model handoff remains intentionally gated:
- Do not persist preview screenshots merely to create an attachment id.
- Do not fabricate Session events, touch private stores, or re-base64 a stored image to force it through `session.prompt()`.
- Add model-facing screenshots only when Harness exposes a supported Session-owned image handoff.
- When such a seam exists, gate vision by `LlmModelInfo.inputModalities`; missing metadata remains unknown rather than assumed capable.

## Phase 2 — live human screen

**Status: ACTIVE**

Current batch:
- [x] Refactor snapshot/live onto one frame-validation pipeline.
- [x] Parse and validate every multipart PNG frame independently.
- [x] Add same-origin `GET /dsh-artemis/v1/live` behind the Harness trust fence.
- [x] Normalize the downstream multipart boundary rather than transparently proxying bytes.
- [x] Respect Node backpressure and abort upstream on browser disconnect.
- [x] Add explicit **Start live** / **Stop live** controls.
- [x] Disable snapshot capture while live is active.
- [x] Stop live when the active device/stream disappears.
- [x] Cap reconnect at four retries with bounded delays.
- [x] Keep live frames human-facing, ephemeral and outside model context.
- [x] Fake ARTEMIS can hold an open multipart stream and emit repeated frames.
- [x] Browser E2E scenario includes Start→visible 1×1 live frame→Stop→snapshot preserved.

Exit criteria before `DONE`:
- [ ] Repository CI green on the exact Phase 2 PR head.
- [ ] Generated client bundle, package install and Cordis composition green against pinned Harness.
- [ ] Real Harness + Chromium E2E proves Start/Stop live against the packaged generated bundle.
- [ ] No browser-direct ARTEMIS access, silent persistence or model-context insertion.

See [`live-viewer.md`](live-viewer.md) for transport/lifecycle guarantees.

## Phase 3 — bounded device controls

**Status: NEXT**

Candidate controls: Back, Home, Recents and Rotate.

Before implementation:
- [ ] Inspect and pin the exact ARTEMIS contract for each operation.
- [ ] Prefer existing narrow ARTEMIS APIs over ADB/shell access.
- [ ] Define per-action busy/error semantics and browser contract.
- [ ] Keep browser input unable to supply arbitrary command/path/URL values.

Exit criteria:
- [ ] Every exposed control maps to an inspected allow-listed upstream operation.
- [ ] Unit/contract tests cover errors and trust boundaries.
- [ ] Real Harness/Chromium E2E covers the visible controls.

## Phase 4 — tasks, traces and visual QA

**Status: PLANNED**

- Native current-task status and result/failure summary.
- Trace/replay entry points using supported ARTEMIS APIs.
- Reuse ARTEMIS evidence instead of creating a parallel screenshot archive.
- Keep visual verification at explicit bounded checkpoints.

## Phase 5 — installation and agent experience

**Status: PARTIAL**

Already merged:
- [x] Non-destructive ARTEMIS MCP config generator.
- [x] Native ARTEMIS rules-skill adapter.
- [x] Independent UI/MCP architecture.

Remaining:
- [ ] Explicit setup flow around the configured ARTEMIS root.
- [ ] Independent UI-daemon and MCP status presentation.
- [ ] Capability-aware vision affordances after a public Session image handoff exists.

## Phase 6 — autonomous mobile computer-use

**Status: PLANNED**

- Bounded implement→build→install→ARTEMIS→observe→verify loops.
- Deterministic tests first; real-device/visual checks where behavior requires them.
- Explicit retry/stop budgets and evidence boundaries.
- ARTEMIS MCP remains the action authority.

## Phase 7 — compatibility and polish

**Status: ONGOING**

- Keep Harness/ARTEMIS pins and supported revisions backed by CI evidence.
- Maintain light/dark/native Harness UI behavior.
- Add real ARTEMIS + emulator smoke where infrastructure permits.
- Review performance, privacy and screenshot retention before release expansion.
- Keep release/versioning independent of unpublished local state.

## Current critical path

```text
Phase 2 PR: generated bundle + packaged Harness + Chromium Start/Stop live
        ↓
merge Phase 2 and mark DONE
        ↓
inspect exact ARTEMIS Back/Home/Recents/Rotate contracts
        ↓
Phase 3 bounded controls
        ↓
tasks/traces + explicit visual QA checkpoints
        ↓
public Session-owned image handoff (when Harness exposes one)
        ↓
capability-driven model vision
```
