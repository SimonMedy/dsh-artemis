import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildHarnessAcpMcpServer,
  buildHarnessAcpMcpServersFragment,
} from '../src/integration/artemis-acp-mcp-config.mjs'

async function fakeArtemisRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-acp-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# rules\n')
  const python = path.join(root, 'python')
  await writeFile(python, '')
  if (process.platform !== 'win32') await chmod(python, 0o755)
  return { root, python }
}

test('builds the standard ACP stdio server declaration without a session cwd override', async () => {
  const { root, python } = await fakeArtemisRoot()
  const server = await buildHarnessAcpMcpServer({ artemisRoot: root, pythonExecutable: python })

  assert.deepEqual(server, {
    name: 'artemis',
    command: path.resolve(python),
    args: ['-m', 'mcp_server'],
    env: [
      { name: 'PYTHONUNBUFFERED', value: '1' },
      { name: 'PYTHONPATH', value: path.normalize(root) },
      { name: 'ARTEMIS_DESKTOP_NOTIFY', value: 'true' },
    ],
  })
  assert.equal(Object.hasOwn(server, 'cwd'), false)
  assert.equal(Object.hasOwn(server, 'type'), false)
  assert.equal(Object.hasOwn(server, 'failOnStartupError'), false)
  assert.equal(Object.isFrozen(server), true)
  assert.equal(Object.isFrozen(server.args), true)
  assert.equal(Object.isFrozen(server.env), true)
  assert.equal(server.env.every(Object.isFrozen), true)
})

test('wraps the ARTEMIS ACP declaration as a session mcpServers fragment', async () => {
  const { root, python } = await fakeArtemisRoot()
  const fragment = await buildHarnessAcpMcpServersFragment({ artemisRoot: root, pythonExecutable: python })

  assert.equal(Object.isFrozen(fragment), true)
  assert.equal(Object.isFrozen(fragment.mcpServers), true)
  assert.equal(fragment.mcpServers.length, 1)
  assert.equal(fragment.mcpServers[0].name, 'artemis')
})
