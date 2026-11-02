# Public site v2: critique, and the v3 direction

Shot from a local copy of `site/` (v2, shipped 2026-11-01) at 1440 and 375 with reduced motion so every section is visible. Before shots: `docs/design/site-shots-v3/before-*.webp`.

## What v2 gets right (keep)
- Honest copy: every claim maps to code or to `privacy.html`; the "what each side can see" framing is the strongest idea on the site.
- Hard constraints are met: no third-party requests, CSP `default-src 'self'`, no storage, no-JS fallbacks, AA contrast.
- The capture playground and the weight projection are real tools, not decoration.

## Why it still reads as a skeleton
1. **It is the default SaaS template.** Eyebrow, serif H2, grey lede, centered-ish block, then a card grid. Every section on every page uses the same three-line header, so nothing has more weight than anything else. Swap the logo and it is any product page.
2. **Hierarchy is flat.** The H1 is large but the page below it is one even rhythm of 96px bands; the eye never gets a second big moment. KPI numbers (14 / 1 / 0 / 4 / 600,000) sit in a thin strip at the same visual weight as the checklist under the buttons.
3. **Screenshot-heavy, diagram-light.** The hero is a screenshot of the app in a window frame (the most common landing page move there is), the modules section is eight screenshots behind tabs, and the features page is fourteen screenshot-plus-bullets rows (12,600px tall at 1440, 20,000px at 375). The product's real differentiators (one timeline, per-record encryption, opt-in connections) are explained by one small three-box diagram.
4. **Motion decorates more than it explains.** Fade-up reveals on every block, count-ups on numbers that do not change (1, 0), a parallax phone. The two motions that explain something (draw-in wires, sync packets) are small and below the fold.
5. **Copy sounds like every product page.** "Your whole life, run from one private place." "Private by architecture, not by promise." "Capture without friction." "Start with one line." Well written, but interchangeable. It tells instead of showing.
6. **Interactive pieces are side dishes.** The capture demo shows chips for a typed line, but nothing is filed anywhere; you never see a list change, a chart move or a budget react. The Command stepper is a slideshow of three states.
7. **Templated details.** Card with icon + title + three checkmark bullets (x3), comparison table with check/dash columns, "Typical cloud app" strawman, CTA box with a logo mark. Each is fine alone; together they are the template.
8. **Structure is invisible.** No grid you can feel, no figure numbering, no annotations; the pages do not look like they were laid out by a person who cared about this specific product.
9. **Mobile is the desktop page stacked.** Nav wraps to two rows of links at 375; the hero screenshot is unreadable at phone width; the features page is a 20,000px scroll.
10. **Navigation is page-to-page only.** There is no way to jump to "what does sync send" or a specific FAQ answer without scrolling.

## v3 art direction: "the field manual"
Northstar is presented as a precise instrument with its own manual. Pages are laid out on a strict 12-column grid whose outer edges are drawn as continuous hairlines down the page, and every section opens with a ruled header row of mono annotations (section mark, title, figure number) above an oversized Fraunces numeral and a plain, specific headline. Explanations are drawings first: a hand-built SVG system in one 1.25px stroke, neutral ink with amber only for the thing that is moving or on (the line being filed, the key that wraps, the switch that is on), labeled in mono like a technical plate, drawing itself only to show direction of flow. Screenshots drop to supporting evidence (a hover preview, the features catalogue). The product is demonstrated, not described: the hero types real capture lines and files them into lanes, a working miniature of the app (fictional data, in-page only) lets you tick tasks, log a weight, spend against a budget and watch History fill, and a pinned "day, filed" story shows one day accumulating on a single timeline. Copy is short, declarative and specific to this app. Dark only, one amber, no gradients, glow, glass, tilt or ticker tricks: the quality comes from type, grid, drawings and interactions that tell the truth.

### Cut on purpose
Cursor tilt (no job beyond "looks 3D"), marquee/ticker strips, count-ups on static numbers, parallax, the comparison table against a "typical cloud app", screenshot callout pins (fragile, re-measured on every re-shoot).
