import { assets } from './assets'
import { foundations } from './foundations'
import { glossary } from './glossary'
import { investing } from './investing'
import { numbers } from './numbers'
import { trading } from './trading'
import type { Lesson, Track } from './types'

export const TRACKS: Track[] = [
  { id: 'foundations', title: 'Foundations', blurb: 'How markets work and what you can own: stocks, funds, bonds, cash.' },
  { id: 'investing', title: 'Investing well', blurb: 'Costs, allocation, accounts, taxes and the habits that decide results.' },
  { id: 'numbers', title: 'Reading the numbers', blurb: 'Quote screens, fund sheets and bond listings, field by field.' },
  { id: 'trading', title: 'Trading craft', blurb: 'Orders, sizing, stops, expectancy and an honest look at the odds.' },
  { id: 'assets', title: 'Other assets', blurb: 'Bonds in depth, REITs, commodities, crypto, options, alternatives.' },
]

/** All lessons in reading order. */
export const LESSONS: Lesson[] = [...foundations, ...investing, ...numbers, ...trading, ...assets]
export { glossary }
export * from './types'
