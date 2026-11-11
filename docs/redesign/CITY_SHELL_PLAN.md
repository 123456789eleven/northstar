# City shell: the whole app as one city

Owner (2026-11-10): "I want the city build pushed to the whole app. Everything connected in the city format so that when you choose something you are on the right city/tab in the layout. This is a big build because it redoes the entire app."

## Idea
Every part of the app is a district of one city. The Life map (home) is the full view. On every other screen the city stays present as chrome, so the person always knows where they are: which district, which tab inside it.

## Districts and routes
| District | Routes |
|---|---|
| Home (overview) | `/`, `/map` |
| Plan (town hall) | `/today`, `/plan`, `/tasks`, `/planner`, `/goals`, `/habits` |
| Money | `/finance` (tabs: Overview, Markets, Cash, Wealth, Academy) |
| Body | `/body`, `/food` |
| Mind | `/mind`, `/journal`, `/learning` |
| Career | `/career` |
| People | `/people` |
| You (home base) | `/you`, `/history`, `/review`, `/ops`, `/settings`, `/data`, `/ontology`, `/interview`, `/skills` |

Pure function `districtForPath(pathname)` plus `subtabForPath` (tested) is the single source of truth.

## Layout (desktop and phone)
1. **District strip** (bottom, curved glass, like the Life map): Home, Plan, Money, Body, Mind, Career, People. The active district is lit; a poppy dot means something behind there. This replaces the phone tab bar and the desktop rail as the primary navigation. The You district is reached from the top bar profile control. Every page stays reachable via district sub-tabs and the Ctrl+K palette.
2. **Mini-map** (top-left on desktop, a compact chip row on phone): a small isometric view of the city with the active district glowing; tap a district to go there.
3. **Backdrop city**: a faint, static city behind page content; the camera pans to the active district when the route changes (spring, reduced motion = instant). Content stays on solid-ish glass so legibility never suffers.
4. **District frame** around every page: a header with the district name and accent, a breadcrumb ("Money / Markets"), then the existing page. Sub-tabs (hub strips, Money groups) sit directly under it.
5. Quiet motion: camera pan and a short slide of the content panel; nothing else.

## Phases (commit after each; update the checklist below)
- [x] P1 `districtForPath` + tests; DistrictStrip replaces TabBar and Rail; top-bar You control; palette and titles unchanged. Done: `src/components/districts.ts` (+ tests), `DistrictStrip.tsx` + `city.css` on every width, You control in the top bar, phone capture orb bottom right (lifted over pinned add lines), Today joins the Plan strip, one shared `LifeMapProvider`; e2e 77/77.
- [x] P2 Mini-map component driven by the same scene model as the Life map (shared, not copied). Done: `CityScene` gained `lite` and civic places (town hall = Plan, home base = You) in `model.ts`; `MiniMap.tsx` (desktop 176x100 chip with 40x32 place hits, phone 64x38 chip to Home) in the page head; placement math in `place.ts` (tested); scene gradients mounted once (`CityDefs`).
- [x] P3 Backdrop city layer with camera following the route. Done: `CityBackdrop.tsx` + `backdrop.css`: lite scene rendered once per model (about 300 SVG elements, no cars), camera is one CSS transform driven by `--px/--py` with `--spring-smooth`; hidden on Home; reduced motion = instant, reduced transparency = solid ground, forced colours/print = off; no poppy in the backdrop.
- [x] P4 District frame (header + breadcrumb) applied to every page; Today, Plan hub, Areas hub, You hub reviewed for density. Done: `DistrictFrame.tsx` is the one layout for every non-home route (replaces HubLayout groups): mini-map, district name with its hue mark, breadcrumb (only when the district has tabs), district sub-tabs from `districts.ts` (Money keeps its in-page tabs, now synced to `?tab=` so the head reads Money / Markets and the strip returns there), 260 ms slide of the page. Areas overview (/skills) now sits under You; the duplicate Areas strip is gone. Dead hub helpers removed from `nav.ts`.
- [ ] P5 (partly done: e2e for strip, breadcrumb, Money tab URL and mini-map; unit tests for districts, place, civic model) e2e/unit updates, a11y (landmarks, focus, labels), reduced motion/transparency fallbacks, performance (cap SVG elements, no redraw on route change)
- [ ] P6 (first pass done on Home, Today, Money, Body, People, Career, Settings at 1440/390) Visual pass at 1440 and 390 on every district; fix inconsistencies. Open: the top bar repeats the district/tab that the frame shows (could drop on desktop); page h1 repeats the district name on single-page districts; phone orb floats over list content.

## Rules
Palette: raven black, powder blue, poppy only for behind/overdue, gold only for earned. No new dependencies. No schema changes. Keep every route, deep link and feature. Tests green before any push.
