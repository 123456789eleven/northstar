# Public site design system (site/), v3 "field manual" + Aurora, palette v3 "Graphite and Violet"

The marketing site is static HTML + `site/style.css` + one deferred `site/site.js`. No build step beyond `scripts/build-pages.cjs`, no dependencies, no third-party requests (CSP `default-src 'self'`, no inline styles or scripts). Critique of v2 and the art direction: `docs/design/site-v3-critique.md`. Screenshots: `docs/design/site-shots-v3/`.

## Direction
A precise instrument with its own manual. Strict 12-column grid whose outer edges are drawn as continuous hairlines (`.ruled`), a ruled annotation row (`.ann-row`: section mark, title, figure number) above every section, oversized Fraunces numerals, short declarative headlines, explanations drawn as SVG plates (one 1.25px stroke, mono labels), and the product demonstrated by working instruments instead of described. **Aurora** (owner-approved 2026-11-02, `docs/design/aurora.md`) adds the ambient light, glass containers, gradient tiles, the gradient primary button and one gradient numeral per page, using only Aurora tokens.

## Palette v3 refresh (2026-11-05, branch feat/g5b-site-refresh)
The site mirrors the app's Constellation palette (`docs/design/game-direction.md`): graphite neutrals (`--page #0b0b10`, surfaces `#14141b/#1b1b25/#24242f`, lines `#2a2a36/#3a3a4a`, ink `#ecebf3/#a9a7ba/#9391a8`), one violet accent (`--accent #8b7cf0`, `--accent-ink #0e0b1f`, `--accent-text #a99df7`), `--glow-violet/-indigo/-slate` (the old `--aurora-*` names stay as aliases), the stronger glass (`--glass-bg .05`, `--glass-sheen`, `--glass-bg-hover .075`, `--glass-border .10`, `--glass-edge .09`), `--grad-violet/-indigo/-slate/-sky/-teal/-rose`, `--skill-*`. **Amber/gold is reward-only** (`--reward*`, `--grad-reward`): the XP number, the level badge and quest XP pills on the home game section, and nothing else. Everything formerly amber-as-brand (logo mark, primary button, tiles, `.gnum`, links, focus, active tab) is violet. Icons (`icon.svg`, 192/512, favicon, apple-touch) and `og.jpg` were re-rendered in violet.
Tile mapping now follows skills: default and Today violet, Plan indigo (`h-indigo`), Body/Food rose, Money teal, Mind indigo, Career violet, People sky (`h-sky`), You slate (`h-slate`, white ink). Button and tile ink is `--accent-ink` (4.88 on the darkest gradient end `#7c6df0`, 6.99 on `#a48bf5`; white would fail at 3.96/2.77).
Home gained section 02 "Your life, levelled" (`#levelled`): a hand-drawn SVG constellation (five stars whose halo and star scale/opacity follow `--b`), a mission board with fictional quests, sample-number buttons that complete quests, brighten stars and roll the sample XP into a level-up, a Calm mode switch that hides levels, XP and stars, and three plain facts (optional, derived, no nagging). Motion is transform/opacity only; without JS the static starting state is shown. Features is organised by hub (Today, Plan, Skills with Body/Food/Money/Career/People, Mind, You).

### Contrast on the v3 glass (recorded 2026-11-05)
Method (scripted, throwaway): every text box on all 8 pages at 1440 and 375 (reduced motion, images loaded) is measured; all text is then made transparent, the page is captured, and the 95th-percentile lightest (5th for dark text) background pixel under each box is compared with the computed text colour. 2,335 non-decorative text boxes: 0 below AA (4.5 normal, 3 large). Lowest normal text 5.30 (chips and mini labels), lowest large text 3.87 (stage times). 300 `aria-hidden` decorative boxes (footer wordmark, 404 compass) are excluded. Token math: on `--page` ink 16.59, ink-2 8.34, ink-3 6.41, accent 5.83; on a deliberately bright glass stack (`#262631`) ink 12.64, ink-2 6.36, ink-3 4.88, accent 4.44 (accent is used as text only where the pixel sample passed).

