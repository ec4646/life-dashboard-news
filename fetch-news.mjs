// Fetches the RSS/Atom feeds listed in feeds.json and writes news.json:
// the newest few headlines per topic, mixed across sources.
// No dependencies; needs Node 18+ for built-in fetch.
import { readFile, writeFile } from 'node:fs/promises';
import { load, key } from './rss.mjs';

const cfg = JSON.parse(await readFile(new URL('./feeds.json', import.meta.url)));
const OUT = new URL('./news.json', import.meta.url);

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
