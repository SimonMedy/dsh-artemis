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
  `    return () => {\n      disposeTraceEvidence?.()\n      disposeEvidence?.()\n    }\n  } catch (error) {\n    disposeEvidence?.()\n    throw error\n  }`,
  `    let disposed = false\n    return () => {\n      if (disposed) return\n      disposed = true\n      let firstError\n      try { disposeTraceEvidence?.() } catch (error) { firstError ??= error }\n      try { disposeEvidence?.() } catch (error) { firstError ??= error }\n      if (firstError) throw firstError\n    }\n  } catch (error) {\n    try { disposeEvidence?.() } catch {}\n    throw error\n  }`,
  'evidence cleanup block',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/route-registration-transaction.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
const importAnchor = "import { createRouteRegistrationTransaction } from '../src/host/route-registration-transaction.mjs'\nimport { apply } from '../src/index.mjs'"
tests = replaceExact(
  tests,
  importAnchor,
  "import { registerArtemisEvidenceRoute } from '../src/host/artemis-evidence.mjs'\n" + importAnchor,
  'evidence test import',
)
tests += `

test('evidence registration preserves the trace registration error when rollback cleanup fails', () => {
  const primary = new Error('trace registration failed')
  let count = 0
  let cleanupAttempts = 0
  const ctx = {
    connection: { requestRejection() { return undefined } },
    webServer: {
      register() {
        count += 1
        if (count === 2) throw primary
        return () => {
          cleanupAttempts += 1
          throw new Error('evidence cleanup failed')
        }
      },
    },
  }

  assert.throws(() => registerArtemisEvidenceRoute(ctx, {}), (error) => error === primary)
  assert.equal(cleanupAttempts, 1)
})

test('evidence disposer attempts both routes once when trace cleanup fails', () => {
  const cleanupFailure = new Error('trace cleanup failed')
  const disposed = []
  const ctx = {
    connection: { requestRejection() { return undefined } },
    webServer: {
      register(route) {
        return () => {
          disposed.push(route.path)
          if (route.path === TRACE_EVIDENCE_ROUTE) throw cleanupFailure
        }
      },
    },
  }

  const dispose = registerArtemisEvidenceRoute(ctx, {})
  assert.throws(() => dispose(), (error) => error === cleanupFailure)
  assert.deepEqual(disposed, [TRACE_EVIDENCE_ROUTE, EVIDENCE_ROUTE])
  dispose()
  assert.deepEqual(disposed, [TRACE_EVIDENCE_ROUTE, EVIDENCE_ROUTE])
})
`
fs.writeFileSync(testPath, tests)
