# Investigation log

Verified against the upstream revisions recorded in `docs/upstreams.md` unless otherwise noted.

## DeepSeek Harness

### External installation and composition — verified

- Harness profiles are composed from ordered bundle patch layers plus profile/user patches.
- External plugin/bundle packages are installed through `dsh plugin --profile <name> add <package-or-git-spec>`.
- A bundle package declares `dsh.bundle.patch` in `package.json`; its patch inserts/replaces Cordis config rows.
- A browser client plugin package joins the web module table by declaring `dsh.client` with `platform: "web"` and exporting `./client`.
- The client module loader serves built client bundles under the Harness web server and injects them into the browser boot graph.

Relevant current upstream docs/source:

- `apps/cli/reference/README.md`
- `packages/boot/app-boot/README.md`
- `docs/architecture.md`
- `docs/subsystems/client-modules.md`
- `packages/client/AGENTS.md`

Open packaging decision: prove whether our final external distribution should be one package carrying bundle + Host + Client faces or a small bundle package depending on separate runtime packages. Do not assume the in-tree client package checklist maps 1:1 to an out-of-tree package.

### Right sidebar — verified

- Right-sidebar types register a static definition with `ctx.sidebarRightTabs`.
- Their body is registered into the keyed seat `sidebar.right.pane.tab`, keyed by the type definition `id`.
- Shipped examples include guide, document preview and file tree.
- Registration lifetime is owned by the plugin/effect; returned disposers are expected to cleanly remove registrations.
- Type-private controls belong in the type body rather than panel chrome.

The current slot catalog also lists `sidebar.right.pane.tab`, `sidebar.right.pane.tab.title`, `sidebar.right.tab.guide` and `sidebar.right.tab.menu.item` under the right sidebar subtree.

Relevant source note: `.agents/notes/implemented/feature/2026-09-05-sidebar-text-preview-and-file-tree.md`.

Still required before implementation: inspect the concrete TypeScript registry and slot type declarations at the pinned SHA so we can compile against exact types rather than prose examples.

### Host↔Client — verified

Current Cordis plugin-development guidance defines package-private Client→Host JSON RPC as:

- Host registers with `harness.handle(method, handler)`.
- Client invokes with `host.call(method, args)`.
- Arguments and results must be lossless JSON.
- Internal Cordis/Harness runtime objects must not cross this boundary.
- A public Remote Service / `ctx.remote` should not be introduced merely for package-private communication.

This is appropriate for status, refresh, device metadata and manual commands. It is not our default transport for continuous image frames.

## ARTEMIS

### MCP boundary — verified

The MCP server exposes the intended agent-facing tools:

- `mobile_run_task`
- `mobile_manage_task`
- `mobile_get_device_state`
- `mobile_inspect_trace`
- `mobile_diagnose`

The trace status store is shared by the MCP server, admin console and worker processes. This supports our architectural rule that the graphical plugin must not replace MCP.

### Live screen — verified

- Admin console route `GET /api/stream/device-live` currently exposes multipart MJPEG.
- `GET /api/stream/device-state` exposes stream/device state.
- Frames are currently produced through ADB screenshot capture using `exec-out screencap -p`.

This is enough for an MVP candidate without inventing a protocol. It is not yet declared a stable external API by this project.

### Device/task/trace API selection — still open

The MCP README confirms strong task/device/trace abstractions, while ARTEMIS also ships an admin console and `packages/artemis-client`. Before Host implementation we still need to identify the cleanest non-MCP human-UI API boundary for:

- ARTEMIS process health;
- active device metadata beyond serial;
- task status/progress;
- trace/replay metadata;
- manual device controls.

We prefer a maintained client/API abstraction over parsing trace files or importing private Python internals.

## Remaining Phase 0 gates

1. Inspect exact TypeScript signatures for `sidebarRightTabs` and `sidebar.right.pane.tab` at the pinned Harness SHA.
2. Inspect exact Host and Client builtins/types for `harness.handle` and `host.call`.
3. Prove an out-of-tree package layout installable via `dsh plugin --profile web add ...`.
4. Inspect `packages/artemis-client` and admin-console router surfaces for device/task/trace/control operations.
5. Test Harness CSP/origin/runtime topology for direct consumption of ARTEMIS `localhost:8000` MJPEG.
6. Define reconnect and multi-device semantics.

## Decision gate

Framework-bound runtime code can begin once gates 1–3 are proven. Phase 1 uses a refreshable/static preview first. Continuous live screen remains a separate gate after browser networking behavior is tested.
