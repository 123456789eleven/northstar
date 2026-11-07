# Redesign audit A (code-only, read-only)

Scope: Today, Plan hub, Tasks, Planner, Goals, Habits, Skills hub, Body, Food, Finance (all tabs). Paths relative to `src/`. Routes: `App.tsx` (Today at `/`; plan hub `/plan,/tasks,/planner,/goals,/habits`; skills hub `/skills,/body,/food,/finance,...`). Global game layer mounted in `App.tsx`: `PlayerProvider`, `MissionRail`, `MomentHost`, `ToastProvider`, `ShortcutsHost`. Calm mode (`game.calm` setting, `features/game/gameSettings.ts`) hides most gamification.

Notes: SimpleFIN is NOT in Finance tabs; it renders in Data hub (`pages/DataHub.tsx:127`, `/data#simplefin`). Bills live inside the Budgets tab (`finance/Budgets.tsx:98`), not a separate tab. Finance tab order: Overview, Transactions, Budgets, Net worth, Investments, Import. Page title says "Money".

---

## 1. Today (`/`)
- Purpose: Daily dashboard: focus slots, due/overdue list, agenda, habits, quests, cross-module glance.
- Files: `pages/Today.tsx`; `features/today/{AgendaStrip,DailyFindLine,GlanceTiles,HabitsNext,todayQueue,agenda}`; `features/tasks/{FocusBar,TaskRow,TaskEditor,ComboChip}`; `features/onboarding/FirstRunCard`; `features/insights/InsightsCard`; `features/game/ui/Mission.tsx` (MissionBoard).
- Data read: tasks, goals, habits (non-archived), habitLogs (today), calendar (today..tomorrow), events (workout.logged), meals (14d), transactions (month), budgets, weights, studySessions, people, settings (onboarding.dismissed, demo key, backup last, sync.enabled, setup done, game.*).
- Data written: tasks (complete/reopen/pin/edit/delete), habitLogs (tick), events (task.done), settings (onboarding.dismissed, demo load).
- User actions: complete task via checkbox (`TaskRow`, `FocusBar` Slot); swipe-right to complete on phone (`TaskRow.tsx` swipe, haptic tick); open task editor (click title); pin/unpin task to focus (pin icon, max 3, "Focus holds 3" note `Today.tsx:49`); FocusBar "Pin a task" picker (6 candidates); unpin from slot; Undo toast on complete; habits tile checkbox tick; "Add a task" empty button fires `ns:capture` event, `/` key jumps to capture bar; links: All tasks, Goals, Planner, Habits, KPI tiles (Due today/Overdue -> /tasks, Habits left -> /habits), glance rows -> /finance /food /body /learning /people; quest cards link to their href; Getting started steps (Start setup, Interview, Tasks, Goals, Finance, Food, People, Settings), "Load demo data", "Start blank"; phone: `<details>` "More" (quarter goals, insights, glance).
- States: empty YES (Nothing due today; quarter goals empty; agenda empty; habits empty); loading YES (skeletons, `kpi-skel`, Mission skeleton); error NO (no error path for Dexie failures); first-run YES (FirstRunCard hides at 15+ items or dismissed or demo); power-user PARTIAL (no filter/sort, no "upcoming" beyond today; overdue and due merged into one list).
- Gamification: (a) MissionBoard: progress ring of quests, "Day cleared", XP chip "+N XP today", WeekDots streak line with rest tokens (`Mission.tsx:12-60`; driven by `game/engine/quests.ts`, events table, habits); (b) ComboChip "x3" after 3+ completions in 10 min (`tasks/combo.ts`); (c) MissionRail (desktop >=1280px) level badge + XP bar; (d) MomentHost level-up/skill-up/day-cleared overlays (`game/ui/moment.ts`); (e) habit streak "7d/3w" per tile row; (f) haptic/sound celebrate (opt-in).
- Corny copy: "Today's missions"; "Day cleared"; "Every quest is done. Anything else today is a bonus."; "They complete themselves as you log."; "Missions come from your goals and routines. Add a goal to get your first ones."; "Daily find" label; "Level up" / "Skill up" kickers; "+N XP today".
- Top UX problems: (1) Up to 8 stacked cards (FirstRun, Mission, Focus+Agenda, DailyFind, KPI strip, list, Habits, Quarter, NextUp, Insights, Glance) with no hierarchy, KPI strip duplicates the list counts; (2) Focus (3 pins) and "Due today and overdue" list overlap and the same task can be pinned and due, shown only in Focus (`focusDate !== d` filter), which hides it from the due list; (3) `useLiveQuery(db.tasks.toArray())` and logs `toArray()` unscoped in HabitsTile (`HabitsNext.tsx:19`) will scale poorly; also no overdue grouping or reschedule action despite KPI note "Needs a new date".

