import { describe, expect, it } from 'vitest'
import { bankSnapshotFrom, bankSteps, type BankSnapshot } from './bankStage'
import { buildingStage, STAGES } from './stage'

const empty: BankSnapshot = { budgets: 0, formWeeks: 0, netWorthMonths: 0, contributedThisYear: 0, tracksDone: 0 }

describe('Bank stage', () => {
  it('starts dark and points at the Vault first', () => {
    const s = buildingStage('money', { money: empty })!
    expect(s.stage).toBe(0)
    expect(s.line).toBe('Next: set a budget in the Vault')
  })

  it('counts net worth months left in plain words', () => {
    const s = buildingStage('money', { money: { ...empty, budgets: 2, formWeeks: 1, netWorthMonths: 2 } })!
    expect(s.stage).toBe(2)
    expect(s.line).toBe('Next: net worth in 1 more month')
  })

  it('lights all five', () => {
    const s = buildingStage('money', { money: { budgets: 1, formWeeks: 3, netWorthMonths: 4, contributedThisYear: 500, tracksDone: 1 } })!
    expect(s.stage).toBe(STAGES)
    expect(s.next).toBeNull()
  })

  it('keeps labels under four words', () => {
    for (const st of bankSteps(empty)) expect(st.label.split(' ').length).toBeLessThan(4)
  })

  it('builds the snapshot from rows', () => {
    const t = '2026-11-11'
    const snap = bankSnapshotFrom({
      budgets: [{ category: 'Dining', monthlyLimit: 200 }, { category: 'Gas', monthlyLimit: 0 }],
      txs: [{ date: '2026-11-03', amount: -20, category: 'Dining', description: 'Cafe' }],
      bills: [],
      balances: [{ date: '2026-09-01' }, { date: '2026-10-01' }, { date: '2026-10-20' }],
      contributions: [{ date: '2026-02-01', amount: 300, account: 'Roth', kind: 'contribution' }, { date: '2025-12-01', amount: 100, account: 'Roth', kind: 'contribution' }],
      tracksDone: 0,
    }, t)
    expect(snap.budgets).toBe(1)
    expect(snap.formWeeks).toBeGreaterThan(0)
    expect(snap.netWorthMonths).toBe(2)
    expect(snap.contributedThisYear).toBe(300)
  })
})
