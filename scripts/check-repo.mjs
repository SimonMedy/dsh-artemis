import { access, readFile } from 'node:fs/promises';

const required = [
  'AGENTS.md',
  'README.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/investigation.md',
  'docs/testing.md',
  'docs/upstreams.md',
  'docs/roadmap.md',
  'src/host/README.md',
  'src/client/README.md',
  'src/shared/README.md',
];

await Promise.all(required.map((path) => access(path)));

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
if (pkg.name !== 'dsh-artemis') throw new Error('Unexpected package name');

const upstreams = await readFile('docs/upstreams.md', 'utf8');
for (const repo of ['deepseek-ai/deepseek-harness', 'google/artemis']) {
  if (!upstreams.includes(repo)) throw new Error(`Missing upstream pin: ${repo}`);
}

console.log('Repository structure OK');
