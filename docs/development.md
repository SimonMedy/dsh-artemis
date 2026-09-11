# Development workflow

## Do we clone DeepSeek Harness and ARTEMIS?

Not into this repository and not as vendored source.

For ordinary feature development, `dsh-artemis` stays standalone. The exact upstream revisions are recorded in `docs/upstreams.md` and source is inspected through those revisions.

For compatibility/integration CI, jobs may check out DeepSeek Harness and/or ARTEMIS into temporary sibling directories at the pinned SHAs. This gives us the real build/runtime surface without coupling our git history to upstream source.

Example CI workspace shape:

```text
work/
  dsh-artemis/       # this repository
  deepseek-harness/  # temporary checkout at pinned SHA
  artemis/           # optional temporary checkout at pinned SHA
```

We do not need ARTEMIS checked out for most tests. A fake server covers its HTTP boundary quickly and deterministically. A real ARTEMIS + Android run belongs in a heavier smoke workflow.

## Package shape

`dsh-artemis` is one dual-face package:

- package root (`.`): Cordis Host plugin;
- `./client`: the Harness browser module-table artifact;
- `cordis.patch.yml`: installable Bundle layer that inserts the Host plugin row.

Harness' browser module system is not ESM/import-map based. `./client` must be a lazy-CJS factory bundle that registers through `window.__ModuleLoader__.load({ id, factory })`. The repository therefore publishes `lib/client.js`, while modular files under `src/client/` remain the readable source/contract split used during development and tests.

For this small pre-build-system MVP, `lib/client.js` is an intentional distribution artifact and is contract-tested in Node. As the browser client grows, replace this hand-maintained artifact with a pinned/reproducible tsdown build matching Harness' `clientBundle` preset semantics; do not introduce that toolchain without a lockfile and a CI reproducibility gate.

## Development sequence

1. Pin and inspect current upstream SHAs.
2. Verify the exact Harness extension surfaces needed by the next change.
3. Implement shared DTOs/protocol first when a Host↔Client boundary is involved.
4. Implement the Host adapter with fixture-driven tests.
5. Implement the native Harness client UI.
6. Validate the packaged Host and browser client artifacts against pinned Harness expectations.
7. Run Playwright E2E with fake ARTEMIS for UI flows.
8. Add a real Android/ARTEMIS smoke workflow only when the feature needs it.

## Installation target

Current Harness documentation defines out-of-tree installation through:

```text
dsh plugin --profile <name> add <package-or-git-spec>
```

Profiles install external package dependencies and compose plugin/bundle patch layers. `dsh-artemis` models that contract directly through `dsh.bundle.patch` plus `dsh.client.platform = web`.

## Local runtime testing

Once browser E2E is encoded in CI, local/manual reproduction remains an optional developer path, not the primary validation mechanism. CI is the source of reproducible build/test results.