## 2. Plan hub (`/plan`)
- Purpose: Overview of this week's focus, top quarter goal, habit ring, next calendar item, with quick links.
- Files: `pages/PlanHub.tsx`; `features/hubs/planhub.css`; `features/goals/{boss,BossBar}`; `features/progress/{metrics,metricsData}`; `features/game/ui/Ring`; `features/habits/week`; `components/HubLayout` (tab strip).
- Data read: tasks, goals, habits, habitLogs (this week), calendar (7 days), metric data (weights, etc. via `loadMetricData`).
- Data written: none.
- User actions: hub tab strip nav (Plan/Tasks/Planner/Goals/Habits via `HubLayout`); links "Tasks", "Goals", "Habits", "Planner"; "Open slot: pin a task" -> /tasks; "Create your first boss" -> /goals; "Add one" -> /habits; Quick links chips (Tasks, Planner, Goals, Habits). No inline mutation.
- States: empty YES per card (open slot, no goal, no habits, nothing scheduled); loading YES (skeleton x2); error NO; first-run PARTIAL (empty-card links only); power-user NO (only top 1 boss, 3 slots).
- Gamification: "Season boss" card with HP% + BossBar + checkpoint flags (`PlanHub.tsx:94-105`; `goals/boss.ts` bossHp/bossCheckpoints from goal progress or metric); habits Ring `done/target` (weekRing); calm mode swaps copy to "Top goal this quarter" and "% done".
- Corny copy: "Season boss"; "HP 72%" (`HP ${...}%`); "Create your first boss"; "Habits this week" heading class `quest-h`; "Next step".
- Top UX problems: (1) Slot list is read-only (no way to pin or complete here, just links away); (2) "This week's focus" actually shows today-focus + suggestions (`v.focus + v.suggestions`), label and data disagree; (3) Duplicates Today and each child page, so the hub adds a click without adding capability; "Quick links" chips duplicate the hub tab strip.

