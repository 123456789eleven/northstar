# Public site design system (site/)

The marketing site is static HTML + `site/style.css` + one deferred `site/site.js`. No build step, no dependencies, no third-party requests (CSP `default-src 'self'`, no inline styles or scripts).

## Tokens
Color, font and radius tokens use the **same names and values as `src/index.css`** (`--page`, `--surface`, `--surface-2/3`, `--line`, `--line-strong`, `--ink`, `--ink-2/3`, `--accent`, `--accent-ink`, `--accent-soft`, `--good/--warn/--info`, `--serif`, `--mono`, `--radius`, `--radius-sm`, `--radius-modal`, `--sp-1..7`). If the app changes one of these, change it here too.

Also mirrored from the app's design system v2 block (same names and values): `--bg`, `--surface-1`, `--line-soft`, `--accent-hover #ebc17a`, `--accent-pressed #d6a24f`, `--accent-line`, `--accent-ring`, `--ink-disabled`, `--good-soft`, `--warn-soft`, `--radius-xs`, `--radius-pill`, `--shadow-pop`, `--icon-sm/md/lg`, `--track-label`, `--dur-fast/base/slow`, `--ease-out`, `--ease-in`.

Site-level additions:
| Group | Tokens |
|---|---|
| Entrance easing | `--ease-enter cubic-bezier(0.16, 1, 0.3, 1)` (reveals and swaps only; UI state changes use the app's `--ease`) |
| Space | `--sp-8 64`, `--sp-9 96`, `--sp-10 128` (section rhythm) |
| Type | `--fs-xs 12` `--fs-sm 14` `--fs-base 16` `--fs-md 18` `--fs-lg 22` `--fs-xl clamp(28-42)` `--fs-2xl clamp(40-76)` `--fs-num` |
| Depth | `--shadow-1`, `--shadow-frame` (product frames and the demo cards only), `--radius-frame 12`, `--radius-phone 34` |
| Motion | `--dur-reveal 640`, `--rise 18px` (plus the app's `--dur-*` and easings) |

Fraunces: headings and big numbers only. Inter: everything else. Mono: eyebrows, labels, code, kbd.

## Motion (each one has a job)
| Motion | Job | Mechanism |
|---|---|---|
| Hero entrance (`.ld`) | Reading order on first paint | CSS keyframes, no JS |
| Section/card reveal (`.rv`, `.rv-kids`) | Pace long pages | CSS scroll-driven `view()`; IntersectionObserver fallback adds `.in` only when JS ran (`.io`) |
| Diagram draw-in (`.draw-on`) | Shows the direction data/keys flow | `stroke-dashoffset` on `pathLength=1` paths, scroll-driven |
| Sync packets (`.pkt-g`) | Shows "locked boxes" travelling | transform only, 3 iterations, starts when in view |
| Hero parallax | Depth between window and phone | `scroll()` timeline, transform only, >800px |
| Header hairline / read progress | "You have scrolled" / position on long pages | `scroll()` timeline (JS fallback for the hairline) |
| Count-ups | Real counts (14, 4, 600,000) | rAF, starts in view, final text restored |
| Tabs, stepper, chips, toast | Explain state change | 200-320ms transform/opacity |
| Page transitions | Continuity between pages | `@view-transition { navigation: auto }`, header pinned |

`prefers-reduced-motion: reduce` zeroes every animation/transition, hides packets, disables view transitions and smooth scroll. Without JS every section, panel and answer is visible (tabs collapse to stacked panels; switches hide; explorer lists every destination).

## Components
Product frame (`.frame`, `.frame.adapt` swaps to a phone bezel and the phone screenshot under 600px via `<picture>`), phone (`.phone`), KPI strip, architecture diagram (`.arch`), tabs (`role=tablist`, roving tabindex, arrows/Home/End), capture playground (`#cap-in`, a faithful subset of `src/lib/capture.ts`), proposal stepper (`#prop`), comparison table (`.compare`, stacks under 600px), weight projection (`#calc`, same math as `features/body/model.ts`), privacy explorer (`#explore`, `role=switch`), key-wrapping diagram (`.keymap`), Add to Home Screen illustration (`.a2hs`), roadmap timeline (`.tl`), FAQ (`details` with ids, hash deep links, filter, expand all), numbered screenshot callouts (`.mk.pin`, positions generated from the demo screenshots between `@pins` markers in style.css).

## Screenshots
Only the built-in demo dataset plus fictional weights. WebP q80, 1280x900 desktop and 375x800 phone, explicit width/height, lazy below the fold, the hero window eager with `fetchpriority="high"`. Callout pins are measured from the same run, so re-shoot and regenerate pins together.
