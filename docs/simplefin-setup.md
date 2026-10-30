# Live bank feed (SimpleFIN): owner setup

Optional and off by default. Bank files you import yourself remain the main path. This adds one more: transactions
pulled through SimpleFIN Bridge (a paid service, about a dollar or two a month; check their site) via a small relay in
your own Supabase project.

## What is sent where

| To | What |
|---|---|
| Your relay (your Supabase project) | Your Setup Token once, then your access URL, and the start/end dates you ask for. Needs your signed-in sync account. |
| SimpleFIN (through the relay) | The same, to fetch your accounts. SimpleFIN, which links to your bank, sees your transactions. |
| Back to this device | Account names, balances and transactions. |

The relay stores nothing and logs only the action name and a status code. The access URL is a secret kept only in a
device-local setting (`simplefin.accessUrl`): never synced, never in a backup file, never shown after connecting.
Northstar never sees your bank username or password. Nothing of your existing Northstar data is sent.

## The three steps

1. **SimpleFIN account and Setup Token.** Sign up at https://beta-bridge.simplefin.org/auth/signup, link your bank,
   then create a Setup Token (more at https://www.simplefin.org/).
2. **Deploy the relay.** Follow `supabase/functions/simplefin-relay/README.md` (dashboard route needs no CLI). Check
   the unauthenticated curl returns 401. In Northstar press **Test relay**.
3. **Connect.** Data > Live bank feed: sign in under Settings first, paste the Setup Token, Connect. Then **Sync
   now**: you see how many are new vs already imported before anything is added. Undo is in Import history.

Limits: SimpleFIN allows about 24 requests a day and 90 days per request, so the first sync (a year) uses 5 requests and
later syncs 1. Northstar syncs at most once every 6 hours unless you choose Sync anyway. A Setup Token works once; if
it fails with a refusal, create a new one. Disconnect deletes the access URL here and can also remove imported rows.
