# Northstar redesign audit B (read-only code audit)

Scope: Mind hub, Journal, Learning, Career, People, You hub, Trophies, Season, Intel, Settings, Data hub, Ontology, Interview, Setup/first-run/demo, capture bar/orb, global search, shell/navigation; gamification inventory; stack + styles; why the glass reads flat. All paths relative to `C:\Users\bearf\Documents\northstar\src` unless noted. No personal data. Line numbers are from the current tree.

Findings that affect planning (read first):
- Google Calendar and SimpleFIN cards live on the **Data hub** (`pages/DataHub.tsx`), NOT in Settings. Settings has Game, Sync, Backup & restore, Data on this device, Preferences, About & privacy, Danger zone.
- `features/onboarding/DemoCard.tsx` is **dead code** (no importer). Demo load/remove lives in Settings > Data on this device (`StorageSection`), Danger zone (`DangerSection`) and `FirstRunCard`.
- `App.tsx` comment mentions a "More sheet" and `.more-link` CSS still exists, but `Shell.tsx` has no More sheet any more (stale).
- `data-aurora-drift` (index.css:738) is never set anywhere in TS/TSX: the drift animation is dead; the ambient layer is static.
- Hub tab strip, rail and phone bar all use the same nav model (`components/nav.ts`): 4 hubs (Today, Plan, Skills, You), 22 NAV entries.

---------------------------------------------------------------------------------------------------

# PART 1: PER-SCREEN AUDIT

## 1. Mind hub (/mind)
- Purpose: landing for Journal + Learning with weekly rings and the Mind skill level.
- Files: `pages/MindHub.tsx`, `features/hubs/HubCard.tsx`, `features/hubs/hubs.css`, `features/journal/{MoodPreview,constellation,insights,stats}.ts(x)`, `features/learning/learningData.ts`, `features/game/ui/{Ring,Meters,playerContext}`.
- Data read: `db.journal` (this week, this month, last), `db.learning` (active), `db.studySessions` (this week), settings `journal.goal`, `learning.weeklyTargetMin`, player state (mind skill, streak.target). Written: none.
- Actions: click Journal card; click Learning card; (no inline actions). Tab strip: Overview / Journal / Learning sub-strip (nav.ts SUBTABS).
- States: loading = values undefined, no skeleton (rings render 0); empty = "No entries yet" / "Nothing in progress. Add a course or a book on Learning."; calm = level card hidden (`!p.calm`), rest stays; no error state; power-user = capped to 3 active items. Missing: skeleton for rings, explicit loading.
- Gamification: Mind LevelBadge + XpBar (`Ring.tsx`, `Meters.tsx`; derived from `usePlayerState().skills`); writing-days ring vs `streak.target`; "Mood constellation" MoodPreview (journal.goal words per day).
- Copy: "Mood constellation"; "Writing and learning: what you think, and what you are getting better at."; "Mind level N".
- Top 3 UX: (1) rings show 0 while loading (looks like failure); (2) summary rings duplicate the heroes on Journal/Learning; (3) hub cards give no direct "write now" action (only a hint to use capture).

## 2. Journal (/journal)
- Purpose: write/read one entry per day, search past entries, mood + writing consistency.
- Files: `pages/Journal.tsx`, `features/journal/{EntryEditor,FocusMode,FinishPanel,WritingHero,MonthMap,MoodChart,MoodPreview,Scale,prefs,prompts,templates,stats,insights,constellation,journalData,useGoalPulse}`, `journal.css`.
- Data read: `db.journal` (all), prefs (`useJournalPrefs`), player streak target, localStorage `northstar.journal.hidePreviews`. Written: journal rows (text, mood, energy, tags), tasks from "tomorrow top 3" (FinishPanel via `parseTask`), events (journal), word goal pref.
- Actions: type entry (autosave); Another prompt; Write to this; Free write; guided templates; Focus mode (Typewriter / Timer / Step through / Free edit, word goal, session time, Esc, Ctrl/Cmd+Enter next prompt, Done); set Mood, Energy (Scale); tags (max 3 in Finish); Close the day / Skip; prev/next day; Today; date picker; open past entry; Edit / Print on read view; search entries/#tags; tag filter chips; Hide/Show previews; MonthMap day tap; Mood 90d chart + table view; "On this day" lookback open.
- States: loading Skeleton; empty "Past entries will collect here, grouped by month."; search empty "Nothing matches."; no error state; read-only mode for past days (`reading`); ChartFrame hasData gate for mood; power-user = unbounded list (no pagination, `groupByMonth` on all entries). Missing: pagination/virtualisation, save-failed state.
- Gamification: WritingHero ring (days vs weekly target, daily words vs goal; "Weekly target met"), word streak in subtitle, MonthMap "mood constellation" stars, FinishPanel "Day closed", journal XP +20/+10 (xpTable), `useGoalPulse` (pulse when goal met), `celebrate()` via goal pulse.
- Copy: "Day closed"; "Close the day"; "Weekly target met"; "N-day streak"; "Mood constellation".
- Top 3 UX: (1) screen stacks hero + editor + earlier + month map + mood chart: editor is not the only focus; (2) Focus mode is a hidden button ("Focus") with four sub-modes, hard to discover; (3) no pagination on long histories.

## 3. Learning (/learning)
- Purpose: track courses/certs/books on a ladder (planned > active > done), log study time, run focus sessions.
- Files: `pages/Learning.tsx`, `features/learning/{Ladder,ItemCards,ItemModal,FocusSheet,focusStore,focusRun,LogView,useTicker,learningData}`, `learning.css`.
- Data read: `db.learning`, `db.goals`, `db.studySessions`, setting `learning.weeklyTargetMin`. Written: learning items (add/edit/status/progress), study sessions (focus stop, manual log, delete), weekly target, events (completion milestone), focus run store (module-level, survives navigation).
- Actions: Add item; edit weekly target; tabs Ladder/Active/Planned/Completed/Log; Start focus (25/45/60/no target, Begin, Pause, Resume, Stop and log + Undo); FocusChip header reopen; edit item; set status/progress/type/goal link; mark done; add planned/completed; log session (item, minutes, date, note); delete session; deep link `?focus=`.
- States: PageSkeleton; each tab has titled Empty with action; no error state; power-user: no pagination on Completed/Log. Missing: error on persistence, offline focus-run recovery after reload (store is in memory).
- Gamification: weekly study Ring (`tone="mind"`), "target met", focus-run XP (+10 each, 3/day), study XP 1 per 3 min (cap 60), completion lands on Trophies/Achievements as milestone, Ladder metaphor (ladder is a layout, not a stored level).
- Copy: "Ladder"; "target met"; "Start focus"; "Finished items collect here"; "Achievements wall".
- Top 3 UX: (1) five tabs where "Ladder" duplicates Active/Planned/Done; (2) weekly target edit is an ambiguous ghost button; (3) focus state lost on reload.

