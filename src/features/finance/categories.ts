// Finance categories + keyword rules. Built-in rules ship with the app; user rules live in
// settings under 'finance.rules' and always win over built-ins.
import { db, getSetting, setSetting, type Transaction } from '../../db'

export const UNCATEGORIZED = 'Uncategorized'
export const INCOME = 'Income'
export const TRANSFER = 'Savings/Transfer'

export const CATEGORIES = [
  'Housing',
  'Utilities',
  'Groceries',
  'Dining',
  'Transport',
  'Gas',
  'Health',
  'Insurance',
  'Subscriptions',
  'Shopping',
  'Entertainment',
  'Personal care',
  'Education',
  'Gifts',
  'Travel',
  'Debt payment',
  TRANSFER,
  INCOME,
  UNCATEGORIZED,
] as const

/** Categories that count toward spending and can carry a budget. */
export const EXPENSE_CATEGORIES: string[] = CATEGORIES.filter((c) => c !== INCOME && c !== TRANSFER && c !== UNCATEGORIZED)

export interface Rule {
  /** Case-insensitive regex source, e.g. "KROGER|WALMART GROCERY". */
  pattern: string
  category: string
}

export const DEFAULT_RULES: Rule[] = [
  { pattern: 'PAYROLL|DIRECT DEP|DIR DEP|SALARY|PAYCHECK|INTEREST PAID|INTEREST EARNED|TAX REFUND|IRS TREAS', category: INCOME },
  { pattern: 'TRANSFER|XFER|ZELLE TO SAVINGS|TO SAVINGS|FROM SAVINGS|VANGUARD|FIDELITY|SCHWAB|BETTERMENT|ACORNS|ROBINHOOD', category: TRANSFER },
  { pattern: 'CREDIT CARD PAYMENT|AUTOPAY|CARD PAYMENT|LOAN PAYMENT|STUDENT LOAN|NAVIENT|NELNET|MOHELA|SALLIE MAE|CAPITAL ONE PAYMENT|DISCOVER PAYMENT|AMEX PAYMENT|CHASE CARD', category: 'Debt payment' },
  { pattern: 'AIRLINE|DELTA AIR|UNITED AIR|AMERICAN AIR|SOUTHWEST|JETBLUE|SPIRIT AIR|FRONTIER|MARRIOTT|HILTON|HYATT|AIRBNB|VRBO|EXPEDIA|BOOKING\\.COM|HOTEL|HERTZ|ENTERPRISE RENT|AVIS', category: 'Travel' },
  { pattern: '\\bRENT\\b|MORTGAGE|APARTMENT|PROPERTY MGMT|HOA', category: 'Housing' },
  { pattern: 'ELECTRIC|ENERGY|POWER|WATER|SEWER|GAS & ELEC|COMCAST|XFINITY|SPECTRUM|VERIZON|AT&T|T-MOBILE|TMOBILE|INTERNET', category: 'Utilities' },
  { pattern: 'KROGER|WALMART GROCERY|WAL-MART GROCERY|ALDI|PUBLIX|SAFEWAY|WHOLE FOODS|WHOLEFDS|TRADER JOE|GIANT EAGLE|MEIJER|WEGMANS|HEB|H-E-B|FOOD LION|SPROUTS|COSTCO|SAMS CLUB|INSTACART|GROCERY|SUPERMARKET', category: 'Groceries' },
  { pattern: 'SHELL|EXXON|\\bMOBIL\\b|CHEVRON|BP#|BP |SPEEDWAY|SUNOCO|MARATHON|CIRCLE K|WAWA|SHEETZ|QUIKTRIP|QT |CASEYS|VALERO|CITGO|FUEL', category: 'Gas' },
  { pattern: 'UBER EATS|DOORDASH|GRUBHUB|STARBUCKS|DUNKIN|MCDONALD|CHIPOTLE|CHICK-FIL-A|CHICKFILA|TACO BELL|WENDY|BURGER KING|SUBWAY|PANERA|DOMINO|PIZZA|RESTAURANT|CAFE|COFFEE|GRILL|DINER|BAR & |BREWING|TST\\*|SQ \\*', category: 'Dining' },
  { pattern: '\\bUBER\\b|LYFT|PARKING|TOLL|TRANSIT|METRO|AMTRAK|JIFFY LUBE|AUTOZONE|O.?REILLY|DMV', category: 'Transport' },
  { pattern: 'NETFLIX|SPOTIFY|HULU|DISNEY|HBO|MAX\\.COM|YOUTUBE|APPLE\\.COM/BILL|ITUNES|GOOGLE \\*|PATREON|AUDIBLE|ADOBE|MICROSOFT|DROPBOX|ICLOUD|PRIME VIDEO|AMAZON PRIME|PARAMOUNT|PEACOCK|OPENAI|ANTHROPIC|CHATGPT', category: 'Subscriptions' },
  { pattern: 'GEICO|PROGRESSIVE|STATE FARM|ALLSTATE|LIBERTY MUTUAL|NATIONWIDE|USAA|INSURANCE', category: 'Insurance' },
  { pattern: 'CVS|WALGREENS|RITE AID|PHARMACY|DENTAL|DENTIST|MEDICAL|HOSPITAL|CLINIC|OPTOMETR|DOCTOR|LABCORP|QUEST DIAG|GYM|PLANET FITNESS|FITNESS', category: 'Health' },
  { pattern: 'SALON|BARBER|SPA |ULTA|SEPHORA|GREAT CLIPS|SUPERCUTS', category: 'Personal care' },
  { pattern: 'AMC |REGAL|CINEMA|THEATER|THEATRE|STEAM|PLAYSTATION|XBOX|NINTENDO|TICKETMASTER|STUBHUB|BOWLING|EVENTBRITE', category: 'Entertainment' },
  { pattern: 'COURSERA|UDEMY|TUITION|COLLEGE|UNIVERSITY|BOOKSTORE|PEARSON|LINKEDIN LEARNING|SKILLSHARE|EDX|DUOLINGO', category: 'Education' },
  { pattern: 'AMAZON|AMZN|TARGET|WALMART|WAL-MART|BEST BUY|HOME DEPOT|LOWES|IKEA|ETSY|EBAY|KOHLS|MACY|TJ MAXX|TJMAXX|MARSHALLS|OLD NAVY|NIKE|DOLLAR GENERAL|DOLLAR TREE', category: 'Shopping' },
  { pattern: 'GOFUNDME|CHARITY|DONATION|1-800-FLOWERS|HALLMARK', category: 'Gifts' },
]

