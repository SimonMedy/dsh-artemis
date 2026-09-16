# ARTEMIS MCP integration with DeepSeek Harness

`dsh-artemis` has two independent integration planes. Keeping them separate is deliberate.

## Human UI plane

The DeepSeek Harness right-sidebar plugin talks to the local ARTEMIS daemon HTTP API through the `dsh-artemis` Host adapter:

```text
DeepSeek Harness browser
    │ same-origin dsh-artemis route
    ▼
dsh-artemis Host
    │ literal-loopback HTTP
    ▼
ARTEMIS daemon (default 127.0.0.1:8000)
```

This plane powers device status, screen preview/live view, task state and future manual controls. It does **not** expose ARTEMIS tools to the model.

## Agent MCP plane

DeepSeek Harness ships `@deepseek-ai/dsh-mcp-client`. One configured instance connects to one external MCP server and registers its tools as native DeepSeek Harness tools.

ARTEMIS' own installer resolves its preferred Python as follows:

- Windows: `<artemis-root>/.venv/Scripts/python.exe` when present;
- other platforms: `<artemis-root>/.venv/bin/python` when present;
- otherwise the Python process that is already running the ARTEMIS installer.

It then launches the official MCP server as `python -m mcp_server` from the ARTEMIS root and supplies:

```text
PYTHONUNBUFFERED=1
PYTHONPATH=<artemis-root>
ARTEMIS_DESKTOP_NOTIFY=true
```

`dsh-artemis` mirrors that stdio/process contract, but its configuration helper is a **Node.js** executable and cannot safely inherit "the Python running the ARTEMIS installer". It therefore resolves the interpreter more conservatively:

1. use `--python` / `ARTEMIS_PYTHON` when explicitly supplied and validated;
2. otherwise use the validated ARTEMIS local `.venv` interpreter for the current platform;
3. otherwise fail closed with a setup error.

The helper does not scan `PATH`, guess a system Python, use the Node executable as a fallback, or search arbitrary filesystem locations for an interpreter. This keeps generated MCP rows deterministic and reviewable while avoiding a dependency on `uv` being globally available when DeepSeek Harness starts.

DeepSeek Harness namespaces discovered tools by MCP server name, so the model sees `mcp__artemis__mobile_diagnose`, `mcp__artemis__mobile_run_task`, `mcp__artemis__mobile_manage_task`, `mcp__artemis__mobile_get_device_state`, and `mcp__artemis__mobile_inspect_trace`.

## MCP configuration generator

The package ships a non-destructive helper:

```bash
dsh-artemis-mcp-config --artemis-root /absolute/path/to/artemis
```

or:

```bash
ARTEMIS_ROOT=/absolute/path/to/artemis dsh-artemis-mcp-config
```

If the ARTEMIS checkout has no usable local `.venv`, an interpreter must be supplied explicitly:

```bash
dsh-artemis-mcp-config \
  --artemis-root /absolute/path/to/artemis \
  --python /absolute/path/to/python
```

or with `ARTEMIS_PYTHON`.

`--python` / `ARTEMIS_PYTHON` overrides `.venv` discovery and must point to an existing executable path. If neither an explicit interpreter nor the platform-specific ARTEMIS `.venv` interpreter exists, the helper fails closed rather than using Node or guessing a system Python.

The helper validates `pyproject.toml`, `mcp_server/__main__.py` and `mcp_server/rules.md`, resolves the interpreter under the rules above, and writes configuration to stdout. The default `cordis` format remains exactly one Cordis row. It does **not** scan arbitrary home directories, execute discovery shell commands, edit DeepSeek Harness profiles or modify ARTEMIS. Profile mutation will only be added after a DeepSeek Harness profile-patch workflow is proven safe and reversible.

### ACP session-scoped MCP format

Harness `dsh-v0.1.6-alpha.1` accepts MCP declarations on ACP `session/new` and `session/resume`. Generate a directly usable JSON fragment with:

```bash
dsh-artemis-mcp-config \
  --artemis-root /absolute/path/to/artemis \
  --format acp-json
```

The output has the form `{ "mcpServers": [...] }` and contains only the validated absolute Python command, `["-m", "mcp_server"]` arguments and the bounded ARTEMIS environment entries. It intentionally contains no `cwd`: ACP owns the Session workspace and applies it as the stdio MCP working directory. `PYTHONPATH=<artemis-root>` anchors module resolution to the validated ARTEMIS checkout so the server remains launchable from an unrelated Session workspace. The permanent ARTEMIS compatibility workflow exercises this exact foreign-cwd launch against the real pinned ARTEMIS installation.

