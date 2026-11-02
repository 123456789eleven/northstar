---
description: Screenshot routes at 1280 and 375 widths with the demo dataset; inspect only anomalies
argument-hint: <comma-separated routes, e.g. home,finance>
allowed-tools: Bash(node "C:\Users\bearf\OneDrive\Desktop\The One\tools\qa.mjs":*), Read
---
Run exactly:

`node "C:\Users\bearf\OneDrive\Desktop\The One\tools\qa.mjs" --name shots --routes $ARGUMENTS --widths 1280,375 --demo`

The tool prints one JSON line per route (console errors, hscroll, height). Open a screenshot with Read ONLY for a route that shows console errors, horizontal scroll, or an odd height. Report anomalies per route and width; if none, say "no anomalies" and stop. Add `--skip-build` when re-shooting without code changes. Never run a parallel build.
