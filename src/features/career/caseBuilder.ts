// Promotion case builder (pure): turns real records into one page of markdown text.
import { WIN_TAGS, TAG_LABEL, formatImpact } from './impact'
import { improvementPct, resultSentence, type Project } from './projects'
import type { Win } from './leadership'

export interface CaseGoal { title: string; pct: number }
export interface CaseInput {
  role: string
  months: 3 | 6 | 12
  today: string
  wins: Win[]
  projects: Project[]
  goals: CaseGoal[]
  learning: { title: string; completedAt: string }[]
  feedback: { date: string; text: string }[]
}

export function periodStart(today: string, months: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(y, m - 1 - months, 1)
  t.setDate(Math.min(d, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()))
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const winLine = (w: Win) => `- ${w.title}${w.impact ? ` (${formatImpact(w.impact)})` : ''} [${w.date}]`

export function buildCase(c: CaseInput): string {
  const start = periodStart(c.today, c.months)
  const inRange = (d: string) => d >= start && d <= c.today
  const wins = c.wins.filter((w) => inRange(w.date)).sort((a, b) => b.date.localeCompare(a.date))
  const featured = c.projects.find((p) => p.featured) ?? c.projects[0]
  const sentence = featured ? resultSentence(featured) : ''
  const count = (t: string) => wins.filter((w) => (w.tags as string[]).includes(t)).length
  const role = c.role.trim() || '[Target role]'

  const out: string[] = []
  out.push(`# Case for ${role}`, `Period: ${start} to ${c.today} (last ${c.months} months)`, '')
  const head = [`${wins.length} documented ${wins.length === 1 ? 'win' : 'wins'}`]
  if (sentence) head.push(sentence.charAt(0).toLowerCase() + sentence.slice(1))
  out.push('## Headline', head.join('; ') + '.', '')

  out.push('## Top wins by area')
  if (!wins.length) out.push('No wins logged in this period.')
  for (const t of WIN_TAGS) {
    const group = wins.filter((w) => w.tags.includes(t))
    if (!group.length) continue
    out.push(`### ${TAG_LABEL[t]}`, ...group.slice(0, 5).map(winLine))
  }
  const untagged = wins.filter((w) => !w.tags.length)
  if (untagged.length) out.push('### Other', ...untagged.slice(0, 5).map(winLine))
  out.push('')

  out.push('## Improvement project')
  if (featured) {
    out.push(`${featured.name} (${featured.status})`)
    if (featured.problem) out.push(`Problem: ${featured.problem}`)
    if (featured.change) out.push(`Change: ${featured.change}`)
    out.push(sentence ? sentence + '.' : 'Result not measured yet.')
    if (featured.baseline && featured.result && improvementPct(featured) == null) out.push('Percent change is not defined for a zero baseline.')
  } else out.push('No project tracked yet.')
  out.push('')

  out.push('## Leadership', `- Mentoring wins: ${count('mentoring')}`, `- Escalations handled: ${count('escalation')}`, `- Cross-team work: ${count('cross-team')}`, '')

  out.push('## Goals (career)')
  if (c.goals.length) out.push(...c.goals.map((g) => `- ${g.title}: ${Math.round(g.pct)}%`))
  else out.push('No career goals tracked.')
  out.push('')

  out.push('## Learning completed')
  const learn = c.learning.filter((l) => inRange(l.completedAt))
  if (learn.length) out.push(...learn.map((l) => `- ${l.title} [${l.completedAt}]`))
  else out.push('None in this period.')
  out.push('')

  out.push('## Feedback received')
  const fb = c.feedback.filter((f) => inRange(f.date))
  if (fb.length) out.push(...fb.map((f) => `- "${f.text}" [${f.date}]`))
  else out.push('None recorded in 1:1 notes.')
  out.push('')

  const gaps = WIN_TAGS.filter((t) => count(t) === 0).map((t) => TAG_LABEL[t])
  out.push('## Gaps to close')
  out.push(gaps.length ? gaps.map((g) => `- ${g}: no wins logged`).join('\n') : 'Every category has at least one win.')
  return out.join('\n')
}
