import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AGENTS keeps MCP independent from plugin RPC', async () => {
  const text = await readFile('AGENTS.md', 'utf8');
  assert.match(text, /Do not replace ARTEMIS MCP/i);
});

test('upstream revisions are full commit SHAs', async () => {
  const text = await readFile('docs/upstreams.md', 'utf8');
  const shas = text.match(/`[0-9a-f]{40}`/g) ?? [];
  assert.equal(shas.length, 2);
});
