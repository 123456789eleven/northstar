import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db'
import { buildCase, periodStart } from './caseBuilder'
import { addWin, makeTaskFromCommitment, removeWin, saveOneOnOne, winFromEvent } from './careerData'
import { formatImpact, parseImpact, parseWinInput } from './impact'
import { monthlyCounts, type Win } from './leadership'
import { commitmentKey, composeOneOnOne, parseOneOnOnes } from './oneOnOne'
import { barWidths, improvementPct, parseProjects, resultSentence, serializeProjects, type Project } from './projects'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 2, 12, 0))
})
afterEach(() => vi.useRealTimers())

describe('impact parser', () => {
  it('parses value and unit', () => {
    expect(parseImpact('3h/week')).toEqual({ value: 3, unit: 'h/week' })
    expect(parseImpact('0 errors this quarter')).toEqual({ value: 0, unit: 'errors this quarter' })
    expect(parseImpact('1.5 hours')).toEqual({ value: 1.5, unit: 'hours' })
    expect(parseImpact('lots')).toBeNull()
  })
  it('formats tight and spaced units', () => {
    expect(formatImpact({ value: 3, unit: 'h/week' })).toBe('3h/week')
    expect(formatImpact({ value: 0, unit: 'errors this quarter' })).toBe('0 errors this quarter')
    expect(formatImpact({ value: 20, unit: '%' })).toBe('20%')
  })
  it('splits a win line into title, tags and impact', () => {
    const p = parseWinInput('shipped the new checklist #reliability #impact 3h/week #Mentoring')
    expect(p).toEqual({ title: 'shipped the new checklist', tags: ['reliability', 'mentoring'], impact: { value: 3, unit: 'h/week' } })
  })
  it('keeps unknown hashtags and a non-numeric impact in the title', () => {
    const p = parseWinInput('fixed it #weird #impact big')
    expect(p.impact).toBeUndefined()
    expect(p.title).toBe('fixed it #weird #impact big')
  })
})

const proj = (over: Partial<Project> = {}): Project => ({
  id: 'p1', name: 'handoff errors', problem: '', better: 'lower', change: '', status: 'measuring', next: '', featured: true,
  baseline: { value: 10, unit: 'per week', date: '2026-06-01' }, result: { value: 4, unit: 'per week', date: '2026-10-01' }, ...over,
})

describe('project math', () => {
  it('computes percent and sentence', () => {
    expect(improvementPct(proj())).toBe(60)
    expect(resultSentence(proj())).toBe('Reduced handoff errors from 10 per week to 4 per week (60%)')
  })
  it('higher-is-better and regressions', () => {
    expect(improvementPct(proj({ better: 'higher', baseline: { value: 50, unit: '%', date: '2026-06-01' }, result: { value: 75, unit: '%', date: '2026-10-01' } }))).toBe(50)
    expect(resultSentence(proj({ result: { value: 12, unit: 'per week', date: '2026-10-01' } }))).toMatch(/^Increased handoff errors from 10 per week to 12 per week \(20%\)$/)
  })
  it('zero baseline gives no percent and no divide by zero', () => {
    const p = proj({ baseline: { value: 0, unit: 'errors', date: '2026-06-01' }, result: { value: 0, unit: 'errors', date: '2026-10-01' } })
    expect(improvementPct(p)).toBeNull()
    expect(resultSentence(p)).toBe('Reduced handoff errors from 0 errors to 0 errors')
    expect(barWidths(p)).toEqual({ before: 0, after: 0 })
  })
  it('bars share one scale; missing metrics give nothing', () => {
    expect(barWidths(proj())).toEqual({ before: 100, after: 40 })
    expect(barWidths(proj({ result: undefined }))).toBeNull()
    expect(resultSentence(proj({ result: undefined }))).toBe('')
  })
  it('round-trips, caps at 20, keeps one featured, drops junk', () => {
    const many = Array.from({ length: 25 }, (_, i) => proj({ id: `p${i}`, featured: true }))
    const out = parseProjects(serializeProjects(many))
    expect(out).toHaveLength(20)
    expect(out.filter((p) => p.featured)).toHaveLength(1)
    expect(parseProjects({ v: 2, items: [] })).toEqual([])
    expect(parseProjects({ v: 1, items: [null, { id: 1 }, { id: 'a', name: 'x', status: 'bogus' }] }).map((p) => p.status)).toEqual(['idea'])
  })
})

describe('1:1 notes', () => {
  const text = composeOneOnOne({ topics: 'Q4 plan\nworkload', mine: 'send the summary\nMe: book training', theirs: 'ask about the open role', feedback: 'Clear communicator' })
  it('composes labeled sections and tags', () => {
    expect(text).toContain('#1on1')
    expect(text).toContain('Me: send the summary')
    expect(text).toContain('Me: book training')
    expect(text).toContain('Them: ask about the open role')
  })
  it('extracts commitments, topics and feedback only', () => {
    const [n] = parseOneOnOnes('2026-10-20', `unrelated line\n${text}`)
    expect(n.me).toEqual(['send the summary', 'book training'])
    expect(n.them).toEqual(['ask about the open role'])
    expect(n.topics).toEqual(['Q4 plan', 'workload'])
    expect(n.feedback).toEqual(['Clear communicator'])
  })
  it('handles two blocks and bulleted commitments', () => {
    const t = `1:1 with manager #1on1\n- Me: a\n\n1:1 with manager #1on1\nThem: b`
    const notes = parseOneOnOnes('2026-10-20', t)
    expect(notes.map((n) => [n.me, n.them])).toEqual([[['a'], []], [[], ['b']]])
  })
})

