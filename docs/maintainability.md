# Maintainable development practices

## Design for upstream churn

DeepSeek Harness is in developer preview. Keep volatile integrations behind narrow adapters instead of allowing Cordis/Harness internals to spread through feature code.

- `src/client`: owns Harness client/slot/registry specifics.
- `src/host`: owns Harness Host and ARTEMIS/Android I/O specifics.
- `src/shared`: owns stable project DTOs and protocol names only.

Feature components should depend on project-owned interfaces wherever practical.

## Prefer explicit contracts

- Define small DTOs instead of forwarding entire upstream responses.
- Parse/normalize external state once at the adapter boundary.
- Use discriminated states for Offline/Booting/Ready/Busy/Error rather than loosely related booleans.
- Give RPC methods narrow input/output contracts and version them deliberately if they become public.
- Avoid cross-module imports that bypass adapter boundaries.

## Keep modules small

A module should have one primary reason to change. Split transport, normalization, state orchestration and rendering when they evolve independently. Avoid utility dumping grounds and global mutable singletons.

## Dependency discipline

Before adding a dependency, prefer in order:

1. platform/runtime capability;
2. existing Harness-compatible dependency already present in the integration environment;
3. small maintained dependency with a clear purpose.

Document non-obvious runtime dependencies. Remove unused dependencies promptly.

## Compatibility documentation

Every change caused by Harness or ARTEMIS upstream drift should update:

- `docs/upstreams.md` for tested SHAs;
- `docs/investigation.md` when the upstream contract changed materially;
- tests/fixtures that encode the boundary.

Do not hide compatibility hacks. Put them in named adapter functions with comments identifying the upstream constraint and the revision where it was observed.

## Error handling

- Errors crossing Host→Client should be stable project-owned error shapes, not stack traces.
- Preserve causes in Host-side logs/tests where useful.
- Distinguish unavailable/offline conditions from malformed responses and unsupported upstream versions.
- Timeouts and cancellation should be explicit for network/process operations.
- Exported Host route registration helpers must roll back partial registration without masking the primary registration error, then return idempotent reverse-order disposers that attempt every cleanup and preserve the first cleanup error.

## Testing expectations

- Pure normalization/state logic: unit tests.
- ARTEMIS transport: fake-server integration tests.
- Harness contract: compile/install against pinned Harness.
- UI behavior: Playwright against real Harness + fake ARTEMIS.
- ADB/stream changes: dedicated real-environment smoke tests when infrastructure exists.

Bug fixes should add a regression test when the failure can be represented deterministically.

## Reviewability

- Keep PRs focused and explain architectural decisions that are not obvious from code.
- Avoid unrelated refactors in feature PRs.
- Prefer incremental migrations over flag-day rewrites.
- Do not knowingly introduce dead compatibility layers "for later".
- Keep generated artifacts out of git unless they are intentionally part of distribution.

## Documentation as part of the code

Documentation should describe decisions and externally relevant contracts, not duplicate implementation line by line. Source remains authoritative for exact signatures; docs explain why an integration choice exists and what assumptions it relies on.

## Definition of done

A feature is complete when:

- the relevant contracts are documented/verified;
- automated tests cover its important behavior;
- CI is green;
- errors and offline behavior are handled;
- security implications from `SECURITY.md` were considered;
- no avoidable upstream-private coupling leaked beyond adapters;
- user-visible functionality has an E2E validation path.
