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
| 2 — live human screen | **DONE** | Bounded multi-frame transport, explicit Start/Stop viewer, reconnect budget and packaged Harness/Chromium E2E merged through PR #18 |
| 3 — bounded device controls | **BLOCKED** | Pinned ARTEMIS has canonical Back/Home/Recents actions only in a separate broad action/ADB surface; no narrow configured-MCP/Admin transport and no canonical Rotate contract |
| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded task evidence PR #19, bounded latest-trace drill-down PR #21, and ephemeral visual QA checkpoint PR #22 merged; replay and model-image handoff remain gated |
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

**Status: DONE — merged through PR #18**

Delivered:
- [x] Snapshot/live share one frame-validation pipeline.
- [x] Every multipart PNG frame is parsed and validated independently.
- [x] Same-origin `GET /dsh-artemis/v1/live` is behind the Harness trust fence.
- [x] The downstream multipart boundary is normalized instead of transparently proxying bytes.
- [x] Node backpressure is respected and upstream is aborted on browser disconnect.
- [x] Explicit **Start live** / **Stop live** controls.
- [x] Snapshot capture is disabled while live is active.
- [x] Live stops when the active device/stream disappears.
- [x] Reconnect is capped at four retries with bounded delays.
- [x] Live frames remain human-facing, ephemeral and outside model context.
- [x] Fake ARTEMIS holds an open multipart stream and emits repeated frames.
- [x] Real packaged Harness/Chromium E2E proves Start→visible frame→Stop→snapshot preserved.
- [x] Repository CI and Harness compatibility were green on the exact PR #18 head before merge.

See [`live-viewer.md`](live-viewer.md) for transport/lifecycle guarantees.

## Phase 3 — bounded device controls

**Status: BLOCKED — safe upstream contract required**

The pinned ARTEMIS audit found canonical `press_key` mappings for Back (`back`), Home (`home`) and Recents (`app_switch`), but those actions are not exposed by the configured `python -m mcp_server` surface. They live in a separate action/ADB surface with materially broader authority. The pinned Admin HTTP routers provide no narrow key-control endpoint, and the canonical action contract contains no Rotate operation.

We will not bypass that gap with generic ADB/shell, arbitrary key codes, a second broad agent-facing MCP server, natural-language `mobile_run_task` prompts, or private ARTEMIS internals.

See [`device-controls.md`](device-controls.md) for the audited contract, rejected shortcuts and unblock criteria.

Exit criteria remain:
- [ ] Every exposed control maps to an inspected allow-listed supported upstream operation.
- [ ] Browser input cannot supply arbitrary command/path/package/URL/keycode values.
- [ ] Unit/contract tests cover per-action errors and trust boundaries.
- [ ] Real Harness/Chromium E2E covers the visible controls.

## Phase 4 — tasks, traces and visual QA

**Status: PARTIAL — bounded evidence, latest-trace drill-down and ephemeral visual QA merged**

Delivered:
- [x] PR #19: same-origin read-only `/dsh-artemis/v1/evidence` behind Harness connection trust.
- [x] Server derives the active ARTEMIS session from `/api/status`; browser cannot provide session, step or trace identifiers.
- [x] Current task status/goal/counts and latest step action are bounded; task bodies, model metadata, action payloads, screenshots and arbitrary upstream JSON are excluded.
- [x] PR #21: explicit `/dsh-artemis/v1/evidence/latest-traces` drill-down derives the latest session/step server-side and returns only bounded `name`/`type`/`status`/`children` trees.
- [x] Latest-trace trees are capped at 64 nodes, depth 6, and 16 children per node; raw thinking, payloads, screenshots/paths, identifiers and LLM content are excluded.
- [x] PR #22: manual visual QA checkpoint orchestrates only the existing safe evidence + snapshot routes.
- [x] The checkpoint keeps only a validated PNG Blob/Object URL, local timestamp, bounded task summary and latest-step summary; session identifiers and detailed traces are dropped.
- [x] Checkpoint Object URLs are revoked on replacement and unmount; nothing is uploaded, archived, replayed, persisted or added to model context.
- [x] Deterministic fake ARTEMIS fixtures contain deliberate secrets so E2E proves they do not reach rendered evidence/checkpoints.
- [x] Real packaged Harness/Chromium E2E covers task evidence, latest trace structure, checkpoint capture, PNG dimensions, preview/live coexistence and secret non-disclosure.
- [x] Repository CI and the full pinned Harness install/build/package/Cordis/fake-ARTEMIS/Harness-Web/Chromium gate were green on the exact PR #22 head before merge.

Remaining Phase 4 gates:
- [ ] Keep replay separately policy-gated. The pinned ARTEMIS replay GET flow can call `_ensure_session_chunked(...)` and materialize chunks/files, so it is not a side-effect-free read-only surface.
- [ ] Add further evidence routes only when the upstream operation is confirmed read-only and side-effect-free.
- [ ] Keep model-facing image handoff gated until Harness exposes a supported public Session-owned image handoff; then gate vision by `LlmModelInfo.inputModalities`.

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

- Bounded implement→build→install→ARTEMIS→observe→verify→fix loops.
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
Phase 2 merged and DONE
        ↓
Phase 3 safe transport blocked on upstream narrow control contract
        ↓ (work can continue independently)
Phase 4 bounded task evidence + latest-trace tree + ephemeral visual QA merged
        ↓
Phase 5 setup/status UX (directly actionable)
        ↓
replay remains policy/side-effect gated; model image handoff remains upstream-gated
```
