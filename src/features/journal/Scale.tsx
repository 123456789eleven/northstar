export function Scale({ label, value, onPick }: { label: string; value?: number; onPick: (n: number | undefined) => void }) {
  return (
    <div className="jr-scale">
      <span className="small muted">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onPick(value === n ? undefined : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
