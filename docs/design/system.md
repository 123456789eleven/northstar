# Northstar design system v2 (app)

Source of truth for tokens is `src/index.css` `:root`. This file explains them. v2 is **additive**: every v1 token name and value
(`--page --surface --surface-2 --surface-3 --line --line-strong --ink --ink-2 --ink-3 --accent --accent-ink --accent-soft --good --warn --info
--data-1..6 --sp-1..7 --radius --radius-sm --radius-modal --sheet-shadow --row --pad --gap --fs --font --serif --mono --ease --t-fast --t-panel`)
is unchanged, so `site/style.css` can keep mirroring them. Earlier rationale and the component contract: `docs/design-system.md`.

Rules that do not bend: dark only, one amber accent, no gradients / glow / glass / emoji / dashed badges / per-card accents,
Fraunces only for page titles and big numbers, animate `transform` and `opacity` only, everything honours `prefers-reduced-motion`.

## Surfaces (elevation = step + 1px hairline)
| Token | Value | Use |
|---|---|---|
| `--bg` (= `--page`) | #0c0d10 | app background, inputs |
| `--surface-1` (= `--surface`) | #15171c | cards, panels |
| `--surface-2` | #1c1f26 | hover, selected row, pressed toggle track |
| `--surface-3` | #242831 | menus, toasts, tooltips, pressed state |
| `--line` / `--line-soft` / `--line-strong` | #262a33 / #1f232b / #343a46 | borders; soft for in-card dividers; strong for inputs and overlays |
| `--scrim` | rgba(0,0,0,.6) | modal / sheet backdrop |

Shadows exist only on overlays: `--shadow-pop` (tooltips, menus) and `--shadow-overlay` (= `--sheet-shadow`, modal / sheet / toast). Cards never get a shadow.

## Accent and status
| Token | Use |
|---|---|
| `--accent` #e3b261 | primary action, active nav, focus, "done" |
| `--accent-hover` #ebc17a / `--accent-pressed` #d6a24f | primary button states (no `filter`) |
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
| `Card{title,action,sub?,flush?,interactive?}` | title 14/600; action never wraps; `interactive` adds a hover border |
| `Stat`, `KpiStrip` | values wrapped in `CountUp`: counts from 0 once on first paint (520ms), final text reserves the box so nothing reflows |
| `CountUp{value}` | animates a number or a string with exactly one number ("$1,234.50", "62%"); anything else renders as-is |
| `Progress{value,label,tone?}` | full-width fill moved with `translateX`, slides in on mount and glides on change; `tone` warn / muted |
| `Empty{title?,children,action?}` | what is here, what to do first, the button that does it |
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
