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
  `  const number = step.step_number\n  const stepNumber = Number.isSafeInteger(number) && number >= 0 ? number : null\n`,
  `  const number = step.step_number\n  if (!Number.isSafeInteger(number) || number < 0) {\n    throw new ArtemisProtocolError('step.step_number must be a non-negative safe integer', { code: 'invalid-evidence' })\n  }\n  const stepNumber = number\n`,
  'strict step number validation',
)
fs.writeFileSync(sourcePath, source)

const evidenceTestPath = 'test/evidence.test.mjs'
let evidenceTests = fs.readFileSync(evidenceTestPath, 'utf8')
evidenceTests += `

test('evidence rejects malformed upstream step numbers instead of falling back to response order', async (t) => {
  for (const [name, invalidStep] of [
    ['missing', { action_taken: { action: 'tap' }, generic_tools: [] }],
    ['string', { step_number: '2', action_taken: { action: 'tap' }, generic_tools: [] }],
    ['negative', { step_number: -1, action_taken: { action: 'tap' }, generic_tools: [] }],
  ]) {
    await t.test(name, async () => {
      const routes = new Map([
        ['/api/status', () => ({ status: 'running', session_id: 'session-invalid-step', queue: [], active_tasks: [], background_tasks: [] })],
        ['/api/sessions/session-invalid-step/steps', () => [invalidStep]],
      ])
      await assert.rejects(
        buildEvidence(evidenceClient(routes)),
        (error) => error?.code === 'invalid-evidence' && /step_number/.test(error.message),
      )
    })
  }
})
`
fs.writeFileSync(evidenceTestPath, evidenceTests)

const traceTestPath = 'test/trace-evidence.test.mjs'
let traceTests = fs.readFileSync(traceTestPath, 'utf8')
traceTests += `

test('trace evidence rejects malformed step numbers before requesting a trace tree', async () => {
  const seen = []
  const routes = new Map([
    ['/api/status', () => ({ status: 'running', session_id: 'session-invalid-number', queue: [], active_tasks: [], background_tasks: [] })],
    ['/api/sessions/session-invalid-number/steps', () => [{ step_id: 'step-invalid-number', step_number: '1', generic_tools: [] }]],
  ])
  await assert.rejects(
    buildTraceEvidence(clientFor(routes, seen)),
    (error) => error?.code === 'invalid-evidence' && /step_number/.test(error.message),
  )
  assert.deepEqual(seen, ['/api/status', '/api/sessions/session-invalid-number/steps'])
})
`
fs.writeFileSync(traceTestPath, traceTests)

const docsPath = 'docs/trace-evidence.md'
let docs = fs.readFileSync(docsPath, 'utf8')
docs = replaceExact(
  docs,
  '- selects the latest recorded step server-side with a one-pass scan and retains only the normalized winning step rather than a second normalized copy of the full session history;\n',
  '- requires every upstream `step_number` to be a non-negative safe integer before latest-step selection, so malformed histories fail closed instead of falling back to response order;\n- selects the latest recorded step server-side with a one-pass scan and retains only the normalized winning step rather than a second normalized copy of the full session history;\n',
  'trace evidence step number contract',
)
fs.writeFileSync(docsPath, docs)
