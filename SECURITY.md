# Security policy

`dsh-artemis` bridges a browser UI, a local Harness host process, ARTEMIS and Android/ADB. Treat that boundary as privileged: a bug in the plugin can execute device actions or expose local runtime data.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.1.x | ✅ |
| 1.0.x | ✅ |
| < 1.0 | ❌ |

## Reporting vulnerabilities

Do not publish exploitable security issues in a public issue before a fix is available. Use GitHub's private vulnerability reporting / Security Advisory flow when enabled for this repository. If private reporting is unavailable, contact the repository owner privately and provide the smallest reproducible description possible.

Include:

- affected revision/version;
- attack preconditions;
- expected vs actual behavior;
- reproduction steps or a minimal proof of concept;
- potential impact;
- suggested mitigation when known.

Do not include real credentials, user data, device tokens, API keys, session material or unrelated private information.

## Security boundaries

### Browser ↔ Harness Host

- Treat every Client→Host request as untrusted input even when the UI is served by Harness.
- Expose a narrow allow-list of RPC methods; never expose arbitrary shell, arbitrary ADB command, filesystem path, URL fetch or process execution primitives to the browser.
- Validate method arguments at the Host boundary and return JSON-safe DTOs rather than internal objects.
- Destructive or state-changing device actions must be explicit operations with bounded arguments.

### Harness Host ↔ ARTEMIS

- Default ARTEMIS endpoints to loopback/local connectivity. Do not silently bind proxy services to public interfaces.
- Apply connection and response timeouts; failures must degrade to an Offline/Error state rather than block the Host indefinitely.
- Do not forward arbitrary user-provided URLs to an HTTP client. ARTEMIS endpoints must come from validated configuration.
- Treat ARTEMIS responses as untrusted: validate shapes, sizes and expected content types before exposing them to the Client.

### Android / ADB

- Never add a generic `adb shell` RPC surface.
- Device controls must map to a finite set of reviewed commands (for example Back/Home/Recents/Rotate) with no string interpolation into shell commands.
- Do not automatically enable remote ADB, alter device security settings, install certificates or weaken emulator/device protections.
- Device serials and AVD names are identifiers, not shell fragments; pass them through argument-safe process APIs when direct process execution is ever needed.

### Screen, task and trace data

- Android screen frames and traces can contain secrets, personal data and application content. Do not persist them by default.
- Logs must not contain raw screenshots, complete trace payloads, credentials, tokens or sensitive app data.
- CI artifacts containing screenshots/traces must be produced only when useful, use short retention, and never contain production credentials or private devices.
- Define explicit response/frame size limits before proxying binary or multipart data.

## Secrets and configuration

- Never commit credentials or tokens.
- Never add secrets merely to make ordinary PR tests pass; default tests must use fixtures/fakes.
- Environment variables containing credentials must stay Host-side and must not be serialized into Client configuration or RPC responses.
- Document any future credential requirement and scope it to the minimum permission needed.

## Browser security

- Do not solve integration problems by disabling CSP, CORS, origin checks or browser sandbox protections globally.
- Avoid raw HTML injection. User/device/task strings must be rendered as data, not markup.
- Opening external trace/replay URLs must use validated/constructed local URLs rather than arbitrary untrusted destinations.
- The live-screen design must be reviewed for origin/CSP implications before implementation.

## Dependencies and supply chain

- Keep dependencies minimal and justified.
- Prefer maintained packages already compatible with Harness where possible.
- Commit lockfiles once runtime dependencies are introduced; CI must use frozen/reproducible installs.
- Pin GitHub Actions to immutable full commit SHAs before the project reaches release-ready status; upgrades should be deliberate and reviewable.
- Do not execute downloaded scripts, binaries or package lifecycle hooks from untrusted inputs.
- Upstream Harness and ARTEMIS compatibility is tracked by full commit SHA in `docs/upstreams.md`.

## Secure failure behavior

When ARTEMIS, ADB or an upstream API behaves unexpectedly:

1. fail closed for state-changing operations;
2. surface a bounded, human-readable error;
3. avoid leaking raw environment/process details to the browser;
4. preserve enough structured diagnostic information for local logs/tests;
5. never fall back to a more privileged generic command path.

## Security review triggers

A focused security review is required for changes that introduce or modify:

- Host RPC methods;
- process spawning / ADB invocation;
- URL/network proxying;
- screen-stream handling;
- trace/replay loading;
- filesystem access;
- credential handling;
- package installation/update mechanisms;
- new third-party runtime dependencies.
