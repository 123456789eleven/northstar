# Public site v3: before / after

Full-page captures (WebP, capped at 16,000 px tall) of every site page at 1440 and 375, headless Chrome, reduced motion so every reveal is settled.

- `before-*`: v2 as shipped 2026-11-01, served from a copy of `site/` without the build step (so the 404 shows raw `%BASE%` links).
- `after-*`: v3 "field manual" + Aurora, served from a `scripts/build-pages.cjs` output (`PAGES_OUT` private folder, `SITE_BASE` local) by `python -m http.server`.
- `after-nojs-index-375`, `after-nojs-privacy-1440`: JavaScript disabled. The miniature shows all five panels stacked, the explorer shows every destination, the story stage shows the finished day.

Product screenshots in `site/img/` were re-shot for v3 from a private build of the app, in a throwaway browser profile on a private localhost origin, with the built-in demo dataset plus fictional weigh-ins (Body). Nothing was loaded into the real app origin.

| Page | Before 1440 | After 1440 | Before 375 | After 375 |
|---|---|---|---|---|
| Home | [before](before-index-1440.webp) | [after](after-index-1440.webp) | [before](before-index-375.webp) | [after](after-index-375.webp) |
| Features | [before](before-features-1440.webp) | [after](after-features-1440.webp) | [before](before-features-375.webp) | [after](after-features-375.webp) |
| Privacy | [before](before-privacy-1440.webp) | [after](after-privacy-1440.webp) | [before](before-privacy-375.webp) | [after](after-privacy-375.webp) |
| Security | [before](before-security-1440.webp) | [after](after-security-1440.webp) | [before](before-security-375.webp) | [after](after-security-375.webp) |
| Install | [before](before-install-1440.webp) | [after](after-install-1440.webp) | [before](before-install-375.webp) | [after](after-install-375.webp) |
| Roadmap | [before](before-roadmap-1440.webp) | [after](after-roadmap-1440.webp) | [before](before-roadmap-375.webp) | [after](after-roadmap-375.webp) |
| FAQ | [before](before-faq-1440.webp) | [after](after-faq-1440.webp) | [before](before-faq-375.webp) | [after](after-faq-375.webp) |
| 404 | [before](before-404-1440.webp) | [after](after-404-1440.webp) | [before](before-404-375.webp) | [after](after-404-375.webp) |

## Checks run (2026-11-02)
Served from a private `build-pages.cjs` output by `python -m http.server` (stopped by PID). Scripts were throwaway (scratchpad).
- 8 pages x 1440/1024/768/375: 0 console errors, 0 external requests, 0 horizontal scroll (also 360); axe-core (wcag2a/aa, 21a/aa, best-practice) 0 violations at 1440 and 375.
- 45 same-origin URLs (links, images, srcset, manifest) all 200.
- Reduced-motion and JS-disabled runs: no text hidden except intended (JS-only controls without JS; inactive tab panels and off explorer rows with JS).
- Interactions (scripted): miniature files a task, an expense (Dining bar 0.67 -> 0.83, then "Over by $18.40"), a weight (7-day avg 136.1 -> 136.6, new dot), a meal and a journal line; ticking a task plays the strike and moves it to Done with a History row; rail arrow keys; hero typing + Pause; palette Ctrl+K "forget passphrase" -> faq.html#passphrase opened, "/" opens it too, Esc closes; FAQ open/filter/expand-all; roadmap filters; install tabs + arrows; privacy switch; key-wrap stepper; projection calc; features scroll-spy.
- Storage on the site origin after all of that: `indexedDB.databases()` [], localStorage 0, sessionStorage 0, cookies "", service workers 0. `site.js` contains no storage, fetch or XHR calls.
- Page weight on load (1440, lazy images not scrolled into view): index 269 KB, features 363, privacy 241, security 241, install 239, roadmap 236, FAQ 238, 404 230.
- Contrast on glass, sampled pixels: 2,622 text boxes on all pages at 1440 and 375, background = 95th-percentile worst pixel under each text run with all text hidden: 0 below AA. Lowest: decorative step numerals 3.56 (large text), annotations 5.20, miniature sub-labels 5.36. Token math (app, worst glass spot): ink 11.39, ink-2 5.49, ink-3 4.75; button ink on gradient 11.23/7.31.
