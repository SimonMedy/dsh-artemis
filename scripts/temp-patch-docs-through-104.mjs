import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #102'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #104')
const roadmapMarker = '- [x] PR #102: the bounded panel adapter now requires `health.reachable` to be an actual boolean, rejecting truthiness coercion and aligning health metadata with the existing strict `device.busy` and `stream.connected` contracts.'
const roadmapAddition = `${roadmapMarker}\n- [x] PR #104: Host JSON/frame limits now require safe-integer bounds; live-frame configuration reserves worst-case multipart overhead so buffer arithmetic remains safe, and evidence adapters fall back to the bounded default instead of accepting unsafe custom JSON limits.`
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 102 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Browser-visible health metadata fails closed on type mismatches: `health.reachable` must be a real boolean at the bounded panel boundary, matching the strict boolean policy already applied to device and stream state fields.'
const releaseAddition = `${releaseMarker}\n- Host-configured JSON and live-frame memory limits stay in the safe-integer domain; frame limits reserve worst-case multipart overhead before buffering, while evidence adapters ignore unsafe custom JSON limits and retain their bounded default.`
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 102 marker')
writeFileSync(releasePath, release)
