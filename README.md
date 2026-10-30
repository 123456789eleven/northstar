# Northstar

A personal life operations platform: tasks, goals, habits, planner, finance, food, learning, people, journal, a single history timeline, a weekly review, and a Command page that turns your data into proposals you approve. Installable on desktop and phone.

- Site: https://123456789eleven.github.io/northstar/
- App: https://123456789eleven.github.io/northstar/app/

## Privacy

Your data lives in your browser (IndexedDB) and stays there by default. There are no analytics, trackers or third-party fonts. Three optional connections exist, each off until you turn it on:

| Feature | What leaves your device |
|---|---|
| End-to-end encrypted sync (Supabase) | Ciphertext only. Keys derive from your passphrase and never leave your devices. The server can see your email, row counts per table, timestamps and ciphertext sizes. |
| Google Calendar (read-only) | Nothing of yours. Events are fetched from Google into your browser; Google's script loads only when you click Connect. |
| Open Food Facts search | The search text you type. |

Backups are JSON files you export and import yourself. Details: `site/privacy.html`.

## Develop

```
npm install
npm run dev          # http://localhost:5173
npm run verify       # typecheck + lint + tests + build (run before committing)
npm run build:pages  # site at /, app at /app/ -> pages-dist/
```

Stack: Vite, React 19, TypeScript, Dexie (IndexedDB), recharts, Vitest. No UI framework: design tokens and primitives are in `src/index.css` and `src/components/`. The design system is documented in `docs/design-system.md`; project rules for contributors and agents are in `CLAUDE.md`.

Public build values (Supabase URL and publishable key, Google client ID) are read from `VITE_*` variables; see `.env.example`. Never put a service-role key, database password or any secret in this repo.

Sync setup: `supabase/README.md`. Google Calendar setup: `docs/google-calendar-setup.md`.