export const RULES_KEY = 'finance.rules'

export function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Rules in priority order: user rules first, then built-ins. */
export function allRules(userRules: Rule[]): Rule[] {
  return [...userRules, ...DEFAULT_RULES]
}

export function categorize(raw: string, amount: number, rules: Rule[]): string {
  const description = raw.replace(/\s+/g, ' ')
  for (const r of rules) {
    const re = safeRegex(r.pattern)
    if (re && re.test(description)) return r.category
  }
  return amount > 0 && /DEPOSIT/i.test(description) ? INCOME : UNCATEGORIZED
}

const NOISE_PREFIX = /^(POS|DEBIT|CREDIT|CARD|PURCHASE|RECURRING|CHECKCARD|CHECK CARD|VISA|ACH|ONLINE|PAYMENT|PMT|WITHDRAWAL|PREAUTHORIZED|SQ \*|TST\*|PP\*|PAYPAL \*)\s*/i

/** A short, stable merchant key from a messy bank description: "POS KROGER #1234 COLUMBUS OH" -> "KROGER". */
export function merchantKey(description: string): string {
  let s = description.toUpperCase().replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 4; i++) {
    const next = s.replace(NOISE_PREFIX, '')
    if (next === s) break
    s = next
  }
  const words: string[] = []
  for (const w of s.split(/[\s*]+/)) {
    if (!w) continue
    if (/[0-9#*]/.test(w) && words.length > 0) break
    if (/[0-9]/.test(w)) continue
    words.push(w)
    if (words.length >= 3) break
  }
  const key = words.join(' ').replace(/[^A-Z0-9&' .-]/g, '').trim()
  return key || description.trim().toUpperCase().slice(0, 24)
}

/** Title-case a merchant key for display. */
export function merchantLabel(key: string) {
  return key.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

/** Add (or replace) a user rule for a merchant and re-categorize every matching transaction. Returns count updated. */
export async function addMerchantRule(merchant: string, category: string): Promise<number> {
  const userRules = await getSetting<Rule[]>(RULES_KEY, [])
  const pattern = escapeRegex(merchant)
  const next = [{ pattern, category }, ...userRules.filter((r) => r.pattern !== pattern)]
  await setSetting(RULES_KEY, next)
  const re = safeRegex(pattern)
  if (!re) return 0
  const matches = await db.transactions.filter((t) => re.test(t.description) && t.category !== category).toArray()
  await db.transactions.bulkUpdate(matches.map((t) => ({ key: t.id!, changes: { category } })))
  return matches.length
}

export function isIncome(t: Transaction) {
  return t.category === INCOME || (t.category === UNCATEGORIZED && t.amount > 0)
}

export function isSpending(t: Transaction) {
  return t.category !== TRANSFER && !isIncome(t)
}
