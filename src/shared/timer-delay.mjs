export const MAX_TIMER_DELAY_MS = 2_147_483_647

export function isValidTimerDelay(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
}
