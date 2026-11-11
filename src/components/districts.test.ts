import { describe, expect, it } from 'vitest'
import { breadcrumb, districtForPath, DISTRICTS, rememberPath, STRIP, stripTarget, subtabForPath } from './districts'
import { NAV } from './nav'

describe('districtForPath', () => {
  it('follows the plan table', () => {
    const table: Record<string, string[]> = {
      home: ['/', '/map'],
      plan: ['/today', '/plan', '/tasks', '/planner', '/goals', '/habits'],
      money: ['/finance'],
      body: ['/body', '/food'],
      mind: ['/mind', '/journal', '/learning'],
      career: ['/career'],
      people: ['/people'],
      you: ['/you', '/history', '/review', '/ops', '/settings', '/data', '/ontology', '/interview', '/skills', '/score'],
    }
    for (const [id, paths] of Object.entries(table)) for (const p of paths) expect(districtForPath(p), p).toBe(id)
  })
  it('handles nested, unknown and empty paths', () => {
    expect(districtForPath('/ontology/Task')).toBe('you')
    expect(districtForPath('/finance/x')).toBe('money')
    expect(districtForPath('/foodie')).toBe('home')
    expect(districtForPath('/nope')).toBe('home')
    expect(districtForPath('')).toBe('home')
  })
  it('puts every nav route in a district, and every tab target in its own district', () => {
    for (const n of NAV) expect(DISTRICTS[districtForPath(n.to)]).toBeDefined()
    for (const d of Object.values(DISTRICTS)) {
      expect(districtForPath(d.to)).toBe(d.id)
      for (const t of d.tabs) expect(districtForPath(t.to)).toBe(d.id)
    }
  })
  it('strip is the seven districts without You', () => {
    expect(STRIP).toEqual(['home', 'plan', 'money', 'body', 'mind', 'career', 'people'])
  })
})

describe('subtabForPath and breadcrumb', () => {
  it('finds the tab inside a district', () => {
    expect(subtabForPath('/food').tab?.label).toBe('Food')
    expect(subtabForPath('/tasks').district.id).toBe('plan')
    expect(subtabForPath('/ontology/Task').tab?.label).toBe('Ontology')
    expect(subtabForPath('/career').tab).toBeNull()
    expect(subtabForPath('/').tab).toBeNull()
  })
  it('reads the Money tab from the query string', () => {
    expect(breadcrumb('/finance', '?tab=markets')).toEqual(['Money', 'Markets'])
    expect(breadcrumb('/finance', '?tab=budgets')).toEqual(['Money', 'Cash', 'Budgets'])
    expect(breadcrumb('/finance', '?tab=investments')).toEqual(['Money', 'Wealth', 'Investments'])
    expect(breadcrumb('/finance', '?tab=learn')).toEqual(['Money', 'Academy', 'Learn'])
    expect(breadcrumb('/finance', '?tab=bogus')).toEqual(['Money', 'Overview'])
    expect(breadcrumb('/finance')).toEqual(['Money', 'Overview'])
    expect(breadcrumb('/people')).toEqual(['People'])
    expect(breadcrumb('/review')).toEqual(['You', 'Season'])
  })
})

describe('stripTarget', () => {
  it('returns to the last page in a district, and to the entry when already there', () => {
    expect(stripTarget('body', 'home')).toBe('/body')
    rememberPath('/food')
    expect(stripTarget('body', 'home')).toBe('/food')
    expect(stripTarget('body', 'body')).toBe('/body')
    rememberPath('/finance', '?tab=markets')
    expect(stripTarget('money', 'plan')).toBe('/finance?tab=markets')
    expect(stripTarget('home', 'plan')).toBe('/')
  })
})