## Tokens
Color, font, radius and motion tokens use the **same names and values as `src/index.css`** (`--page/--bg`, `--surface(-1..3)`, `--line(-soft/-strong)`, `--ink(-2/-3)`, `--accent` + states, `--good/--warn/--info`, `--serif`, `--mono`, `--radius*`, `--sp-1..7`, `--dur-*`, `--ease*`). Aurora tokens are copied verbatim from `aurora.md`: `--aurora-amber/-violet/-teal`, `--glass-bg/-bg-hover(.065)/-bg-strong/-bg-bar(.88)/-border/-border-hover/-edge/-blur/-shadow`, `--grad-amber/-violet/-teal/-rose` (135deg), `--grad-sheen-hover/-press`, `--grad-ink`, `--radius-tile`, `--ease-spring`. If the app changes one, change it here too.

Site-level additions:
| Group | Tokens |
|---|---|
| Layout | `--wrap 1320`, `--gut 48/32/20` (desktop/tablet/phone), `--head-h 64/60` |
| Display type (Fraunces only) | `--fs-display clamp(42-168)` hero and end titles, `--fs-title clamp(44-112)` page titles, `--fs-h2 clamp(30-58)`, `--fs-numeral clamp(64-148)` section numerals, `--fs-lede` |
| Numerals | `--numeral #6f6e69` decorative section numerals (always `aria-hidden`, large text) |
| Space | `--sp-8 64`, `--sp-9 96`, `--sp-10 128` |
| Aurora (site) | `--aurora-hero`: the amber and violet hues placed in the hero, each glow <= .14 (the "slightly stronger in the hero" layer) |
| Motion | `--ease-enter`, `--dur-reveal 720` |

Fraunces: titles and numerals only. Inter: everything else. Mono: annotations, labels, code, kbd.

## Aurora on the site
- **Ambient layer:** `body::before` fixed, the three app glows, static. Hero adds `.hero::before` with `--aurora-hero`. Page base stays `--bg`.
- **Glass** (top-level containers only, never rows/lists, never nested): header and phone menu (`--glass-bg-bar`, floats over live content), palette dialog (`--glass-bg-strong`), product frames `.frame`, the miniature `.mini`, the story stage `.stage`, the hero capture bar `.filer-bar`, `.calc`, `.plate-scroll`, install illustrations `.ill`, read-next cards `.ncard`, ghost buttons, and the phone-width "what each side sees" cards. Inner regions use flat tints, not glass.
- **Fallbacks:** no `backdrop-filter` support or `prefers-reduced-transparency: reduce` -> solid `--surface-1` / `--surface-3` and no aurora layer; `forced-colors` -> CanvasText borders, no blur, gradient text becomes CanvasText, tiles get a Canvas/CanvasText border. Phone drops `saturate()`.
- **Gradient icon tiles** (`.tile` 36px, 32px in dense lists, `.tile.lg` 40px, `--radius-tile`; 1.75px line icon, `aria-hidden`; amber carries `--accent-ink`, violet/teal/rose carry `--grad-ink`). Module mapping mirrors the app's `src/components/moduleHue.ts`:

| Hue | Token | Modules |
|---|---|---|
| Amber | `--grad-amber` | Command, Today, Planner, Tasks |
| Violet | `--grad-violet` | Goals, Habits, Learning, Journal, History, Review |
| Teal | `--grad-teal` | Finance |
| Rose | `--grad-rose` | Food, Body, People |

  Used in: hero lanes, the home module index, the features catalogue headers.
- **Gradient primary button:** `.btn` fill `--grad-amber`, text `--accent-ink`; hover = `--grad-sheen-hover` overlay, press = `--grad-sheen-press` + scale .98 (opacity transitions).
- **One gradient numeral per page** (`.gnum`, `background-clip: text`, solid `--accent` fallback): home "14" in the numbers ledger; features 14, privacy 4, security 600k, install 3, roadmap 30, FAQ 12 in the page hero (`.hnum`); 404 "404".
- **Card hover lift:** interactive glass cards only (`.ncard` read-next cards): `translateY(-2px)` on `--ease-spring`, `--glass-bg-hover`, `--glass-border-hover`. No lift with reduced motion.

