# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This file tracks execution status and exit criteria.

> A phase is `DONE` only when its exit criteria are satisfied on `main`. Work on a branch is `ACTIVE`, not complete.

Last updated: 2026-09-13

## Status

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Pinned upstreams, secure adapter, trust fence, package installation, MCP config and rules skill merged |
| 1 — minimal native panel | **DONE** | Native Android sidebar + deterministic real DeepSeek Harness/Chromium E2E merged through PR #15 |
| 1.5 — explicit screenshot observation | **DONE** | Bounded snapshot route, ephemeral preview, reproducible client build and real DeepSeek Harness/Chromium capture merged through PR #17 |
| 2 — live human screen | **DONE** | Bounded multi-frame transport, explicit Start/Stop viewer, reconnect budget and packaged DeepSeek Harness/Chromium E2E merged through PR #18 |
| 3 — bounded device controls | **BLOCKED** | Pinned ARTEMIS has canonical Back/Home/Recents only in a separate broad action/ADB surface; no narrow configured-MCP/Admin transport and no canonical Rotate contract |
| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded task evidence PR #19, latest-trace drill-down PR #21 and ephemeral visual QA checkpoint PR #22 merged; replay and model-image handoff remain gated |
| 5 — installation & agent experience | **PARTIAL** | MCP config + rules skill + truthful bounded setup/status UX PR #24 merged; automatic profile mutation and vision affordances remain gated |
| 6 — autonomous mobile computer-use | **PLANNED** | Build bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Security/release hardening through PR #34; real ARTEMIS smoke and remaining release/privacy polish stay open |

## Completed foundations

- Product ARTEMIS HTTP access is restricted to literal loopback (`127.0.0.1` / `::1`) and browser input cannot select an upstream.
- All browser-facing plugin routes cross the DeepSeek Harness connection trust fence before upstream access and receive an ephemeral/no-sniff response baseline.
- Native Android right-sidebar UI uses DeepSeek Harness primitives/tokens rather than DOM injection or a parallel design system.
- Agent automation stays in ARTEMIS MCP; the plugin UI does not reimplement an agent/device automation engine.
- Browser-visible ARTEMIS metadata and JSON bodies have explicit Host and browser-side bounds.
- Real npm package installation, Cordis composition and Chromium journeys are tested against pinned DeepSeek Harness.
- Browser E2E uses public DeepSeek Harness Workspace/Session/settings/credentials lifecycle APIs and deterministic loopback fixtures.
- The pinned DeepSeek Harness `registerWebCarrier` startup race has one narrowly-scoped retry; browser functional failures are never retried.
- Third-party GitHub Actions are pinned to immutable full commit SHAs and repository tests reject floating external Action revisions.
- The npm artifact surface is tested using npm's actual pack file set; tests, fixtures, workflows, scripts and examples are excluded from distribution.
- `lib/client.js` is generated from `src/client` with the pinned DeepSeek Harness toolchain, checked in, and compared byte-for-byte with a fresh build before package/E2E proceeds.

## Phase 1.5 — explicit screenshot observation

**Status: DONE — merged through PR #17**

Delivered:
- [x] Read exactly one validated ARTEMIS multipart PNG frame.
- [x] Bound multipart headers, frame size and time-to-first-frame.
- [x] Same-origin `GET /dsh-artemis/v1/snapshot` behind the DeepSeek Harness trust fence.
- [x] Browser-side independent content-type, size and PNG-signature checks.
- [x] Explicit **Capture screen** only; no automatic image polling.
- [x] Ephemeral Blob/Object URL with replacement/device-change/unmount cleanup.
- [x] Fake ARTEMIS + real packaged DeepSeek Harness/Chromium E2E exercises the full upstream→Host→browser path.
- [x] Image bytes/base64 stay out of logs.
- [x] No durable preview attachment or private Session handoff.

Model handoff remains intentionally gated:
- Do not persist preview screenshots merely to create an attachment id.
- Do not fabricate Session events, touch private stores, or re-base64 a stored image to force it through `session.prompt()`.
- Add model-facing screenshots only when DeepSeek Harness exposes a supported Session-owned image handoff.
- When such a seam exists, gate vision by `LlmModelInfo.inputModalities`; missing metadata remains unknown rather than assumed capable.

## Phase 2 — live human screen

**Status: DONE — merged through PR #18**

Delivered:
- [x] Snapshot/live share one frame-validation pipeline.
- [x] Every multipart PNG frame is parsed and validated independently.
- [x] Same-origin `GET /dsh-artemis/v1/live` is behind the DeepSeek Harness trust fence.
- [x] Downstream multipart boundaries are normalized instead of transparently proxying upstream bytes.
- [x] Node backpressure is respected and upstream is aborted on browser disconnect.
- [x] Explicit **Start live** / **Stop live** controls.
- [x] Snapshot capture is disabled while live is active.
- [x] Live stops when the active device/stream disappears.
- [x] Reconnect is capped at four retries with bounded delays.
- [x] Live frames remain human-facing, ephemeral and outside model context.
- [x] Real packaged DeepSeek Harness/Chromium E2E proves Start→visible frame→Stop→snapshot preserved.

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
- [ ] Real DeepSeek Harness/Chromium E2E covers the visible controls.

## Phase 4 — tasks, traces and visual QA

**Status: PARTIAL — bounded evidence, latest-trace drill-down and ephemeral visual QA merged**

