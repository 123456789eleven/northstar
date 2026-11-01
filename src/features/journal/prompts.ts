// Daily prompt library. Deterministic by date so the same day always opens with the same prompt.
export type PromptTheme = 'growth' | 'work' | 'body' | 'people' | 'money' | 'gratitude' | 'reflection'

export interface Prompt { theme: PromptTheme; text: string }

const p = (theme: PromptTheme, text: string): Prompt => ({ theme, text })

export const PROMPTS: Prompt[] = [
  p('growth', 'What is one skill you are a little better at than a month ago?'),
  p('growth', 'What did you avoid this week that you could do for ten minutes today?'),
  p('growth', 'Which habit would make everything else easier, and what is the smallest version?'),
  p('growth', 'What mistake taught you the most recently?'),
  p('growth', 'What would the person you want to be do differently today?'),
  p('growth', 'What are you learning right now that you are not yet good at?'),
  p('growth', 'Where did you choose comfort over progress lately, and was it worth it?'),
  p('growth', 'What is a belief about yourself you are ready to update?'),
  p('work', 'What problem did you solve this week that nobody asked you to?'),
  p('work', 'Describe one thing you did that a team lead would do.'),
  p('work', 'What is one result from this week you could put in your promotion case?'),
  p('work', 'Who at work should know what you accomplished, and how will they hear it?'),
  p('work', 'What process on your team is slower than it needs to be, and how would you fix it?'),
  p('work', 'What feedback have you been putting off asking for?'),
  p('work', 'What would your manager say is the gap between your role and the next one?'),
  p('work', 'Which task this week taught you something about leading others?'),
  p('work', "What did you do today that made someone else's job easier?"),
  p('work', 'What is one thing you could document today so it is not lost?'),
  p('body', 'How did your body feel in your last workout, and what does that suggest for the next one?'),
  p('body', 'What did you eat this week that gave you real energy?'),
  p('body', 'How much protein and sleep did you actually get yesterday?'),
  p('body', 'What is the one lift you most want to add weight to, and what stops you?'),
  p('body', 'When did your energy dip today, and what came just before?'),
  p('body', 'What would training consistency look like for the next seven days?'),
  p('body', 'What is your body asking for that you have been ignoring?'),
  p('body', 'Which meal is hardest to get right for your goal, and what is one fix?'),
  p('people', 'Who deserves a message from you today, and what would you say?'),
  p('people', 'Who made your week better, and did they know it?'),
  p('people', 'What conversation have you been avoiding?'),
  p('people', 'When did you last listen without planning your reply?'),
  p('people', 'Who could you help this week with something small?'),
  p('people', 'Which relationship needs more of your time, and which needs less?'),
  p('people', 'What did someone teach you without meaning to?'),
  p('money', 'What did you spend on this week that you would happily buy again?'),
  p('money', 'What is one bill or subscription you could cut or negotiate?'),
  p('money', 'What is the next number you want your savings to reach, and by when?'),
  p('money', 'What does enough look like for you this year?'),
  p('money', 'What money habit are you proud of?'),
  p('money', 'If your pay rose 10 percent after a promotion, where would the first dollar go?'),
  p('money', 'What purchase did you regret, and what was it really for?'),
  p('gratitude', 'What small thing made today easier?'),
  p('gratitude', 'Who are you grateful for, and for what specifically?'),
  p('gratitude', 'What is something you have now that you once hoped for?'),
  p('gratitude', 'What did your body let you do today?'),
  p('gratitude', 'What ordinary moment from today would you like to keep?'),
  p('gratitude', 'What difficulty are you quietly grateful for?'),
  p('gratitude', 'What place makes you feel calm, and when did you last visit?'),
  p('reflection', 'What is on your mind that you have not said out loud?'),
  p('reflection', 'What would make today a good day, even if everything else goes wrong?'),
  p('reflection', 'What are you tolerating that you could change?'),
  p('reflection', 'What did you spend the most attention on today, and was it the right thing?'),
  p('reflection', 'If this week were a chapter, what would its title be?'),
  p('reflection', 'What are you pretending not to know?'),
  p('reflection', 'What do you want more of next month, and what less?'),
  p('reflection', 'When did you feel most like yourself recently?'),
  p('reflection', 'What would you tell yourself a year ago?'),
  p('reflection', 'What is the most honest sentence you can write right now?'),
  p('reflection', 'What are you looking forward to?'),
  p('reflection', 'What has been taking more energy than it gives back?'),
  p('reflection', 'What decision are you circling, and what do you already know?'),
]

// Small string hash (FNV-1a) so adjacent dates do not give adjacent prompts.
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Prompt for a date. `skip` cycles to the next prompts ("another prompt"); it wraps. */
export function dailyPrompt(date: string, skip = 0, list: Prompt[] = PROMPTS): Prompt {
  const base = hash(date) % list.length
  return list[(((base + skip) % list.length) + list.length) % list.length]
}
