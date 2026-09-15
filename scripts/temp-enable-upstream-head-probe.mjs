import fs from 'node:fs'

function replaceExact(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  return source.replace(oldText, newText)
}

function patchWorkflow(path, oldSha, newSha, label) {
  let source = fs.readFileSync(path, 'utf8')
  source = replaceExact(
    source,
    'on:\n',
    'on:\n  push:\n    branches: [gpt/phase-7-upstream-head-probe]\n',
    `${label} push trigger`,
  )
  source = replaceExact(source, oldSha, newSha, `${label} upstream SHA`)
  fs.writeFileSync(path, source)
}

patchWorkflow(
  '.github/workflows/harness-compat.yml',
  'c291e7961a515f6d7af9304e7fd1d257929aef26',
  '0d1f50007f9bca3f52b06e1c3074fa14d5fb0720',
  'Harness',
)
patchWorkflow(
  '.github/workflows/artemis-compat.yml',
  '086078819209c7139d6f833cfdc6d5cc80d9f19a',
  '371aa6df56880643da57b30da936e9812fb0ec66',
  'ARTEMIS',
)
