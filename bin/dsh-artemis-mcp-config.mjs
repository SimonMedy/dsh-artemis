#!/usr/bin/env node
import { buildHarnessMcpRow, renderHarnessMcpCordisRow } from '../src/integration/artemis-mcp-config.mjs'

function usage() {
  return [
    'Usage: dsh-artemis-mcp-config --artemis-root <path> [--python <path>]',
    '',
    'Environment fallbacks:',
    '  ARTEMIS_ROOT    Existing ARTEMIS repository/install root',
    '  ARTEMIS_PYTHON  Optional explicit Python executable',
    '',
    'The command prints one Harness Cordis row to stdout and never edits profiles.',
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
  if (!artemisRoot) throw new Error('ARTEMIS root is required; pass --artemis-root or set ARTEMIS_ROOT')

  const row = await buildHarnessMcpRow({ artemisRoot, pythonExecutable })
  process.stdout.write(renderHarnessMcpCordisRow(row))
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`dsh-artemis-mcp-config: ${message}\n`)
  process.stderr.write(`${usage()}\n`)
  process.exit(1)
}
