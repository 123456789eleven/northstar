// The seven input steps of the setup wizard. Every Add writes to Dexie immediately; each step shows what already exists.
import { useEffect, useState, type FormEvent, type MutableRefObject, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, getSetting, type Area, type LearningItem } from '../../db'
import { AREA_LABEL } from '../../components/uiConsts'
import { parseTaskLines, quarterEnd, yearEnd, dedupeNames, parseAmount, parseBirthday, BUDGET_CATEGORIES, CADENCE_PICKS, HABIT_SUGGESTIONS, nameKey, RELATIONS, WEEKLY_MINUTES, WEEKLY_TARGET_KEY, type HabitSuggestion } from './setupLogic'
import { addGoal, addHabit, addLearning, addPerson, addTasks, saveBudgets, saveFoodTargets, setWeeklyTarget, type AddResult } from './setupActions'
import { TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { describeCapture } from '../../lib/capture'
import { formatDate } from '../../lib/dates'

export interface StepProps {
  onAdded: (label: string) => void
  /** The wizard calls this on Next so text typed but not yet added is not lost. */
  flush: MutableRefObject<(() => Promise<void>) | null>
}

export function Chips<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="setup-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className={`chip setup-chip ${o.value === value ? 'chip-accent' : ''}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Keep the wizard's Next button pointed at this step's latest flush function. */
function useFlush(ref: MutableRefObject<(() => Promise<void>) | null>, fn: () => Promise<void>) {
  useEffect(() => { ref.current = fn })
}

function Have({ children }: { children: ReactNode }) {
  return <p className="setup-have small muted">{children}</p>
}

function useNote() {
  const [note, setNote] = useState('')
  return { say: setNote, node: <p className="setup-note small" role="status" aria-live="polite">{note}</p> }
}

const verdict = (r: AddResult, what: string) => (r === 'added' ? `Added "${what}".` : r === 'duplicate' ? `You already have "${what}".` : '')

/* ---------- 1. Goals ---------- */
export function GoalsStep({ onAdded, flush }: StepProps) {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [title, setTitle] = useState('')
  const [pick, setHorizon] = useState<'life' | 'quarter' | null>(null)
  const [area, setArea] = useState<Area>('personal')
  const [due, setDue] = useState<'quarter' | 'year'>('quarter')
  const { say, node } = useNote()
  const life = goals?.filter((g) => g.horizon === 'life' && g.status === 'active').length ?? 0
  const quarter = goals?.filter((g) => g.horizon === 'quarter' && g.status === 'active').length ?? 0
  // First a life goal; once one exists (or on a re-run) default to quarter goals.
  const horizon = pick ?? (life > 0 ? 'quarter' : 'life')

  async function add(e?: FormEvent) {
    e?.preventDefault()
    const t = title.trim()
    if (!t) return
    const r = await addGoal(t, horizon, area, horizon === 'quarter' ? (due === 'quarter' ? quarterEnd() : yearEnd()) : undefined)
    say(verdict(r, t))
    if (r === 'added') { onAdded(t); setTitle('') ; setHorizon(null) }
  }
  useFlush(flush, async () => { if (title.trim()) await add() })

  return (
    <form className="stack" onSubmit={add}>
      <p className="muted small">Start with one big life goal, then up to three things that would make this quarter a good one.</p>
      <Have>{life} life {life === 1 ? 'goal' : 'goals'}, {quarter} quarter {quarter === 1 ? 'goal' : 'goals'} so far.</Have>
      <Chips label="Goal type" value={horizon} onChange={setHorizon} options={[{ value: 'life', label: 'Life goal' }, { value: 'quarter', label: 'This quarter' }]} />
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Goal" placeholder={horizon === 'life' ? 'e.g. Move into a management role' : 'e.g. Finish the COBRA process guide'} />
      <Chips label="Area" value={area} onChange={setArea} options={AREAS.map((a) => ({ value: a, label: AREA_LABEL[a] ?? a }))} />
      {horizon === 'quarter' && (
        <Chips label="Due" value={due} onChange={setDue} options={[{ value: 'quarter', label: `End of quarter (${formatDate(quarterEnd())})` }, { value: 'year', label: `End of year (${formatDate(yearEnd())})` }]} />
      )}
      <div className="row"><button className="btn" type="submit" disabled={!title.trim()}>Add goal</button>{node}</div>
    </form>
  )
}

/* ---------- 2. Habits ---------- */
export function HabitsStep({ onAdded, flush }: StepProps) {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const [name, setName] = useState('')
  const { say, node } = useNote()
  const have = new Set((habits ?? []).map((h) => nameKey(h.name)))
  const active = (habits ?? []).filter((h) => !h.archived).length

  async function add(h: HabitSuggestion | { name: string }) {
    const r = await addHabit(h)
    say(verdict(r, h.name))
    if (r === 'added') onAdded(h.name)
    return r
  }
  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!name.trim()) return
    const r = await add({ name: name.trim() })
    if (r !== 'invalid') setName('')
  }
  useFlush(flush, async () => { if (name.trim()) await submit() })

  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted small">Tap a suggestion or type your own. Each one is added right away; keep going.</p>
      <Have>You have {active} {active === 1 ? 'habit' : 'habits'}.</Have>
      <div className="setup-chips" role="group" aria-label="Suggested habits">
        {HABIT_SUGGESTIONS.filter((s) => !have.has(nameKey(s.name))).map((s) => (
          <button key={s.name} type="button" className="chip setup-chip" onClick={() => void add(s)}>+ {s.name}</button>
        ))}
      </div>
      <div className="setup-inline">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Habit name" placeholder="Your own, e.g. Call mom on Sunday" />
        <button className="btn" type="submit" disabled={!name.trim()}>Add</button>
      </div>
      {node}
    </form>
  )
}

