# Northstar "Constellation": game layer and layout redesign

Status: owner delegated all design calls on 2026-11-02 ("do everything you think should be added... maybe consolidation, a rework"). Every call below is the lead's, with its reason; the owner can redirect any of them (see "Calls to review").

## Intent
Make opening Northstar feel like a game worth returning to, on phone and desktop equally, without adding data entry. The fun comes from real life: every weigh-in, workout, win, journal line, contact and budget day moves a visible character sheet. Brand idea: the app is called Northstar, so progress is a **constellation**: five life skills are five stars that brighten and connect as you level them.

## Goals / non-goals / anti-goals
Goals: a reason to open the app daily (a mission board that is different every day and finishes itself), a sense of progress on weeks and quarters (seasons, bosses), delight in every interaction (motion, haptics, tiny moments), one layout system that is native on a thumb and on a 27-inch screen.
Non-goals: multiplayer, leaderboards, purchases, avatars/pets, push notifications, sound by default, anything that needs new manual data entry.
Anti-goals (a failure even if it "works"): guilt or loss mechanics (no streak wipe, no "you are falling behind" nagging), XP that can be farmed with fake actions, cheesy RPG art (swords, coins, confetti storms), a game layer that gets in the way of the useful app. A **Calm mode** switch turns the whole game layer off (levels, quests, XP) and keeps the new layout.

## Constraints (unchanged)
Local-first and private; no new off-device paths; no new dependencies; tokens only; AA contrast; reduced motion / transparency fallbacks; blur never on rows; every existing route and test keeps working; phone >=360px, no horizontal scroll, tap targets >=44px for primary actions. XP is DERIVED from existing tables (events, weights, meals, habit logs, journal, tasks, people interactions, learning logs, transactions): no schema change, so nothing can be lost or desynced and sync keeps working.

## Approaches considered
A. **Reskin only** (grey and purple tokens, more motion). Cheap, but nothing new brings you back: rejected.
B. **Game layer on real data + consolidated hubs (chosen).** Derived XP, levels per life skill, daily quests that complete themselves, weekly streaks with rest tokens, seasons and bosses tied to your quarter goals, a trophy room, and a navigation consolidated from 18 pages to 5 hubs. Builds on what exists (events timeline, goal auto-progress, Week in numbers).
C. **Separate "game mode" app.** Doubles the surface and splits attention: rejected.

## Visual direction: "Graphite and Violet" (replaces the amber-led Aurora palette)
Dark graphite neutrals with a subtle violet cast, one deep violet accent, soft indigo and slate glows, glass kept but quieter. Amber/gold is demoted to a single job: **reward** (XP gain, level-up, trophies), so a reward always reads as special.
| Token | Value | Use |
|---|---|---|
| `--bg` | #0b0b10 | page |
| `--surface-1/2/3` | #14141b / #1b1b25 / #24242f | cards, hover, menus |
| `--line` / `--line-strong` | #2a2a36 / #3a3a4a | borders |
| `--ink` / `--ink-2` / `--ink-3` | #ecebf3 / #a9a7ba / #8b89a0 | text (re-verify AA on glass) |
| `--accent` | #8b7cf0 | primary actions, focus, active nav (hover #9d90f5, pressed #7a6add) |
| `--grad-violet` | #7c6df0 to #a48bf5 (135deg) | primary buttons, progress fills, icon tiles |
| `--grad-indigo` / `--grad-slate` | #5b6bf0 to #8b7cf0 / #4a5568 to #6b7a90 | secondary tiles |
| `--reward` | #f2c46b (gradient to #e58f55) | XP, level-ups, trophies only |
| aurora layer | violet top-left, indigo right, slate bottom, alpha <= .12 | static |
Skill hues (one per star, used in tiles/rings/constellation): Body = rose-violet #c06ad0, Money = teal #2fbf9b, Mind = indigo #6f7bf0, Career = violet #8b7cf0, People = slate-blue #6aa6d6. Semantic good/warn unchanged.
Motion: spring `--ease-spring`, number roll on XP, ring fills with soft overshoot, quest-complete = check draws + ring pulse + XP count (<= 900 ms, skippable), level-up = a one-second constellation brighten, no confetti. Haptics (phone, opt-in): light tick on completion, double tick on level-up. Sound: off by default, tiny synthesized WebAudio ticks if enabled.

