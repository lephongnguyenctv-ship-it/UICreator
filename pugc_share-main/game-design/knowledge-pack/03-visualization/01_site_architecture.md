---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/03-visualization/01-site-architecture.md"
---

# 01 — Site architecture

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Plain Node.js + Express, no build step, no framework. One `server.js`, static `public/`, model modules at
the root, scripts in `scripts/`, data in `data/`. Opens on `localhost:8503` (and LAN).

```
tools/balance-web/
  server.js                 routes: /api/* (JSON), static pages, admin (rebuild job, restart), version
  simulation-core.js        the Monte Carlo player
  *-model.js                one module per page family: reads data/, returns JSON for a page
  scripts/                  apply-*.js (decisions), *-times/*-facts (derived data), fit/import/export/check
  data/config/config__*.json   config mirror (proposal)      data/baselines/dev-<sha>/   dev snapshot
  data/*.json               derived + targets + params        data/proposals/            review-first outputs
  public/*.html + js/*.js   pages                             public/js/nav.js           shared menu
  public/css/style.css      dark theme, cards, tables, 9-slice classes for UI mockups
  public/assets/            sprites copied from the game, mockup scenes, plant icons
```

## Conventions that kept it manageable
- **One API per page** returning everything the page needs; `?dataset=dev` switches the data directory
  to the baseline. Pages fetch both and render a toggle "Đề xuất / Dev hiện tại" (proposal / dev).
- **`fresh(path)`** = require without cache for model files listed in `FRESH_FILES`, so editing a model
  does not need a server restart; `APP_VERSION` + file mtime shown in the header so the designer sees when
  the running server is older than disk ("restart server" button).
- **Shared nav** (`nav.js`): groups (Overview / Balance / Content / UI-UX / Data), each page has icon +
  title + one-line sub. Standardised page header; a global "Gọn / Đầy đủ" (compact / full) toggle hides
  long explanations by default — the designer asked for less text everywhere.
- **Dark theme CSS variables** (`--panel`, `--panel2`, `--accent`, `--accent2`, `--muted`), `.card`,
  tables with `.n` numeric cells, rarity colour classes `.r0…r5`, element tags.
- **Chart.js from CDN** for charts; everything else vanilla.
- **Background jobs**: rebuild-all and server restart are triggered from the "Đồng bộ" page with a
  progress endpoint, so the designer never opens a terminal.
- **Localized names**: `item-names.json` (en/vi) built from the game's `key.csv`; pages show Vietnamese.

## Minimal server skeleton
```js
const express = require('express'); const app = express(); const path = require('path'), fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data'); const DEV_BASELINE = 'dev-<sha>';
const fresh = p => { delete require.cache[require.resolve(p)]; return require(p); };
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/plant-roster', (req, res) => {
  const dev = req.query.dataset === 'dev';
  const r = fresh('./plant-roster-model.js').build(dev ? path.join(DATA_DIR, 'baselines', DEV_BASELINE) : DATA_DIR);
  r.dataset = dev ? DEV_BASELINE : 'mirror'; res.json(r);
});
app.listen(process.env.PORT || 8503, '0.0.0.0');
```
A model module: `build(dataDir)` → reads `config__*.json` via a tiny `cfg(name)` helper that returns rows as
objects, computes, returns plain JSON. Never let a model write files.

## Page skeleton
```html
<header class="topnav" id="topnav"></header>
<main>
  <h1>💪 Title <span class="seg" id="ds"><button data-ds="proposal" class="on">Đề xuất</button><button data-ds="dev">Dev hiện tại</button></span></h1>
  <p class="lead">one-line what this page answers (long explanation hidden in compact mode)</p>
  <div class="card">…</div>
</main>
<script src="js/nav.js"></script><script>… fetch both datasets, render(), renderNav('this.html') …</script>
```

## Export button for the dev (v5.17)
Put one **📦 Export config** link in the top nav of every page → `GET /api/export-config`: re-run the CSV export,
zip the game tables (skip tables the game no longer reads) + the dev action-items file, and send it as a download.
A ~30-line pure-Node ZIP writer (`zlib.deflateRawSync` + CRC32 + local/central headers) avoids adding a dependency;
verify with `unzip -l` / Python `zipfile.testzip()` and a byte-compare of one entry.

## Deploying a site that reads files outside its folder
The docs viewer read `../../design/*.md`; the deployed container only had the web folder → "no .md files found".
Package those inputs into the deploy bundle (e.g. `design-docs/`) and let the server fall back to the bundled
copy when the repo path does not exist. Test by running a copy of the app with the parent folders absent.
Hosting steps: [RUN Platform](../../../development/deployment/run-platform/README.md).
