// Assemble pages-dist: marketing site at the root, built app (dist/) at /app/.
// The site's public base URL lives in site/site.config.json (override with SITE_BASE for local checks).
// Text files in site/ that contain %BASE% get it replaced. site/CNAME is copied only if it exists.
const fs = require('fs')
const path = require('path')

const out = process.env.PAGES_OUT || 'pages-dist'
const cfg = JSON.parse(fs.readFileSync('site/site.config.json', 'utf8'))
let base = process.env.SITE_BASE || cfg.baseUrl
if (!base.endsWith('/')) base += '/'

fs.rmSync(out, { recursive: true, force: true })
fs.cpSync('site', out, { recursive: true })
fs.rmSync(path.join(out, 'site.config.json'))
fs.cpSync('dist', path.join(out, 'app'), { recursive: true })

const TEXT = /\.(html|xml|txt|webmanifest|json)$/
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (p === path.join(out, 'app')) continue
    if (e.isDirectory()) walk(p)
    else if (TEXT.test(e.name)) {
      const s = fs.readFileSync(p, 'utf8')
      if (s.includes('%BASE%')) fs.writeFileSync(p, s.split('%BASE%').join(base))
    }
  }
}
walk(out)
console.log(`pages built in ${out}/ (base ${base}${fs.existsSync('site/CNAME') ? ', CNAME included' : ''})`)
