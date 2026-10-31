# Port Status and Remaining Work

This document distinguishes implemented Vercel-port behavior from the original Lovable application's documented architecture. A passing build or mocked Playwright suite is not proof of full feature parity.

## Implemented

- Six built-in RSS/Atom feeds and user-added feeds.
- Server-side RSS fetching with fallback sources.
- IndexedDB feed snapshots (up to 100 stories/feed) and stale-cache fallback.
- Global search capped at 5,000 loaded stories.
- Persistent watchlist, counts, keyword-to-search action, and minimised state.
- Feed view and card view, with the selected mode persisted in `dashboard-view-mode`.
- Feed/card story deduplication and newest-first card ordering.
- Inline RSS image extraction, lazy OG lookup, 200ms debounce, 10-URL batches, seven-day/500-entry OG URL cache.
- 90-second yellow ticker with recent stories and watchlist matches.
- Vercel API endpoints and Playwright coverage documented in [testing.md](./testing.md).

## Known parity gaps

| Priority | Gap | Original documented behavior | Current Vercel port |
| --- | --- | --- | --- |
| High | Responsive widget layout engine | `react-grid-layout` with lg/md/sm/xs/xxs breakpoints | CSS grid with drag ordering and native resize; no breakpoint-specific saved layout engine |
| High | Per-breakpoint layout persistence | Independent widget coordinates and sizes per breakpoint | Simplified `dashboard-layouts` ordering metadata; not equivalent to original layout arrays |
| Medium | Feed loading retry policy | One retry after 2 seconds through TanStack Query | Manual retry and 15-minute refresh; no equivalent TanStack retry policy |
| Medium | Card-mode skeleton/progress parity | Skeleton cards and CardView progress callback | Basic card grid; progress is feed-state based rather than card-enrichment progress |
| Medium | Unit/component test suite | Vitest coverage for parser, security, cache, search, watchlist and dialogs | Playwright E2E suite only; no equivalent unit/component suite |
| Medium | Full production image integration | Original OG function follows validated redirects and publisher-specific paths | Redirect support is implemented in the Vercel OG function, but live publisher acceptance and image CDN delivery still need deployment-level verification |
| Low | Routing parity | Explicit not-found route for unknown paths | SPA rewrite sends unknown paths to the app shell; no dedicated not-found route |
| Low | Shared domain stores | Feed config/search/watchlist are separate services/stores | Most state and logic remain concentrated in `src/App.tsx` |

## Security and operations follow-ups

- Review the feed endpoint's SSRF protections, especially DNS resolution and redirect revalidation, against the original security requirements.
- Run `npm audit` and update vulnerable dependencies deliberately; do not use `npm audit fix --force` without reviewing breaking changes.
- Keep Vercel build logs and GitHub Actions results as deployment gates.
- Run real-feed smoke checks for Bleeping Computer and Dark Reading after deployment, including image status, redirect handling and response times.

## Completion criteria

Do not call the Vercel port architecture-equivalent until the responsive breakpoint layout/persistence, unit/component coverage, retry semantics, and remaining routing/loading differences are either implemented or explicitly accepted as intentional deviations. Do not call publisher image behavior verified until a live deployed smoke test confirms real image URLs and successful browser image loads.
