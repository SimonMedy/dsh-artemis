import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #110'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #112')
const roadmapMarker = '- [x] PR #110: Harness MCP Cordis rendering now quotes environment-map keys as JSON-compatible YAML scalars, preventing YAML metacharacters or embedded newlines in custom keys from injecting sibling configuration while preserving the existing generated ARTEMIS row.'
const roadmapAddition = roadmapMarker + '\n- [x] PR #112: Harness MCP Cordis rendering now requires `config.failOnStartupError` to be an actual boolean, rejecting truthiness coercion such as `"false"`, numbers, null or undefined while preserving explicit true/false policy rendering.'
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 110 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Harness MCP Cordis rendering quotes both environment keys and values as JSON-compatible YAML scalars, so hostile/custom env-key text cannot alter the emitted configuration structure.'
const releaseAddition = releaseMarker + '\n- Harness MCP Cordis startup-error policy fails closed on type mismatches: `failOnStartupError` must be a real boolean, so custom rows cannot silently invert policy through JavaScript truthiness.'
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 110 marker')
writeFileSync(releasePath, release)
