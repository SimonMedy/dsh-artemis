import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const archivePath = 'test/package-archive.test.mjs'
let archive = readFileSync(archivePath, 'utf8')
archive = replaceOnce(
  archive,
  "    'SECURITY.md',\n    'cordis.patch.yml',",
  "    'SECURITY.md',\n    'LICENSE',\n    'CHANGELOG.md',\n    'cordis.patch.yml',",
  'package archive release files',
)
writeFileSync(archivePath, archive)

const securityPath = 'SECURITY.md'
let security = readFileSync(securityPath, 'utf8')
security = replaceOnce(
  security,
  '`dsh-artemis` bridges a browser UI, a local Harness host process, ARTEMIS and Android/ADB. Treat that boundary as privileged: a bug in the plugin can execute device actions or expose local runtime data.\n\n## Reporting vulnerabilities',
  '`dsh-artemis` bridges a browser UI, a local Harness host process, ARTEMIS and Android/ADB. Treat that boundary as privileged: a bug in the plugin can execute device actions or expose local runtime data.\n\n## Supported versions\n\n| Version | Supported |\n| --- | --- |\n| 1.0.x | ✅ |\n| < 1.0 | ❌ |\n\n## Reporting vulnerabilities',
  'security supported versions',
)
writeFileSync(securityPath, security)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
release = replaceOnce(
  release,
  '`dsh-artemis` is intentionally unreleased. The repository must keep `package.json` at `private: true` and version `0.0.0` until an explicit release decision changes that policy in a dedicated reviewed pull request.',
  '`dsh-artemis` v1.0.0 is the first stable GitHub-release scope. The source is MIT licensed and package metadata uses version `1.0.0`; npm registry publication remains intentionally disabled with `private: true`, so the supported v1.0.0 distribution path is the tagged GitHub release / Git spec.',
  'release readiness intro',
)
release = replaceOnce(release, '## Remaining release gates', '## Known validation gaps and future gates', 'release gates heading')
release = replaceOnce(
  release,
  '- Run a supported real Android emulator/device smoke on dedicated infrastructure. The existing real-daemon smoke must not be described as device E2E.',
  '- Real Android emulator/device smoke remains a dedicated-infrastructure validation target and is not claimed as v1.0.0 evidence. The existing real-daemon smoke must not be described as device E2E.',
  'device smoke gate',
)
release = replaceOnce(
  release,
  '- Make an explicit project licensing decision before public package release, then keep the repository license file and package metadata consistent with that decision.',
  '- Keep the v1.0.0 MIT decision, repository `LICENSE` and package license metadata consistent in future releases.',
  'licensing gate',
)
release = replaceOnce(
  release,
  '## Release decision checklist\nA future release PR must deliberately remove the private/unreleased guard and, in the same review, choose the first real version, make and document the project licensing decision, keep repository/package license metadata consistent, confirm package metadata and distribution contents, document the supported upstream revisions, record the device/infrastructure evidence available at release time, and rerun all applicable CI/Harness/ARTEMIS gates on the final release candidate SHA.',
  '## v1.0.0 release decision\nThe first stable release deliberately selects version `1.0.0`, MIT licensing and tagged GitHub/Git-spec distribution while keeping npm registry publication disabled. Before creating tag `v1.0.0`, the final release-candidate SHA must pass package-content checks plus all applicable CI, Harness compatibility and ARTEMIS compatibility gates. Release notes must state the available evidence and the real-device/emulator E2E gap explicitly.',
  'release decision checklist',
)
writeFileSync(releasePath, release)

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
roadmap = replaceOnce(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #116; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Hardening is merged through PR #116; v1.0.0 has an explicit MIT/tagged-GitHub stable scope, while real device/emulator smoke remains future dedicated-infrastructure validation and upstream-gated capabilities stay outside the stable contract |',
  'roadmap phase 7 status',
)
roadmap = replaceOnce(
  roadmap,
  '- [x] PR #116: ARTEMIS rules-skill byte limits now require positive safe integers at both the loader and plugin-config boundaries, preserving the 512 KiB default while rejecting precision-loss limits outside JavaScript’s exact integer domain.\n- [x] Runtime-affecting PR heads continue to pass pinned DeepSeek Harness package/Cordis/Web/Chromium gates; ARTEMIS-facing changes also pass the real daemon compatibility gate.',
  '- [x] PR #116: ARTEMIS rules-skill byte limits now require positive safe integers at both the loader and plugin-config boundaries, preserving the 512 KiB default while rejecting precision-loss limits outside JavaScript’s exact integer domain.\n- [x] v1.0.0 release decision: MIT license, version `1.0.0`, tagged GitHub/Git-spec distribution, npm registry publication disabled, and known upstream/device-E2E limitations documented.\n- [x] Runtime-affecting PR heads continue to pass pinned DeepSeek Harness package/Cordis/Web/Chromium gates; ARTEMIS-facing changes also pass the real daemon compatibility gate.',
  'roadmap release decision evidence',
)
roadmap = replaceOnce(
  roadmap,
  '- [ ] Keep release/versioning independent of unpublished local state; the package remains private/`0.0.0` until an explicit release decision is made.',
  '- [ ] Keep future release/versioning/licensing/distribution changes explicit and reviewable; v1.0.0 uses MIT and tagged GitHub distribution while npm registry publication stays disabled.',
  'roadmap release gate',
)
writeFileSync(roadmapPath, roadmap)
