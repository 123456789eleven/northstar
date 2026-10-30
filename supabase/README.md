# Northstar sync: Supabase setup

Sync is optional and off by default. When on, Northstar encrypts every record on your device and stores only
ciphertext in **your own** Supabase project. Supabase can see your account email, table names, opaque record ids,
how many rows each table has, timestamps and ciphertext sizes. It cannot see any content, your passphrase,
your recovery code or your keys.

The app only ever uses the project URL and the **anon (public)** key. The anon key is public by design; it is
safe only because row-level security (in `migrations/0001_vault.sql`) limits every row to its owner.
**Never put the service-role key in the app, in `.env` files, or in this repo.**

## One-time setup

Run these from the repo root (`C:\Users\bearf\Documents\northstar`). The CLI runs via `npx`, nothing to install.

1. **Log in to the CLI** (opens a browser):
   `npx supabase login`
2. **Create a project** (pick a strong database password and store it in your password manager; the app never needs it):
   `npx supabase projects create northstar --region us-east-1`
   Or create it at https://supabase.com/dashboard. Note the **project ref** (the `abcd1234` in `https://abcd1234.supabase.co`).
3. **Link this folder to the project:**
   `npx supabase link --project-ref <project-ref>`
4. **Create the tables, trigger and RLS policies:**
   `npx supabase db push`
   This applies `supabase/migrations/0001_vault.sql`.
5. **Auth settings** (Dashboard > Authentication):
   - Sign In / Providers > Email: enabled. Keep **Confirm email** on.
   - Disable every other provider you do not use. Turn off **anonymous sign-ins**.
   - URL Configuration > **Site URL**: the address you open Northstar at (for example `https://<you>.github.io/northstar/app/`). Add `http://localhost:5173` to Redirect URLs for local development.
   - Passwords: minimum length 10 or more.
   - Optional: Authentication > Rate Limits, keep the defaults or lower them.
6. **Check RLS is on** (Dashboard > Database > Tables): `vault_meta` and `vault_records` must both show "RLS enabled",
   each with four policies (select/insert/update/delete) restricted to `(select auth.uid()) = user_id`.
   Dashboard > Advisors > Security Advisor should report no issues for these tables.
7. **Get the URL and anon key**: Dashboard > Project Settings > API (or "Connect"). Copy the **Project URL** and the
   **anon public** key (in newer projects this is the "publishable" key). Do not copy `service_role` / "secret".

## Where the URL and anon key go

Either:

- **Build-time** (both devices get it automatically): create `.env.local` in the repo root (git-ignored by Vite's defaults; check before committing):
  ```
  VITE_SUPABASE_URL=https://<project-ref>.supabase.co
  VITE_SUPABASE_ANON_KEY=<anon public key>
  ```
  then `npm run build` / `npm run build:pages`.
- **Or in the app**: Settings > Sync > Set up sync, paste the URL and anon key. They are stored on that device only.

The app's Content-Security-Policy (`index.html`) only allows connections to `https://*.supabase.co` and `wss://*.supabase.co`.

## Turning it on

1. Settings > Sync > Set up sync. Create an account (email + account password) or sign in, confirm the email if asked.
2. Choose an **encryption passphrase** (separate from the account password; it never leaves the device).
3. Write down the **recovery code**, shown once. Confirm by typing its last five characters.
4. On every other device: sign in with the same account and unlock with the passphrase (or recovery code).

If you lose both the passphrase and the recovery code, nobody can decrypt the cloud copy. Each device still has its
own readable data; use Settings > Sync > Delete my cloud data and set sync up again from a device that has the data.

## Removing everything

- Settings > Sync > **Delete my cloud data** removes every encrypted row and the wrapped key for your account.
- To delete the account itself: Dashboard > Authentication > Users > delete the user (this also cascades the rows).
- To delete the whole project: Dashboard > Project Settings > General > Delete project.
