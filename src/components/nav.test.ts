import { describe, expect, it } from 'vitest'
import { NAV, routeTitle } from './nav'

describe('routeTitle', () => {
  it('titles every nav route uniquely', () => {
    const titles = NAV.map((n) => routeTitle(n.to))
    expect(new Set(titles).size).toBe(NAV.length)
    expect(routeTitle('/tasks')).toBe('Tasks | Northstar')
    expect(routeTitle('/')).toBe('Today | Northstar')
  })
  it('matches nested paths and falls back', () => {
    expect(routeTitle('/ontology/Task')).toBe('Ontology | Northstar')
    expect(routeTitle('/nope')).toBe('Northstar')
  })
})
