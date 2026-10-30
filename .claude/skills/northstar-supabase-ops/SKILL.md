---
name: northstar-supabase-ops
description: Use when creating, linking, migrating or verifying the Northstar Supabase project - exact CLI sequence, what the owner must do, and the RLS/secret checks
---

# Supabase ops (CLI 2.115 installed; repo has `supabase/` with migration 0001_vault.sql)

**Owner step (cannot be done by Claude):** `! supabase login` in the Claude prompt so the token is stored locally and never pasted into chat. Check: `supabase projects list` must not say "Invalid access token".

Then, in `C:\Users\bearf\Documents\northstar`:
1. `supabase projects create northstar --org-id <id> --db-password <generated> --region <nearest>` (free tier; generate the DB password locally and save it to a local file outside the repo; never print it into chat or commit it). Do NOT reuse the Custodian project.
2. `supabase link --project-ref <ref>` then `supabase db push`.
3. Auth: email+password; min length 10 (config.toml); decide email confirmation on/off in the dashboard (`supabase/README.md`).
4. Get public values: project URL + anon (publishable) key via `supabase projects api-keys --project-ref <ref>`. Set as GitHub variables: `gh variable set VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`; make `deploy.yml` pass them as build env. Local dev: `.env.local` (gitignored).
5. **Verify security (evidence required):** migration enables AND forces RLS on `vault_meta` and `vault_records`; anon-key query returns 0 rows/permission error; two-user test cannot read each other's rows; `grep -rniE "service_role|sb_secret_" src supabase` finds only warnings.
6. Smoke test sync with a throwaway account on two browser profiles, then run `northstar-privacy-audit`.

Never: service-role key in client or repo, plaintext user data in any column, DB password in chat/commits, schema edits outside `supabase/migrations/` (new numbered file per change).
