// 1:1 notes (pure): compose a labeled block, tag it #1on1, and pull commitments back out.
export const ONE_ON_ONE_TAG = '1on1'
const HEADER = /^1:1\b.*#1on1\b/i

export interface OneOnOneDraft { topics: string; mine: string; theirs: string; feedback: string }

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export function composeOneOnOne(d: OneOnOneDraft): string {
  const out = ['1:1 with manager #1on1']
  if (d.topics.trim()) out.push('Topics:', ...lines(d.topics).map((l) => `- ${l}`))
  for (const l of lines(d.mine)) out.push(`Me: ${l.replace(/^me:\s*/i, '')}`)
  for (const l of lines(d.theirs)) out.push(`Them: ${l.replace(/^them:\s*/i, '')}`)
  if (d.feedback.trim()) out.push('Feedback:', ...lines(d.feedback))
  return out.join('\n')
}

export interface ParsedNote {
  date: string
  topics: string[]
  me: string[]
  them: string[]
  feedback: string[]
}

/** All 1:1 blocks in one journal entry's text (a block runs from its header to the next header or the end). */
export function parseOneOnOnes(date: string, text: string): ParsedNote[] {
  const out: ParsedNote[] = []
  let cur: ParsedNote | null = null
  let section: 'topics' | 'feedback' | null = null
  for (const raw of text.split('\n')) {
    const l = raw.trim()
    if (HEADER.test(l)) {
      cur = { date, topics: [], me: [], them: [], feedback: [] }
      out.push(cur)
      section = null
      continue
    }
    if (!cur || !l) continue
    const c = /^(?:[-*]\s*)?(me|them)\s*:\s*(.+)$/i.exec(l)
    if (c) {
      cur[c[1].toLowerCase() as 'me' | 'them'].push(c[2].trim())
      section = null
    } else if (/^topics:\s*$/i.test(l)) section = 'topics'
    else if (/^feedback:\s*$/i.test(l)) section = 'feedback'
    else if (section) cur[section].push(l.replace(/^[-*]\s*/, ''))
  }
  return out
}

export const commitmentKey = (date: string, who: 'me' | 'them', text: string) => `${date}|${who}|${text}`
