# AGENTS.md

Instructions for contributors and coding agents working on `dsh-artemis`.

## Project goal

Build a thin, native DeepSeek Harness plugin that exposes ARTEMIS Android state and controls in the Harness right sidebar. ARTEMIS MCP remains the agent-facing automation interface.

## Required project policies

Before changing runtime behavior, read and follow:

- [`SECURITY.md`](SECURITY.md) for trust boundaries, secrets, network/ADB safety and security-review triggers;
- [`docs/maintainability.md`](docs/maintainability.md) for module boundaries, compatibility discipline, dependency policy and definition of done;
- [`docs/testing.md`](docs/testing.md) for the required validation layer;
- [`docs/ui-native-conventions.md`](docs/ui-native-conventions.md) before changing sidebar/UI behavior or styling;
- [`docs/upstreams.md`](docs/upstreams.md) before coding against Harness or ARTEMIS.

Security, native UX consistency and maintainability are implementation requirements, not post-release cleanup tasks.

## Non-negotiable rules

1. Never guess DeepSeek Harness Cordis APIs, slots, registries, services or events. Inspect the pinned/current upstream revision first.
2. Never invent an ARTEMIS streaming API. Inspect the current ARTEMIS implementation and reuse supported mechanisms where practical.
3. Do not vendor or fork DeepSeek Harness or ARTEMIS inside this repository unless there is a documented reason.
4. Do not replace ARTEMIS MCP with plugin RPC.
5. Keep Host↔Client contracts JSON-safe unless a verified Harness primitive explicitly supports another transport.
6. No DOM hacks, private CSS selectors or iframe of the whole ARTEMIS console as the final architecture.
7. Isolate unstable upstream dependencies behind `src/host`, `src/client` and `src/shared` adapters.
8. Record tested upstream SHAs in `docs/upstreams.md` whenever compatibility changes.
9. Add tests for behavior and protocol boundaries. UI-visible features require an integration/E2E plan before being considered complete.
10. Prefer small reviewable commits and PRs.
11. Never expose generic shell/ADB execution to the browser; Host operations must use narrow validated commands.
12. Never leak credentials, environment secrets, raw stack traces or sensitive screen/trace data through Client RPC or logs.
13. Do not weaken CSP/CORS/origin/security controls as an integration shortcut.
14. New process-spawning, network-proxying, streaming, filesystem or credential-handling code requires an explicit review against `SECURITY.md`.
15. Reuse Harness primitives and `--dsw-*` theme tokens; do not introduce a parallel component/theme system for the Android panel.
16. Do not display guessed device metadata. UI fields require a verified adapter source.

## Upstream workflow

Before implementing against Harness or ARTEMIS:

- read `docs/upstreams.md`;
- inspect the exact pinned SHA;
- verify the relevant source file/signature;
- update `docs/investigation.md` with findings that affect architecture;
- avoid coding against comments or stale documentation when source disagrees.

## Intended source layout

```text
src/
  host/    # local machine / ARTEMIS adapter and Harness host bindings
  client/  # React/Harness UI adapter
  shared/  # DTOs, route/protocol constants and state models; no host-only imports
```

## Development quality

- Prefer project-owned typed/validated contracts at external boundaries.
- Keep Cordis/Harness and ARTEMIS-specific imports inside their adapters.
- Use argument-safe process APIs; do not interpolate device identifiers into shell command strings.
- Bound network/process calls with timeouts and validate external response shapes.
- Keep dependencies minimal and justify runtime additions.
- Add deterministic regression tests for fixed bugs whenever practical.
- Keep UI components focused on rendering/interactions; transport and normalization belong outside React components.
- Prefer Harness-provided controls/icons/tokens to local equivalents; document any necessary exception.

## Validation

Run the repository checks defined in `package.json`. GitHub Actions is the primary reproducible validation environment. Harness compatibility checks must use the pinned upstream checkout. User-visible UI requires browser E2E before the corresponding milestone is considered complete.
