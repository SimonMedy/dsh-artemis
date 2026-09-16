# dsh-artemis

[![Release](https://img.shields.io/github/v/release/SimonMedy/dsh-artemis?display_name=tag&sort=semver)](https://github.com/SimonMedy/dsh-artemis/releases/latest)
[![CI](https://github.com/SimonMedy/dsh-artemis/actions/workflows/ci.yml/badge.svg)](https://github.com/SimonMedy/dsh-artemis/actions/workflows/ci.yml)
[![Harness compatibility](https://github.com/SimonMedy/dsh-artemis/actions/workflows/harness-compat.yml/badge.svg)](https://github.com/SimonMedy/dsh-artemis/actions/workflows/harness-compat.yml)
[![ARTEMIS compatibility](https://github.com/SimonMedy/dsh-artemis/actions/workflows/artemis-compat.yml/badge.svg)](https://github.com/SimonMedy/dsh-artemis/actions/workflows/artemis-compat.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Native ARTEMIS integration for DeepSeek Harness — a bounded Android observe / inspect / supervise surface for coding agents and humans.**

`dsh-artemis` keeps ARTEMIS MCP as the agent-facing automation authority and adds a native DeepSeek Harness integration around it. The stable v1.0.1 scope focuses on safe observation, task/trace evidence, MCP setup and a reversible Harness plugin lifecycle.

## What ships in v1.0.1

- Native Android status and right-sidebar UI built with Harness primitives.
- Explicit bounded screenshots and a human-facing live screen viewer.
- Bounded task evidence, latest-trace inspection and ephemeral visual QA checkpoints.
- ARTEMIS MCP configuration generation with strict stdio schema validation.
- Optional ARTEMIS behavioral rules as a native Harness skill.
- Loopback-only product HTTP transport with bounded JSON/frame/time limits.
- Transactional route registration and reversible install → remove → reinstall lifecycle.
- Reproducible compatibility CI against pinned DeepSeek Harness and ARTEMIS revisions.

See [`docs/product-vision.md`](docs/product-vision.md), [`docs/roadmap.md`](docs/roadmap.md) and [`docs/release-readiness.md`](docs/release-readiness.md) for the full architecture and remaining upstream-gated work.

## Requirements

- DeepSeek Harness compatible with the pinned revision documented in [`docs/upstreams.md`](docs/upstreams.md).
- A local ARTEMIS checkout/install compatible with the pinned revision in [`docs/upstreams.md`](docs/upstreams.md).
- Node.js `^22.19.0 || >=24.0.0`.
- ARTEMIS reachable only through a local loopback endpoint (`127.0.0.1` / `::1`).

## Install

v1.0.1 is distributed as a tagged GitHub release. npm registry publication is intentionally disabled for this release.

Install the plugin into a Harness profile:

```bash
dsh plugin --profile my-profile add 'git+https://github.com/SimonMedy/dsh-artemis.git#v1.0.1'
```

The plugin bundle is reversible: removing it from the profile must remove the plugin layer without patching Harness source or leaving stale Cordis state.

## Configure ARTEMIS MCP

`dsh-artemis` deliberately does **not** rewrite your active profile automatically. Generate the sibling MCP row from your real ARTEMIS checkout:

```bash
npm exec --yes \
  --package='git+https://github.com/SimonMedy/dsh-artemis.git#v1.0.1' \
  -- dsh-artemis-mcp-config --artemis-root /absolute/path/to/artemis
```

The command prints one Cordis row to stdout and never edits profile files. Review that row, then add it to the active Harness profile using your normal Cordis/profile workflow.

You can also run the generator from a checked-out release:

```bash
node bin/dsh-artemis-mcp-config.mjs --artemis-root /absolute/path/to/artemis
```

Start ARTEMIS using its supported upstream workflow, then start Harness normally. The plugin reports daemon/setup state independently; daemon health is not presented as proof that the agent MCP runtime is connected.

## Security model

The plugin treats the browser ↔ Harness Host ↔ ARTEMIS ↔ Android boundary as privileged:

- browser input cannot choose arbitrary upstream URLs;
- product ARTEMIS HTTP is literal-loopback only;
- no generic `adb shell`, arbitrary process execution or arbitrary filesystem browser RPC is exposed;
- browser-visible JSON, evidence, traces, screenshots and live frames are bounded;
- screenshots/live frames are ephemeral by default;
- failure diagnostics are bounded and redacted;
- third-party GitHub Actions are full-SHA pinned and checkout credentials are not persisted.

Read [`SECURITY.md`](SECURITY.md) before changing Host routes, device controls, network transport, screen/trace handling, filesystem access or package installation behavior.

## Known limits

These are intentionally outside the v1.0.1 stable contract:

- Back/Home/Recents/Rotate UI controls remain gated until ARTEMIS exposes a narrow inspected upstream contract; the plugin will not substitute a generic ADB/shell surface.
- Replay remains gated because the pinned ARTEMIS replay path can materialize files/chunks.
- Model-owned screenshot handoff remains gated until DeepSeek Harness exposes a supported Session-owned image attachment seam.
- Automatic mutation of the active Harness profile remains gated until Harness exposes a public reversible profile/MCP API.
- CI proves the real pinned ARTEMIS daemon and the packaged Harness/Web/Chromium integration, but it does **not** claim real Android device/emulator E2E yet.

## Development

```bash
npm run check
```

`lib/client.js` is generated and checked in. Do not edit it by hand; rebuild it only through the pinned DeepSeek Harness toolchain described in [`docs/development.md`](docs/development.md).

Useful references:

- [`docs/development.md`](docs/development.md) — development and bundle workflow
- [`docs/testing.md`](docs/testing.md) — deterministic, compatibility and E2E layers
- [`docs/upstreams.md`](docs/upstreams.md) — pinned upstream revisions
- [`docs/architecture.md`](docs/architecture.md) — trust boundaries and package architecture
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution expectations
- [`CHANGELOG.md`](CHANGELOG.md) — release history

## License

MIT — see [`LICENSE`](LICENSE).
