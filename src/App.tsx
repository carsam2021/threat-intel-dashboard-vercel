import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Search, Plus, ExternalLink, Sparkles, X } from 'lucide-react';
type FeedItem = { title: string; link: string; description: string; pubDate: string; source: string; imageUrl?: string };
type Feed = { title: string; url: string };
const DEFAULT_FEEDS: Feed[] = [
 {title:'BleepingComputer',url:'https://www.bleepingcomputer.com/feed/'},
 {title:'The Hacker News',url:'https://feeds.feedburner.com/TheHackersNews'},
 {title:'CISA Advisories',url:'https://www.cisa.gov/uscert/ncas/current-activity.xml'},
 {title:'Krebs on Security',url:'https://krebsonsecurity.com/feed/'},
 {title:'Dark Reading',url:'https://www.darkreading.com/rss.xml'},
 {title:'Qualys Threat Protection',url:'https://threatprotect.qualys.com/feed/'}
];
const WATCHLIST=['ransomware','zero day','phishing','supply chain','APT'];
const STORAGE_KEY='threat-intel-custom-feeds';
const fallbackFeedItems: FeedItem[]=[
 {title:'China-based threat actors exploit new credential-stuffing campaign',description:'Attackers are using repeat login attempts against cloud providers and identity platforms.',link:'https://www.bleepingcomputer.com/',pubDate:new Date(Date.now()-19*60000).toISOString(),source:'BleepingComputer',imageUrl:'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80'},
 {title:'New on-device malware bypasses endpoint controls',description:'Security engineers detail a stealthy implant that evades standard EDR telemetry.',link:'https://thehackernews.com/',pubDate:new Date(Date.now()-2*3600000).toISOString(),source:'The Hacker News',imageUrl:'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=900&q=80'}
];
function timeAgo(input?:string){if(!input)return'recent';const d=new Date(input);if(Number.isNaN(d.getTime()))return'recent';const m=Math.max(1,Math.round((Date.now()-d.getTime())/60000));return m<60?`${m}m ago`:m<1440?`${Math.round(m/60)}h ago`:`${Math.round(m/1440)}d ago`;}
function App(){
 const [feeds,setFeeds]=useState<Feed[]>(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') as Feed[];return [...DEFAULT_FEEDS,...saved.filter(f=>f&&typeof f.title==='string'&&typeof f.url==='string')]}catch{return DEFAULT_FEEDS}});
 const [items,setItems]=useState<FeedItem[]>(fallbackFeedItems),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[dialogOpen,setDialogOpen]=useState(false),[feedTitle,setFeedTitle]=useState(''),[feedUrl,setFeedUrl]=useState(''),[formError,setFormError]=useState(''),[notice,setNotice]=useState('');
 async function loadFeeds(list:Feed[]){setLoading(true);try{const response=await fetch('/api/rss?url='+encodeURIComponent(list.map(f=>f.url).join(',')));if(!response.ok)throw new Error('RSS request failed');const data=await response.json();const next:FeedItem[]=Array.isArray(data.items)?data.items:[];setItems(next.length?next:fallbackFeedItems);setNotice(next.length?'':'Live feeds returned no stories. Showing sample stories instead.')}catch{setItems(fallbackFeedItems);setNotice('Live feeds could not be reached. Showing sample stories; try again later.')}finally{setLoading(false)}}
 useEffect(()=>{void loadFeeds(feeds)},[]);
 useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(feeds.filter(f=>!DEFAULT_FEEDS.some(d=>d.url===f.url))))},[feeds]);
 const visibleItems=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(i=>`${i.title} ${i.description} ${i.source}`.toLowerCase().includes(q)):items},[items,query]);
 const matches=useMemo(()=>{const found=new Set<string>();for(const i of items)for(const term of WATCHLIST)if(`${i.title} ${i.description} ${i.source}`.toLowerCase().includes(term.toLowerCase()))found.add(term);return found.size},[items]);
 function addFeed(e:React.FormEvent){e.preventDefault();const title=feedTitle.trim(),url=feedUrl.trim();if(!title){setFormError('Enter a feed title.');return}let parsed:URL;try{parsed=new URL(url)}catch{setFormError('Enter a valid feed URL.');return}if(!['https:','http:'].includes(parsed.protocol)){setFormError('Feed URL must use HTTP or HTTPS.');return}if(feeds.some(f=>f.url.replace(/\/$/,'').toLowerCase()===url.replace(/\/$/,'').toLowerCase())){setFormError('This feed URL already exists.');return}const next=[...feeds,{title,url}];setFeeds(next);setFeedTitle('');setFeedUrl('');setFormError('');setDialogOpen(false);void loadFeeds(next)}
 const ticker=items.slice(0,12);
 return <div className="app-shell"><header className="topbar"><h1>Cyber Threat Intelligence Dashboard</h1><p>Latest news and updates from cybersecurity sources</p></header>
 <form className="search-line" onSubmit={e=>e.preventDefault()}><input aria-label="Search all news sources" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all news sources..."/><button className="search-button" type="submit"><Search size={16}/>Search</button></form>
 <div className="toolbar-row"><div className="watchlist-pill"><button type="button" aria-label="Watchlist"><Bell size={14}/>Watchlist</button><span className="badge">{matches}</span></div></div>
 <div className="ticker-wrap"><div className="ticker-track">{[...ticker,...ticker].map((i,n)=><span key={i.link+n} className="ticker-chip">{i.source}: {i.title}</span>)}</div></div>
 <div className="dashboard-toolbar"><div className="loading-status"><span className="dot"/>{loading?'Loading feeds…':`All feeds loaded (${visibleItems.length}/${items.length})`}</div><button className="add-feed-button" type="button" onClick={()=>{setFormError('');setDialogOpen(true)}}><Plus size={14}/>Add New Feed</button></div>
 {notice&&<p role="status" className="feed-notice">{notice}</p>}
 <main className="feed-grid">{visibleItems.map((item,index)=><article key={item.link+item.title+index} className="feed-card"><div className="feed-header"><span className="source-badge">{item.source}</span><span className="feed-time">{timeAgo(item.pubDate)}</span></div><h2>{item.title}</h2><div className="card-image-wrap">{item.imageUrl&&<img src={item.imageUrl} alt={item.title} loading="lazy" onError={e=>{e.currentTarget.style.display='none';const f=e.currentTarget.nextElementSibling as HTMLElement|null;if(f)f.style.display='grid'}}/>}<div className="image-fallback" style={{display:item.imageUrl?'none':'grid'}} aria-label="Image unavailable"><Sparkles size={22}/></div></div><div className="card-footer"><p>{item.description}</p><a href={item.link} target="_blank" rel="noopener noreferrer">Read more <ExternalLink size={12}/></a></div></article>)}{!loading&&!visibleItems.length&&<p role="status" className="empty-state">No stories match “{query}”. Try another search.</p>}</main>
 {dialogOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDialogOpen(false)}}><section className="feed-dialog" role="dialog" aria-modal="true" aria-labelledby="add-feed-title"><div className="dialog-heading"><h2 id="add-feed-title">Add New RSS Feed</h2><button type="button" className="dialog-close" aria-label="Close dialog" onClick={()=>setDialogOpen(false)}><X size={18}/></button></div><form onSubmit={addFeed}><label htmlFor="feed-title">Feed Title</label><input id="feed-title" value={feedTitle} onChange={e=>setFeedTitle(e.target.value)} placeholder="Enter feed title" autoFocus/><label htmlFor="feed-url">Feed URL</label><input id="feed-url" type="url" value={feedUrl} onChange={e=>setFeedUrl(e.target.value)} placeholder="https://example.com/feed.xml"/>{formError&&<p role="alert" className="form-error">{formError}</p>}<div className="dialog-actions"><button type="button" className="cancel-button" onClick={()=>setDialogOpen(false)}>Cancel</button><button type="submit" className="add-feed-button">Add Feed</button></div></form></section></div>}
 </div>
}
export default App;
