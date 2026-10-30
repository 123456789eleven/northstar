# SimpleFIN relay (optional)

A tiny Edge Function that lets Northstar's opt-in live bank feed talk to SimpleFIN Bridge. Browsers cannot call
SimpleFIN directly (it sends no CORS headers), so this runs in **your own** Supabase project.

What it does: only two actions, `claim` (swap a Setup Token for an access URL) and `accounts` (fetch accounts and
transactions for a date range). It only accepts calls from a signed-in user of your project, only talks to
`*.simplefin.org` over https, stores nothing, reads no database, and logs only the action name and a status code.

## Deploy: Supabase dashboard (no CLI needed)

1. Open https://supabase.com/dashboard, pick your Northstar project.
2. Left menu: **Edge Functions** > **Deploy a new function** > **Via Editor** (or **Create a function**).
3. Name it exactly `simplefin-relay`.
4. The editor starts with an `index.ts` file. Replace its contents with all of `supabase/functions/simplefin-relay/index.ts` from this repo.
5. Add a second file named `validate.ts` (the **+** / Add file button in the editor) and paste all of `supabase/functions/simplefin-relay/validate.ts`.
6. Make sure **Verify JWT** is ON (default; under the function's Details/Settings). Press **Deploy**.
7. No secrets to add: `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by Supabase automatically.

## Deploy: CLI

```
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy simplefin-relay
```
`supabase/config.toml` already sets `verify_jwt = true` for it.

## Verify it rejects strangers

Replace `<ref>` with your project ref. Both must print `401`:

```
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<ref>.supabase.co/functions/v1/simplefin-relay -H "Content-Type: application/json" -d "{\"action\":\"claim\",\"setupToken\":\"x\"}"
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<ref>.supabase.co/functions/v1/simplefin-relay -H "Authorization: Bearer <your-publishable-anon-key>" -H "Content-Type: application/json" -d "{\"action\":\"claim\",\"setupToken\":\"x\"}"
```
The second proves the public anon key alone (not a signed-in user) is refused too.
Then in Northstar: Data > Live bank feed > **Test relay** should say Pass while you are signed in.

## Rules built in

- CORS: only `https://123456789eleven.github.io`, `http://localhost:5173`, `:5180`, `:4173`. No wildcard. To use another address, edit `ALLOWED_ORIGINS` in `validate.ts` and redeploy.
- Target must be https, host `simplefin.org` or `*.simplefin.org`, default port, no redirects followed.
- 20 second timeout, 5 MB response cap, request body capped at 8 KB.
- Pure checks live in `validate.ts` and are unit tested by the app's test suite.
