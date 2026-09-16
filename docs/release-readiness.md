# Release readiness

`dsh-artemis` is intentionally unreleased. The repository must keep `package.json` at `private: true` and version `0.0.0` until an explicit release decision changes that policy in a dedicated reviewed pull request.

## What is already proven

- Real npm package contents are checked with `npm pack --dry-run` so repository-only files, fixtures, scripts and workflows cannot silently enter distribution.
- DeepSeek Harness compatibility installs the package through the public plugin path, composes Cordis, removes the package, verifies composition without Artemis, reinstalls it, starts authenticated Harness Web and exercises the native panel with Chromium.
- The pinned ARTEMIS runtime is installed from its upstream lockfile and exercised through the real daemon compatibility smoke without model credentials or device commands.
- Supported Harness and ARTEMIS revisions were refreshed on 2026-09-15 only after branch-only candidate probes and then revalidated by the permanent exact-SHA CI/Harness/ARTEMIS gates; this remains daemon/browser compatibility evidence, not real Android device E2E.
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

## Remaining release gates

- Run a supported real Android emulator/device smoke on dedicated infrastructure. The existing real-daemon smoke must not be described as device E2E.
- Continue privacy/performance review as runtime surfaces evolve, especially response allocation limits, screenshots, retained artifacts and failure diagnostics.
- Keep supported DeepSeek Harness and ARTEMIS revisions backed by reproducible compatibility evidence.
- Make an explicit project licensing decision before public package release, then keep the repository license file and package metadata consistent with that decision.
- Keep model-image handoff gated until DeepSeek Harness exposes a supported public Session-owned image handoff for vision-capable models.
- Keep broader device controls gated until ARTEMIS exposes a narrow inspected upstream contract; do not substitute generic ADB/shell access.

## Release decision checklist

A future release PR must deliberately remove the private/unreleased guard and, in the same review, choose the first real version, make and document the project licensing decision, keep repository/package license metadata consistent, confirm package metadata and distribution contents, document the supported upstream revisions, record the device/infrastructure evidence available at release time, and rerun all applicable CI/Harness/ARTEMIS gates on the final release candidate SHA.
