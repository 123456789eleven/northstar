# Custom domain for the Northstar site

Today the site is at `https://123456789eleven.github.io/northstar/` (site at the root, app at `/app/`). This is how to move it to a domain you own. Nothing here is purchased or configured yet.

## 1. Buy a domain

Use any registrar (Cloudflare Registrar, Namecheap, Porkbun, Google Domains successors). Pick the apex, for example `example.com`. Turn on the registrar's domain privacy.

## 2. Tell the build about the domain (one place)

The public base URL is a single value in `site/site.config.json`:

```json
{ "baseUrl": "https://example.com/" }
```

`npm run build:pages` replaces every `%BASE%` token in the site's HTML, sitemap, robots.txt and manifest with it (canonical links, Open Graph and Twitter tags, JSON-LD, the 404 page). Keep the trailing slash. If you serve from a subpath, include it.

Then create `site/CNAME` containing only the bare domain on one line:

```
example.com
```

The build copies `CNAME` to the output only if the file exists, so deleting it returns to the github.io address.

## 3. DNS records

At your registrar's DNS settings add:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` (one record each) |
| CNAME | `www` | `123456789eleven.github.io` |

Check the current values at https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site before saving, since GitHub can change them.

## 4. GitHub settings

1. Repository Settings, Pages, Custom domain: enter `example.com` and Save. (The deploy workflow uploads `pages-dist`, which includes `CNAME`, so the setting survives deploys.)
2. Wait for the DNS check to pass, then tick **Enforce HTTPS**. Certificate issuance can take up to an hour.
3. `www.example.com` redirects to the apex automatically once both are set up.

## 5. App-side values to update

The app lives at `/app/`, so on a new origin these must be updated, and they use a different origin from the old one:

- Google OAuth client: add `https://example.com` to Authorized JavaScript origins (Google Calendar).
- Supabase Auth: add `https://example.com/app/` to the allowed redirect URLs and the Site URL if used.
- Data stored in the browser (IndexedDB) is per origin. Users of the old github.io address will not see their data on the new domain. Export a backup from the old address and import it on the new one, or turn on sync first.

## 6. Verify

`npm run build:pages`, then check `pages-dist/index.html` contains `https://example.com/` in the canonical link and `og:image`, and that `pages-dist/CNAME` exists. After deploy, open the site with HTTPS, view `/sitemap.xml`, and test a share preview.
