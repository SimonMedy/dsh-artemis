import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as hostPlugin from '../src/index.mjs'
import { androidTabDefinition } from '../src/client/definition.mjs'
import { inject as clientInject, registerAndroidClient } from '../src/client/register.mjs'

test('package manifest advertises Host bundle and baseline-aware Web client face', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(pkg.exports['.'], './src/index.mjs')
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-sidebar-right'])
  assert.equal(pkg.dsh.client.external, undefined)
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '^4.0.2')
})

test('bundle patch inserts the Host plugin by package name', async () => {
  const patch = await readFile('cordis.patch.yml', 'utf8')
  assert.match(patch, /id:\s*dsh-artemis/)
  assert.match(patch, /name:\s*['"]dsh-artemis['"]/)
})

test('Host face effect-owns all registered read-only routes', () => {
  assert.equal(hostPlugin.name, 'dsh-artemis')
  assert.deepEqual(hostPlugin.inject, ['webServer', 'connection'])
  const effects = []
  const routes = []
  const disposed = []
  const ctx = {
    effect(factory, label) { effects.push({ factory, label }) },
    webServer: { register(route) { routes.push(route); return () => disposed.push(route.path) } },
    connection: { requestRejection() { return undefined } },
  }
  hostPlugin.apply(ctx)
  assert.equal(effects.length, 1)
  const dispose = effects[0].factory()
  assert.deepEqual(routes.map((route) => route.path), [
    '/dsh-artemis/v1/overview',
    '/dsh-artemis/v1/snapshot',
    '/dsh-artemis/v1/live',
    '/dsh-artemis/v1/evidence',
  ])
  dispose()
  assert.deepEqual(disposed, [
    '/dsh-artemis/v1/evidence',
    '/dsh-artemis/v1/live',
    '/dsh-artemis/v1/snapshot',
    '/dsh-artemis/v1/overview',
  ])
})

test('Client registration uses Android page type, guide entry and keyed native sidebar seat', () => {
  assert.deepEqual(clientInject, ['slots', 'sidebarRightTabs'])
  const effects = []
  const definitions = []
  const seatRegistrations = []
  const typeDispose = () => {}
  const seatDispose = () => {}
  const injectDispose = () => {}
  const AndroidPanel = () => null
  const ctx = {
    effect(factory, label) { effects.push({ factory, label }) },
    sidebarRightTabs: { register(definition) { definitions.push(definition); return typeDispose } },
    slots: {
      inject(name, factory) { assert.equal(name, 'sidebar.right.pane.tab'); assert.equal(factory(), seatDispose); return injectDispose },
      register(metadata, component) { seatRegistrations.push({ metadata, component }); return seatDispose },
    },
  }
  registerAndroidClient(ctx, AndroidPanel)
  assert.equal(effects.length, 2)
  assert.equal(effects[0].factory(), typeDispose)
  assert.equal(effects[1].factory(), injectDispose)
  const expected = androidTabDefinition()
  assert.equal(definitions[0].id, expected.id)
  assert.equal(definitions[0].kind, 'android')
  assert.deepEqual(seatRegistrations[0].metadata, { name: 'sidebar.right.pane.tab', key: 'dsh-artemis:android' })
  assert.equal(seatRegistrations[0].component, AndroidPanel)
})
