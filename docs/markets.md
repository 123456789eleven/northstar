# Markets: live prices foundation

Opt-in, owner's own Finnhub key. No advice, no trade execution (paper trading is simulated on-device).

## Architecture (`src/features/markets/`)
- `finnhub.ts` REST client: `createFinnhubClient()` and the app-wide `finnhub`. Strict per-endpoint validators, FIFO queue with a 60 calls/minute rolling budget, 429 back-off (honours `Retry-After`, else 30 s), AbortController timeout (10 s), in-memory TTL cache with in-flight de-duplication.
- `stream.ts` WebSocket (`wss://ws.finnhub.io?token=...`): ref-counted subscriptions (max 50 symbols), connects only while someone is subscribed, exponential backoff reconnect, closes after the tab is hidden for 60 s, exposes last trade per symbol.
- `history.ts` writes one `priceHistory` bar per symbol per trade day from real quotes (close = latest price that day; high/low widen). Never back-filled.
- `hooks.ts` `useFinnhubKey`, `useQuotes`, `useQuote`, `useMarketStatus`. Poll every 15 s while visible; stream trades overlay the polled quote when the socket is up.
- Pure math: `portfolio.ts`, `paper.ts` (plus `addPaperTrade` DB helper), `growth.ts`, `bonds.ts`.
- `KeySetup.tsx` the setup card (not mounted anywhere yet).

## Data (schema v7)
`watchlist` (unique symbol), `paperTrades`, `tradeJournal` sync like other tables (watchlist natural key = symbol). `priceHistory` (unique symbol+date) is a derived cache: device-local, never synced (listed in `INTERNAL_TABLES`), but included in backups and erase. Paper cash start is the setting `paper.startCash` (default 100000).

## Endpoints used (all free-tier)
| Endpoint | Use | Cache TTL |
|---|---|---|
| `GET /quote` | price, change, day range | 15 s |
| `GET /stock/profile2` | name, exchange, industry | 24 h |
| `GET /stock/metric?metric=all` | 52-week range, P/E, beta, yield | 1 h |
| `GET /company-news` | headlines (symbol + date range) | 10 min |
| `GET /search` | symbol lookup (typed text) | 10 min |
| `GET /stock/market-status` | open or closed | 60 s |
| `wss://ws.finnhub.io` | live trades | n/a |

## Free-tier findings
Finnhub's docs page is script-rendered and could not be read by the fetch tool, so this comes from secondary sources and should be re-checked against a real key: free plan is 60 API calls/minute (plus a roughly 30 calls/second cap); websocket free coverage is reported as up to 50 symbols, but one source says no real-time websocket on free, so the app must always work by polling alone; **`/stock/candle` (historical candles) is premium on current plans (403 for free keys), so it is never called**. Price history is built from our own daily recordings instead. `/stock/market-status` is not confirmed free in any source found; if it returns 403 the hook reports an error and the UI should hide the status pill.

## Privacy
Only ticker symbols (and a date range for news, and typed search text) are sent. Never balances, share counts, cost basis or records. The key is `market.finnhubKey`: device-local setting, in `LOCAL_SETTING_PREFIXES` (never synced), excluded from every backup and export (`SECRET_PREFIXES` in `lib/backup.ts`), kept across a restore, never logged, never rendered back in full (last 4 only). The key travels as a URL query parameter, which Finnhub's API requires. CSP `connect-src` adds only `https://finnhub.io` and `wss://ws.finnhub.io`. The service worker has no runtime caching, so Finnhub responses are never stored by it. Requests use `credentials: omit` and no referrer.

## Error states
`MarketError.code`: `NoKey` (prompt to add a key), `InvalidKey` (401/403), `RateLimited` (429 or local back-off, `retryAfterMs`), `Offline` (network failure), `Unavailable` (5xx, timeout, malformed or empty response, unknown symbol). UI should keep showing the last saved prices and say how old they are.
