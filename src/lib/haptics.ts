// Haptic ticks for game moments (phone). Opt-in: only when the device-local setting `game.haptics` is on (default OFF);
// the shell syncs that flag here. navigator.vibrate never prompts for a permission; unsupported devices just do nothing.
let enabled = false

export function setHapticsEnabled(v: boolean): void {
  enabled = v
}

export const HAPTIC_PATTERN = { tick: 10, double: [12, 70, 12] } as const

/** Light tick on a completion, double tick on a level-up / day cleared. Returns true when a vibration was requested. */
export function haptic(kind: keyof typeof HAPTIC_PATTERN = 'tick'): boolean {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try {
    return navigator.vibrate(HAPTIC_PATTERN[kind] as VibratePattern)
  } catch {
    return false
  }
}
