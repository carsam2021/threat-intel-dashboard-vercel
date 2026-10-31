import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_TIMEOUT = 12000;
const DEFAULT_FEEDS = [
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://www.cisa.gov/uscert/ncas/current-activity.xml',
  'https://krebsonsecurity.com/feed/',
  'https://www.darkreading.com/rss.xml',
  'https://threatprotect.qualys.com/feed/'
];

function sanitizeText(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImage(xml: string) {
  const match = xml.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i) || xml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
  return match ? match[1] : undefined;
}

function extractItems(xml: string, sourceName: string) {
  const regex = /<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  const matches = Array.from(xml.matchAll(regex));

  return matches.map((match) => {
    const block = match[1];
    const title = sanitizeText(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? 'Untitled');
    const link = sanitizeText(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ?? '#');
    const description = sanitizeText(block.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i)?.[1] ?? '');
    const pubDate = sanitizeText(block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1] ?? '');
    const source = sanitizeText(sourceName);

    return {
      title,
      link,
      description: description.slice(0, 220),
      pubDate,
      source,
      imageUrl: extractImage(block)
    };
  }).filter((item) => item.title && item.link && item.link !== '#');
}

function nameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Threat Feed';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url : Array.isArray(req.query.url) ? req.query.url[0] : '';
  const feeds = rawUrl ? rawUrl.split(',').map((entry) => entry.trim()).filter(Boolean) : DEFAULT_FEEDS;

  try {
    const promises = feeds.slice(0, 6).map(async (feedUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ThreatIntelDashboard/1.0)',
            Accept: 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: controller.signal
        });

        if (!response.ok) return [];
        const xml = await response.text();
        return extractItems(xml, nameFromUrl(feedUrl));
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    });

    const resolved = await Promise.all(promises);
    const items = resolved.flat().slice(0, 60);

    return res.status(200).json({ items });
  } catch (error) {
    console.error('RSS fetch failed', error);
    return res.status(502).json({ items: [] });
  }
}