### Contrast on glass (recorded 2026-11-02)
Theoretical stack (both amber glows at full peak under one glass card, which the layout never produces): ink 8.56, ink-2 4.13, ink-3 3.57, accent 5.30 on glass. The real worst case is measured by `pixcontrast.mjs` (see `site-shots-v3/README.md`): every text box on every page at 1440 and 375 is compared with the 95th-percentile worst background pixel under it after hiding all text. Results are in the README. Accent-ink on the gradient button: 7.31 (worst end #e58f55), 8.37 hovered. Gradient numerals: 4.72-7.24 against the brightest page background (large text).

## Motion (each one has a job)
| Motion | Job | Mechanism |
|---|---|---|
| Hero entrance (`.ld`) | Reading order on first paint | CSS keyframes, no JS |
| Live capture line + lane drop (`#filer`) | Shows one line being parsed and where it lands | JS typing, `transform` drop; pauses off-screen, on a hidden tab and with the Pause button; static with reduced motion |
| Miniature (`#mini`) | Shows the real interactions: strike-through completion (same keyframes as `tasks.css`), row enter, budget bar `scaleX`, chart dot pop, number tick, rail count bump | CSS keyframes + transform/opacity |
| Story stage (`#story`) | One day accumulating on one timeline | IntersectionObserver picks the step; the progress rail is a CSS scroll-driven animation (`timeline-scope` + `view-timeline`) with a JS step fallback |
| Section reveal (`.rv`) | Pace long pages | CSS `view()` timeline; IntersectionObserver fallback adds `.in` only when JS ran (`.io`) |
| Plate draw-in (`.draw`) | Direction of flow (modules -> History -> views; device -> transit -> server) | `stroke-dashoffset` on `pathLength=1` paths, scroll-driven, IO fallback |
| Sync packets (`.arch .pkt`) | "Locked boxes" travelling | transform only, 3 iterations, starts in view |
| Explorer wires, key-wrap highlight | What each switch/step involves | stroke draw + opacity |
| Palette open, tabs, accordions, read-next lift | State change | 120-320ms transform/opacity |
| Page transitions | Continuity between pages | `@view-transition { navigation: auto }`, header pinned |

`prefers-reduced-motion: reduce` zeroes every animation/transition, hides packets, stops the typing loop, disables view transitions and smooth scroll. Without JS every section, panel and answer is visible: the miniature shows all five panels stacked, install shows all three platforms, the explorer shows every destination, the story stage shows the finished day.

## Components
Ruled section header (`.sh`, `.ann-row`, `.sh-num`), page hero with numeral (`.phero`, `.ph-g`, `.hnum`), filer (`#filer`, `.lanes`), numbers ledger (`.nums`), miniature (`#mini`: capture form, tabbed rail, tasks/body/finance/food/journal panels, History aside), story (`#story`, `.stage`, `.step`), plates (`.fan`, `.arch-svg`, `.flowmap`, `.kw`), module index with hover preview (`#modlist`, `.modprev`), features catalogue (`.cat-g`, sticky `.cat-idx` with scroll-spy, `.mod`), weight projection (`#calc`), spec lists (`.spec`), ledger table (`.ledger-t`, stacks under 760px), can/cannot columns (`.cc`), install tabs + line illustrations (`.ptabs`, `.isteps`, `.ill`), roadmap filters (`.fchip`, `#rm`), FAQ groups (`.faq-g`, filter, expand all, deep links), read-next cards (`.ncard`), site search palette (`dialog.pal`).

**Site search palette:** Ctrl/Cmd+K or `/` (when not typing). Searches a static index of pages, their sections and every FAQ answer, embedded in `site.js` between `/*@index*/` markers (regenerate it when page copy changes). Arrow keys, Enter, Esc; same-page results scroll and open the target. No network, no storage.

**Privacy of the site itself:** no cookies, localStorage, sessionStorage, IndexedDB or service worker, so nothing on the site origin can touch the app's data under `/app/`. The demos use fictional data in memory only.

## Screenshots
Only the built-in demo dataset plus fictional weights, captured from a private build in a throwaway browser profile on a private localhost origin. WebP q80, 1280x900 desktop and 375x800 phone, explicit width/height, lazy below the fold; the first features shot is eager with `fetchpriority="high"` (the home hero is typographic and has no image). `img/og.jpg` is rendered from the site fonts and tokens.

## Maintenance
Pages share a header and footer written into each file. When editing navigation, update all 8 pages (and the 404 uses `%BASE%` absolute links). After changing any section heading or FAQ text, regenerate the palette index.