Delivered:
- [x] PR #19: same-origin read-only `/dsh-artemis/v1/evidence` behind DeepSeek Harness connection trust.
- [x] Server derives the active ARTEMIS session from `/api/status`; browser cannot provide session, step or trace identifiers.
- [x] Current task status/goal/counts and latest step action are bounded; task bodies, model metadata, action payloads, screenshots and arbitrary upstream JSON are excluded.
- [x] PR #21: `/dsh-artemis/v1/evidence/latest-traces` derives the latest session/step server-side and returns only bounded `name`/`type`/`status`/`children` trees.
- [x] Latest-trace trees are capped at 64 nodes, depth 6 and 16 children per node; raw thinking, payloads, screenshots/paths, identifiers and LLM content are excluded.
- [x] PR #22: manual visual QA checkpoint uses only the existing safe evidence + snapshot routes.
- [x] Checkpoints keep a validated PNG Blob/Object URL, local timestamp and bounded summaries; nothing is uploaded, archived, replayed, persisted or added to model context.
- [x] Deterministic fake ARTEMIS fixtures contain deliberate secrets so E2E proves they do not reach rendered evidence/checkpoints.

Remaining gates:
- [ ] Keep replay separately policy-gated: pinned ARTEMIS replay can materialize chunks/files, so it is not a side-effect-free read-only surface.
- [ ] Add further evidence routes only when the upstream operation is confirmed read-only and side-effect-free.
- [ ] Keep model-facing image handoff gated until DeepSeek Harness exposes a supported public Session-owned image handoff; then gate vision by `LlmModelInfo.inputModalities`.

## Phase 5 — installation and agent experience

**Status: PARTIAL — bounded setup/status UX merged through PR #24**

Delivered:
- [x] Non-destructive ARTEMIS MCP config generator.
- [x] Native ARTEMIS rules-skill adapter.
- [x] Independent UI/MCP architecture.
- [x] PR #24: Host-owned setup inspection validates only explicit `ARTEMIS_ROOT` / `ARTEMIS_PYTHON` inputs and returns fixed bounded status enums rather than local paths or validation details.
- [x] The native panel presents Human UI daemon health independently from ARTEMIS setup readiness.
- [x] Agent MCP runtime is explicitly **Not observable** on the pinned DeepSeek Harness revision; daemon health is never treated as proof of MCP connectivity.
- [x] Unexpected setup properties, local paths, commands, environment details and validation exceptions are stripped before browser delivery.

Remaining gates:
- [ ] Keep profile installation explicit and non-destructive. Pinned DeepSeek Harness settings namespaces and agent presets are not a proven public, reversible seam for patching the active profile with a sibling MCP row.
- [ ] Continue using `dsh-artemis-mcp-config` until a supported profile-patch workflow is verified; do not mutate Cordis files or accept arbitrary browser filesystem paths as a shortcut.
- [ ] Add capability-aware vision affordances only after a public Session-owned image handoff exists, gated by `LlmModelInfo.inputModalities`.

## Phase 6 — autonomous mobile computer-use

**Status: PLANNED**

- Bounded implement→build→install→ARTEMIS→observe→verify→fix loops.
- Deterministic tests first; real-device/visual checks where behavior requires them.
- Explicit retry/stop budgets and evidence boundaries.
- ARTEMIS MCP remains the action authority.

## Phase 7 — compatibility and polish

**Status: ONGOING — security/release hardening merged through PR #34**

Delivered:
- [x] PR #26: every plugin browser route receives `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` before route logic/trust rejection.
- [x] PR #27: all third-party GitHub Actions are pinned to immutable SHAs; a repository test rejects future floating external Action revisions.
- [x] PR #28: Host-side browser panel adapter bounds device collection size and visible ARTEMIS metadata; malformed/oversized upstream values fail closed instead of being truncated.
- [x] PR #29: browser overview parser independently enforces the same shared metadata limits.
- [x] PR #30: browser JSON responses for overview/task evidence/latest traces are capped at 128 KiB and validate MIME, declared/actual bytes, UTF-8 and JSON syntax before DTO parsing.
- [x] PR #31: actual `npm pack --dry-run --json` output is tested so repository-only files and deterministic fixtures cannot silently enter the distribution.
- [x] PR #32: product ARTEMIS transport requires literal loopback (`127.0.0.1` or `::1`), avoiding name-resolution ambiguity from `localhost` while preserving the low-level validated adapter.
- [x] PR #34: checked-in `lib/client.js` was synchronized with the pinned DeepSeek Harness build; compatibility CI now rebuilds to a temporary directory and requires byte-for-byte equality before package/install/E2E.
- [x] Full pinned DeepSeek Harness build/package/Cordis/fake-ARTEMIS/DeepSeek-Harness-Web/Chromium gates were green on the exact runtime PR heads before merge.

Remaining Phase 7 gates:
- [ ] Add a real ARTEMIS + supported Android emulator/device smoke where infrastructure permits, with no unnecessary credentials or broad authority.
- [ ] Continue release/privacy/performance review, especially screenshot retention and failure artifacts as features evolve.
- [ ] Keep supported DeepSeek Harness/ARTEMIS revisions backed by reproducible compatibility evidence.
- [ ] Keep release/versioning independent of unpublished local state.

## Current critical path

```text
Phase 2 merged and DONE
        ↓
Phase 3 safe transport blocked on upstream narrow control contract
        ↓ (work can continue independently)
Phase 4 bounded task evidence + latest-trace tree + ephemeral visual QA merged
        ↓
Phase 5 truthful bounded setup/status UX merged through PR #24
        ↓
profile mutation remains gated on a public reversible DeepSeek Harness seam;
replay remains policy/side-effect gated; model image handoff remains upstream-gated
        ↓
Phase 7 compatibility / privacy / release hardening continues independently;
client bundle/package integrity is now enforced, real ARTEMIS smoke remains open
```
