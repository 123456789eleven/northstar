# Northstar design system v3 (app): palette "Graphite and Violet" + Constellation shell

Source of truth for tokens is `src/index.css` `:root`. This file explains them. v2 is **additive**: every v1 token name and value
(`--page --surface --surface-2 --surface-3 --line --line-strong --ink --ink-2 --ink-3 --accent --accent-ink --accent-soft --good --warn --info
--data-1..6 --sp-1..7 --radius --radius-sm --radius-modal --sheet-shadow --row --pad --gap --fs --font --serif --mono --ease --t-fast --t-panel`)
is unchanged, so `site/style.css` can keep mirroring them. Earlier rationale and the component contract: `docs/design-system.md`.

**Direction: "Aurora" (owner-approved 2026-11-02).** Gradients, one soft ambient glow layer and glass surfaces are wanted, as tokens only:
the spec and guardrails are in [`aurora.md`](aurora.md) (binding); how they are applied in the app is in "Aurora in the app" below.
Rules that do not bend: dark only, one violet accent for action/focus/active (v3; gold `--reward` only for XP, levels and trophies), Aurora effects only through `--aurora-* --glass-* --grad-*`,
no emoji / dashed badges / per-card random accents / animated gradients on chrome, Fraunces only for page titles and big numbers,
animate `transform` and `opacity` only, everything honours `prefers-reduced-motion`, `prefers-reduced-transparency` and `forced-colors`.

## Surfaces (elevation = step + 1px hairline)
| Token | Value | Use |
|---|---|---|
| `--bg` (= `--page`) | #0b0b10 | app background, inputs |
| `--surface-1` (= `--surface`) | #14141b | solid fallback for glass cards/panels/bars; sticky table header |
| `--surface-2` | #1b1b25 | hover, selected row, pressed toggle track |
| `--surface-3` | #24242f | menus, toasts, tooltips, pressed state |
| `--line` / `--line-soft` / `--line-strong` | #2a2a36 / #20202a / #3a3a4a | borders; soft for in-card dividers; strong for inputs and overlays |
| `--scrim` | rgba(0,0,0,.6) | modal / sheet backdrop |

Cards, KPI tiles, panels and the sidebar are glass (`--glass-bg` + `--glass-border` + `--glass-edge`), see "Aurora in the app". Shadows exist only on floating
surfaces: `--glass-shadow` (modal / sheet / palette / toast) and `--shadow-pop` (chart tooltip). Cards never get a drop shadow.

## Accent and status
| Token | Use |
|---|---|
| `--accent` #8b7cf0 (v3 violet) | primary action, active nav, focus, "done" |
| `--accent-hover` #9d90f5 / `--accent-pressed` #7a6add | solid accent states (the primary button itself is `--grad-violet` with a sheen layer, see below) |
| `--accent-text` #a99df7 | accent-coloured text on an `--accent-soft` tint (chips, pressed filters, search hits): 5.62:1 where `--accent` is 3.96 |
| `--reward` #f2c46b, `--reward-2` #e58f55, `--grad-reward`, `--reward-soft`, `--reward-line`, `--reward-ink` | **reward only**: XP chips and bars, level rings, trophies, "Day cleared", milestone dots, met streaks |
| `--skill-body/-money/-mind/-career/-people` | #c06ad0 / #2fbf9b / #6f7bf0 / #8b7cf0 / #6aa6d6: constellation stars, quest rings, rail pips (graphics, >= 3:1; not body text) |
| `--accent-soft` / `--accent-line` | selected row, done day tile background / its border |
| `--accent-ring` | `0 0 0 1px var(--accent)`: the focused-input ring (crisp, not a glow) |
| `--good --warn --info` (+ `--good-soft --warn-soft`) | status with a word or icon, never alone |
| `--ink-disabled` #6b6a7e | disabled text; disabled buttons become neutral (no brown 40%-amber) |

## Type (ratio ~1.2 from 14)
| Token | px | Role |
|---|---|---|
| `--text-label` | 11 | mono uppercase labels (+`--track-label` .08em) |
| `--text-xs` | 12 | meta, chart axes, tooltips |
| `--text-sm` | 13 | secondary lines |
| `--text-base` | 14 | body (= `--fs`) |
| `--text-md` | 17 | life-goal titles, emphasized row titles |
| `--text-lg` | 20 | modal / sheet titles (Fraunces), glance values |
| `--text-xl` | 24 | phone page title, habit counts |
| `--text-2xl` | 28 | page title, KPI values (Fraunces, `--track-display` -0.015em) |
| `--text-hero` | 36 | reserved: one hero number per screen at most |
Line heights `--lh-tight 1.15 / --lh-snug 1.3 / --lh-body 1.43`. Every figure uses `font-variant-numeric: tabular-nums` (`.mono`, KPI, tables, `.countup`).

