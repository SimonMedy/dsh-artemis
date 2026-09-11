import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { validateArtemisRoot } from './artemis-mcp-config.mjs'

export const ARTEMIS_RULES_SKILL_NAME = 'artemis-mobile-testing'
export const DEFAULT_MAX_ARTEMIS_RULES_BYTES = 512 * 1024

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`)
}

export async function loadArtemisRules(
  artemisRoot,
  {
    maxBytes = DEFAULT_MAX_ARTEMIS_RULES_BYTES,
    statImpl = stat,
    readFileImpl = readFile,
  } = {},
) {
  assertPositiveInteger('maxBytes', maxBytes)
  const root = await validateArtemisRoot(artemisRoot)
  const rulesPath = path.join(root, 'mcp_server', 'rules.md')
  const metadata = await statImpl(rulesPath)
  if (!metadata.isFile()) throw new Error('ARTEMIS rules path is not a regular file')
  if (metadata.size <= 0) throw new Error('ARTEMIS rules file is empty')
  if (metadata.size > maxBytes) throw new Error(`ARTEMIS rules file exceeds ${maxBytes} bytes`)

  const bytes = await readFileImpl(rulesPath)
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new TypeError('ARTEMIS rules reader must return bytes')
  }
  if (bytes.byteLength > maxBytes) throw new Error(`ARTEMIS rules file exceeds ${maxBytes} bytes`)

  let content
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (cause) {
    throw new Error('ARTEMIS rules file is not valid UTF-8', { cause })
  }
  if (!content.trim()) throw new Error('ARTEMIS rules file contains no instructions')

  return Object.freeze({ root, rulesPath, content })
}

export async function buildArtemisRulesSkill(options = {}) {
  const loaded = await loadArtemisRules(options.artemisRoot, options)
  const resourceRoot = path.join(loaded.root, 'mcp_server')
  return Object.freeze({
    name: ARTEMIS_RULES_SKILL_NAME,
    description: 'Use ARTEMIS safely and correctly for Android/mobile diagnosis, testing, task execution, and trace inspection.',
    whenToUse: 'When diagnosing, testing, or interacting with Android/mobile applications through ARTEMIS MCP tools.',
    invocation: Object.freeze({ modelInvocable: true, userInvocable: true }),
    source: 'runtime',
    provider: 'dsh-artemis',
    path: loaded.rulesPath,
    resourceBase: Object.freeze({ kind: 'directory', path: resourceRoot }),
    content: loaded.content,
  })
}

export async function registerArtemisRulesSkill(ctx, options = {}) {
  if (!ctx?.skills || typeof ctx.skills.register !== 'function') {
    throw new TypeError('A Harness skills service is required')
  }
  const skill = await buildArtemisRulesSkill(options)
  const dispose = ctx.skills.register(skill)
  if (typeof dispose !== 'function') throw new TypeError('Harness skills.register() must return a disposer')
  return dispose
}
