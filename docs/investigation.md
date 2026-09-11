# Investigation log

Verified against the upstream revisions recorded in `docs/upstreams.md` unless otherwise noted.

## DeepSeek Harness

### External installation and composition — verified

- Harness profiles are composed from ordered bundle patch layers plus profile/user patches.
- External plugin/bundle packages are installed through `dsh plugin --profile <name> add <package-or-git-spec>`.
- A bundle package declares `dsh.bundle.patch` in `package.json`; its patch inserts/replaces Cordis config rows.
- A browser client plugin package joins the web module table by declaring `dsh.client` with `platform: "web"` and exporting `./client`.
- The client module loader serves built client bundles under the Harness web server and injects them into the browser boot graph.

Open packaging decision: prove the smallest single-package bundle + Host + Client layout from an out-of-tree install. We will not split packages until an upstream constraint requires it.

### Right sidebar — exact current contract verified

At Harness `c291e7961a515f6d7af9304e7fd1d257929aef26`:

- `SidebarRightTabDefinition` requires `id`, `kind`, and `title(address)`; optional fields are `patterns`, `priority`, `canOpen`, and `guide`.
- `priority` is one of `extension | builtin | fallback`; an external type defaults to `extension`.
- `ctx.sidebarRightTabs.register(definition)` returns a disposer and should be effect-owned.
- Shipped `files` registers its definition with `ctx.effect(() => ctx.sidebarRightTabs.register(...))`.
- Its body uses `ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: FILES_ID, ... }, FilesBody))`.
- The optional chip title uses the same pattern for `sidebar.right.pane.tab.title`.
- A page-style Android tab does not need an address pattern. Its `kind` can therefore be `android`, with a package-unique definition `id`.

This is now strong enough to implement the Client registration against the pinned revision.

### Static Host↔Client transport — route seam selected

The earlier dynamic-plugin guidance around `harness.handle(...)` / `host.call(...)` is not being adopted as the static-package transport. That API is documented in the dynamic Cordis plugin workflow and would create unnecessary ambiguity for a distributable package.

Harness' static Host has an official composition seam in `@deepseek-ai/dsh-host-webserver`:

- `ctx.webServer.register({ kind: 'exact' | 'prefix', path, handler })` registers a named same-origin HTTP route and returns a disposer;
- feature plugins are explicitly expected to own their routes;
- the server defaults to loopback-only and itself provides no global auth/origin policy;
- route owners retain full response ownership.

Recommended `dsh-artemis` transport for the Web profile:

```text
Harness Client
   │ same-origin /dsh-artemis/v1/*
   ▼
Harness webServer route owned by dsh-artemis Host
   │ loopback HTTP
   ▼
ARTEMIS :8000
```

Benefits: ARTEMIS stays Host-side, browser CORS/CSP does not need to be weakened, routes are narrow and can enforce method/size/error policy. This also provides a future clean streaming proxy without sending image frames through JSON RPC.

The initial namespace will avoid Harness' `/api` carrier prefix; `/dsh-artemis/v1` is reserved for project-owned routes.

### Host route security implication

Because `dsh-host-webserver` has no server-wide authentication/origin policy, every `dsh-artemis` route must validate HTTP methods and must never expose generic proxying, arbitrary URLs, shell, or ADB commands. State-changing routes will require an explicit review before introduction.

## ARTEMIS

### MCP boundary — verified

The MCP server remains the intended agent-facing tool boundary (`mobile_run_task`, `mobile_manage_task`, `mobile_get_device_state`, `mobile_inspect_trace`, `mobile_diagnose`). The graphical plugin does not replace it.

### Official remote client boundary — verified

`packages/artemis-client` is an official dependency-free Python remote SDK. Its README states that the daemon administration API currently has no built-in remote authentication and should not be exposed directly to the public internet.

Version 0.1 documents these baseline daemon endpoints:

- `GET /api/status`
- `GET /api/devices`
- `GET /api/system/readiness`
- `POST /api/run`
- `GET /api/sessions/{session_id}`
- `POST /api/stop`

Its `Device` normalization accepts `serial | device_serial | device_id`, `state | status`, optional `model`/`product`, and `busy | is_busy`; busy-like states include `busy`, `running`, and `locked`. Our Host adapter mirrors that compatibility behavior without importing Python.

### Live screen — verified, lower stability boundary

- Admin console route `GET /api/stream/device-live` exposes multipart MJPEG.
- `GET /api/stream/device-state` returns `{ connected, serial, live_stream_url }`.
- Frames are produced through ADB screenshot capture using `exec-out screencap -p`.
- These routes are admin-console surfaces, not listed in `artemis-client`'s baseline compatibility set, so they are isolated from the stable device/task adapter.

## Remaining Phase 0 gates

1. Prove the out-of-tree package/bundle layout against a pinned Harness checkout in Actions.
2. Verify the minimal imports/dependency versions needed to compile the Android right-sidebar Client package externally.
3. Implement and test the narrow `/dsh-artemis/v1` Host routes over the framework-neutral ARTEMIS adapter.
4. Verify Electron behavior separately: Harness documents that Electron loads UI over `file://` and carries fetch via an IPC bridge, so the browser webServer route assumption is Web-profile-specific until tested.
5. Define configuration semantics for ARTEMIS base URL/token before supporting non-loopback deployment.

## Decision gate

The ARTEMIS HTTP adapter and Web-profile Host route can now be implemented without guessing. The React panel waits only on the external package/build proof. Continuous live screen remains a separate phase after the same-origin proxy behavior is validated.
