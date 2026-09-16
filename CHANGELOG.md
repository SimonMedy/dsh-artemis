# Changelog

All notable changes to `dsh-artemis` are documented here.

## [1.1.0] - 2026-09-16

First feature release after the stable v1.0 line, adding validated session-scoped ARTEMIS MCP configuration for DeepSeek Harness ACP/headless clients.

### Added

- Add `dsh-artemis-mcp-config --format acp-json` to emit a directly reusable `{ "mcpServers": [...] }` fragment for Harness ACP `session/new` / `session/resume`.
- Keep Cordis as the unchanged default output for Web/profile workflows.
- Validate ACP stdio shape using the same reviewed ARTEMIS root/Python selection as the Cordis generator.
- Add real pinned-ARTEMIS CI coverage that launches `python -m mcp_server` from a foreign Session working directory, proving the generated absolute Python command + bounded `PYTHONPATH` contract works independently of the ACP workspace.

### Security and architecture

- The new format only prints configuration; it does not open ACP, create/resume Sessions or edit profiles.
- No browser route, Host privilege, generic shell/ADB surface or Web/Cordis profile mutation is added.
- ACP environment entries are validated and limited to the already reviewed ARTEMIS configuration values.

### Compatibility

- Based on official DeepSeek Harness `dsh-v0.1.6-alpha.1` and the existing pinned ARTEMIS revision.
- Feature PR #121 passed repository CI, real ARTEMIS compatibility including the foreign-cwd MCP smoke, and the full packaged Harness/Cordis/Web/Chromium compatibility gate.

### Remaining limitations

- Web/Cordis profile installation remains explicit until Harness exposes a public reversible active-profile mutation seam.
- Direct ARTEMIS screenshot → model handoff remains gated because ARTEMIS screenshot state still returns a local `file://` JPEG reference instead of MCP image content.
- Replay and broader device controls remain gated as documented in the roadmap.
- Real Android device/emulator E2E remains a dedicated-infrastructure target.

## [1.0.1] - 2026-09-16

Compatibility refresh for the official DeepSeek Harness `dsh-v0.1.6-alpha.1` release.

### Compatibility

- Pin DeepSeek Harness to official tag `dsh-v0.1.6-alpha.1` (`0a15e36e7f82b6ed45af6fa9759f29b40dcd965d`).
- Revalidate repository CI, the real pinned ARTEMIS daemon, byte-for-byte browser bundle generation, package install, Cordis compose/remove/reinstall, authenticated Harness Web and Chromium Android-panel E2E.
- No dsh-artemis runtime behavior or public API changes; the checked browser bundle remains byte-identical under the official Harness tag.

### Upstream notes

- Harness can now persist MCP image result blocks as durable attachments for vision-capable models, but ARTEMIS `mobile_get_device_state("screenshot")` still returns a local `file://` JPEG reference rather than an MCP image block. Direct model screenshot handoff therefore remains gated.
- Harness ACP sessions now accept session-scoped `mcpServers`, which improves ACP/headless integration. The Web/Cordis plugin still has no public reversible active-profile mutation seam, so automatic Web profile MCP installation remains gated.

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
