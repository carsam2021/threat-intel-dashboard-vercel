import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Search, Plus, ExternalLink, Sparkles } from 'lucide-react';

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
};

const DEFAULT_FEEDS = [
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://www.cisa.gov/uscert/ncas/current-activity.xml',
  'https://krebsonsecurity.com/feed/',
  'https://www.darkreading.com/rss.xml',
  'https://threatprotect.qualys.com/feed/'
];

const WATCHLIST = ['ransomware', 'zero day', 'phishing', 'supply chain', 'APT'];

function timeAgo(input?: string) {
  if (!input) return 'just now';

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'recent';

  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

const fallbackFeedItems: FeedItem[] = [
  {
    title: 'China-based threat actors exploit new credential-stuffing campaign',
    description: 'Attackers are using repeat login attempts against cloud providers and identity platforms.',
    link: '#',
    pubDate: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
    source: 'BleepingComputer',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80'
  },
  {
    title: 'The Hacker News: new on-device malware bypasses endpoint controls',
    description: 'Security engineers detail a stealthy implant that evades standard EDR telemetry.',
    link: '#',
    pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: 'The Hacker News',
    imageUrl: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=900&q=80'
  }
];

function App() {
  const [items, setItems] = useState<FeedItem[]>(fallbackFeedItems);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/rss?url=${encodeURIComponent(DEFAULT_FEEDS.join(','))}`);
        const data = await response.json();
        const nextItems = Array.isArray(data.items) && data.items.length > 0 ? data.items : fallbackFeedItems;
        setItems(nextItems);
      } catch {
        setItems(fallbackFeedItems);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(q));
  }, [items, query]);

  const watchlistMatches = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (const item of items) {
      const haystack = `${item.title} ${item.description} ${item.source}`.toLowerCase();
      for (const term of WATCHLIST) {
        if (haystack.includes(term.toLowerCase()) && !seen.has(term)) {
          seen.add(term);
          count += 1;
        }
      }
    }
    return count;
  }, [items]);

  const tickerItems = useMemo(() => items.slice(0, 12), [items]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Cyber Threat Intelligence Dashboard</h1>
        <p>Latest news and updates from cybersecurity sources</p>
      </header>

      <div className="search-line">
        <input
          aria-label="Search all news sources"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all news sources..."
        />
        <button className="search-button">
          <Search size={16} />
          Search
        </button>
      </div>

      <div className="toolbar-row">
        <div className="watchlist-pill">
          <button type="button" aria-label="Watchlist">
            <Bell size={14} />
            Watchlist
          </button>
          <span className="badge">{watchlistMatches}</span>
        </div>
      </div>

      <div className="ticker-wrap">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <span key={`${item.title}-${index}`} className="ticker-chip">
              {item.source}: {item.title}
            </span>
          ))}
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div className="loading-status">
          <span className="dot" />
          Loading feeds: {loading ? '…' : `${visibleItems.length}/${items.length}`}
        </div>
        <button className="add-feed-button">
          <Plus size={14} />
          Add New Feed
        </button>
      </div>

      <main className="feed-grid">
        {visibleItems.map((item, index) => (
          <article key={`${item.title}-${index}`} className="feed-card">
            <div className="feed-header">
              <span className="source-badge">{item.source}</span>
              <span className="feed-time">{timeAgo(item.pubDate)}</span>
            </div>

            <h2>{item.title}</h2>

            <div className="card-image-wrap">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} />
              ) : (
                <div className="image-fallback">
                  <Sparkles size={22} />
                </div>
              )}
            </div>

            <div className="card-footer">
              <p>{item.description}</p>
              <a href={item.link === '#' ? undefined : item.link} target="_blank" rel="noreferrer">
                Read more <ExternalLink size={12} />
              </a>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}

export default App;
