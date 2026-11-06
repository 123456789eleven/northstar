// Build-size and startup measurement. Usage: node scripts/perf-measure.mjs [port]   (run `npm run build` first; serves dist/ with vite preview)
// Prints entry JS/CSS (raw + gzip, including the modulepreloaded chunks in index.html), the precache total, and the median Today startup
// on an emulated phone: CDP 4x CPU slowdown + Fast 3G, cold cache, 5 runs.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const port = Number(process.argv[2] ?? 4571)
const dist = 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const refs = (re) => [...html.matchAll(re)].map((m) => m[1].replace(/^\.\//, ''))
const scripts = refs(/<script[^>]*src="([^"]+)"/g)
const preloads = refs(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)
const styles = refs(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)
const size = (files) => files.reduce((a, f) => { const b = readFileSync(join(dist, f)); a.raw += b.length; a.gz += gzipSync(b).length; return a }, { raw: 0, gz: 0 })
const kb = (n) => (n / 1024).toFixed(1)
const fmt = (s) => `${kb(s.raw)} kB raw / ${kb(s.gz)} kB gzip`
const out = { entryJs: size(scripts), entryJsPlusPreloads: size([...scripts, ...preloads]), entryCss: size(styles) }
const sw = readFileSync(join(dist, 'sw.js'), 'utf8')
const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1])
let total = 0; for (const u of urls) { const p = join(dist, u); if (existsSync(p)) total += statSync(p).size }
console.log('entry js (index only):', fmt(out.entryJs))
console.log('entry js + modulepreloads:', fmt(out.entryJsPlusPreloads), `(${scripts.length + preloads.length} files)`)
console.log('entry css:', fmt(out.entryCss))
console.log('precache:', urls.length, 'entries,', kb(total), 'kB')

const up = async () => { try { return (await fetch(`http://localhost:${port}/`)).ok } catch { return false } }
const srv = (await up()) ? null : spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: true })
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)) }
const browser = await chromium.launch({ channel: 'chrome' })
const runs = []
try {
  for (let i = 0; i < 5; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
    const page = await ctx.newPage()
    await page.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => ({ startTime: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true }) })
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024 / 8) * 0.9, uploadThroughput: (750 * 1024 / 8) * 0.9 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const t0 = Date.now()
    await page.goto(`http://localhost:${port}/#/`, { waitUntil: 'commit' })
    await page.locator('h1.page-title').first().waitFor({ timeout: 40000 })
    const heading = Date.now() - t0
    // Interactive: end of the last long task (>50 ms) in the 2.5 s after the heading, else the heading time.
    await page.waitForTimeout(2500)
    const lastLong = await page.evaluate(() => (window.__lt ?? []).reduce((m, e) => Math.max(m, e.startTime + e.duration), 0))
    const tti = Math.max(heading, Math.round(lastLong))
    const bytes = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, e) => a + (e.transferSize || 0), 0))
    runs.push({ heading, tti, bytes })
    console.error('run', i, heading, tti)
    await ctx.close()
  }
} finally { await browser.close(); if (srv) { srv.kill(); if (process.platform === 'win32') spawn('taskkill', ['/pid', String(srv.pid), '/T', '/F'], { stdio: 'ignore' }) } }
const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[2]
console.log(`Today startup (4x CPU, Fast 3G, cold, median of 5): heading ${med('heading')} ms, interactive ${med('tti')} ms, transferred ${kb(med('bytes'))} kB`)
console.log(JSON.stringify({ ...out, precacheKb: +kb(total), runs }))
