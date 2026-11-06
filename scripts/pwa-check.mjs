// PWA proof with two real builds. Usage: node scripts/pwa-check.mjs <buildA-dir> <buildB-dir> [port]
// 1) serves A, loads Today, waits for the service worker; checks the precache holds the lazy chunks (EngineHost, MomentHost)
// 2) goes offline and reloads: Today must render from the precache
// 3) back online, swaps the served files for B, asks the registration to update: the "Update ready - reload" prompt must appear
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { cpSync, rmSync, readFileSync, existsSync, mkdtempSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { tmpdir } from 'node:os'

const [a, b, portArg] = process.argv.slice(2)
const port = Number(portArg ?? 4572)
const live = mkdtempSync(join(tmpdir(), 'ns-pwa-'))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' }
const swap = (src) => { rmSync(live, { recursive: true, force: true }); cpSync(src, live, { recursive: true }) }
swap(a)
const srv = createServer((req, res) => {
  let p = join(live, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(live, 'index.html')
  res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(readFileSync(p))
}).listen(port)
const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext()
const page = await ctx.newPage()
const ok = []
try {
  await page.goto(`http://localhost:${port}/#/`)
  await page.locator('h1.page-title').first().waitFor()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(async () => { await page.reload() })
  await page.waitForFunction(async () => (await caches.keys()).length > 0)
  const cached = await page.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out })
  for (const name of ['EngineHost', 'MomentHost', 'Today']) {
    if (!cached.some((u) => u.includes(`/${name}-`))) throw new Error(`precache is missing ${name} chunk`)
  }
  ok.push(`precache holds ${cached.length} entries incl. EngineHost, MomentHost, Today`)
  await ctx.setOffline(true)
  await page.reload()
  await page.locator('h1.page-title').first().waitFor({ timeout: 10000 })
  ok.push('offline reload renders Today')
  await ctx.setOffline(false)
  swap(b)
  await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update() })
  await page.getByText('Update ready - reload').waitFor({ timeout: 15000 })
  ok.push('update prompt appears after deploying build B')
  console.log(ok.join('\n'))
} catch (e) { console.error('PWA CHECK FAILED:', e.message, '\npassed so far:', ok); process.exitCode = 1 }
finally { await browser.close(); srv.close(); rmSync(live, { recursive: true, force: true }) }
