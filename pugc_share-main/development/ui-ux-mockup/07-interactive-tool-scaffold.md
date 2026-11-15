# 07 — Scaffold for an Internal Web Tool (Node.js)

When the designer needs to browse MANY UI screens at once (not just a single static HTML file), build
a small internal web tool following the scaffold below. Benefit: every component/screen is defined
ONCE, in a single JS file, and reused across MULTIPLE pages (a browse page + an interactive simulation
page) — fix one component in one place, and every page automatically reflects the update.

## Folder structure

```
tools/ui-mockup/
  server.js                 <- Express static server, only a few lines
  public/
    css/style.css           <- shared styling (CSS variables for background/text colors, not the game's UI style)
    js/
      nav.js                 <- shared navigation bar across every page
      screens.js              <- ALL primitives + components + the screen registry (files 03, 04, 05)
      browse.js                <- logic specific to the browse page
      simulate.js               <- logic specific to the interactive simulation page
    assets/                  <- exported sprites/images (see file 01)
    browse.html               <- browse page (2 columns: pick a screen | view the result + reference image)
    simulate.html              <- interactive click-through simulation page
```

## `server.js` — just static file serving

```js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
const APP_VERSION = '1.0'; // bump on every significant change, shown in the nav badge so the designer
                            // knows whether they're looking at the latest build or a stale server

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION, startedAt: START_TIME, uptimeSec: process.uptime() | 0 }));

const START_TIME = new Date().toISOString();
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

You don't need a separate route for each new HTML page — `express.static` automatically serves any
static file under `public/`; just create the new `.html` file there.

## `js/screens.js` — the central registry, reused across every page

This is the most important file — it holds the asset paths, primitives (file 03), components (file
04), and a `SCREENS` array listing EVERY screen:

```js
const SCREENS = [
  {
    id: 'boss_selector_popup',       // unique identifier, used as the URL hash + lookup key
    group: 'Boss',                    // display group shown in the left-hand navigation
    label: 'Boss Selector Popup',     // a SHORT display name for the designer — don't cram version
                                       // numbers/progress status into this (that belongs in a
                                       // changelog, not the screen's display name)
    ref: 'assets/reference/boss_selector.png', // original reference image, null if not available yet
    render() { /* returns the screen's HTML string, using the components from file 04 */ },
    // Optional: a "clean" variant with no decorative demo background — used when placing this screen
    // over a real gameplay scene (see file 05). If undefined, render() is used for both cases.
    sceneWidget() { /* ... */ },
    // Optional, but STRONGLY RECOMMENDED: document every detail in this screen as 'real' (a real
    // value from .ui/reference images), 'approx' (an estimate that needs confirmation), or 'new' (a
    // new proposal not present in the original game).
    mapping: [
      ['Popup size 600x400', 'Measured directly from the BossSelectorNode in .ui', 'real'],
      ['Gap between list rows', 'Eyeballed from the reference image, no .ui data available', 'approx'],
    ],
  },
  // ... other screens
];

// IMPORTANT: do NOT auto-run any init logic when this file loads (don't call initNav()/initBrowse() at
// the top level) — this lets the file be safely included on MULTIPLE pages via multiple <script src>
// tags without unwanted side effects. Each page calls its own init function from its own dedicated JS
// file (browse.js / simulate.js).
```

## `js/nav.js` — shared navigation bar

```js
function renderNav(activeHref) {
  const items = [
    { href: 'browse.html', label: 'Browse UI/UX' },
    { href: 'simulate.html', label: 'Interactive Simulation' },
    // add other pages here if any (e.g. a balance page, a docs page...)
  ];
  const el = document.getElementById('topnav');
  el.innerHTML = '<span class="brand">Project Name</span>' +
    '<span id="versionBadge" class="badge">v…</span>' +
    items.map(i => `<a href="${i.href}" class="${i.href === activeHref ? 'active' : ''}">${i.label}</a>`).join('');
  loadVersionBadge();
}

async function loadVersionBadge() {
  const badge = document.getElementById('versionBadge');
  try {
    const v = await (await fetch('/api/version')).json();
    badge.textContent = `v${v.version}`;
  } catch (e) {
    badge.textContent = 'v?';
  }
}
```

The version badge lets the designer confirm with certainty whether they're looking at the latest build
(avoiding confusion like "I fixed this, why doesn't it show up?" caused by a server that hasn't
restarted, or a stale cached page).

## The browse page (`browse.html` + `browse.js`)

A 2-column layout: the screen list on the left (grouped by `group`), and the currently selected
screen's `render()` output on the right, next to its reference image (`ref`) for direct comparison.
Read/write the URL hash (`#screen_id`) so the designer can share a direct link to a specific screen.

