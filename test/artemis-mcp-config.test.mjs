import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildHarnessMcpRow,
  renderHarnessMcpCordisRow,
  resolveArtemisPython,
  validateArtemisRoot,
} from '../src/integration/artemis-mcp-config.mjs'

async function fakeArtemisRoot({ withPosixVenv = false, withWindowsVenv = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-mcp-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# rules\n')
  if (withPosixVenv) {
    await mkdir(path.join(root, '.venv', 'bin'), { recursive: true })
    await writeFile(path.join(root, '.venv', 'bin', 'python'), '')
  }
  if (withWindowsVenv) {
    await mkdir(path.join(root, '.venv', 'Scripts'), { recursive: true })
    await writeFile(path.join(root, '.venv', 'Scripts', 'python.exe'), '')
  }
  return root
}

test('validates the existing ARTEMIS root instead of scanning arbitrary locations', async () => {
  const root = await fakeArtemisRoot()
  assert.equal(await validateArtemisRoot(root), path.resolve(root))

  const invalid = await mkdtemp(path.join(os.tmpdir(), 'not-artemis-'))
  await assert.rejects(validateArtemisRoot(invalid), /missing required files/)
})

test('matches ARTEMIS Python resolution: local .venv first, then current Python', async () => {
  const posix = await fakeArtemisRoot({ withPosixVenv: true })
  assert.equal(
    await resolveArtemisPython(posix, { platform: 'linux', fallbackPython: '/fallback/python' }),
    path.join(posix, '.venv', 'bin', 'python'),
  )

  const windows = await fakeArtemisRoot({ withWindowsVenv: true })
  assert.equal(
    await resolveArtemisPython(windows, { platform: 'win32', fallbackPython: 'C:\\fallback\\python.exe' }),
    path.join(windows, '.venv', 'Scripts', 'python.exe'),
  )

  const noVenv = await fakeArtemisRoot()
  assert.equal(
    await resolveArtemisPython(noVenv, { platform: 'linux', fallbackPython: process.execPath }),
    path.resolve(process.execPath),
  )
})

test('explicit Python must exist and overrides .venv discovery', async () => {
  const root = await fakeArtemisRoot({ withPosixVenv: true })
  const explicit = path.join(root, 'custom-python')
  await writeFile(explicit, '')
  assert.equal(await resolveArtemisPython(root, { explicitPython: explicit }), explicit)
  await assert.rejects(resolveArtemisPython(root, { explicitPython: path.join(root, 'missing') }), /does not exist/)
})

test('builds the Harness MCP row using the same stdio process contract as ARTEMIS installer', async () => {
  const root = await fakeArtemisRoot({ withPosixVenv: true })
  const row = await buildHarnessMcpRow({ artemisRoot: root, platform: 'linux' })

  assert.equal(row.id, 'mcp-artemis')
  assert.equal(row.name, '@deepseek-ai/dsh-mcp-client')
  assert.deepEqual(row.config.args, ['-m', 'mcp_server'])
  assert.equal(row.config.command, path.join(root, '.venv', 'bin', 'python'))
  assert.equal(row.config.cwd, root)
  assert.deepEqual(row.config.env, {
    PYTHONUNBUFFERED: '1',
    PYTHONPATH: root,
    ARTEMIS_DESKTOP_NOTIFY: 'true',
  })
  assert.equal(row.config.transport, 'stdio')
  assert.equal(row.config.serverName, 'artemis')
  assert.equal(row.config.failOnStartupError, false)
})

test('renders paths and values as quoted JSON-compatible YAML scalars', async () => {
  const root = await fakeArtemisRoot({ withPosixVenv: true })
  const row = await buildHarnessMcpRow({ artemisRoot: root, platform: 'linux' })
  const yaml = renderHarnessMcpCordisRow(row)

  assert.match(yaml, /name: "@deepseek-ai\/dsh-mcp-client"/)
  assert.match(yaml, /args: \["-m","mcp_server"\]/)
  assert.match(yaml, /PYTHONUNBUFFERED: "1"/)
  assert.match(yaml, /ARTEMIS_DESKTOP_NOTIFY: "true"/)
  assert.ok(yaml.includes(JSON.stringify(root)))
})
