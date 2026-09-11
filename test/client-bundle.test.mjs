import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

test('published client is a Harness lazy-CJS module-table bundle', async () => {
  const source = await readFile('lib/client.js', 'utf8')
  assert.match(source, /^window\.__ModuleLoader__\.load\(/)
  assert.doesNotMatch(source, /^\s*import\s/m)

  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { registration = value } } },
  }
  vm.runInNewContext(source, sandbox, { filename: 'lib/client.js' })
  assert.equal(registration.id, 'dsh-artemis')
  assert.equal(typeof registration.factory, 'function')

  const effects = []
  const seatRegistrations = []
  const definitionRegistrations = []
  const modules = {
    react: {
      createElement() { return null },
      useCallback(value) { return value },
      useEffect() {},
      useRef(value) { return { current: value } },
      useState(value) { return [value, () => {}] },
    },
    '@deepseek-ai/dsh-client-ui-primitives': {
      Button() { return null }, Pill() { return null }, StateDot() { return null },
    },
  }
  const plugin = registration.factory((id) => {
    if (!(id in modules)) throw new Error(`unexpected external: ${id}`)
    return modules[id]
  })

  assert.deepEqual(Array.from(plugin.inject), ['slots', 'sidebarRightTabs'])
  assert.equal(plugin.androidTabDefinition().kind, 'android')
  const ctx = {
    effect(factory, label) { effects.push({ factory, label }) },
    sidebarRightTabs: { register(definition) { definitionRegistrations.push(definition); return () => {} } },
    slots: {
      inject(_name, factory) { factory(); return () => {} },
      register(metadata, component) { seatRegistrations.push({ metadata, component }); return () => {} },
    },
  }
  plugin.apply(ctx)
  for (const effect of effects) effect.factory()
  assert.equal(definitionRegistrations[0].id, 'dsh-artemis:android')
  assert.equal(seatRegistrations[0].metadata.key, 'dsh-artemis:android')
  assert.equal(typeof seatRegistrations[0].component, 'function')
})

test('package client export points at the built browser artifact and requests its non-baseline external', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.deepEqual(pkg.dsh.client.external, ['@deepseek-ai/dsh-client-ui-primitives'])
  assert.ok(pkg.files.includes('lib/client.js'))
})
