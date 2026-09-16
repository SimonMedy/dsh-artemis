import path from 'node:path'
import { buildHarnessMcpRow } from './artemis-mcp-config.mjs'

function freezeAcpEnvironment(env) {
  if (env === null || Array.isArray(env) || typeof env !== 'object') {
    throw new TypeError('Harness ACP MCP env must be an object of string values')
  }
  const entries = []
  for (const [name, value] of Object.entries(env)) {
    if (!name || name.includes('=') || name.includes('\0') || typeof value !== 'string' || value.includes('\0')) {
      throw new TypeError('Harness ACP MCP env contains an invalid environment entry')
    }
    entries.push(Object.freeze({ name, value }))
  }
  return Object.freeze(entries)
}

export async function buildHarnessAcpMcpServer(options = {}) {
  const row = await buildHarnessMcpRow(options)
  const config = row.config

  if (config.transport !== 'stdio') throw new TypeError("Harness ACP MCP transport must be 'stdio'")
  if (typeof config.serverName !== 'string' || !config.serverName) throw new TypeError('Harness ACP MCP server name is required')
  if (typeof config.command !== 'string' || !path.isAbsolute(config.command)) {
    throw new TypeError('Harness ACP MCP command must be an absolute path')
  }
  if (!Array.isArray(config.args) || config.args.some((value) => typeof value !== 'string')) {
    throw new TypeError('Harness ACP MCP args must be an array of strings')
  }

  return Object.freeze({
    name: config.serverName,
    command: config.command,
    args: Object.freeze([...config.args]),
    env: freezeAcpEnvironment(config.env),
  })
}

export async function buildHarnessAcpMcpServersFragment(options = {}) {
  const server = await buildHarnessAcpMcpServer(options)
  return Object.freeze({ mcpServers: Object.freeze([server]) })
}