/* ---------- 3. Money ---------- */
export function MoneyStep({ onAdded, flush }: StepProps) {
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const [vals, setVals] = useState<Record<string, string>>({})
  const { say, node } = useNote()
  const stored = new Map((budgets ?? []).map((b) => [b.category, b.monthlyLimit]))
  const shown = (c: string) => vals[c] ?? (stored.has(c) ? String(stored.get(c)) : '')

  async function save() {
    const parsed: Record<string, number | undefined> = {}
    for (const [c, v] of Object.entries(vals)) parsed[c] = v.trim() === '' ? (stored.has(c) ? 0 : undefined) : parseAmount(v)
    const n = await saveBudgets(parsed)
    setVals({})
    say(n ? `Saved ${n} ${n === 1 ? 'budget' : 'budgets'}.` : 'Nothing changed.')
    if (n) onAdded(`${n} monthly ${n === 1 ? 'budget' : 'budgets'}`)
  }
  useFlush(flush, async () => { if (Object.keys(vals).length) await save() })

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <p className="muted small">Monthly limits for the categories you care about. Leave the rest blank; you can refine on the Finance page.</p>
      <Have>You have {stored.size} {stored.size === 1 ? 'budget' : 'budgets'} set.</Have>
      <div className="setup-grid">
        {BUDGET_CATEGORIES.map((c) => (
          <label key={c} className="setup-money">
            <span>{c}</span>
            <input className="input" inputMode="decimal" value={shown(c)} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} placeholder="$ / mo" aria-label={`${c} monthly limit`} />
          </label>
        ))}
      </div>
      <div className="row"><button className="btn" type="submit" disabled={!Object.keys(vals).length}>Save budgets</button>{node}</div>
      <p className="tiny faint">Savings rate is calculated from your transactions, so there is no target to set here.</p>
    </form>
  )
}

