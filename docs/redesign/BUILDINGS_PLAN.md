# Inside the buildings

Owner (2026-11-11): "Build what's inside the city: what is inside each building, what gets done, how it is fun to use. Do away with unnecessary tabs, duplicates and excessive wording. Sleek, simple, easy to look at. We can make this huge."

## Idea
Home is the city. Each district is a **building you walk into**. Entering zooms the camera into the building and the screen becomes its interior. Inside there are **floors** (not tabs). One floor = one job = one hero + at most three supporting items. Moving between floors feels like an elevator.

## Rules for every floor
- One hero. Max 3 supporting items. Everything else behind a single "More" row.
- Words: labels under 4 words, one short line of context at most, no paragraphs. Detail lives in a tap or tooltip.
- One-tap main action, visible without scrolling on phone (390) and desktop (1440).
- Every floor has a tiny loop: act, see it move (ring, path, building), get a real number back.
- No duplicate screens: if two pages show the same thing, one goes (keep the feature, merge into the floor).
- Fun comes from motion and progress, not decoration: counts, paths, rising bars, one subtle moment, gold only for earned.
- Each building has a **stage meter** (5 stages) tied to real progress. The building in the city grows with it (lit floors, extra tower). The header shows the stage and what is next.

## Buildings and floors
| Building | Floors (what gets done) |
|---|---|
| Bank (Money) | **Lobby**: safe to spend, net worth path, form guide. **Vault**: budgets and bills as envelopes that fill, no-spend days. **Trading floor**: watchlist, portfolio, live ticks. **Academy**: practice account and lessons. **Archive**: transactions, import, records. |
| Gym (Body) | **Weigh-in**: path to goal with 5 lb flags. **Kitchen**: calorie and protein rings, meals, favourites. **Training**: lift habit and sessions. |
| Library (Mind) | **Journal**: write, mood. **Study**: courses, focus timer. |
| Office (Career) | **Wins**: log a win. **Case**: promotion case strength. **Projects**. |
| Park (People) | **Tree**: your people. **Reach out**: who is waiting, starters, quick actions. |
| Town hall (Plan) | **Today**: the plan. **Tasks**, **Planner**, **Goals**, **Habits**. |
| Home base (You) | **Scoreboard**: standing, records, highlights. **Milestones**: badges and timeline. **Season**: weekly recap and share. **Settings**: settings, data, sync, backup, power tools (Intel, Ontology). |

## Remove or merge
Money groups and sub-tabs become floors; Overview/Wealth duplicates merge; "Spending detail" folds into Archive. Areas hub goes (the city is the overview). Body, Food and Training pages merge into one building. Plan hub overview duplicates Today and goes. Milestones logbook and timeline merge. Mind hub overview goes. Intel and Ontology move under Settings > Power tools. Every route stays working via redirect; no feature is deleted.

## Phases (commit after each; tick here)
- [x] B1 Foundation: floors in `districts.ts` (routes to floors), `BuildingFrame` replaces `DistrictFrame` (floor selector: vertical elevator on desktop, pill row on phone; enter animation; header with stage meter), stage model (pure, tested), redirects for merged routes. Done: `Floor`/`floors`/`building`/`floorForPath`/`FLOOR_ALIASES` in `districts.ts`; `BuildingFrame.tsx` + `building.css` (elevator with sliding lit car, arrow keys, floor slide up/down, building rise, backdrop zoom in `CityBackdrop`); `features/buildings/stage.ts` + `useBuildingStage.ts` + `StageMeter.tsx` (Gym only so far; other buildings return null until their phase); `/training` floor; Money keeps in-page tabs (`elevator: false`) until B3.
- [ ] B2 Reference building: Gym (Weigh-in, Kitchen, Training) fully reworked to the rules, with screenshots.
- [ ] B3 Bank (Money): five floors.
- [ ] B4 Town hall (Plan) and Park (People).
- [ ] B5 Library (Mind) and Office (Career).
- [ ] B6 Home base (You): Scoreboard, Milestones, Season, Settings.
- [ ] B7 City reflects stages (buildings grow with the meter); polish pass; word audit; e2e and a11y.

## Rules that stay
Palette: raven black, powder blue, poppy only for behind/overdue, gold only for earned. Privacy rules in CLAUDE.md. No new dependencies. No schema changes unless a phase says so. Tests green before any push. Voice: `docs/redesign/FUN_BRIEF.md`.
