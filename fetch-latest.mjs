// Fetches the top-stories feeds under "latest" in feeds.json and writes latest.json:
// the newest headlines for the dashboard's ticker. Only rewrites the file when the
// headlines change, so a quiet run makes no commit.
import { readFile, writeFile } from 'node:fs/promises';
import { load, key } from './rss.mjs';

const cfg = JSON.parse(await readFile(new URL('./feeds.json', import.meta.url))).latest;
const OUT = new URL('./latest.json', import.meta.url);

let previous = { items: [] };
try { previous = JSON.parse(await readFile(OUT)); } catch {}

const cutoff = Date.now() - cfg.maxAgeHours * 36e5;
const skip = cfg.skipUrls ? new RegExp(cfg.skipUrls, 'i') : null;   // e.g. leave out sport
const lists = await Promise.all(cfg.feeds.map(load));
const seen = new Set();
const items = lists.flat()
  .filter(i => i.published && Date.parse(i.published) >= cutoff && !(skip && skip.test(i.url)))
  .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
  .filter(i => !seen.has(key(i.title)) && seen.add(key(i.title)))
  .slice(0, cfg.count);

if (!items.length) { console.error('No recent headlines; leaving latest.json untouched.'); process.exit(lists.flat().length ? 0 : 1); }
if (JSON.stringify(items) === JSON.stringify(previous.items)) { console.log('No new headlines.'); process.exit(0); }
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1) + '\n');
console.log(`Wrote ${items.length} headlines.`);
