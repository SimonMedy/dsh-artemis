import assert from 'node:assert/strict'
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildHarnessMcpRow,
  renderHarnessMcpCordisRow,
  resolveArtemisPython,
  validateArtemisRoot,
} from '../src/integration/artemis-mcp-config.mjs'

async function writeExecutable(filePath) {
  await writeFile(filePath, '')
  await chmod(filePath, 0o755)
}

async function fakeArtemisRoot({ withPosixVenv = false, withWindowsVenv = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-mcp-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# rules\n')
  if (withPosixVenv) {
    await mkdir(path.join(root, '.venv', 'bin'), { recursive: true })
    await writeExecutable(path.join(root, '.venv', 'bin', 'python'))
  }
  if (withWindowsVenv) {
    await mkdir(path.join(root, '.venv', 'Scripts'), { recursive: true })
    await writeFile(path.join(root, '.venv', 'Scripts', 'python.exe'), '')
  }
  return root
}

test('validates an explicit absolute ARTEMIS root instead of scanning arbitrary locations', async () => {
  const root = await fakeArtemisRoot()
  assert.equal(await validateArtemisRoot(root), path.normalize(root))
  await assert.rejects(validateArtemisRoot('../relative-artemis'), /absolute path/)
  const invalid = await mkdtemp(path.join(os.tmpdir(), 'not-artemis-'))
  await assert.rejects(validateArtemisRoot(invalid), /missing required files/)
})

test('resolves ARTEMIS Python from the local .venv on supported platforms', async () => {
  const posix = await fakeArtemisRoot({ withPosixVenv: true })
  assert.equal(await resolveArtemisPython(posix, { platform: 'linux' }), path.join(posix, '.venv', 'bin', 'python'))
  const windows = await fakeArtemisRoot({ withWindowsVenv: true })
  assert.equal(await resolveArtemisPython(windows, { platform: 'win32' }), path.join(windows, '.venv', 'Scripts', 'python.exe'))
})

test('uses only an explicitly supplied executable fallback Python when no ARTEMIS .venv exists', async () => {
  const root = await fakeArtemisRoot()
  const fallback = path.join(root, 'fallback-python')
  await writeExecutable(fallback)
  assert.equal(
    await resolveArtemisPython(root, { platform: 'linux', fallbackPython: fallback }),
    path.resolve(fallback),
  )
  await assert.rejects(
    resolveArtemisPython(root, { platform: 'linux', fallbackPython: path.join(root, 'missing-python') }),
    /unavailable, not a regular file, or not executable/,
  )
})

test('fails closed when neither an ARTEMIS .venv nor an explicit Python is available', async () => {
  const root = await fakeArtemisRoot()
  await assert.rejects(
    resolveArtemisPython(root, { platform: 'linux' }),
    /No ARTEMIS Python executable is available/,
  )
  await assert.rejects(
    buildHarnessMcpRow({ artemisRoot: root, platform: 'linux' }),
    /No ARTEMIS Python executable is available/,
  )
})

test('explicit Python must exist, be a regular file, be executable on POSIX and override .venv discovery', async () => {
  const root = await fakeArtemisRoot({ withPosixVenv: true })
  const explicit = path.join(root, 'custom-python')
  await writeExecutable(explicit)
  assert.equal(await resolveArtemisPython(root, { explicitPython: explicit, platform: 'linux' }), explicit)

  const nonExecutable = path.join(root, 'non-executable-python')
  await writeFile(nonExecutable, '')
  await chmod(nonExecutable, 0o644)
  await assert.rejects(
    resolveArtemisPython(root, { explicitPython: nonExecutable, platform: 'linux' }),
    /unavailable, not a regular file, or not executable/,
  )
  await assert.rejects(
    resolveArtemisPython(root, { explicitPython: path.join(root, 'missing'), platform: 'linux' }),
    /unavailable, not a regular file, or not executable/,
  )
})

test('Python directories are rejected as MCP executables on POSIX and Windows', async () => {
  const root = await fakeArtemisRoot()
  const directory = path.join(root, 'python-directory')
  await mkdir(directory)
  await assert.rejects(
    resolveArtemisPython(root, { explicitPython: directory, platform: 'linux' }),
    /not a regular file/,
  )
  await assert.rejects(
    resolveArtemisPython(root, { explicitPython: directory, platform: 'win32' }),
    /not a regular file/,
  )
})

test('non-executable POSIX .venv Python is not accepted as a runnable MCP command', async () => {
  const root = await fakeArtemisRoot()
  await mkdir(path.join(root, '.venv', 'bin'), { recursive: true })
  const python = path.join(root, '.venv', 'bin', 'python')
  await writeFile(python, '')
  await chmod(python, 0o644)
  await assert.rejects(
    resolveArtemisPython(root, { platform: 'linux' }),
    /No ARTEMIS Python executable is available/,
  )
})

test('builds the Harness MCP row using the same stdio process contract as ARTEMIS installer', async () => {
  const root = await fakeArtemisRoot({ withPosixVenv: true })
  const row = await buildHarnessMcpRow({ artemisRoot: root, platform: 'linux' })
  assert.equal(row.id, 'mcp-artemis')
  assert.equal(row.name, '@deepseek-ai/dsh-mcp-client')
  assert.deepEqual(row.config.args, ['-m', 'mcp_server'])
  assert.equal(row.config.command, path.join(root, '.venv', 'bin', 'python'))
  assert.equal(row.config.cwd, root)
  assert.deepEqual(row.config.env, { PYTHONUNBUFFERED: '1', PYTHONPATH: root, ARTEMIS_DESKTOP_NOTIFY: 'true' })
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
