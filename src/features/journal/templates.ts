// Guided entry templates. Plain-text headings the user types under; no schema, just text.
export interface TemplateSection {
  /** Heading written into the entry ("Went well"). */
  label: string
  /** The question shown in step-through mode. */
  prompt: string
}

export interface JournalTemplate {
  id: string
  name: string
  hint: string
  sections: TemplateSection[]
}

const s = (label: string, prompt: string): TemplateSection => ({ label, prompt })

export const TEMPLATES: JournalTemplate[] = [
  {
    id: 'morning',
    name: 'Morning intention',
    hint: 'Three priorities, one worry',
    sections: [
      s('Priority 1', 'What is the most important thing today?'),
      s('Priority 2', 'What is the second thing?'),
      s('Priority 3', 'And the third?'),
      s('Proud of tonight', 'What is one thing you want to be proud of tonight?'),
      s('Worry', 'What is one worry, and what is the smallest step against it?'),
    ],
  },
  {
    id: 'evening',
    name: 'Evening reflection',
    hint: 'Went well, learned, change',
    sections: [
      s('Went well', 'What went well today?'),
      s('Learned', 'What did you learn?'),
      s('Would change', 'What would you do differently?'),
      s('Tomorrow first move', 'What is the first move tomorrow?'),
    ],
  },
  {
    id: 'gratitude',
    name: 'Gratitude',
    hint: 'Three specific things',
    sections: [
      s('Grateful 1', 'Name one specific thing you are grateful for.'),
      s('Grateful 2', 'Another, as specific as you can make it.'),
      s('Grateful 3', 'One more. Who or what made it possible?'),
    ],
  },
  {
    id: 'career',
    name: 'Career log',
    hint: 'Evidence for your promotion case',
    sections: [
      s('Win today', 'What was a win today, however small?'),
      s('Problem solved', 'What problem did you solve, and how?'),
      s('Team lead would', 'What would a team lead have done in your seat?'),
      s('Document for promotion', 'What is one thing to document for your promotion case?'),
    ],
  },
  {
    id: 'body',
    name: 'Body and training',
    hint: 'Training, food, energy, sleep',
    sections: [
      s('Training', 'What training did you do?'),
      s('How it felt', 'How did it feel? Any PRs or niggles?'),
      s('Food that worked', 'What did you eat that worked for your goal?'),
      s('Energy and sleep', 'How were your energy and sleep?'),
    ],
  },
]

export const getTemplate = (id: string | undefined) => TEMPLATES.find((t) => t.id === id)

/** Entry text for a template with the given answers (missing answers are blank). */
export function composeTemplate(t: JournalTemplate, answers: string[] = []): string {
  return t.sections.map((sec, i) => `${sec.label}:\n${(answers[i] ?? '').trim()}`).join('\n\n')
}

/** Caret position just under the first heading of a fresh scaffold. */
export const firstAnswerOffset = (t: JournalTemplate) => `${t.sections[0].label}:\n`.length

/** Recover answers from text composed by composeTemplate (used when resuming step-through). */
export function parseAnswers(t: JournalTemplate, text: string): string[] {
  const out: string[] = []
  let rest = text
  for (let i = 0; i < t.sections.length; i++) {
    const head = `${t.sections[i].label}:\n`
    const at = rest.indexOf(head)
    if (at < 0) { out.push(''); continue }
    rest = rest.slice(at + head.length)
    const nextHead = i + 1 < t.sections.length ? rest.indexOf(`\n\n${t.sections[i + 1].label}:\n`) : -1
    out.push((nextHead >= 0 ? rest.slice(0, nextHead) : rest).trim())
  }
  return out
}
