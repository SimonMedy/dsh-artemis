import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const packagePath = 'package.json'
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
if (pkg.version !== '1.0.1') throw new Error(`package version: expected 1.0.1, found ${pkg.version}`)
pkg.version = '1.1.0'
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)

const readmePath = 'README.md'
let readme = readFileSync(readmePath, 'utf8')
const versionRefs = readme.split('v1.0.1').length - 1
if (versionRefs < 3) throw new Error(`README: expected multiple v1.0.1 references, found ${versionRefs}`)
readme = readme.replaceAll('v1.0.1', 'v1.1.0')
readme = replaceOnce(
  readme,
  '- ARTEMIS MCP configuration generation with strict stdio schema validation.\n- Optional ARTEMIS behavioral rules as a native Harness skill.',
  '- ARTEMIS MCP configuration generation with strict stdio schema validation.\n- ACP/headless session-scoped ARTEMIS MCP configuration through `--format acp-json`, with Cordis kept as the default Web/profile format.\n- Optional ARTEMIS behavioral rules as a native Harness skill.',
  'README v1.1 capability list',
)
writeFileSync(readmePath, readme)

const changelogPath = 'CHANGELOG.md'
let changelog = readFileSync(changelogPath, 'utf8')
const changelogMarker = '## [1.0.1] - 2026-09-16'
const changelogSection = `## [1.1.0] - 2026-09-16

First feature release after the stable v1.0 line, adding validated session-scoped ARTEMIS MCP configuration for DeepSeek Harness ACP/headless clients.

### Added

- Add \`dsh-artemis-mcp-config --format acp-json\` to emit a directly reusable \`{ "mcpServers": [...] }\` fragment for Harness ACP \`session/new\` / \`session/resume\`.
- Keep Cordis as the unchanged default output for Web/profile workflows.
- Validate ACP stdio shape using the same reviewed ARTEMIS root/Python selection as the Cordis generator.
- Add real pinned-ARTEMIS CI coverage that launches \`python -m mcp_server\` from a foreign Session working directory, proving the generated absolute Python command + bounded \`PYTHONPATH\` contract works independently of the ACP workspace.

### Security and architecture

- The new format only prints configuration; it does not open ACP, create/resume Sessions or edit profiles.
- No browser route, Host privilege, generic shell/ADB surface or Web/Cordis profile mutation is added.
- ACP environment entries are validated and limited to the already reviewed ARTEMIS configuration values.

### Compatibility

- Based on official DeepSeek Harness \`dsh-v0.1.6-alpha.1\` and the existing pinned ARTEMIS revision.
- Feature PR #121 passed repository CI, real ARTEMIS compatibility including the foreign-cwd MCP smoke, and the full packaged Harness/Cordis/Web/Chromium compatibility gate.

### Remaining limitations

- Web/Cordis profile installation remains explicit until Harness exposes a public reversible active-profile mutation seam.
- Direct ARTEMIS screenshot → model handoff remains gated because ARTEMIS screenshot state still returns a local \`file://\` JPEG reference instead of MCP image content.
- Replay and broader device controls remain gated as documented in the roadmap.
- Real Android device/emulator E2E remains a dedicated-infrastructure target.

`
changelog = replaceOnce(changelog, changelogMarker, changelogSection + changelogMarker, 'changelog v1.0.1 marker')
writeFileSync(changelogPath, changelog)

const securityPath = 'SECURITY.md'
let security = readFileSync(securityPath, 'utf8')
security = replaceOnce(
  security,
  '| 1.0.x | ✅ |\n| < 1.0 | ❌ |',
  '| 1.1.x | ✅ |\n| 1.0.x | ✅ |\n| < 1.0 | ❌ |',
  'security supported versions',
)
writeFileSync(securityPath, security)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
release = replaceOnce(
  release,
  '`dsh-artemis` v1.0.1 is the current stable GitHub-release scope. It is a compatibility-only refresh of the v1.0.0 contract for official DeepSeek Harness `dsh-v0.1.6-alpha.1`; npm registry publication remains intentionally disabled with `private: true`, so the supported distribution path is the tagged GitHub release / Git spec.',
  '`dsh-artemis` v1.1.0 is the current stable GitHub-release scope. It adds validated ACP/headless session-scoped ARTEMIS MCP configuration on top of the v1.0.x runtime and compatibility baseline; npm registry publication remains intentionally disabled with `private: true`, so the supported distribution path is the tagged GitHub release / Git spec.',
  'release readiness current stable intro',
)
release = replaceOnce(
  release,
  '## v1.0.1 compatibility decision',
  '## v1.1.0 feature decision\n\nv1.1.0 adds the PR #121 ACP/headless `mcpServers` generator while keeping Cordis as the default Web/profile format. The release does not add Session/profile mutation, browser privileges or new device-control surfaces. Its feature evidence includes exact-shape unit/CLI tests, a real pinned ARTEMIS foreign-cwd stdio launch, and full Harness package/Cordis/Web/Chromium compatibility.\n\n## v1.0.1 compatibility decision',
  'release v1.1 decision section',
)
writeFileSync(releasePath, release)
