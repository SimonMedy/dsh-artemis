import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #114'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #116')
const roadmapMarker = '- [x] PR #114: Harness MCP Cordis rendering now validates the pinned stdio schema shape for transport, serverName, command, args, env and cwd, preserves the upstream defaults for omitted args/env/cwd, and rejects malformed custom rows instead of coercing them.'
const roadmapAddition = roadmapMarker + '\n- [x] PR #116: ARTEMIS rules-skill byte limits now require positive safe integers at both the loader and plugin-config boundaries, preserving the 512 KiB default while rejecting precision-loss limits outside JavaScript’s exact integer domain.'
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 114 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Harness MCP Cordis stdio rows are validated against the pinned Harness schema before rendering: transport/serverName/command/args/env/cwd types are explicit, omitted args/env/cwd retain the upstream defaults, and malformed iterable/object inputs are not coerced.'
const releaseAddition = releaseMarker + '\n- Rules-skill resource limits stay in the safe-integer domain at both exported loader and plugin configuration boundaries; the product default remains 512 KiB and overrange custom limits fail closed.'
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 114 marker')
writeFileSync(releasePath, release)
