# ARTEMIS MCP integration with DeepSeek Harness

`dsh-artemis` has two independent integration planes. Keeping them separate is deliberate.

## Human UI plane

The Harness right-sidebar plugin talks to the local ARTEMIS daemon HTTP API through the `dsh-artemis` Host adapter:

```text
Harness browser
    │ same-origin dsh-artemis route
    ▼
dsh-artemis Host
    │ loopback HTTP
    ▼
ARTEMIS daemon (default 127.0.0.1:8000)
```

This plane powers device status, screen preview/live view, task state and future manual controls. It does **not** expose ARTEMIS tools to the model.

## Agent MCP plane

DeepSeek Harness ships `@deepseek-ai/dsh-mcp-client`. One configured instance connects to one external MCP server and registers its tools as native Harness tools.

ARTEMIS' own installer resolves its preferred Python as follows:

- Windows: `<artemis-root>/.venv/Scripts/python.exe` when present;
- other platforms: `<artemis-root>/.venv/bin/python` when present;
- otherwise the Python running the ARTEMIS installer.

It then launches the official MCP server as `python -m mcp_server` from the ARTEMIS root and supplies:

```text
PYTHONUNBUFFERED=1
PYTHONPATH=<artemis-root>
ARTEMIS_DESKTOP_NOTIFY=true
```

`dsh-artemis` mirrors that process contract instead of depending on `uv` being globally available at Harness startup.

Harness namespaces discovered tools by MCP server name, so the model sees `mcp__artemis__mobile_diagnose`, `mcp__artemis__mobile_run_task`, `mcp__artemis__mobile_manage_task`, `mcp__artemis__mobile_get_device_state`, and `mcp__artemis__mobile_inspect_trace`.

## MCP configuration generator

The package ships a non-destructive helper:

```bash
dsh-artemis-mcp-config --artemis-root /absolute/path/to/artemis
```

or:

```bash
ARTEMIS_ROOT=/absolute/path/to/artemis dsh-artemis-mcp-config
```

`ARTEMIS_PYTHON` / `--python` may override interpreter discovery. The helper validates `pyproject.toml`, `mcp_server/__main__.py` and `mcp_server/rules.md`, resolves the interpreter, and writes exactly one Cordis row to stdout.

It does **not** scan arbitrary home directories, execute discovery shell commands, edit Harness profiles or modify ARTEMIS. Profile mutation will only be added after the Harness profile-patch workflow is proven safe and reversible.

## ARTEMIS behavioral rules as a native Harness skill

ARTEMIS' installer also installs `mcp_server/rules.md` for supported clients. Harness is not currently an ARTEMIS installer target, so `dsh-artemis` adapts that same file to Harness' native runtime skill registry instead of copying or rewriting it.

The adapter:

- validates the explicit ARTEMIS root using the same checks as MCP setup;
- reads exactly `<artemis-root>/mcp_server/rules.md`;
- enforces a bounded file size and valid UTF-8;
- preserves the Markdown body byte-for-text without editing its instructions;
- exposes it as the runtime skill `artemis-mobile-testing` through `ctx.skills.register(...)`;
- points the skill resource base at `<artemis-root>/mcp_server` so relative references remain anchored to the upstream installation;
- returns Harness' disposer unchanged so lifecycle teardown remains native.

The adapter is intentionally separate from the main Host plugin until compatibility CI proves that the `skills` service is present in every Harness profile we choose to support. This avoids making the Android UI fail merely because an agent-skill service is absent from a profile.

## Why MCP is not routed through the UI plugin

The MCP lifecycle belongs to Harness' MCP bridge: process spawning, tool discovery, reconnects, cancellation and tool registration are already implemented there. Reimplementing that inside `dsh-artemis` would duplicate Harness and couple the UI to agent automation.

The UI and MCP can therefore fail independently:

| UI daemon | MCP | Meaning |
| --- | --- | --- |
| Ready | Connected | Full experience |
| Ready | Disconnected | Human panel works; model has no ARTEMIS tools |
| Offline | Connected | Model can still use MCP tools that recover/diagnose the environment |
| Offline | Disconnected | ARTEMIS unavailable |

The panel should eventually display both statuses separately.

## Target installation flow

1. ARTEMIS is installed normally.
2. The user installs `dsh-artemis` into a Harness profile.
3. The ARTEMIS root is provided explicitly or selected through a future native setting flow.
4. `dsh-artemis` validates that root and resolves its Python exactly like the ARTEMIS installer.
5. One `@deepseek-ai/dsh-mcp-client` row is generated/installed with `serverName: artemis`.
6. The upstream `mcp_server/rules.md` is registered as the native runtime skill `artemis-mobile-testing`.
7. Harness launches the official MCP server over stdio; the UI Host independently uses the loopback daemon API.

## Security

- Never route arbitrary MCP commands from browser input.
- `command`, `args` and `cwd` are Host/profile configuration, not browser-editable free-form fields.
- Do not scan arbitrary filesystem locations to guess an ARTEMIS installation.
- Do not copy unrelated ambient secrets into MCP config. Harness' MCP bridge deliberately scrubs secret-like environment variables.
- Keep ARTEMIS daemon access on loopback unless a supported remote mode is explicitly configured.
- Do not expose generic subprocess or shell execution to implement setup.
- Treat ARTEMIS rules as trusted local instructions only after validating the configured ARTEMIS root; do not load rule content from browser-provided paths or remote URLs.
