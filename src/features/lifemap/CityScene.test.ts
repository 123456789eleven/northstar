// Performance guard for the city chrome: the lite scene (mini-map and backdrop) stays small and static.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { areaWeek } from '../game/areas'
import { CityScene } from './CityScene'
import { buildLifeMap } from './model'

const full = buildLifeMap({
  areas: areaWeek(
    Array.from({ length: 30 }, (_, i) => ({ kind: ['workout', 'journal', 'win', 'learning', 'meal'][i % 5], skill: (['body', 'mind', 'career', 'mind', 'body'] as const)[i % 5], date: '2026-11-1' + (i % 3) })),
    '2026-11-09', 5,
  ),
  target: 5, today: '2026-11-12', netWorth: 250000, budgetsOver: 1, peopleTotal: 12, peopleOverdue: 3, planLeft: 1, planTotal: 4, milestones: ['body'],
  people: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Person ${i}`, ring: 0.5, overdue: i < 3 })),
  holdings: [{ ticker: 'AAA', value: 100 }, { ticker: 'BBB', value: 50 }], weight: { start: 190, current: 180, goal: 170 }, projects: 2,
})

const count = (lite: boolean) => (renderToStaticMarkup(createElement('svg', null, createElement(CityScene, { map: full, selected: null, lite }))).match(/<(polygon|path|circle|ellipse|line|g)\b/g) ?? []).length

describe('CityScene element budget', () => {
  it('lite scene stays under 450 SVG elements with a busy week, with no moving cars', () => {
    const lite = count(true)
    expect(lite).toBeLessThan(450)
    expect(lite).toBeLessThan(count(false))
    expect(renderToStaticMarkup(createElement('svg', null, createElement(CityScene, { map: full, selected: null, lite: true })))).not.toContain('lm-car')
  })
  it('draws both civic places and marks the selected one', () => {
    const html = renderToStaticMarkup(createElement('svg', null, createElement(CityScene, { map: full, selected: 'plan', lite: true })))
    expect(html).toContain('data-d="plan"')
    expect(html).toContain('data-d="you"')
    expect(html).toMatch(/lm-civic is-selected[^>]*data-d="plan"/)
  })
})