## 4. Career (/career)
- Purpose: turn daily work into promotion evidence: wins, a featured improvement project, leadership log, 1:1 notes, exportable case.
- Files: `pages/Career.tsx`, `features/career/{CaseMeter,CasePanel,LeadershipPanel,OneOnOnePanel,ProjectPanel,WinsPanel,careerData,caseStrength,caseBuilder,impact,leadership,oneOnOne,projects,useCaseStrength}`, `career.css`.
- Data read: wins (events `win`/`career.win`), projects + prefs (settings), 1:1 notes. Written: wins (events, `#impact` tag), projects (max count), leadership entries, 1:1 notes + follow-up tasks, next 1:1 date, case text (copy/print).
- Actions: Log win (one line); Remove win; Open project / Start a project; edit/save/delete project (baseline/result metrics); Set date / Open notes for Next 1:1; save 1:1; Make task / Done per follow-up; Leadership month list; Case: Copy (toast "Case copied"), Print; CaseMeter "Next to strengthen" one-tap action; "How this is scored" disclosure; tabs Wins/Project/Leadership/1:1 notes/Case.
- States: Skeleton while loading; Empty per tab ("Log your first win in one line. Small ones count."); no error state; power-user = unpaged wins list. Missing: win edit (only remove), pagination.
- Gamification: CaseMeter = HP-style bar with 5 segments ("Promotion case strength"), career XP (win +25, cap 50), Win trophy ladder 1/5/10/30/50/100 (trophies.ts), quest "Log a win" (if career goal).
- Copy: "Promotion case strength"; "Coverage of what a case needs, from your own records"; "Next to strengthen"; "Every part of the case is covered".
- Top 3 UX: (1) hero + featured project + 1:1 card + tabs = dense, tab content below the fold; (2) CaseMeter score meaning needs a disclosure; (3) win cannot be edited.

## 5. People (/people)
- Purpose: keep-in-touch CRM: cadence, due list, circle (orbit) view, birthdays.
- Files: `pages/People.tsx`, `features/people/{PersonRow,PersonModals,CircleView,circle,people}`, `people.css`, `circle.css`.
- Data read: `db.people`, `db.interactions`; localStorage `northstar.people.view`, `northstar.people.lastKind`. Written: person rows, interactions (logContact/undoContact), `lastContact`, events; toast Undo.
- Actions: Add person; Contacted (quick log with remembered kind) + Undo toast; Details > LogPanel (note, date, kind buttons from KINDS, Cancel); Circle/List toggle; open person; PersonDetail (Edit, Delete, Done, delete interaction); PersonForm (name, relation, cadence presets + numeric, birthday month/day); "Reach out to X" button; Everyone else (details, search, cap 60); birthday strip (30d).
- States: PageSkeleton; empty "No one here yet" with action; circle empty hint when no cadence; "Everyone is up to date"; no error state; power-user capped at 60 untracked. Missing: bulk edit, sort control.
- Gamification: people skill XP (+12, 3/day), quest "Reach out to <name>" (overdue), "Reach out" CTA, circle orbit visual (not a game stat).
- Copy: "Your circle"; "Orbits"; "Due now"; "On rhythm"; "Reach out to X".
- Top 3 UX: (1) Circle vs List is a persisted toggle with duplicated info; (2) quick "Contacted" is irreversible except 8s toast; (3) no way to see per-person history without opening the modal.

## 6. You hub (/you)
- Purpose: player card + constellation + next trophies + backup status + links to Trophies/Season/Intel/Interview/Settings/Data/Ontology.
- Files: `pages/YouHub.tsx`, `features/game/ui/{Constellation,Meters,Ring}`, `features/history/TrophyShelf.tsx` (NextTrophyRow), `features/settings/BackupModals.tsx`, `features/you/{you.css,useNextTrophies,trophies}`, `lib/backup.ts`.
- Data read: player state; `db.events` milestone count; `db.reviews` count; settings backup last/encrypted/remind. Written: encrypted backup export (sets last-backup).
- Actions: open each of 7 HubCards; Export encrypted backup (modal, passphrase); open next-trophy links (to /body, /habits, /career, /tasks, /review).
- States: Skeleton for backup; calm hides profile, constellation, next trophies; no error state on export except modal; empty trophies = null (row hidden). Missing: loading for player (shows EMPTY_PLAYER).
- Gamification: LevelBadge 64px + XpBar ("Level N · X XP total"), weeks-in-a-row text, WeekDots, compact non-interactive Constellation, Next trophies (3).
- Copy: "weeks in a row"; "Constellation"; "Next trophies"; "Intel"; "Season".
- Top 3 UX: (1) seven destinations with equal weight, two of them developer-ish (Ontology, Data); (2) backup status competes with profile; (3) Interview card here but the hub strip omits Interview.

## 7. Trophies (/history)
- Purpose: milestone shelf + full timeline of life events + achievements by year.
- Files: `pages/History.tsx`, `features/history/{TrophyShelf,history.tsx,group,history.css}`, `features/you/{trophies,useNextTrophies}`, `lib/useFocusParam.ts`.
- Data read: `db.events` (milestone filter, timeline paged by PAGE), `db.events.get(focus)`. Written: add event (AddEntry: title, date, area, milestone toggle); delete event (removeEvent, with its undo cleanup).
- Actions: Add entry; tabs Timeline/Achievements; search history; area chips; Clear filters; Load more; remove event; area filter on achievements; Add milestone; deep link `?focus=<eventId>` reveals and scrolls; On this day list; Next trophy links.
- States: Skeletons for shelf/timeline/achievements; empty shelf text; "Nothing matches that filter" (Empty + clear); "Nothing here yet"; no error state; power-user paging (Load N more). Missing: error state.
- Gamification: trophy shelf cards (12 newest), rarity word Common/Uncommon/Rare (`trophies.ts: rarity()` by count of same kind: 1=Rare, 2-4=Uncommon, 5+=Common), "New" badge (<=7 days, first of kind), trophy mark in gold, Next trophies rows with progress bar, ladders (workouts 1/10/25/50/100; wins 1/5/10/30/50/100; tasks 10/50/100/250/500; reviews 1/4/12/26/52; weight checkpoints every 5 lb).
- Copy: "Trophy shelf"; "Next trophies"; "Rare"/"Uncommon"/"Common"; "New"; "Your first season recap".
- Top 3 UX: (1) rarity is count-based, so a Rare trophy is just "only one so far" (misleading); (2) shelf shows only 12 and has no "see all" link; (3) page mixes game shelf with a raw activity log.

