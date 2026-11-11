// Conversation starters and plain-words contact lines, built only from what the app already knows about a person.
// Pure and deterministic: the phrasing varies by person and last contact, never by chance or the network.
import type { ISODate, Person } from '../../db'
import { addDays, daysBetween, parseISODate } from '../../lib/dates'
import { firstName } from './tree'
import { nextBirthday } from './people'

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h }
const pick = <T,>(list: T[], seed: string): T => list[hash(seed) % list.length]
const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** #tags written in notes, lower-cased. */
export const tagsOf = (p: Pick<Person, 'notes'>): string[] => [...new Set((p.notes ?? '').toLowerCase().match(/#[a-z][\w-]{1,24}/g) ?? [])]

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const firstNote = (notes?: string) => {
  const line = (notes ?? '').replace(/#[\w-]+/g, '').split(/\n|(?<=[.!?])\s/).map((l) => l.trim()).find((l) => l.length > 3)
  return line ? clip(line.replace(/[.!?]+$/, '')) : null
}

export function contactWords(p: Pick<Person, 'lastContact'>, now: ISODate): string {
  if (!p.lastContact) return 'No chat logged yet'
  const n = Math.max(0, daysBetween(p.lastContact, now))
  if (n === 0) return 'You spoke today'
  if (n === 1) return 'You spoke yesterday'
  return `You spoke ${n} days ago`
}

/** Sports-commentary nudge for the reach-out list. Describes the gap and points at the next move, never guilt. */
export function reachLine(p: Pick<Person, 'name' | 'lastContact' | 'cadenceDays'>, now: ISODate): string {
  const f = firstName(p.name)
  if (!p.lastContact) return `${f} is waiting on a first hello. Get the scoring started.`
  const days = Math.max(0, daysBetween(p.lastContact, now))
  const over = days - p.cadenceDays
  if (p.cadenceDays > 0 && over >= 0) {
    if (days >= 30) return `${f} has been waiting ${days} days. Bring them back into the game.`
    return over === 0 ? `${f} is due today. A short message does it.` : `${f} is ${unit(over, 'day')} past your rhythm. A short message does it.`
  }
  const left = p.cadenceDays - days
  return `${f} is up in ${unit(left, 'day')}. Get ahead of it.`
}

export function starterFor(p: Person, now: ISODate, others: Person[] = []): string {
  const f = firstName(p.name)
  const days = p.lastContact ? Math.max(0, daysBetween(p.lastContact, now)) : null
  const seed = `${p.id ?? p.name}:${p.lastContact ?? 'none'}`
  const bday = p.birthday ? nextBirthday(p.birthday, now) : null
  const toBday = bday ? daysBetween(now, bday) : null

  if (toBday === 0) return pick([`It is ${f}'s birthday today. Lead with that.`, `${f}'s birthday is today. A message now lands best.`], seed)
  if (toBday !== null && toBday <= 7) {
    return pick([`${f}'s birthday is in ${unit(toBday, 'day')}. Ask how they plan to spend it.`, `Birthday coming up for ${f} in ${unit(toBday, 'day')}. A good excuse to reach out early.`], seed)
  }
  if (days === null) return pick([`You have not logged a chat with ${f} yet. Say hello and ask what they are into lately.`, `Start the scoreboard with ${f}. One easy question: what has your week been like?`], seed)

  if (days >= 60) return pick([`It has been ${days} days. Skip the apology and open with something you remember about ${f}.`, `${days} days is a long gap and a good story. Ask ${f} what changed since you last talked.`], seed)
  const note = firstNote(p.notes)
  if (note) return pick([`Ask ${f} about this: ${note.charAt(0).toLowerCase()}${note.slice(1)}.`, `From your notes: ${note}. Ask how that is going.`], seed)
  const mine = tagsOf(p)
  const match = others.find((o) => o.id !== p.id && tagsOf(o).some((t) => mine.includes(t)))
  if (match) {
    const tag = tagsOf(match).find((t) => mine.includes(t))!
    return pick([`${f} and ${firstName(match.name)} both come up under ${tag}. Ask ${f} what they think.`, `${tag} connects ${f} and ${firstName(match.name)}. A good thread to pull.`], seed)
  }
  if (days >= 14) return pick([`It has been ${unit(Math.round(days / 7), 'week')}. Ask ${f} what the best part of their month has been.`, `Pick up with ${f}: what is the one thing they are looking forward to?`], seed)
  if (days <= 3) return pick([`You just spoke. A quick follow-up on whatever came up keeps ${f} close.`, `Fresh chat with ${f}. Send one line about something that made you think of them.`], seed)
  const rel = p.relation.trim().toLowerCase()
  return pick([`Ask ${f} what is new this week.`, `Share something small with ${f}: a song, a photo, a link.`, rel ? `Check in on your ${rel}, ${f}: how is life really going?` : `Check in with ${f}: how is life really going?`], seed)
}

/** The one subtle moment after a 60+ day gap (used as the toast message). */
export function reconnectLine(p: Pick<Person, 'name'>, days: number): string {
  const f = firstName(p.name)
  return days >= 180
    ? `${days} days apart and you picked it back up with ${f}. That is a record-worthy comeback.`
    : `${f} is back in the game after ${days} days. Logged.`
}

/** Next Saturday strictly after today. */
export function defaultHangoutDate(now: ISODate): ISODate {
  const dow = parseISODate(now).getDay()
  return addDays(now, ((6 - dow + 7) % 7) || 7)
}
