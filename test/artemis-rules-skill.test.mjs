import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  ARTEMIS_RULES_SKILL_NAME,
  buildArtemisRulesSkill,
  loadArtemisRules,
  registerArtemisRulesSkill,
} from '../src/integration/artemis-rules-skill.mjs'

async function fakeArtemisRoot(rules = '# ARTEMIS rules\n\nUse mobile_diagnose first.\n') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-skill-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), rules)
  return root
}

test('loads ARTEMIS rules exactly from the validated installation', async () => {
  const content = '# Rules\n\nKeep **exact** markdown.\n'
  const root = await fakeArtemisRoot(content)
  const loaded = await loadArtemisRules(root)
  assert.equal(loaded.root, root)
  assert.equal(loaded.rulesPath, path.join(root, 'mcp_server', 'rules.md'))
  assert.equal(loaded.content, content)
})

test('requires a safe integer rules byte limit', async () => {
  const root = await fakeArtemisRoot()
  await assert.rejects(
    loadArtemisRules(root, { maxBytes: Number.MAX_SAFE_INTEGER + 1 }),
    /maxBytes must be a positive safe integer/,
  )
})

test('rejects empty, oversized, and invalid UTF-8 rules', async () => {
  const emptyRoot = await fakeArtemisRoot('   \n')
  await assert.rejects(loadArtemisRules(emptyRoot), /no instructions/)
  const largeRoot = await fakeArtemisRoot('x'.repeat(64))
  await assert.rejects(loadArtemisRules(largeRoot, { maxBytes: 32 }), /exceeds 32 bytes/)
  const invalidRoot = await fakeArtemisRoot('valid')
  const invalidPath = path.join(invalidRoot, 'mcp_server', 'rules.md')
  await writeFile(invalidPath, Buffer.from([0xc3, 0x28]))
  await assert.rejects(loadArtemisRules(invalidRoot), /not valid UTF-8/)
})

test('builds a native runtime Harness skill without rewriting ARTEMIS rules', async () => {
  const content = '# Mobile testing\n\nDiagnosis first.\n'
  const root = await fakeArtemisRoot(content)
  const skill = await buildArtemisRulesSkill({ artemisRoot: root })
  assert.equal(skill.name, ARTEMIS_RULES_SKILL_NAME)
  assert.equal(skill.provider, 'dsh-artemis')
  assert.equal(skill.source, 'runtime')
  assert.equal(skill.path, path.join(root, 'mcp_server', 'rules.md'))
  assert.deepEqual(skill.resourceBase, { kind: 'directory', path: path.join(root, 'mcp_server') })
  assert.deepEqual(skill.invocation, { modelInvocable: true, userInvocable: true })
  assert.equal(skill.content, content)
  assert.match(skill.description, /ARTEMIS/)
  assert.match(skill.whenToUse, /Android/)
})

test('registers through Harness skills service and returns its exact disposer', async () => {
  const root = await fakeArtemisRoot()
  const registrations = []
  const dispose = () => {}
  const ctx = { skills: { register(skill) { registrations.push(skill); return dispose } } }
  assert.equal(await registerArtemisRulesSkill(ctx, { artemisRoot: root }), dispose)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].name, ARTEMIS_RULES_SKILL_NAME)
})

test('refuses registration without the native Harness skills service', async () => {
  const root = await fakeArtemisRoot()
  await assert.rejects(registerArtemisRulesSkill({}, { artemisRoot: root }), /skills service/)
})
