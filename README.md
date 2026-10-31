# Threat Intelligence Dashboard (Vercel)

A React, TypeScript and Vite dashboard that aggregates cybersecurity RSS/Atom feeds into feed widgets and a unified card view. It includes global search, a keyword watchlist, a 24-hour/watchlist ticker, browser-local preferences and offline-tolerant feed caching.

## Local development

- Node.js 20+
- `npm install`
- `npm run dev` (http://localhost:3000)
- `npm run build`

## Architecture

- `/api/fetch-rss` fetches RSS/Atom feeds server-side, with upstream fallbacks.
- `/api/fetch-og-image` resolves article preview images in safe, bounded batches.
- IndexedDB stores feed snapshots (up to 100 stories per feed).
- localStorage stores custom feeds, view preference, watchlist and a seven-day/500-entry OG image URL cache.
- No authentication or server-side user database is required.

See [docs/architecture.md](docs/architecture.md) for the request and cache flows, [docs/testing.md](docs/testing.md) for automated coverage, and [docs/known-gaps.md](docs/known-gaps.md) for the remaining differences from the original Lovable architecture.

## Tests

```sh
npx playwright install chromium
npm test
npm run build
```

The Playwright suite mocks feed and OG endpoints. It checks dashboard functionality deterministically; it does not replace live publisher smoke tests. See [docs/testing.md](docs/testing.md).

## Current parity note

The Vercel port is functional but not yet a complete architectural replica. In particular, its feed layout uses CSS grid, drag ordering and native resize rather than the original breakpoint-specific `react-grid-layout` engine. The known gaps and completion criteria are tracked in [docs/known-gaps.md](docs/known-gaps.md).
