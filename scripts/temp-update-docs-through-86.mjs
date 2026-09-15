import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = fs.readFileSync(roadmapPath, 'utf8')
roadmap = replaceExact(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #84; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #86; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #84**',
  '**Status: ONGOING — hardening merged through PR #86**',
  'phase 7 heading',
)
const anchor = '- [x] PR #84: direct exported Host route registration now rolls back earlier routes on partial activation failure without masking the primary registration error.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #85: roadmap tracking is refreshed through PR #84.\n- [x] PR #86: Harness and ARTEMIS compatibility pins are refreshed only after branch-only HEAD probes and exact-SHA permanent CI/Harness/ARTEMIS gates; the checked-in browser bundle remains byte-identical under the new Harness pin.\n`,
  'phase 7 PR 85-86 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
const anchor2 = '- The pinned ARTEMIS runtime is installed from its upstream lockfile and exercised through the real daemon compatibility smoke without model credentials or device commands.\n'
readiness = replaceExact(
  readiness,
  anchor2,
  `${anchor2}- Supported Harness and ARTEMIS revisions were refreshed on 2026-09-15 only after branch-only candidate probes and then revalidated by the permanent exact-SHA CI/Harness/ARTEMIS gates; this remains daemon/browser compatibility evidence, not real Android device E2E.\n`,
  'release upstream refresh evidence',
)
fs.writeFileSync(readinessPath, readiness)
