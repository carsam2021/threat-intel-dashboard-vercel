# Threat Intelligence Dashboard — Vercel Architecture

## 1. Overview

The Vercel port is a client-rendered React + TypeScript + Vite single-page application. It has no account system or server-side user database. Feed definitions, view preference, watchlist, layout preferences and image lookup metadata are stored in the browser. Vercel Functions fetch feeds and article metadata so the browser does not need publisher CORS access.

```text
Browser (React SPA)
  ├─ Feed view / Card view
  ├─ Search index (up to 5,000 loaded stories)
  ├─ Watchlist + 24-hour / watchlist ticker
  ├─ localStorage: preferences, user feeds, OG image URL cache
  └─ IndexedDB: feed snapshots (up to 100 stories per feed)
          │
          ├─ POST /api/fetch-rss
          │      └─ publisher RSS/Atom + fallback proxies/mirror
          └─ POST /api/fetch-og-image
                 └─ article HTML → Open Graph / Twitter image URL
```

## 2. Runtime components

| Component | Location | Responsibility |
| --- | --- | --- |
| SPA entry | `src/main.tsx`, `src/App.tsx` | Dashboard UI, feed state, search, watchlist, ticker, card/feed modes |
| Styling | `src/index.css` | Dark dashboard theme, responsive CSS grid, ticker and card styling |
| RSS endpoint | `api/fetch-rss.ts` | Server-side RSS/Atom fetch with source fallbacks |
| OG endpoint | `api/fetch-og-image.ts` | Batched article-page fetch and metadata image extraction |
| E2E tests | `tests/dashboard.spec.ts` | Deterministic browser tests with mocked feed/image endpoints |
| Hosting | `vercel.json` | SPA rewrite and response security headers |

## 3. Feed loading and cache

1. On startup, each configured feed is read from IndexedDB (`threat-intel-feed-cache`, object store `feed-snapshots`).
2. If a snapshot exists, it is rendered immediately and marked stale while a live fetch runs.
3. The live request posts the feed URL to `/api/fetch-rss`.
4. RSS `item` and Atom `entry` elements are parsed, links are restricted to HTTP(S), story duplicates are removed using `link::title`, and the first available image candidate is extracted.
5. Successful results are written back to IndexedDB, capped at 100 items per feed.
6. If live fetch fails, the last successful snapshot remains visible with a stale indicator. A user can retry manually. Automatic refresh runs every 15 minutes.

## 4. Article image pipeline

Image sources are resolved in this order:

1. Inline RSS/Atom media: image enclosure, `media:content`, `media:thumbnail`, `image/url`, or image markup in description/summary/content.
2. If no inline image exists, Card View observes cards with an `IntersectionObserver` using a 300px root margin.
3. Visible article URLs are queued and debounced for 200ms.
4. The queue is sent to `/api/fetch-og-image` in batches of at most 10 URLs.
5. The function fetches the article page, follows at most five HTTP redirects after validating each target, and extracts `og:image`, `og:image:secure_url`, `twitter:image`, or `twitter:image:src`.
6. Image URL results (including negative lookups) are cached in `localStorage` under `og-image-cache-v1` for seven days, with at most 500 entries.

The browser still downloads the image bytes from the publisher/CDN. The persistent cache avoids repeating article-page metadata lookups; it is not a local image-byte cache or image CDN.

## 5. Browser persistence

| Key / store | Shape | Purpose |
| --- | --- | --- |
| `dashboard-user-feeds` | JSON array | User-added feeds only |
| `dashboard-layouts` | JSON object | Feed ordering/layout metadata |
| `dashboard-view-mode` | Plain string: `feed` or `card` | Selected view, restored on reload |
| `watchlist` | JSON string array | Watchlist keywords |
| `watchlist-minimized` | `true` / `false` | Collapsed watchlist state |
| `og-image-cache-v1` | URL → `{ img, ts }` | Seven-day OG lookup cache, max 500 |
| IndexedDB `threat-intel-feed-cache` | `feed-snapshots` store | Feed snapshots, max 100 items/feed |

Storage access is guarded where possible so a disabled or full browser store does not prevent the app from rendering.

## 6. Search, watchlist and ticker

- Search indexes loaded feed items in memory, deduplicates them and caps the index at 5,000 stories.
- Search matches title, snippet and feed title case-insensitively.
- Watchlist keywords are normalised to lower case, persisted, counted against indexed stories and can populate the global search.
- The ticker contains stories published in the last 24 hours plus watchlist matches regardless of age. Matching watchlist stories are labelled.
- Ticker animation is a 90-second marquee and pauses on hover.

## 7. Feed and card rendering modes

- Feed mode presents one widget per source. Users can drag widgets to reorder and use native CSS resize handles.
- Card mode merges all loaded feeds, deduplicates stories, sorts newest first, and lazy-resolves missing preview images.
- The selected mode is stored as a plain localStorage string and restored on startup.

## 8. Security boundaries

The API functions accept only HTTP(S) URLs, reject common private/local host patterns and validate redirect targets for article metadata fetches. Feed text is rendered as text, story links are restricted to HTTP(S), and external links use `noopener noreferrer`. See [security.md](./security.md) for the implemented controls and known residual risks.
