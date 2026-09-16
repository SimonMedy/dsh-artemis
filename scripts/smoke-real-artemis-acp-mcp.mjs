import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import { buildHarnessAcpMcpServer } from '../src/integration/artemis-acp-mcp-config.mjs'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function delay(ms, value) {
  return new Promise((resolve) => setTimeout(resolve, ms, value))
}

const artemisRoot = requiredEnv('ARTEMIS_ROOT')
const pythonExecutable = requiredEnv('ARTEMIS_PYTHON')
const probeCwd = requiredEnv('ARTEMIS_ACP_PROBE_CWD')
await mkdir(probeCwd, { recursive: true })

const server = await buildHarnessAcpMcpServer({ artemisRoot, pythonExecutable })
const childEnv = { ...process.env }
for (const { name, value } of server.env) childEnv[name] = value

const child = spawn(server.command, server.args, {
  cwd: probeCwd,
  env: childEnv,
  stdio: ['pipe', 'ignore', 'ignore'],
})

const exitPromise = new Promise((resolve) => {
  child.once('error', () => resolve({ kind: 'error' }))
  child.once('exit', (code, signal) => resolve({ kind: 'exit', code, signal }))
})

const early = await Promise.race([exitPromise, delay(1500, null)])
if (early !== null) {
  throw new Error(`ARTEMIS ACP stdio server exited before the probe window (${early.kind})`)
}

child.kill('SIGTERM')
const stopped = await Promise.race([exitPromise, delay(5000, null)])
if (stopped === null) {
  child.kill('SIGKILL')
  await exitPromise
  throw new Error('ARTEMIS ACP stdio server did not stop after SIGTERM')
}

process.stdout.write('ARTEMIS ACP stdio foreign-cwd smoke passed\n')
