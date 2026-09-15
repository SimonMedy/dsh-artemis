import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
readiness = replaceExact(
  readiness,
  '- Keep supported DeepSeek Harness and ARTEMIS revisions backed by reproducible compatibility evidence.\n',
  '- Keep supported DeepSeek Harness and ARTEMIS revisions backed by reproducible compatibility evidence.\n- Make an explicit project licensing decision before public package release, then keep the repository license file and package metadata consistent with that decision.\n',
  'release license gate',
)
readiness = replaceExact(
  readiness,
  'A future release PR must deliberately remove the private/unreleased guard and, in the same review, choose the first real version, confirm package metadata and distribution contents, document the supported upstream revisions, record the device/infrastructure evidence available at release time, and rerun all applicable CI/Harness/ARTEMIS gates on the final release candidate SHA.\n',
  'A future release PR must deliberately remove the private/unreleased guard and, in the same review, choose the first real version, make and document the project licensing decision, keep repository/package license metadata consistent, confirm package metadata and distribution contents, document the supported upstream revisions, record the device/infrastructure evidence available at release time, and rerun all applicable CI/Harness/ARTEMIS gates on the final release candidate SHA.\n',
  'release decision checklist',
)
fs.writeFileSync(readinessPath, readiness)

const roadmapPath = 'docs/roadmap.md'
let roadmap = fs.readFileSync(roadmapPath, 'utf8')
roadmap = replaceExact(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #74; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #76; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 summary',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #74**',
  '**Status: ONGOING — hardening merged through PR #76**',
  'phase 7 heading',
)
const anchor = '- [x] PR #74: non-2xx live-stream HTTP responses still traverse cleanup, aborting internal request resources without changing the primary protocol error.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #75: release-readiness documentation is indexed and the Phase 7 execution tracker is refreshed through PR #74.\n- [x] PR #76: rejected JSON responses in both core Host and evidence paths cancel pre-reader response bodies while preserving the primary protocol error.\n`,
  'phase 7 PR 75-76 history',
)
fs.writeFileSync(roadmapPath, roadmap)
