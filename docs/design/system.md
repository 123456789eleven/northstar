# Northstar design system v2 (app)

Source of truth for tokens is `src/index.css` `:root`. This file explains them. v2 is **additive**: every v1 token name and value
(`--page --surface --surface-2 --surface-3 --line --line-strong --ink --ink-2 --ink-3 --accent --accent-ink --accent-soft --good --warn --info
--data-1..6 --sp-1..7 --radius --radius-sm --radius-modal --sheet-shadow --row --pad --gap --fs --font --serif --mono --ease --t-fast --t-panel`)
is unchanged, so `site/style.css` can keep mirroring them. Earlier rationale and the component contract: `docs/design-system.md`.

**Direction: "Aurora" (owner-approved 2026-11-02).** Gradients, one soft ambient glow layer and glass surfaces are wanted, as tokens only:
the spec and guardrails are in [`aurora.md`](aurora.md) (binding); how they are applied in the app is in "Aurora in the app" below.
Rules that do not bend: dark only, one amber accent for action/focus/active, Aurora effects only through `--aurora-* --glass-* --grad-*`,
no emoji / dashed badges / per-card random accents / animated gradients on chrome, Fraunces only for page titles and big numbers,
animate `transform` and `opacity` only, everything honours `prefers-reduced-motion`, `prefers-reduced-transparency` and `forced-colors`.

## Surfaces (elevation = step + 1px hairline)
| Token | Value | Use |
|---|---|---|
| `--bg` (= `--page`) | #0c0d10 | app background, inputs |
| `--surface-1` (= `--surface`) | #15171c | solid fallback for glass cards/panels/bars; sticky table header |
| `--surface-2` | #1c1f26 | hover, selected row, pressed toggle track |
| `--surface-3` | #242831 | menus, toasts, tooltips, pressed state |
| `--line` / `--line-soft` / `--line-strong` | #262a33 / #1f232b / #343a46 | borders; soft for in-card dividers; strong for inputs and overlays |
| `--scrim` | rgba(0,0,0,.6) | modal / sheet backdrop |

Cards, KPI tiles, panels and the sidebar are glass (`--glass-bg` + `--glass-border` + `--glass-edge`), see "Aurora in the app". Shadows exist only on floating
surfaces: `--glass-shadow` (modal / sheet / palette / toast) and `--shadow-pop` (chart tooltip). Cards never get a drop shadow.

## Accent and status
| Token | Use |
|---|---|
| `--accent` #e3b261 | primary action, active nav, focus, "done" |
| `--accent-hover` #ebc17a / `--accent-pressed` #d6a24f | solid accent states (the primary button itself is `--grad-amber` with a sheen layer, see below) |
| `--accent-soft` / `--accent-line` | selected row, done day tile background / its border |
| `--accent-ring` | `0 0 0 1px var(--accent)`: the focused-input ring (crisp, not a glow) |
| `--good --warn --info` (+ `--good-soft --warn-soft`) | status with a word or icon, never alone |
| `--ink-disabled` #6b6a66 | disabled text; disabled buttons become neutral (no brown 40%-amber) |

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
| `Tabs` | one 2px amber bar slides under the active tab (transform: translateX + scaleX), re-measured on resize |
| `Field{label,hint?,error?}` | hover border, focus = accent border + 1px ring, `aria-invalid` = warn, disabled = neutral |
| `Toast` | slides up, fades out; Undo is the single accent-coloured action |
| `ListRow`, `DataTable{loading?}` | hover / pressed / focus-visible rows; DataTable shows skeleton rows while loading |
| `Skeleton{lines|rows}`, `PageSkeleton` | neutral blocks shaped like the real layout; used for every main page's first paint |
| `ChartFrame{sub?,empty?}` + `chartTheme.ts` + `ChartTip` | one recharts theme: hairline grid, 12px `--ink-2` axes, dashed line cursor / soft band for bars, one tooltip (`.chart-tip`), legend swatch or line; plot fades in |
| Buttons | hover, pressed (scale .98 + darker), focus-visible ring, disabled neutral; `aria-pressed` toggles get a raised neutral state |
| `.check` | pops and draws its mark only when the user just toggled it (`:checked:focus`), never on page load |
| Route change | rail / tab bar / More links cross-fade via the View Transitions API (160ms); everything else gets a 200ms CSS fade of `.route-view` |

## Charts
Theme constants mirror tokens in `src/components/chartTheme.ts` (SVG attributes can't read CSS variables reliably). Series colours stay as each module chose them (data palette slots; amber only where the module already uses it for its single series: Body, Investments). Every chart: `role="img"` + summary `aria-label`, table view where a `table` prop is given.

## Phase 3 additions (2026-11-01)
- **Density** (`components/density.ts`): `comfortable` (default) | `compact`, device-local setting `ui.density` (in `isLocalOnlySetting`, never syncs), mirrored to localStorage for first paint, applied as `data-density` on `<html>`. Compact swaps `--row 30 --pad 12 --gap 8 --fs 13 --ctl-h 32 --main-pt 16 --head-gap 16 --list-py 4 --kpi-py 8 --title-gap 8 --tab-h 32` at >=820px only; phones always stay comfortable. New spacing should read these variables, not fixed px. Toggle: Settings > Preferences (radio group) or palette "Switch density".
- **Keys**: `.kbd` is the one key-chip style (palette footer, shortcuts overlay, `.key-hint` buttons). `?` opens the shortcuts overlay (`components/Shortcuts.tsx`, list in `shortcutsData.ts`); it never fires while typing or while another dialog is open. Add a row there whenever you add a shortcut.
- **Completion moment**: `DoneMark` (amber check that pops and draws, 320ms) + the bar settling at 100% for ~0.5s, then the save and a toast with Undo and the next step (`features/goals/completion.ts`). Toast may carry one neutral `action` beside Undo. Habit streak milestones (7/30/100 days, 4/12/26 weeks) toast via `useHabitCheckIn`; Undo removes the check-in and its timeline event. No confetti, no emoji, reduced motion skips the delay.
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
| `--grad-amber` | `.btn-primary` (sheen hover/pressed, neutral disabled), progress fill (sized to the visible part), brand tile, `.grad-text` hero numeral (Finance Net, Body Current) | body text, rows, semantic status |
| Module tiles (`ModuleTile`) | page header, titled empty states, Stat icon, Command object-type facets (24px) | nav icons (stay plain line icons) |

**Module hues** (max 4; the same module is the same hue everywhere; `moduleHue.ts` is the source):
| Hue | Modules | Why |
|---|---|---|
| amber `--grad-amber` (dark glyph) | Command, Today, Planner, Tasks, Ontology, Data, Settings | Operate + System: the product's own work surfaces, brand colour |
| violet `--grad-violet` | Goals, Habits, Learning, Journal, History, Review | Plan + Reflect: growth and reflection |
| teal `--grad-teal` | Finance | money |
| rose `--grad-rose` | Food, Body, People | body and relationships |
Object types on the Command page map to their owning module (Transaction/Budget -> Finance, Meal -> Food, Interaction -> People, LifeEvent -> History, CalendarEvent -> Planner).

**Contrast, worst case** (computed from the token values: brightest point of the three glows composited on `--bg`, then the surface; script sampled every 4px at 375x800, 1440x900, 1920x1080):
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
