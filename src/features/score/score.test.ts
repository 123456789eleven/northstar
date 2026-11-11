import { describe, expect, it } from 'vitest'
import { computeGhost, computeRecords, computeStanding, deriveUpNext, EMPTY_SNAPSHOT, runInfo, type ScoreSnapshot } from './model'
import { deriveHighlights, MAX_HIGHLIGHTS } from './highlights'
import { wrapLines } from './highlightCard'

const TODAY = '2026-11-10' // a Tuesday
const pad = (n: number) => String(n).padStart(2, '0')
const dayN = (back: number) => { const d = new Date(2026, 10, 10 - back); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function rich(): ScoreSnapshot {
  const s = EMPTY_SNAPSHOT(TODAY)
  for (let w = 1; w <= 20; w++) {
    for (let k = 0; k < (w % 5) + 1; k++) s.tasksDone.push(dayN(w * 7 - 2 + (k % 3)))
    s.habitLogs.push(dayN(w * 7 - 1))
    s.transactions.push({ date: dayN(w * 7 - 3), amount: 100 * w - 700, category: 'Misc' })
    s.study.push({ date: dayN(w * 7 - 4), minutes: 10 * w })
  }
  return s
}

describe('standing', () => {
  it('is empty without history and explains itself', () => {
    const st = computeStanding(EMPTY_SNAPSHOT(TODAY))
    expect(st.status).toBe('empty')
    expect(st.topPct).toBeNull()
  })
  it('is building under four finished weeks', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.tasksDone.push(dayN(9), dayN(16))
    const st = computeStanding(s)
    expect(st.status).toBe('building')
    expect(st.sub).toContain('2 to go')
  })
  it('is ready with a top percent, inputs and an 8-week form guide', () => {
    const st = computeStanding(rich())
    expect(st.status).toBe('ready')
    expect(st.topPct).toBeGreaterThanOrEqual(1)
    expect(st.topPct).toBeLessThanOrEqual(99)
    expect(st.inputs).toHaveLength(6)
    expect(st.inputs.find((i) => i.id === 'body')?.pct).toBeNull()
    expect(st.form).toHaveLength(8)
    expect(st.headline).toMatch(/^Top \d+% of your weeks$/)
  })
})

describe('records', () => {
  it('finds nothing in an empty snapshot', () => {
    expect(computeRecords(EMPTY_SNAPSHOT(TODAY))).toEqual([])
  })
  it('computes best saving month and net worth high with dates and hints', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.transactions.push({ date: '2026-08-10', amount: 900, category: 'x' }, { date: '2026-09-10', amount: 300, category: 'x' }, { date: '2026-11-02', amount: 200, category: 'x' })
    s.balances.push({ date: '2026-08-01', kind: 'asset', balance: 5000 }, { date: '2026-09-01', kind: 'asset', balance: 9000 }, { date: '2026-10-01', kind: 'asset', balance: 8000 })
    const r = computeRecords(s)
    const sm = r.find((x) => x.id === 'saving-month')!
    expect(sm.value).toBe(900)
    expect(sm.date).toBe('2026-08-31')
    expect(sm.hint).toContain('$200')
    const nw = r.find((x) => x.id === 'net-worth')!
    expect(nw.value).toBe(9000)
    expect(nw.holding).toBe(false)
    expect(nw.hint).toContain('$1,000')
  })
  it('counts an under-budget run over completed months', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.budgets.push({ category: 'Food', monthlyLimit: 100 })
    for (const m of ['2026-06', '2026-08', '2026-09', '2026-10']) s.transactions.push({ date: `${m}-05`, amount: -80, category: 'Food' })
    s.transactions.push({ date: '2026-07-05', amount: -150, category: 'Food' })
    const r = computeRecords(s).find((x) => x.id === 'under-budget')!
    expect(r.value).toBe(3)
    expect(r.current).toBe(3)
    expect(r.holding).toBe(true)
  })
  it('runInfo keeps a run alive through yesterday', () => {
    expect(runInfo(['2026-11-08', '2026-11-09'], TODAY).current).toBe(2)
    expect(runInfo(['2026-11-05', '2026-11-06'], TODAY).current).toBe(0)
    expect(runInfo(['2026-11-05', '2026-11-06'], TODAY).best).toBe(2)
  })
  it('weight record follows the target direction', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.weights.push({ date: '2026-10-01', weight: 200 }, { date: '2026-10-20', weight: 190 }, { date: '2026-11-05', weight: 192 })
    s.weightTarget = 180
    const w = computeRecords(s).find((x) => x.id === 'weight')!
    expect(w.value).toBe(10)
    expect(w.date).toBe('2026-10-20')
    expect(w.hint).toBe('2 lb from matching it.')
  })
})

