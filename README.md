# Threat Intelligence Dashboard (Vercel)

A lightweight React/Vite cyber-threat news dashboard deployed on Vercel.

## Local development
- Node.js 20+
- `npm install`
- `npm run dev` (http://localhost:3000)
- `npm run build`

The `/api/rss` Vercel function fetches and parses RSS/Atom feeds server-side. It supports the six built-in feeds and up to 20 public HTTP(S) feed URLs, including user-added feeds. User-added feed definitions are stored in browser localStorage.

## End-to-end tests
Install the browser once, then run the deterministic Playwright suite:
```sh
npx playwright install chromium
npm test
```
Tests stub `/api/rss`; they do not depend on upstream publishers or external image availability.

Article publishers may omit images or block hotlinking. Cards use a placeholder if an image URL is missing or fails to load. If publishers are temporarily unavailable, the dashboard shows sample fallback stories with a status notice.
