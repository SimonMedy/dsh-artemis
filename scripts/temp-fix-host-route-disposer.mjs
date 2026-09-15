import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

const sourcePath = 'src/host/harness-routes.mjs'
let source = fs.readFileSync(sourcePath, 'utf8')
source = replaceExact(
  source,
  `  return () => {\n    for (const dispose of disposers.reverse()) dispose?.()\n  }`,
  `  let disposed = false\n  return () => {\n    if (disposed) return\n    disposed = true\n    let firstError\n    for (let index = disposers.length - 1; index >= 0; index -= 1) {\n      try { disposers[index]?.() } catch (error) { firstError ??= error }\n    }\n    if (firstError) throw firstError\n  }`,
  'host route disposer',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/harness-routes.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `

test('Host route disposer attempts all routes once and preserves the first cleanup error', () => {
  const registrations = []
  const cleanupFailure = new Error('live cleanup failed')
  const disposed = []
  const ctx = {
    webServer: {
      register(route) {
        registrations.push(route)
        return () => {
          disposed.push(route.path)
          if (route.path === LIVE_ROUTE) throw cleanupFailure
        }
      },
    },
    connection: { requestRejection() { return undefined } },
  }

  const dispose = registerArtemisHostRoutes(ctx, readyClient())
  assert.throws(() => dispose(), (error) => error === cleanupFailure)
  assert.deepEqual(disposed, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
  dispose()
  assert.deepEqual(disposed, [LIVE_ROUTE, SNAPSHOT_ROUTE, OVERVIEW_ROUTE])
})
`
fs.writeFileSync(testPath, tests)

const docsPath = 'docs/maintainability.md'
let docs = fs.readFileSync(docsPath, 'utf8')
const anchor = '- Timeouts and cancellation should be explicit for network/process operations.\n'
docs = replaceExact(
  docs,
  anchor,
  `${anchor}- Exported Host route registration helpers must return idempotent reverse-order disposers that attempt every cleanup and preserve the first cleanup error.\n`,
  'maintainability Host disposer invariant',
)
fs.writeFileSync(docsPath, docs)
