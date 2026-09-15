import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const path = 'docs/roadmap.md'
let roadmap = fs.readFileSync(path, 'utf8')
roadmap = replaceExact(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #82; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #84; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #82**',
  '**Status: ONGOING — hardening merged through PR #84**',
  'phase 7 heading',
)
const anchor = '- [x] PR #82: the exported Host route helper now disposes every route once in reverse registration order and preserves the first cleanup error.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #83: roadmap and release-readiness evidence are refreshed through PR #82.\n- [x] PR #84: direct exported Host route registration now rolls back earlier routes on partial activation failure without masking the primary registration error.\n`,
  'phase 7 PR 83-84 history',
)
fs.writeFileSync(path, roadmap)
