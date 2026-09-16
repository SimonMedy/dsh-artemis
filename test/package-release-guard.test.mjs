import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('package metadata matches the stable GitHub-release policy', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.match(pkg.version, /^[1-9]\d*\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'package version must be a stable semantic version')
  assert.notEqual(pkg.version, '0.0.0', 'stable releases must not use the unreleased sentinel')
  assert.equal(pkg.private, true, 'npm registry publication stays disabled until a separate registry-release decision')
  assert.equal(pkg.license, 'MIT', 'package metadata must match the repository MIT license')
  assert.deepEqual(pkg.repository, {
    type: 'git',
    url: 'git+https://github.com/SimonMedy/dsh-artemis.git',
  })
  assert.equal(pkg.homepage, 'https://github.com/SimonMedy/dsh-artemis#readme')
  assert.deepEqual(pkg.bugs, { url: 'https://github.com/SimonMedy/dsh-artemis/issues' })
  assert.equal(pkg.publishConfig, undefined, 'GitHub-release-only packages must not advertise npm publish configuration')
})
