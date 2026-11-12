# Dashboard news

Daily headlines for a personal dashboard.

`fetch-news.mjs` reads the RSS feeds listed in `feeds.json` and writes `news.json`: the newest few headlines per topic, mixed across sources. It stores only each story's headline, source, link and time.

To change topics or sources, edit `feeds.json`.

```bash
node fetch-news.mjs
```
