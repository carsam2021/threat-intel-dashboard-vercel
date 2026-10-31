import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_TIMEOUT = 10000;
const MAX_FEEDS = 20;
const DEFAULT_FEEDS = [
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://www.cisa.gov/uscert/ncas/current-activity.xml',
  'https://krebsonsecurity.com/feed/',
  'https://www.darkreading.com/rss.xml',
  'https://threatprotect.qualys.com/feed/'
];

function sanitizeText(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

function extractImage(xml: string) {
  const patterns = [
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i,
    /<media:thumbnail\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*>/i,
    /<media:content\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*>/i,
    /<enclosure\b[^>]*\burl\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']image\//i,
    /<enclosure\b[^>]*\btype\s*=\s*["']image\/[^"']+["'][^>]*\burl\s*=\s*["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].replace(/&amp;/gi, '&').trim();
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
      } catch { /* Ignore malformed image URLs and use the visual fallback. */ }
    }
  }
  return undefined;
}

function extractItems(xml: string, sourceName: string) {
  const matches = Array.from(xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi));
  const seen = new Set<string>();
  return matches.map(match => {
    const block = match[1];
    const title = sanitizeText(block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? 'Untitled');
    const linkMatch = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
    const link = (linkMatch?.[1] ?? sanitizeText(block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? '#')).replace(/&amp;/gi, '&').trim();
    const rawDescription = block.match(/<(?:description|summary|content:encoded|content)\b[^>]*>([\s\S]*?)<\/(?:description|summary|content:encoded|content)>/i)?.[1] ?? '';
    const description = sanitizeText(rawDescription);
    const pubDate = sanitizeText(block.match(/<(?:pubDate|published|updated|dc:date)\b[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/i)?.[1] ?? '');
    const identity = `${link}::${title}`;
    if (seen.has(identity)) return null;
    seen.add(identity);
    return { title, link, description: description.slice(0, 260), pubDate, source: sanitizeText(sourceName), imageUrl: extractImage(block) };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item && item.title && /^https?:\/\//i.test(item.link)));
}

function isPublicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1' || host === '[::1]') return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    return true;
  } catch { return false; }
}

function nameFromUrl(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return 'Threat Feed'; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed', items: [] });
  const raw = typeof req.query.url === 'string' ? req.query.url : Array.isArray(req.query.url) ? req.query.url[0] : '';
  const feeds = (raw ? raw.split(',') : DEFAULT_FEEDS).map(s => s.trim()).filter(Boolean).slice(0, MAX_FEEDS);
  const validFeeds = feeds.filter(isPublicHttpUrl);
  if (feeds.length && !validFeeds.length) return res.status(400).json({ error: 'Provide a valid public HTTP(S) feed URL.', items: [] });
  try {
    const results = await Promise.all(validFeeds.map(async feedUrl => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      try {
        const response = await fetch(feedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThreatIntelDashboard/1.0)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
          signal: controller.signal,
          redirect: 'follow'
        });
        if (!response.ok) return [];
        const xml = await response.text();
        if (!/<(?:rss|feed|rdf:RDF|channel)\b/i.test(xml)) return [];
        return extractItems(xml, nameFromUrl(feedUrl)).slice(0, 20);
      } catch { return []; } finally { clearTimeout(timer); }
    }));
    return res.status(200).json({ items: results.flat().slice(0, 200) });
  } catch (error) {
    console.error('RSS fetch failed', error);
    return res.status(502).json({ items: [] });
  }
}