## 8. Season (/review)
- Purpose: weekly recap + quarter "season" header with boss; ratings trend; past recaps.
- Files: `pages/Review.tsx`, `features/review/{ReviewParts,SeasonParts,WeekInNumbers,RatingsTrend,summary,weekNumbers}`, `features/goals/{boss,BossBar}`, `features/you/season.ts`, `features/insights/InsightsCard`, `review.css`, `goals/quest.css`.
- Data read: `db.reviews`, `db.goals`, `db.tasks`, metric data (`loadMetricData`), week digest, week numbers. Written: review row (ratings, wins, struggles, focusNext, lock => `lockedAt` and `numbers` snapshot), events (review.done).
- Actions: Print; prev/next week; Back to this week; "Review last week" suggestion (Mon/Tue); ReviewForm (ratings, wins, struggles, next-week focus, save, lock); open past recap; Create this season's boss link; story card swipe + dots (phone); Digest (desktop).
- States: Skeletons; "Not reviewed yet" / "Reviewed" / "Reviewed and locked"; empty past recaps; no-boss message; no error state. Missing: error state, unlock path (UI of lock not verified in this pass).
- Gamification: SeasonHeader (quarter name, days left, boss title + BossBar HP + flags, "Boss HP N%" or calm "N% done"), review XP +60, review streak "N-week streak", 5 story cards (phone), trophy ladder for recaps.
- Copy: "Season"; "Boss HP 64%"; "N days left"; "Last day of the season"; "Create this season's boss".
- Top 3 UX: (1) "Season" label for a weekly recap is confusing (page is weekly, header is quarterly); (2) desktop vs phone render different components (Digest vs Stories); (3) boss comes from the first quarter goal only (`pickBosses(...,1)`), no way to choose.

## 9. Intel (/ops)
- Purpose: deterministic, rule-based proposals from the user's data; approve/modify/dismiss/snooze; optional low-risk auto-apply.
- Files: `pages/Ops.tsx`, `features/ops/{proposals,opsActions,NetworkGraph,ops.css}`, `ontology/registry.ts`, `components/{KpiStrip,SidePanel,StatusChip,ModuleTile,Shortcuts}`.
- Data read: `loadOpsSnapshot()` (many tables), registry titles, settings (auto rules, auto log, decisions). Written: applied proposals (task create / mark reviewed etc.), decisions (dismiss/snooze), auto-apply flags, auto-log, undo (24h).
- Actions: filter by object type facets; select proposal; Accept (or "Accept: mark reviewed"); Modify (title/due) > Apply changes; Dismiss; Snooze 1 day; Evidence; Show logic; keyboard j/k/a/e; Network view (details) > open object in Ontology; Auto-apply toggles per rule (disabled if not eligible); Undo recent auto-applied; "Show all types"; Open Tasks (empty).
- States: PageSkeleton; empty "Nothing to review" (rule list); "Everything is filtered out"; error text `ops-error` on apply failure; phone = panel closes after action; desktop auto-selects first. Missing: loading of names.
- Gamification: none by design (KPI strip "Open proposals / Needs approval / Auto-applied this week"; risk groups).
- Copy: "Intel" (renamed from Command; `aka: 'Command'`); "Needs your approval · medium risk"; "Network view".
- Top 3 UX: (1) three-pane layout is dense, needs phone drawer; (2) "Intel" name vs "Proposals" copy; (3) auto-apply controls buried below the queue.

## 10. Settings (/settings)
- Purpose: game layer, encrypted sync, backups, storage, preferences, about/privacy, danger zone.
- Files: `pages/Settings.tsx`, `features/settings/{Sections,GameSection,SyncSection,BackupModals,AddFromFile,settings.css}`, `lib/{backup,encryptedBackup,additiveImport,demo}`, `sync/*`, `features/game/gameSettings.ts`, `components/{density,Shortcuts}`.
- Data read: sync status/enabled, backup last/encrypted/remind days, demo counts, row counts, storage estimate/persisted, `profile.name`, density, `game.*` settings. Written: `game.calm|haptics|sound|motion|weekTarget` (device-local, never synced), `profile.name`, density, backup reminder days, backup files, restore (replace), sync vault/keys, demo rows, erase-all.
- Actions (Game): Calm switch; Haptics switch (fires a test tick); Sound switch (fires a test tick); Motion Full/Reduced; Active days a week select (1-7); Show/Hide XP table. (Sync): Set up sync / Show options; Supabase Project URL + anon key Save; Email + password Sign in / Create account; Passphrase + again Continue; recovery-code confirm (checkboxes + last five chars) Turn on sync; Unlock (passphrase or recovery code, optional new passphrase, stay unlocked); Merge (recommended) / Replace cloud with this device; Sync now; Pause/Resume; Lock; Sign out; Disconnect this device; Delete my cloud data (type DELETE). (Backup): Back up now; Export encrypted backup; Import backup...; Export plain backup (unencrypted); restore confirm "Replace and restore"; reminder setting; Add-from-file (additive). (Data): Ask browser to keep data; Load demo data. (Preferences): display name Save; density; Show shortcuts; Run setup. (Danger): Remove demo data...; Erase all data (type ERASE). Section index nav (7 buttons, IntersectionObserver); `#game` deep link.
- Where Google Calendar and SimpleFIN live: Data hub (see 11), NOT here.
- States: status strip placeholder; sync steps (idle/checking/config/account/create/code/unlock/on); error `set-error`; confirm modals; persisted unknown; browser without storage API message. Missing: loading skeletons per section.
- Gamification: GameSection only (Calm, haptics, sound, motion, week target, XP table with per-rule caps).
- Copy: "XP, levels and daily quests come only from things you already log. Nothing is ever taken away."; "Why do I earn XP?"; "Two rest tokens a week cover days off; a streak never resets in a day."; "Calm mode".
- Top 3 UX: (1) seven long sections on one scroll, Sync flow is a mini wizard in a card; (2) Game toggles live next to security-critical items; (3) "Run setup" and "Show shortcuts" hide in Preferences.

## 11. Data hub (/data) (incl. Google Calendar and SimpleFIN)
- Purpose: one place for every import/feed, status, per-batch undo.
- Files: `pages/DataHub.tsx`, `features/data/{Importers,dataActions,ics,vcf,offSearch}`, `features/gcal/*`, `features/simplefin/*`, `features/packs/PacksPanel.tsx`, `features/finance/{importActions,model}`, `components/{DataTable,KpiStrip,StatusChip}`.
- Data read: settings (finance import records, data import records, OFF opt-in, sync.status, gcal status); counts for transactions, calendar, people, tasks, meals, events. Written: calendar events (.ics import), people (.vcf import), packs, gcal events (read-only sync from Google), SimpleFIN transactions (preview > commit), undo of batches.
- Actions: sources table with per-row action (links or scroll); Calendar import (file); Google Calendar: step guide (Create project, Enable API, consent screen, OAuth client; links open Google), Client ID field, Connect, Sync now, Connect again, Disconnect; Contacts import; SimpleFIN: relay test, token Connect, preview > Commit/Cancel, Sync now, Sync anyway (gated), Disconnect; Packs; Import history Undo (window.confirm).
- States: PageSkeleton; "No imports yet" empty; chip states Off/Connected/Syncing/Error/On; busy states; gated sync. Missing: toast feedback (uses window.confirm).
- Gamification: none.
- Copy: "Sources in use"; "Where it goes: everything is stored in this browser".
- Top 3 UX: (1) integrations setup (OAuth wizard) crammed into a status table page; (2) Undo uses window.confirm (inconsistent with Modal); (3) finance bank CSV import lives elsewhere (Finance), only linked.

