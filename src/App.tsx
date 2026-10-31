import { AlertTriangle, ArrowUpRight, BellRing, Search, ShieldCheck, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type FeedItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
};

const DEFAULT_FEEDS = [
  'https://www.bleepingcomputer.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews',
  'https://www.cisa.gov/uscert/ncas/current-activity.xml',
  'https://krebsonsecurity.com/feed/'
];

const watchlist = ['ransomware', 'zero-day', 'phishing', 'supply chain', 'APT'];

function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/rss?url=${encodeURIComponent(DEFAULT_FEEDS.join(','))}`);
        const data = await response.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(needle));
  }, [items, query]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="eyebrow">Threat Intel</p>
            <h1>Cyber Threat Intelligence Dashboard</h1>
          </div>
        </div>
        <div className="search-wrap">
          <Search size={16} />
          <input
            aria-label="Search threats"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headlines, threats, or sources"
          />
        </div>
      </header>

      <div className="ticker-row">
        <div className="ticker-label">
          <TrendingUp size={16} />
          Active attention
        </div>
        <div className="ticker-track">
          {items.slice(0, 12).map((item, index) => (
            <span key={`${item.title}-${index}`} className="ticker-pill">
              {item.title}
            </span>
          ))}
        </div>
      </div>

      <main className="content-grid">
        <aside className="sidebar panel">
          <div className="panel-header">
            <BellRing size={16} />
            Watchlist
          </div>
          <div className="watchlist-grid">
            {watchlist.map((term) => (
              <button key={term} className="watch-tag" onClick={() => setQuery(term)}>
                {term}
              </button>
            ))}
          </div>
          <div className="stat-card">
            <div className="stat-label">Sources</div>
            <div className="stat-value">{DEFAULT_FEEDS.length}</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-label">Fresh alerts</div>
            <div className="stat-value">{items.length}</div>
          </div>
        </aside>

        <section className="feed-panel panel">
          <div className="panel-header">
            <AlertTriangle size={16} />
            Latest Security Headlines
          </div>

          {loading ? (
            <div className="loading-state">Loading threat intelligence…</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">No matching headlines found.</div>
          ) : (
            <div className="feed-list">
              {filteredItems.map((item, index) => (
                <article key={`${item.link}-${index}`} className="feed-card">
                  <div className="meta-row">
                    <span className="source-badge">{item.source}</span>
                    <span className="timestamp">{item.pubDate || 'recent'}</span>
                  </div>
                  <h2>
                    <a href={item.link} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h2>
                  <p>{item.description || 'Security briefing summary is unavailable for this item.'}</p>
                  <a className="read-more" href={item.link} target="_blank" rel="noreferrer">
                    Read more <ArrowUpRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
