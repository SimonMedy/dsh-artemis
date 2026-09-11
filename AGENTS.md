# AGENTS.md

Instructions for contributors and coding agents working on `dsh-artemis`.

## Project goal

Build a thin, native DeepSeek Harness plugin that exposes ARTEMIS Android state and controls in the Harness right sidebar. ARTEMIS MCP remains the agent-facing automation interface.

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
  shared/  # DTOs, RPC names, state models; no host-only imports
```

No framework-specific source is added until the current Harness plugin loading/build contract is verified.

## Validation

Run the repository checks defined in `package.json`. GitHub Actions is the primary reproducible validation environment. Later phases should add Harness integration tests and browser E2E without requiring contributors to manually reproduce the full stack.