const win = (date: string, title: string, tags: Win['tags'] = [], impact?: Win['impact']): Win => ({ id: Math.random(), date, title, tags, impact })

describe('leadership counters', () => {
  it('counts by month, oldest first, ignoring out-of-range', () => {
    const rows = monthlyCounts([win('2026-11-01', 'a', ['mentoring']), win('2026-10-03', 'b', ['escalation', 'cross-team']), win('2025-01-01', 'old', ['mentoring'])], '2026-11', 3)
    expect(rows.map((r) => r.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(rows[2]).toMatchObject({ wins: 1, mentoring: 1 })
    expect(rows[1]).toMatchObject({ escalation: 1, 'cross-team': 1 })
  })
})

describe('case builder', () => {
  const base = {
    role: 'Team Lead', months: 6 as const, today: '2026-11-02',
    wins: [
      win('2026-10-15', 'Cut handoff errors', ['reliability', 'improvement'], { value: 6, unit: 'per week' }),
      win('2026-09-01', 'Trained two new hires', ['mentoring']),
      win('2026-02-01', 'Too old', ['client']),
    ],
    projects: [proj()],
    goals: [{ title: 'Lead a project', pct: 40 }],
    learning: [{ title: 'Excel course', completedAt: '2026-08-01' }, { title: 'Ancient', completedAt: '2025-01-01' }],
    feedback: [{ date: '2026-10-20', text: 'Clear communicator' }],
  }
  it('period start', () => {
    expect(periodStart('2026-11-02', 6)).toBe('2026-05-02')
    expect(periodStart('2026-03-31', 1)).toBe('2026-02-28')
  })
  it('composes every section from data and lists gaps', () => {
    const t = buildCase(base)
    expect(t).toContain('# Case for Team Lead')
    expect(t).toContain('2 documented wins')
    expect(t).toContain('- Cut handoff errors (6 per week)')
    expect(t).toContain('Reduced handoff errors from 10 per week to 4 per week (60%)')
    expect(t).toContain('Mentoring wins: 1')
    expect(t).toContain('Lead a project: 40%')
    expect(t).toContain('Excel course')
    expect(t).not.toContain('Ancient')
    expect(t).not.toContain('Too old')
    expect(t).toContain('"Clear communicator"')
    expect(t).toContain('- Escalation: no wins logged')
    expect(t).toContain('- Client: no wins logged')
    expect(t).not.toContain('- Reliability: no wins logged')
  })
  it('placeholder role and empty states', () => {
    const t = buildCase({ ...base, role: ' ', wins: [], projects: [], goals: [], learning: [], feedback: [] })
    expect(t).toContain('[Target role]')
    expect(t).toContain('No wins logged in this period.')
    expect(t).toContain('No project tracked yet.')
    expect(t).toContain('None recorded in 1:1 notes.')
  })
})

describe('win log (db)', () => {
  it('logs a milestone career.win event with tags and impact, and undo removes it', async () => {
    const r = await addWin('shipped checklist #impact 3h/week', ['reliability'])
    const [e] = await db.events.toArray()
    expect(e).toMatchObject({ area: 'career', kind: 'career.win', title: 'shipped checklist', milestone: true })
    expect(winFromEvent(e)).toMatchObject({ date: '2026-11-02', tags: ['reliability'], impact: { value: 3, unit: 'h/week' } })
    await r!.undo()
    expect(await db.events.count()).toBe(0)
  })
  it('ignores empty input; counts capture-bar wins in the career area', async () => {
    expect(await addWin('   #reliability')).toBeNull()
    const id = (await db.events.add({ at: new Date().toISOString(), area: 'career', kind: 'win', title: 'from capture', milestone: true })) as number
    expect(winFromEvent((await db.events.get(id))!)?.title).toBe('from capture')
    expect(winFromEvent({ at: new Date().toISOString(), area: 'personal', kind: 'win', title: 'x', milestone: true, id: 9 })).toBeNull()
  })
  it('remove then restore brings back the same row', async () => {
    const r = await addWin('one')
    const restore = await removeWin(r!.id)
    expect(await db.events.count()).toBe(0)
    await restore!()
    expect((await db.events.get(r!.id))?.title).toBe('one')
  })
  it('1:1 saves to the journal with the tag, make-task undo removes the task', async () => {
    const undo = await saveOneOnOne('2026-11-02', { topics: 't', mine: 'do x', theirs: '', feedback: '' })
    const j = await db.journal.where('date').equals('2026-11-02').first()
    expect(j?.tags).toContain('1on1')
    expect(parseOneOnOnes(j!.date, j!.text)[0].me).toEqual(['do x'])
    const undoTask = await makeTaskFromCommitment(commitmentKey('2026-11-02', 'me', 'do x'), 'do x')
    expect((await db.tasks.toArray())[0].title).toBe('do x')
    await undoTask()
    expect(await db.tasks.count()).toBe(0)
    await undo!()
    expect(await db.journal.count()).toBe(0)
    expect(await saveOneOnOne('2026-11-02', { topics: '', mine: '', theirs: '', feedback: '' })).toBeNull()
  })
})
