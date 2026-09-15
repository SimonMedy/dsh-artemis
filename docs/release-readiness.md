# Release readiness

`dsh-artemis` is intentionally unreleased. The repository must keep `package.json` at `private: true` and version `0.0.0` until an explicit release decision changes that policy in a dedicated reviewed pull request.

## What is already proven

- Real npm package contents are checked with `npm pack --dry-run` so repository-only files, fixtures, scripts and workflows cannot silently enter distribution.
- DeepSeek Harness compatibility installs the package through the public plugin path, composes Cordis, removes the package, verifies composition without Artemis, reinstalls it, starts authenticated Harness Web and exercises the native panel with Chromium.
- The pinned ARTEMIS runtime is installed from its upstream lockfile and exercised through the real daemon compatibility smoke without model credentials or device commands.
- Browser-facing routes enforce Harness connection trust, loopback-only ARTEMIS transport, response security headers and bounded metadata/body/frame policies.
- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, and cleanup failures do not mask primary registration failures.
- CI failure diagnostics are aggregated/redacted and scan only a bounded log prefix.

## Remaining release gates

- Run a supported real Android emulator/device smoke on dedicated infrastructure. The existing real-daemon smoke must not be described as device E2E.
- Continue privacy/performance review as runtime surfaces evolve, especially response allocation limits, screenshots, retained artifacts and failure diagnostics.
- Keep supported DeepSeek Harness and ARTEMIS revisions backed by reproducible compatibility evidence.
- Make an explicit project licensing decision before public package release, then keep the repository license file and package metadata consistent with that decision.
- Keep model-image handoff gated until DeepSeek Harness exposes a supported public Session-owned image handoff for vision-capable models.
- Keep broader device controls gated until ARTEMIS exposes a narrow inspected upstream contract; do not substitute generic ADB/shell access.

## Release decision checklist

A future release PR must deliberately remove the private/unreleased guard and, in the same review, choose the first real version, make and document the project licensing decision, keep repository/package license metadata consistent, confirm package metadata and distribution contents, document the supported upstream revisions, record the device/infrastructure evidence available at release time, and rerun all applicable CI/Harness/ARTEMIS gates on the final release candidate SHA.
