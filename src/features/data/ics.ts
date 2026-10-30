// Pure .ics (iCalendar) parser. Turns VEVENTs into calendar rows; no DB access here.
import { addDays, daysBetween, parseISODate, toISODate } from '../../lib/dates'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_SPAN_DAYS = 31
export const MAX_OCCURRENCES = 800

export interface IcsEvent {
  title: string
  date: string
  start?: string
  end?: string
  allDay: boolean
  location?: string
  notes?: string
  uid?: string
}

export interface IcsResult {
  events: IcsEvent[]
  skipped: { title: string; reason: string }[]
  total: number
}

interface Prop {
  name: string
  params: Record<string, string>
  value: string
}

export const unfold = (t: string) => t.replace(/\r?\n[ \t]/g, '')

export function unescapeText(s: string) {
  return s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c))
}

function parseLine(line: string): Prop | null {
  let inQ = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQ = !inQ
    else if (c === ':' && !inQ) {
      colon = i
      break
    }
  }
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const parts: string[] = []
  let cur = ''
  inQ = false
  for (const c of head) {
    if (c === '"') inQ = !inQ
    if (c === ';' && !inQ) {
      parts.push(cur)
      cur = ''
    } else cur += c
  }
  parts.push(cur)
  const params: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: parts[0].toUpperCase(), params, value: line.slice(colon + 1) }
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => toISODate(d)
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Offset (ms) of a time zone from UTC at a given instant; throws on an unknown zone. */
function tzOffset(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
  const p: Record<string, number> = {}
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

interface When {
  date: string
  time?: string
  /** local Date for timed values */
  at?: Date
}

function parseWhen(p: Prop): When | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(p.value.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (m[4] === undefined || p.params.VALUE === 'DATE') return { date: `${m[1]}-${m[2]}-${m[3]}` }
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)]
  let at: Date
  if (m[7]) at = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  else if (p.params.TZID) {
    const wall = Date.UTC(y, mo - 1, d, h, mi, s)
    try {
      let ms = wall - tzOffset(wall, p.params.TZID)
      ms = wall - tzOffset(ms, p.params.TZID)
      at = new Date(ms)
    } catch {
      at = new Date(y, mo - 1, d, h, mi, s) // unknown zone name: treat as local time
    }
  } else at = new Date(y, mo - 1, d, h, mi, s)
  return { date: localDate(at), time: localTime(at), at }
}

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  interval: number
  count?: number
  until?: string
  byday?: number[]
}
const DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

function parseRrule(v: string): Rule | string {
  const r: Record<string, string> = {}
  for (const part of v.split(';')) {
    const [k, val] = part.split('=')
    if (k) r[k.toUpperCase()] = val ?? ''
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(r.FREQ)) return `unsupported repeat (${r.FREQ || 'unknown'})`
  const bad = Object.keys(r).filter((k) => !['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'].includes(k))
  if (bad.length) return `unsupported repeat rule (${bad.join(', ')})`
  const rule: Rule = { freq: r.FREQ as Rule['freq'], interval: Math.max(1, Number(r.INTERVAL) || 1) }
  if (r.COUNT) rule.count = Number(r.COUNT)
  if (r.UNTIL) {
    const u = /^(\d{4})(\d{2})(\d{2})/.exec(r.UNTIL)
    if (u) rule.until = `${u[1]}-${u[2]}-${u[3]}`
  }
  if (r.BYDAY) {
    const days = r.BYDAY.split(',').map((d) => (/^[A-Z]{2}$/.test(d) ? DOW[d] : undefined))
    if (days.some((d) => d === undefined)) return 'unsupported repeat rule (BYDAY with position)'
    if (rule.freq === 'MONTHLY') return 'unsupported repeat rule (monthly BYDAY)'
    rule.byday = days as number[]
  }
  return rule
}

function expand(start: string, rule: Rule, limit: string, exdates: Set<string>): string[] {
  const out: string[] = []
  const end = rule.until && rule.until < limit ? rule.until : limit
  let n = 0
  const take = (d: string) => {
    if (d < start) return true
    if (rule.count != null && n >= rule.count) return false
    n++
    if (d > end) return false
    if (!exdates.has(d)) out.push(d)
    return out.length < MAX_OCCURRENCES
  }
  if (rule.freq === 'DAILY') {
    for (let d = start; ; d = addDays(d, rule.interval)) if (!take(d)) break
  } else if (rule.freq === 'WEEKLY') {
    const days = rule.byday?.length ? rule.byday : [parseISODate(start).getDay()]
    const monday = (s: string) => addDays(s, -((parseISODate(s).getDay() + 6) % 7))
    const base = monday(start)
    outer: for (let w = 0; ; w += rule.interval) {
      const ws = addDays(base, w * 7)
      if (ws > end) break
      const set = days.map((x) => addDays(ws, (x + 6) % 7)).sort()
      for (const d of set) if (!take(d)) break outer
    }
  } else {
    const s = parseISODate(start)
    for (let i = 0; ; i += rule.interval) {
      const c = new Date(s.getFullYear(), s.getMonth() + i, 1)
      if (toISODate(c) > end) break
      if (new Date(c.getFullYear(), c.getMonth(), s.getDate()).getMonth() !== c.getMonth()) continue // no 31st this month
      if (!take(toISODate(new Date(c.getFullYear(), c.getMonth(), s.getDate())))) break
    }
  }
  return out
}

