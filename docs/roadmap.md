# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This file tracks execution status and exit criteria.

> A phase is `DONE` only when its exit criteria are satisfied on `main`. Work on a branch is `ACTIVE`, not complete.

Last updated: 2026-09-13

## Status

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Pinned upstreams, secure adapter, trust fence, package installation, MCP config and rules skill merged |
| 1 — minimal native panel | **DONE** | Native Android sidebar + deterministic real DeepSeek Harness/Chromium E2E merged through PR #15 |
| 1.5 — explicit screenshot observation | **DONE** | Bounded snapshot route, ephemeral preview and packaged DeepSeek Harness/Chromium capture merged through PR #17 |
| 2 — live human screen | **DONE** | Bounded multi-frame transport, explicit Start/Stop viewer and packaged DeepSeek Harness/Chromium E2E merged through PR #18 |
| 3 — bounded device controls | **BLOCKED** | Pinned ARTEMIS exposes Back/Home/Recents only through a broader action/ADB surface; no narrow configured-MCP/Admin transport and no canonical Rotate contract |
| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded task evidence PR #19, latest-trace drill-down PR #21 and ephemeral visual QA checkpoint PR #22 merged; replay and model-image handoff remain gated |
| 5 — installation & agent experience | **PARTIAL** | MCP config + rules skill + truthful bounded setup/status UX PR #24 merged; automatic profile mutation and vision affordances remain gated |
| 6 — autonomous mobile computer-use | **PLANNED** | Build bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Security/release hardening through PR #38; real pinned ARTEMIS daemon compatibility is proven, while real device/emulator smoke and remaining release/privacy polish stay open |

## Completed foundations

- Product ARTEMIS HTTP access is restricted to literal loopback (`127.0.0.1` / `::1`) and browser input cannot select an upstream.
- All browser-facing plugin routes cross the DeepSeek Harness connection trust fence before upstream access and receive an ephemeral/no-sniff response baseline.
- Native Android UI uses DeepSeek Harness primitives/tokens rather than DOM injection or a parallel design system.
- Agent automation stays in ARTEMIS MCP; the plugin UI does not reimplement an agent/device automation engine.
- Browser-visible ARTEMIS metadata and JSON bodies have explicit Host and browser-side bounds.
- Real npm package installation, Cordis composition and Chromium journeys are tested against pinned DeepSeek Harness.
- Browser E2E uses public DeepSeek Harness Workspace/Session/settings/credentials lifecycle APIs and deterministic loopback fixtures.
- Third-party GitHub Actions are pinned to immutable SHAs and repository tests reject floating external Action revisions.
- The npm artifact surface is tested using npm's actual pack file set; tests, fixtures, workflows, scripts and examples are excluded from distribution.
- `lib/client.js` is generated with the pinned DeepSeek Harness toolchain and must match a fresh build byte-for-byte before package/E2E proceeds.
- Documented DeepSeek Harness/ARTEMIS revisions, compatibility workflow pins and the client-build pin are checked for exact consistency.
- A real pinned ARTEMIS daemon is installed from its lockfile and exercised through the product HTTP/panel/overview adapters without model credentials or device commands.

## Phase 1.5 — explicit screenshot observation

**Status: DONE — merged through PR #17**

Delivered:
- [x] Exactly one validated ARTEMIS multipart PNG frame per explicit capture.
- [x] Bounded multipart headers, frame size and time-to-first-frame.
- [x] Same-origin snapshot route behind the DeepSeek Harness trust fence.
- [x] Independent browser content-type, size and PNG-signature checks.
- [x] Ephemeral Blob/Object URL with replacement/device-change/unmount cleanup.
- [x] Fake ARTEMIS + real packaged DeepSeek Harness/Chromium E2E covers the full upstream→Host→browser path.
- [x] Image bytes/base64 stay out of logs and no durable preview attachment is created.

Model handoff remains intentionally gated:
- Do not persist screenshots merely to create an attachment id.
- Do not fabricate Session events, touch private stores or force images through `session.prompt()`.
- Add model-facing screenshots only when DeepSeek Harness exposes a supported public Session-owned image handoff.
- Gate vision by `LlmModelInfo.inputModalities`; missing metadata remains unknown rather than assumed capable.

## Phase 2 — live human screen

**Status: DONE — merged through PR #18**

Delivered:
- [x] Snapshot/live share one validated frame pipeline.
- [x] Every multipart PNG frame is validated independently.
- [x] Same-origin live route is behind the DeepSeek Harness trust fence.
- [x] Node backpressure is respected and upstream aborts on browser disconnect.
- [x] Explicit **Start live** / **Stop live** controls with capped reconnect budget.
- [x] Live stops when the active device/stream disappears.
- [x] Live frames remain human-facing, ephemeral and outside model context.
- [x] Real packaged DeepSeek Harness/Chromium E2E proves Start→visible frame→Stop and subsequent snapshot behavior.

See [`live-viewer.md`](live-viewer.md).

## Phase 3 — bounded device controls

**Status: BLOCKED — safe upstream contract required**

Pinned ARTEMIS has canonical `press_key` mappings for Back, Home and Recents, but those operations live in a broader action/ADB surface rather than the configured `python -m mcp_server` or a narrow Admin endpoint. The canonical action contract also has no Rotate operation.

We will not bypass that gap with generic ADB/shell, arbitrary key codes, a second broad agent-facing MCP server, natural-language task prompts or private ARTEMIS internals.

See [`device-controls.md`](device-controls.md).

