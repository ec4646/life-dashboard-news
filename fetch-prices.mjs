// Fetches delayed prices from Yahoo Finance for the holdings listed in holdings.json
// and writes prices.json, with every price converted to pounds.
// If a price cannot be fetched, the last one is kept and marked "stale".
// No dependencies; needs Node 18+ for built-in fetch.
import { readFile, writeFile } from 'node:fs/promises';

const cfg = JSON.parse(await readFile(new URL('./holdings.json', import.meta.url)));
const OUT = new URL('./prices.json', import.meta.url);
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (life-dashboard prices)', Accept: 'application/json' };

let previous = { prices: {} };
try { previous = JSON.parse(await readFile(OUT)); } catch {}

const day = t => new Date(t * 1000).toISOString().slice(0, 10);
const round = n => Math.round(n * 1e4) / 1e4;

// Latest price and the previous session's close, in the quote's own currency.
async function quote(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=5d&interval=1d';
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const r = (await res.json())?.chart?.result?.[0];
  if (!r) throw new Error('no data');
  const closes = r.indicators?.quote?.[0]?.close || [];
  const bars = (r.timestamp || []).map((t, i) => ({ t, c: closes[i] })).filter(b => Number.isFinite(b.c));
  const last = bars.at(-1);
  const price = Number.isFinite(r.meta.regularMarketPrice) ? r.meta.regularMarketPrice : last?.c;
  if (!Number.isFinite(price) || price <= 0) throw new Error('no price');
  const at = r.meta.regularMarketTime || last?.t;
  const before = bars.filter(b => day(b.t) < day(at));
  return { price, prev: before.length ? before.at(-1).c : null, currency: r.meta.currency || 'GBP', time: new Date(at * 1000).toISOString() };
}

// How many pounds one unit of the currency is worth.
const fx = { GBP: 1, GBp: 0.01, GBX: 0.01 };
async function toPounds(currency) {
  if (fx[currency] == null) {
    const q = await quote('GBP' + currency.toUpperCase() + '=X');   // e.g. GBPUSD=X: dollars per pound
    fx[currency] = 1 / q.price;
  }
  return fx[currency];
}

const prices = {};
let fresh = 0;
for (const h of cfg.holdings) {
  try {
    const q = await quote(h.symbol);
    const rate = await toPounds(q.currency);
    prices[h.id] = { symbol: h.symbol, price: round(q.price * rate), prev: q.prev == null ? null : round(q.prev * rate), time: q.time };
    fresh++;
    console.log(`  ok   ${h.id} (${h.symbol}) £${prices[h.id].price}`);
  } catch (e) {
    const old = previous.prices?.[h.id];
    if (old) prices[h.id] = { ...old, stale: true };
    console.log(`  FAIL ${h.id} (${h.symbol}): ${e.message}${old ? ', kept the last price' : ''}`);
  }
}
if (cfg.holdings.length && !fresh) { console.error('No prices fetched; leaving prices.json untouched.'); process.exit(1); }
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), prices }, null, 1) + '\n');
console.log(`Wrote ${fresh} of ${cfg.holdings.length} prices.`);