/** Splits one event into per-day rows (up to 31 days). */
function spread(base: Omit<IcsEvent, 'date' | 'start' | 'end' | 'allDay'>, startDate: string, startTime: string | undefined, endDate: string | undefined, endTime: string | undefined, allDay: boolean): IcsEvent[] {
  let last = endDate ?? startDate
  if (allDay) last = endDate && endDate > startDate ? addDays(endDate, -1) : startDate // DTEND is exclusive
  else if (endDate && endTime === '00:00' && endDate > startDate) last = addDays(endDate, -1)
  if (last < startDate) last = startDate
  const span = Math.min(daysBetween(startDate, last), MAX_SPAN_DAYS - 1)
  const rows: IcsEvent[] = []
  for (let i = 0; i <= span; i++) {
    const date = addDays(startDate, i)
    if (allDay) rows.push({ ...base, date, allDay: true })
    else if (span === 0) rows.push({ ...base, date, allDay: false, start: startTime, end: endTime && endDate === startDate ? endTime : undefined })
    else if (i === 0) rows.push({ ...base, date, allDay: false, start: startTime, end: '23:59' })
    else if (i === span && last === endDate && endTime) rows.push({ ...base, date, allDay: false, start: '00:00', end: endTime })
    else rows.push({ ...base, date, allDay: true })
  }
  return rows
}

export function parseIcs(text: string, opts: { now?: Date } = {}): IcsResult {
  const now = opts.now ?? new Date()
  const limit = addDays(toISODate(now), 365)
  const lines = unfold(text).split(/\r?\n/)
  const blocks: Prop[][] = []
  let cur: Prop[] | null = null
  let depth = 0
  for (const line of lines) {
    const p = parseLine(line)
    if (!p) continue
    if (p.name === 'BEGIN' && p.value.toUpperCase() === 'VEVENT') {
      cur = []
      depth = 0
    } else if (cur && p.name === 'BEGIN') depth++ // e.g. VALARM
    else if (p.name === 'END' && p.value.toUpperCase() === 'VEVENT' && cur) {
      blocks.push(cur)
      cur = null
    } else if (cur && p.name === 'END') depth--
    else if (cur && depth === 0) cur.push(p)
  }

  const events: IcsEvent[] = []
  const skipped: IcsResult['skipped'] = []
  const overrides: { uid?: string; rid: string; rows: IcsEvent[] }[] = []
  const masters: { uid?: string; rows: Map<string, IcsEvent[]> }[] = []

  for (const props of blocks) {
    const get = (n: string) => props.find((p) => p.name === n)
    const title = unescapeText(get('SUMMARY')?.value ?? '').trim() || '(no title)'
    const status = get('STATUS')?.value.toUpperCase()
    if (status === 'CANCELLED') {
      skipped.push({ title, reason: 'cancelled' })
      continue
    }
    const ds = get('DTSTART')
    const st = ds && parseWhen(ds)
    if (!ds || !st) {
      skipped.push({ title, reason: 'no readable start date' })
      continue
    }
    const allDay = !st.time
    const de = get('DTEND')
    let en = de ? parseWhen(de) : null
    const dur = get('DURATION')?.value
    if (!en && dur && st.at) {
      const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(dur)
      if (m) {
        const ms = ((Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0)) * 24 * 60 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)) * 60000
        const e = new Date(st.at.getTime() + ms)
        en = { date: localDate(e), time: localTime(e), at: e }
      }
    }
    const loc = unescapeText(get('LOCATION')?.value ?? '').trim()
    const notes = unescapeText(get('DESCRIPTION')?.value ?? '').trim()
    const uid = get('UID')?.value.trim() || undefined
    const base = { title, ...(loc && { location: loc }), ...(notes && { notes }), ...(uid && { uid }) }
    const mk = (startDate: string) => {
      const shift = daysBetween(st.date, startDate)
      const endDate = en ? addDays(en.date, shift) : undefined
      return spread(base, startDate, st.time, endDate, en?.time, allDay)
    }

    const rid = get('RECURRENCE-ID')
    if (rid) {
      const w = parseWhen(rid)
      if (w) overrides.push({ uid, rid: w.date, rows: mk(st.date) })
      continue
    }
    const rr = get('RRULE')
    if (rr) {
      const rule = parseRrule(rr.value)
      if (typeof rule === 'string') {
        skipped.push({ title, reason: rule })
        continue
      }
      const ex = new Set<string>()
      for (const p of props.filter((x) => x.name === 'EXDATE')) for (const v of p.value.split(',')) {
        const w = parseWhen({ ...p, value: v })
        if (w) ex.add(w.date)
      }
      const rows = new Map<string, IcsEvent[]>()
      for (const d of expand(st.date, rule, limit, ex)) rows.set(d, mk(d))
      masters.push({ uid, rows })
    } else masters.push({ uid, rows: new Map([[st.date, mk(st.date)]]) })
  }

  for (const o of overrides) {
    const m = masters.find((x) => o.uid && x.uid === o.uid)
    if (m) m.rows.delete(o.rid)
    masters.push({ uid: o.uid, rows: new Map([[o.rid, o.rows]]) })
  }
  for (const m of masters) for (const rows of m.rows.values()) events.push(...rows)
  events.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
  return { events, skipped, total: blocks.length }
}

/** Key used for de-duplication: UID + date, falling back to title + date + start. */
export const icsKey = (e: Pick<IcsEvent, 'uid' | 'date' | 'title' | 'start'>) => (e.uid ? `${e.uid}|${e.date}` : `${e.title.toLowerCase()}|${e.date}|${e.start ?? ''}`)
