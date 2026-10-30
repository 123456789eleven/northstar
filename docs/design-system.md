# Northstar design system and redesign plan

Target: an operational "command center" feel (dense, calm, scannable) reached by cutting and aligning, not by adding effects.
Reference screenshots are inspiration for structure only (dense list + detail panel, KPI strip, review panel). No borrowed branding.

Evidence base: production build (`npm run build:pages`) served on a spare port, seeded demo data, Edge headless, 16 app routes + 4 site pages at 1280 and 375. Horizontal scroll check passed on all 40 captures; no console errors or warnings. Screenshots: `scratchpad/ds/shots/<page>-<1280|375>.png`. Caveats: raw IndexedDB seeding does not trigger Dexie live queries, so several 1280 shots (Today, Tasks) show empty states while 375 shows data; site full-page shots show blank sections because `.reveal` fades in on scroll (not a bug). I examined Today, Command, Tasks, Planner, Goals, Finance, Ontology, Settings and site home closely; the rest were checked for overflow/errors and critiqued from their CSS and structure.

---

## 1. Principles

1. **Cut before polish.** If a screen feels busy, remove an element. Never add a gradient, glow, glass, emoji icon, dashed badge border, or per-card hue to fix it.
2. **One accent, one job.** Amber (`#e3b261`) means "your attention / current / primary action". At most one primary (filled amber) button per view. Everything else is neutral.
3. **Color encodes data or state only.** Chrome is neutral ink on three surface steps. Status colors (good/warn/info) appear with a label or icon, never alone.
4. **Density with rhythm.** Default rows are 36px (comfortable 44px on phone). All spacing is a multiple of 4. Max three type sizes per card.
5. **Numbers are the hero.** Fraunces only for page titles and big numerals (KPI values). Mono only for labels, ids, counts. Inter for every sentence.
6. **Same skeleton everywhere.** Every page = page header, optional KPI strip, one main region (list/table/grid), optional right review panel. People learn it once.
7. **Two taps or one line.** Capture and the common action stay reachable from every page (top bar capture, `/` shortcut). Empty states say the exact first action.
8. **Phone is a first-class layout, not a shrunk desktop.** Bottom tab bar with 5 items + More; KPI strip becomes 2x2; tables become list rows.

## 2. Tokens

Existing tokens kept; additions marked NEW. Define all in `src/index.css` `:root` only (move `--mono` out of `ops.css`).

### Color
| Token | Value | Use |
|---|---|---|
| `--page` | #0c0d10 | app background |
| `--surface` | #15171c | cards, panels (elevation 1) |
| `--surface-2` | #1c1f26 | hover, inputs-in-card, selected row (elevation 2) |
| `--surface-3` NEW | #242831 | menus, popovers, toasts (elevation 3, plus 1px line) |
| `--line` | #262a33 | all borders |
| `--line-strong` NEW | #343a46 | input borders, focus-adjacent separators |
| `--ink` | #eceae4 | primary text (14.9:1) |
| `--ink-2` | #a6a49d | secondary text (7.4:1) |
| `--ink-3` | #8a8882 CHANGE (was #6f6d68, 3.4:1 fails AA) | muted text, placeholders (5.1:1) |
| `--accent` | #e3b261 | primary action, active nav, focus |
| `--accent-ink` | #1a1408 | text on accent |
| `--accent-soft` | rgba(227,178,97,.12) | selected row, active chip |
| `--good` | #6cc49a | positive (with label) |
| `--warn` | #e07a5f | negative / over budget / overdue (with label) |
| `--info` NEW | #7fa6d9 | neutral informational |

Elevation = surface step + 1px border. No shadows except modal/sheet (`0 8px 24px rgba(0,0,0,.5)`).

