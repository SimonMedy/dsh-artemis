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
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #90; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #92; current Harness/ARTEMIS pins were re-probed and revalidated on 2026-09-15, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #90**',
  '**Status: ONGOING — hardening merged through PR #92**',
  'phase 7 heading',
)
const anchor = '- [x] PR #90: evidence/trace processing requires upstream `step_number` to be a non-negative safe integer and rejects malformed histories before latest-step selection or trace lookup.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #91: roadmap and release-readiness evidence are refreshed through PR #90.\n- [x] PR #92: rejected live-stream multipart metadata and reader-acquisition failures explicitly cancel unread ARTEMIS response bodies without masking the primary error.\n`,
  'phase 7 PR 91-92 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
const readinessAnchor = '- Evidence and trace selection require every upstream `step_number` to be a non-negative safe integer before latest-step selection, preventing malformed session histories from silently falling back to response order or triggering downstream trace requests.\n'
readiness = replaceExact(
  readiness,
  readinessAnchor,
  `${readinessAnchor}- Live multipart metadata rejection and reader-acquisition failure cancel unread ARTEMIS response bodies before parsing continues, while cleanup failures never replace the primary protocol or reader error.\n`,
  'release live cleanup evidence',
)
fs.writeFileSync(readinessPath, readiness)
