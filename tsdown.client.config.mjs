import { isAbsolute, resolve } from 'node:path'

const pluginRootValue = process.env.DSH_ARTEMIS_ROOT
const outDirValue = process.env.DSH_ARTEMIS_CLIENT_OUT_DIR

if (!pluginRootValue || !isAbsolute(pluginRootValue)) {
  throw new Error('DSH_ARTEMIS_ROOT must be an absolute path')
}
if (!outDirValue || !isAbsolute(outDirValue)) {
  throw new Error('DSH_ARTEMIS_CLIENT_OUT_DIR must be an absolute path')
}

const externals = new Set([
  'react',
  '@deepseek-ai/dsh-client-ui-primitives',
])

function isBareSpecifier(source) {
  return !source.startsWith('.')
    && !source.startsWith('/')
    && !source.startsWith('\0')
    && !source.startsWith('node:')
}

export default {
  name: 'dsh-artemis/client',
  entry: {
    client: resolve(pluginRootValue, 'src/client/index.mjs'),
  },
  outDir: outDirValue,
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  deps: {
    neverBundle: (source) => externals.has(source),
    alwaysBundle: (source) => !externals.has(source),
  },
  plugins: [{
    name: 'dsh-artemis-client-purity',
    resolveId(source) {
      if (isBareSpecifier(source) && !externals.has(source)) {
        throw new Error(`dsh-artemis client bundle forbids unreviewed runtime dependency: ${source}`)
      }
      return null
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-artemis", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports;\n} });',
  },
}
