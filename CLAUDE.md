# Northstar — personal life dashboard

A local-first web app (installable PWA) for one person: tasks, goals, finances, food, learning, relationships, history/achievements, weekly review.

## Hard rules
- **Privacy: all data stays on-device** in IndexedDB via Dexie (`src/db.ts`). No network calls with user data, no analytics, no third-party APIs, no cloud sync. Backups are user-initiated JSON export/import (Settings). Any feature that would send data off-device needs the owner's explicit approval first.
- Bank data enters only via CSV import the user picks themselves. Never store bank credentials.

## Stack
Vite + React 19 + TypeScript, react-router-dom (HashRouter), Dexie + `dexie-react-hooks` (`useLiveQuery`), recharts for charts, papaparse for CSV. Plain CSS in `src/index.css` — no Tailwind, no CSS-in-JS libraries.

## Architecture
- `src/db.ts` — all types + schema. Every table is declared there. Adding a table/index = bump `db.version(n)` with a new `.stores()` block; never edit a shipped version.
- **Single timeline:** whenever something meaningful happens (task completed, goal done, course finished, budget set, person contacted…), call `logEvent({ area, kind, title, refTable, refId, milestone? })`. `milestone: true` puts it on the Achievements wall. History reads only `db.events`.
- `src/lib/dates.ts` — use these helpers; dates are local `YYYY-MM-DD` strings, timestamps ISO.
- `src/components/ui.tsx` — shared primitives (PageHeader, Card, Stat, Progress, Empty, Modal, Field, Tabs). Use them plus the CSS classes in `index.css` (`.card .btn .btn-primary .input .chip .list-item .table .grid-2/3/4 .stack .row` …).
- One page per route in `src/pages/`. Page-specific components go in `src/features/<module>/`.

## Design rules (owner is sensitive to "AI-generated / tacky" UI)
- Dark only. One accent hue (`--accent`, amber). Color variety only for data in charts.
- No glow blobs, gradients, glassmorphism, emoji icons, dashed badge borders, or a different accent per card.
- Fraunces serif only for page titles and big numbers; Inter for everything else.
- Dense, calm, legible. Cut decoration before adding polish.
- Must work at phone width (≥360px): no horizontal page scroll, tap targets ≥ 32px.

## Input friction is the #1 risk
Design every module so the common action takes ≤ 2 taps or one line of typing (favorites, defaults, quick-add rows, CSV import). Empty states should say exactly what to do first.

## Commands
- `npm run dev` — dev server (also on LAN for phone testing)
- `npm run build` — typecheck + production build
- Typecheck only: `npx tsc -p tsconfig.app.json --noEmit`
