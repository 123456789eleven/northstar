# Google Calendar setup

Northstar reads your Google Calendar directly in the browser. No server and no client secret are involved; the OAuth Client ID is public. Access is read-only.

The Google Calendar card on the Data page walks you through this as a stepper, with a button for each Google page and copy buttons for the origins.

1. Open https://console.cloud.google.com and create a project (any name, e.g. "Northstar").
2. Enable the Calendar API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com (Enable).
3. Consent screen: https://console.cloud.google.com/apis/credentials/consent. User type "External", fill in an app name and your email, add your own Google account under "Test users". Leave it in Testing mode.
4. Credentials: https://console.cloud.google.com/apis/credentials > Create credentials > OAuth client ID > Web application. Under "Authorized JavaScript origins" add:
   - https://123456789eleven.github.io
   - the address you open Northstar from during development (the card shows it, e.g. http://localhost:5173)
5. Copy the Client ID (it must end in `.apps.googleusercontent.com`; the card checks this) and paste it into the card, then press Connect.

After connecting, the card shows the account, last sync time, a calendar picker and Sync now. Events are imported from 30 days back to 180 days ahead and are marked "Google" in the Planner. Disconnect (after a confirmation) revokes the sign-in, forgets the Client ID and removes the imported Google events; your own events are untouched.

Common problems
- Sign-in window blocked: allow pop-ups for the site, press Connect again.
- "Google denied access" (access_denied): add your account under Test users on the consent screen.
- Origin mismatch: the current web address is missing from Authorized JavaScript origins; changes can take a few minutes.
- Session expired: press Reconnect. In Testing mode Google asks you to re-consent about every 7 days.

Privacy
- The only scope requested is `https://www.googleapis.com/auth/calendar.readonly`.
- The access token is kept in memory only and is never saved or synced. The Google script loads only when you press Connect.
- The Client ID and "dismiss the Planner prompt" choice are device-local settings (`gcal.*`) and never sync.
- To build with a fixed ID, set `VITE_GOOGLE_CLIENT_ID` in `.env.local`.
