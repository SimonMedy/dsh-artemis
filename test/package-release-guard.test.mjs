import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package remains explicitly unreleased until a release decision is made', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(pkg.private, true, 'package must remain private until release readiness is explicitly approved')
  assert.equal(pkg.version, '0.0.0', 'package version must remain the unreleased sentinel until an explicit release decision')
  assert.equal(pkg.publishConfig, undefined, 'unreleased package must not advertise publish configuration')
})