This format is configuration generation only. It does not open an ACP connection, create/resume a Session, mutate a Web profile, or broaden browser privileges. Cordis remains the default output for the Web/profile workflow.

## Setup/status UX contract

The native panel reports only states that `dsh-artemis` can establish without private DeepSeek Harness APIs:

- **Human UI daemon** comes from the bounded loopback ARTEMIS health route and is shown independently as Ready/Offline.
- **ARTEMIS root** is shown as Validated only when this Host process received an explicit `ARTEMIS_ROOT` and the existing bounded root validator accepted it. If no root was supplied to the Host, the UI says Profile-managed rather than guessing whether a sibling MCP row exists.
- **Python setup** is shown as explicitly validated only when `ARTEMIS_PYTHON` was provided and exists. Otherwise interpreter resolution remains owned by the MCP profile/config generator.
- **Agent MCP runtime** is deliberately shown as Not observable on the pinned DeepSeek Harness revision. `@deepseek-ai/dsh-mcp-client` manages process lifecycle and reconnects but exposes no public connection-status snapshot for another plugin to consume.

No local root/interpreter path, validation exception, MCP command, environment contents or process details are returned to the browser. In particular, daemon health is never used as a proxy for an MCP Connected state.

## ARTEMIS behavioral rules as a native DeepSeek Harness skill

ARTEMIS' installer also installs `mcp_server/rules.md` for supported clients. DeepSeek Harness is not currently an ARTEMIS installer target, so `dsh-artemis` adapts that same file to DeepSeek Harness' native runtime skill registry instead of copying or rewriting it.

The adapter:
- validates the explicit ARTEMIS root using the same checks as MCP setup;
- reads exactly `<artemis-root>/mcp_server/rules.md`;
- enforces a bounded file size and valid UTF-8;
- preserves the Markdown body byte-for-text without editing its instructions;
- exposes it as the runtime skill `artemis-mobile-testing` through `ctx.skills.register(...)`;
- points the skill resource base at `<artemis-root>/mcp_server` so relative references remain anchored to the upstream installation;
- returns DeepSeek Harness' disposer unchanged so lifecycle teardown remains native.

The adapter is intentionally separate from the main Host plugin until compatibility CI proves that the `skills` service is present in every DeepSeek Harness profile we choose to support. This avoids making the Android UI fail merely because an agent-skill service is absent from a profile.

## Why MCP is not routed through the UI plugin

The MCP lifecycle belongs to DeepSeek Harness' MCP bridge: process spawning, tool discovery, reconnects, cancellation and tool registration are already implemented there. Reimplementing that inside `dsh-artemis` would duplicate DeepSeek Harness and couple the UI to agent automation.

The UI and MCP can therefore fail independently. The conceptual combinations remain useful for diagnosis, but the current pinned DeepSeek Harness revision does not expose the MCP column to `dsh-artemis` as a public runtime status API.

The panel therefore never claims Connected/Disconnected for MCP. It reports daemon status, bounded Host setup readiness, and the fact that MCP runtime status is not observable.

## Target installation flow

1. ARTEMIS is installed normally.
2. The user installs `dsh-artemis` into a DeepSeek Harness profile.
3. The ARTEMIS root is provided explicitly or selected through a future native setting flow.
4. `dsh-artemis` validates that root, uses an explicitly supplied Python when present, otherwise uses the validated ARTEMIS `.venv` interpreter, and fails closed if neither is available.
5. One `@deepseek-ai/dsh-mcp-client` row is generated/installed with `serverName: artemis`.
6. The upstream `mcp_server/rules.md` is registered as the native runtime skill `artemis-mobile-testing`.
7. DeepSeek Harness launches the official MCP server over stdio; the UI Host independently uses the literal-loopback daemon API.

## Security

- Never route arbitrary MCP commands from browser input.
- `command`, `args` and `cwd` are Host/profile configuration, not browser-editable free-form fields.
- Do not scan arbitrary filesystem locations or `PATH` to guess an ARTEMIS installation or Python interpreter.
- Do not copy unrelated ambient secrets into MCP config. DeepSeek Harness' MCP bridge deliberately scrubs secret-like environment variables.
- Keep ARTEMIS daemon access on literal loopback unless a supported remote mode is explicitly configured.
- Do not expose generic subprocess or shell execution to implement setup.
- Treat ARTEMIS rules as trusted local instructions only after validating the configured ARTEMIS root; do not load rule content from browser-provided paths or remote URLs.
