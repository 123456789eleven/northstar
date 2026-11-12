import { describe, expect, it } from 'vitest'
import { breadcrumb, districtForPath, DISTRICTS, FLOOR_ALIASES, floorForPath, floorIndex, hasElevator, moneyTabTarget, rememberPath, STRIP, stripTarget, subtabForPath } from './districts'
import { NAV } from './nav'

describe('districtForPath', () => {
  it('follows the plan table', () => {
    const table: Record<string, string[]> = {
      home: ['/', '/map'],
      plan: ['/today', '/tasks', '/planner', '/goals', '/habits'],
      money: ['/finance'],
      body: ['/body', '/food', '/training'],
      mind: ['/mind', '/journal', '/learning'],
      career: ['/career', '/case', '/projects'],
      people: ['/people', '/reach-out'],
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
      for (const t of d.floors) expect(districtForPath(t.to)).toBe(d.id)
    }
  })
  it('strip is the seven districts without You', () => {
    expect(STRIP).toEqual(['home', 'plan', 'money', 'body', 'mind', 'career', 'people'])
  })
})

describe('subtabForPath and breadcrumb', () => {
  it('finds the tab inside a district', () => {
    expect(subtabForPath('/food').tab?.label).toBe('Kitchen')
    expect(subtabForPath('/tasks').district.id).toBe('plan')
    expect(subtabForPath('/ontology/Task').tab?.label).toBe('Ontology')
    expect(subtabForPath('/career').tab?.label).toBe('Wins')
    expect(subtabForPath('/mind').tab?.label).toBe('Journal')
    expect(subtabForPath('/').tab).toBeNull()
  })
  it('puts each Bank floor and every old Money ?tab= on its floor', () => {
    expect(breadcrumb('/finance')).toEqual(['Bank', 'Lobby'])
    expect(breadcrumb('/finance/vault')).toEqual(['Bank', 'Vault'])
    expect(breadcrumb('/finance/trading', '?view=screener')).toEqual(['Bank', 'Trading floor'])
    expect(breadcrumb('/finance', '?tab=markets')).toEqual(['Bank', 'Trading floor'])
    expect(breadcrumb('/finance', '?tab=budgets')).toEqual(['Bank', 'Vault'])
    expect(breadcrumb('/finance', '?tab=investments')).toEqual(['Bank', 'Trading floor'])
    expect(breadcrumb('/finance', '?tab=learn')).toEqual(['Bank', 'Academy'])
    expect(breadcrumb('/finance', '?tab=practice')).toEqual(['Bank', 'Academy'])
    expect(breadcrumb('/finance', '?tab=transactions&focus=4&month=2026-04')).toEqual(['Bank', 'Archive'])
    expect(breadcrumb('/finance', '?tab=networth')).toEqual(['Bank', 'Archive'])
    expect(breadcrumb('/finance', '?tab=bogus')).toEqual(['Bank', 'Lobby'])
    expect(breadcrumb('/people')).toEqual(['Park', 'Tree'])
    expect(breadcrumb('/review')).toEqual(['Home base', 'Season'])
    expect(breadcrumb('/food')).toEqual(['Gym', 'Kitchen'])
  })
})

describe('floors', () => {
  it('maps the Gym routes to its three floors, top to bottom', () => {
    expect(DISTRICTS.body.floors.map((f) => f.label)).toEqual(['Weigh-in', 'Kitchen', 'Training'])
    expect(floorForPath('/body').floor?.id).toBe('weigh-in')
    expect(floorForPath('/food').floor?.id).toBe('kitchen')
    expect(floorForPath('/training').floor?.id).toBe('training')
    expect(floorIndex('/training')).toBe(2)
    expect(floorIndex('/career')).toBe(0)
    expect(floorIndex('/home-nope')).toBe(-1)
  })
  it('maps Library and Office floors', () => {
    expect(DISTRICTS.mind.floors.map((f) => f.label)).toEqual(['Journal', 'Study'])
    expect(DISTRICTS.career.floors.map((f) => f.label)).toEqual(['Wins', 'Case', 'Projects'])
    expect(floorForPath('/learning').floor?.id).toBe('study')
    expect(floorForPath('/projects').floor?.id).toBe('projects')
  })
  it('gives Town hall five floors and the Park two, with /plan folded into Today', () => {
    expect(DISTRICTS.plan.floors.map((f) => f.label)).toEqual(['Today', 'Tasks', 'Planner', 'Goals', 'Habits'])
    expect(DISTRICTS.people.floors.map((f) => f.label)).toEqual(['Tree', 'Reach out'])
    expect(floorForPath('/plan').floor?.id).toBe('today')
    expect(floorForPath('/reach-out').floor?.id).toBe('reach-out')
    expect(floorForPath('/people').floor?.id).toBe('tree')
  })
  it('sends every alias to a real floor of the same building', () => {
    for (const [from, to] of Object.entries(FLOOR_ALIASES)) {
      expect(floorForPath(from).floor?.to, from).toBe(to)
      expect(districtForPath(from)).toBe(districtForPath(to))
    }
  })
  it('keeps floor labels under four words and gives every building a name', () => {
    for (const d of Object.values(DISTRICTS)) {
      expect(d.building.length).toBeGreaterThan(0)
      for (const f of d.floors) expect(f.label.split(' ').length, f.label).toBeLessThan(4)
    }
  })
  it('shows an elevator only where the frame switches floors', () => {
    expect(hasElevator(DISTRICTS.body)).toBe(true)
    expect(hasElevator(DISTRICTS.plan)).toBe(true)
    expect(hasElevator(DISTRICTS.money)).toBe(true)
    expect(hasElevator(DISTRICTS.career)).toBe(true)
    expect(hasElevator(DISTRICTS.mind)).toBe(true)
    expect(hasElevator(DISTRICTS.people)).toBe(true)
  })
})

describe('moneyTabTarget', () => {
  it('sends old Money links to their floor and view, keeping focus and month', () => {
    expect(moneyTabTarget('?tab=transactions&focus=12&month=2026-04')).toBe('/finance/archive?focus=12&month=2026-04')
    expect(moneyTabTarget('?tab=practice')).toBe('/finance/academy?view=practice')
    expect(moneyTabTarget('?tab=import')).toBe('/finance/archive?view=import')
    expect(moneyTabTarget('?tab=overview')).toBe('/finance')
    expect(moneyTabTarget('?tab=nope')).toBeNull()
    expect(moneyTabTarget('')).toBeNull()
    expect(DISTRICTS.money.floors.map((f) => f.label)).toEqual(['Lobby', 'Vault', 'Trading floor', 'Academy', 'Archive'])
  })
})

describe('stripTarget', () => {
  it('returns to the last page in a district, and to the entry when already there', () => {
    expect(stripTarget('body', 'home')).toBe('/body')
    rememberPath('/food')
    expect(stripTarget('body', 'home')).toBe('/food')
    expect(stripTarget('body', 'body')).toBe('/body')
    rememberPath('/finance/trading')
    expect(stripTarget('money', 'plan')).toBe('/finance/trading')
    expect(stripTarget('home', 'plan')).toBe('/')
  })
})
