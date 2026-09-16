import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)

async function fakeArtemisRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-cli-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# rules\n')
  const python = path.join(root, 'python')
  await writeFile(python, '')
  if (process.platform !== 'win32') await chmod(python, 0o755)
  return { root, python }
}

test('CLI emits an ACP session mcpServers JSON fragment on explicit request', async () => {
  const { root, python } = await fakeArtemisRoot()
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    'bin/dsh-artemis-mcp-config.mjs',
    '--artemis-root', root,
    '--python', python,
    '--format', 'acp-json',
  ], { cwd: process.cwd(), maxBuffer: 64 * 1024 })

  assert.equal(stderr, '')
  const payload = JSON.parse(stdout)
  assert.deepEqual(payload.mcpServers, [{
    name: 'artemis',
    command: path.resolve(python),
    args: ['-m', 'mcp_server'],
    env: [
      { name: 'PYTHONUNBUFFERED', value: '1' },
      { name: 'PYTHONPATH', value: path.normalize(root) },
      { name: 'ARTEMIS_DESKTOP_NOTIFY', value: 'true' },
    ],
  }])
})

test('CLI keeps Cordis as the default format and documents both formats', async () => {
  const { root, python } = await fakeArtemisRoot()
  const cordis = await execFileAsync(process.execPath, [
    'bin/dsh-artemis-mcp-config.mjs',
    '--artemis-root', root,
    '--python', python,
  ], { cwd: process.cwd(), maxBuffer: 64 * 1024 })
  assert.match(cordis.stdout, /- id: "mcp-artemis"/)

  const help = await execFileAsync(process.execPath, ['bin/dsh-artemis-mcp-config.mjs', '--help'], {
    cwd: process.cwd(),
    maxBuffer: 64 * 1024,
  })
  assert.match(help.stdout, /--format <cordis\|acp-json>/)
})
