# Release readiness

`dsh-artemis` v1.0.1 is the current stable GitHub-release scope. It is a compatibility-only refresh of the v1.0.0 contract for official DeepSeek Harness `dsh-v0.1.6-alpha.1`; npm registry publication remains intentionally disabled with `private: true`, so the supported distribution path is the tagged GitHub release / Git spec.

## What is already proven

- Real npm package contents are checked with `npm pack --dry-run` so repository-only files, fixtures, scripts and workflows cannot silently enter distribution.
- DeepSeek Harness compatibility installs the package through the public plugin path, composes Cordis, removes the package, verifies composition without Artemis, reinstalls it, starts authenticated Harness Web and exercises the native panel with Chromium.
- The pinned ARTEMIS runtime is installed from its upstream lockfile and exercised through the real daemon compatibility smoke without model credentials or device commands.
- DeepSeek Harness support was refreshed on 2026-09-16 to official tag `dsh-v0.1.6-alpha.1` only after exact-SHA CI, real ARTEMIS daemon, byte-for-byte bundle, package/Cordis lifecycle and Chromium Android-panel E2E all passed; this remains daemon/browser compatibility evidence, not real Android device E2E.
- ACP/headless session-scoped ARTEMIS MCP configuration is proven on `main` through PR #121: the CLI emits the Harness `mcpServers` schema without mutating a Session/profile, Cordis remains the default format, and the permanent ARTEMIS workflow launches the real pinned `python -m mcp_server` successfully from a foreign Session cwd using the generated absolute Python/PYTHONPATH contract.
- Browser-facing routes enforce Harness connection trust, loopback-only ARTEMIS transport, response security headers and bounded metadata/body/frame policies.
- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, cleanup failures do not mask primary registration failures, and exported Host registration helpers also roll back their own partial direct registration before returning an exhaustive reverse-order disposer.
- CI failure diagnostics are aggregated/redacted and scan only a bounded log prefix.
- Live multipart frame accumulation is bounded with amortized buffer growth, and bounded evidence selection does not retain a second normalized full-history array.
- Browser JSON/evidence/overview/snapshot rejection paths explicitly cancel unread response bodies before reader acquisition without masking their primary errors.
- Host ARTEMIS protocol fields are type-checked without implicit string/boolean coercion, so malformed upstream values fail closed before they become panel DTO data.
- Evidence and trace selection require every upstream `step_number` to be a non-negative safe integer before latest-step selection, preventing malformed session histories from silently falling back to response order or triggering downstream trace requests.
- Live multipart metadata rejection and reader-acquisition failure cancel unread ARTEMIS response bodies before parsing continues, while cleanup failures never replace the primary protocol or reader error.
- Host and evidence bounded JSON readers cancel unread response bodies when reader acquisition fails, while best-effort cancellation failures never replace the original acquisition error.
- After reader acquisition, Host and evidence bounded JSON streams cancel the acquired reader on read, chunk-validation or response-size failures, preserve the exact primary error if cancellation fails, and release the reader lock best-effort.
- Browser bounded JSON streams apply the same acquired-reader cleanup contract; the checked browser bundle is regenerated only through the pinned DeepSeek Harness toolchain and remains byte-for-byte reproducible under compatibility CI.
- Browser snapshot streams apply the same acquired-reader cleanup contract for read, chunk-validation and size-limit failures; cancellation and lock-release cleanup remain best-effort without replacing the primary error, and the checked bundle remains pinned-Harness reproducible.
- Browser-visible health metadata fails closed on type mismatches: `health.reachable` must be a real boolean at the bounded panel boundary, matching the strict boolean policy already applied to device and stream state fields.
- Host-configured JSON and live-frame memory limits stay in the safe-integer domain; frame limits reserve worst-case multipart overhead before buffering, while evidence adapters ignore unsafe custom JSON limits and retain their bounded default.
- Host request/snapshot timeout configuration is bounded to 2,147,483,647 ms so Node timer overflow cannot silently shorten a request to 1 ms; evidence adapters fall back to their 2 s timeout when a custom client exceeds that range.
- Browser live retry helpers apply the same timer ceiling to caller-provided base/max delays, while the product defaults remain 750/1,500/3,000 ms and finite; the checked bundle remains pinned-Harness reproducible.
- Harness MCP Cordis rendering quotes both environment keys and values as JSON-compatible YAML scalars, so hostile/custom env-key text cannot alter the emitted configuration structure.
- Harness MCP Cordis startup-error policy fails closed on type mismatches: `failOnStartupError` must be a real boolean, so custom rows cannot silently invert policy through JavaScript truthiness.
- Harness MCP Cordis stdio rows are validated against the pinned Harness schema before rendering: transport/serverName/command/args/env/cwd types are explicit, omitted args/env/cwd retain the upstream defaults, and malformed iterable/object inputs are not coerced.
- Rules-skill resource limits stay in the safe-integer domain at both exported loader and plugin configuration boundaries; the product default remains 512 KiB and overrange custom limits fail closed.

## Known validation gaps and future gates

- Real Android emulator/device smoke remains a dedicated-infrastructure validation target and is not claimed as v1.0.0 evidence. The existing real-daemon smoke must not be described as device E2E.
- Continue privacy/performance review as runtime surfaces evolve, especially response allocation limits, screenshots, retained artifacts and failure diagnostics.
- Keep supported DeepSeek Harness and ARTEMIS revisions backed by reproducible compatibility evidence.
- Keep the v1.0.0 MIT decision, repository `LICENSE` and package license metadata consistent in future releases.
- Harness `dsh-v0.1.6-alpha.1` now persists MCP image result blocks as durable model attachments when the active model supports images, but ARTEMIS screenshot state still returns a local `file://` JPEG reference rather than an MCP image block. Keep direct ARTEMIS model-image handoff gated until that upstream result becomes an MCP image or Harness exposes a general assistant-side image handoff seam.
- Keep broader device controls gated until ARTEMIS exposes a narrow inspected upstream contract; do not substitute generic ADB/shell access.

## v1.0.1 compatibility decision

v1.0.1 keeps the v1.0.0 runtime contract unchanged while moving the reviewed Harness compatibility pin to official tag `dsh-v0.1.6-alpha.1`. After v1.0.1, PR #121 adds dsh-artemis generation of validated ACP/headless session-scoped `mcpServers`; Web installation still requires explicit Cordis/profile configuration because no public reversible Web-profile mutation seam is available.

## v1.0.0 release decision

The first stable release deliberately selects version `1.0.0`, MIT licensing and tagged GitHub/Git-spec distribution while keeping npm registry publication disabled. Before creating tag `v1.0.0`, the final release-candidate SHA must pass package-content checks plus all applicable CI, Harness compatibility and ARTEMIS compatibility gates. Release notes must state the available evidence and the real-device/emulator E2E gap explicitly.
