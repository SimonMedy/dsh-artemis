import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  apply,
  inject,
  name,
  normalizeRulesSkillConfig,
} from '../src/integration/rules-skill-plugin.mjs'

async function fakeArtemisRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-artemis-rules-plugin-'))
  await mkdir(path.join(root, 'mcp_server'), { recursive: true })
  await writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="artemis"\n')
  await writeFile(path.join(root, 'mcp_server', '__main__.py'), '# fake\n')
  await writeFile(path.join(root, 'mcp_server', 'rules.md'), '# Rules\n\nDiagnosis first.\n')
  return root
}

test('rules-skill face declares only the native skills dependency', () => {
  assert.equal(name, 'dsh-artemis-rules-skill')
  assert.deepEqual(inject, ['skills'])
})

test('rules-skill config requires an explicit absolute ARTEMIS root', () => {
  assert.throws(() => normalizeRulesSkillConfig(), /object/)
  assert.throws(() => normalizeRulesSkillConfig({}), /artemisRoot/)
  assert.throws(() => normalizeRulesSkillConfig({ artemisRoot: './artemis' }), /absolute path/)
  assert.throws(() => normalizeRulesSkillConfig({ artemisRoot: '/tmp/artemis', maxRulesBytes: 0 }), /positive integer/)
})

test('plugin effect registers upstream rules through Harness lifecycle', async () => {
  const root = await fakeArtemisRoot()
  const effects = []
  const registrations = []
  const dispose = () => {}
  const ctx = {
    effect(factory, label) { effects.push({ factory, label }) },
    skills: {
      register(skill) {
        registrations.push(skill)
        return dispose
      },
    },
  }

  apply(ctx, { artemisRoot: root, maxRulesBytes: 64 * 1024 })
  assert.equal(effects.length, 1)
  assert.match(effects[0].label, /rules skill/)
  assert.equal(await effects[0].factory(), dispose)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].name, 'artemis-mobile-testing')
  assert.equal(registrations[0].path, path.join(root, 'mcp_server', 'rules.md'))
})
