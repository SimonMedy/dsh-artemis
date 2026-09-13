import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const HARNESS_SHA = 'c291e7961a515f6d7af9304e7fd1d257929aef26'
const ARTEMIS_SHA = '086078819209c7139d6f833cfdc6d5cc80d9f19a'

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

function requireSingleMatch(source, pattern, label) {
  const matches = [...source.matchAll(pattern)]
  assert.equal(matches.length, 1, `${label} must appear exactly once`)
  return matches[0][1]
}

test('documented upstream SHAs match compatibility workflows and client build pin', async () => {
  const [docs, harnessWorkflow, artemisWorkflow, buildClient] = await Promise.all([
    text('docs/upstreams.md'),
    text('.github/workflows/harness-compat.yml'),
    text('.github/workflows/artemis-compat.yml'),
    text('scripts/build-client.mjs'),
  ])

  const documentedHarness = requireSingleMatch(
    docs,
    /`deepseek-ai\/deepseek-harness`\s*\|\s*`[^`]+`\s*\|\s*`([0-9a-f]{40})`/g,
    'documented DeepSeek Harness pin',
  )
  const documentedArtemis = requireSingleMatch(
    docs,
    /`google\/artemis`\s*\|\s*`[^`]+`\s*\|\s*`([0-9a-f]{40})`/g,
    'documented ARTEMIS pin',
  )
  const workflowHarness = requireSingleMatch(
    harnessWorkflow,
    /^\s*HARNESS_SHA:\s*([0-9a-f]{40})\s*$/gm,
    'DeepSeek Harness workflow pin',
  )
  const workflowArtemis = requireSingleMatch(
    artemisWorkflow,
    /^\s*ARTEMIS_SHA:\s*([0-9a-f]{40})\s*$/gm,
    'ARTEMIS workflow pin',
  )
  const buildHarness = requireSingleMatch(
    buildClient,
    /EXPECTED_HARNESS_SHA\s*=\s*'([0-9a-f]{40})'/g,
    'client build DeepSeek Harness pin',
  )

  assert.equal(documentedHarness, HARNESS_SHA)
  assert.equal(workflowHarness, HARNESS_SHA)
  assert.equal(buildHarness, HARNESS_SHA)
  assert.equal(documentedArtemis, ARTEMIS_SHA)
  assert.equal(workflowArtemis, ARTEMIS_SHA)
})
