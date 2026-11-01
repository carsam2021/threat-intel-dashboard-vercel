import {test,expect} from '@playwright/test';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p6sAAAAASUVORK5CYII=','base64');
const item=(host:string,n=0,image=true)=>`<item><title>${host} security story ${n}</title><link>https://${host}/story-${n}</link><description><![CDATA[Threat intelligence story ${n}]]></description><pubDate>Sat, 31 Oct 2026 12:00:00 GMT</pubDate>${image?'<enclosure url="https://images.example.test/story.jpg" type="image/jpeg"/>':''}</item>`;
const xml=(host:string)=>`<?xml version="1.0"?><rss version="2.0"><channel><title>${host}</title>${item(host)}</channel></rss>`;
const feedXml=(host:string,count:number,image=true)=>`<?xml version="1.0"?><rss version="2.0"><channel><title>${host}</title>${Array.from({length:count},(_,n)=>item(host,n,image)).join('')}</channel></rss>`;

test.beforeEach(async({page})=>{
  await page.route('**/api/fetch-rss',async route=>{
    const host=new URL(route.request().postDataJSON().url).hostname;
    if(host==='www.darkreading.com'){
      const dark=`<item><title>Dark Reading featured image story</title><link>https://www.darkreading.com/story-image</link><description><![CDATA[<p>Dark Reading preview <img loading="lazy" data-src="https://images.example.test/darkreading.jpg" alt="preview"></p>]]></description><pubDate>Sat, 31 Oct 2026 12:00:00 GMT</pubDate></item>`;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:`<rss version="2.0"><channel><title>Dark Reading</title>${dark}${item(host,2,false)}</channel></rss>`})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:xml(host)})});
  });
  await page.route('**/api/fetch-og-image',async route=>{
    const urls=route.request().postDataJSON().urls as string[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({images:Object.fromEntries(urls.map(u=>[u,'https://images.example.test/og.jpg']))})});
  });
  await page.route('https://images.example.test/**',route=>route.fulfill({status:200,contentType:'image/png',body:png}));
  await page.goto('/');
});

