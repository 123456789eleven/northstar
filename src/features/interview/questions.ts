// The Interview: what Northstar still does not know about you. Pure data, no DB access.
// Answers live in one device setting (profile.answers); `applyAnswers` turns the concrete ones into real records.

export type QType = 'text' | 'long' | 'number' | 'choice' | 'multi'

export interface Question {
  id: string
  type: QType
  label: string
  /** Why it is asked, shown under the label. */
  why: string
  options?: string[]
  placeholder?: string
  unit?: string
}

export interface Section { id: string; title: string; blurb: string; questions: Question[] }

export const PROFILE_KEY = 'profile.answers'
export type Answers = Record<string, string | number | string[]>

export const SECTIONS: Section[] = [
  {
    id: 'you', title: 'You', blurb: 'What a good year means to you, in your words.',
    questions: [
      { id: 'name', type: 'text', label: 'What should Northstar call you?', why: 'Greetings and recaps use it.' },
      { id: 'goodYear', type: 'long', label: 'It is a year from now and it went well. What happened?', why: 'Your answer becomes the "why" behind your goals.' },
      { id: 'quit', type: 'multi', label: 'What makes you stop using an app?', why: 'Tells me which friction to remove first.', options: ['Too much typing', 'Feels like homework', 'Guilt when I miss days', 'Gets boring', 'Too cluttered', 'I forget it exists'] },
      { id: 'pull', type: 'multi', label: 'What pulls you back to an app?', why: 'Decides which game features get the screen space.', options: ['Streaks', 'Progress bars', 'Levels and XP', 'Boss goals', 'Seeing numbers move', 'Weekly recaps', 'Quiet and simple'] },
    ],
  },
  {
    id: 'rhythm', title: 'Rhythm', blurb: 'When your day actually has room.',
    questions: [
      { id: 'wake', type: 'text', label: 'Usual wake-up time', why: 'Morning plans start from here.', placeholder: '6:30 am' },
      { id: 'bed', type: 'text', label: 'Usual bedtime', why: 'Evening prompts stop before it.', placeholder: '11 pm' },
      { id: 'workHours', type: 'text', label: 'Work days and hours', why: 'Keeps tasks out of work hours.', placeholder: 'Mon to Fri, 8 to 4:30' },
      { id: 'focus', type: 'choice', label: 'When is your head clearest?', why: 'Hard tasks get suggested then.', options: ['Early morning', 'Late morning', 'Afternoon', 'Evening', 'Late night'] },
      { id: 'weekTarget', type: 'number', label: 'How many days a week do you realistically open Northstar and do something?', why: 'Sets your weekly streak target (1 to 7).', unit: 'days' },
    ],
  },
  {
    id: 'career', title: 'Career', blurb: 'The path to management, made specific.',
    questions: [
      { id: 'role', type: 'text', label: 'Your current role', why: 'The starting line of your promotion case.' },
      { id: 'targetRole', type: 'text', label: 'The role you want next', why: 'Becomes a year goal.', placeholder: 'Team lead' },
      { id: 'targetBy', type: 'text', label: 'By when?', why: 'Dates the goal.', placeholder: '2027-06-30' },
      { id: 'blocker', type: 'long', label: 'What is the biggest thing standing between you and that role?', why: 'Shapes which skills and wins to track first.' },
      { id: 'sponsor', type: 'text', label: 'Who at work could vouch for you?', why: 'Becomes a contact with a check-in cadence.' },
      { id: 'careerSkills', type: 'long', label: 'Skills you want to be known for', why: 'Seeds the Learning list, one per line.' },
    ],
  },
  {
    id: 'body', title: 'Body and food', blurb: 'Weight gain needs real numbers.',
    questions: [
      { id: 'height', type: 'number', label: 'Height', why: 'Needed for BMI and calorie estimates.', unit: 'inches' },
      { id: 'weight', type: 'number', label: 'Weight today', why: 'Logged as your first weigh-in.', unit: 'lb' },
      { id: 'goalWeight', type: 'number', label: 'Goal weight', why: 'The finish line of your weight path.', unit: 'lb' },
      { id: 'trainDays', type: 'number', label: 'Lifting days per week you can actually keep', why: 'Creates the Lift habit at that pace.', unit: 'days' },
      { id: 'calories', type: 'number', label: 'Daily calorie target (leave blank if unsure)', why: 'Fills the calorie ring on Food.', unit: 'kcal' },
      { id: 'protein', type: 'number', label: 'Daily protein target (leave blank if unsure)', why: 'Fills the protein ring on Food.', unit: 'g' },
      { id: 'eatBlock', type: 'multi', label: 'What makes eating enough hard?', why: 'Decides which meal prompts help.', options: ['Low appetite', 'Skip meals when busy', 'Hard to cook', 'Eat too little at once', 'Eating out costs too much', 'Forget to log'] },
      { id: 'foods', type: 'long', label: 'Foods you reliably eat and like', why: 'Seeds quick-add favorites, one per line.' },
      { id: 'avoid', type: 'text', label: 'Anything you avoid or are allergic to', why: 'Suggestions skip it.' },
    ],
  },
  {
    id: 'money', title: 'Money', blurb: 'The numbers I can not read off a statement.',
    questions: [
      { id: 'vtiShares', type: 'number', label: 'VTI shares you own', why: 'Creates the holding on Investments.', unit: 'shares' },
      { id: 'vtiAccount', type: 'text', label: 'Which account holds them?', why: 'Must match the account name in Net worth.', placeholder: 'Roth IRA' },
      { id: 'vtiPrice', type: 'number', label: 'VTI price today (optional)', why: 'Turns shares into a balance. Update it any time.', unit: '$' },
      { id: 'saveMonthly', type: 'number', label: 'What you want to save each month', why: 'Kept with your answers so budgets can be planned around it.', unit: '$' },
      { id: 'emergency', type: 'number', label: 'Emergency fund target', why: 'Becomes a finance goal.', unit: '$' },
      { id: 'moneyWorry', type: 'long', label: 'What worries you most about money right now?', why: 'Decides which Finance card leads.' },
    ],
  },
  {
    id: 'people', title: 'People', blurb: 'Relationships fade without a reminder.',
    questions: [
      { id: 'circle', type: 'long', label: 'Up to five people you want to stay close to', why: 'Added to People, one name per line.' },
      { id: 'cadence', type: 'choice', label: 'How often should they hear from you?', why: 'Check-in reminder cadence.', options: ['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly'] },
      { id: 'dates', type: 'long', label: 'Birthdays or dates you never want to miss', why: 'Reminders. Free text, one per line.' },
    ],
  },
]

