// Fetches the RSS/Atom feeds listed in feeds.json and writes news.json:
// the newest few headlines per topic, mixed across sources.
// No dependencies; needs Node 18+ for built-in fetch.
import { readFile, writeFile } from 'node:fs/promises';

const cfg = JSON.parse(await readFile(new URL('./feeds.json', import.meta.url)));
const OUT = new URL('./news.json', import.meta.url);

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
function clean(s) {
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decode(s);
  if (/&(#x?[0-9a-f]+|[a-z]+);/i.test(s)) s = decode(s);   // some feeds double-encode
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? clean(m[1]) : '';
}
function link(block) {
  const rss = tag(block, 'link');
  if (/^https?:\/\//i.test(rss)) return rss;
  const links = block.match(/<link\b[^>]*>/gi) || [];
  const alt = links.find(l => /rel=["']alternate["']/i.test(l)) || links.find(l => !/rel=/i.test(l)) || links[0];
  const href = alt && alt.match(/href=["']([^"']+)["']/i);
  return href ? decode(href[1]) : '';
}
function parse(xml, source) {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return blocks.map(b => {
    const when = Date.parse(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    return { title: tag(b, 'title').slice(0, 200), url: link(b), source, published: Number.isFinite(when) ? new Date(when).toISOString() : null };
  }).filter(i => i.title && /^https?:\/\//i.test(i.url));
}
async function load(feed) {
  try {
    const res = await fetch(feed.url, { headers: { 'User-Agent': 'life-dashboard-news/1.0 (RSS reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const items = parse(await res.text(), feed.source);
    console.log(`  ${items.length ? 'ok ' : 'EMPTY'} ${feed.source} (${items.length})`);
    return items;
  } catch (e) {
    console.log(`  FAIL ${feed.source}: ${e.message}`);
    return [];
  }
}
const key = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Newest stories first, taking turns between sources so one busy site cannot fill the list.
function pick(lists, n, seen) {
  const cutoff = Date.now() - cfg.maxAgeDays * 864e5;
  const queues = lists.map(l => l.filter(i => !i.published || Date.parse(i.published) >= cutoff)
    .sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0)));
  const out = [];
  while (out.length < n && queues.some(q => q.length)) {
    for (const q of queues) {
      let item;
      while ((item = q.shift()) && (seen.has(key(item.title)) || seen.has(item.url)));
      if (item) { seen.add(key(item.title)); seen.add(item.url); out.push(item); if (out.length === n) break; }
    }
  }
  return out.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
}

let previous = { topics: [] };
try { previous = JSON.parse(await readFile(OUT)); } catch {}

const seen = new Set();
const topics = [];
for (const t of cfg.topics) {
  console.log(t.name);
  const lists = await Promise.all(t.feeds.map(load));
  let items = pick(lists, cfg.perTopic, seen);
  if (!items.length) items = (previous.topics.find(p => p.id === t.id) || {}).items || [];   // keep yesterday's rather than show nothing
  topics.push({ id: t.id, name: t.name, items });
}
const total = topics.reduce((n, t) => n + t.items.length, 0);
if (!total) { console.error('No stories fetched; leaving news.json untouched.'); process.exit(1); }
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), topics }, null, 1) + '\n');
console.log(`Wrote ${total} stories across ${topics.length} topics.`);