test('loads all six built-in feeds and stories',async({page})=>{
  await expect(page.getByRole('heading',{name:'Cyber Threat Intelligence Dashboard'})).toBeVisible();
  await expect(page.getByText('All feeds loaded (6)')).toBeVisible({timeout:15000});
  await expect(page.locator('.feed-widget')).toHaveCount(6);
  await expect(page.getByText(/security story/).first()).toBeVisible();
});
test('adds a custom feed and persists it after reload',async({page})=>{
  await page.route('**/api/fetch-rss',async route=>{
    const url=route.request().postDataJSON().url;
    if(url.includes('example.org'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:xml('example.org')})});
    const host=new URL(url).hostname;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:xml(host)})});
  });
  await page.getByRole('button',{name:'Add New Feed'}).click();
  await page.getByLabel('Feed Title').fill('Example Feed');
  await page.getByLabel('Feed URL').fill('https://example.org/rss.xml');
  await page.getByLabel('Description (optional)').fill('Test source');
  await page.getByRole('button',{name:'Add Feed'}).click();
  await expect(page.getByRole('heading',{name:'Example Feed'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dashboard-user-feeds')||'[]').some((f:any)=>f.title==='Example Feed'))).toBe(true);
  await page.reload();await expect(page.getByRole('heading',{name:'Example Feed'})).toBeVisible();
});
test('rejects unsafe and duplicate feed URLs',async({page})=>{
  await page.getByRole('button',{name:'Add New Feed'}).click();
  await page.getByLabel('Feed Title').fill('Invalid');
  await page.getByLabel('Feed URL').fill('http://127.0.0.1/feed.xml');
  await page.getByRole('button',{name:'Add Feed'}).click();
  await expect(page.getByRole('alert')).toContainText('Private or local');
  await page.getByLabel('Feed URL').fill('https://www.bleepingcomputer.com/feed/');
  await page.getByRole('button',{name:'Add Feed'}).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
});
test('global search finds stories and reset clears the query',async({page})=>{
  await page.getByLabel('Search all news sources').fill('security story');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByText(/search results/)).toBeVisible();
  await expect(page.locator('.search-result').first()).toBeVisible();
  await page.getByRole('button',{name:'Clear search'}).click();
  await expect(page.locator('.search-results')).toHaveCount(0);
});
test('search presents an empty state for unmatched text',async({page})=>{
  await page.getByLabel('Search all news sources').fill('no-such-threat-phrase');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByText('No matching stories. Try another search.')).toBeVisible();
});
test('watchlist adds, removes, persists and drives global search',async({page})=>{
  await page.getByLabel('New watchlist keyword').fill('zero day');
  await page.getByRole('button',{name:'Add keyword'}).click();
  const keyword=page.locator('.keyword-chip > button').first();
  await expect(keyword).toContainText('zero day');
  await keyword.click();
  await expect(page.getByLabel('Search all news sources')).toHaveValue('zero day');
  await page.reload();
  await expect(page.locator('.keyword-chip > button').filter({hasText:'zero day'})).toBeVisible();
  await page.locator('.keyword-chip .remove-keyword').click();
  await expect(page.locator('.keyword-chip').filter({hasText:'zero day'})).toHaveCount(0);
});
test('watchlist can be minimised and restored',async({page})=>{
  await page.getByRole('button',{name:'Minimise watchlist'}).click();
  await expect(page.getByLabel('New watchlist keyword')).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('New watchlist keyword')).toHaveCount(0);
  await page.getByRole('button',{name:'Expand watchlist'}).click();
  await expect(page.getByLabel('New watchlist keyword')).toBeVisible();
});
test('feed and card modes both persist across reloads',async({page})=>{
  await page.getByRole('button',{name:'Switch to card view'}).click();
  await expect(page.getByTestId('card-view-grid')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('dashboard-view-mode'))).toBe('card');
  await page.reload();await expect(page.getByTestId('card-view-grid')).toBeVisible();
  await page.getByRole('button',{name:'Switch to feed view'}).click();
  await expect(page.locator('.widget-grid')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('dashboard-view-mode'))).toBe('feed');
  await page.reload();await expect(page.locator('.widget-grid')).toBeVisible();
});
test('Dark Reading inline lazy image attributes are extracted and displayed',async({page})=>{
  await page.getByRole('button',{name:'Switch to card view'}).click();
  const card=page.locator('.news-card').filter({hasText:'Dark Reading featured image story'});
  await expect(card.locator('.news-image')).toHaveAttribute('src','https://images.example.test/darkreading.jpg');
  await expect.poll(()=>card.locator('.news-image').evaluate((el:HTMLImageElement)=>el.complete&&el.naturalWidth>0)).toBe(true);
});
test('article Open Graph images are lazily resolved and cached across reloads',async({page})=>{
  let calls=0;
  await page.route('**/api/fetch-og-image',async route=>{
    calls++;
    const urls=route.request().postDataJSON().urls as string[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({images:Object.fromEntries(urls.map(u=>[u,'https://images.example.test/og.jpg']))})});
  });
  await page.getByRole('button',{name:'Switch to card view'}).click();
  const card=page.locator('.news-card').filter({hasText:'security story 2'});
  await expect(card.locator('.news-image')).toHaveAttribute('src','https://images.example.test/og.jpg',{timeout:15000});
  await expect.poll(()=>page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('og-image-cache-v1')||'{}')).length)).toBeGreaterThan(0);
  const initial=calls;await page.reload();await page.getByRole('button',{name:'Switch to card view'}).click();
  await expect(page.locator('.news-card').filter({hasText:'security story 2'}).locator('.news-image')).toHaveAttribute('src','https://images.example.test/og.jpg');
  expect(calls).toBe(initial);
});
test('Open Graph requests are batched to ten URLs or fewer',async({page})=>{
  const requests:number[]=[];
  await page.route('**/api/fetch-rss',async route=>{
    const url=route.request().postDataJSON().url,host=new URL(url).hostname;
    const content=host==='www.darkreading.com'?feedXml(host,12,false):xml(host);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content})});
  });
  await page.setViewportSize({width:1600,height:5000});
  await page.reload();
  await page.route('**/api/fetch-og-image',async route=>{
    const urls=route.request().postDataJSON().urls as string[];requests.push(urls.length);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({images:Object.fromEntries(urls.map(u=>[u,'https://images.example.test/og.jpg']))})});
  });
  await page.getByRole('button',{name:'Switch to card view'}).click();
  await expect.poll(()=>requests.reduce((a,b)=>a+b,0),{timeout:15000}).toBeGreaterThanOrEqual(12);
  expect(requests.every(n=>n<=10)).toBe(true);
});
test('uses cached feed stories and marks the feed stale when upstream is unavailable',async({page})=>{
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
    const req=indexedDB.open('threat-intel-feed-cache',1);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{const db=req.result;const tx=db.transaction('feed-snapshots','readwrite');
      tx.objectStore('feed-snapshots').put({key:'feed-cache:https://www.bleepingcomputer.com/feed',items:[{title:'Cached fallback story',link:'https://example.com/cached',contentSnippet:'cached item',source:'bleepingcomputer.com',feedTitle:'Bleeping Computer'}],fetchedAt:Date.now()-60000});
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)};
  }));
  await page.route('**/api/fetch-rss',async route=>{
    const url=route.request().postDataJSON().url;
    if(url.includes('bleepingcomputer'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({error:'upstream unavailable',upstreamUnavailable:true})});
    const host=new URL(url).hostname;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:xml(host)})});
  });
  await page.reload();
  const widget=page.locator('.feed-widget').filter({hasText:'Bleeping Computer'});
  await expect(widget.getByText('STALE CACHE',{exact:true})).toBeVisible({timeout:15000});
  await expect(widget.locator('.widget-story').filter({hasText:'Cached fallback story'})).toBeVisible({timeout:10000});
});
test('feed editing and confirmed deletion work',async({page})=>{
  await page.getByRole('button',{name:'Configure Bleeping Computer'}).click();
  await page.getByLabel('Feed Title').fill('Edited Feed');
  await page.getByRole('button',{name:'Save Changes'}).click();
  await expect(page.getByRole('heading',{name:'Edited Feed'})).toBeVisible();
  await page.getByRole('button',{name:'Delete Edited Feed'}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button',{name:'Delete Feed'}).click();
  await expect(page.getByRole('heading',{name:'Edited Feed'})).toHaveCount(0);
});
test('ticker contains recent stories and pauses on hover',async({page})=>{
  const ticker=page.locator('.ticker-band');
  await expect(ticker).toBeVisible();
  await expect(ticker.locator('.ticker-track a').first()).toBeVisible();
  await ticker.hover();
  await expect(ticker.locator('.ticker-track')).toHaveCSS('animation-play-state','paused');
});

test('ticker keeps a readable constant speed when the feed contains many stories',async({page})=>{
  await page.route('**/api/fetch-rss',async route=>{
    const url=route.request().postDataJSON().url,host=new URL(url).hostname;
    const content=host==='www.darkreading.com'?feedXml(host,60,false):xml(host);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content})});
  });
  await page.reload();
  const track=page.locator('.ticker-track');
  await expect(track.locator('a')).toHaveCount(130,{timeout:15000});
  await expect.poll(()=>track.evaluate(el=>parseFloat(getComputedStyle(el).animationDuration))).toBeGreaterThan(20);
  const metrics=await track.evaluate(el=>({duration:parseFloat(getComputedStyle(el).animationDuration),distance:el.scrollWidth/2}));
  const pixelsPerSecond=metrics.distance/metrics.duration;
  expect(pixelsPerSecond).toBeGreaterThanOrEqual(30);
  expect(pixelsPerSecond).toBeLessThanOrEqual(40);
});
