import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_TIMEOUT = 12000;
const SAFE_HOSTNAME_SUFFIXES = ['.gov', '.edu', '.mil'];

const DEFAULT_FEEDS = [
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://www.cisa.gov/uscert/ncas/current-activity.xml',
  'https://krebsonsecurity.com/feed/'
];

function isAllowedUrl(input: string): boolean {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return false;
    if (url.hostname.startsWith('127.') || url.hostname.startsWith('10.') || url.hostname.startsWith('192.168.')) return false;
    if (url.hostname.startsWith('172.')) {
      const second = Number(url.hostname.split('.')[1]);
      if (Number.isFinite(second) && second >= 16 && second <= 31) return false;
    }
    if (url.hostname.startsWith('169.254.')) return false;
    if (url.hostname.includes('private')) return false;
    const domain = url.hostname.toLowerCase();
    if (domain.endsWith('.local') || domain.endsWith('.internal')) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string; source: string }> {
  const findings: Array<{ title: string; link: string; description: string; pubDate: string; source: string }> = [];
  const itemRegex = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;

  const matches = [...xml.matchAll(itemRegex)];

  for (const match of matches) {
    const body = match[1];
    const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = body.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || body.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
    const descMatch = body.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i);
    const dateMatch = body.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);

    const title = decodeHtmlEntities((titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '') || 'Untitled');
    const link = decodeHtmlEntities((linkMatch?.[1] ?? '').replace(/<[^>]+>/g, '') || '#');
    const description = decodeHtmlEntities((descMatch?.[1] ?? '').replace(/<[^>]+>/g, '') || '');
    const pubDate = decodeHtmlEntities((dateMatch?.[1] ?? '').replace(/<[^>]+>/g, '') || '');

    if (!title || !link || link === '#') continue;

    findings.push({
      title: title.slice(0, 200),
      link,
      description: description.slice(0, 280),
      pubDate: pubDate.slice(0, 80),
      source: 'rss'
    });
  }

  return findings;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  const target = typeof url === 'string' ? url : (Array.isArray(url) ? url[0] : '');
  const feedUrl = target || DEFAULT_FEEDS.join(',');

  if (!feedUrl) {
    return res.status(400).json({ error: 'Missing RSS feed URL.' });
  }

  const urls = feedUrl
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);

  const feedTargets = urls.length > 0 ? urls : DEFAULT_FEEDS;

  try {
    const results = await Promise.all(
      feedTargets.map(async (targetUrl) => {
        if (!isAllowedUrl(targetUrl)) {
          return { feed: targetUrl, items: [] };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 ThreatIntelDashboard/1.0',
            Accept: 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });

        clearTimeout(timer);

        if (!response.ok) {
          return { feed: targetUrl, items: [] };
        }

        const xml = await response.text();
        return {
          feed: targetUrl,
          items: extractItems(xml).slice(0, 8)
        };
      })
    );

    const items = results.flatMap((result) => result.items.map((item) => ({ ...item, source: new URL(result.feed).hostname })));

    return res.status(200).json({
      items: items.slice(0, 30),
      total: items.length,
      feeds: results.length
    });
  } catch (error) {
    console.error('RSS fetch failed', error);
    return res.status(502).json({
      error: 'Unable to fetch RSS feeds from the upstream source.',
      items: []
    });
  }
}
