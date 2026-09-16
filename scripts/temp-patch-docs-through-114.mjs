import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #112'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #114')
const roadmapMarker = '- [x] PR #112: Harness MCP Cordis rendering now requires `config.failOnStartupError` to be an actual boolean, rejecting truthiness coercion such as `"false"`, numbers, null or undefined while preserving explicit true/false policy rendering.'
const roadmapAddition = roadmapMarker + '\n- [x] PR #114: Harness MCP Cordis rendering now validates the pinned stdio schema shape for transport, serverName, command, args, env and cwd, preserves the upstream defaults for omitted args/env/cwd, and rejects malformed custom rows instead of coercing them.'
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 112 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Harness MCP Cordis startup-error policy fails closed on type mismatches: `failOnStartupError` must be a real boolean, so custom rows cannot silently invert policy through JavaScript truthiness.'
const releaseAddition = releaseMarker + '\n- Harness MCP Cordis stdio rows are validated against the pinned Harness schema before rendering: transport/serverName/command/args/env/cwd types are explicit, omitted args/env/cwd retain the upstream defaults, and malformed iterable/object inputs are not coerced.'
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 112 marker')
writeFileSync(releasePath, release)
