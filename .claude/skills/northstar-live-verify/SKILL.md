---
name: northstar-live-verify
description: Use when checking or operating the deployed Northstar app in the owner's real Chrome, or testing a new feature in a real browser - safe procedure, known freezes, and when to use an isolated browser instead
---

# Live verification (real browser) without hurting real data

The owner's REAL data lives in IndexedDB at https://123456789eleven.github.io (app at /northstar/app/). Treat that origin as production.

## Choose the browser
- **Throwaway profile (default for testing):** `tools/qa.mjs` or the Playwright MCP (`--isolated`): demo data only, safe to click anything, destructive flows allowed.
- **Owner's real Chrome (Claude in Chrome):** only to do something the owner asked in their real app (import a file, add a bill) or to look at the live site. Never click Erase, Delete cloud data, Remove demo, Disconnect, Sign out, or "Import backup" (replaces everything) without explicit owner approval in chat.

## Procedure in the real Chrome
1. `tabs_context_mcp` first; make a new tab (do not reuse tabs); close it when done.
2. Stale app after a deploy: clear ONLY service workers and Cache Storage via javascript_tool, then reload. Never touch IndexedDB or localStorage.
3. Prefer batches (`browser_batch`), `find` plus `ref` clicks, and `javascript_tool` with a native value setter for React textareas (dispatch `input`).
4. File picker: use `file_upload` on the hidden `input[type=file]` ref; the path must be a file the owner shared.
5. Verify with text where possible (javascript_tool innerText) and a small screenshot; confirm counts before clicking an irreversible button.

## Known failure
The extension tab froze ("renderer may be frozen", screenshot timeouts) when Chrome treated the window as hidden; it recovered when the owner looked at it. After two timeouts stop retrying, tell the owner to bring that Chrome window to the front, and meanwhile reproduce in a throwaway profile to rule out an app bug.

## Never
Open the owner's other tabs or sites, read their sign-ins, type passwords or tokens, or leave tabs open.
