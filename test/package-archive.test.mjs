import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const repoRoot = fileURLToPath(new URL('../', import.meta.url))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

async function dryRunPackageFiles() {
  const { stdout } = await execFileAsync(npmCommand, [
    'pack',
    '--dry-run',
    '--json',
    '--ignore-scripts',
  ], {
    cwd: repoRoot,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, npm_config_update_notifier: 'false' },
  })
  const result = JSON.parse(stdout)
  assert.equal(result.length, 1, 'npm pack should describe exactly one package')
  assert.ok(Array.isArray(result[0].files), 'npm pack JSON should contain a files list')
  return new Set(result[0].files.map((entry) => entry.path.replaceAll('\\', '/')))
}

test('npm package exposes only the intended runtime and documentation surface', async () => {
  const files = await dryRunPackageFiles()

  for (const required of [
    'package.json',
    'README.md',
    'SECURITY.md',
    'LICENSE',
    'CHANGELOG.md',
    'cordis.patch.yml',
    'lib/client.js',
    'bin/dsh-artemis-mcp-config.mjs',
    'src/index.mjs',
    'src/integration/rules-skill-plugin.mjs',
  ]) {
    assert.ok(files.has(required), `packed artifact is missing ${required}`)
  }

  const forbiddenPrefixes = [
    '.github/',
    'docs/',
    'examples/',
    'scripts/',
    'test/',
  ]
  for (const file of files) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(file.startsWith(prefix), false, `packed artifact unexpectedly includes ${file}`)
    }
  }

  for (const forbidden of [
    'AGENTS.md',
    'tsdown.client.config.mjs',
    'test/fixtures/fake-artemis.mjs',
    'test/fixtures/fake-deepseek.mjs',
  ]) {
    assert.equal(files.has(forbidden), false, `packed artifact unexpectedly includes ${forbidden}`)
  }
})
