import { readFileSync, writeFileSync } from 'node:fs'

const oldSha = '0d1f50007f9bca3f52b06e1c3074fa14d5fb0720'
const newSha = '0a15e36e7f82b6ed45af6fa9759f29b40dcd965d'

for (const path of ['.github/workflows/harness-compat.yml', 'scripts/build-client.mjs']) {
  const source = readFileSync(path, 'utf8')
  const count = source.split(oldSha).length - 1
  if (count !== 1) throw new Error(`${path}: expected one old Harness SHA, found ${count}`)
  writeFileSync(path, source.replace(oldSha, newSha))
}
