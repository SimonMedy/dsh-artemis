import fs from 'node:fs'

const OLD_HARNESS = 'c291e7961a515f6d7af9304e7fd1d257929aef26'
const NEW_HARNESS = '0d1f50007f9bca3f52b06e1c3074fa14d5fb0720'
const OLD_ARTEMIS = '086078819209c7139d6f833cfdc6d5cc80d9f19a'
const NEW_ARTEMIS = '371aa6df56880643da57b30da936e9812fb0ec66'

function replaceAllExact(path, oldText, newText, expectedCount) {
  const source = fs.readFileSync(path, 'utf8')
  const count = source.split(oldText).length - 1
  if (count !== expectedCount) throw new Error(`${path}: expected ${expectedCount} occurrences of ${oldText}, found ${count}`)
  fs.writeFileSync(path, source.split(oldText).join(newText))
}

replaceAllExact('.github/workflows/harness-compat.yml', OLD_HARNESS, NEW_HARNESS, 1)
replaceAllExact('.github/workflows/artemis-compat.yml', OLD_ARTEMIS, NEW_ARTEMIS, 1)
replaceAllExact('scripts/build-client.mjs', OLD_HARNESS, NEW_HARNESS, 1)
replaceAllExact('test/upstream-pin-consistency.test.mjs', OLD_HARNESS, NEW_HARNESS, 1)
replaceAllExact('test/upstream-pin-consistency.test.mjs', OLD_ARTEMIS, NEW_ARTEMIS, 1)
replaceAllExact('test/client-build.test.mjs', OLD_HARNESS, NEW_HARNESS, 1)
replaceAllExact('docs/upstreams.md', OLD_HARNESS, NEW_HARNESS, 1)
replaceAllExact('docs/upstreams.md', OLD_ARTEMIS, NEW_ARTEMIS, 1)
replaceAllExact('docs/upstreams.md', '2026-09-11', '2026-09-15', 2)

fs.copyFileSync('.github/workflows/harness-compat.yml', 'scripts/.staged-harness-compat.yml')
fs.copyFileSync('.github/workflows/artemis-compat.yml', 'scripts/.staged-artemis-compat.yml')
