# Design audit (app), 2026-11-01

Evidence: `tools/qa.mjs --demo --full` at 1440 and 375 for all 17 routes (`shots/before/`), plus a scripted pass for Finance sub-tabs, a modal, the palette and reduced motion (`shots/after/`). Before: no horizontal scroll, no console errors on any route. Public site (`site/`) is out of scope for this run (another agent owns it).
Ranking: 1 = most responsible for the "skeleton" feeling. **[fixed]** = done in phases 1-2 of this run; the rest is the backlog for later phases.

## Cross-cutting (every route)
1. **No motion explains change.** Modals, sheets and toasts popped in and vanished; tabs jumped; KPI numbers appeared fully formed; completing a task removed the row instantly. `src/components/ui.tsx:61` (Modal), `BottomSheet.tsx:11`, `Toast.tsx:19`, `ui.tsx:83` (Tabs). **[fixed]** motion tokens, exit animations, sliding tab bar, count-up, strike-through completion.
2. **Blank first paint.** Pages `return null` or render empty cards while `useLiveQuery` loads, then everything lands at once (Finance `features/finance/Overview.tsx:115`, Budgets `Budgets.tsx:33`, NetWorth `NetWorth.tsx:21`, Investments `Investments.tsx:28`, Body `pages/Body.tsx:40`, Today/Tasks KPI strip hidden until loaded). **[fixed]** `Skeleton` / `PageSkeleton` on Today, Tasks, Habits, Goals, Finance (4 tabs), Body, Food, Journal.
3. **Disabled primary buttons read as brown blocks** (40% opacity amber): Food "Add" x5, Tasks "Add", Body "Log". `index.css` `.btn:disabled`. **[fixed]** neutral disabled state.
4. **Primary hover used `filter: brightness`** and no pressed state on any button; toggles with `aria-pressed` (Body range 30d/90d/All) had no visual pressed state at all. `index.css` `.btn-primary:hover`. **[fixed]** accent hover/pressed tokens, press scale, pressed toggle style.
5. **Four different chart tooltips and hand-copied axis colours** in `finance/charts.tsx`, `body/BodyChart.tsx`, `journal/MoodChart.tsx`, `food/MiniBars.tsx`, `investments/Investments.tsx:320`, `review/RatingsTrend.tsx`. **[fixed]** `components/chartTheme.ts` + `ChartTip.tsx`, applied to all six.
6. **`.icon-btn` defined twice** (index.css 40px, tasks.css 32px): once Tasks/Today CSS loaded, the top-bar search/capture buttons shrank to 32px. `features/tasks/tasks.css:34`. **[fixed]** one 32px base, top bar scoped to 40px.
7. **Empty states had no action** and indented 4px off the card title line. `ui.tsx` Empty, `index.css .empty`. **[fixed]** `Empty{title, action}`, aligned.
8. Input focus was a border colour change only; no hover, invalid or disabled states. **[fixed]** (`Field{hint,error}`, `aria-invalid`).
9. Card-title actions wrapped mid-value on phone ("$1,622.49 / month"). **[fixed]** action never wraps.
10. Open: the focus trap's opener capture misses when a modal child uses `autoFocus` (Habit modal): Esc returns focus to `<body>`, not "New habit". Pre-existing, left as is per "focus handling unchanged". `components/useFocusTrap.ts:12`.

## Today (`pages/Today.tsx`, `features/today/*`)
1. 32px dead band between "Your day" and "Suggested focus" (`.sub-head` top padding after the card title). `today.css:20`. **[fixed]**
2. Phone "More" disclosure showed a literal `2` when open (mis-encoded minus). `today.css:37`. **[fixed]**
3. Empty day had no action. `Today.tsx:149` (old). **[fixed]** "Add a task" opens capture.
4. Quarter goals / Next up / glance rows are links with no hover feedback. **[fixed]** full-bleed row hover.
5. Open: "Overdue" KPI value is plain ink; the warn tone only exists for deltas (`components/KpiStrip.tsx`). Consider `deltaTone` colouring the note.

## Tasks (`pages/Tasks.tsx`)
1. Completion had no moment (row vanished). `features/tasks/TaskRow.tsx`. **[fixed]** check pops, strike draws (320ms), then the row leaves; toast with Undo unchanged.
2. KPI strip and list absent until data loads. **[fixed]** skeleton.
3. Open: preview chips use a negative-margin hack `Tasks.tsx:139`; keyboard hint line `Tasks.tsx:178` floats under the card (belongs in a `?` overlay, see next phase).

## Habits (`pages/Habits.tsx`, `features/habits/HabitParts.tsx`)
1. Loudest page in the app: 28 solid amber day tiles plus a heatmap of 36x11 amber bars. `habits.css:245,251`. **[fixed]** done tiles = soft amber + amber line; heatmap cells shorter, empty cells neutral `--surface-3`.
2. Check-in had no feedback beyond the colour swap. **[fixed]** press scale + pop.
3. Empty state was bare text outside a card. `Habits.tsx:41`. **[fixed]** card + "New habit" action.
4. Open: "7 of 5" / "5 of 4" counts read as errors when over target (`HabitParts.tsx:55`); consider "5 of 4, target met".

