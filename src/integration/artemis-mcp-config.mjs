import { constants } from 'node:fs'
import { access, lstat, stat } from 'node:fs/promises'
import path from 'node:path'

const REQUIRED_ARTEMIS_FILES = Object.freeze([
  'pyproject.toml',
  path.join('mcp_server', '__main__.py'),
  path.join('mcp_server', 'rules.md'),
])

async function isRegularFile(filePath, {
  accessImpl = access,
  statImpl = stat,
  mode = constants.F_OK,
} = {}) {
  try {
    const info = await statImpl(filePath)
    if (!info?.isFile?.()) return false
    await accessImpl(filePath, mode)
    return true
  } catch {
    return false
  }
}

function pythonAccessMode(platform) {
  return platform === 'win32' ? constants.F_OK : constants.X_OK
}

export async function validateArtemisRoot(
  root,
  {
    accessImpl = access,
    lstatImpl = lstat,
  } = {},
) {
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('ARTEMIS root is required')
  if (!path.isAbsolute(root)) throw new TypeError('ARTEMIS root must be an absolute path')
  const resolved = path.normalize(root)

  const invalid = []
  for (const relative of REQUIRED_ARTEMIS_FILES) {
    if (!(await isRegularFile(path.join(resolved, relative), { accessImpl, statImpl: lstatImpl }))) invalid.push(relative)
  }
  if (invalid.length > 0) {
    throw new Error(`ARTEMIS root is missing required non-symlink regular files: ${invalid.join(', ')}`)
  }
  return resolved
}

export async function resolveArtemisPython(
  artemisRoot,
  {
    explicitPython,
    platform = process.platform,
    fallbackPython,
    accessImpl = access,
    statImpl = stat,
  } = {},
) {
  const accessMode = pythonAccessMode(platform)
  const availablePython = (filePath) => isRegularFile(filePath, {
    accessImpl,
    statImpl,
    mode: accessMode,
  })

  if (explicitPython !== undefined) {
    if (typeof explicitPython !== 'string' || !explicitPython.trim()) throw new TypeError('Explicit ARTEMIS Python path is invalid')
    const resolved = path.resolve(explicitPython)
    if (!(await availablePython(resolved))) {
      throw new Error('Explicit ARTEMIS Python executable is unavailable, not a regular file, or not executable')
    }
    return resolved
  }

  const venvPython = platform === 'win32'
    ? path.join(artemisRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(artemisRoot, '.venv', 'bin', 'python')
  if (await availablePython(venvPython)) return venvPython

  if (fallbackPython !== undefined) {
    if (typeof fallbackPython !== 'string' || !fallbackPython.trim()) throw new TypeError('Fallback ARTEMIS Python path is invalid')
    const resolved = path.resolve(fallbackPython)
    if (!(await availablePython(resolved))) {
      throw new Error('Fallback ARTEMIS Python executable is unavailable, not a regular file, or not executable')
    }
    return resolved
  }

  throw new Error('No ARTEMIS Python executable is available; create the ARTEMIS .venv or pass --python / set ARTEMIS_PYTHON')
}

export async function buildHarnessMcpRow({
  artemisRoot,
  pythonExecutable,
  platform = process.platform,
  fallbackPython,
  accessImpl = access,
  lstatImpl = lstat,
  statImpl = stat,
} = {}) {
  const root = await validateArtemisRoot(artemisRoot, { accessImpl, lstatImpl })
  const python = await resolveArtemisPython(root, {
    explicitPython: pythonExecutable,
    platform,
    fallbackPython,
    accessImpl,
    statImpl,
  })

  return Object.freeze({
    id: 'mcp-artemis',
    name: '@deepseek-ai/dsh-mcp-client',
    config: Object.freeze({
      serverName: 'artemis',
      transport: 'stdio',
      command: python,
      args: Object.freeze(['-m', 'mcp_server']),
      cwd: root,
      env: Object.freeze({
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: root,
        ARTEMIS_DESKTOP_NOTIFY: 'true',
      }),
      failOnStartupError: false,
    }),
  })
}

function json(value) {
  return JSON.stringify(value)
}

export function renderHarnessMcpCordisRow(row) {
  if (!row?.config) throw new TypeError('A Harness MCP row is required')
  const config = row.config
  if (typeof config.failOnStartupError !== 'boolean') throw new TypeError('Harness MCP failOnStartupError must be a boolean')
  const lines = [
    `- id: ${json(row.id)}`,
    `  name: ${json(row.name)}`,
    '  config:',
    `    serverName: ${json(config.serverName)}`,
    `    transport: ${json(config.transport)}`,
    `    command: ${json(config.command)}`,
    `    args: ${json(Array.from(config.args ?? []))}`,
    `    cwd: ${json(config.cwd)}`,
    '    env:',
  ]
  for (const [key, value] of Object.entries(config.env ?? {})) {
    lines.push(`      ${json(key)}: ${json(value)}`)
  }
  lines.push(`    failOnStartupError: ${config.failOnStartupError ? 'true' : 'false'}`)
  return `${lines.join('\n')}\n`
}

export const artemisMcpRequiredFiles = REQUIRED_ARTEMIS_FILES
