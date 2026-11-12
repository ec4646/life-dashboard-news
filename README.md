# Dashboard news

Daily headlines for a personal dashboard.

`fetch-news.mjs` reads the RSS feeds listed in `feeds.json` and writes `news.json`: the newest few headlines per topic, mixed across sources. It stores only each story's headline, source, link and time.

To change topics or sources, edit `feeds.json`.

```bash
node fetch-news.mjs
```

## Prices

`fetch-prices.mjs` looks up delayed prices on Yahoo Finance for the holdings listed in `holdings.json` and writes `prices.json`, in pounds. It runs every hour on weekdays. If a price cannot be fetched, the last one is kept and marked `stale`.

Each holding has an `id`, matching the identifier (or name) in the Barclays export, and a Yahoo `symbol`, such as `VUSA.L` for London.

```bash
node fetch-prices.mjs
```
