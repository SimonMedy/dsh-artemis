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
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #80; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #82; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #80**',
  '**Status: ONGOING — hardening merged through PR #82**',
  'phase 7 heading',
)
const anchor = '- [x] PR #80: browser JSON/evidence/overview/snapshot responses cancel unread bodies on pre-reader HTTP/metadata rejection while preserving primary errors; the pinned Harness bundle and Chromium E2E remain green.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #81: roadmap and release-readiness evidence are refreshed through PR #80.\n- [x] PR #82: the exported Host route helper now disposes every route once in reverse registration order and preserves the first cleanup error.\n`,
  'phase 7 PR 81-82 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
readiness = replaceExact(
  readiness,
  '- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, and cleanup failures do not mask primary registration failures.\n',
  '- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, cleanup failures do not mask primary registration failures, and exported Host registration helpers attempt every reverse-order cleanup exactly once while preserving the first cleanup error.\n',
  'release Host cleanup evidence',
)
fs.writeFileSync(readinessPath, readiness)
