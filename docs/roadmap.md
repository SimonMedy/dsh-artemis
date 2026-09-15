# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). This file tracks execution status and the evidence required before a phase can be called complete.

> A phase is `DONE` only when its exit criteria are satisfied on `main`. Work on a branch is `ACTIVE`, not complete.

Last updated: 2026-09-15

## Status

| Phase | Status | Evidence / next gate |
| --- | --- | --- |
| 0 — investigation & bootstrap | **DONE** | Pinned upstreams, secure adapter, trust fence, package installation, MCP config and rules skill merged |
| 1 — minimal native panel | **DONE** | Native Android sidebar + deterministic real DeepSeek Harness/Chromium E2E merged through PR #15 |
| 1.5 — explicit screenshot observation | **DONE** | Bounded snapshot route, ephemeral preview and packaged DeepSeek Harness/Chromium capture merged through PR #17 |
| 2 — live human screen | **DONE** | Bounded multi-frame transport, explicit Start/Stop viewer and packaged DeepSeek Harness/Chromium E2E merged through PR #18 |
| 3 — bounded device controls | **BLOCKED** | Pinned ARTEMIS exposes Back/Home/Recents only through a broader action/ADB surface; no narrow configured-MCP/Admin transport and no canonical Rotate contract |
| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded task evidence PR #19, latest-trace drill-down PR #21 and ephemeral visual QA checkpoint PR #22 merged; replay and model-image handoff remain gated |
| 5 — installation & agent experience | **PARTIAL** | MCP config + rules skill + truthful bounded setup/status UX are merged and reversible plugin lifecycle is proven; automatic profile mutation and vision affordances remain gated |
| 6 — autonomous mobile computer-use | **PLANNED** | Build bounded code→build→ARTEMIS→observe→verify→fix workflows |
| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle and cleanup hardening merged through PR #69; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke and remaining release polish stay open |

## Non-negotiable foundations

- Product ARTEMIS HTTP access is restricted to literal loopback (`127.0.0.1` / `::1`); browser input cannot choose an upstream.
- Browser-facing plugin routes cross the DeepSeek Harness connection trust fence before upstream access and use an ephemeral/no-sniff response baseline.
- Native Android UI uses DeepSeek Harness primitives/tokens rather than DOM injection or a parallel design system.
- Agent automation stays in ARTEMIS MCP; the UI does not reimplement a generic device automation engine.
- Browser-visible ARTEMIS metadata and JSON bodies have explicit Host and browser-side bounds.
- Screenshots/live frames remain human-facing and ephemeral unless a future public DeepSeek Harness Session-owned image handoff exists.
- Replay remains policy-gated because pinned ARTEMIS replay can materialize files/chunks.
- Real npm packaging, Cordis composition and Chromium journeys are validated against the pinned DeepSeek Harness revision.
- `dsh-artemis` must remain a reversible Harness/Cordis plugin: public install, remove and reinstall must not patch Harness source or leave stale profile/Cordis state.
- A real pinned ARTEMIS daemon is installed from its lockfile and exercised on loopback without model credentials or device commands.

## Phase 3 — bounded device controls

**Status: BLOCKED — safe upstream contract required**

Pinned ARTEMIS has canonical `press_key` mappings for Back, Home and Recents, but those operations live in a broader action/ADB surface rather than the configured `python -m mcp_server` or a narrow Admin endpoint. The canonical contract also has no Rotate operation.

We will not bypass that gap with generic ADB/shell, arbitrary key codes, a second broad agent-facing MCP server, natural-language task prompts or private ARTEMIS internals.

See [`device-controls.md`](device-controls.md).

Exit criteria:
- [ ] Every exposed control maps to an inspected allow-listed upstream operation.
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

**Status: PARTIAL**