```js
function initBrowse() {
  const nav = document.getElementById('screenNav');
  const groups = [];
  for (const s of SCREENS) {
    let g = groups.find(g => g.name === s.group);
    if (!g) { g = { name: s.group, items: [] }; groups.push(g); }
    g.items.push(s);
  }
  nav.innerHTML = groups.map(g => `<div class="grp-label">${g.name}</div>` +
    g.items.map(s => `<a href="#${s.id}" data-id="${s.id}">${s.label}</a>`).join('')).join('');

  function show(id) {
    const s = SCREENS.find(s => s.id === id) || SCREENS[0];
    document.getElementById('screenContent').innerHTML = `
      <h2>${s.label}</h2>
      <div class="stage-wrap">${s.render()}</div>
      ${s.ref ? `<img class="ref-shot" src="${s.ref}">` : ''}
    `;
  }
  nav.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return; e.preventDefault();
    show(a.dataset.id); history.replaceState(null, '', '#' + a.dataset.id);
  });
  show((location.hash || '').slice(1) || SCREENS[0].id);
}
```

## The interactive simulation page (`simulate.html` + `simulate.js`)

Lets the designer click buttons on a gameplay scene image (using the anchoring mechanism from file 05)
to open the corresponding popup, just like the real experience — useful for reviewing the interaction
FLOW, not just individual static screens.

**Principle for identifying clickable regions**: use `querySelector` matching a distinctive attribute
(an image path, a class name containing part of a sprite name...) rather than counting by position
(`children[n]`) — this stays robust when you later reorder or change the internal markup of a
component:

```js
const BUTTON_MAP = [
  { match: 'img[src*="icon_boss_select"]', popup: 'boss_selector_popup', label: 'Select Boss' },
  { match: 'img[src*="icon_backpack"]', popup: 'inventory_popup', label: 'Inventory' },
  // ...
];

function wireButtons(stage) {
  BUTTON_MAP.forEach(({ match, popup, label }) => {
    const el = stage.querySelector(match);
    if (!el) { console.warn('Button not found:', label); return; }
    const target = el.parentElement || el; // the parent is the whole button area; the icon is just a child image
    target.style.cursor = 'pointer';
    target.addEventListener('click', () => showPopup(popup));
  });
}

function showPopup(screenId) {
  const screen = SCREENS.find(s => s.id === screenId);
  const stage = document.getElementById('simStage');
  hidePopup(); // always clear any previous popup first — prevents 2 popups stacking if a different button is clicked while one is open

  const backdrop = document.createElement('div');
  backdrop.id = 'popupBackdrop';
  backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.55);cursor:pointer';
  backdrop.addEventListener('click', hidePopup);
  stage.appendChild(backdrop);

  const tmp = document.createElement('div');
  tmp.innerHTML = buildOverlayLayer(screen.render(), { type: 'center' }); // see file 05
  const layer = tmp.firstElementChild;
  layer.id = 'popupLayer';
  stage.appendChild(layer);

  // Standard: most popups share one close-button style (e.g. a ".popup-close" class). BUT if 1-2
  // screens use a non-standard close button (a one-off variant), also catch that variant's own
  // distinctive marker — don't assume EVERY popup uses the exact same selector; check each popup's
  // actual markup when wiring this up.
  layer.querySelectorAll('.popup-close').forEach(btn => btn.addEventListener('click', hidePopup));

  fitOverlaysToContainer(stage); // see file 05 — must be called again since a new overlay was just added
}

function hidePopup() {
  const stage = document.getElementById('simStage');
  const backdrop = document.getElementById('popupBackdrop');
  const layer = document.getElementById('popupLayer');
  if (backdrop) backdrop.remove();
  if (layer) layer.remove();
}
```

## Why separate the browse page and the simulation page instead of merging them

The two pages serve different purposes: the browse page is for INSPECTING DETAIL on each screen next to
its reference image (needs generous space, no popup size constraint), while the simulation page is for
REVIEWING THE INTERACTION FLOW like the real game (needs everything confined to the image frame, just
like the real experience). Because both share the same `screens.js` file, polishing a screen anywhere
automatically reflects on both pages — no manual syncing needed.
