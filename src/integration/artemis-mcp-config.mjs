import { access } from 'node:fs/promises'
import path from 'node:path'

const REQUIRED_ARTEMIS_FILES = Object.freeze([
  'pyproject.toml',
  path.join('mcp_server', '__main__.py'),
  path.join('mcp_server', 'rules.md'),
])

async function exists(filePath, accessImpl = access) {
  try {
    await accessImpl(filePath)
    return true
  } catch {
    return false
  }
}

export async function validateArtemisRoot(root, { accessImpl = access } = {}) {
  if (typeof root !== 'string' || !root.trim()) throw new TypeError('ARTEMIS root is required')
  const resolved = path.resolve(root)
  if (!path.isAbsolute(resolved)) throw new TypeError('ARTEMIS root must resolve to an absolute path')

  const missing = []
  for (const relative of REQUIRED_ARTEMIS_FILES) {
    if (!(await exists(path.join(resolved, relative), accessImpl))) missing.push(relative)
  }
  if (missing.length > 0) {
    throw new Error(`ARTEMIS root is missing required files: ${missing.join(', ')}`)
  }
  return resolved
}

export async function resolveArtemisPython(
  artemisRoot,
  {
    explicitPython,
    platform = process.platform,
    fallbackPython = process.execPath,
    accessImpl = access,
  } = {},
) {
  if (explicitPython !== undefined) {
    if (typeof explicitPython !== 'string' || !explicitPython.trim()) throw new TypeError('Explicit ARTEMIS Python path is invalid')
    const resolved = path.resolve(explicitPython)
    if (!(await exists(resolved, accessImpl))) throw new Error('Explicit ARTEMIS Python executable does not exist')
    return resolved
  }

  const venvPython = platform === 'win32'
    ? path.join(artemisRoot, '.venv', 'Scripts', 'python.exe')
    : path.join(artemisRoot, '.venv', 'bin', 'python')
  if (await exists(venvPython, accessImpl)) return venvPython

  if (typeof fallbackPython !== 'string' || !fallbackPython.trim()) throw new Error('No fallback Python executable is available')
  return path.resolve(fallbackPython)
}

export async function buildHarnessMcpRow({
  artemisRoot,
  pythonExecutable,
  platform = process.platform,
  fallbackPython = process.execPath,
  accessImpl = access,
} = {}) {
  const root = await validateArtemisRoot(artemisRoot, { accessImpl })
  const python = await resolveArtemisPython(root, {
    explicitPython: pythonExecutable,
    platform,
    fallbackPython,
    accessImpl,
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
    lines.push(`      ${key}: ${json(value)}`)
  }
  lines.push(`    failOnStartupError: ${config.failOnStartupError ? 'true' : 'false'}`)
  return `${lines.join('\n')}\n`
}

export const artemisMcpRequiredFiles = REQUIRED_ARTEMIS_FILES
