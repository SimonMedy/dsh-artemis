# Changelog

All notable changes to `dsh-artemis` are documented here.

## [1.0.0] - 2026-09-16

First stable release of the current Harness/ARTEMIS integration scope.

### Added

- Native Harness Android status/sidebar experience.
- Explicit bounded snapshot and human live-screen observation.
- Bounded task evidence, latest-trace inspection and ephemeral visual QA checkpoints.
- ARTEMIS MCP config generator and optional native rules-skill integration.
- Reversible Harness/Cordis plugin lifecycle with install/remove/reinstall compatibility coverage.
- Real pinned ARTEMIS daemon compatibility smoke and packaged Harness/Web/Chromium E2E.

### Security and reliability

- Literal-loopback-only ARTEMIS HTTP transport.
- Harness connection trust checks and bounded browser-facing response policies.
- Strict protocol/schema validation without implicit boolean/string/config coercion.
- Safe-integer byte limits and bounded timer delays.
- Transactional route activation/cleanup and defensive response-stream cancellation.
- Bounded/redacted CI diagnostics and full-SHA-pinned third-party Actions.

### Known limitations

- Broader device controls remain gated on a narrow upstream ARTEMIS contract.
- Replay remains gated because it can materialize files/chunks.
- Model image handoff and automatic active-profile mutation remain gated on public DeepSeek Harness APIs.
- Real Android device/emulator E2E is not yet part of GitHub-hosted CI.
- npm registry publication is intentionally disabled; v1.0.0 is distributed through the tagged GitHub release / Git spec.