Exit criteria:
- [ ] Every exposed control maps to an inspected allow-listed supported upstream operation.
- [ ] Browser input cannot supply arbitrary command/path/package/URL/keycode values.
- [ ] Unit/contract tests cover per-action errors and trust boundaries.
- [ ] Real DeepSeek Harness/Chromium E2E covers the visible controls.

## Phase 4 — tasks, traces and visual QA

**Status: PARTIAL**

Delivered:
- [x] PR #19: bounded same-origin task evidence behind DeepSeek Harness connection trust.
- [x] Active session/step selection is server-derived; browser input cannot provide identifiers.
- [x] PR #21: bounded latest-trace trees with capped nodes/depth/children and no raw thinking, payloads, screenshots/paths or model content.
- [x] PR #22: manual ephemeral visual QA checkpoint built only from existing safe evidence + snapshot routes.
- [x] Deterministic fixtures contain deliberate secrets so E2E proves they do not reach rendered evidence/checkpoints.

Remaining gates:
- [ ] Replay stays separately policy-gated because pinned ARTEMIS replay can materialize chunks/files.
- [ ] Add further evidence only when the upstream operation is confirmed read-only and side-effect-free.
- [ ] Keep model image handoff gated until DeepSeek Harness provides a supported public Session-owned image handoff and vision can be checked through `LlmModelInfo.inputModalities`.

## Phase 5 — installation and agent experience

**Status: PARTIAL — bounded setup/status UX merged through PR #24**

Delivered:
- [x] Non-destructive ARTEMIS MCP config generator and native rules-skill adapter.
- [x] Independent Human UI / MCP architecture.
- [x] Host setup inspection validates only explicit `ARTEMIS_ROOT` / `ARTEMIS_PYTHON` and emits bounded enums, never local paths or validation details.
- [x] Human UI daemon health is shown independently from setup readiness.
- [x] Agent MCP runtime is explicitly **Not observable** on the pinned DeepSeek Harness revision; daemon health is never treated as MCP connectivity proof.

Remaining gates:
- [ ] Keep profile installation explicit/non-destructive until DeepSeek Harness exposes a proven public reversible seam for patching the active profile with a sibling MCP row.
- [ ] Continue using `dsh-artemis-mcp-config`; do not mutate Cordis files or accept arbitrary browser filesystem paths as shortcuts.
- [ ] Add capability-aware vision affordances only after a public Session-owned image handoff exists.

## Phase 6 — autonomous mobile computer-use

**Status: PLANNED**

- Bounded implement→build→install→ARTEMIS→observe→verify→fix loops.
- Deterministic tests first; real-device/visual checks where behavior requires them.
- Explicit retry/stop budgets and evidence boundaries.
- ARTEMIS MCP remains the action authority.

## Phase 7 — compatibility and polish

**Status: ONGOING — security/release hardening merged through PR #38**

Delivered:
- [x] PR #26: browser response baseline (`no-store`, `nosniff`) applies before route logic/trust rejection.
- [x] PR #27: all third-party GitHub Actions pinned to immutable SHAs; floating refs are rejected by repository tests.
- [x] PR #28: Host bounds browser-visible ARTEMIS device metadata and collection size.
- [x] PR #29: browser parser independently enforces the same metadata bounds.
- [x] PR #30: overview/evidence/trace JSON bodies are capped at 128 KiB with MIME, byte-count, UTF-8 and JSON validation.
- [x] PR #31: actual npm pack output is tested so repository-only files/fixtures cannot enter distribution silently.
- [x] PR #32: product ARTEMIS transport requires literal loopback.
- [x] PR #34: checked-in browser bundle synchronized with the pinned DeepSeek Harness build; CI requires byte-for-byte equality before packaging.
- [x] PR #36: real pinned ARTEMIS daemon compatibility workflow installs from the upstream lockfile, starts the actual daemon on loopback without model credentials and exercises status/devices/stream-state through product adapters.
- [x] PR #37: documented upstream pins, compatibility workflow pins and the browser build pin must remain exactly consistent.
- [x] PR #38: real ARTEMIS daemon smoke is environment-neutral about discovered devices while still requiring idle/no implicit live-stream behavior and bounded DTO compatibility.
- [x] Full pinned DeepSeek Harness package/Cordis/Web/Chromium gates remain green on runtime-affecting PR heads.

Remaining Phase 7 gates:
- [ ] Add a real ARTEMIS + supported Android emulator/device smoke when dedicated infrastructure is available. Pinned ARTEMIS itself keeps device/E2E suites off GitHub-hosted runners, so the current daemon smoke must not be misrepresented as device E2E.
- [ ] Continue release/privacy/performance review, especially screenshot retention and failure artifacts as features evolve.
- [ ] Keep supported DeepSeek Harness/ARTEMIS revisions backed by reproducible compatibility evidence.
- [ ] Keep release/versioning independent of unpublished local state; the package remains private/`0.0.0` until an explicit release decision is made.

## Current critical path

```text
Phase 2 merged and DONE
        ↓
Phase 3 safe controls blocked on a narrow upstream contract
        ↓ (independent work can continue)
Phase 4 bounded evidence + traces + ephemeral visual QA merged
        ↓
Phase 5 truthful bounded setup/status merged; profile mutation and model image handoff remain upstream-gated
        ↓
Phase 7 compatibility/privacy/release hardening continues independently:
real ARTEMIS daemon compatibility is proven;
real ARTEMIS + device/emulator smoke still needs dedicated infrastructure
```
