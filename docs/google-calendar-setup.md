# Google Calendar setup

Northstar reads your Google Calendar directly in the browser. No server and no client secret are involved; the OAuth Client ID is public. Access is read-only.

1. Go to https://console.cloud.google.com and create a new project (any name, e.g. "Northstar").
2. Open APIs & Services > Library, search for "Google Calendar API" and click Enable.
3. Open APIs & Services > OAuth consent screen. Choose User type "External", fill in an app name and your email, then add your own Google account under "Test users". Leave the app in Testing mode.
4. Open APIs & Services > Credentials > Create credentials > OAuth client ID. Application type: Web application.
5. Under "Authorized JavaScript origins" add:
   - https://123456789eleven.github.io
   - http://localhost:5180
   - http://localhost:5173
6. Create it and copy the Client ID (it ends in `.apps.googleusercontent.com`).
7. In Northstar, open the Data Hub, paste the Client ID into the Google Calendar card and press Connect.

Notes
- In Testing mode Google may ask you to re-consent about every 7 days; that is normal.
- The only scope requested is `https://www.googleapis.com/auth/calendar.readonly`.
- The access token is kept in memory only and is never saved. The Google script loads only when you press Connect.
- To build with a fixed ID, set `VITE_GOOGLE_CLIENT_ID` in `.env.local`.
