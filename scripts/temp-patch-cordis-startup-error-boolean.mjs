import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const sourcePath = 'src/integration/artemis-mcp-config.mjs'
let source = readFileSync(sourcePath, 'utf8')
source = replaceOnce(
  source,
  "  const config = row.config\n  const lines = [",
  "  const config = row.config\n  if (typeof config.failOnStartupError !== 'boolean') throw new TypeError('Harness MCP failOnStartupError must be a boolean')\n  const lines = [",
  'Cordis startup boolean validation',
)
source = replaceOnce(
  source,
  "  lines.push(`    failOnStartupError: ${config.failOnStartupError ? 'true' : 'false'}`)",
  "  lines.push(`    failOnStartupError: ${config.failOnStartupError ? 'true' : 'false'}`)",
  'Cordis startup boolean rendering',
)
writeFileSync(sourcePath, source)

const testPath = 'test/artemis-mcp-config.test.mjs'
let test = readFileSync(testPath, 'utf8')
const marker = "test('quotes Cordis environment keys so YAML metacharacters cannot inject entries', () => {"
if (test.split(marker).length !== 2) throw new Error('expected one Cordis key quoting marker')
const addition = `test('rejects non-boolean Cordis startup error flags instead of coercing truthiness', () => {
  const base = {
    id: 'mcp-artemis',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'artemis',
      transport: 'stdio',
      command: '/safe/python',
      args: ['-m', 'mcp_server'],
      cwd: '/safe/artemis',
      env: {},
    },
  }

  for (const failOnStartupError of ['false', 0, 1, null, undefined]) {
    assert.throws(
      () => renderHarnessMcpCordisRow({
        ...base,
        config: { ...base.config, failOnStartupError },
      }),
      /failOnStartupError must be a boolean/,
    )
  }

  assert.match(
    renderHarnessMcpCordisRow({ ...base, config: { ...base.config, failOnStartupError: false } }),
    /failOnStartupError: false/,
  )
  assert.match(
    renderHarnessMcpCordisRow({ ...base, config: { ...base.config, failOnStartupError: true } }),
    /failOnStartupError: true/,
  )
})

`
test = test.replace(marker, addition + marker)
writeFileSync(testPath, test)
