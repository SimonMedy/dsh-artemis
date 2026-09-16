import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText,newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const sourcePath = 'src/integration/artemis-mcp-config.mjs'
let source = readFileSync(sourcePath, 'utf8')
source = replaceOnce(
  source,
  "const REQUIRED_ARTEMIS_FILES = Object.freeze([\n",
  "const HARNESS_MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/\n\nconst REQUIRED_ARTEMIS_FILES = Object.freeze([\n",
  'server-name pattern',
)
source = replaceOnce(
  source,
  "export function renderHarnessMcpCordisRow(row) {\n  if (!row?.config) throw new TypeError('A Harness MCP row is required')\n  const config = row.config\n  if (typeof config.failOnStartupError !== 'boolean') throw new TypeError('Harness MCP failOnStartupError must be a boolean')\n  const lines = [",
  "export function renderHarnessMcpCordisRow(row) {\n  if (!row?.config) throw new TypeError('A Harness MCP row is required')\n  const config = row.config\n  if (config.transport !== 'stdio') throw new TypeError(\"Harness MCP transport must be 'stdio'\")\n  if (typeof config.serverName !== 'string' || !HARNESS_MCP_SERVER_NAME_PATTERN.test(config.serverName)) {\n    throw new TypeError('Harness MCP serverName must match [A-Za-z0-9_-]{1,32}')\n  }\n  if (typeof config.command !== 'string') throw new TypeError('Harness MCP command must be a string')\n  const args = config.args === undefined ? [] : config.args\n  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {\n    throw new TypeError('Harness MCP args must be an array of strings')\n  }\n  const env = config.env === undefined ? {} : config.env\n  if (env === null || Array.isArray(env) || typeof env !== 'object') {\n    throw new TypeError('Harness MCP env must be an object of string values')\n  }\n  if (Object.values(env).some((value) => typeof value !== 'string')) {\n    throw new TypeError('Harness MCP env must be an object of string values')\n  }\n  const cwd = config.cwd === undefined ? '' : config.cwd\n  if (typeof cwd !== 'string') throw new TypeError('Harness MCP cwd must be a string')\n  if (typeof config.failOnStartupError !== 'boolean') throw new TypeError('Harness MCP failOnStartupError must be a boolean')\n  const lines = [",
  'renderer schema validation',
)
source = replaceOnce(
  source,
  "    `    args: ${json(Array.from(config.args ?? []))}`,\n    `    cwd: ${json(config.cwd)}`,\n    '    env:',\n  ]\n  for (const [key, value] of Object.entries(config.env ?? {})) {",
  "    `    args: ${json(args)}`,\n    `     cwd: ${json(cwd)}`,\n    '    env:',\n  ]\n  for (const [key, value] of Object.entries(env)) {",
  'renderer normalized values',
)
writeFileSync(sourcePath, source)

const testPath = 'test/artemis-mcp-config.test.mjs'
let test = readFileSync(testPath, 'utf8')
const marker = "test('rejects non-boolean Cordis startup error flags instead of coercing truthiness', () => {"
if (test.split(marker).length !== 2) throw new Error('expected startup flag test marker')
const addition = `test('validates Cordis stdio config shapes instead of coercing malformed values', () => {
  const base = {
    id: 'mcp-artemis',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'artemis',
      transport: 'stdio',
      command: '/safe/python',
      args: ['-m', 'mcp_server'],
      cwd: '/safe/artemis',
      env: { SAFE_KEY: 'safe' },
      failOnStartupError: false,
    },
  }

  const cases = [
    [{ transport: 'streamable-http' }, /transport must be 'stdio'/],
    [{ serverName: 'bad name' }, /serverName must match/],
    [{ command: 7 }, /command must be a string/],
    [{ args: 'mcp_server' }, /args must be an array of strings/],
    [{ args: ['-m', 7] }, /args must be an array of strings/],
    [{ env: 'SAFE_KEY=safe' }, /env must be an object of string values/],
    [{ env: ['safe'] }, /env must be an object of string values/],
    [{ env: { SAFE_KEY: 7 } }, /env must be an object of string values/],
    [{ cwd: 7 }, /cwd must be a string/],
  ]

  for (const [override, expected] of cases) {
    assert.throws(
      () => renderHarnessMcpCordisRow({ ...base, config: { ...base.config, ...override } }),
      expected,
    )
  }

  const defaults = renderHarnessMcpCordisRow({
    ...base,
    config: {
      serverName: 'artemis',
      transport: 'stdio',
      command: '/safe/python',
      failOnStartupError: false,
    },
  })
  assert.match(defaults, /args: \[\]/)
  assert.match(defaults, /cwd: ""/)
  assert.ok(defaults.includes('    env:\\n    failOnStartupError: false'))
})

`
test = test.replace(marker, addition + marker)
writeFileSync(testPath, test)
