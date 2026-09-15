import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const indexPath = 'docs/README.md'
let index = fs.readFileSync(indexPath, 'utf8')
index = replaceExact(
  index,
  '- [`roadmap.md`](roadmap.md): execution tracker with current phase status and exit criteria.\n',
  '- [`release-readiness.md`](release-readiness.md): explicit unreleased-package policy, proven release evidence and remaining release gates.\n- [`roadmap.md`](roadmap.md): execution tracker with current phase status and exit criteria.\n',
  'docs index release-readiness link',
)
fs.writeFileSync(indexPath, index)

const roadmapPath = 'docs/roadmap.md'
let roadmap = fs.readFileSync(roadmapPath, 'utf8')
roadmap = replaceExact(
  roadmap,
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle and cleanup hardening merged through PR #69; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke and remaining release polish stay open |',
  '| 7 — compatibility & polish | **ONGOING** | Security, privacy, response-boundary, lifecycle, CI/resource cleanup and release-readiness hardening merged through PR #74; real pinned Harness/ARTEMIS compatibility is proven, while real device/emulator smoke and remaining release polish stay open |',
  'phase 7 status row',
)
roadmap = replaceExact(
  roadmap,
  '**Status: ONGOING — hardening merged through PR #69**',
  '**Status: ONGOING — hardening merged through PR #74**',
  'phase 7 heading status',
)
const deliveredAnchor = '- [x] PR #69: browser snapshot cleanup contains synchronous cancellation and lock-release failures without masking primary body/protocol errors.\n'
const deliveredInsert = `${deliveredAnchor}- [x] PR #70: CI, Harness and ARTEMIS workflows cancel superseded runs per workflow + PR/ref without weakening final-SHA gates; runner-safety policy is documented and invariant-tested.\n- [x] PR #71: Harness/ARTEMIS failure diagnostics scan at most 8 MiB by default and report explicit truncation without emitting raw logs.\n- [x] PR #72: Host route activation/unload is transactional and idempotent; partial registration rollback and evidence/trace cleanup preserve primary failures while attempting all disposers.\n- [x] PR #73: package release state is machine-locked to private/0.0.0 until an explicit release decision, with a dedicated release-readiness checklist.\n- [x] PR #74: non-2xx live-stream HTTP responses still traverse cleanup, aborting internal request resources without changing the primary protocol error.\n`
roadmap = replaceExact(roadmap, deliveredAnchor, deliveredInsert, 'phase 7 PR 70-74 history')
fs.writeFileSync(roadmapPath, roadmap)
