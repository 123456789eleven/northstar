# Liquid v2: true borderless liquid glass

Owner (2026-11-21): "I want true liquid glass without borders, a true drop-out liquid dynamic glass look. We have ligaments in place but not skin or organs." Council (glass engineer, motion designer, art director) reports are in the scratchpad `council\` folder: `glass.html` (+ `glass-desk.png`, `z1.png`, `z2.png`), `motion.html` (+ `shots\`), `audit\` (32 screenshots of the old look).

## Law 1: no strokes
Separate surfaces only with: a luminance step, a soft shadow, backdrop blur, and 24px+ spacing. A 1px stroke never separates surfaces. Audit: 461 border declarations, 330 `--line*` refs, 79 outlines, the 1px gradient `::after` rim on every card. All go, except accessibility guardrails below.

## Law 2: one light source, top-left
Radial highlight at 0 0 (white 6-10%), one soft top-edge catch (`inset 0 1px 0`, alpha <= .08), falloff darker toward bottom-right. No side or bottom edges.

## Material (paste into liquid.css; replaces the rim)
```
--lg-tint-thin: rgba(14,18,26,.38); --lg-tint-regular: rgba(14,18,26,.42); --lg-tint-thick: rgba(12,15,22,.52);
--lg-body: radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,.10), transparent 55%), radial-gradient(90% 50% at 50% 115%, rgba(156,200,230,.16), transparent 60%);
--lg-depth: inset 0 14px 22px -16px rgba(255,255,255,.22), inset 0 -18px 26px -18px rgba(156,200,230,.30), inset 0 0 30px -8px rgba(0,0,0,.35);
--lg-drop: 0 2px 6px rgba(0,0,0,.28), 0 22px 48px -18px rgba(0,0,0,.70);
--lg-spec: radial-gradient(180px 120px at var(--mx,20%) var(--my,0%), rgba(255,255,255,.16), transparent 70%);
.lg { border: 0; background: var(--lg-spec), var(--lg-body), var(--lg-tint); box-shadow: var(--lg-depth), var(--lg-drop); }
```
Luminance steps: `--lum-0` page #08090c, `--lum-1` well (+2.5% white), `--lum-2` surface (+4.5%), `--lum-3` raised (+7%), `--lum-4` hero (+9% with powder tint).

## Where the lens (real edge refraction) goes
Chromium only, `backdrop-filter: url(#f)` with one filter per element: tab/district strip, the one open sheet, toast/popover, the floating "+" button. Edge bevel map via SDF (`makeMap`), optional 3-channel dispersion (drop it when `deviceMemory <= 4`), rim image via `makeRim`. Port both functions from the prototype (`glass.html`) into `GlassDefs`, rebuild on ResizeObserver. TWO CHROMIUM TRAPS: explicit x/y/width/height/filterUnits on the `<filter>` breaks backdrop sampling; `mix-blend-mode` on a child disables the backdrop-filter. Cards and anything that scrolls NEVER get the lens: plain `blur(14px) saturate(1.5)` plus `--lg-body`/`--lg-depth`.
Fallback (Firefox, Safari, ALL iPhone browsers and the installed PWA are WebKit, so no refraction on iPhone): blur + `--lg-body` + `--lg-depth` must look good by themselves. Reduced transparency: solid `#12151c`.
Budget: max 3 lens elements at once, 6 backdrop-filter layers total, nothing moving has a backdrop-filter.

## Contrast
`--ink` passes on all glass. `--ink-2` fails AA on glass (3.8 to 4.0): add `--ink-2-glass: #cdd3dd` (about 4.7:1 worst case) and use it for secondary text on glass. Button labels over poppy: bold, >= 15px.

## Tiers inside a floor
Hero (one per floor): real glass, specular, 44px Inter figure. Supporting: near-solid well (`--lum-1/2`), no shadow. Tertiary: bare text on the page, no card. Rows: no hairlines; 2px gaps, 10px radius, alternate rows +2% fill, hover +4.5%, selected = 2px accent bar plus fill. Inputs: no border; well fill plus a 2px bottom "meniscus" in `--ink-3` (meets 3:1); error = 2px poppy meniscus + message text + `aria-invalid`. Charts: no frame or grid box, area fills fade to 0. Empty states: ghost data at 4% white, never an outlined box. Section labels in Inter (not `--mono`).

## Accessibility guardrails (keep)
`:focus-visible` 2px accent outline offset 2px; all `forced-colors` borders (restore real borders there); reduced-transparency fallbacks; selected state is more than a fill; error is colour + text.

## Motion (from `motion.html`)
Shared spring: stiffness k, damping c = 2 z sqrt(k), 240 Hz substeps, one rAF loop that stops at rest, retarget keeps velocity (interruptible). Presets: snappy k620 z.68 as CSS `linear(0, .354 10%, .795 20%, 1.01 30%, 1.053 40%, 1.033 50%, 1.01 60%, .999 70%, 1)` over 436ms; smooth k300 z.74 as `linear(0, .244 10%, .609 20%, .867 30%, .99 40%, 1.029 50%, 1.028 60%, 1.017 70%, 1.007 80%, 1)` over 498ms; gentle k140 z.9; press k1100 z1, release k420 z.5.
Ship, ranked: (1) stretch indicator on the elevator car `.bf-car` and the district pill (edge in the direction of travel on snappy, trailing edge on gentle; pill = two caps + 100px middle moved by translate3d and stretched by scaleX); (2) squash press on `.btn .chip .tab-item` (scale(1.03,.94), origin at pointer x and bottom edge, release overshoot, 120px radial light at the press point inside `isolation:isolate`); (3) liquid segmented thumb (Tabs indicator, HomeHud tabs; `scale(1+s,1-.45s)` s<=.18 from velocity); (4) droplet sheet (FLIP from the trigger, clip-path inset morph, backdrop-filter off during the morph; only reads as a drop when the trigger is a narrow pill); (5) toast stack of up to 3 that split and merge (goo sigma 4, gap >= 10px, text on its own unfiltered layer); (6) specular + up to 3 degrees tilt on hero panels with the pointer on desktop, slow CSS drift on touch (no JS).
Budget: animate only transform/opacity/filter; max 2 filtered layers moving, each <= 400x250; settle <= 700ms. Fallbacks: no `linear()` -> existing cubic-bezier tokens; no goo -> plain pill; reduced motion -> 160ms crossfades, no squash/tilt/drift.

## Work packages (disjoint files)
- WP-F Foundation: `src/styles/liquid.css`, `src/index.css`, `src/components/GlassDefs.tsx`, new `src/lib/spring.ts`, `ui.tsx` (Tabs thumb), global press squash.
- WP-C Chrome and motion: `building.css`, `city.css`, `shell.css`, `BuildingFrame.tsx`, `DistrictStrip.tsx`, `BottomSheet.tsx`, `Toast.tsx`, `features/buildings/Floor*.tsx`, HomeHud tabs.
- WP-B Bank floors: `finance/*.css`, `bank.css`, `markets.css`, Archive/Vault/Trading/Academy/Lobby components.
- WP-O Other floors: `lifemap/home.css`, `settings.css`, `journal.css`, `food*.css`, `planner.css`, `ops.css`, `learn.css`, `rings.css`, remaining per-feature CSS.
