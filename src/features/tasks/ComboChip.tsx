import { useCombo } from './combo'

/** Brief "x3" chip after 3+ completions inside 10 minutes. Visual only; announces nothing. */
export function ComboChip() {
  const n = useCombo()
  if (n == null) return null
  return <span key={n} className="combo-chip" aria-hidden>x{n}</span>
}