## Space, shape, layers
- 4px grid: `--sp-1..7` = 4 8 12 16 24 32 48. Card padding `--pad` (16, compact 12), grid gap `--gap` (12).
- Radius: `--radius-xs` 4 (skeleton lines, tooltips keys), `--radius-sm` 6 (controls, chips), `--radius` 8 (cards), `--radius-modal` 10, `--radius-pill` 999 (progress only).
- Icons: `--icon-sm 14 / --icon-md 16 / --icon-lg 20`, one 1.5px stroke set in `components/Icons.tsx`.
- z-index: `--z-sticky 15` top bar, `--z-tabbar 20`, `--z-sheet 40`, `--z-modal 50`, `--z-toast 60` (palette shares 60).

## Motion
| Token | Value | Jobs |
|---|---|---|
| `--dur-fast` | 120ms | hover/press colour, button press scale .98, overlay exit, palette fade |
| `--dur-base` | 200ms | modal/route enter, tab indicator slide, toast enter, list row enter, check mark |
| `--dur-slow` | 320ms | sheet enter, progress fill, bar growth, strike-through on task completion, checkbox pop |
| `--ease-out` | cubic-bezier(.2,0,0,1) | everything entering or settling |
| `--ease-in` | cubic-bezier(.4,0,1,1) | exits only |
Reduced motion: the tokens collapse to 0ms and the global rule zeroes animations; JS paths (`motion.ts prefersReducedMotion`) skip the count-up, exit delay and view transition.
Every animation has a named job (above). Nothing loops except the skeleton pulse (opacity 1 to .5, only while data is loading).

## Primitives (contract)
| Primitive | v2 behaviour |
|---|---|
| `PageHeader{title,sub?,actions?,tabs?,icon?}` | module gradient tile (from the route) beside the Fraunces title; `icon={false}` omits it |
| `Card{title,action,sub?,flush?,interactive?}` | glass; title 14/600; action never wraps; `interactive` = 2px spring lift + brighter glass/border |
| `Stat{icon?,trend?,onClick?,href?}`, `KpiStrip{items[{...,trend?,hero?}]}` | each KPI is its own glass tile; values wrapped in `CountUp` (counts from 0 once, 520ms, no reflow); `trend` = arrow + signed delta in `--good/--warn`; Stat `icon` = module IconName -> gradient tile; KPI `hero` = gradient numeral (one per screen) |
| `CountUp{value}` | animates a number or a string with exactly one number ("$1,234.50", "62%"); anything else renders as-is |
| `Progress{value,label,tone?}` | full-width fill moved with `translateX`, slides in on mount and glides on change; `tone` warn / muted |
| `Empty{title?,children,action?,icon?}` | what is here, what to do first, the button that does it; a titled empty state carries the module tile |
| `Modal`, `BottomSheet`, `SidePanel` | enter: fade + 8px rise (modal) / 32px slide (sheet); Esc, backdrop and Close play a 120ms exit, then unmount. Focus trap and restore unchanged |
| `Tabs` | one 2px accent (violet) bar slides under the active tab (transform: translateX + scaleX), re-measured on resize |
| `Field{label,hint?,error?}` | hover border, focus = accent border + 1px ring, `aria-invalid` = warn, disabled = neutral |
| `Toast` | slides up, fades out; Undo is the single accent-coloured action |
| `ListRow`, `DataTable{loading?}` | hover / pressed / focus-visible rows; DataTable shows skeleton rows while loading |
| `Skeleton{lines|rows}`, `PageSkeleton` | neutral blocks shaped like the real layout; used for every main page's first paint |
| `ChartFrame{sub?,empty?}` + `chartTheme.ts` + `ChartTip` | one recharts theme: hairline grid, 12px `--ink-2` axes, dashed line cursor / soft band for bars, one tooltip (`.chart-tip`), legend swatch or line; plot fades in |
| Buttons | hover, pressed (scale .98 + darker), focus-visible ring, disabled neutral; `aria-pressed` toggles get a raised neutral state |
| `.check` | pops and draws its mark only when the user just toggled it (`:checked:focus`), never on page load |
| Route change | rail / tab bar / More links cross-fade via the View Transitions API (160ms); everything else gets a 200ms CSS fade of `.route-view` |

