# Dashboard news

Daily headlines for a personal dashboard.

`fetch-news.mjs` reads the RSS feeds listed in `feeds.json` and writes `news.json`: the newest few headlines per topic, mixed across sources. It stores only each story's headline, source, link and time.

To change topics or sources, edit `feeds.json`.

```bash
node fetch-news.mjs
```

## Prices

`fetch-prices.mjs` looks up delayed prices on Yahoo Finance for the holdings listed in `holdings.json` and writes `prices.json`, in pounds. If a price cannot be fetched, the last one is kept and marked `stale`.

Each holding has an `id`, matching the identifier (or name) in the Barclays export, and a Yahoo `symbol`, such as `VUSA.L` for London.

```bash
node fetch-prices.mjs
```

## Latest headlines

`fetch-latest.mjs` reads the top-stories feeds under `latest` in `feeds.json` (BBC News and Sky News, sport left out) and writes `latest.json`: the newest ten headlines from the last 12 hours, for the dashboard's ticker. Rule: at least one in every four is good news. Every 4th headline comes from the feeds under `latest.good` (Good News Network, Reasons to be Cheerful, Good Good Good, last 72 hours) and is marked `good: true`; if there are too few good stories the top headlines are cut down to fit, never the other way round. The Life Dashboard and UPL Outreach tickers both read this file, so the rule covers both.

```bash
node fetch-latest.mjs
```

The prices and latest headlines run together every 15 minutes (`.github/workflows/live.yml`). Each script only rewrites its file when something changed, so quiet runs make no commit.
