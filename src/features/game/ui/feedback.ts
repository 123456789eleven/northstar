// Feedback for game moments: one call plays the haptic tick and the optional sound, each gated by its own setting.
import { haptic } from '../../../lib/haptics'
import { tick } from '../../../lib/sound'

export function celebrate(kind: 'tick' | 'double' = 'tick'): void {
  haptic(kind)
  tick(kind)
}

export const skillVar = (id: string) => `var(--skill-${id})`
