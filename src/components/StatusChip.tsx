// StatusChip: dot + word, status = good | warn | info | neutral. Color never stands alone.
export default function StatusChip({ status = 'neutral', children }: { status?: 'good' | 'warn' | 'info' | 'neutral'; children: string }) {
  return (
    <span className={`status-chip status-${status}`}>
      <span className="status-dot" aria-hidden />
      {children}
    </span>
  )
}
