---
name: northstar-design-review
description: Use after any UI change in Northstar - Aurora (gradient + glass) checklist for token discipline, guardrails, contrast, performance, consistency, accessibility and phone usability, tuned to an owner who wants a premium glass look but rejects tacky or AI-looking UI
---

# Northstar: Design Review (Aurora)

The owner approved the "Aurora" gradient + glass look (2026-11-02). Spec: `docs/design/aurora.md` (tokens + guardrails, binding); applied rules, module hues and contrast numbers: `docs/design/system.md`.
**Premium, not neon: when something feels off, cut it; do not add another effect.**

## Tokens only
- Every gradient, glow, blur and translucent surface uses an Aurora token: `--aurora-*`, `--glass-*`, `--grad-*`. No ad-hoc `linear-gradient`, `radial-gradient`, `backdrop-filter`, rgba surface or hex colour in components, pages or feature CSS (charts excepted: `--data-1..6`).
- One amber `--accent` for primary action, focus, active nav. Semantic `--good --warn --info` only for meaning and never replaced by a decorative gradient.
- Fraunces only for page titles and big numerals; Inter elsewhere; at most 3 type sizes per card. Still banned: emoji icons, dashed badge borders, per-card random accents, animated gradients on chrome.

## Guardrails (aurora.md)
- Ambient: one fixed `body::before` layer, max 3 glows, alpha <= .14 each, static (drift opt-in, 60s+, transform only, off for reduced motion).
- Glass only on top-level cards, KPI tiles, panels, sidebar, top bar, tab bar and overlays. Never on rows, tables, list items, chart plot areas, or inside another glass element (nested cards flatten).
- Blur lives on a `::before` (or the overlay scrim), never on an element that may contain a fixed-position sheet/modal.
- Gradient vocabulary: `--grad-amber` = primary button, brand mark, progress fill, the one hero numeral per screen (`.grad-text`, solid fallback). Icon tiles (`ModuleTile`) follow the module-hue mapping in system.md (max 4 hues; same module = same hue everywhere). Nav icons stay plain.
- One card style (glass), one tile style, one hover (interactive cards only: 2px lift, `--glass-bg-hover`, `--glass-border-hover`).

## Contrast
- Text on glass must pass AA against the WORST-CASE composite (brightest aurora spot under the surface), computed from token values; record numbers in system.md. Body text >= 4.5:1, large >= 3:1. If `--ink-3` fails, use `--ink-2` or strengthen the surface; never thin the ink.
- Surfaces that float over live content without a scrim (top bar, tab bar, toast) use `--glass-bg-bar`.
- axe-core 0 violations on every route, plus a scripted pixel-sampling contrast check on screenshots (axe cannot judge gradients/translucency).
- Focus rings stay opaque amber and visible on every surface, including gradient buttons.

## Performance
- About 12 blurred elements in view at most; phones drop `saturate()`.
- Measure frame time while scrolling a long page (Finance > Transactions, All months) and Today, blur vs solid fallback, phone emulation with 4x CPU throttle. If blur costs > ~4 ms/frame, remove it from the offending elements. Report numbers.
- Check `npm run build` CSS/JS size before and after.

## Fallbacks
- `@supports not (backdrop-filter)` and `prefers-reduced-transparency: reduce` -> solid `--surface-1` / `--surface-3`, same borders.
- `forced-colors: active` -> ambient and blur layers removed, solid system-colour borders, gradient text becomes `CanvasText`.
- `prefers-reduced-motion` -> no lift, no drift, no count-up.

## Accessibility and phone
- Every input labelled; icon-only buttons have `aria-label`; tiles are `aria-hidden` and always sit beside a text label; keyboard-operable.
- 375px: no horizontal page scroll, tap targets >= 32px (44px primary), no hover-only interactions, bottom nav reachable.

## Output
Ranked list: file:line, problem, the element to cut or fix, plus the evidence (contrast numbers, frame times, screenshot path).
