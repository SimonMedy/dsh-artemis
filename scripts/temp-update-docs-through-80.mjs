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
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #76; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #80; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke, licensing decision and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #76**',
  '**Status: ONGOING — hardening merged through PR #80**',
  'phase 7 heading',
)
const anchor = '- [x] PR #76: rejected JSON responses in both core Host and evidence paths cancel pre-reader response bodies while preserving the primary protocol error.\n'
roadmap = replaceExact(
  roadmap,
  anchor,
  `${anchor}- [x] PR #77: public package release is explicitly gated on a project licensing decision and consistent repository/package license metadata.\n- [x] PR #78: live multipart buffering uses bounded amortized growth so extreme chunk fragmentation cannot force full-frame copies on every read.\n- [x] PR #79: evidence selects the latest step with a one-pass scan and avoids retaining a second normalized copy of the full bounded session history.\n- [x] PR #80: browser JSON/evidence/overview/snapshot responses cancel unread bodies on pre-reader HTTP/metadata rejection while preserving primary errors; the pinned Harness bundle and Chromium E2E remain green.\n`,
  'phase 7 PR 77-80 history',
)
fs.writeFileSync(roadmapPath, roadmap)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
const provenAnchor = '- CI failure diagnostics are aggregated/redacted and scan only a bounded log prefix.\n'
readiness = replaceExact(
  readiness,
  provenAnchor,
  `${provenAnchor}- Live multipart frame accumulation is bounded with amortized buffer growth, and bounded evidence selection does not retain a second normalized full-history array.\n- Browser JSON/evidence/overview/snapshot rejection paths explicitly cancel unread response bodies before reader acquisition without masking their primary errors.\n`,
  'release proven resource bounds',
)
fs.writeFileSync(readinessPath, readiness)
