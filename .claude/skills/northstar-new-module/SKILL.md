---
name: northstar-new-module
description: Use when adding a new life-area module (page + data + timeline events) to Northstar - the recipe that keeps modules consistent
---

# Northstar: Adding a Module

1. `brainstorming` -> one-page spec: what is logged, taps-to-log (target <= 2), what feeds Today and Weekly Review, empty-state wording.
2. Schema via `northstar-schema-migrations`; types in `src/db.ts`.
3. Page `src/pages/<Name>.tsx` plus `src/features/<name>/`; route and nav entry in `App.tsx`.
4. Pure logic in `src/features/<name>/*.ts` with Vitest tests written first.
5. Emit `logEvent` for meaningful actions; `milestone: true` only for real achievements; undo removes the event.
6. Add a Today tile and a Weekly Review digest line if it has a weekly signal.
7. Add capture-bar syntax only if it genuinely saves typing.
8. Finish with `northstar-definition-of-done`.
