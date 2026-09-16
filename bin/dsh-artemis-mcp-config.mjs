#!/usr/bin/env node
import { buildHarnessAcpMcpServersFragment } from '../src/integration/artemis-acp-mcp-config.mjs'
import { buildHarnessMcpRow, renderHarnessMcpCordisRow } from '../src/integration/artemis-mcp-config.mjs'

const SUPPORTED_FORMATS = new Set(['cordis', 'acp-json'])

function usage() {
  return [
    'Usage: dsh-artemis-mcp-config --artemis-root <path> [--python <path>] [--format <cordis|acp-json>]',
    '',
    'Environment fallbacks:',
    '  ARTEMIS_ROOT    Existing ARTEMIS repository/install root',
    '  ARTEMIS_PYTHON  Optional explicit Python executable',
    '',
    'Formats:',
    '  cordis    One Harness Cordis MCP row (default)',
    '  acp-json  A JSON fragment containing session-scoped mcpServers for Harness ACP',
    '',
    'The command writes configuration to stdout and never edits profiles or sessions.',
  ].join('\n')
}

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--artemis-root') {
      result.artemisRoot = argv[++index]
      if (!result.artemisRoot) throw new Error('--artemis-root requires a path')
      continue
    }
    if (arg === '--python') {
      result.pythonExecutable = argv[++index]
      if (!result.pythonExecutable) throw new Error('--python requires a path')
      continue
    }
    if (arg === '--format') {
      result.format = argv[++index]
      if (!result.format) throw new Error('--format requires a value')
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }
  return result
}

try {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    process.exit(0)
  }

  const artemisRoot = options.artemisRoot ?? process.env.ARTEMIS_ROOT
  const pythonExecutable = options.pythonExecutable ?? process.env.ARTEMIS_PYTHON
  const format = options.format ?? 'cordis'
  if (!SUPPORTED_FORMATS.has(format)) throw new Error(`Unsupported --format: ${format}`)
  if (!artemisRoot) throw new Error('ARTEMIS root is required; pass --artemis-root or set ARTEMIS_ROOT')

  const buildOptions = { artemisRoot, pythonExecutable }
  if (format === 'acp-json') {
    const fragment = await buildHarnessAcpMcpServersFragment(buildOptions)
    process.stdout.write(`${JSON.stringify(fragment, null, 2)}\n`)
  } else {
    const row = await buildHarnessMcpRow(buildOptions)
    process.stdout.write(renderHarnessMcpCordisRow(row))
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`dsh-artemis-mcp-config: ${message}\n`)
  process.stderr.write(`${usage()}\n`)
  process.exit(1)
}