## Finance (`pages/Finance.tsx`, `features/finance/*`, `features/investments/*`)
1. Overview: "Spending by category" card stretched to the chart's height, leaving ~180px of empty card; "Top merchants" sat alone full width at the bottom. `Overview.tsx:192`. **[fixed]** left column = categories + merchants, right = trend.
2. Category bars had no track and appeared instantly. `finance.css .fin-hbar`. **[fixed]** neutral track, bars grow once.
3. Budgets total figure static; over-budget bars only recoloured via a wrapper class. `Budgets.tsx:53,120`. **[fixed]** count-up, `Progress tone="warn"`.
4. All four tabs blank while loading. **[fixed]** skeletons.
5. Open: month stepper uses text glyphs ‹ › (`Finance.tsx:48`) rather than the icon set; Transactions tab is the next DataTable reference to polish.

## Goals (`pages/Goals.tsx`, `features/goals/*`)
1. Goal trees sat directly on the page background with only hairlines: no grouping, weak hierarchy. `goals.css:6`. **[fixed]** each life-goal tree is one surface.
2. Five bordered "Complete" buttons per screen competed with the primary "New goal". `GoalCard.tsx:72`. **[fixed]** quiet ghost actions.
3. Filter-empty state had no way back. `Goals.tsx:138`. **[fixed]** "Show all active goals".
4. Open: goal completion has no moment beyond leaving the Active list (candidate: brief toast with Undo).

## Body (`pages/Body.tsx`, `features/body/*`)
1. Empty state + five-column goal form stretched the full 1100px width; guidance a thin full-width strip. `Body.tsx:88-92`. **[fixed]** goal and guidance side by side (3:2), same split when data exists.
2. Weight input placeholder set in Fraunces (serif reserved for numbers). `body.css:4`. **[fixed]** Inter placeholder, the typed number stays serif.
3. Range buttons had no pressed style. **[fixed]** global `aria-pressed`.
4. Open: chart legend colours are literals (`Body.tsx:129`); move to `CHART.accent`.

## Food (`pages/Food.tsx`, `features/food/*`)
1. Disabled "Add" buttons rendered as five brown blocks (see cross-cutting 3). **[fixed]**
2. No loading state for the four slot cards. **[fixed]**
3. axe: date stepper button name did not contain its visible text. `DayView.tsx:90`. **[fixed]**
4. Open: three equal-weight header buttons (Favorites, Templates, Targets) `Food.tsx:29-35`; fold into one "Manage" menu. Chip rows wrap to three lines on phone at Dinner.

## Journal (`pages/Journal.tsx`, `features/journal/*`)
1. Month dividers were 12px grey text, easy to miss in a long list. `journal.css:15`. **[fixed]** mono label with a hairline.
2. axe: entry buttons' `aria-label` hid the visible date + preview; date-picker icon below AA. `Journal.tsx:22,149`, `journal.css:8`. **[fixed]**
3. Entry rows had underline-only hover. **[fixed]** row hover surface.
4. Focus mode: entrance now fades in; behaviour untouched. Open: the word-goal bar under focus mode animates by width (not animated today); convert to `Progress` if motion is wanted.

## Command (`pages/Ops.tsx`, `features/ops/*`) - not in this run
1. Object-type legend uses amber squares that encode nothing (`ops.css:19-20`). 2. Network view summary is one long sentence in a full-width card (`Ops.tsx:227`). 3. Review panel leaves ~400px empty under it at 1440.

## Planner (`pages/Planner.tsx`, `features/planner/*`) - not in this run
1. Week day columns ~150px wrap titles to 2-3 lines; no time axis. 2. "Plan my day" empty card spans full width under the week (`PlannerParts.tsx:89`). 3. Two amber elements compete (New event + today column border).

## Learning, People, History, Review, Data, Ontology, Settings - not in this run
- Learning `pages/Learning.tsx:22` returns null while loading (needs `PageSkeleton`); progress uses its own `.learn-progress` (`learning.css:11`) instead of `Progress`.
- People / History / Review: list pages on `.card` + `.list-item`; migrate to `ListRow` for hover/pressed/focus states; History is 2,100px tall at 1440 with no month grouping density control.
- Data `pages/DataHub.tsx:133`: empty batches state without an action.
- Ontology: diagram is the strongest visual; phone shows a clipped diagram (`pages/Ontology.tsx`).
- Settings: four filled amber primaries in one view (`features/settings/Sections.tsx:137,161`, `SyncSection.tsx:124,159`); single 760px column off-centre in a 1280 main.
