import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return text.replace(oldText, newText)
}

const skillPath = 'src/integration/artemis-rules-skill.mjs'
let skill = readFileSync(skillPath, 'utf8')
skill = replaceOnce(
  skill,
  "function assertPositiveInteger(name, value) {\n  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`)\n}",
  "function assertPositiveSafeInteger(name, value) {\n  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive safe integer`)\n}",
  'rules byte-limit validator',
)
skill = replaceOnce(
  skill,
  "  assertPositiveInteger('maxBytes', maxBytes)",
  "  assertPositiveSafeInteger('maxBytes', maxBytes)",
  'rules byte-limit call',
)
writeFileSync(skillPath, skill)

const pluginPath = 'src/integration/rules-skill-plugin.mjs'
let plugin = readFileSync(pluginPath, 'utf8')
plugin = replaceOnce(
  plugin,
  "  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {\n    throw new TypeError('config.maxRulesBytes must be a positive integer')\n  }",
  "  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {\n    throw new TypeError('config.maxRulesBytes must be a positive safe integer')\n  }",
  'plugin rules byte-limit validation',
)
writeFileSync(pluginPath, plugin)

const skillTestPath = 'test/artemis-rules-skill.test.mjs'
let skillTest = readFileSync(skillTestPath, 'utf8')
const skillMarker = "test('rejects empty, oversized, and invalid UTF-8 rules', async () => {"
if (skillTest.split(skillMarker).length !== 2) throw new Error('expected rules rejection test marker')
const skillAddition = "test('requires a safe integer rules byte limit', async () => {\n  const root = await fakeArtemisRoot()\n  await assert.rejects(\n    loadArtemisRules(root, { maxBytes: Number.MAX_SAFE_INTEGER + 1 }),\n    /maxBytes must be a positive safe integer/,\n  )\n})\n\n"
skillTest = skillTest.replace(skillMarker, skillAddition + skillMarker)
writeFileSync(skillTestPath, skillTest)

const pluginTestPath = 'test/rules-skill-plugin.test.mjs'
let pluginTest = readFileSync(pluginTestPath, 'utf8')
const pluginNeedle = "  assert.throws(() => normalizeRulesSkillConfig({ artemisRoot: '/tmp/artemis', maxRulesBytes: 0 }), /positive integer/)"
if (pluginTest.split(pluginNeedle).length !== 2) throw new Error('expected plugin rules limit assertion')
const pluginReplacement = "  assert.throws(() => normalizeRulesSkillConfig({ artemisRoot: '/tmp/artemis', maxRulesBytes: 0 }), /positive safe integer/)\n  assert.throws(\n    () => normalizeRulesSkillConfig({ artemisRoot: '/tmp/artemis', maxRulesBytes: Number.MAX_SAFE_INTEGER + 1 }),\n    /positive safe integer/,\n  )"
pluginTest = pluginTest.replace(pluginNeedle, pluginReplacement)
writeFileSync(pluginTestPath, pluginTest)
