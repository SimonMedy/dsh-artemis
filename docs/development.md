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

The Phase 0 loading proof uses one dual-face ESM package:

- package root (`.`): Cordis Host plugin;
- `./client`: browser plugin advertised through `dsh.client`;
- `cordis.patch.yml`: installable Bundle layer that inserts the Host plugin row.

The package intentionally exports plain ESM source while there is no JSX/TypeScript build requirement. This keeps the proof free of an unnecessary build dependency. When the real React panel is introduced, we will adopt the build pipeline required by the verified Harness client contract and commit its lockfile.

## Development sequence

1. Pin and inspect current upstream SHAs.
2. Verify the exact Harness extension surfaces needed by the next change.
3. Implement shared DTOs/protocol first when a Host↔Client boundary is involved.
4. Implement the Host adapter with fixture-driven tests.
5. Implement the native Harness client UI.
6. Validate against a pinned Harness checkout in GitHub Actions.
7. Run Playwright E2E with fake ARTEMIS for UI flows.
8. Add a real Android/ARTEMIS smoke workflow only when the feature needs it.

## Installation target

Current Harness documentation defines out-of-tree installation through:

```text
dsh plugin --profile <name> add <package-or-git-spec>
```

Profiles install external package dependencies and compose plugin/bundle patch layers. `dsh-artemis` now models that contract directly through `dsh.bundle.patch` plus `dsh.client.platform = web`; the pinned-Harness compatibility job remains the authority on whether this exact out-of-tree package shape loads successfully.

## Local runtime testing

Once the package shape is proven against the pinned Harness checkout, local/manual reproduction will be documented as an optional developer path, not as the primary validation mechanism. CI remains the source of reproducible build/test results.
