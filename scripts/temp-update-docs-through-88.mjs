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
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #86; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #88; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #86**',
  '**Status: ONGOING — hardening merged through PR #88**',
  'phase 7 heading',
)
const anchor = '- [x] PR #86: Harness and ARTEMIS compatibility pins are refreshed only after branch-only HEAD probes and exact-SHA permanent CI/Harness/ARTEMIS gates; the checked-in browser bundle remains byte-identical under the new Harness pin.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #87: roadmap and release-readiness evidence are refreshed through PR #86.\n- [x] PR #88: Host ARTEMIS protocol normalization rejects implicit string/boolean coercion so malformed upstream values fail closed before reaching panel DTOs.\n`,
  'phase 7 PR 87-88 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
const anchor2 = '- Browser JSON/evidence/overview/snapshot rejection paths explicitly cancel unread response bodies before reader acquisition without masking their primary errors.\n'
readiness = replaceExact(
  readiness,
  anchor2,
  `${anchor2}- Host ARTEMIS protocol fields are type-checked without implicit string/boolean coercion, so malformed upstream values fail closed before they become panel DTO data.\n`,
  'release strict protocol evidence',
)
fs.writeFileSync(readinessPath, readiness)
