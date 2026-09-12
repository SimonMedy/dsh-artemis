# Bounded device controls: upstream contract gate

Phase 3 intentionally stops at the upstream contract boundary instead of inventing a broader Android control surface.

Audited revisions:
- Google ARTEMIS: `086078819209c7139d6f833cfdc6d5cc80d9f19a`
- DeepSeek Harness: `c291e7961a515f6d7af9304e7fd1d257929aef26`

## What ARTEMIS exposes

The pinned ARTEMIS canonical action layer defines `press_key` actions for:
- Back → `back`
- Home → `home`
- Recents → `app_switch`

No canonical Rotate/orientation action was found in that action contract.

Those key actions are not exposed by the ARTEMIS MCP server that `dsh-artemis` configures. The configured `python -m mcp_server` surface remains the five mobile tools used by the agent integration: diagnose, run task, manage task, get device state and inspect trace.

ARTEMIS also ships a separate ADB MCP server with a much broader tool set: taps, swipes, text entry, app launch/stop, arbitrary key codes and other device operations. Registering that server in Harness merely to obtain three navigation keys would materially widen the agent authority and is therefore rejected.

The pinned Admin HTTP routers expose device status/streaming, tasks, sessions, steps/traces and replay surfaces, but no narrow Back/Home/Recents/Rotate endpoint.

## Rejected shortcuts

`dsh-artemis` will not:
- expose generic ADB or shell commands to the browser;
- accept arbitrary key codes, paths, packages or URLs as a device-control escape hatch;
- register the broad ARTEMIS ADB MCP server as an agent-facing dependency merely for UI controls;
- synthesize Back/Home/Recents through `mobile_run_task` natural-language prompts;
- invent a private ARTEMIS endpoint or reach into ARTEMIS implementation internals;
- claim Rotate support when the pinned canonical contract does not define it.

## Unblock condition

Phase 3 can resume when the supported ARTEMIS surface provides either:
1. narrow allow-listed controls through the configured main MCP/Admin API, or
2. a supported host-only transport whose callable operations can be restricted to audited constants.

Before UI exposure, each operation still needs explicit busy/error semantics, trust-boundary tests and real Harness/Chromium E2E coverage. Browser input must never be able to turn the control route into a generic command channel.