/* ---------- 4. Food ---------- */
export function FoodStep({ onAdded, flush }: StepProps) {
  const t = useLiveQuery(() => getSetting<FoodTargets>(TARGETS_KEY, {}), [])
  const [kcal, setKcal] = useState<string | null>(null)
  const [protein, setProtein] = useState<string | null>(null)
  const { say, node } = useNote()
  const k = kcal ?? (t?.calories != null ? String(t.calories) : '')
  const p = protein ?? (t?.protein != null ? String(t.protein) : '')
  const dirty = kcal !== null || protein !== null

  async function save() {
    const c = parseAmount(k)
    const pr = parseAmount(p)
    if (c == null && pr == null) return
    await saveFoodTargets(c, pr)
    setKcal(null); setProtein(null)
    say('Saved your daily targets.')
    onAdded(`Targets ${c ? `${c} kcal` : ''}${c && pr ? ', ' : ''}${pr ? `${pr} g protein` : ''}`)
  }
  useFlush(flush, async () => { if (dirty) await save() })

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <p className="muted small">Daily targets for the Food page. Both are optional; you can change them any time.</p>
      <Have>{t?.calories || t?.protein ? `Current: ${t?.calories ?? '—'} kcal, ${t?.protein ?? '—'} g protein.` : 'No targets set yet.'}</Have>
      <div className="grid grid-2">
        <label className="field"><span>Calories (kcal)</span><input className="input" inputMode="numeric" value={k} onChange={(e) => setKcal(e.target.value)} placeholder="e.g. 2200" /></label>
        <label className="field"><span>Protein (g)</span><input className="input" inputMode="numeric" value={p} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 150" /></label>
      </div>
      <div className="row"><button className="btn" type="submit" disabled={!dirty}>Save targets</button>{node}</div>
    </form>
  )
}

/* ---------- 5. People ---------- */
export function PeopleStep({ onAdded, flush }: StepProps) {
  const people = useLiveQuery(() => db.people.toArray(), [])
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('Friend')
  const [cadence, setCadence] = useState(30)
  const [bday, setBday] = useState('')
  const { say, node } = useNote()

  async function add(e?: FormEvent) {
    e?.preventDefault()
    const n = name.trim()
    if (!n) return
    if (bday.trim() && !parseBirthday(bday)) { say('Birthday should look like 3/14.'); return }
    const r = await addPerson({ name: n, relation, cadenceDays: cadence, birthday: parseBirthday(bday) })
    say(verdict(r, n))
    if (r === 'added') { onAdded(n); setName(''); setBday('') }
  }
  useFlush(flush, async () => { if (name.trim()) await add() })

  return (
    <form className="stack" onSubmit={add}>
      <p className="muted small">People you want to stay in touch with. Pick how often, and Northstar tells you when someone is due.</p>
      <Have>You have {people?.length ?? 0} {people?.length === 1 ? 'person' : 'people'}.</Have>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Name" placeholder="Name" />
      <Chips label="Relationship" value={relation} onChange={setRelation} options={RELATIONS.map((r) => ({ value: r, label: r }))} />
      <Chips label="Keep in touch" value={cadence} onChange={setCadence} options={CADENCE_PICKS.map((c) => ({ value: c.days, label: c.label }))} />
      <div className="setup-inline">
        <input className="input" value={bday} onChange={(e) => setBday(e.target.value)} aria-label="Birthday, optional" placeholder="Birthday, optional (3/14)" maxLength={10} />
        <button className="btn" type="submit" disabled={!name.trim()}>Add person</button>
      </div>
      {node}
    </form>
  )
}

