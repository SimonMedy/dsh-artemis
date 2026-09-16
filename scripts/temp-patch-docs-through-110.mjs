import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #108'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #110')
const roadmapMarker = '- [x] PR #108: exported browser live retry delays now reuse the shared timer ceiling for custom base/max values, preserving the existing bounded default backoff while rejecting overrange caller-provided delays; the checked browser bundle was regenerated with the pinned Harness and revalidated by full Harness/Cordis/Web/Chromium compatibility.'
const roadmapAddition = `${roadmapMarker}\n- [x] PR #110: Harness MCP Cordis rendering now quotes environment-map keys as JSON-compatible YAML scalars, preventing YAML metacharacters or embedded newlines in custom keys from injecting sibling configuration while preserving the existing generated ARTEMIS row.`
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 108 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Browser live retry helpers apply the same timer ceiling to caller-provided base/max delays, while the product defaults remain 750/1,500/3,000 ms and finite; the checked bundle remains pinned-Harness reproducible.'
const releaseAddition = `${releaseMarker}\n- Harness MCP Cordis rendering quotes both environment keys and values as JSON-compatible YAML scalars, so hostile/custom env-key text cannot alter the emitted configuration structure.`
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 108 marker')
writeFileSync(releasePath, release)
