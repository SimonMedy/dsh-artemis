# ARTEMIS MCP integration with DeepSeek Harness

`dsh-artemis` has two independent integration planes. Keeping them separate is deliberate.

## 1. Human UI plane

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

## 2. Agent MCP plane

DeepSeek Harness already ships an MCP bridge: `@deepseek-ai/dsh-mcp-client`. One configured instance connects to one external MCP server and registers its tools as native Harness tools.

ARTEMIS' official server supports stdio and is started with either:

```bash
python -m mcp_server
```

or, from an ARTEMIS checkout:

```bash
uv run artemis mcp
```

For Harness we use the official server over stdio. A minimal Cordis row is:

```yaml
- id: mcp-artemis
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: artemis
    transport: stdio
    command: uv
    args: ['run', 'artemis', 'mcp']
    cwd: '/absolute/path/to/artemis'
    failOnStartupError: false
```

`cwd` must point at the ARTEMIS installation/checkout whose `uv run artemis mcp` works. We do not vendor or reinstall ARTEMIS inside `dsh-artemis`.

Harness namespaces discovered tools by MCP server name, so the model sees:

```text
mcp__artemis__mobile_diagnose
mcp__artemis__mobile_run_task
mcp__artemis__mobile_manage_task
mcp__artemis__mobile_get_device_state
mcp__artemis__mobile_inspect_trace
```

The raw ARTEMIS tool names remain unchanged on the MCP wire. The `mcp__artemis__` prefix is a Harness-side collision-avoidance namespace.

## Why the MCP is not routed through the UI plugin

The MCP lifecycle belongs to Harness' MCP bridge: process spawning, tool discovery, reconnects, cancellation and tool registration are already implemented there. Reimplementing that inside `dsh-artemis` would duplicate Harness and couple the UI to agent automation.

The UI and MCP can therefore fail independently:

| UI daemon | MCP | Meaning |
| --- | --- | --- |
| Ready | Connected | Full experience |
| Ready | Disconnected | Human panel works; model has no ARTEMIS tools |
| Offline | Connected | Model may diagnose/start work, while the admin daemon UI is unavailable |
| Offline | Disconnected | ARTEMIS unavailable |

The panel should eventually display both statuses separately.

## ARTEMIS behavioral rules

ARTEMIS' own installer does more than register an MCP server: it also installs its `mcp_server/rules.md` instructions for supported IDEs. Harness is not currently an ARTEMIS installer target, so `dsh-artemis` must provide the equivalent behavior through Harness' supported instruction/skill mechanism.

Do not silently rewrite those rules. The integration should track the pinned ARTEMIS version and preserve its guidance, including diagnosis-first behavior, Flash/Pro routing and live UI exploration discipline.

## Installation strategy for dsh-artemis

The target user experience is:

1. ARTEMIS is installed normally by the user.
2. The user installs `dsh-artemis` into a Harness profile.
3. `dsh-artemis` detects or is given the ARTEMIS root/interpreter.
4. The integration adds/configures one `@deepseek-ai/dsh-mcp-client` row with `serverName: artemis`.
5. The ARTEMIS rules are made available through the native Harness instruction mechanism.
6. Harness starts; the MCP bridge launches the official ARTEMIS MCP server over stdio.
7. The UI Host independently connects to the ARTEMIS HTTP daemon on loopback.

Automatic mutation of the user's Harness profile is **not yet implemented**. Until the config/discovery flow is proven cross-platform, the MCP row above is the supported reference contract.

## Security

- Never route arbitrary MCP commands from browser input.
- `command`, `args` and `cwd` are Host/profile configuration, not browser-editable free-form fields.
- Do not copy ARTEMIS API keys into Harness MCP configuration unless ARTEMIS explicitly requires an override. The child environment behavior of Harness' MCP bridge is security-sensitive and intentionally scrubs secret-like ambient variables.
- Keep the ARTEMIS daemon on loopback unless the user explicitly configures a supported remote setup.
- Do not expose a generic subprocess or shell endpoint to implement MCP setup.