## Charts
Theme constants mirror tokens in `src/components/chartTheme.ts` (SVG attributes can't read CSS variables reliably). Series colours stay as each module chose them (data palette slots; the accent (violet in v3) only where the module already uses it for its single series: Body, Investments). Every chart: `role="img"` + summary `aria-label`, table view where a `table` prop is given.

## Phase 3 additions (2026-11-01)
- **Density** (`components/density.ts`): `comfortable` (default) | `compact`, device-local setting `ui.density` (in `isLocalOnlySetting`, never syncs), mirrored to localStorage for first paint, applied as `data-density` on `<html>`. Compact swaps `--row 30 --pad 12 --gap 8 --fs 13 --ctl-h 32 --main-pt 16 --head-gap 16 --list-py 4 --kpi-py 8 --title-gap 8 --tab-h 32` at >=820px only; phones always stay comfortable. New spacing should read these variables, not fixed px. Toggle: Settings > Preferences (radio group) or palette "Switch density".
- **Keys**: `.kbd` is the one key-chip style (palette footer, shortcuts overlay, `.key-hint` buttons). `?` opens the shortcuts overlay (`components/Shortcuts.tsx`, list in `shortcutsData.ts`); it never fires while typing or while another dialog is open. Add a row there whenever you add a shortcut.
- **Completion moment**: `DoneMark` (accent check that pops and draws, 320ms) + the bar settling at 100% for ~0.5s, then the save and a toast with Undo and the next step (`features/goals/completion.ts`). Toast may carry one neutral `action` beside Undo. Habit streak milestones (7/30/100 days, 4/12/26 weeks) toast via `useHabitCheckIn`; Undo removes the check-in and its timeline event. No confetti, no emoji, reduced motion skips the delay.
- **Focus**: overlays capture the opener during their first render (`useFocusTrap`), so a child `autoFocus` no longer loses it; restore happens only when focus would otherwise fall to `<body>` or stay in the closed overlay.
- **Print**: `@media print` turns the tokens light, hides the shell, buttons and tabs. Review prints the digest, your answers (`.print-only` text instead of textareas) and ratings; the Journal reading view prints just the entry (`.jr-reading-card`). Both pages have a Print button.

## Aurora in the app (2026-11-02)
Spec and token values: [`aurora.md`](aurora.md). Implementation: the "Aurora layer" block at the end of `src/index.css`, `components/ModuleTile.tsx`, `components/moduleHue.ts`.

**Where each effect goes**
| Effect | Applied to | Never on |
|---|---|---|
| Ambient (`body::before`, 3 glows) | page background, fixed, static (opt-in drift: `data-aurora-drift` on `<html>`) | anything animated by default |
| Glass `--glass-bg` + blur (`::before`) | top-level `.card`, each KPI tile, inline `.side-panel` | rows, tables, list items, chart plots, nested cards (flattened to transparent) |
| Glass tint, no blur | sidebar (only the static ambient is behind it, so blur would be a no-op) | |
| `--glass-bg-bar` + blur | sticky top bar, phone tab bar, toast (float over live content, no scrim) | |
| `--glass-bg-strong` | modal, sheet, command palette, shortcuts overlay (their scrim carries the one blur) | |
| `--grad-violet` (v3; was `--grad-amber`) | `.btn-primary` (sheen hover/pressed, neutral disabled), progress fill (sized to the visible part), brand tile, `.grad-text` hero numeral (Money Net, Body Current) | body text, rows, semantic status |
| `--grad-reward` | XP bar fill, level rings (`tone="reward"`) | anything that is not earned XP / a level / a trophy |
| Module tiles (`ModuleTile`) | page header, titled empty states, Stat icon, Command object-type facets (24px) | nav icons (stay plain line icons) |

**Module hues** (v3: one hue per life skill; the same module is the same hue everywhere; `moduleHue.ts` is the source):
| Hue | Modules |
|---|---|
| violet `--grad-violet` (dark glyph) | Today, Plan (Tasks, Planner, Goals, Habits), Skills overview, Career |
| rose-violet `--grad-rose` | Body, Food |
| teal `--grad-teal` | Money |
| indigo `--grad-indigo` | Mind, Journal, Learning |
| sky `--grad-sky` | People |
| slate `--grad-slate` | You, Season, Intel, Settings, Data, Ontology |
| gold `--grad-reward` (dark glyph) | Trophies only (reward) |
Object types on the Command page map to their owning module (Transaction/Budget -> Finance, Meal -> Food, Interaction -> People, LifeEvent -> History, CalendarEvent -> Planner).

**Contrast, worst case, v2 amber palette (superseded by "Palette v3" below)** (computed from the token values: brightest point of the three glows composited on `--bg`, then the surface; script sampled every 4px at 375x800, 1440x900, 1920x1080):
| Surface (worst composite) | ink | ink-2 | ink-3 | accent | good | warn |
|---|---|---|---|---|---|---|
| glass card, content area (#2c2923) | 12.07 | 5.82 | 5.03 | 7.47 | 6.92 | 4.92 |
| glass card, absolute brightest spot (#312d25, under the sidebar/top bar) | 11.39 | 5.49 | 4.75 | 7.05 | 6.53 | 4.65 |
| glass hover .065, worst content spot (1920 wide, #322e28) | 11.19 | 5.40 | 4.66 | 6.93 | 6.41 | 4.56 || bar `--glass-bg-bar` over UNBLURRED amber (#2d2822) | 12.12 | 5.84 | 5.05 | 7.50 | 6.94 | 4.94 |
| strong overlay over scrim + amber (#2c2924) | 12.06 | 5.82 | 5.03 | 7.47 | 6.91 | 4.92 |
Primary button `--accent-ink` on the gradient: 11.23 / 7.31. Hero numeral gradient on worst glass: 8.41 / 5.48. All body text >= 4.5:1, so `--ink-3` stays as is.

**Performance** (headless Chrome, vsync off, rAF frame time while auto-scrolling 4s, median of 2-3 runs after a warm-up; Finance > Transactions with All months = 6,800px desktop / 21,662px phone):
| Page | Blur | Solid fallback | Cost |
|---|---|---|---|
| Finance Transactions, 1440 | 4.38 ms avg / 5.9 p95 | 3.90 / 5.5 | +0.5 ms |
| Today, 1440 (11 blurred in view) | 2.16 / 4.2 | 1.57 / 2.8 | +0.6 ms |
| Finance Transactions, 375 + 4x CPU | 4.25 / 15.4 | 3.90 / 14.7 | +0.35 ms |
| Today, 375 + 4x CPU | 5.64 / 12.0 | 4.99 / 11.9 | +0.65 ms |
All under the 4 ms budget, so blur stays on every allowed element. Max blurred elements in view: 11 (Today 1440). Bundle CSS 43.7 -> 52.5 kB (gzip 9.5 -> 11.0 kB, includes the Stat/trend CSS); JS unchanged.

## Palette v3 "Graphite and Violet" + Constellation shell (G1, 2026-11-02)
Source: `docs/design/game-direction.md` (binding). Every v2 token name is kept; values changed (see the tables above and `aurora.md`).
New tokens: `--glow-violet/-indigo/-slate` (ambient), `--grad-indigo/-slate/-sky`, `--grad-reward` + `--reward/-2/-ink/-soft/-line`,
`--skill-body/-money/-mind/-career/-people`, `--accent-text`, `--ease-spring-soft` (a damped spring as `linear()` where supported, cubic fallback), `--dur-spring` 560ms, `--dur-moment` 900ms.

**Amber audit.** Anything that was amber because it was the accent is now violet (buttons, focus, active nav, progress, checks, selected rows, the planner now-line, priority flags, near-budget text). Amber now appears only for rewards: XP chips and bars, level rings, the Trophies tile, milestone dots (Trophies, Season), met habit streaks, "Day cleared". Chart series that used the accent (Body 7-day average, Investments) follow it to violet; journal heat squares too.

**Contrast, worst case v3** (same method as v2: brightest composite of the three glows sampled every 4px at 375x800, 1440x900, 1920x1080 = rgb(23,21,39), then the surface):
| Surface | ink | ink-2 | ink-3 | accent | reward | good | warn |
|---|---|---|---|---|---|---|---|
| glass .04 (#201e30) | 13.72 | 6.90 | 4.78 | 4.82 | 9.96 | 7.73 | 5.50 |
| glass hover .06 (#252334) | 12.97 | 6.52 | 4.52 | 4.56 | 9.42 | 7.31 | 5.20 |
| bar .88 over the glow (#111118) | 15.92 | 8.01 | 5.55 | 5.60 | 11.56 | 8.97 | 6.39 |
| strong overlay over scrim (#13131b) | 15.64 | 7.87 | 5.45 | 5.50 | 11.36 | 8.82 | 6.28 |
| surface-3 (hub tab active, menus) | 12.97 | 6.52 | 4.52 | 4.56 | 9.42 | 7.31 | 5.20 |
Text on tints: `--accent` on `--accent-soft` is 3.96 (fails), so tinted chips/filters use `--accent-text` (5.62); `--reward` on `--reward-soft` 7.62; `--ink` on `--accent-soft` 11.27.
Fills: `--accent-ink` on the violet gradient 4.88 / 6.99 (white would be 3.96); `--reward-ink` on gold 11.23 / 7.31. Skill hues vs glass (graphics, >= 3:1): 4.80 / 6.99 / 4.46 / 4.82 / 6.21; they are never used for body text (Mind indigo is 4.46).

**Information architecture.** `nav.ts` holds NAV (every page, with hub, skill and old name `aka`), HUBS (tab strips) and SUBTABS (Body: Weight | Food; Mind: Overview | Journal | Learning). `HubLayout` is a pathless layout route around absolute child routes, so every old URL, deep link and `?focus=` param works unchanged; `/plan /skills /mind /you` are real landing pages (`pages/*Hub.tsx`, `features/hubs/`). The palette lists the new names with the old name in the secondary line and in search ("Finance" finds Money).

**Shell.** Desktop >= 1024: 216px rail (Today, Plan, Skills group with a level-pip ring per skill, You group). >= 1280 and not Calm: a 288px mission rail (level + XP, today's quests except on Today, weekly streak, recent XP with a "Why?" link). Phone <= 819: top bar with the player strip (level ring, XP, active days); bottom bar Today | Plan | capture orb | Skills | You (56px items, 52px orb, safe-area insets); re-tapping a hub opens its overview, coming back returns to the last page you had open there. The orb opens the capture sheet: the same QuickCapture line plus one-tap quick logs (Weigh-in `w `, Meal `ate `, Win `win: `, Journal `journal: `) that prefill the existing syntax, so they use the same parser and save path. Rail, top bar, tab bar and mission rail have `view-transition-name`s so only the page cross-fades.

**Game components** (`features/game/ui/`, all read one `PlayerProvider` -> `usePlayerState()`):
| Component | Behaviour |
|---|---|
| `Ring{value,size,stroke,tone}` | SVG ring; fill springs in on mount/change (`--ease-spring-soft`, 560ms). Only `stroke-dashoffset` of a <= 64px circle animates (paint-only, no layout) |
| `LevelBadge` | level number inside its XP ring; 22px pips in the rail, 28px in the phone strip |
| `XpBar` | gold fill (transform), number roll on the XP figure |
| `WeekDots` | Mon..Sun, filled = active day, ring = today, text alternative on the list |
| `QuestCard` | skill-hue ring or check, gold XP chip; when a quest flips to done while visible: check draws, ring pulses, XP rolls up (<= 900ms, tap to skip, reduced motion = instant, never on load), light haptic tick |
| `Constellation` | five stars in a W; size/brightness = level, edge opacity = the weaker level; hover/tap/keyboard keys show level and XP to next; table view; SVG is `aria-hidden` with an sr-only summary |
| `MomentHost` | level-up / skill-up / Day cleared: a 1s card with the constellation brightening once, no confetti, Esc/tap skips, only on a real change after the first loaded state, never in Calm mode; double haptic tick |
| `MissionBoard`, `MissionRail`, `PlayerStrip` | Today board, desktop rail, phone strip; all render nothing in Calm mode |
Feedback: `lib/haptics.ts` (`navigator.vibrate`, only when `game.haptics` is on, default off) and `lib/sound.ts` (synthesized 60ms WebAudio blip, default off, no assets). No permission prompts anywhere. Settings > Game: Calm mode, haptics, sound, motion (Full / Reduced: sets `data-motion="reduced"` on `<html>`, which `prefersReducedMotion()` and the game CSS honour app-wide), active days a week, and the XP table from `engine/xpTable.ts`.

**Performance (G1).** Today with demo data, rAF frame time while auto-scrolling 4s, 4x CPU throttle, median of 3 (headless Chrome, vsync off): 390px blur 7.37 ms avg / 22.0 p95 (15 blurred elements) vs no blur 10.34 / 33.7; 1440px blur 8.72 / 27.1 (14 blurred) vs no blur 10.44 / 32.2. The difference is inside run-to-run noise: blur has no measurable cost here. Bundle: entry CSS 53.0 -> 70.4 kB (gzip 11.2 -> 14.3), all CSS 129 -> 150 kB; entry JS 47.5 -> 85.4 kB (gzip 15.1 -> 27.4: the engine, shell and game UI are eager), all JS 1,646 -> 1,702 kB.
