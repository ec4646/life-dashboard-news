// Fetches the top-stories feeds under "latest" in feeds.json and writes latest.json:
// the newest headlines for the dashboard's ticker. Only rewrites the file when the
// headlines change, so a quiet run makes no commit.
//
// Rule: at least one in every `good.every` (4) headlines is good news, from the feeds
// under "latest.good". Every 4th slot is a good story, and the strip loops, so no run
// of four in a row is all bad news. If there are too few good stories, the top
// headlines are cut down to fit rather than break the rule. Good items carry good: true.
import { readFile, writeFile } from 'node:fs/promises';
import { load, key } from './rss.mjs';

const cfg = JSON.parse(await readFile(new URL('./feeds.json', import.meta.url))).latest;
const OUT = new URL('./latest.json', import.meta.url);

let previous = { items: [] };
try { previous = JSON.parse(await readFile(OUT)); } catch {}

const seen = new Set();
const fresh = (list, hours, skipUrls, skipTitles) => {
  const cutoff = Date.now() - hours * 36e5;
  const su = skipUrls ? new RegExp(skipUrls, 'i') : null;      // e.g. leave out sport
  const st = skipTitles ? new RegExp(skipTitles, 'i') : null;
  return list.flat()
    .filter(i => i.published && Date.parse(i.published) >= cutoff && !(su && su.test(i.url)) && !(st && st.test(i.title)))
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
    .filter(i => !seen.has(key(i.title)) && seen.add(key(i.title)));
};

const lists = await Promise.all(cfg.feeds.map(load));
const top = fresh(lists, cfg.maxAgeHours, cfg.skipUrls).slice(0, cfg.count);

const g = cfg.good;
const every = Math.max(2, g.every || 4), per = every - 1;           // 3 top stories, then 1 good one
const goodLists = await Promise.all(g.feeds.map(load));
let good = fresh(goodLists, g.maxAgeHours, null, g.skipTitles).map(i => ({ ...i, good: true }));
// A feed outage should not empty the ticker: fall back to the good stories from the last run.
if (!good.length) good = (previous.items || []).filter(i => i.good);

const need = Math.ceil(top.length / per);
const useGood = good.slice(0, need);
const useTop = top.slice(0, useGood.length * per);                  // too few good stories: fewer top ones
const items = [];
useTop.forEach((i, n) => { items.push(i); if (n % per === per - 1) items.push(useGood[(n + 1) / per - 1]); });
if (useTop.length % per) items.push(useGood[useGood.length - 1]);  // last, short group still ends on a good one

if (!items.length) { console.error('No recent headlines with good news to pair; leaving latest.json untouched.'); process.exit(lists.flat().length ? 0 : 1); }
if (JSON.stringify(items) === JSON.stringify(previous.items)) { console.log('No new headlines.'); process.exit(0); }
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1) + '\n');
console.log(`Wrote ${items.length} headlines (${useGood.length} good news).`);
