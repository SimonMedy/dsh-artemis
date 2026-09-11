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

We do not need ARTEMIS checked out for most tests. A fake server will cover its HTTP boundary quickly and deterministically. A real ARTEMIS + Android run belongs in a heavier smoke workflow.

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

Profiles install external package dependencies and compose plugin/bundle patch layers. The exact distributable shape for `dsh-artemis` is still a Phase 0 decision: we must prove whether a single package can cleanly own the bundle + Host plugin + `dsh.client` browser entry, or whether a tiny bundle package should depend on separate Host/Client packages.

## Local runtime testing

Once the package shape is proven, local/manual reproduction will be documented as an optional developer path, not as the primary validation mechanism. CI remains the source of reproducible build/test results.
