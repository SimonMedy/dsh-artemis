import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('client build is pinned to the reviewed Harness toolchain and strict externals', async () => {
  const [pkgText, script, config] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('scripts/build-client.mjs', 'utf8'),
    readFile('tsdown.client.config.mjs', 'utf8'),
  ])
  const pkg = JSON.parse(pkgText)

  assert.equal(pkg.scripts['bundle:client'], 'node scripts/build-client.mjs')
  assert.match(script, /0d1f50007f9bca3f52b06e1c3074fa14d5fb0720/)
  assert.match(script, /pnpm@11\.7\.0/)
  assert.match(script, /\^0\.22\.2/)
  assert.match(script, /git', \['-C', harnessRoot, 'rev-parse', 'HEAD'\]/)
  assert.match(config, /'react'/)
  assert.match(config, /'@deepseek-ai\/dsh-client-ui-primitives'/)
  assert.match(config, /forbids unreviewed runtime dependency/)
  assert.match(config, /format: 'cjs'/)
  assert.match(config, /platform: 'browser'/)
  assert.match(config, /target: 'es2024'/)
  assert.match(config, /window\.__ModuleLoader__\.load/)
})