## 3. Tasks (`/tasks`)
- Purpose: Full task queue with grouped lists, side editor, focus slots and natural-language add.
- Files: `pages/Tasks.tsx`; `features/tasks/{TaskRow,TaskEditor(TaskForm),FocusBar,ComboChip,queue,taskActions,swipe,combo,captureSave}`; `lib/capture.ts` (parseTask/describeCapture); `components/{SidePanel,KpiStrip,Shortcuts}`.
- Data read: tasks, goals (active, for #goal tag).
- Data written: tasks (add, update, delete, complete, reopen, pin), events (task.done add/remove on complete/reopen), recurring task spawn in `completeTask`.
- User actions: quick-add line with NL parse ("renew passport in 2w !1", `#goal` tag) + Add button + chip preview; sticky quick-add on phone; checkbox complete/reopen; swipe-complete on phone; pin/unpin (3 max, "Today's focus is full" note); click row opens side form (title, notes, due, priority, repeats, goal); Save/Cancel/Delete (Undo toast); keyboard j/k move, Enter select, x complete (with Undo), `?` opens shortcuts; "Show/Hide completed" (14 days); FocusBar pick/unpin; deep-link focus param (`useFocusTarget`, reveals done tasks); close side panel; KPI strip (Open/Overdue/Due today/Done in 14 days).
- States: empty YES ("No tasks yet"/"All clear"); loading YES (skeleton rows + strip); error NO; first-run PARTIAL (empty copy teaches syntax only); power-user PARTIAL (no search, filter, sort, bulk, subtasks, tags, manual reorder).
- Gamification: ComboChip "x3" (visual only, `combo.ts`); completion animation (check draw, strike, leave); XP is implicit via events (task.done) feeding the player engine, not shown here; Undo toast.
- Corny copy: "x3" combo chip; "Completed \"...\"" toast; "All clear"; "Needs a new date"; "Reschedule or finish"; "it lands in the right group".
- Top UX problems: (1) Desktop auto-selects first row and always opens the side form, so the page is two-pane even when the user only wants to scan; keyboard handlers attach every render (`useEffect` with no deps, `Tasks.tsx:56-77`); (2) No search/filter/sort and completed list capped at 14 days with no way to see older; (3) Date entry only by NL or `<input type=date>`; no inline reschedule on overdue rows; FocusBar duplicates the pin button on every row.

## 4. Planner (`/planner`)
- Purpose: Week/day calendar with events, time blocks for tasks, due tasks, birthdays.
- Files: `pages/Planner.tsx`; `features/planner/{PlannerParts(DayGrid,WeekGrid,TaskTray,PlanPanel,HabitLine,TaskLine,EventButton),GridEvent,BlockDialog,EventModal,useBlocks,layout,timeBlock}`; `features/gcal/*`.
- Data read: calendar (all), tasks, habits, habitLogs (all), people (birthdays), settings (gcal.status, GCAL_DISMISS_KEY).
- Data written: calendar (add/update/delete events and blocks), tasks (`due` set from PlanPanel), habitLogs (via HabitLine tick), settings (gcal dismiss).
- User actions: "Block time"/"Add block" (phone) and "New event" buttons; Previous/Today/Next; Week/Day toggle (default Day on phone); click empty grid slot to create event at that time; click event to edit (Google events read-only: Close); drag event to move, drag bottom handle to resize (`GridEvent.tsx`), Undo toast each; drag task from TaskTray onto grid to block time (desktop, `text/x-task-id`); "Block" button per tray task (keyboard route); BlockDialog (kind toggle, Save, Delete, Cancel); EventModal (title, date, time, Save, Delete); PlanPanel "set due to <date>" buttons; click day header to open Day view; task checkbox (TaskLine); habit checkbox in Day side card; Google Calendar prompt: Connect (-> /data#gcal) / Dismiss; deep link focus date; conflict highlighting.
- States: empty YES ("Free", "No tasks due.", tray/plan empties); loading PARTIAL (header sub blank; no grid skeleton); error NO; first-run PARTIAL (gcal prompt only); power-user PARTIAL (no recurring events, no month view, no search; wide >=1240 week grid only).
- Gamification: none visible (daily habits count in subtitle only); block creation feeds no XP here.
- Corny copy: "Free" (empty day); "Blocked ... for \"...\"" toast; "Nothing to place. High-priority tasks without a due date show up here..."; mild only.
- Top UX problems: (1) Three overlapping creation paths (New event, Block time, grid click) with different dialogs; (2) Below 1240px week view degrades to a stacked list with no times, losing the point of a planner; (3) Loads all calendar rows and all habitLogs unbounded (`toArray()`), tasks tray hidden on phone so blocking is dialog-only.

## 5. Goals (`/goals`)
- Purpose: Hierarchical goals (life/year/quarter) with milestones, auto-tracked metrics and "boss" cards.
- Files: `pages/Goals.tsx`; `features/goals/{GoalCard,GoalEditor,BossCard,BossBar,Campaign,SuggestedLinks,GoalMenu,goalActions,boss,progress,completion}`; `features/progress/{metrics,metricsData}`; `features/tasks/TaskEditor`.
- Data read: goals, tasks, learning, settings (`body.goal`), metric data (weights, tx, budgets, habits etc.), localStorage `ns.goals.campaignOpen`.
- Data written: goals (add/update/delete w/ cascade unlink of children, tasks, learning), events (goal.done, goal.milestone add/remove), tasks (edit via TaskEditor), settings none.
- User actions: "New goal"; "Adopt this boss" (3 examples), "Write my own", "Create your first life goal"; click boss card/campaign row opens side panel; GoalCard: Complete / Reopen, row menu (Edit, Add milestone, Add child goal, Show/Hide linked tasks, Pause/Resume), toggle milestone checkbox, remove milestone, add milestone (type + Enter), edit linked task; "Complete goal" toast action, child-goal toast action; auto-complete on metric reached (toast with Undo); GoalEditor (title, horizon, area, part-of, target date, status, track automatically + target + period, why, Delete, Cancel, Save); Suggested links (Link / Dismiss); status Tabs (Active/Paused/Done/All); area filter chips; Campaign Collapse/Expand (localStorage); "Show all active goals"; "Add quarter goal" hint; deep-link focus.
- States: empty YES (first boss onboarding, filter empties); loading YES; error NO; first-run YES (strongest in app); power-user PARTIAL (no sort control, no archive, no history chart).
- Gamification: Boss cards with HP bar and checkpoint flags (`BossCard.tsx:31` `HP n%`, `BossBar.tsx`); "Season bosses" and "Campaign" headings; Ring per campaign row; auto-complete celebration toast; subtitle "Quest log" when empty; data = goalProgress + metric (`goals/boss.ts`).
- Corny copy: "Create your first boss"; "Adopt this boss"; "A boss is a goal you can finish this quarter."; "Season bosses"; "Campaign"; "Quest log"; "HP 64%"; "Boss added: ...".
- Top UX problems: (1) Game vocabulary (boss, HP, campaign) is renamed on the same entity as goal/quarter, so users must map two vocabularies; calm toggle only swaps two labels; (2) Active bosses are removed from the Campaign list when status=active (`bossIds` filter), so the same goal appears in different places per tab; (3) Editor mixes metric auto-tracking config into the basic form, and `AutoComplete` can complete goals silently in background with only a toast.

## 6. Habits (`/habits`)
- Purpose: Create and check in habits with weekly targets, streaks and heatmaps.
- Files: `pages/Habits.tsx`; `features/habits/{HabitRow(HabitCard,TodayRow,HabitDetail,MonthHeat),HabitParts(HabitModal,HeatStrip),useHabitCheckIn,habitData,stats,week}`; `features/game/ui/{Meters(WeekDots),Ring,feedback}`.
- Data read: habits, habitLogs (all), goals, game player streak.
- Data written: habits (add/update/archive/delete), habitLogs (check in/out), events (streak milestone achievements via `habitData.checkIn`).
- User actions: "New habit" (header + empty); check-in via `habit-check` button, Today row chips, month heat cell (backfill any date); open card -> HabitDetail side panel; "Edit or archive"; HabitModal (name, how often presets, area, supports goal, Archive/Restore, Delete with confirm, Cancel, Save); "Show/Hide archived"; Undo toast on streak-milestone check-in; haptic/sound on check (opt-in).
- States: empty YES; loading YES; error NO; first-run PARTIAL (copy only); power-user PARTIAL (no reorder, no notes, no reminders, no time-of-day).
- Gamification: weekly streak strip with WeekDots, rest tokens, "weeks in a row" (`Habits.tsx:64-75`; player.streak from `game/engine/streaks.ts`); per-habit Ring with `reward` tone at 100%; streak text "N days streak"; milestone toast at 7/30/100 days, 4/12/26 weeks "Added to Achievements" (`useHabitCheckIn.ts`); `celebrate('tick')`.
- Corny copy: "N days in a row: X. Added to Achievements. Next mark: ..."; "rest tokens"; "N weeks in a row"; "Small things, repeated"; "Weekly streak" label; "Start with one you can finish in two minutes".
- Top UX problems: (1) Two streak concepts shown together (global active-days streak with rest tokens vs per-habit streak) with no explanation of rest tokens; (2) Check-in affordances differ between Today chips, card button and heatmap cell; (3) Full `habitLogs.toArray()` on page and in Today tile; no per-day "time of day" grouping so long lists are flat.

## 7. Skills hub (`/skills`)
- Purpose: Navigation hub to the five life-skill pages with per-skill levels.
- Files: `pages/SkillsHub.tsx`; `features/hubs/{HubCard,hubs.css}`; `features/game/ui/{Constellation,Ring(LevelBadge),Meters(XpBar)}`; `components/HubLayout`.
- Data read: player state only (derived by `game/usePlayer` from events/tasks/habits etc.).
- Data written: none.
- User actions: HubCard links (Body, Money -> /finance, Mind, Career, People); Constellation skill key buttons (toggle active star, focus shows caption); hub tab strip (Skills + Body/Food/Finance/Mind/Journal/Learning/Career/People/Interview).
- States: empty NO (levels start at 1, no zero-state explainer); loading NO (engine `loading` ignored here); error NO; first-run NO; power-user NO.
- Gamification: Constellation graph of 5 stars with overall "Level N"; per-skill LevelBadge + XpBar + "+N XP today" (`SkillsHub.tsx:34-44`; `game/engine/{levels,xpTable,player}.ts`).
- Corny copy: "Five life skills. Every real thing you log brightens a star."; "Constellation"; "Level N overall"; "+N XP today"; "Skill up"; skill-level labels.
- Top UX problems: (1) The hub is mostly a gamified display; XP/levels are opaque (no explanation of how XP is earned or why a level moved); (2) Calm mode removes everything except five cards, so hub value collapses to nav; (3) Food has no card (not one of the five skills) though it is in the hub tab strip, so hub and strip disagree.

## 8. Body (`/body`)
- Purpose: Weight tracking with 7-day average, goal path, training log and calorie/protein guidance.
- Files: `pages/Body.tsx`; `features/body/{BodyHero,WeighInStepper,WeightPath,BodyChart,BodyPanels(GoalPanel,GuidanceCard,TrainingCard),TrainingPanel,bodyData,model,pathModel}`; `components/{ChartFrame,DataTable}`.
- Data read: weights, settings `body.*` (goal, goalDate, startWeight, height, trainDays, maintenance, surplus, protein), habits (Lift habit), habitLogs (7d + all for lift), meals (28d), settings food targets.
- Data written: weights (log/update/remove), events (body.weight, body.milestone), settings body.*, food.targets (apply), habits (create Lift habit), habitLogs (Log workout).
- User actions: Tabs Weight/Training; weigh-in stepper (-0.1/+0.1, type, Save/Update, "Change date", capture bar `w 136.4`); range buttons 30d/90d/All; chart data-table toggle with per-row remove (x) + Undo; Set goal form (goal, date, start, height, train days) Save; Guidance: maintenance input (blur save), surplus slider, protein input, "Use these targets", "Adopt" estimated maintenance; Training: "Log workout" / "Logged today. Tap to remove" (Undo), creates Lift habit on first log.
- States: empty YES (first weigh-in card); loading YES (PageSkeleton); error YES-ish (bad weight toast 50-700); first-run YES; power-user PARTIAL (no body fat/measurements/photos, lb only, no unit toggle).
- Gamification: checkpoint flags every 5 lb on Weight path and chips "crossed <date>"; Training Ring with number roll; "Checkpoint: 7-day average passed N lb" toast; BodyHero number roll; weekly target met message; feeds Body skill XP (events).
- Corny copy: "Your first weigh-in"; "Watch the path."; "Checkpoint: 7-day average passed ..."; "Weekly target met."; "Healthy pace (n lb/wk)"; "Tap to remove"; guidance is lean-gain-biased ("A lean-gain pace is roughly 0.5-1.0 lb/week").
- Top UX problems: (1) Copy and defaults assume weight GAIN (surplus slider, lean-gain text, default goal 165) with no cut/maintain mode; (2) Training is shoehorned onto a habit named "Lift" found by heuristic (`findLiftHabit`), invisible coupling; (3) GoalPanel save has no dirty/validation feedback beyond toast, GuidanceCard fields save on blur silently.

## 9. Food (`/food`)
- Purpose: Fast meal logging by slot with favorites, templates, targets and a week view.
- Files: `pages/Food.tsx`; `features/food/{DayView,SlotCard,QuickAdd,FoodLookup,Suggestions,LeftToday,MacroRings,DayStrip,WeekView,MiniBars,FoodModals(Targets,Favorites),TemplatesModal,useTemplates,foodData,foodLogic}`; `features/data/offSearch`.
- Data read: meals (day/yesterday/400 recent/week), favoriteMeals, weights (for estimate), settings (`food.targets`, templates key, OFF opt-in key, `body.goalWeight`).
- Data written: meals (add/remove/bulk copy), favoriteMeals (add/update/delete/uses), settings (food.targets, templates, OFF opt-in), events (protein-streak 7 days, health area).
- User actions: Day/Week tabs; prev/next day, date label opens native picker, "Today"; "Copy yesterday" (whole day) and per-slot copy; per-slot Add toggle (name, kcal, protein, "Fav" checkbox, Add); quick-add line ("3 eggs 210", "shake 600cal 40p") + slot select; favorite/recent chips with x1-3 multiplier chip; template chips, "Save as template" (name, max 20); suggestion chips; food lookup (local list; opt-in Open Food Facts search runs only on button press, opt-in checkbox); remove meal with Undo; header Favorites modal (rename, slot, kcal, protein, Save, Delete), Templates modal (rename, edit items, Save, Delete), Targets modal (kcal, protein); phone `RowMenu` for Templates/Targets; LeftToday "Set targets"/"Targets from estimate"; Week view day click opens day; deep link focus date.
- States: empty YES ("Nothing logged yet"); loading YES (slot skeletons); error PARTIAL (lookup errors?; none surfaced for Dexie); first-run PARTIAL; power-user YES (templates, favorites, multiplier).
- Gamification: macro rings (calories/protein vs targets, `MacroRings.tsx`); LeftToday remaining numbers; "Hit protein target (n g) 7 days straight" milestone event; DayStrip status dots; feeds Body skill XP.
- Corny copy: "Log what you eat in a tap or a line."; "Hit protein target (n g) 7 days straight"; "Tick “Fav” on meals you repeat and they become one-tap chips."; "Usual snack"; mild overall.
- Top UX problems: (1) Four overlapping entry points per slot (add form, quick-add, chips, lookup) with no clear primary; (2) Targets live in three places (Food Targets modal, Body Guidance "Use these targets", LeftToday estimate) with different sources of truth; (3) `meals.orderBy('date').reverse().limit(400)` + client-side suggestion math on every render of DayView and no macros beyond kcal/protein.

## 10a. Finance shell + Overview (`/finance`, tab Overview)
- Purpose: Month-scoped money dashboard: status, spend by category, trend, recurring.
- Files: `pages/Finance.tsx` (shell, tabs, month stepper, deep link `?tab=transactions&focus=<id>&month=`); `features/finance/{Overview,MoneyHero,HealthBar,charts,model,recurring,moneyGame,categories}`.
- Data read: transactions (range + all for recurring), budgets, bills (settings `BILLS_KEY`), settings rules, latest tx date.
- Data written: none (Overview is read-only).
- User actions: month prev/next, "This month", Print (`window.print`); tab switch (Overview, Transactions with uncategorized badge, Budgets, Net worth, Investments, Import); "Set budgets"; "Import a file" (empty); "Categorize" (-> Transactions filtered uncategorized); "All budgets"; chart tables/toggles via ChartFrame; auto-jump to latest month with data; deep-link focus to a transaction.
- States: empty YES ("No transactions yet"); loading YES (PageSkeleton); error NO; first-run YES (import CTA); power-user PARTIAL (no custom date range, no account filter).
- Gamification: MoneyHero "Monthly boss: stay within your budget" with HP bar, remaining $ number roll, pace tick, status ("Boss cleared", "Ahead of pace", "Over budget"); no-spend-day grid; savings-rate Ring (`MoneyHero.tsx`; `moneyGame.ts` bossState/noSpendDays from budgets+transactions).
- Corny copy: "Monthly boss: stay within your budget"; "Boss cleared"; "Set a budget to start a monthly boss"; "Its health is the budget you have left."; "no-spend days"; page title "Money" vs route/label "Finance".
- Top UX problems: (1) Header copy "No logins, no syncing" conflicts with SimpleFIN feed and cloud sync that exist elsewhere; (2) Month stepper hides on Net worth/Investments/Import, so the header jumps in height; (3) "Boss" metaphor for a budget status inverts meaning (remaining budget = HP) and competes with a plain "On budget / $ over" line right above it.

## 10b. Finance: Transactions
- Purpose: Browse, search, add, recategorize, delete transactions with rule learning.
- Files: `features/finance/Transactions.tsx`; `categories.ts`, `quickAdd.ts`.
- Data read: transactions (month or all), settings rules.
- Data written: transactions (add/update category/delete), settings merchant rules (`addMerchantRule`), events (tx.categorize).
- User actions: add row (date, description NL like "Kroger 42.50"/"Paycheck +1200", direction, amount, category, Add); search box; category filter; "All months" checkbox; "Categorize" triage modal (pick category, "always" checkbox, skip, close); change category via inline select (desktop) or BottomSheet (phone); rule offer Accept/Dismiss ("Rule saved. N other transactions updated."); delete (x) with Undo/Dismiss banner; Import CTA in empty state.
- States: empty YES; loading PARTIAL (no skeleton visible in code); error NO; first-run YES; power-user PARTIAL (no bulk edit, no split, no notes, no edit of amount/date/description).
- Gamification: triage modal progress ("Done, N categorized."); feeds Money XP via tx.categorize events (quests, `game/engine/quests.ts`).
- Corny copy: "Done — N categorized."; "Nothing left to categorize." (mild).
- Top UX problems: (1) Cannot edit amount/date/description after save, only delete and re-add; (2) Rule offer and flash are ephemeral banners that can be missed; (3) Delete uses local banner Undo rather than shared toast like the rest of the app.

## 10c. Finance: Budgets (incl. Bills)
- Purpose: Monthly category limits with pace bars, plus non-monthly bills set aside monthly.
- Files: `features/finance/{Budgets,BillsSection,HealthBar,bills,billsData}`.
- Data read: budgets, transactions (month + previous), bills (settings `BILLS_KEY`), tasks (open, for reminder dedupe).
- Data written: budgets (upsert/delete per category, "copy last month"), settings bills, tasks (reminder "Pay <bill>").
- User actions: type limit per category (blur/enter, empty removes); "Use <month> spending as budgets"; "Fill empty from <month>"; Bills: "Add bill" (cap-limited), edit bill modal (name, amount, every N months/custom, last paid, category, match text, account note, Save, Delete w/ Undo), "Add reminder" task, suggested bills "Add as a bill".
- States: empty YES (both); loading YES; error NO; first-run YES; power-user PARTIAL (no rollover, no per-month override, no income plan).
- Gamification: HealthBar pace labels per category and total; CountUp number; "left" labels.
- Corny copy: mostly neutral; "HealthBar" semantics ("Ahead of pace").
- Top UX problems: (1) Bills hidden at the bottom of Budgets with no tab or nav entry; (2) Limits save on blur with no confirmation; (3) Budgets are global (not per month) so month stepper is misleading here.

## 10d. Finance: Net worth
- Purpose: Track account balance snapshots and net worth trend.
- Files: `features/finance/{NetWorth,NetWorthHero,moneyGame}`.
- Data read: balances.
- Data written: balances (add snapshot), events (finance.networth-high, milestone).
- User actions: add snapshot row (date, account with datalist, kind asset/liability, balance, Add); per-account "update balance" inline input + Save; chart toggles via ChartFrame; (Undo for add: toast code at `NetWorth.tsx:32-38`).
- States: empty YES; loading YES; error NO; first-run YES; power-user PARTIAL (no account delete/archive/rename visible, no categories).
- Gamification: NetWorthHero number roll + "Previous high"; NetWorthPath milestone flags with "$X to go"; "New net worth high" milestone event (`moneyGame.netWorthMilestones`).
- Corny copy: "New net worth high: $..."; "High"; "N milestones crossed" (aria); "Add a second update to see the change".
- Top UX problems: (1) No way to delete/hide a stale account or fix a wrong snapshot; (2) Manual-only entry duplicates Investments and SimpleFIN balances; (3) Milestone ladder is auto-generated with no user control.

## 10e. Finance: Investments
- Purpose: Manual holdings, prices, allocation, retirement contribution tracking and projection.
- Files: `features/investments/{Investments,actions,model}`.
- Data read: holdings, balances, contributions, all settings.
- Data written: holdings (add/update/remove), balances (push to net worth), contributions (add/delete), settings (`invest.accounts`, `invest.iraLimit`, `invest.iraCatchup`).
- User actions: "Add a holding" (mode: know balance+price / know shares; account, ticker, amount, price, Save); "Update price"; Edit (shares, cost basis, Save, Remove holding); "Update Net worth balance to $X"; mark accounts as invested (account chips); add contribution (date, amount, kind) + Delete; detect-from-transactions checklist import; projection inputs (return %, monthly add, years); IRA limit + catch-up (blur save); allocation chart; balance-by-month chart.
- States: empty YES ("Add your first holding" - copy names a specific fund, VTI); loading YES; error NO; first-run YES; power-user PARTIAL (no lots, no live prices by design, no performance vs cost).
- Gamification: Progress bar toward contribution limit; invested path hero (shared NetWorthHero with milestones).
- Corny copy: "Add your VTI holding: type your balance and today's price." (specific to one user, not generic).
- Top UX problems: (1) Prices must be typed by hand; stale `priceDate` is not flagged; (2) Dense inline forms (4-6 inputs per row) are hard on phone; (3) Hard-coded regex `/roth|ira|schwab/i` for contribution detection is user-specific and brittle.

## 10f. Finance: Import
- Purpose: Import bank OFX/QFX/CSV with mapping, dedupe preview and batch undo.
- Files: `features/finance/{Import,csv,ofx,dedupe,importActions}`.
- Data read: transactions (for dedupe), settings (saved column mapping per header signature `MAP_KEY_PREFIX`), import batches.
- Data written: transactions (bulk), import batch records, balances (optional snapshot from OFX ledger), settings (mapping memory), events (finance.import).
- User actions: choose/drop file (.ofx/.qfx/.csv/.txt; 5 MB cap); account name; column mapping selects (date, description, amount/debit/credit, mode), "expenses positive" and "day first" checkboxes; preview table with New/Already imported/Skip per row; "Choose a different file"; Import button; "also record balance snapshot" checkbox; result card -> "Categorize" / "View transactions"; Undo batch (result and Past imports list).
- States: empty YES (Past imports empty); loading PARTIAL (`busy` flag); error YES (size, type, parse errors); first-run YES; power-user YES (saved mappings, dedupe).
- Gamification: none (finance.import event feeds Money XP silently).
- Corny copy: none notable.
- Top UX problems: (1) Mapping UI is exposed even when auto-detect is confident; (2) Preview shows all rows with no pagination in large files; (3) Account name is free text so same account can fragment across imports.

## 10g. SimpleFIN (lives in Data hub `/data#simplefin`, not Finance)
- Purpose: Optional live bank feed via SimpleFIN Bridge through a relay, requires sync sign-in.
- Files: `features/simplefin/{SimpleFinCard,client,map,help}`; mounted `pages/DataHub.tsx:127`.
- Data read: settings (STATUS_KEY, REQUESTS_KEY, rules), transactions (SFIN-prefixed fitid), balances.
- Data written: transactions (preview then commit), balances (optional snapshots), settings (status, request log, token handled via relay).
- User actions: 3-step setup stepper (Show again, Done next, Test relay, Relay works next, paste token, Connect); preview with "add balances" checkbox, Commit / Cancel; "Sync now", "Sync anyway" (rate-limit gate), Disconnect; link to Settings sign-in; disclosure text.
- States: empty/first-run YES (stepper); loading YES (busy labels); error YES (`friendlyFeedError`); power-user YES (rate gating).
- Gamification: none.
- Corny copy: none.
- Top UX problems: (1) Wrong place: finance feature configured under Data; Finance page header says "No logins, no syncing"; (2) Requires account sign-in just for a local-first feature; (3) Long setup copy inside a card.

---

## REGRESSION ITEMS A

### Today
- [ ] Today header shows date, open/overdue count and next event
- [ ] FirstRunCard shows only while <15 items, not dismissed, not demo; steps link correctly; "Load demo data" and "Start blank" work
- [ ] MissionBoard renders quests, ring, XP chip, WeekDots; hidden in calm mode; "Set a goal"/"Add a routine" empty links
- [ ] FocusBar: pin from picker, unpin, complete, open editor, shows "N of 3 open"
- [ ] AgendaStrip lists today's events/blocks with Now/Next tags; empty state links Planner
- [ ] DailyFind line renders only when data supports it
- [ ] KPI strip: Due today, Overdue, Done today, Habits left (links work)
- [ ] "Your day" list: due/overdue items and Done today; complete/reopen with Undo toast
- [ ] Task row swipe-to-complete on phone
- [ ] Pin from row; 4th pin shows "Focus holds 3" note
- [ ] "Add a task" button focuses capture bar; `/` shortcut works
- [ ] Task editor modal from Today saves and deletes (Undo)
- [ ] HabitsTile checkbox ticks, shows streak badge, count "N of M"
- [ ] NextUp card lists next 3 events
- [ ] Quarter goals card with progress bars linking to Goals
- [ ] InsightsCard renders
- [ ] GlanceTiles rows (money, food, weight, learning, people) show only with data
- [ ] Phone layout: HabitsTile, NextUp, "More" details
- [ ] Skeletons while loading

### Plan hub
- [ ] Three focus slots filled from focus+suggestions; empty slots link to Tasks
- [ ] Boss card (HP/percent by calm), BossBar flags, next step
- [ ] Habits ring `done/target` and "due today" text
- [ ] Next time block with Today/Tomorrow label
- [ ] Quick link chips; HubLayout tab strip
- [ ] Empty states for goal/habits/calendar; loading skeleton

### Tasks
- [ ] Quick-add parses date, priority, #goal; chip preview; Add disabled when empty
- [ ] Sticky quick-add on phone
- [ ] Groups (overdue, today, etc.) with counts
- [ ] Complete/reopen with animation + Undo toast
- [ ] Swipe-complete (phone)
- [ ] Side panel form: title, notes, due, priority, repeats, goal; Save toast "Saved"; Delete with Undo
- [ ] Phone: tap opens sheet
- [ ] Keyboard j/k/Enter/x; `?` opens shortcuts hint
- [ ] Show/Hide completed (14 days)
- [ ] KPI strip (Open, Overdue, Due today, Done in 14 days)
- [ ] FocusBar on Tasks; pin cap note
- [ ] ComboChip after 3 completions in 10 min
- [ ] Deep-link focus param reveals task (incl. done)
- [ ] Recurring task spawns next on complete
- [ ] Empty state copy; skeleton

### Planner
- [ ] "New event" and "Block time"/"Add block" buttons
- [ ] Prev/Today/Next; Week/Day toggle; phone defaults to Day
- [ ] Click empty grid slot creates event at time
- [ ] Event modal: create, edit, delete; Google events read-only
- [ ] Drag to move, drag handle to resize, with Undo toast
- [ ] Drag task from tray onto grid; "Block" button per task
- [ ] BlockDialog create/edit/delete, kind toggle
- [ ] Conflict highlighting
- [ ] Tasks due and birthdays show per day; task checkbox
- [ ] Day side card: due tasks and daily habits ticks
- [ ] PlanPanel "set due" buttons
- [ ] Google Calendar prompt Connect/Dismiss
- [ ] Narrow-width week list; day header opens Day
- [ ] Deep-link focus date

### Goals
- [ ] First-run: adopt example boss (Undo toast), write own, life goal
- [ ] "New goal" opens editor with correct default horizon
- [ ] Boss cards with HP/percent and flags; open side panel
- [ ] Campaign list: collapse/expand persisted; status tabs; area chips
- [ ] GoalCard: complete/reopen, menu actions (edit, milestone, child, linked tasks, pause/resume)
- [ ] Milestones add/toggle/remove with toasts and "Complete goal" action
- [ ] Auto-complete when metric reached (toast+Undo)
- [ ] GoalEditor all fields incl. metric tracking; Delete unlinks children/tasks/learning
- [ ] Suggested links Link/Dismiss
- [ ] "Add quarter goal" hint
- [ ] Linked task edit from goal panel
- [ ] Deep-link focus opens goal

### Habits
- [ ] New habit modal (name, frequency presets, area, goal, Save)
- [ ] Edit; Archive/Restore; Delete with confirm
- [ ] Check-in from card, Today row, month heat cell (backfill)
- [ ] Per-habit ring, streak text; HabitDetail panel with heat strip
- [ ] Weekly streak strip, rest tokens, weeks in a row (hidden in calm)
- [ ] Streak-milestone toast with Undo
- [ ] Show/Hide archived
- [ ] Empty + skeleton states

### Skills hub
- [ ] Constellation + overall level (hidden in calm)
- [ ] Five HubCards link to correct pages with level badge, XP bar, "+N XP today"
- [ ] Calm mode: cards only, plain subtitle
- [ ] Hub tab strip includes all skill pages

### Body
- [ ] Weight/Training tabs
- [ ] First-weigh-in empty state
- [ ] Weigh-in: type, +/-0.1, Save/Update, change date, invalid range toast
- [ ] BodyHero numbers (current, change, rate, to go, projection, next checkpoint)
- [ ] Weight path chart with range 30d/90d/All, ghost line, flags
- [ ] Data table with remove (Undo)
- [ ] Checkpoint chips
- [ ] Set goal form saves all five fields
- [ ] Guidance: maintenance, surplus slider, protein, Use these targets, Adopt maintenance
- [ ] Training: Log workout / remove, creates Lift habit, last sessions list, ring
- [ ] Checkpoint milestone toast on weigh-in

### Food
- [ ] Day/Week tabs; day stepper, date picker, Today
- [ ] Add meal per slot (name, kcal, protein, Fav)
- [ ] Quick-add line with slot select
- [ ] Favorite/recent chips with multiplier; Undo
- [ ] Templates: save slot as template, apply, manage modal
- [ ] Copy yesterday (day and slot)
- [ ] Suggestions chips; food lookup local and opt-in Open Food Facts
- [ ] Remove meal with Undo
- [ ] Favorites modal edit/delete; Targets modal; phone RowMenu
- [ ] Macro rings, LeftToday, "Targets from estimate"
- [ ] Week view bars and day click-through; DayStrip
- [ ] 7-day protein streak milestone event
- [ ] Deep-link focus date

### Finance shell + Overview
- [ ] Tabs incl. uncategorized count badge; deep link tab/focus/month
- [ ] Month stepper, This month, Print (Overview)
- [ ] Auto-jump to latest month with data
- [ ] MoneyHero boss/status, savings ring, no-spend grid, bills set-aside chips
- [ ] KPI row with trends; uncategorized banner with Categorize
- [ ] Budgets near/over limit card
- [ ] Spend-by-category and 6-month charts with table toggle
- [ ] Top merchants; Recurring and subscriptions
- [ ] Empty "No transactions yet" with Import CTA

### Finance: Transactions
- [ ] Add row with NL description, direction, amount, category auto-suggest
- [ ] Search, category filter, All months
- [ ] Inline category select (desktop) and BottomSheet (phone)
- [ ] Rule offer Accept/Dismiss and applied count
- [ ] Delete with Undo banner
- [ ] Categorize triage modal (pick, always-rule, skip, close)
- [ ] Empty and no-match states

### Finance: Budgets + Bills
- [ ] Set/clear limit per category
- [ ] Total card with HealthBar and unbudgeted note
- [ ] "Use last month spending as budgets" and "Fill empty"
- [ ] Add/edit/delete bill (Undo), custom interval, match text
- [ ] Bill "Add reminder" creates task (Undo)
- [ ] Suggested bills "Add as a bill"

### Finance: Net worth
- [ ] Add snapshot (date, account, kind, balance)
- [ ] Per-account balance update
- [ ] Hero, milestones, previous high; net worth path chart
- [ ] New-high milestone event
- [ ] Empty state

### Finance: Investments
- [ ] Add holding (both modes); update price; edit shares/cost basis; remove
- [ ] Push value to Net worth balance
- [ ] Mark accounts invested; invested hero and path
- [ ] Contributions add/delete; limit and catch-up settings; progress
- [ ] Detect contributions from transactions
- [ ] Allocation and balance-by-month charts; projection inputs

### Finance: Import
- [ ] File pick/drop; 5 MB and type errors
- [ ] OFX and CSV parse; mapping selects; saved mapping reuse
- [ ] Preview New/Already imported/Skip; counts
- [ ] Import commit; optional balance snapshot
- [ ] Result card -> Categorize / View transactions
- [ ] Undo batch (result + Past imports)

### SimpleFIN (Data hub)
- [ ] Sign-in gate message; 3-step setup; Test relay; token Connect
- [ ] Sync now / Sync anyway / Disconnect
- [ ] Preview then Commit/Cancel; add balances checkbox

### Cross-cutting
- [ ] Calm mode toggle hides Mission, rail, XP, bosses wording, Constellation
- [ ] MomentHost level-up / skill-up / day-cleared overlay (Esc/click dismiss)
- [ ] Undo toasts across task, goal, habit, meal, weight, block actions
- [ ] Capture bar `/`, `ns:capture` event, `w 136.4` weight syntax
- [ ] Route transitions (view transitions / fade), skip link, document titles