export const allQuestions = (): Question[] => SECTIONS.flatMap((s) => s.questions)

export const isAnswered = (v: Answers[string] | undefined): boolean =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim() !== ''

export function progress(a: Answers): { done: number; total: number; bySection: Record<string, { done: number; total: number }> } {
  const bySection: Record<string, { done: number; total: number }> = {}
  let done = 0
  let total = 0
  for (const s of SECTIONS) {
    const d = s.questions.filter((q) => isAnswered(a[q.id])).length
    bySection[s.id] = { done: d, total: s.questions.length }
    done += d
    total += s.questions.length
  }
  return { done, total, bySection }
}

/** Plain-text copy of the answers, for pasting into a chat. */
export function answersAsText(a: Answers): string {
  const out: string[] = []
  for (const s of SECTIONS) {
    const rows = s.questions.filter((q) => isAnswered(a[q.id]))
    if (!rows.length) continue
    out.push(`## ${s.title}`)
    for (const q of rows) out.push(`${q.label}\n${Array.isArray(a[q.id]) ? (a[q.id] as string[]).join(', ') : a[q.id]}`)
  }
  return out.join('\n\n')
}

export const CADENCE_DAYS: Record<string, number> = { Weekly: 7, 'Every 2 weeks': 14, Monthly: 30, Quarterly: 90 }

/** One name per line, bullets stripped, capped. */
export const lines = (s: unknown, max = 8): string[] =>
  (typeof s === 'string' ? s : '').split(/\r?\n/).map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean).slice(0, max)
