# Performance notes (G5c)

Measure with `npm run build && node scripts/perf-measure.mjs` (entry sizes, precache total, Today startup on an emulated phone:
CDP 4x CPU + Fast 3G, cold cache, median of 5). PWA proof: `node scripts/pwa-check.mjs <buildA> <buildB>`. Icons: `python scripts/gen-icons.py`,
check with `node scripts/check-manifest.mjs`.

| | Before | After |
|---|---|---|
| Entry JS (index only), raw / gzip | 86.4 kB / 27.3 kB | 60.9 kB / 19.1 kB |
| Entry JS + modulepreloaded chunks, raw / gzip | 504.5 kB / 167.1 kB | 478.8 kB / 156.5 kB |
| Entry CSS, raw / gzip | 70.5 kB / 13.9 kB | 70.5 kB / 13.9 kB |
| Precache (workbox) | 132 entries, 2052 KiB | 142 entries, 2059 KiB (+2 icon PNGs, +lazy chunks) |
| Today heading visible (4x CPU, Fast 3G), median | 6947 ms | 6698 ms |

Startup is dominated by latency and the vendor chunk, so the win is the 8 kB gzip the entry no longer carries.

## How the game layer loads
- `PlayerProvider` renders children at once. It mounts the lazy `EngineHost` (usePlayer + snapshot + quest/XP engine) when the browser is idle
  (`requestIdleCallback`, 200 ms timeout fallback) or when `MissionBoard` mounts (`engineGate.requestEngine`).
- Until then `usePlayerState()` returns `EMPTY_PLAYER` (`loading: true`); MissionBoard/rail/strip already show skeletons or nothing for it.
- Calm mode: the provider supplies a `calm: true, loading: false` player and never mounts `EngineHost`, so the engine chunk is never requested.
- `MomentHost` is a lazy chunk (renders nothing until the engine delivers a real change).
- Pages and heavy features (Career, Learning, People, Planner, Body, Finance) were already route chunks; no further cheap wins found.

## PWA
Precache includes `EngineHost` and `MomentHost`. Offline reload of Today works; the update prompt appears after a second build is deployed
(`scripts/pwa-check.mjs`, also covered by `e2e/perf.spec.ts` for lazy loading and Calm).

## Brand
Icons regenerated in graphite `#0b0b10` + violet `#8b7cf0` (maskable mark inside the 80% safe zone). `index.html` has theme-color, `color-scheme: dark`
and an inline html/body background so there is no white or amber flash before the stylesheet loads.
