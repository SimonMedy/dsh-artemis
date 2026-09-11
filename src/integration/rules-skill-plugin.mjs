import path from 'node:path'
import {
  DEFAULT_MAX_ARTEMIS_RULES_BYTES,
  registerArtemisRulesSkill,
} from './artemis-rules-skill.mjs'

export const name = 'dsh-artemis-rules-skill'
export const inject = ['skills']

function normalizeConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('dsh-artemis rules-skill config must be an object')
  }
  const artemisRoot = config.artemisRoot
  if (typeof artemisRoot !== 'string' || !artemisRoot.trim()) {
    throw new TypeError('dsh-artemis rules-skill requires config.artemisRoot')
  }
  if (!path.isAbsolute(artemisRoot)) {
    throw new TypeError('dsh-artemis rules-skill config.artemisRoot must be an absolute path')
  }

  const maxBytes = config.maxRulesBytes ?? DEFAULT_MAX_ARTEMIS_RULES_BYTES
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('config.maxRulesBytes must be a positive integer')
  }

  return Object.freeze({ artemisRoot: path.normalize(artemisRoot), maxBytes })
}

export function apply(ctx, config) {
  const normalized = normalizeConfig(config)
  ctx.effect(
    () => registerArtemisRulesSkill(ctx, {
      artemisRoot: normalized.artemisRoot,
      maxBytes: normalized.maxBytes,
    }),
    'dsh-artemis: ARTEMIS rules skill',
  )
}

export { normalizeConfig as normalizeRulesSkillConfig }
