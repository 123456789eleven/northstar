# Northstar "Aurora" direction (owner-approved 2026-11-02)

The owner explicitly wants the **gradient and glass look** (reference: a stat card with translucent blurred surface, 1px light border, gradient icon tile, springy lift on hover). This supersedes the old "no gradients / glow / glass" rule. Still dark only. Everything below is a TOKEN: no ad-hoc gradients, blurs or colors in components or pages.

## Ambient layer (the thing glass blurs)
One fixed, non-interactive layer behind the app (`body::before`, `position: fixed; inset: 0; z-index: -1; pointer-events: none`), at most 3 radial gradients, low alpha, static (an optional 60s+ drift uses `transform` only and is off for reduced motion):
| Token | Value |
|---|---|
| `--aurora-amber` | `radial-gradient(60% 50% at 12% -5%, rgba(242,196,107,.14), transparent 70%)` |
| `--aurora-violet` | `radial-gradient(50% 45% at 92% 8%, rgba(124,109,240,.13), transparent 70%)` |
| `--aurora-teal` | `radial-gradient(55% 50% at 70% 105%, rgba(47,191,155,.10), transparent 70%)` |
Page base stays `--bg #0c0d10`. The site uses the same three, slightly stronger in the hero only.

## Glass surfaces
| Token | Value | Use |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,.045)` | top-level cards, panels, KPI tiles |
| `--glass-bg-hover` | `rgba(255,255,255,.065)` | interactive card hover (was .07: `--warn` text fell to 4.49:1 on the worst-case spot at 1920px; .065 keeps it >= 4.5) |
| `--glass-bg-strong` | `rgba(24,26,34,.72)` | modal, sheet, palette, toast, menus (more opaque for legibility) |
| `--glass-bg-bar` | `rgba(18,19,24,.88)` | surfaces that float over live content WITHOUT a scrim: sticky top bar, phone tab bar, toast (strong .72 let unblurred amber under the bar drop `--ink-2` to 3.49:1; .88 keeps every ink >= 4.9:1) |
| `--glass-border` | `rgba(255,255,255,.09)` | 1px border |
| `--glass-border-hover` | `rgba(255,255,255,.16)` | interactive card hover border |
| `--glass-edge` | `inset 0 1px 0 rgba(255,255,255,.07)` | top inner highlight |
| `--glass-blur` | `blur(14px) saturate(120%)` | backdrop-filter |
| `--glass-shadow` | `0 8px 32px rgba(0,0,0,.32)` | floating glass only |
Implementation: blur sits on a `::before` behind the content (never on the card itself, so a card never becomes the containing block of a fixed sheet/modal inside it); modal, sheet and palette blur their scrim once and the panel is `--glass-bg-strong`. Glass is for the top-level container of a region, never nested inside another glass element and never on list rows, table rows or chart plot areas (rows sit on the card's own surface). Fallback when `backdrop-filter` is unsupported or `prefers-reduced-transparency: reduce`: solid `--surface-1` / `--surface-3` with the same border.

## Gradients
Brand accent stays amber (`--accent #e3b261`, primary actions, focus, active nav). Gradients add depth, with a fixed vocabulary:
| Token | From to | Use |
|---|---|---|
| `--grad-amber` | #f2c46b to #e58f55 | primary button fill, brand mark, progress fill, hero numerals |
| `--grad-violet` | #7c6df0 to #b46bf0 | icon tiles, secondary highlights |
| `--grad-teal` | #2fbf9b to #2aa9c4 | icon tiles (money, positive) |
| `--grad-rose` | #ee6a8e to #f0876a | icon tiles (body, people, alerts that are not errors) |

All four are `linear-gradient(135deg, from, to)`. Supporting tokens: `--grad-sheen-hover` rgba(255,255,255,.12) / `--grad-sheen-press` rgba(0,0,0,.10) (primary button hover/pressed overlay, opacity-animated), `--grad-ink` #fff (glyph on violet/teal/rose tiles), `--radius-tile` 10px, `--ease-spring` cubic-bezier(.3,1.35,.5,1) (card lift).
Rules: gradient tiles are 32-40px rounded squares (36px; a 24px compact tile only in filter lists such as the Command object-type facets) holding a line icon (`aria-hidden`): white (`--grad-ink`) on violet/teal/rose, `--accent-ink` on amber (white on #f2c46b is 1.6:1, unreadable; amber always carries dark ink, like the primary button); one module hue mapping documented in `docs/design/system.md` (max 4 hues, same hue for the same module everywhere); gradient text only for one hero number per screen (`background-clip: text` with a solid-color fallback); no gradient on body text, on rows, or behind charts' data; semantic status colors (`--good --warn`) are never replaced by a decorative gradient.

## Motion for the new look
Same motion tokens. Card hover: `translateY(-2px)` with `--ease-spring` (a small overshoot) over `--dur-base` (interactive cards only); glass border brightens (`--glass-border` to rgba(255,255,255,.16)). Transform and opacity only. Reduced motion: no lift, no drift.

## Guardrails (what keeps it premium, not tacky)
1. Intensity cap: aurora layer alpha <= .14 per glow; no more than 3 glows; no animated gradients on UI chrome.
2. Contrast: all text on glass must reach WCAG AA against the WORST-CASE composite (brightest aurora spot under the card): compute it with the token values and record the numbers in `docs/design/system.md`; axe cannot judge gradients, so add a scripted contrast check of sampled screenshot pixels.
3. Performance: `backdrop-filter` only on top-level cards, sticky top bar and sidebar, and overlays; at most about 12 blurred elements in view; never on lists/rows; phone keeps blur but drops `saturate()`; measure frame time on a long page (Finance Transactions) with and without blur and report numbers.
4. Accessibility: honour `prefers-reduced-motion`, `prefers-reduced-transparency`, `forced-colors` (fall back to solid borders); focus rings stay opaque amber.
5. Consistency: one card style app-wide (glass), one icon-tile style, one hover behaviour. Charts keep the data palette (`--data-1..6`); axes and grid stay hairline.
6. The Custodian "Aurora" identity (violet-led) is a reference only; Northstar is amber-led.
