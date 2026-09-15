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
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #88; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #90; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #88**',
  '**Status: ONGOING — hardening merged through PR #90**',
  'phase 7 heading',
)
const anchor = '- [x] PR #88: Host ARTEMIS protocol normalization rejects implicit string/boolean coercion so malformed upstream values fail closed before reaching panel DTOs.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #89: roadmap and release-readiness evidence are refreshed through PR #88.\n- [x] PR #90: evidence/trace processing requires upstream \`step_number\` to be a non-negative safe integer and rejects malformed histories before latest-step selection or trace lookup.\n`,
  'phase 7 PR 89-90 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
const readinessAnchor = '- Host ARTEMIS protocol fields are type-checked without implicit string/boolean coercion, so malformed upstream values fail closed before they become panel DTO data.\n'
readiness = replaceExact(
  readiness,
  readinessAnchor,
  `${readinessAnchor}- Evidence and trace selection require every upstream \`step_number\` to be a non-negative safe integer before latest-step selection, preventing malformed session histories from silently falling back to response order or triggering downstream trace requests.\n`,
  'release evidence step-number invariant',
)
fs.writeFileSync(readinessPath, readiness)