/* ---------- 6. Learning ---------- */
const LEARN_KINDS: { value: LearningItem['kind']; label: string }[] = [
  { value: 'course', label: 'Course' }, { value: 'skill', label: 'Skill' }, { value: 'certification', label: 'Certification' }, { value: 'book', label: 'Book' },
]
export function LearningStep({ onAdded, flush }: StepProps) {
  const items = useLiveQuery(() => db.learning.toArray(), [])
  const target = useLiveQuery(() => getSetting<number>(WEEKLY_TARGET_KEY, 120), [])
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<LearningItem['kind']>('course')
  const [mins, setMins] = useState<number | null>(null)
  const { say, node } = useNote()
  const shownMins = mins ?? target ?? 120

  async function add(e?: FormEvent) {
    e?.preventDefault()
    const t = title.trim()
    if (!t) return
    const r = await addLearning(t, kind)
    if (mins != null) { await setWeeklyTarget(mins); setMins(null) }
    say(verdict(r, t))
    if (r === 'added') { onAdded(t); setTitle('') }
  }
  async function saveTarget() {
    if (mins == null) return
    await setWeeklyTarget(mins)
    setMins(null)
    say(`Weekly target set to ${mins} minutes.`)
    onAdded(`Weekly study target ${mins} min`)
  }
  useFlush(flush, async () => { if (title.trim()) await add(); else await saveTarget() })
  const opts = [...new Set([...WEEKLY_MINUTES, shownMins])].sort((a, b) => a - b)

  return (
    <form className="stack" onSubmit={add}>
      <p className="muted small">What are you learning right now? The weekly target is your total study time across everything.</p>
      <Have>{items?.length ?? 0} learning {items?.length === 1 ? 'item' : 'items'}. Weekly target: {target ?? 120} min.</Have>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Course or skill" placeholder="e.g. ERISA fundamentals" />
      <Chips label="Kind" value={kind} onChange={setKind} options={LEARN_KINDS} />
      <Chips label="Weekly minutes" value={shownMins} onChange={setMins} options={opts.map((m) => ({ value: m, label: m % 60 === 0 ? `${m / 60} h/wk` : `${m} min/wk` }))} />
      <div className="row">
        <button className="btn" type="submit" disabled={!title.trim()}>Add</button>
        {!title.trim() && mins != null && <button className="btn btn-ghost" type="button" onClick={() => void saveTarget()}>Save target only</button>}
        {node}
      </div>
    </form>
  )
}

/* ---------- 7. First tasks ---------- */
export function TasksStep({ onAdded, flush }: StepProps) {
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), [])
  const open = useLiveQuery(() => db.tasks.where('status').equals('open').count(), [])
  const [text, setText] = useState('')
  const { say, node } = useNote()
  const ctx = { goals: (goals ?? []).filter((g) => g.id != null).map((g) => ({ id: g.id!, title: g.title, area: g.area, horizon: g.horizon })) }
  const parsed = parseTaskLines(text, ctx)
  const dup = dedupeNames([], parsed.map((t) => t.title)).dupes.length

  async function add(e?: FormEvent) {
    e?.preventDefault()
    if (!parsed.length) return
    const { added, skipped } = await addTasks(parsed)
    say(`Added ${added} ${added === 1 ? 'task' : 'tasks'}${skipped ? `, skipped ${skipped} you already have` : ''}.`)
    if (added) onAdded(`${added} ${added === 1 ? 'task' : 'tasks'}`)
    setText('')
  }
  useFlush(flush, async () => { if (parsed.length) await add() })

  return (
    <form className="stack" onSubmit={add}>
      <p className="muted small">One task per line. Dates and priority work as in quick capture, e.g. "call HR friday" or "renew license 12/1 !1".</p>
      <Have>You have {open ?? 0} open {open === 1 ? 'task' : 'tasks'}.</Have>
      <textarea className="textarea setup-tasks" value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Tasks, one per line" placeholder={'Book dentist next week\nSend resume to recruiter fri\nPay car insurance !1'} />
      {parsed.length > 0 && (
        <ul className="setup-preview" aria-label="Preview">
          {parsed.map((t, i) => (
            <li key={i}><span className="setup-prev-title">{t.title}</span><span className="faint tiny">{describeCapture(t).slice(1).join(' · ') || 'No date'}</span></li>
          ))}
        </ul>
      )}
      {dup > 0 && <p className="tiny faint">{dup} repeated {dup === 1 ? 'line' : 'lines'} will be added once.</p>}
      <div className="row"><button className="btn" type="submit" disabled={!parsed.length}>Add {parsed.length || ''} {parsed.length === 1 ? 'task' : 'tasks'}</button>{node}</div>
    </form>
  )
}
