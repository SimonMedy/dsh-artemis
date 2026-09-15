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
  `export function registerArtemisHostRoutes(ctx, client, { setupStatus } = {}) {`,
  `function disposeRegisteredRoutes(disposers, { suppressErrors = false } = {}) {\n  let firstError\n  for (let index = disposers.length - 1; index >= 0; index -= 1) {\n    try { disposers[index]?.() } catch (error) { firstError ??= error }\n  }\n  if (!suppressErrors && firstError) throw firstError\n}\n\nexport function registerArtemisHostRoutes(ctx, client, { setupStatus } = {}) {`,
  'Host route cleanup helper insertion',
)
source = replaceExact(
  source,
  `  const requestRejection = (req) => ctx.connection.requestRejection(req)\n  const disposers = [\n    ctx.webServer.register({ kind: 'exact', path: OVERVIEW_ROUTE, handler: createOverviewHandler(client, { requestRejection, setupStatus }) }),\n    ctx.webServer.register({ kind: 'exact', path: SNAPSHOT_ROUTE, handler: createSnapshotHandler(client, { requestRejection }) }),\n    ctx.webServer.register({ kind: 'exact', path: LIVE_ROUTE, handler: createLiveHandler(client, { requestRejection }) }),\n  ]\n  let disposed = false\n  return () => {\n    if (disposed) return\n    disposed = true\n    let firstError\n    for (let index = disposers.length - 1; index >= 0; index -= 1) {\n      try { disposers[index]?.() } catch (error) { firstError ??= error }\n    }\n    if (firstError) throw firstError\n  }`,
  `  const requestRejection = (req) => ctx.connection.requestRejection(req)\n  const disposers = []\n  try {\n    disposers.push(ctx.webServer.register({ kind: 'exact', path: OVERVIEW_ROUTE, handler: createOverviewHandler(client, { requestRejection, setupStatus }) }))\n    disposers.push(ctx.webServer.register({ kind: 'exact', path: SNAPSHOT_ROUTE, handler: createSnapshotHandler(client, { requestRejection }) }))\n    disposers.push(ctx.webServer.register({ kind: 'exact', path: LIVE_ROUTE, handler: createLiveHandler(client, { requestRejection }) }))\n  } catch (error) {\n    disposeRegisteredRoutes(disposers, { suppressErrors: true })\n    throw error\n  }\n  let disposed = false\n  return () => {\n    if (disposed) return\n    disposed = true\n    disposeRegisteredRoutes(disposers)\n  }`,
  'Host route registration transaction',
)
fs.writeFileSync(sourcePath, source)

const testPath = 'test/harness-routes.test.mjs'
let tests = fs.readFileSync(testPath, 'utf8')
tests += `\n\ntest('Host route registration rolls back earlier routes without masking the primary error', () => {\n  const registrationFailure = new Error('live registration failed')\n  const cleanupFailure = new Error('snapshot cleanup failed')\n  const disposed = []\n  const ctx = {\n    webServer: {\n      register(route) {\n        if (route.path === LIVE_ROUTE) throw registrationFailure\n        return () => {\n          disposed.push(route.path)\n          if (route.path === SNAPSHOT_ROUTE) throw cleanupFailure\n        }\n      },\n    },\n    connection: { requestRejection() { return undefined } },\n  }\n\n  assert.throws(\n    () => registerArtemisHostRoutes(ctx, readyClient()),\n    (error) => error === registrationFailure,\n  )\n  assert.deepEqual(disposed, [SNAPSHOT_ROUTE, OVERVIEW_ROUTE])\n})\n`
fs.writeFileSync(testPath, tests)

const maintainabilityPath = 'docs/maintainability.md'
let maintainability = fs.readFileSync(maintainabilityPath, 'utf8')
maintainability = replaceExact(
  maintainability,
  '- Exported Host route registration helpers must return idempotent reverse-order disposers that attempt every cleanup and preserve the first cleanup error.\n',
  '- Exported Host route registration helpers must roll back partial registration without masking the primary registration error, then return idempotent reverse-order disposers that attempt every cleanup and preserve the first cleanup error.\n',
  'maintainability Host registration invariant',
)
fs.writeFileSync(maintainabilityPath, maintainability)

const readinessPath = 'docs/release-readiness.md'
let readiness = fs.readFileSync(readinessPath, 'utf8')
readiness = replaceExact(
  readiness,
  '- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, cleanup failures do not mask primary registration failures, and exported Host registration helpers attempt every reverse-order cleanup exactly once while preserving the first cleanup error.\n',
  '- Host route registration and cleanup are transactional: partial activation rolls back registered routes, normal unload is idempotent, cleanup failures do not mask primary registration failures, and exported Host registration helpers also roll back their own partial direct registration before returning an exhaustive reverse-order disposer.\n',
  'release Host registration evidence',
)
fs.writeFileSync(readinessPath, readiness)