## 12. Ontology (/ontology)
- Purpose: developer-facing view of the object model: types, links, actions; browse rows.
- Files: `pages/Ontology.tsx`, `ontology/registry.ts`, `components/{DataTable,SidePanel}`, `features/ops/ops.css`.
- Data read: counts of every registry table; up to 500 rows of selected type; selected row; links via `resolveLinks`, `timelineFor`. Written: action buttons per object (`a.run(row)`), may mutate.
- Actions: View model diagram (phone) / Hide; pick a type in diagram or select; search; select row; row actions (type-specific, error shown); follow links; deep link `?t=&id=`.
- States: Skeleton; empty rows (with Clear search); phone uses SidePanel. Missing: error state for load.
- Gamification: none.
- Copy: "Every object type and how they link".
- Top 3 UX: (1) fixed-size SVG diagram scrolls sideways; (2) row actions can mutate with no confirm; (3) audience is the developer, not the user.

## 13. Interview (/interview)
- Purpose: answer profile questions that seed goals, people, food targets, a VTI holding.
- Files: `pages/Interview.tsx` (re-export), `features/interview/{Interview,questions,apply,interview.css}`.
- Data read: setting `PROFILE_KEY`. Written: same setting on each field blur; on Apply: goals, people, food targets, investments (idempotent).
- Actions: choose section tab (You, Rhythm, Career, Body and food, Money, People); answer choice/multi/long/number/text; Apply my answers; Copy answers (clipboard).
- States: PageSkeleton while loading; "Nothing new to apply yet..." message; copy-failed message; disabled buttons when no answers. Missing: no confirmation preview of what Apply creates.
- Gamification: progress bar "N of M answered". Copy: "Answer questions so Northstar fits you"; "Put it to work".
- Top 3 UX: (1) 30+ questions with no "what will be created" preview; (2) answers autosave on blur, silent; (3) hidden from hub tab strip (only a You-hub card + FirstRunCard).

## 14. Setup wizard + first-run card + demo card
- Purpose: guided onboarding (7 skippable steps) + checklist card on Today + sample data.
- Files: `features/onboarding/{SetupWizard,SetupSteps,setupActions,setupLogic,FirstRunCard,DemoCard(unused),demoActions,onboarding.css,setup.css}`, `lib/demo.ts`, `components/BottomSheet`.
- Data read: counts of tasks/goals/tx/meals/people/habits, settings `onboarding.dismissed`, demo flag, backup last, sync.enabled, setup done. Written: goals, habits, budgets, food targets, people, learning items, first tasks, weekly target; `setup.done`; demo rows; `onboarding.dismissed`.
- Actions: FirstRunCard: Start/Run again setup, Open Interview, links to Tasks/Goals/Finance/Food/People/Settings, Load demo data, Start blank. Wizard: Back, Next/Skip, per-step Add, Done, summary links. Demo: load (confirm if data exists), remove (Settings).
- States: card hidden when dismissed, demo present, or 15+ rows; progress "N of 9"; duplicate/invalid results (`AddResult`). Missing: wizard resume state, DemoCard dead code.
- Gamification: none (checklist ticks only).
- Copy: "Getting started"; "Everything stays on this device."
- Top 3 UX: (1) two parallel onboarding paths (Setup wizard vs Interview) in one card; (2) disappears when 15 rows exist, even if steps incomplete; (3) demo/blank choice appears after the long checklist.

## 15. Capture bar / orb
- Purpose: one-line natural capture for task / expense / meal / weight / win / journal; phone sheet with quick-log prefixes.
- Files: `components/QuickCapture.tsx`, `components/Shell.tsx` (TopBar, CaptureSheet, CaptureHost, TabBar orb), `lib/capture.ts`, `features/tasks/captureSave.ts`, `features/bulk/*`, `components/BottomSheet.tsx`.
- Data read: active goals (for `#` tag matching). Written: tasks, transactions, meals, weights, wins/events, journal (all via `saveCapture`, undoable 6s).
- Actions: focus with `/` or Ctrl/Cmd+K (palette now takes Ctrl+K); type; Enter submits; Esc clears; live preview chips; Undo; Add many (bulk); phone orb opens sheet; quick logs Weigh-in/Meal/Win/Journal seed text; PWA shortcut `?capture=1`; palette "New task".
- States: empty hint chips ("/"); preview chips; saved label with Undo; parser `empty`. No error state if save returns null (silent).
- Gamification: indirect (each capture feeds XP/quests; no direct feedback at capture time).
- Copy: placeholder "Capture: call mom fri !1 #career"; "One line: a task, $12 lunch, w 182.4...".
- Top 3 UX: (1) syntax discoverability depends on placeholder; (2) silent failure; (3) desktop bar competes with search trigger and sync chip in the topbar.

## 16. Global search (command palette)
- Purpose: Ctrl/Cmd+K: actions, page jump, record search with deep links.
- Files: `components/CommandPalette.tsx`, `lib/search.ts`, `components/Shell.tsx` (PaletteHost, SearchButton), `components/useFocusTrap.ts`, `lib/useFocusParam.ts`.
- Data read: tables Tasks, Goals, Habits, People, Journal, Food, Learning, Finance, Calendar, History (cap 2000 rows each, 5 per group, 30 total, typo tolerance). Written: only density/backup navigation actions.
- Actions: open (button or Ctrl/Cmd+K); type; Up/Down/Home/End/Enter; Esc; actions New task, Add many items, Export or restore backup, Switch density, Keyboard shortcuts; Go to (22 pages incl. old names via `aka`).
- States: "Searching", "No results", "N results"; empty query shows Actions + Go to. No error UI (errors collapse to no results).
- Gamification: none. Copy: "Search or jump to...".
- Top 3 UX: (1) Journal search results show text snippets (privacy on shared screens); (2) no recent items; (3) page names differ from old names (aka handles it).

