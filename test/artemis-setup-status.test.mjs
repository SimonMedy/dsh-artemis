import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { inspectArtemisSetup } from '../src/integration/artemis-setup-status.mjs'

async function fakeRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-setup-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# rules\n')
  return root
}

test('does not guess an ARTEMIS root when Host configuration is absent', async () => {
  assert.deepEqual(await inspectArtemisSetup({ env: {} }), {
    artemisRoot: 'not-supplied',
    python: 'profile-managed',
    mcpRuntime: 'unobservable',
  })
})

test('validates an explicit Host ARTEMIS root without returning its path', async () => {
  const root = await fakeRoot()
  const result = await inspectArtemisSetup({ env: { ARTEMIS_ROOT: root } })
  assert.deepEqual(result, {
    artemisRoot: 'validated',
    python: 'profile-managed',
    mcpRuntime: 'unobservable',
  })
  assert.equal(JSON.stringify(result).includes(root), false)
})

test('validates explicit Python only when a root is also configured', async () => {
  const root = await fakeRoot()
  const python = path.join(root, 'python')
  await writeFile(python, '')
  await chmod(python, 0o755)
  assert.deepEqual(await inspectArtemisSetup({ env: { ARTEMIS_ROOT: root, ARTEMIS_PYTHON: python } }), {
    artemisRoot: 'validated',
    python: 'validated-explicit',
    mcpRuntime: 'unobservable',
  })
  assert.deepEqual(await inspectArtemisSetup({ env: { ARTEMIS_PYTHON: python } }), {
    artemisRoot: 'invalid',
    python: 'invalid',
    mcpRuntime: 'unobservable',
  })
})

test('non-executable explicit Python collapses to invalid setup state', async () => {
  const root = await fakeRoot()
  const python = path.join(root, 'python')
  await writeFile(python, '')
  await chmod(python, 0o644)
  assert.deepEqual(await inspectArtemisSetup({ env: { ARTEMIS_ROOT: root, ARTEMIS_PYTHON: python } }), {
    artemisRoot: 'validated',
    python: 'invalid',
    mcpRuntime: 'unobservable',
  })
})

test('invalid local paths collapse to bounded status without filesystem details', async () => {
  const missing = path.join(os.tmpdir(), 'dsh-artemis-missing-root')
  const result = await inspectArtemisSetup({ env: { ARTEMIS_ROOT: missing } })
  assert.deepEqual(result, {
    artemisRoot: 'invalid',
    python: 'unknown',
    mcpRuntime: 'unobservable',
  })
  assert.equal(JSON.stringify(result).includes(missing), false)
})
