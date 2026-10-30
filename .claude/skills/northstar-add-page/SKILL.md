---
name: northstar-add-page
description: Use when adding a page or tab to Northstar - the exact file set, route, nav and style pattern (use northstar-new-module when it also needs a new data table)
---

# Add a page (5 steps)

1. `src/pages/<Name>.tsx`: default export; start with `<PageHeader title sub actions/>`; data via `useLiveQuery(() => db.table..., [])` from `dexie-react-hooks`.
2. Feature code in `src/features/<name>/`: pure logic `<name>.ts` (+ test), components, `<name>.css` imported by the page. Prefix classes (`hab-`, `fin-`) so CSS never collides.
3. `src/App.tsx`: import, add `<Route path="/<name>" .../>`, add to `NAV` (use `section` to start a group). The mobile tab bar reuses NAV.
4. Use `ui.tsx` primitives + index.css classes (`.card .btn .btn-primary .input .chip .list-item .table .grid-2/3/4 .stack .row`). One amber accent, no emoji/gradients, tap targets >= 32px.
5. Empty state that says the exact first action. Verify tier 1-4; screenshot at 375px.

Tabs inside a page: `Tabs` from ui.tsx (labels short; `.tabs` scrolls inside itself).
Tile on Today: add a component in `features/today/` and one import in `pages/Today.tsx`.
