# Northstar design brief

**North star:** a calm, Apple-native dark app where your day, your body and your money are organized in one place, and progress is something you see, not something you collect.

Decisions: owner answers plus delegated calls (marked *call*). Veto any of them at the reference-tab checkpoint.

## Principles
1. **Glass is a layer, not a skin.** Navigation, toolbars, sheets and floating controls are glass. Content is mostly solid. Cards sit at half strength.
2. **Money is the heart.** Finance gets its own top-level tab and the largest share of design effort.
3. **One hero per screen.** Everything else supports it or sits behind a tap.
4. **Real numbers over rewards.** Rings, paths and personal bests. Gold marks only things earned.
5. **A coach, not a game.** Plain, direct, never cute. Missing a day gets a neutral line, never guilt.

## References and what we take
- **iOS 26 / visionOS:** material tiers, continuous corners, springy sheets, floating tab bar.
- **Things 3:** calm density, the logbook as a timeline of finished things.
- **Whoop / Apple Fitness:** rings and honest derived scores with their inputs shown.
- **Linear:** precision, tabular numerals, keyboard speed on desktop.

## Look (*call* where unstated)
- Dark only. Graphite base, one violet accent, gold reserved for earned moments (milestones, personal bests, season goals met).
- Ambient backdrop: a slow, low-contrast mesh that gives the glass something to refract; tinted by the day's data (money health, calories). *call*
- Glass: full recipe (tint, blur, saturation, rim gradient, inner highlight, shadow, specular) on chrome, "half" on cards. Chromium gets an SVG refraction edge; everything else falls back cleanly.
- Type: Inter system look, tabular numerals for stats, 6 sizes. Fraunces is retired from titles.
- Motion: three springs (snappy, smooth, gentle), all interruptible, press state on everything tappable, reduced-motion gets crossfades.
- Density: balanced. Phone and desktop equal.

## Game feel, translated
| Today | Becomes |
|---|---|
| XP | Progress rings toward goals you set; a lifetime total sits quietly in You |
| Levels | Seasons (calendar quarters) |
| Skills / constellation | **Areas**: Body, Money, Mind, Career, People, each a ring with its real inputs |
| Daily quests | **Today's plan**: 3 to 5 coach-picked actions that tick themselves off from real logs |
| Day / week cleared | One quiet line ("Plan done") |
| Streak + rest tokens | Consistency grid with grace days, no loss language |
| Boss HP bars | **Season goals** with a coach note ("2 weigh-ins behind pace") |
| Trophies + rarity | **Milestones**: gold mark, dated, browsable like a logbook; rarity and "New" tags cut |
| Combo chip, level-up moments | Cut (flagged). One small moment per win: tick, count-up, glass ripple |
| Calm mode switch | Removed (owner). The default is already calm |
| Recap | Weekly and monthly data story, exportable as an image built on-device |

Engine and data stay as they are. Only presentation changes. Nothing is deleted from the database.

## Money, the large part (*call*)
Own bottom-tab slot. Hero: safe to spend this month, then net worth path. Below: cash flow, budgets as rings, bills calendar and set-asides, subscriptions found from transactions, Roth and VTI holdings, goal progress (emergency fund, contribution limit), monthly money recap. Existing import, SimpleFIN and net worth features all stay.

## Food and body (owner goal)
3,000 kcal a day is the target (enter it in Interview or Food). The Food hero is a calorie ring toward target with protein beside it, and the coach nudges meal timing when behind.

## Navigation (*call*)
Today, Plan, capture, Money, Areas. You lives behind the profile control in the top bar. Old URLs keep working.

## Voice
Sentence case, short, dry, direct. Numbers lead: "2,140 of 3,000 kcal." The coach states the gap and the next step. Missed day: "No entries Tuesday." Nothing more.

## Banned
XP, level up, quest, loot, power-up, epic, legendary, trophy case, "crushing it", exclamation marks, decorative emoji, confetti, guilt notifications, fake slang, a random accent per card, glass on list rows, animated gradients on chrome.

## Open calls to veto
Combo chip and level-up moments cut. Rarity tags cut. Fraunces retired. "Skills" renamed "Areas". Calm switch removed.
