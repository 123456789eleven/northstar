---
name: northstar-elite-quality-bar
description: Use before claiming ANY Northstar work (design, feature, build, release) is done - the owner's standing bar is first-party Apple/Android system-app polish, Anthropic/OpenAI engineering rigor, and Lockheed/Palantir-grade verification and traceability, applied to every change, not just big ones
---

# The quality bar: four companies, one standard

The owner's own words (2026-11-21): *"I need Silicon Valley level quality. Apple iOS and Android OS, Anthropic, OpenAI, Lockheed, Palantir level of quality for everything."* This is not a one-time push; it is the permanent bar for Northstar. Read this before any design pass, feature build, or release, and hold the work to it before saying it is done. It does not replace `northstar-definition-of-done`'s gates (verify, e2e, a11y) — it sets what "good" means above and beyond those gates passing.

## What each name means here, concretely

**Apple (iOS/visionOS system apps) — restraint and finish.** One hero per screen. Every spacing value, radius, and shadow traces to a token, never a one-off. Motion has a reason (it shows cause and effect) and an exit (reduced motion gives the same information, instantly). Nothing is "80% done" — a feature that is not fully polished stays out of the cut rather than shipping rough. The test: a person who has only used first-party Apple apps should feel nothing foreign in the first five seconds.

**Android OS (Material, system surfaces) — consistency across a large surface.** The same control behaves identically everywhere it appears (a button, a sheet, a toggle look and feel the same in the Bank as in the Gym). One component owns each pattern; nothing is reimplemented slightly differently in a second file. Density and touch targets hold at every screen size without a special case per page.

**Anthropic / OpenAI — engineering honesty.** Never claim something works without having run it. State real limits plainly (free-tier API caps, what a model or a heuristic cannot know, what was not tested) instead of smoothing them over. Prefer a smaller feature that is fully true over a bigger one with an asterisk. Tests are not a formality: a claim of "done" is backed by a command that was actually run, with its real output, not a description of what running it would show.

**Lockheed Martin / Palantir — verification and traceability.** Every change has a reproducible gate it passed (`npm run verify`, the full Playwright suite) run on the exact commit being shipped, not an earlier one. No silent failure paths: an error state is designed, not an afterthought. Security and privacy rules in `CLAUDE.md` are treated as load-bearing, not advisory — a change that would weaken them stops and asks. Work is written down (plans, decision logs, the redesign docs) so it survives an interruption and a different session can pick it up without guessing.

## Before saying anything is done, check

1. **Ran it, not reasoned about it.** `npm run verify` and the full Playwright suite ran on the actual final commit (not an earlier one, not "should pass"). If a subagent's report describes what it did without quoting a real pass/fail line, re-run it yourself before trusting it.
2. **Looked at it.** A screenshot was taken and read by a human or by you — phone and desktop — not inferred from the code. Visual and motion work especially: judge it against the reference quality (an Apple system app, a Whoop/Linear-grade dashboard), not against "better than before."
3. **No fabricated claim.** Nothing is asserted that was not verified: a number, a contrast ratio, a "this is accessible," a "this performs well on an old phone" — if it wasn't measured, say that, don't assert it.
4. **One pattern, enforced.** If this change introduces a new look or behavior, check whether an existing token/component already does this; add to the shared one before writing a new one.
5. **Degrades honestly.** Every effect (glass, motion, live data) has a stated fallback for the case where it can't run (older browser, reduced motion, no network, no API key) and that fallback was actually exercised, not assumed.
6. **Traceable.** The decision and its reasoning are written where another session (or a reset usage limit) can pick them up: a plan doc, a commit message, a memory note — not only in this conversation.
7. **Security/privacy untouched or explicitly approved.** Any change touching data leaving the device, a new dependency, or a CLAUDE.md hard rule is flagged to the owner before it ships, never quietly adjusted to make a feature easier.

## Anti-patterns this bar forbids
- Reporting "tests pass" from a subagent without having seen the actual pass count on the final merged commit.
- A visual change judged only by description ("it's borderless now") without a screenshot actually reviewed.
- Shipping a feature with a known rough edge noted in the same breath as "done."
- A second implementation of a pattern (a second toast system, a second glass recipe, a second spring curve) because it was faster than reusing the first.
- Silence about a real limitation (API rate limit, untested device, a browser that won't get an effect) because naming it feels like admitting failure — naming it IS the Lockheed/Palantir standard, not a failure.