## 17. Shell / navigation (desktop rail, bottom tabs, mission rail)
- Purpose: IA v3: Today / Plan / Skills / You hubs, top bar context, player strip, rail pips, right mission rail.
- Files: `App.tsx`, `components/{Shell.tsx,nav.ts,HubLayout.tsx,shell.css,Icons.tsx,BottomSheet.tsx,UpdatePrompt.tsx,Shortcuts.tsx,Toast.tsx}`, `features/game/ui/{Mission,PlayerProvider,MomentHost}`, `index.css` (shell block ~200-300).
- Data read: player state, `sync.status`, route. Written: none (hub last-path in module memory `lastInHub`).
- Actions: Rail links (Today, Plan, Constellation, Body, Money, Mind, Career, People, You Overview/Trophies/Season/Intel/Settings/Data); phone TabBar (Today, Plan, orb, Skills, You) with "re-tap goes to hub overview"; hub tab strips + sub-strips (Body: Weight/Food; Mind: Overview/Journal/Learning); skip link; Search trigger; SyncChip to Settings; mission rail links (/skills, quests, "Why do I earn XP?"); PlayerStrip -> /skills; View Transitions cross-fade for nav links; update prompt; shortcuts overlay (`?`).
- States: calm removes mission rail + pips + strip; mission rail only >=1280px; skeleton fallback `PageFallback`; no offline indicator beyond Sync chip.
- Gamification: rail level pips (`LevelBadge` 22px), PlayerStrip (phone), MissionRail (level, today's quests, weekly streak dots, recent XP), MomentHost overlay.
- Copy: "Northstar level"; "Weekly streak"; "Recent XP"; "Today's quests"; "Constellation"; "Skills".
- Top 3 UX: (1) rail has two nav models (Skills group vs You group labelled "Overview"); (2) Ontology/Interview have no rail entry; (3) Mission rail absent below 1280px so desktop-narrow users lose it.

---------------------------------------------------------------------------------------------------

# PART 2: GAMIFICATION INVENTORY

Engine: `features/game/engine/*` is pure and derived (nothing stored): `snapshot.ts` (reads Dexie), `derive.ts` (gains), `xpTable.ts`, `levels.ts`, `quests.ts`, `streaks.ts`, `player.ts` (buildPlayer), `util.ts`. UI: `features/game/ui/*`. Device-local prefs: `game.*` settings (`gameSettings.ts`).

| Element | Renders in (files) | Data driving it | User-facing copy | Re-expressible without touching data? |
|---|---|---|---|---|
| XP total | `Meters.tsx` XpBar; `Mission.tsx` (rail, strip, TodayXp); `YouHub.tsx`; `SkillsHub.tsx`; `MindHub.tsx` | derived: `deriveFull` gains from tasks, habits, weigh-ins, meals, journal, study, events, goals, reviews, contacts, balances, budgets; per-kind daily caps in `xpTable.ts` | "Level N", "X / Y XP", "+N XP today", "Level N · X XP total", "Recent XP" | Yes (pure display of PlayerState) |
| Levels (overall + per skill) | `Ring.tsx` LevelBadge in rail pips, StripPlayer, MissionRail, hubs, You | `levelInfo()` curve: level n costs 100*n XP | "Northstar level", "Mind level 3", "Level up" | Yes |
| Skills (5) | `types.ts` SKILLS; `SkillsHub.tsx`; rail pips; hub cards | `skillForArea`, goal area, fixed skill per XP kind | Body, Money, Mind, Career, People | Yes (labels/colours); skill assignment per XP kind lives in engine (not UI) |
| Constellation | `Constellation.tsx` (Skills hub full, You compact, moment sky); star-key buttons, table view | per-skill level -> star scale to level 12 | "Point at or pick a star. Every logged weigh-in, win, entry and contact brightens one."; "Table view" | Yes |
| Daily quests (3-5) | `Mission.tsx` MissionBoard (Today), MissionRail; `QuestCard.tsx`; `quests.ts` | generated from snapshot: weigh-in, protein/calories, workout, journal, win, contact, money, task, padded habits; auto-complete from day gains | "Today's missions", "N to go. They complete themselves as you log.", "Weigh in", "Hit your protein" | Yes (UI); quest set is engine |
| Quest completion moment | `QuestCard.tsx` (check draw, ring pulse, XP count-up, 900ms), `game.css` q-draw/q-pulse | false->true flip observed in card | "+N XP" | Yes |
| Day cleared | `Mission.tsx` ("Day cleared", is-cleared), `MomentHost.tsx`, `moment.ts`; +30 bonus XP | all quests done; `clearedDays()` | "Day cleared", "Every quest is done. Anything else today is a bonus." | Yes (UI); bonus XP engine |
| Week cleared | derive.ts week-clear (+120) | weekly target met | "Week cleared" (XP table, reasons list) | Yes |
| Weekly streak + week dots | `Meters.tsx` WeekDots; Mission board/rail/strip; You hub; MindHub/Journal target | `computeStreak`: active day = >=20 XP; target `game.weekTarget` (default 5) | "N of M active days", "N weeks in a row" | Yes |
| Rest tokens | `Mission.tsx streakLine`; `streaks.ts` REST_TOKENS_PER_WEEK=2 | cover missed days to hit target | "N rest tokens"; settings: "Two rest tokens a week cover days off" | Yes (copy); logic in engine |
| Moments (level-up/skill-up/day cleared) | `MomentHost.tsx`, `moment.ts`, `game.css` .moment (blurred bar, reward border, bright mini constellation) | diff of PlayerState vs baseline; never on load or calm | "Level up", "Skill up", "Day cleared" kicker/title/sub | Yes |
| Toasts (general) | `Toast.tsx`, `toastContext.ts` (42 call sites) | action results with Undo | "Logged <kind> with <name>", "Case copied" | Yes (not game; shared) |
| Season (quarter) | `Review.tsx` + `SeasonParts.tsx` SeasonHeader; `season.ts` | calendar quarter of today | "Q4 2026", "N days left", "Last day of the season" | Yes |
| Season boss + HP bar + flags | `Goals.tsx` ("Season bosses"), `BossCard.tsx`, `BossBar.tsx`, SeasonHeader; `boss.ts`, `quest.css` | top active quarter goal; metric/milestones/tasks progress; checkpoint flags (weight every 5 lb) | "Boss HP N%", "N% done" (calm), "Next step" | Yes (UI); HP = 1 - progress |
| Monthly money boss | `MoneyHero.tsx`, `moneyGame.ts` (bossState, noSpendDays), `finance.css` | month spend vs total budget | boss HP/pace in Finance hero | Yes (UI) |
| Campaign list | `Campaign.tsx`, `Goals.tsx` | year/life goals with Ring | "Campaign" | Yes |
| Combo chip | `ComboChip.tsx`, `combo.ts`, `tasks/g2a.css` | 3+ task completions in 10 min, visual only, no XP | "x3" | Yes |
| Trophies (milestone events) | `TrophyShelf.tsx`, `History.tsx` Achievements; events `milestone:true` | `db.events` milestone rows | "Trophy shelf", "Milestones" (calm) | Yes |
| Rarity | `TrophyShelf.tsx`, `trophies.ts rarity()` | count of same-kind trophies: 1 Rare, 2-4 Uncommon, 5+ Common | "Rare", "Uncommon", "Common" | Yes |
| "New" badge | `TrophyShelf.tsx`, `isNewMoment` | first of kind within 7 days | "New" | Yes |
| Next-trophy rows | `TrophyShelf.tsx NextTrophyRow`; `useNextTrophies.ts`; You hub (3), Trophies (5) | event counts (workouts, wins, tasks, reviews) + weight goal checkpoints, ladders in `trophies.ts` | "Your first workout", "N wins logged", "Weight checkpoint: X lb" | Yes |
| Case strength HP-style bar | `CaseMeter.tsx`, `caseStrength.ts`, `career.css` | wins, projects, leadership coverage | "Promotion case strength" | Yes |
| Weight path flags / net worth flags | `WeightPath.tsx`, `NetWorthHero.tsx`, `pathModel.ts` | +5 lb / $5k crossings, gold flag once crossed | "Weight checkpoint" | Yes |
| Habit ring / streak | `HabitRow.tsx`, `rings.css`, `useHabitCheckIn.ts` (calls `celebrate`) | habit logs vs perWeek | ring draw/pop animation | Yes |
| Journal writing ring / mood stars / streak | `WritingHero.tsx`, `MonthMap.tsx`, `MoodPreview.tsx`, `useGoalPulse.ts` | journal rows, word goal, week target | "Weekly target met", "Mood constellation" | Yes |
| Study ring | `Learning.tsx WeekTarget`, `MindHub.tsx` | study minutes vs target | "target met" | Yes |
| Food macro rings / streak | `MacroRings.tsx`, `ringMath.ts`, `food.css` mring-pulse, `WeekView.tsx` dayStreak | meals vs targets | ring pulse | Yes |
| Number roll (count-up) | `components/motion.ts useNumberRoll` (XpChip, TodayXp, XpBar, BodyHero, hero numbers) | any number change | none | Yes |
| Calm mode | `PlayerProvider.tsx` (data-calm, no engine), `GameSection.tsx`, every `p.calm` guard (Mission, Rail pips, PlayerStrip, TrophyShelf, SkillsHub, YouHub, MindHub, Goals boss, SeasonHeader) | `game.calm` setting | "Calm mode: Hide levels, quests, XP and moments." | n/a (it is the opt-out); keep as a switch |
| Haptics | `lib/haptics.ts` via `feedback.ts celebrate()` (QuestCard, MomentHost, HabitRow, goal pulse) | `game.haptics` (default off); navigator.vibrate 10ms / [12,70,12] | "Haptics: A light tick when a quest completes, a double tick on a level-up." | Yes (patterns are constants) |
| Sound | `lib/sound.ts` (WebAudio 1320/1760Hz, 60ms, gain 0.05) | `game.sound` (default off) | "Sound: A tiny synthesized tick" | Yes |
| Motion Reduced | `PlayerProvider.tsx` (data-motion), `motion.ts prefersReducedMotion` | `game.motion` + OS prefers-reduced-motion | "Reduced turns off springs, count-ups and moments" | Yes |
| XP table transparency | `GameSection.tsx`, `xpTable.ts` | `XP_TABLE` | "Why do I earn XP?" | Yes |
| Gold "reward" hue | `index.css` --reward*, --grad-reward; used on XP bar, level rings, trophy mark | tokens | none | Yes (tokens only) |
| Skill hues | `--skill-body|money|mind|career|people`, rail pips, quest rings, tiles | tokens | none | Yes |
| Daily find / insights | `DailyFindLine.tsx`, `InsightsCard.tsx` | rules over snapshot | "Insights" lines | Yes (not XP) |
| Progress sentences ("Weekly target met", "Everyone is up to date") | many | derived counts | various | Yes |

Tuning notes: engine UI binding is one object, `PlayerState` (`game/types.ts`). Re-skinning needs no data change anywhere except quest set, XP rules and caps (`xpTable.ts`, `quests.ts`) and skill assignment.

---------------------------------------------------------------------------------------------------

# PART 3: STACK + STYLES

Stack: Vite 8 + React 19.3 + TypeScript 7 (`tsc -b`), react-router-dom 7 **HashRouter**, Dexie 4 + dexie-react-hooks (`useLiveQuery`), recharts 3, papaparse, @supabase/supabase-js (opt-in E2E-encrypted sync), vite-plugin-pwa, fonts self-hosted (Inter, Fraunces variable), vitest + fake-indexeddb, Playwright e2e, oxlint. No Tailwind, no CSS-in-JS.

File structure: `src/App.tsx` (routes), `src/db.ts` (schema, versions), `src/pages/*` (23 route pages, lazy), `src/features/<module>/*` (UI + pure logic + css + tests), `src/components/*` (shell, ui primitives, nav, motion, density), `src/lib/*`, `src/sync/*`, `src/ontology/registry.ts`, `docs/design/*`, `site/` (marketing, shares tokens), `supabase/`.

Routing (HashRouter, all lazy except shell): `/` Today; Plan hub `/plan /tasks /planner /goals /habits`; Skills hub `/skills /body /interview /food /finance /mind /journal /learning /career /people`; You hub `/you /history /review /ops /settings /data /ontology`. `HubLayout` adds tab strip + sub-strip; `RouteFade` keyed by path. Names in nav.ts differ from paths (Trophies=/history, Season=/review, Intel=/ops).

CSS organisation: `src/index.css` (876 lines) = tokens (`:root` lines 10-165) + base + components + layout + an appended "Aurora layer" (lines 730-860, wins by cascade order) + polish. 41 other CSS files: one per feature (`features/<x>/<x>.css`, plus `g2a.css`/`g3.css` generation-named extras in tasks, today, planner, g3), `components/shell.css`, `lib/focusFlash.css`, `game/ui/game.css`. Imported from the component/page that uses them (no cascade layers, no CSS modules). Design docs: `docs/design/{aurora,system,game-direction,audit,polish-notes,phase-brief,site-system,site-v3-critique}.md`, screenshots in `docs/design/shots*`.

Token names (all in `index.css :root`):
- Colour: `--page --bg --surface(-1/-2/-3) --line --line-soft --line-strong --ink --ink-2 --ink-3 --ink-disabled --accent --accent-ink --accent-soft --accent-text --accent-hover --accent-pressed --accent-line --accent-ring --good --warn --info --good-soft --warn-soft --data-1..6 --reward --reward-2 --reward-ink --reward-soft --reward-line --skill-body|money|mind|career|people --scrim`.
- Glass: `--glass-bg --glass-bg-hover --glass-bg-strong --glass-bg-bar --glass-sheen --glass-border --glass-border-hover --glass-edge --glass-blur --glass-shadow`.
- Glow/aurora: `--glow-violet --glow-indigo --glow-slate` (aliases `--aurora-amber|violet|teal`).
- Gradients: `--grad-violet|indigo|slate|teal|rose|sky|amber|reward --grad-sheen-hover|press --grad-ink`.
- Radius: `--radius 8 --radius-sm 6 --radius-xs 4 --radius-modal 10 --radius-tile 10 --radius-pill 999px`.
- Shadow: `--sheet-shadow --shadow-pop --shadow-overlay --glass-shadow --glass-edge`.
- Motion: `--ease --ease-out --ease-in --ease-spring --ease-spring-soft --t-fast 120 --t-panel 180 --dur-fast 120 --dur-base 200 --dur-slow 320 --dur-spring 560 --dur-moment 900`.
- Type/space: `--font --serif --mono --text-label..--text-hero --lh-* --track-* --sp-1..7 --row --pad --gap --fs --ctl-h`.

Off-token counts (grep over 42 CSS files, excluding the `:root` block `index.css:8-166`):
| Category | Count | Detail / top offenders |
|---|---|---|
| One-off colours (hex) | 26 | 25 are print-only / @media print (`index.css:716-725`, career.css:45, finance.css:94-96, journal.css:112-113, review.css:82). Screen one-off: 1 (`index.css:413` `.input:hover` #414857). |
| One-off rgba() | 8 | journal.css:53-64 (6, accent at .18/.38/.62 for heat squares), settings.css:16 (warn .35), index.css:606 `.cp-backdrop` rgba(0,0,0,.6) |
| One-off blurs | 0 | all 14 `backdrop-filter` declarations use `var(--glass-blur)`; 3 literal `blur(` are the token definitions (index.css:133, 769 phone override) |
| One-off radii | 33 px literals (+22 `50%`, 6 `999px`, 9 `inherit`, 5 `0`) | index.css 12 declarations, career.css 6, journal.css 4, learning.css 3, game.css 3, finance.css 3, shell.css 3; values 2px (11), 4px (8), 8px (3), 5px (3), 1px (3), 3px (2), 7px (1) |
| One-off shadows | ~12 | inset 2px accent selection bars (ops, review, tasks, index.css:482/682, shell.css:31), focus rings `0 0 0 2px/1px` (learning.css:26-27, index.css:416, game.css:30), `drop-shadow` journal.css:121; `.row-menu-pop` reuses token |
| One-off easings | 2 | `index.css:738` ease-in-out (dead drift), `lib/focusFlash.css:6` ease-out |
| Hard-coded durations (not `--dur-*`) | ~16 | game.css 380/520/900/60-240ms delays, habits rings 320/380, journal 700, food 700, learning 2.4s, tasks 4s, skeleton 1.4s, focus-flash 2s, aurora 60s, view-transition 160ms (index.css:556) |
| Inline TS colours | 11 occurrences in 6 files | `chartTheme.ts` (6), Body.tsx, finance series/charts, NetWorthHero, WeightPath (chart colours for recharts; expected) |

Animation / easing inventory: 35 `@keyframes` (index.css: sheet-in/out x2, check-pop, check-mark, row-in, fade-in/out, modal-in/out, skel-pulse, route-in, toast-in/out, draw-mark, settle-out, aurora-drift; feature: bar-grow, mring-pulse, q-draw, q-pulse, cst-bright, moment-in/out, h-draw, h-pop, jr-pulse, jr-bar-pulse, focus-breathe, combo-fade, strike, focus-flash). Easings in use: `--ease`/`--ease-out` cubic-bezier(.2,0,0,1) (default), `--ease-in`, `--ease-spring` (.3,1.35,.5,1) for card lift/habit pop, `--ease-spring-soft` (.34,1.3,.64,1) for pulses/moments. JS: `useNumberRoll` ease-out-cubic 600ms, View Transitions API route cross-fade (160ms), `prefers-reduced-motion` zeroes durations globally (index.css:196-199) and `data-motion="reduced"` for the in-app switch.

Backdrop-filter users (and "how many blur at once"):
1. `.card::before` (index.css:743-748) on **every `.card`** (incl. HubCard `card card-interactive`, `.side-panel`)
2. `.side-panel::before`
3. `.topbar::before` (always; sticky)
4. `.tabbar::before` (phone only)
5. `.kpi-cell::before` (index.css:827; one per KPI cell, 3-5 per strip; `.kpi-strip::before` is removed)
6. `.modal-backdrop`, `.sheet-backdrop`, `.cp-backdrop` (index.css:775; one full-screen layer at a time)
7. `.toast` (index.css:778)
8. `.moment::before` (game.css:106; a one-second toast)
Nested cards drop their blur (index.css:745-746). Counts per page (JSX `<Card`/`.card` literals): Today ~5 + HubCards/Mission, You hub 5 + 7 HubCards = 12+, Journal 3-5, People 4, Review 2-6; long pages (Timeline weeks, Goals, Settings 7 sections) can exceed 12 simultaneously visible/mounted. All `.card::before` are mounted even off-screen (the cost is paint/compose of those in the viewport; the design cap "about 12 blurred elements in view" (aurora.md rule 3) is not enforced anywhere). Sidebar and mission rail are NOT blurred (background tint only, index.css:761, game.css:121). Fallbacks: `@supports not (backdrop-filter)` (845) and `prefers-reduced-transparency` (849-856) swap to solid `--surface-1`.

---------------------------------------------------------------------------------------------------

# PART 4: WHY THE GLASS READS FLAT

1. **The backdrop is almost flat, so blur has nothing to refract.** Page `--page:#0b0b10` (index.css:11) with only three radial glows at alpha .15/.13/.11 that fade to transparent by 72% (index.css:118-120), fixed to the viewport (`body::before`, index.css:737). Peak composite behind a card is about `#1c1a32`; most of the page is `#0b0b10`, so total backdrop dynamic range is roughly 17-40 levels. Blur of a smooth gradient is a visual no-op. No content ever sits behind a card (cards sit on the page, not over each other or over imagery).
2. **Ambient layer is static and dull; the drift is dead code.** `[data-aurora-drift]` (index.css:738) is set nowhere in TS/TSX, so the only motion in the backdrop is none. No colour variety: one violet, one indigo, one slate.
3. **Glass is on every card instead of only the chrome layer.** `.card, .kpi-strip, .side-panel` all get the same 5% tint + blur (index.css:743-748), plus KPI cells (826-827), hub strip (shell.css:22), nested cards flatten onto the parent (745-746). Everything has identical translucency, so there is no hierarchy between chrome (should be glass) and content (should be solid-ish) and no layered depth.
4. **Surface is too close to the page.** `--glass-bg: rgba(255,255,255,.05)` (index.css:125) on `#0b0b10` composes to about `#18181e`: a lift of ~13 levels. Border `rgba(255,255,255,.10)` (130) is the only separation. Card edges and background are nearly the same luminance.
5. **No rim gradient.** Border is one uniform colour (`--glass-border`, 130; `border-color` set at 743). A glass rim should be brighter at the lit corner and dim at the opposite one (gradient border via `border-image` / mask / two-layer background). Nothing like it exists.
6. **No specular / top-edge light beyond a hairline.** `--glass-edge: inset 0 1px 0 rgba(255,255,255,.09)` (132) is a 1px top line only; `--glass-sheen` is 5.5% white to transparent at 135deg (126), too faint to see against 5% base. No inner glow, no bottom inner shadow, no highlight blob.
7. **No outer depth on cards.** Cards use only `box-shadow: var(--glass-edge)` (743). `--glass-shadow` (134) is reserved for modal/sheet/toast (776, 778). Without a drop shadow cards cannot read as floating over anything.
8. **Saturation/brightness boost is minimal and dropped on phone.** `--glass-blur: blur(14px) saturate(115%)` (133), then `blur(14px)` only at <=819px (769). No `brightness()`, no contrast; blur radius 14px over a flat colour is invisible.
9. **Blur element is behind the card's own tint and does nothing with the aurora.** `.card::before` (747) sits at `z-index:-1` (743-748); with the stacking context of `.route-view` (animation, index.css:553) the effective backdrop is the same flat page. Needs verification in-browser, but with causes 1-2 it cannot matter.
10. **Chrome is almost opaque, so the only element that overlaps moving content shows nothing.** `.topbar` uses `--glass-bg-bar: rgba(16,16,22,.88)` (129, 762) and `.tabbar` the same (770): 88% opaque, so scrolling content behind it is barely visible. Overlays: scrim is `rgba(0,0,0,.6)` (index.css:606) darkening the backdrop before blur; the panel is `rgba(22,22,30,.76)` (128). Even where blur has content (modals), black dims it.
11. **Sidebar and mission rail have no blur and no content behind them.** Tint only (index.css:761; game.css:121), so the two big chrome areas are flat panels.
12. **Fallback may be silently active.** `@media (prefers-reduced-transparency: reduce)` (849-856) and `@supports not backdrop-filter` (845-848) replace glass with solid `--surface-1` (#14141b) and remove the blur layers. On a Windows machine with Transparency effects off this is the whole app. Needs check on the owner's device.
13. **Uniform radius and the same hover for every glass thing.** `--radius: 8px` (40) for everything, `.card-interactive:hover` lifts 2px (755): no visual language distinguishing floating vs inset surfaces.
14. **Colour is flat inside the glass too.** Rows, tables, chart plots sit on the card with no glass (by design, aurora.md), and accent gradient tiles are tiny (36px), so there is no large saturated shape to make the glass legible. Tokens exist for six gradients but only used on 36px tiles, the primary button and progress fills.
15. **Contrast-first guardrails cap the effect.** aurora.md guardrails 1-2 cap glow alpha <= .14 and require AA over the worst composite; the result is a design intentionally under-lit. Raising realism needs either a brighter/more varied backdrop under cards (e.g. soft colour blobs with alpha .25-.4 behind the content column, anchored to the scroll container not the viewport) or fewer, larger glass surfaces (chrome only).

---------------------------------------------------------------------------------------------------

# REGRESSION ITEMS B

- Nav: rail links (Today, Plan, Constellation, Body, Money, Mind, Career, People, Overview, Trophies, Season, Intel, Settings, Data) navigate and show active state
- Nav: phone tab bar (Today, Plan, Skills, You) with re-tap-goes-to-overview and last-page-in-hub memory
- Nav: capture orb opens the capture sheet; sheet has quick logs Weigh-in/Meal/Win/Journal
- Nav: hub tab strips and Body/Mind sub-strips; Ontology is only reachable via You hub / Data
- Nav: skip link focuses main; View Transition cross-fade on nav-link click; document title "<Page> | Northstar"
- Nav: Mission rail >=1280px (level, quests off-Today, weekly streak, recent XP, "Why do I earn XP?" link); hidden in Calm
- Nav: phone PlayerStrip opens /skills; hidden in Calm and while loading
- Nav: Sync chip links to Settings with state label
- Capture: `/` focuses bar; Ctrl/Cmd+K opens palette (not bar); Enter saves task/expense/meal/weight/win/journal; Esc clears; preview chips; Undo within 6s; Add many opens bulk
- Capture: `?capture=1` PWA shortcut; palette "New task" focuses bar (desktop) / opens sheet (phone)
- Search: palette opens/closes (Esc, backdrop), arrows/Home/End/Enter, groups, deep links with `?focus=`, "No results", actions (New task, Add many, Backup, Density, Shortcuts), Go to pages with old names
- Shortcuts: `?` overlay; j/k/Enter/x on Tasks; j/k/a/e on Intel; Journal focus Esc/Ctrl+Enter
- Mind hub: writing-days ring, study ring, mood constellation preview, Journal and Learning cards with live stats, level card hidden in Calm
- Journal: write+autosave, prompts (Another prompt, Write to this, Free write), templates, Focus mode (Typewriter/Timer/Step through/Free edit, word goal, Done, Esc), mood/energy, tags, Close the day / Skip (tomorrow top 3 -> tasks), prev/next/Today/date picker, read-only past view with Edit/Print, search + tag filter, hide previews (localStorage), MonthMap tap, mood chart + table, On this day, WritingHero, `?focus=<date>`
- Learning: add/edit item, status tabs (Ladder/Active/Planned/Completed/Log), weekly target edit, progress/goal link, Start focus (25/45/60/none, Begin/Pause/Resume/Stop and log + Undo), FocusChip reopen, manual session log, delete session, completion -> Achievements, `?focus=<id>`
- Career: log win (+ #impact), remove win, CaseMeter next action, featured project before/after, project CRUD, Next 1:1 date + notes + follow-up tasks (Make task/Done), leadership month list, Case copy/print, tabs
- People: add/edit/delete person, cadence presets + custom, birthday, Contacted quick-log + Undo toast, Details log (kind/note/date), Circle/List toggle (persisted), reach-out CTA, birthdays strip, Everyone else search (60 cap), delete interaction, `?focus=<id>`
- You hub: LevelBadge/XpBar/weeks in a row/WeekDots, compact constellation, Next trophies (3), backup status + Export encrypted backup modal, 7 HubCards with live stats, Calm hides game cards
- Trophies: shelf (12 newest), rarity words, New badge, next-trophy rows with links, Add entry (title/date/area/milestone), Timeline search/area chips/clear/Load more/remove, Achievements by year, On this day, `?focus=<eventId>`, Calm shows "Milestones" without rarity
- Season: SeasonHeader (quarter, days left, boss HP/flags, calm % done), prev/next week, Back to this week, suggest last week Mon/Tue, ReviewForm save/lock, Week in numbers, Digest (desktop) / Story cards (phone), insights week, ratings trend, past recaps, Print
- Intel: facet filter, select/Accept/Modify/Dismiss/Snooze/Evidence/Show logic, j/k/a/e, Network view -> Ontology, Auto-apply toggles + log + Undo (24h), KPI strip, empty states
- Settings Game: Calm, Haptics (test tick), Sound (test tick), Motion Full/Reduced, Active days a week, XP table show/hide, `#game` deep link
- Settings Sync: set up (config -> account -> create keys -> recovery code -> on), unlock (passphrase / recovery), merge/replace restore choice, Sync now, Pause/Resume, Lock, Sign out, Disconnect device, Delete cloud data (type DELETE)
- Settings Backup: Back up now, Export encrypted, Import backup (replace confirm), plain export, reminder days, add-from-file additive import
- Settings Data/Prefs/About/Danger: storage persist request, demo load (confirm), display name, density, shortcuts, Run setup, Remove demo data, Erase all (type ERASE), status strip, section index scroll-spy
- Data hub: sources table + statuses, Calendar .ics import, Contacts .vcf import, Google Calendar (steps, client id, connect, sync, reconnect, disconnect), SimpleFIN (relay test, connect, preview/commit, sync, sync anyway, disconnect), Packs, import history Undo
- Ontology: type picker, search, row select, links, row actions, model diagram, `?t=&id=` deep link, phone SidePanel
- Interview: six section tabs, all question types, autosave on blur, Apply (idempotent), Copy answers, progress
- Onboarding: FirstRunCard visibility rules (dismissed/demo/15+ rows), 9 steps, Start blank, Load demo data, Setup wizard 7 steps + summary, `setup.done` flag; DemoCard is unused
- Game: XP derivation + caps, levels curve, skills, daily quests (+ auto-complete), Day/Week cleared bonuses, weekly streak + rest tokens, moments (level-up/skill-up/day cleared; never on load, never in Calm), quest completion animation, number roll, haptics, sound, reduced motion, Calm mode
- Game: season boss HP/flags (Goals + Season), money boss, case meter, weight/net-worth flags, combo chip, trophy rarity + New, next-trophy ladders
- Styling: `prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors`, print styles, forced `[data-calm]`, `[data-motion]`, density compact (>=820px)
