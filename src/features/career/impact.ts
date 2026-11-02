// Win quick-add parsing (pure): "shipped the new checklist #reliability #impact 3h/week".
export const WIN_TAGS = ['reliability', 'improvement', 'mentoring', 'escalation', 'client', 'cross-team'] as const
export type WinTag = (typeof WIN_TAGS)[number]
export const TAG_LABEL: Record<WinTag, string> = {
  reliability: 'Reliability',
  improvement: 'Improvement',
  mentoring: 'Mentoring',
  escalation: 'Escalation',
  client: 'Client',
  'cross-team': 'Cross-team',
}

export interface Impact { value: number; unit: string }
export interface ParsedWin { title: string; tags: WinTag[]; impact?: Impact }

/** "3h/week" -> {3, 'h/week'}; "0 errors this quarter" -> {0, 'errors this quarter'}. Null when there is no leading number. */
export function parseImpact(raw: string): Impact | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(.*?)\s*$/.exec(raw)
  if (!m) return null
  const value = Number(m[1])
  if (!Number.isFinite(value)) return null
  return { value, unit: m[2] }
}

/** Short units ("h/week", "%") sit tight against the number; words get a space. */
export function formatUnit(value: number, unit: string): string {
  const tight = !unit || /^([a-z]{1,2}(\/|$)|%)/i.test(unit)
  return tight ? `${value}${unit}` : `${value} ${unit}`
}
export const formatImpact = (i: Impact) => formatUnit(i.value, i.unit)

export function parseWinInput(input: string): ParsedWin {
  let text = input.trim()
  let impact: Impact | undefined
  const im = /(?:^|\s)#impact\s+([^#]*)/i.exec(text)
  if (im) {
    const parsed = parseImpact(im[1])
    if (parsed) {
      impact = parsed
      text = text.replace(im[0], ' ')
    }
  }
  const tags: WinTag[] = []
  const words = text.split(/\s+/).filter((w) => {
    const t = w.startsWith('#') ? w.slice(1).toLowerCase() : ''
    if (t && (WIN_TAGS as readonly string[]).includes(t)) {
      if (!tags.includes(t as WinTag)) tags.push(t as WinTag)
      return false
    }
    return w.length > 0
  })
  return { title: words.join(' ').trim(), tags, impact }
}
