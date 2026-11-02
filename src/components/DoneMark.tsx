/** Small amber check that pops and draws its mark once: the visual half of a completion moment. Decorative. */
export function DoneMark() {
  return (
    <span className="done-mark" aria-hidden>
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.2l2.3 2.3 4.7-5" />
      </svg>
    </span>
  )
}
