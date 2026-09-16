# Contributing to dsh-artemis

Thanks for contributing.

`dsh-artemis` sits on a privileged boundary between DeepSeek Harness, a local ARTEMIS runtime and Android. Changes should stay small, reviewable and fail closed.

## Before opening a pull request

1. Start from the current default branch.
2. Keep DeepSeek Harness and ARTEMIS integration based on the pinned upstream revisions in `docs/upstreams.md`.
3. Do not invent private upstream APIs or bypass missing seams with generic ADB/shell, arbitrary URL fetches, process execution or profile-file mutation.
4. Run:

   ```bash
   npm run check
   ```

5. If browser source under `src/client/` changes, regenerate `lib/client.js` only through the pinned Harness build described in `docs/development.md`.
6. Update documentation when a public contract, compatibility assumption, security boundary or release behavior changes.

## Pull request expectations

A pull request should explain:

- the concrete problem;
- the contract or upstream behavior it relies on;
- security/trust-boundary implications;
- tests added or changed;
- compatibility or E2E evidence required by the affected surface.

UI changes should include the relevant packaged Harness/Chromium E2E. ARTEMIS-facing runtime changes should pass the real pinned daemon compatibility workflow.

## Security-sensitive changes

Read `SECURITY.md` first. A focused security review is required for Host RPC/routes, device controls, process/ADB execution, URL/network proxying, screenshots/live streams, traces/replay, filesystem access, credentials and package installation/update behavior.

Do not include secrets, production device data or raw sensitive traces in tests, logs, screenshots or issues.

## Generated files

`lib/client.js` is generated and checked in. Never hand-edit it.

## Reporting bugs

Use a normal GitHub issue for non-sensitive bugs. For vulnerabilities, follow `SECURITY.md` and avoid publishing exploitable details before a fix is available.
