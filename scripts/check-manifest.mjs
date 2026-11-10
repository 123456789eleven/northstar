// Verifies the built manifest: every referenced icon exists with the declared size, colors match the graphite brand,
// and index.html links the favicon / apple-touch-icon / theme-color. Run after `npm run build`: node scripts/check-manifest.mjs
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const dist = 'dist'
const BRAND = '#08090c'
const fail = []
const m = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'))
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const pngSize = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)] }
const check = (src, sizes, base = dist) => {
  const f = join(base, src)
  if (!existsSync(f)) return fail.push(`missing ${f}`)
  if (src.endsWith('.png') && sizes && sizes !== 'any') {
    const [w, h] = pngSize(f)
    if (`${w}x${h}` !== sizes) fail.push(`${src}: declared ${sizes}, actual ${w}x${h}`)
  }
}
for (const i of m.icons) check(i.src, i.sizes)
for (const s of m.shortcuts ?? []) for (const i of s.icons ?? []) check(i.src, i.sizes)
if (!m.icons.some((i) => i.purpose === 'maskable')) fail.push('no maskable icon')
for (const k of ['theme_color', 'background_color']) if (m[k] !== BRAND) fail.push(`${k} is ${m[k]}, expected ${BRAND}`)
if (!html.includes(`name="theme-color" content="${BRAND}"`)) fail.push('index.html theme-color mismatch')
if (!/rel="apple-touch-icon" href="([^"]+)"/.test(html)) fail.push('no apple-touch-icon link')
else { const h = html.match(/rel="apple-touch-icon" href="\.\/([^"]+)"/)[1]; check(h, '180x180') }
const fav = html.match(/rel="icon" type="image\/png" sizes="32x32" href="\.\/([^"]+)"/)
if (!fav) fail.push('no png favicon link'); else check(fav[1], '32x32')
// site/ copies
const sm = JSON.parse(readFileSync('site/site.webmanifest', 'utf8'))
for (const i of sm.icons) check(i.src, i.sizes, 'site')
check('apple-touch-icon.png', '180x180', 'site'); check('favicon-32.png', '32x32', 'site')
for (const k of ['theme_color', 'background_color']) if (sm[k] !== BRAND) fail.push(`site ${k} is ${sm[k]}`)
if (fail.length) { console.error('manifest check FAILED\n' + fail.join('\n')); process.exit(1) }
console.log('manifest check ok:', m.icons.length, 'icons, site copies, colors', BRAND)
