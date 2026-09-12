import { resolveArtemisPython, validateArtemisRoot } from './artemis-mcp-config.mjs'

function status(artemisRoot, python) {
  return Object.freeze({
    artemisRoot,
    python,
    mcpRuntime: 'unobservable',
  })
}

export async function inspectArtemisSetup({
  env = process.env,
  accessImpl,
} = {}) {
  const rawRoot = env?.ARTEMIS_ROOT
  const rawPython = env?.ARTEMIS_PYTHON
  const hasRoot = typeof rawRoot === 'string' && rawRoot.trim().length > 0
  const hasPython = rawPython !== undefined

  if (!hasRoot) {
    if (hasPython) return status('invalid', 'invalid')
    return status('not-supplied', 'profile-managed')
  }

  let root
  try {
    root = await validateArtemisRoot(rawRoot, { accessImpl })
  } catch {
    return status('invalid', hasPython ? 'invalid' : 'unknown')
  }

  if (!hasPython) return status('validated', 'profile-managed')

  try {
    await resolveArtemisPython(root, {
      explicitPython: rawPython,
      accessImpl,
    })
    return status('validated', 'validated-explicit')
  } catch {
    return status('validated', 'invalid')
  }
}
