// Optional synthesized tick (WebAudio, no audio files). Off by default (`game.sound`); the AudioContext is created lazily
// on the first tick after the user turned sound on, and closed again when it is turned off. No permission prompts.
let enabled = false
let ctx: AudioContext | null = null

type AudioWin = Window & { webkitAudioContext?: typeof AudioContext }

export function setSoundEnabled(v: boolean): void {
  enabled = v
  if (!v && ctx) {
    void ctx.close().catch(() => undefined)
    ctx = null
  }
}

/** A 60 ms sine blip (one for a completion, two rising for a level-up). Quiet: peak gain 0.05. */
export function tick(kind: 'tick' | 'double' = 'tick'): boolean {
  if (!enabled || typeof window === 'undefined') return false
  const AC = window.AudioContext ?? (window as AudioWin).webkitAudioContext
  if (!AC) return false
  try {
    ctx ??= new AC()
    const c = ctx
    const blip = (at: number, freq: number) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(0.05, at + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
      o.connect(g).connect(c.destination)
      o.start(at)
      o.stop(at + 0.07)
    }
    const t = c.currentTime + 0.005
    blip(t, 1320)
    if (kind === 'double') blip(t + 0.09, 1760)
    return true
  } catch {
    return false
  }
}
