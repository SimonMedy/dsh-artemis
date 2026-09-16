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
  "    lines.push(`      ${key}: ${json(value)}`)",
  "    lines.push(`      ${json(key)}: ${json(value)}`)",
  'Cordis env key rendering',
)
writeFileSync(sourcePath, source)

const testPath = 'test/artemis-mcp-config.test.mjs'
let test = readFileSync(testPath, 'utf8')
const marker = "test('renders paths and values as quoted JSON-compatible YAML scalars', async () => {"
if (test.split(marker).length !== 2) throw new Error('expected one renderer test marker')
const addition = `test('quotes Cordis environment keys so YAML metacharacters cannot inject entries', () => {
  const yaml = renderHarnessMcpCordisRow({
    id: 'mcp-artemis',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'artemis',
      transport: 'stdio',
      command: '/safe/python',
      args: ['-m', 'mcp_server'],
      cwd: '/safe/artemis',
      env: {
        'SAFE_KEY': 'safe',
        'BAD_KEY:\\n      injected': 'value',
      },
      failOnStartupError: false,
    },
  })

  assert.match(yaml, /"SAFE_KEY": "safe"/)
  assert.ok(yaml.includes(`${JSON.stringify('BAD_KEY:\\n      injected')}: "value"`))
  assert.equal(yaml.includes('\\n      injected: "value"'), false)
})

`
test = test.replace(marker, addition + marker)
test = test.replace(/PYTHONUNBUFFERED: "1"/g, '"PYTHONUNBUFFERED": "1"')
test = test.replace(/ARTEMIS_DESKTOP_NOTIFY: "true"/g, '"ARTEMIS_DESKTOP_NOTIFY": "true"')
writeFileSync(testPath, test)
