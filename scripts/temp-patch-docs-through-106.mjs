import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const roadmapPath = 'docs/roadmap.md'
let roadmap = readFileSync(roadmapPath, 'utf8')
const statusNeedle = 'hardening merged through PR #104'
const statusCount = roadmap.split(statusNeedle).length - 1
if (statusCount !== 2) throw new Error(`roadmap status: expected two matches, found ${statusCount}`)
roadmap = roadmap.replaceAll(statusNeedle, 'hardening merged through PR #106')
const roadmapMarker = '- [x] PR #104: Host JSON/frame limits now require safe-integer bounds; live-frame configuration reserves worst-case multipart overhead so buffer arithmetic remains safe, and evidence adapters fall back to the bounded default instead of accepting unsafe custom JSON limits.'
const roadmapAddition = `${roadmapMarker}\n- [x] PR #106: Host request and snapshot timeouts now fail fast above the signed 32-bit timer ceiling, while evidence adapters ignore overflowing custom timeout values and retain the bounded 2 s default instead of allowing Node to collapse them to 1 ms.`
roadmap = replaceOnce(roadmap, roadmapMarker, roadmapAddition, 'roadmap PR 104 marker')
writeFileSync(roadmapPath, roadmap)

const releasePath = 'docs/release-readiness.md'
let release = readFileSync(releasePath, 'utf8')
const releaseMarker = '- Host-configured JSON and live-frame memory limits stay in the safe-integer domain; frame limits reserve worst-case multipart overhead before buffering, while evidence adapters ignore unsafe custom JSON limits and retain their bounded default.'
const releaseAddition = `${releaseMarker}\n- Host request/snapshot timeout configuration is bounded to 2,147,483,647 ms so Node timer overflow cannot silently shorten a request to 1 ms; evidence adapters fall back to their 2 s timeout when a custom client exceeds that range.`
release = replaceOnce(release, releaseMarker, releaseAddition, 'release PR 104 marker')
writeFileSync(releasePath, release)
