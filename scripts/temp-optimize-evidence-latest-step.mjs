import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const sourcePath = 'src/host/artemis-evidence.mjs'
let source = fs.readFileSync(sourcePath, 'utf8')
source = replaceExact(
  source,
  `export async function buildEvidence(client) {\n  const task = await getTaskStatus(client)\n  const steps = task.sessionId ? await getSessionSteps(client, task.sessionId) : []\n  return Object.freeze({\n    version: DSH_ARTEMIS_PROTOCOL_VERSION,\n    task,\n    latestStep: selectLatestStep(steps),\n  })\n}`,
  `export async function buildEvidence(client) {\n  const task = await getTaskStatus(client)\n  const rawSteps = task.sessionId ? await getRawSessionSteps(client, task.sessionId) : []\n  const selected = selectLatestByStepNumber(rawSteps, normalizeStep)\n  return Object.freeze({\n    version: DSH_ARTEMIS_PROTOCOL_VERSION,\n    task,\n    latestStep: selected?.normalized ?? null,\n  })\n}`,
  'buildEvidence latest-step scan',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/evidence.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

test('evidence selects the latest step from a large unordered bounded history', async () => {
  const history = Array.from({ length: 2048 }, (_, index) => ({
    step_number: 2048 - index,
    action_taken: { action: \`action-\${2048 - index}\` },
    generic_tools: Array.from({ length: 8 }, (_, traceIndex) => ({ name: \`trace-\${traceIndex}\`, type: 'tool', status: 'done' })),
  }))
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: 'session-large', queue: [], active_tasks: [], background_tasks: [] })],
    ['/api/sessions/session-large/steps', () => history],
  ])
  const evidence = await buildEvidence(evidenceClient(routes))
  assert.equal(evidence.latestStep.stepNumber, 2048)
  assert.equal(evidence.latestStep.action, 'action-2048')
  assert.equal(evidence.latestStep.traces.length, evidenceLimits.maxTraces)
})
`
fs.writeFileSync(testPath, tests)

const docsPath = 'docs/trace-evidence.md'
let docs = fs.readFileSync(docsPath, 'utf8')
docs = replaceExact(
  docs,
  '- selects the latest recorded step server-side;\n',
  '- selects the latest recorded step server-side with a one-pass scan and retains only the normalized winning step rather than a second normalized copy of the full session history;\n',
  'trace evidence latest-step documentation',
)
fs.writeFileSync(docsPath, docs)