Delivered:
- [x] Non-destructive ARTEMIS MCP config generator and native rules-skill adapter.
- [x] Independent Human UI / MCP architecture.
- [x] Host setup inspection emits bounded enums and never browser-visible local paths or validation details.
- [x] Human UI daemon health is shown independently from setup readiness.
- [x] Agent MCP runtime is explicitly **Not observable** on the pinned DeepSeek Harness revision; daemon health is never treated as MCP connectivity proof.
- [x] PR #40: MCP Python resolution fails closed instead of accidentally falling back to the Node executable.
- [x] PR #43: selected POSIX Python must be executable; setup reports a non-executable explicit path as invalid.
- [x] PR #45: selected Python must be a regular file; directories cannot become MCP commands.
- [x] PR #46: ARTEMIS root identity markers must be regular files.
- [x] PR #48: root identity markers must also be non-symlink files, preventing `rules.md`/`__main__.py`/`pyproject.toml` redirection outside the configured checkout; Python symlinks remain supported intentionally.

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

**Status: ONGOING — hardening merged through PR #69**

Delivered:
- [x] PR #26: browser response baseline (`no-store`, `nosniff`) applies before route logic/trust rejection.
- [x] PR #27: third-party GitHub Actions are pinned to immutable full commit SHAs.
- [x] PR #28–#30: Host/browser metadata bounds and 128 KiB browser JSON limits with MIME, byte-count, UTF-8 and JSON validation.
- [x] PR #31: actual npm pack output is tested so repository-only files/fixtures cannot silently enter distribution.
- [x] PR #32: product ARTEMIS transport requires literal loopback.
- [x] PR #34: checked-in browser bundle must match a fresh pinned DeepSeek Harness build byte-for-byte before packaging.
- [x] PR #36/#38: real pinned ARTEMIS daemon compatibility installs from the upstream lockfile, starts without model credentials and exercises product adapters; the smoke is environment-neutral about discovered devices.
- [x] PR #37: documented upstream pins, compatibility workflow pins and browser build pin must remain exactly consistent.
- [x] PR #42: browser failure uploads are allow-listed to the single `native-panel-failure.png` with three-day retention.
- [x] PR #44: raw browser E2E stdout/stderr is suppressed behind a bounded redacted runner; only allow-listed phase/exit metadata can reach CI logs.
- [x] PR #47: every checkout disables credential persistence; repository tests prevent regressions.
- [x] PR #49: audited `actions/checkout`/`actions/setup-node` revisions use the Node 24 Action runtime, remain full-SHA pinned, and are locked by repository invariants.
- [x] PR #50–#56: roadmap continuity, streamed browser JSON/snapshot accounting, safe ARTEMIS/Harness failure summaries, literal-loopback enforcement and Host JSON integrity hardening.
- [x] PR #57–#61: Host live/evidence stream validation plus exact JSON MIME and strict shared `Content-Length` policy across browser/Host/evidence boundaries.
- [x] PR #62–#66: browser/Host cleanup-error preservation, browser response isolation headers and synchronous cleanup hardening for live/JSON readers.
- [x] PR #67: browser bounded-JSON cleanup preserves primary size-limit errors when reader cancellation throws synchronously.
- [x] PR #68: public Harness plugin lifecycle is proven end-to-end: install → compose → remove → compose without Artemis → reinstall → authenticated Web + Chromium E2E.
- [x] PR #69: browser snapshot cleanup contains synchronous cancellation and lock-release failures without masking primary body/protocol errors.
- [x] Runtime-affecting PR heads continue to pass pinned DeepSeek Harness package/Cordis/Web/Chromium gates; ARTEMIS-facing changes also pass the real daemon compatibility gate.

Remaining Phase 7 gates:
- [ ] Add a real ARTEMIS + supported Android emulator/device smoke when dedicated infrastructure is available. Pinned ARTEMIS itself keeps device/E2E suites off ordinary GitHub-hosted runners, so the daemon smoke must not be represented as device E2E.
- [ ] Continue release/privacy/performance review, especially response allocation bounds, screenshot retention and failure artifacts as features evolve.
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
Phase 5 truthful bounded setup/status + reversible plugin lifecycle proven; profile mutation and model image handoff remain upstream-gated
        ↓
Phase 7 compatibility/privacy/release hardening continues independently:
real ARTEMIS daemon compatibility is proven;
real ARTEMIS + device/emulator smoke still needs dedicated infrastructure
```
