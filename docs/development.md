# Development workflow

## Do we clone DeepSeek Harness and ARTEMIS?

Not into this repository and not as vendored source.

For ordinary feature development, `dsh-artemis` stays standalone. Exact upstream revisions are recorded in `docs/upstreams.md` and source is inspected against those revisions.

For compatibility/integration CI, jobs may check out DeepSeek Harness and/or ARTEMIS into temporary sibling directories at the pinned SHAs. This gives us the real build/runtime surface without coupling our git history to upstream source.

Example CI workspace shape:

```text
work/
  dsh-artemis/       # this repository
  deepseek-harness/  # temporary checkout at pinned SHA
  artemis/           # optional temporary checkout at pinned SHA
```

Most tests do not require ARTEMIS checked out. Deterministic fixtures cover its verified HTTP boundary; a real ARTEMIS + Android run belongs in a heavier smoke workflow.

## Package shape

`dsh-artemis` is one dual-face package:

- package root (`.`): Cordis Host plugin;
- `./client`: DeepSeek Harness browser module-table artifact;
- `cordis.patch.yml`: installable Bundle layer that inserts the Host plugin row.

DeepSeek Harness' browser module system is not ESM/import-map based. `./client` must be a lazy-CJS factory bundle registered through `window.__ModuleLoader__.load({ id, factory })`.

Readable browser source lives under `src/client/`. The publishable artifact is `lib/client.js`.

## Generated browser bundle integrity

`lib/client.js` is **generated and checked in**. It is not hand-maintained.

The supported generator is `scripts/build-client.mjs`, using the pinned DeepSeek Harness checkout and its tsdown toolchain. The same DeepSeek Harness SHA is recorded in `docs/upstreams.md` and enforced by the build script when `DSH_HARNESS_SHA` is supplied.

A compatible build environment uses:

```text
DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness
DSH_HARNESS_SHA=<pinned DeepSeek Harness SHA>
DSH_ARTEMIS_CLIENT_OUT_DIR=/temporary/output
npm run bundle:client
```

Do not edit `lib/client.js` by hand. When `src/client`, shared browser contracts, or the pinned toolchain changes, rebuild the artifact and commit the generated file.

The DeepSeek Harness compatibility workflow enforces release integrity before packaging:

1. build the pinned DeepSeek Harness checkout;
2. rebuild `src/client` into a temporary output directory;
3. compare that generated `client.js` byte-for-byte with checked-in `lib/client.js`;
4. fail immediately on any drift;
5. only then run `npm pack`, install the package into an isolated DeepSeek Harness profile, compose Cordis, boot authenticated DeepSeek Harness Web and run Chromium E2E.

This order matters: CI must test the exact bundle that a direct `npm pack` from `main` would distribute, not an in-place artifact silently regenerated inside the CI workspace.

## Development sequence

1. Pin and inspect current upstream SHAs.
2. Verify the exact DeepSeek Harness extension surfaces needed by the next change.
3. Implement shared DTOs/protocol first when a Host↔Client boundary is involved.
4. Implement the Host adapter with fixture-driven tests.
5. Implement the native DeepSeek Harness client UI.
6. Rebuild and commit `lib/client.js` when browser source changes.
7. Validate the packaged Host and browser artifacts against pinned DeepSeek Harness expectations.
8. Run Playwright E2E with fake ARTEMIS for UI flows.
9. Add a real Android/ARTEMIS smoke workflow only when the feature needs it.

## Installation target

DeepSeek Harness supports out-of-tree installation through:

```text
dsh plugin --profile <name> add <package-or-git-spec>
```

Profiles install external package dependencies and compose plugin/bundle patch layers. `dsh-artemis` models that contract directly through `dsh.bundle.patch` plus `dsh.client.platform = web`.

## Local runtime testing

Once browser E2E is encoded in CI, local/manual reproduction remains an optional developer path, not the primary validation mechanism. GitHub Actions is the source of reproducible build/test evidence for the pinned upstream revisions.
