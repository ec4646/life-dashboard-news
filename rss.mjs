// Shared RSS/Atom reading for fetch-news.mjs and fetch-latest.mjs.
// No dependencies; needs Node 18+ for built-in fetch.

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

// Fetches one feed. Returns its stories, or an empty list if it could not be read.
export async function load(feed) {
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

// Loose title key, so the same story from two sources counts once.
export const key = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