## Information architecture: 18 pages become 5 hubs (all old URLs keep working)
Phone bottom bar: **Today | Plan | (+) Capture orb | Skills | You**. Desktop left rail: Today, Plan, a "Skills" group (Body, Money, Mind, Career, People, each with a level pip), and "You" (Trophies, Season, Intel, Settings, Data), plus a right-hand **Mission rail** (today's quests, XP bar, streak) that collapses on narrow screens.
| Hub | Contains (old route kept as an alias) |
|---|---|
| Today `/` | Mission board, agenda strip, focus tasks, day-cleared moment |
| Plan `/plan` | tabs: Tasks `/tasks`, Planner `/planner`, Goals `/goals` (quest log and bosses), Habits `/habits` (routines) |
| Skills `/skills` (phone hub grid + constellation) | Body `/body` (tabs: Weight, Food `/food`, Training), Money `/finance`, Mind `/mind` (tabs: Journal `/journal`, Learning `/learning`), Career `/career`, People `/people` |
| You `/you` | Trophies `/history`, Season `/review`, Intel `/ops` (Command), Settings `/settings`, Data `/data`, Ontology `/ontology` |
The capture bar becomes the **capture orb**: on phone a large centered button opening a bottom sheet (type one line, or one-tap quick logs: weigh-in, meal, mood, win); on desktop the existing top capture bar stays and `/` still focuses it.

## Game systems (all derived, all transparent: every XP number has a "Why?" line)
- **XP** by action (starter values, tunable in one table): task done 10 (+5 high priority, +5 linked to a goal), habit check-in 8, weigh-in 15, calories target met 20, protein target met 25, workout 30, journal entry 20 (+10 at 150+ words), win logged 25, person contacted 12, learning 1 per 3 minutes (cap 60/day), on-budget day 10, import done 15, goal milestone 50, goal done 150, review locked 60. Per-kind daily caps stop farming; no negative XP, ever.
- **Skills and levels:** every XP lands in one of five skills (Body, Money, Mind, Career, People) and in the overall level. Level n needs 100 x n(n+1)/2 cumulative XP (a smooth curve; early levels in days, later in weeks).
- **Daily quests (up to 5):** generated deterministically each day from your active goals and routines (weigh-in if a weight goal exists, protein/calories if targets exist, a lift if a training goal exists on its days, journal, log a win if a career goal exists, contact the most overdue person, one money action when a budget exists, the top focus task). They **complete themselves** when the underlying data appears. Clearing all quests = "Day cleared" (+30). A weekly clear = "Week cleared" (+120).
- **Weekly streak with grace:** the streak is "active days this week out of a target" (default 5), with 2 free rest tokens per week; weeks in a row, never a daily chain that can snap.
- **Seasons and bosses:** a season is the quarter; the season boss is your top quarter goal (for example the next weight checkpoint); boss HP is its goal progress. Season recap replaces the Review page's top: swipeable story cards on phone, grid on desktop (reuses Week in numbers).
- **Trophies:** milestone events become trophies on a shelf (History), with rarity by how many exist; first-time moments (first win logged, first 5 lb up, first full week) get a one-time moment.
- **Intel:** Command proposals, insights and "Daily find" (one factual line: "your protein days are up two on last week") presented as quiet briefings.
- **Calm mode** (Settings): hides levels, quests, XP and moments; keeps hubs, layout and tokens. Also settings for haptics, sound, motion intensity.

## Every tab: what brings you back
| Tab | Rework |
|---|---|
| Today | Mission board with self-completing quests, XP strip, agenda, focus tasks, day-cleared moment, daily find |
| Tasks | swipe-to-complete on phone, 3-slot focus bar, combo chain (visual only), satisfying strike-through |
| Planner | time-blocking: drag tasks into slots, now-line, protected "training" blocks |
| Goals | quest log: bosses on top with HP bars, checkpoints on the path, completion moment, suggested next step |
| Habits | weekly ring per habit, week dots, rest tokens, month heat map |
| Body (+Food) | weight path with checkpoint flags every +5 lb and a ghost line to the target, macro rings (calories, protein) that fill through the day, "hit your numbers" quests |
| Money | budget health bars, no-spend-day quests, savings-rate level, net worth path with milestones, monthly "boss" = stay on budget |
| Mind | writing streak ring, mood constellation (month map), focus-mode runs earn XP, learning "focus runs" with a timer |
| Career | win count into Career XP, promotion-case strength meter (coverage of impact, mentoring, project, feedback) as the boss |
| People | circle view: orbits by closeness, health glow decays gently, contact quests, birthdays |
| Trophies | shelf with rarity, timeline below |
| Season | recap story, week and quarter stats, boss result |
| Intel | briefing cards with accept/dismiss |
| Settings | Game settings (calm mode, haptics, sound, motion), XP table viewer |

## Phone and desktop are equal
Designed together on one grid: the same components (quest card, ring, constellation) render as a vertical thumb-zone stack on phone and as a three-zone cockpit (rail, canvas, mission rail) on desktop. Phone-only: capture orb, swipe actions, bottom sheets, haptics, safe-area insets. Desktop-only: persistent mission rail, hover previews, keyboard shortcuts overlay, drag in Planner.

## Phases (each ends with verify, browser pass, personal-data guard, deploy)
- G1 Foundation: tokens v3, new shell and hub navigation (all routes aliased), motion/haptic kit, shared components (Ring, QuestCard, Constellation, XpToast), the engine behind `usePlayer()`.
- G2 Today and Plan: mission board, tasks, planner, goals, habits.
- G3 Skills A: Body+Food, Money.
- G4 Skills B: Mind, Career, People.
- G5 You: Trophies, Season, Intel, Settings; site refresh for the new look; full QA and tuning pass.

## Contract (so shell and engine are built in parallel): `src/features/game/types.ts` and a stub `usePlayer()`.

## Left to builders
Exact XP tuning, icon art, microcopy, easing details, empty-state wording, which sparkline goes where.

## Calls to review (the owner may reverse any)
1. Palette changes from amber-led to graphite and violet; amber becomes reward-only.
2. Navigation consolidated to 5 hubs; old URLs and deep links keep working.
3. Streaks are weekly with rest tokens; no loss mechanics.
4. No push notifications; sound off; haptics opt-in; Calm mode exists.
5. XP derived from existing data; no schema change.
