# Testing and Verification

## 1. Commands

```bash
npm install
npx playwright install chromium
npm test
npm run build
```

The Playwright suite uses mocked `/api/fetch-rss` and `/api/fetch-og-image` responses. Tests do not rely on publisher availability, publisher hotlink policy, or live article pages.

## 2. Current end-to-end coverage

| Area | Automated scenarios |
| --- | --- |
| Startup | Six built-in feed widgets and stories load |
| Feed management | Add custom feed, persist on reload, reject duplicate and unsafe URLs, edit feed, confirm deletion |
| Search | Search across loaded stories, clear/reset, empty result state |
| Watchlist | Add, remove, persist, minimise/restore, click keyword to populate global search |
| View preference | Card and feed mode each survive a full page reload |
| RSS image parsing | Dark Reading-style HTML image markup with `data-src` is extracted and rendered |
| OG enrichment | Missing inline image is lazily resolved, persisted in seven-day cache, and reused after reload |
| OG batching | Requests contain no more than 10 article URLs |
| Feed resilience | IndexedDB snapshot is shown and marked stale after a simulated upstream failure |
| Ticker | Recent story links render and animation pauses on hover |

## 3. Test design rules

- Use accessible roles and labels wherever possible.
- Stub network boundaries, not individual UI internals.
- Serve a tiny local test image from Playwright routes so image tests assert `naturalWidth` rather than depending on remote hosts.
- Seed IndexedDB only when testing cache recovery.
- Verify persisted values before reload to avoid racing the persistence effect.

## 4. What these tests do not prove

- They do not prove that every publisher's live RSS feed is currently available.
- They do not prove that a publisher permits hotlinking or that its image CDN is fast.
- Mocked OG responses do not test real Vercel network access, anti-bot protection, or the publisher's redirect chain. Verify the deployed `/api/fetch-og-image` function against real Dark Reading and other publishers as a separate integration check.
- They do not yet cover responsive breakpoint-specific drag/resize persistence because the current Vercel port does not implement the original `react-grid-layout` breakpoint model.