**Data palette** (charts only; validated with the dataviz validator, dark mode, surface #15171c): 1 `#3987e5` blue, 2 `#d95926` orange, 3 `#199e70` aqua, 4 `#c98500` yellow, 5 `#d55181` magenta, 6 `#9085e9` violet. Fixed order, never cycled; color follows the entity, not its rank. Worst adjacent CVD delta E 8.4, normal-vision 19.3. Scatter/small multiples: first 3 only; fold the rest into "Other". Amber is **not** a series color (its lightness is outside the dark data band; keeps chrome and data distinct). Single-series bars use `--ink-2` or slot 1, not orange (orange reads as alarm next to `--warn`). Sequential = one hue light to dark; diverging = blue/orange around neutral gray. Every chart: legend if 2+ series, table view, tooltip, 2px surface gap between stacked fills.

### Type
| Role | Font | Size / weight / line-height |
|---|---|---|
| Page title | Fraunces | 28 / 500 / 34 (phone 24 / 30) |
| KPI numeral | Fraunces | 28 / 500 / 32, tabular-nums (stat strip); 36 hero only on Today |
| Section title | Inter | 14 / 600 / 20 (sentence case, NOT uppercase) |
| Body | Inter | 14 / 400 / 20 (base font-size becomes 14) |
| Small | Inter | 13 / 400 / 18 |
| Label | JetBrains-style system mono | 11 / 500 / 16, uppercase, +0.08em, `--ink-2` |
| Mono value | mono | 12 / 400 / 16, tabular-nums |

Rule: all-caps only for 11px mono labels. Never all-caps mono for sentences (Command auto-apply descriptions today).

### Space, radius, border
- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Card padding 16 (12 compact). Grid gap 12 (was 16). Page padding 32/40 desktop, 16 phone.
- Radius: 6 controls and chips, 8 cards and panels (was 10), 999 only for progress/avatars. Modal 10.
- Borders: 1px `--line` everywhere; selected = 2px inset left accent bar + `--accent-soft`.

### Focus, motion
- Focus ring (NEW, global, currently missing): `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`; inputs also `border-color: var(--accent)`.
- Motion: 120ms hover/press, 180ms panels and sheets, `cubic-bezier(.2,.0,.0,1)`. Opacity/transform only. `@media (prefers-reduced-motion: reduce)` sets all durations to 0. No decorative animation.
- Hit area: 36px desktop controls, 44px on phone for tab bar and row actions (min 32 per CLAUDE.md).

## 3. App shell

**Desktop (>= 1024)**
- Left rail 232px, sticky, grouped: *Operate* (Command, Today, Planner, Tasks), *Plan* (Goals, Habits), *Life* (Finance, Food, Learning, People), *Reflect* (Journal, History, Review), *System* (Ontology, Data, Settings). 16 links stay, but grouped with section labels (mono 11px). Replace the grey dot with a 16px stroke icon (single-weight inline SVG, 1.5px stroke, `currentColor`); active = `--surface-2` + 2px accent left bar. Optional collapse to 56px icon rail (persist in settings, device-local).
- Top bar 48px, sticky, full width of main: left = breadcrumb/page title context; center = global search + capture (single input, `/` focuses; prefix `>` capture, default search); right = sync status chip (Off / Synced 2m ago / Error, links to Settings), date, quick-add (+) menu. Today's capture bar becomes this; remove the per-page capture row.
- Content max-width 1280 (was 1180); command/table pages may go full-bleed with a 24px gutter.

**Phone (< 820)**
- Bottom tab bar, 5 items: Today, Tasks, Capture (center, accent), Planner, More. 56px high + safe-area; labels 11px.
- More = bottom sheet with the other 11 destinations in a 2-column grid of the same groups.
- Top: 44px compact bar with page title and sync dot; capture opens as a sheet from the center tab. Replaces the 16-item horizontal scroller (items clipped at "Fi", "Peo", "Net w" in current shots).

**Density modes** (setting, device-local, default Comfortable): Compact = row 32, card pad 12, base 13; Comfortable = row 36, pad 16, base 14; Phone auto = row 44. Implemented by a `data-density` attribute swapping 4 CSS variables (`--row`, `--pad`, `--gap`, `--fs`).

## 4. Components (specs)

All live in `src/components/ui.tsx` (primitives) + `index.css`. API names are the contract so work packages can code against them in parallel.

| Component | Spec |
|---|---|
| **PageHeader** `{title, sub, actions, tabs?}` | Title Fraunces 28; sub 13 `--ink-2` one line; actions right, at most 1 primary. Tabs sit under with 1px line, 36px high, active = ink + 2px accent underline. Phone: actions collapse to one primary + overflow menu. |
| **Card** `{title, action, flush?}` | surface, 1px line, r8, pad 16. Title = Inter 14/600 sentence case + right action link (13 `--ink-2`). No uppercase titles. `flush` removes pad for tables/lists. |
| **KpiStrip / Kpi** `{items:[{label,value,delta?,note?,to?}]}` | One bordered bar divided by 1px lines (as on Command today), 2-5 cells. Label mono 11, value Fraunces 28, delta 12 with good/warn + sign + word ("+4 vs last month"). Click-through optional. Phone: 2x2 grid. Replaces 4 separate stat cards (Finance) and the 4 glance tiles (Today). |
| **DataTable** `{columns, rows, selectable, onRow, sticky, density}` | 36px rows, header 32px mono 11 uppercase `--ink-2`, sticky header, 1px row lines, hover `--surface-2`, selected = accent-soft + left bar, checkbox column, right-aligned tabular numerals, keyboard up/down + Enter. Phone: renders as ListRow stack (title, 2 meta chips, value right). Never horizontal scroll on phone. |
| **ListRow** | 44 phone / 36 desktop; leading check or glyph, title (ink) + meta line (13 ink-2), trailing value/chips. Actions appear on hover/focus on desktop, in a row menu on phone. At most 1 visible trailing action. |
| **Form controls** | Input/select 36 high, bg `--page`, border `--line-strong`, r6, label above 12 `--ink-2`, helper below 12 `--ink-3`, error text `--warn` with icon. Checkbox 18; toggle 32x18 for settings. Every input has a visible label or `aria-label`. |
| **Button** | Primary (accent fill), Secondary (surface-2 + line), Ghost, Danger (outline `--warn`). 36 high, r6. One primary per view. Disabled = 40% ink, no fill change to brown. |
| **Chip / StatusChip** | 22 high, r6 (not pill), 12px. Neutral (surface-2), Accent (soft), and Status: dot + word in `--good/--warn/--info`. No dashed borders, no filled rainbow. |
| **Tabs** | As PageHeader tabs; segmented control variant (surface-2 track, selected = surface) for view toggles (Week/Day). |
| **Modal / SidePanel** | Modal: centered 520, title Fraunces 20, footer buttons right. SidePanel (NEW): 360-420 right panel on desktop (inline in layout for Command/Tasks/People detail), bottom sheet 85% height on phone with grab handle. Esc closes, focus trapped, returns focus. |
| **EmptyState** | Icon-less. 1 line what's here, 1 line what to do, optional single button. Left-aligned inside the card, not centered. Pages with 3+ empty cards (Today) collapse into one "Get started" card with a 3-step checklist. |
| **Toast / Undo** (NEW) | Bottom-left (desktop) / above tab bar (phone), surface-3, 1px line, 4s default, 8s with Undo action; one at a time; `role="status"`. All destructive actions use Undo, not confirm dialogs. |
| **ChartFrame** (NEW) | Card with title, optional range control row, legend row, plot, "table view" toggle; plot area uses data palette; grid lines `--line`, axis text 11 `--ink-3`+ (use `--ink-2`), tooltip surface-3. Min height 200, never empty axes: show "No data for this range" in-frame. |

## 5. The Command pattern (reusable)

```
PageHeader
KpiStrip (3-5 cells)
+-----------------+--------------------------------+---------------------+
| Facets (filters)| Queue (DataTable, selectable)  | Review panel        |
| 200px, counts   | sticky header, 36px rows       | 360px, sticky       |
| toggles         | row = status chip, title, meta | summary, key facts, |
|                 |                                | Accept / Modify /   |
|                 |                                | Explain, "why" text |
+-----------------+--------------------------------+---------------------+
Secondary region (graph / history) below, collapsed by default
```
Rules: selecting a row fills the review panel and never navigates; first row auto-selected; `j/k` move, `a` accept, `e` explain. Facets are text toggles with counts, no colored squares. Empty queue says what generates items. Phone: facets become a chip row, panel becomes a sheet.
Reuse: Tasks (queue = open tasks, panel = task detail/edit), Finance Transactions (uncategorized queue, panel = categorize), People (cadence-overdue queue, panel = log contact), Learning (active items), Data (import batches), Review (week items).

## 6. Per-page critique (problems seen)

| Page | Problems (file hints) |
|---|---|
| **Shell** | Dots as nav icons, no icons; 16 ungrouped-feeling links; phone tab bar is a 16-item horizontal scroller with clipped labels (`.tabbar` in `index.css`, `App.tsx` NAV); capture bar duplicated at top of every page; no sync/date/search in a top bar; page-title area leaves 60px of dead space. Base font 15 with 16px grid gap is looser than command-center density. |
| **Today** | Phone view: Focus and "Due today & overdue" list the same tasks twice (`pages/Today.tsx`); 6 cards of equal weight; uppercase card titles; glance tiles mix serif numerals with unit suffixes ("1h 45m") at two sizes; "NUDGE" labels in amber compete with real accent; empty state = 6 near-identical empty cards. Needs a KPI strip + one queue + side column. |
| **Command** | Best base but: Objects legend uses 14 amber squares that encode nothing (`ops.css .ops-check`) and eats the left column; proposals/review panels are short leaving ~500px of dead space; Network view is a full-width empty band; Auto-apply descriptions are ALL-CAPS mono sentences (`.ops-label` used for prose); all KPIs read 0 with seeded overdue tasks (verify rule evaluation after seed vs stale live query). |
| **Planner** | Week columns ~95px so event titles wrap to 3 lines; no time axis; "2 of 2 daily habits open" repeats under every day (noise); two amber-outlined/filled controls compete (New event + Week toggle) (`planner.css`, `PlannerParts.tsx`). |
| **Tasks** | Page is one card with an input; sparse at desktop; no queue/detail split, no grouping by due, no bulk select (`pages/Tasks.tsx`, `TaskRow.tsx`). Ideal first adopter of the Command pattern. |
| **Goals** | Every card repeats Edit + Complete buttons plus 3-4 low-contrast text actions ("+ Milestone  + Year goal  Pause"); empty progress bars "No milestones yet" on 4 of 5 cards; quarter child indented with a thin rail (fine). Move actions to a row menu (`goals/GoalCard.tsx`). |
| **Habits** | Not closely inspected; heatmap is already restrained. Align row + streak to ListRow. |
| **Finance** | 4 tall separate stat cards (500px on phone); category bars in orange look like alarms (and duplicate `--warn`); 6-month chart with empty months shows bare axes; "Top merchants" repeats category content in a second list; tabs clip at 375 ("Net w"); card titles uppercase (`finance/Overview.tsx`, `charts.tsx`, `finance.css`). Transactions tab should be the DataTable reference. |
| **Food, Learning, People, Journal, History, Review** | Checked: no overflow, no console errors. Structure uses `.card` grids with uppercase titles and per-feature CSS (`food.css`, `learning.css`, `people.css`...); needs KPI strip + ListRow migration. History/Review are lists with 24-52 lines of CSS each; good candidates for DataTable + SidePanel. |
| **Ontology** | Strongest "platform" visual, but needs a "scroll sideways inside this box" instruction, cards are clipped at the right edge, mono text at 11-12px everywhere; below it the object table + detail panel is exactly the Command pattern (good). Phone is unusable for the diagram: show the table and detail only, diagram behind a "View model" button (`pages/Ontology.tsx`). |
| **Data** | Not closely inspected (165 lines in one page file); likely wants tabs + DataTable for import batches. |
| **Settings** | Single column ~760px left-aligned inside a 980px main (looks off-center); three filled amber primary buttons in view (Save, Back up now, Export backup); long prose paragraphs; ink-3 helper text under AA. Owned by another agent now: apply tokens only after their change lands. |
| **Site (index/platform/get-started/privacy)** | Alternates dark and cream sections, so the app (dark only) and site feel like different products; hero and typography are good; `.reveal` leaves sections blank for screenshots/no-JS-observer cases (guarded already for reduced motion; check no-IO fallback). Needs token parity (same surfaces, ink-3 fix, Fraunces numerals only) and control-tower illustration that matches the real Command layout. |

## 7. Ranked change list (top 15)

| # | Change | Effort | Owner files |
|---|---|---|---|
| 1 | Tokens: ink-3 to AA, surface-3, line-strong, info, spacing/radius/type vars, global `:focus-visible`, reduced-motion, density vars | S | `src/index.css` |
| 2 | Phone shell: 5-tab bar + More sheet (kill 16-item scroller) | M | `App.tsx`, `index.css` |
| 3 | Desktop shell: grouped rail with icons, top bar (search/capture, sync chip, date) | M | `App.tsx`, `QuickCapture.tsx`, `index.css` |
| 4 | New primitives: KpiStrip, DataTable, ListRow, SidePanel/Sheet, Toast+Undo, StatusChip, ChartFrame; sentence-case Card titles | M | `components/ui.tsx` (+ new `components/*.tsx`) |
| 5 | Today: KPI strip + single queue (dedupe Focus/Due) + side column; one onboarding card for empty | M | `pages/Today.tsx`, `features/today/*` |
| 6 | Command: drop amber squares, 3-column queue/review fill, collapse Network, readable auto-apply copy | M | `pages/Ops.tsx`, `features/ops/*` |
| 7 | Tasks adopts Command pattern (queue + detail panel, grouping, bulk select) | L | `pages/Tasks.tsx`, `features/tasks/*` |
| 8 | Finance: KpiStrip, neutral/blue single-series bars, empty-chart states, tab overflow fix, Transactions as DataTable | M | `pages/Finance.tsx`, `features/finance/*` |
| 9 | Goals: row menu instead of 5 inline actions, hide empty progress | S | `pages/Goals.tsx`, `features/goals/*` |
| 10 | Planner: wider day columns, time axis in week, drop repeated habit line, single primary | M | `pages/Planner.tsx`, `features/planner/*` |
| 11 | Ontology: phone fallback (table + detail), edge-clip fix, mono only for ids | S | `pages/Ontology.tsx` |
| 12 | People/Learning/Food/Journal/History/Review: ListRow + KpiStrip + SidePanel migration | L | `pages/{People,Learning,Food,Journal,History,Review,Habits}.tsx`, their `features/*` |
| 13 | Data hub: tabs + DataTable for batches | S | `pages/DataHub.tsx`, `features/data/*` |
| 14 | Site token parity: one dark palette, control-tower illustration mirrors real Command layout | M | `site/*` |
| 15 | Settings: center/width fix, one primary per card, AA helper text (after other agent's work lands) | S | `pages/Settings.tsx`, `features/settings/*` (not now) |

## 8. Parallel work packages (disjoint files)

Order of landing: WP1 first for the primitives API (contract in section 4). WP2 and WP3 may start on their own files immediately with existing classes and swap to new primitives when WP1 merges. Nobody edits another package's files; if a page needs a new primitive, request it from WP1 in the integration step.

### WP1: shell + tokens (items 1-4)
Files: `src/index.css`, `src/App.tsx`, `src/components/ui.tsx`, `src/components/QuickCapture.tsx`, new `src/components/{KpiStrip,DataTable,ListRow,SidePanel,Toast,StatusChip,ChartFrame,BottomSheet}.tsx`.
Acceptance:
- [ ] ink-3 >= 4.5:1 on `--surface`; all new tokens present; `--mono` defined here only
- [ ] `:focus-visible` ring on buttons, links, rows, tabs; reduced-motion zeroes durations
- [ ] Phone: bottom bar has exactly 5 items, More sheet lists all other routes, no horizontal scroll, tap targets >= 44
- [ ] Desktop: grouped rail with icons and active bar; top bar has search/capture (`/` works), sync chip, date
- [ ] Primitives exported with the section-4 props and documented in a comment header; DataTable collapses to list rows at 375
- [ ] `npm run verify` green; no horizontal scroll at 375 on every route; screenshots attached

### WP2: core pages (items 5, 6, 7, 9, 10)
Files: `pages/{Today,Ops,Tasks,Goals,Planner}.tsx`, `features/{today,ops,tasks,goals,planner}/*`. Not Settings, not `src/sync`.
Acceptance:
- [ ] Today has a KpiStrip, no duplicated task in two lists, one onboarding card when empty
- [ ] Command matches section 5 (no amber squares, readable copy, review panel fills height, Network collapsed)
- [ ] Tasks uses queue + panel, keyboard j/k/Enter, undo toast on complete/delete
- [ ] Goals cards show <= 1 visible action; empty progress hidden
- [ ] Planner day columns >= 120px at 1280 or week becomes agenda; one primary button
- [ ] Existing tests pass; new logic (grouping, selection) has tests; seeded and empty states screenshotted at 1280 and 375

### WP3: data-heavy pages (items 8, 11, 12, 13)
Files: `pages/{Finance,Food,Learning,People,Journal,History,Review,Habits,Ontology,DataHub}.tsx`, `features/{finance,food,learning,people,journal,history,review,habits,data,insights,gcal}/*`.
Acceptance:
- [ ] Finance KpiStrip (2x2 on phone), single-series bars not orange, no empty-axis charts, tabs never clip, Transactions is a sticky-header DataTable with row selection
- [ ] Chart colors from the validated data palette only; legend + table view on multi-series
- [ ] Ontology usable at 375 (table + detail), diagram clipped no more
- [ ] All card titles sentence case via Card; no per-feature restyling of buttons/chips
- [ ] No horizontal scroll at 375; CSV import/undo, backup round trip untouched (tests green)

### WP4: site and marketing parity (item 14)
Files: `site/*.html`, `site/style.css`, `site/site.js`, `site/fonts`. No `src/*`.
Acceptance:
- [ ] Site uses the same dark surfaces and ink tokens as the app; at most one cream section or none
- [ ] Hero/platform illustrations use the real Command layout (KPI strip, queue, review panel) with clearly labelled sample data
- [ ] `.reveal` content visible without IntersectionObserver and with JS off
- [ ] 1280 and 375 screenshots of all 4 pages, no horizontal scroll, AA contrast, no third-party requests (privacy audit)
- [ ] Copy still states the opt-in encrypted sync accurately (per CLAUDE.md)

## 9. What I would NOT do

- No gradients, glows, glassmorphism, blurred backdrops, shadows on cards, or animated backgrounds.
- No second accent hue, per-module colors, or colored nav items. No rainbow KPI cards.
- No emoji or icon-fonts; only a single-weight inline SVG set.
- No global rewrite to a component library or Tailwind; stay with plain CSS and `ui.tsx`.
- No map, 3D, or faux-radar visuals just to look like the references.
- No light theme or theme switcher.
- No dashboard-widget customization or drag-to-rearrange (Workbench-style trackers were rejected); no new trackers.
- No rebuilding the org-chart-style visuals; Ontology keeps its current structure.
- No dual-axis charts, no more than 3 series on scatter/small multiples.
- No confirm dialogs where Undo works.