describe('ghost', () => {
  it('compares this week and month with last and best', () => {
    const g = computeGhost(rich())
    expect(g.hasData).toBe(true)
    expect(g.week.best).toBeGreaterThanOrEqual(g.week.last)
    expect(g.week.note.toLowerCase()).not.toMatch(/behind|fail|miss/)
  })
  it('has no ghost without data', () => {
    const g = computeGhost(EMPTY_SNAPSHOT(TODAY))
    expect(g.hasData).toBe(false)
    expect(g.week.note).toContain('Nothing to compare yet')
  })
})

describe('up next', () => {
  it('picks the closest, nearest first, without duplicate titles', () => {
    const recs = computeRecords(rich())
    const next = deriveUpNext(recs, [], [
      { id: 'a', title: 'A', hint: 'h', progress: 0.9, href: '/x' }, { id: 'b', title: 'B', hint: 'h', progress: 0.5, href: '/x' },
      { id: 'c', title: 'C', hint: 'h', progress: 0.7, href: '/x' }, { id: 'd', title: 'A', hint: 'h', progress: 0.2, href: '/x' },
    ])
    expect(next.length).toBeLessThanOrEqual(3)
    const p = next.map((n) => n.progress)
    expect([...p].sort((a, b) => b - a)).toEqual(p)
    expect(new Set(next.map((n) => n.title)).size).toBe(next.length)
  })
})

describe('deriveHighlights', () => {
  it('is empty for an empty snapshot', () => {
    expect(deriveHighlights(EMPTY_SNAPSHOT(TODAY))).toEqual([])
  })
  it('finds net worth record, reconnection and milestone, newest first', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.balances.push({ date: '2026-09-01', kind: 'asset', balance: 1000 }, { date: '2026-10-01', kind: 'asset', balance: 2000 }, { date: '2026-11-01', kind: 'asset', balance: 3000 })
    s.people.push({ id: 1, name: 'Aisha' })
    s.interactions.push({ personId: 1, date: '2026-08-01' }, { personId: 1, date: '2026-11-07' })
    s.events.push({ kind: 'goal.done', at: '2026-10-20T12:00:00Z', title: 'Finished the course', milestone: true })
    const h = deriveHighlights(s)
    expect(h.map((x) => x.kind)).toEqual(['reconnected', 'record', 'milestone'])
    expect(h[0].headline).toBe('Back in touch with Aisha after 98 days.')
    expect(h[1].headline).toBe('Net worth hit a new high: $3,000.')
    expect(h[2].headline).toBe('Finished the course.')
  })
  it('caps at 12', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    for (let i = 0; i < 30; i++) s.events.push({ kind: 'goal.done', at: `${dayN(i)}T12:00:00Z`, title: `Goal ${i}`, milestone: true })
    expect(deriveHighlights(s)).toHaveLength(MAX_HIGHLIGHTS)
  })
  it('ignores old reconnections', () => {
    const s = EMPTY_SNAPSHOT(TODAY)
    s.people.push({ id: 1, name: 'Sam' })
    s.interactions.push({ personId: 1, date: '2025-01-01' }, { personId: 1, date: '2025-06-01' })
    expect(deriveHighlights(s)).toEqual([])
  })
})

describe('wrapLines', () => {
  it('wraps and truncates', () => {
    const m = (t: string) => t.length * 10
    expect(wrapLines(m, 'aa bb cc dd', 50, 5)).toEqual(['aa bb', 'cc dd'])
    expect(wrapLines(m, 'aa bb cc dd ee ff', 50, 2)).toEqual(['aa bb', 'cc dd...'])
  })
})
