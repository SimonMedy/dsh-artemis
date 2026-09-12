import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const EXPECTED_HARNESS_SHA = 'c291e7961a515f6d7af9304e7fd1d257929aef26'
const EXPECTED_PACKAGE_MANAGER = 'pnpm@11.7.0'
const EXPECTED_TSDOWN_RANGE = '^0.22.2'
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = resolve(SCRIPT_DIR, '..')

function requireAbsolutePath(name, value) {
  if (!value) throw new Error(`${name} is required`)
  const absolute = resolve(value)
  if (absolute !== value) throw new Error(`${name} must be an absolute path`)
  return absolute
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function assertFile(path) {
  const info = await stat(path)
  if (!info.isFile()) throw new Error(`Expected file: ${path}`)
}

async function run(command, args, options = {}) {
  const { stdout = '', stderr = '' } = await execFileAsync(command, args, {
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  })
  return { stdout, stderr }
}

const harnessRoot = requireAbsolutePath('DSH_HARNESS_ROOT', process.env.DSH_HARNESS_ROOT)
const outputDir = requireAbsolutePath(
  'DSH_ARTEMIS_CLIENT_OUT_DIR',
  process.env.DSH_ARTEMIS_CLIENT_OUT_DIR ?? join(PLUGIN_ROOT, 'lib'),
)
const expectedSha = process.env.DSH_HARNESS_SHA ?? EXPECTED_HARNESS_SHA
if (expectedSha !== EXPECTED_HARNESS_SHA) {
  throw new Error(`DSH_HARNESS_SHA must remain pinned to ${EXPECTED_HARNESS_SHA}`)
}

const harnessPackage = await readJson(join(harnessRoot, 'package.json'))
if (harnessPackage.packageManager !== EXPECTED_PACKAGE_MANAGER) {
  throw new Error(`Pinned Harness packageManager mismatch: expected ${EXPECTED_PACKAGE_MANAGER}`)
}
if (harnessPackage.devDependencies?.tsdown !== EXPECTED_TSDOWN_RANGE) {
  throw new Error(`Pinned Harness tsdown mismatch: expected ${EXPECTED_TSDOWN_RANGE}`)
}

const { stdout: actualShaOutput } = await run('git', ['-C', harnessRoot, 'rev-parse', 'HEAD'])
const actualSha = actualShaOutput.trim()
if (actualSha !== EXPECTED_HARNESS_SHA) {
  throw new Error(`Harness checkout mismatch: expected ${EXPECTED_HARNESS_SHA}, received ${actualSha}`)
}

const configPath = join(PLUGIN_ROOT, 'tsdown.client.config.mjs')
await assertFile(configPath)

await run('pnpm', [
  '--dir', harnessRoot,
  'exec',
  'tsdown',
  '--config', configPath,
], {
  cwd: PLUGIN_ROOT,
  env: {
    ...process.env,
    DSH_ARTEMIS_ROOT: PLUGIN_ROOT,
    DSH_ARTEMIS_CLIENT_OUT_DIR: outputDir,
  },
})

const outputPath = join(outputDir, 'client.js')
await assertFile(outputPath)
const source = await readFile(outputPath, 'utf8')
const requiredMarkers = [
  'window.__ModuleLoader__.load',
  'dsh-artemis',
  '/dsh-artemis/v1/snapshot',
  'Capture Android screen',
]
for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`Generated client bundle is missing marker: ${marker}`)
}
if (/^\s*import\s/m.test(source)) {
  throw new Error('Generated client bundle must not contain ESM imports')
}

console.log(`Generated ${outputPath} from pinned Harness ${EXPECTED_HARNESS_SHA}`)
