# Public site: before / after screenshots

Full-page captures of every site page, taken with headless Chrome against the built pages (demo dataset only). WebP, cropped at 16,000 px tall.

- `before-*`: the site as it was before the 2026-11-01 redesign (served from `site/` directly).
- `after-*`: the redesigned site, served from a `build-pages.cjs` output, with reveals settled (animations off for the capture).

| Page | Before 1440 | After 1440 | Before 375 | After 375 |
|---|---|---|---|---|
| Home | [before-index-1440](before-index-1440.webp) | [after-index-1440](after-index-1440.webp) | [before-index-375](before-index-375.webp) | [after-index-375](after-index-375.webp) |
| Features | [before-features-1440](before-features-1440.webp) | [after-features-1440](after-features-1440.webp) | [before-features-375](before-features-375.webp) | [after-features-375](after-features-375.webp) |
| Privacy | [before-privacy-1440](before-privacy-1440.webp) | [after-privacy-1440](after-privacy-1440.webp) | [before-privacy-375](before-privacy-375.webp) | [after-privacy-375](after-privacy-375.webp) |
| Security | [before-security-1440](before-security-1440.webp) | [after-security-1440](after-security-1440.webp) | [before-security-375](before-security-375.webp) | [after-security-375](after-security-375.webp) |
| Install | [before-install-1440](before-install-1440.webp) | [after-install-1440](after-install-1440.webp) | [before-install-375](before-install-375.webp) | [after-install-375](after-install-375.webp) |
| Roadmap | [before-roadmap-1440](before-roadmap-1440.webp) | [after-roadmap-1440](after-roadmap-1440.webp) | [before-roadmap-375](before-roadmap-375.webp) | [after-roadmap-375](after-roadmap-375.webp) |
| FAQ | [before-faq-1440](before-faq-1440.webp) | [after-faq-1440](after-faq-1440.webp) | [before-faq-375](before-faq-375.webp) | [after-faq-375](after-faq-375.webp) |
| 404 | [before-404-1440](before-404-1440.webp) | [after-404-1440](after-404-1440.webp) | [before-404-375](before-404-375.webp) | [after-404-375](after-404-375.webp) |

Extra evidence: `after-nojs-index-375.webp` (JavaScript blocked: every module panel stacked and visible) and `after-reduced-index-1440.webp` (prefers-reduced-motion: static, nothing hidden).

The before 404 capture shows unresolved `%BASE%` links because it was served from `site/` without the build step.
