import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #106'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #108')
const roadmapMarker = '- [x] PR #106: Host request and snapshot timeouts now fail fast above the signed 32-bit timer ceiling, while evidence adapters ignore overflowing custom timeout values and retain the bounded 2 s default instead of allowing Node to collapse them to 1 ms.'
const roadmapAddition = `${roadmapMarker}\n- [x] PR #108: exported browser live retry delays now reuse the shared timer ceiling for custom base/max values, preserving the existing bounded default backoff while rejecting overrange caller-provided delays; the checked browser bundle was regenerated with the pinned Harness and revalidated by full Harness/Cordis/Web/Chromium compatibility.`
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 106 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Host request/snapshot timeout configuration is bounded to 2,147,483,647 ms so Node timer overflow cannot silently shorten a request to 1 ms; evidence adapters fall back to their 2 s timeout when a custom client exceeds that range.'
const releaseAddition = `${releaseMarker}\n- Browser live retry helpers apply the same timer ceiling to caller-provided base/max delays, while the product defaults remain 750/1,500/3,000 ms and finite; the checked bundle remains pinned-Harness reproducible.`
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 106 marker')
writeFileSync(releasePath, release)
