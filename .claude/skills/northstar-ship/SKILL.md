---
name: northstar-ship
description: Use to commit, push and deploy Northstar to GitHub Pages and confirm it is live - the whole release in one pass
---

# Ship

Live: site https://123456789eleven.github.io/northstar/ , app `/app/`, repo 123456789eleven/northstar (public). Push to `main` deploys via `.github/workflows/deploy.yml` (verify -> build:pages -> Pages).

1. `northstar-definition-of-done` gates pass; `npm run verify` green. For releases touching data/hosts/sync run `northstar-privacy-audit`.
2. `git add -A 2>/dev/null; git commit -m "<why, not what>` + attribution line from the session reminder`; `git push`.
3. Watch: `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
4. Smoke: `curl -s -o /dev/null -w "%{http_code}\n"` on `/`, `/app/`, `/platform.html`, `/privacy.html` (expect 200) and grep the `<title>`.
5. Optional dated snapshot into `The One\backups` before major releases (source only, never user data).

Rules: public repo = code only; never commit `.env*`, backups, CSVs, keys. Env for the build (Supabase URL/anon key, Google client ID) is set as GitHub repo *variables* (`gh variable set`), not committed secrets; the anon key and client ID are public by design. Service-role keys never appear anywhere.
Don't create new public repos/pages without the owner's explicit command (classifier will block it).
