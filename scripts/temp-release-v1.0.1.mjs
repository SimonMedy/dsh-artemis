import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const packagePath = 'package.json'
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
if (pkg.version !== '1.0.0') throw new Error(`package version: expected 1.0.0, found ${pkg.version}`)
pkg.version = '1.0.1'
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)

const readmePath = 'README.md'
let readme = readFileSync(readmePath, 'utf8')
const readmeCount = readme.split('v1.0.0').length - 1
if (readmeCount < 3) throw new Error(`README: expected multiple v1.0.0 references, found ${readmeCount}`)
readme = readme.replaceAll('v1.0.0', 'v1.0.1')
writeFileSync(readmePath, readme)

const changelogPath = 'CHANGELOG.md'
let changelog = readFileSync(changelogPath, 'utf8')
const changelogMarker = '## [1.0.0] - 2026-09-16'
const changelogSection = `## [1.0.1] - 2026-09-16

Compatibility refresh for the official DeepSeek Harness \`dsh-v0.1.6-alpha.1\` release.

### Compatibility

- Pin DeepSeek Harness to official tag \`dsh-v0.1.6-alpha.1\` (\`0a15e36e7f82b6ed45af6fa9759f29b40dcd965d\`).
- Revalidate repository CI, the real pinned ARTEMIS daemon, byte-for-byte browser bundle generation, package install, Cordis compose/remove/reinstall, authenticated Harness Web and Chromium Android-panel E2E.
- No dsh-artemis runtime behavior or public API changes; the checked browser bundle remains byte-identical under the official Harness tag.

### Upstream notes

- Harness can now persist MCP image result blocks as durable attachments for vision-capable models, but ARTEMIS \`mobile_get_device_state("screenshot")\` still returns a local \`file://\` JPEG reference rather than an MCP image block. Direct model screenshot handoff therefore remains gated.
- Harness ACP sessions now accept session-scoped \`mcpServers\`, which improves ACP/headless integration. The Web/Cordis plugin still has no public reversible active-profile mutation seam, so automatic Web profile MCP installation remains gated.

`
changelog = replaceOnce(changelog, changelogMarker, changelogSection + changelogMarker, 'changelog v1.0.0 marker')
writeFileSync(changelogPath, changelog)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
release = replaceOnce(
  release,
  '`dsh-artemis` v1.0.0 is the first stable GitHub-release scope. The source is MIT licensed and package metadata uses version `1.0.0`; npm registry publication remains intentionally disabled with `private: true`, so the supported v1.0.0 distribution path is the tagged GitHub release / Git spec.',
  '`dsh-artemis` v1.0.1 is the current stable GitHub-release scope. It is a compatibility-only refresh of the v1.0.0 contract for official DeepSeek Harness `dsh-v0.1.6-alpha.1`; npm registry publication remains intentionally disabled with `private: true`, so the supported distribution path is the tagged GitHub release / Git spec.',
  'release intro',
)
release = replaceOnce(
  release,
  '- Supported Harness and ARTEMIS revisions were refreshed on 2026-09-15 only after branch-only candidate probes and then revalidated by the permanent exact-SHA CI/Harness/ARTEMIS gates; this remains daemon/browser compatibility evidence, not real Android device E2E.',
  '- DeepSeek Harness support was refreshed on 2026-09-16 to official tag `dsh-v0.1.6-alpha.1` only after exact-SHA CI, real ARTEMIS daemon, byte-for-byte bundle, package/Cordis lifecycle and Chromium Android-panel E2E all passed; this remains daemon/browser compatibility evidence, not real Android device E2E.',
  'upstream evidence date',
)
release = replaceOnce(
  release,
  '- Keep model-image handoff gated until DeepSeek Harness exposes a supported public Session-owned image handoff for vision-capable models.',
  '- Harness `dsh-v0.1.6-alpha.1` now persists MCP image result blocks as durable model attachments when the active model supports images, but ARTEMIS screenshot state still returns a local `file://` JPEG reference rather than an MCP image block. Keep direct ARTEMIS model-image handoff gated until that upstream result becomes an MCP image or Harness exposes a general assistant-side image handoff seam.',
  'model image gate',
)
release = replaceOnce(
  release,
  '## v1.0.0 release decision',
  '## v1.0.1 compatibility decision\n\nv1.0.1 keeps the v1.0.0 runtime contract unchanged while moving the reviewed Harness compatibility pin to official tag `dsh-v0.1.6-alpha.1`. ACP session-scoped `mcpServers` are now available upstream for ACP/headless clients, but dsh-artemis Web installation continues to require explicit Cordis/profile configuration because no public reversible Web-profile mutation seam is available.\n\n## v1.0.0 release decision',
  'release decision heading',
)
writeFileSync(releasePath, release)

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
roadmap = replaceOnce(
  roadmap,
  '| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded task evidence PR #19, latest-trace drill-down PR #21 and ephemeral visual QA checkpoint PR #22 merged; replay and model-image handoff remain gated |',
  '| 4 — tasks, traces & visual QA | **PARTIAL** | Bounded evidence/trace/visual QA are merged; Harness `dsh-v0.1.6-alpha.1` now supports durable MCP image result attachments, but ARTEMIS screenshot state still returns `file://` and replay remains side-effect-gated |',
  'phase 4 table row',
)
roadmap = replaceOnce(
  roadmap,
  '| 5 — installation & agent experience | **PARTIAL** | MCP config + rules skill + truthful bounded setup/status UX are merged and reversible plugin lifecycle is proven; automatic profile mutation and vision affordances remain gated |',
  '| 5 — installation & agent experience | **PARTIAL** | MCP config/rules/setup UX and reversible plugin lifecycle are merged; Harness ACP now accepts session-scoped `mcpServers`, while automatic Web/Cordis profile mutation and direct ARTEMIS vision handoff remain gated |',
  'phase 5 table row',
)
roadmap = replaceOnce(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Hardening is merged through PR #116; v1.0.0 has an explicit MIT/tagged-GitHub stable scope, while real device/emulator smoke remains future dedicated-infrastructure validation and upstream-gated capabilities stay outside the stable contract |',
  '| 7 — compatibility & polish | **ONGOING** | Hardening is merged through PR #116 and official Harness `dsh-v0.1.6-alpha.1` compatibility through PR #119; v1.0.1 is the compatibility refresh while real device/emulator smoke and upstream-gated capabilities remain outside the stable contract |',
  'phase 7 table row',
)
roadmap = replaceOnce(
  roadmap,
  '- [ ] Keep model image handoff gated until DeepSeek Harness provides a supported public Session-owned image handoff and vision can be checked through `LlmModelInfo.inputModalities`.',
  '- [ ] Harness `dsh-v0.1.6-alpha.1` can persist MCP image result blocks for vision-capable models, but ARTEMIS `mobile_get_device_state("screenshot")` still returns a local `file://` JPEG reference. Keep direct model handoff gated until ARTEMIS emits MCP image content or a general supported assistant-side image handoff exists.',
  'phase 4 image gate',
)
roadmap = replaceOnce(
  roadmap,
  '- [ ] Keep profile installation explicit/non-destructive until DeepSeek Harness exposes a proven public reversible seam for patching the active profile with a sibling MCP row.',
  '- [ ] Harness ACP `session/new` / `session/resume` now accept session-scoped `mcpServers`, but the Web/Cordis plugin still lacks a proven public reversible seam for patching the active profile with a sibling MCP row. Keep Web profile installation explicit/non-destructive.',
  'phase 5 profile gate',
)
roadmap = replaceOnce(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #116**',
  '**Status: ONGOING — hardening merged through PR #116; official Harness compatibility through PR #119**',
  'phase 7 heading status',
)
const phase7Marker = '- [x] v1.0.0 release decision: MIT license, version `1.0.0`, tagged GitHub/Git-spec distribution, npm registry publication disabled, and known upstream/device-E2E limitations documented.'
const phase7Addition = `${phase7Marker}\n- [x] PR #119: official DeepSeek Harness `dsh-v0.1.6-alpha.1` pin passes repository CI, real ARTEMIS daemon compatibility, byte-identical client generation, package/Cordis remove/reinstall and Chromium Android-panel E2E without runtime changes.`
roadmap = replaceOnce(roadmap, phase7Marker, phase7Addition, 'phase 7 release marker')
writeFileSync(roadmapPath, roadmap)
