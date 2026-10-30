---
name: northstar-capture-syntax
description: Use when extending the Northstar quick-capture bar (src/lib/capture.ts) with a new one-line syntax - parser, preview, save and undo wiring with tests first
---

# Capture syntax

Files: parser `src/lib/capture.ts` (pure; `parseCapture(input,{now,goals})`, `describeCapture`), save/undo `src/features/tasks/captureSave.ts`, UI `src/components/QuickCapture.tsx`.

Existing: tasks (due words, `!1-3`, `#goal/#area`, `every day|week|month|<weekday>`), money (`$12.50 x`, `+$500 x`), meals (`ate x 350cal`), `win: x`, `journal: x`.

Add one:
1. Test first in `capture.test.ts` (fixed `now` = Wed 2026-05-06 09:00): positive, negative (similar words stay plain tasks), punctuation, priority/tag combos.
2. Prefix/keyword syntaxes must not hijack ordinary sentences (`had to ...` stays a task; abbreviations like sat/wed count as dates only at end of line or after on/by/next).
3. Add the `kind` to the `Capture` union, `describeCapture` preview text, and `saveCapture` (returns an undo that deletes the row AND its event).
4. Only add syntax if it saves typing versus opening a page.
