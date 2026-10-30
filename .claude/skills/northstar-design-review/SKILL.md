---
name: northstar-design-review
description: Use after any UI change in Northstar - checklist for restraint, consistency, accessibility and phone usability, tuned to an owner who dislikes tacky or AI-looking UI
---

# Northstar: Design Review

**When something feels off, cut elements; do not add polish.**

## Restraint
- One accent hue (amber). Extra color only encodes data. No gradients, glows, glassmorphism, emoji icons, dashed badge borders, or per-card accent colors.
- Fraunces only for page titles and big numerals; Inter elsewhere. At most 3 type sizes per card.

## Consistency
- Uses `ui.tsx` primitives and `index.css` tokens; no hardcoded colors outside charts (chart colors validated via the `dataviz` skill).
- Same spacing rhythm (multiples of 4px); one primary action per view.

## Accessibility
- Contrast AA (4.5:1 text). Visible focus ring. Every input labelled. Icon-only buttons have `aria-label`. Operable by keyboard alone. Respect `prefers-reduced-motion`.

## Phone (375px)
- No horizontal page scroll. Tap targets >= 32px. No hover-only interactions. Bottom nav reachable.

## Output
Ranked list: file:line, problem, the element to cut or fix.
