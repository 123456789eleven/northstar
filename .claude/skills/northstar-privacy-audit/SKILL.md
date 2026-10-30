---
name: northstar-privacy-audit
description: Use before releases and whenever code touches storage, imports, networking, dependencies, fonts, or the service worker - verifies no user data leaves the device
---

# Northstar: Privacy & Security Audit

The product promise: **all data stays on the user's device.** Verify it, do not assume it.

## Checklist (run the commands, record output)
- Network: `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.share" src` - every hit must be justified and carry no user data.
- Third parties: `grep -rnE "https?://" src index.html` - fonts/CDNs must not receive user data; prefer self-hosted fonts (Google Fonts leaks IP/referrer, flag it).
- Telemetry/logging: no `console.log` of user content; no analytics SDKs (review `package.json`).
- Untrusted input: CSV and backup JSON are untrusted. Check size caps, type validation, no `dangerouslySetInnerHTML`, no `eval`, spreadsheet formulas never interpreted.
- Service worker: precaches app assets only, never user data responses.
- Dependencies: `npm audit --omit=dev`; justify any new package; prefer none.
- Secrets/PII in repo: `git ls-files | grep -iE "backup|\.json$|\.csv$"` and scan for keys/tokens. Backups and real exports must never be committed.
- Backups: export contains everything and only what the user expects; import cannot partially corrupt data (single transaction).

## Escalate to the owner (never decide alone)
Cloud sync, bank APIs, AI/LLM calls with user data, analytics, sharing, or any hosting of user data.
