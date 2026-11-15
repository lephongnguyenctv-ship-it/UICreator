// ui-kit.js — Craftland UI/UX mockup kit: SKINS + COMPONENTS (pure functions returning HTML strings).
//
// Read ../10-component-kit-templates.md first. Rules this file enforces by construction:
//   - A screen never positions things with left/top: it composes stack()/row() with gap TOKENS.
//   - A popup's height is never computed by hand: content flows, the popup grows.
//   - Every sprite goes through a named SKIN (configured once below). Screens never pass a sprite path,
//     slice numbers or a tint hex directly, so "change the card frame everywhere" is one edit.
//   - Colors come from CSS tokens (ui-kit.css) or the RARITY / ELEMENT tables below. No raw hex in screens.
//
// Works in the browser (<script src>) and in Node (require) so layout-lint.js and the render sweep can run
// without a browser. No dependencies.

(function (root) {
  'use strict';

  // ===========================================================================================
  // 1. PROJECT CONFIG — fill ONCE per game from real data (.ui files, .meta slices, screenshots).
  //    `src: null` = no sprite yet → the skin falls back to a flat token color (the gallery still renders,
  //    and layout-lint reports every skin still on fallback so nobody ships it by accident).
  // ===========================================================================================
  const KIT = {
    assetBase: 'assets/sprites/',
    skins: {
      //            sprite file (relative to assetBase)   9-slice T R B L (from .meta)   default tint (token or hex from .ui)
      popup:      { src: null, slice: [10, 10, 10, 10], tint: 'var(--k-surface-popup)' },
      titleBar:   { src: null, slice: [0, 178, 0, 145], tint: null, fallback: 'var(--k-text-2)' },
      panel:      { src: null, slice: [10, 10, 10, 10], tint: 'var(--k-surface-panel)' },
      card:       { src: null, slice: [10, 10, 10, 10], tint: 'var(--k-surface-card)' },
      special:    { src: null, slice: [10, 10, 10, 10], tint: 'var(--k-surface-special)' },
      cell:       { src: null, slice: [14, 14, 14, 14], tint: 'var(--k-surface-card)' },
      selected:   { src: null, slice: [15, 15, 15, 15], tint: null, fallback: 'transparent', outline: 'var(--k-accent)' },
      btnPrimary: { src: null, slice: [10, 40, 10, 40], tint: null, fallback: 'var(--k-good)' },
      btnAction:  { src: null, slice: [10, 40, 10, 40], tint: null, fallback: 'var(--k-action)' },
      btnDanger:  { src: null, slice: [10, 40, 10, 40], tint: null, fallback: 'var(--k-bad)' },
      close:      { src: null, slice: [0, 0, 0, 0], tint: null, fallback: 'var(--k-bad)' },
    },
    // Classification colors: copy the EXACT table from the game's code/config (never pick "nice" colors).
    rarity: {
      common: { bg: '#7CCC66', text: '#126B37' },
      uncommon: { bg: '#22B57E', text: '#0B4F3A' },
      rare: { bg: '#669CCC', text: '#0355B1' },
      epic: { bg: '#B073E5', text: '#520F89' },
      legendary: { bg: '#FBEA30', text: '#CC580F' },
      mythic: { bg: '#E57373', text: '#C51715' },
    },
    element: {},
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cls = (...a) => a.filter(Boolean).join(' ');
  const join = parts => (Array.isArray(parts) ? parts : [parts]).filter(p => p != null && p !== false && p !== '').join('');
  const GAP = { 1: 'k-gap-1', 2: 'k-gap-2', 3: 'k-gap-3', 4: 'k-gap-4', 5: 'k-gap-5', 6: 'k-gap-6' };
  const PAD = { 1: 'k-pad-1', 2: 'k-pad-2', 3: 'k-pad-3', 4: 'k-pad-4', 5: 'k-pad-5' };

  // ===========================================================================================
  // 2. PRIMITIVES
  // ===========================================================================================

  // Skin layer for a named skin. tint override: a token string, a hex from the .ui file, or a rarity key.
  function skin(name, tintOverride) {
    const s = KIT.skins[name];
    if (!s) throw new Error('ui-kit: unknown skin "' + name + '"');
    const tint = tintOverride ? (KIT.rarity[tintOverride] ? KIT.rarity[tintOverride].bg : tintOverride) : s.tint;
    if (!s.src) {
      const bg = tint || s.fallback || 'transparent';
      const ring = s.outline ? `box-shadow:inset 0 0 0 3px ${s.outline};` : '';
      return `<div class="k-skin" data-skin="${name}" data-fallback="1" style="background:${bg};${ring}"></div>`;
    }
    const [t, r, b, l] = s.slice;
    const nine = `border-style:solid;border-width:${t}px ${r}px ${b}px ${l}px;border-image:url(${KIT.assetBase}${s.src}) ${t} ${r} ${b} ${l} fill / ${t}px ${r}px ${b}px ${l}px / 0 stretch;border-radius:0`;
    const tintLayer = tint ? `<div class="k-tint" style="background:${tint}"></div>` : '';
    return `<div class="k-skin" data-skin="${name}" style="${nine}">${tintLayer}</div>`;
  }

  // Any skinned box with flowing content. pad = spacing step (2..5).
  function box(skinName, inner, o = {}) {
    return `<div class="${cls('k-skinned', o.className)}" ${o.attrs || ''} style="${o.style || ''}">${skin(skinName, o.tint)}<div class="${cls('k-content', PAD[o.pad])}">${join(inner)}</div></div>`;
  }

  function stack(children, o = {}) {
    return `<div class="${cls('k-stack', GAP[o.gap == null ? 3 : o.gap], o.center && 'k-center', PAD[o.pad], o.className)}">${join(children)}</div>`;
  }
  function row(children, o = {}) {
    return `<div class="${cls('k-row', GAP[o.gap == null ? 2 : o.gap], o.between && 'k-between', o.center && 'k-center', o.wrap && 'k-wrap', o.className)}">${join(children)}</div>`;
  }
  const grow = inner => `<div class="k-grow">${join(inner)}</div>`;

  // role: caption | body | label | value | title | hero.  tone: good | bad | muted.
  function text(str, role = 'body', o = {}) {
    const color = o.rarity && KIT.rarity[o.rarity] ? `color:${KIT.rarity[o.rarity].text};` : '';
    return `<div class="${cls('k-t-' + role, o.tone && 'k-' + o.tone, o.ellipsis && 'k-ellipsis')}" style="${color}${o.align ? 'text-align:' + o.align : ''}">${o.html ? str : esc(str)}</div>`;
  }

  // ===========================================================================================
  // 3. COMPONENTS — semantic params only (no px, no hex, no sprite paths).
  // ===========================================================================================

  // Popup shell. size: s | m | l.  body: HTML. footer: HTML (usually button()).
  function popup({ size = 's', title, body, footer, close = true }) {
    const bar = title == null ? '' : `<div class="k-titlebar">${skin('titleBar')}<div class="k-title">${esc(title)}</div>${close ? `<div class="k-close" role="button" aria-label="Close">${skin('close')}</div>` : ''}</div>`;
    return `<div class="${cls('k-popup k-skinned', size)}" data-k="popup">${skin('popup')}<div class="k-content">${bar}${stack([body, footer ? `<div class="k-row k-center">${footer}</div>` : ''], { gap: 3, pad: 3 })}</div></div>`;
  }

  // Section inside a popup (panel) and a row/card inside a section (card).
  const panel = (inner, o = {}) => box('panel', stack(inner, { gap: o.gap == null ? 3 : o.gap }), { pad: o.pad || 3 });
  const card = (inner, o = {}) => box(o.special ? 'special' : 'card', inner, { pad: o.pad || 2 });

  // Icon in a rarity-tinted frame. size: s (45) | l (84). selected adds the selection ring.
  function iconCell({ icon, rarity, qty, size = 's', selected = false }) {
    return `<div class="${cls('k-cell k-skinned', size === 'l' && 'l')}" data-k="cell">${skin('cell', rarity)}${icon ? `<img class="k-icon" src="${esc(icon)}" alt="">` : ''}${qty != null ? `<span class="k-qty">${esc(qty)}</span>` : ''}${selected ? skin('selected') : ''}</div>`;
  }

  // Hero block: big icon + optional big number + name + subtitle, centered.
  function hero({ icon, rarity, value, title, subtitle, selected = true }) {
    return stack([
      iconCell({ icon, rarity, size: 'l', selected }),
      value != null ? text(value, 'hero', { align: 'center' }) : '',
      title != null ? text(title, 'title', { align: 'center' }) : '',
      subtitle != null ? text(subtitle, 'caption', { align: 'center' }) : '',
    ], { gap: 1, center: true });
  }

  // Before → after comparison (stats, caps...). rows: [[label, before, after], ...]
  function compareTable(rows) {
    return card(stack(rows.map(([label, a, b]) => row([
      grow(text(label, 'label')),
      text(`${esc(a)} → <span class="k-good">${esc(b)}</span>`, 'value', { html: true, align: 'right' }),
    ], { gap: 2 })), { gap: 2 }), { pad: 3 });
  }

  // Key/value list without comparison. rows: [[label, value, tone?], ...]
  function kvTable(rows) {
    return card(stack(rows.map(([label, v, tone]) => row([grow(text(label, 'label')), text(v, 'value', { tone, align: 'right' })])), { gap: 2 }), { pad: 3 });
  }

  // Cost chips: equal-width grid that wraps instead of truncating. items: [{icon, text, ok}]
  function costChips(items) {
    return `<div class="k-grid-chips" data-k="chips">${items.map(it => card(row([iconCell({ icon: it.icon }), text(it.text, 'value', { tone: it.ok === false ? 'bad' : null, ellipsis: true })], { gap: 2 }), { pad: 1 })).join('')}</div>`;
  }

  // List row: icon + title (+ subtitle) + optional right slot (badge / button / value).
  function listRow({ icon, rarity, title, subtitle, right }) {
    return card(row([
      icon ? iconCell({ icon, rarity }) : '',
      grow(stack([text(title, 'value', { ellipsis: true }), subtitle ? text(subtitle, 'caption', { ellipsis: true }) : ''], { gap: 1 })),
      right || '',
    ], { gap: 3 }), { pad: 2 });
  }

  // Highlight card for "new" things (new skill, new unlock). badge: short label shown at the right.
  function newCard({ icon, kicker, title, desc, badgeText }) {
    return card(row([
      icon ? iconCell({ icon }) : '',
      grow(stack([kicker ? text(kicker, 'caption') : '', text(title, 'title'), desc ? text(desc, 'body') : ''], { gap: 1 })),
      badgeText ? badge(badgeText, 'bad') : '',
    ], { gap: 3 }), { special: true, pad: 3 });
  }

  // Button. variant: primary | action | danger. state: normal | soft-off (looks off but stays clickable).
  function button(label, o = {}) {
    const skinName = { primary: 'btnPrimary', action: 'btnAction', danger: 'btnDanger' }[o.variant || 'primary'];
    return `<div class="${cls('k-btn k-skinned', o.full && 'full', o.state === 'soft-off' && 'soft-off')}" role="button" data-k="button" ${o.attrs || ''}>${skin(skinName)}<span class="k-content">${esc(label)}</span></div>`;
  }

  const badge = (str, tone = 'bad') => `<span class="k-badge" style="background:var(--k-${tone === 'good' ? 'good' : tone === 'accent' ? 'accent' : 'bad'})">${esc(str)}</span>`;
  const stars = (filled, total = 5) => `<span class="k-stars">${Array.from({ length: total }, (_, i) => `<span class="${i < filled ? 'on' : 'off'}">★</span>`).join('')}</span>`;
  const note = str => text(str, 'caption', { align: 'center' });
  const divider = () => '<div class="k-divider"></div>';

  // Progress bar. pct 0..1. label optional (drawn on top, white with no backing panel → use on dark bars).
  function progressBar(pct, label) {
    const p = Math.max(0, Math.min(1, +pct || 0));
    return `<div class="k-bar" data-k="bar"><div class="k-fill" style="width:${Math.round(p * 1000) / 10}%"></div>${label ? `<span class="k-bar-label">${esc(label)}</span>` : ''}</div>`;
  }

  // Tabs: items [label...], active index.
  function tabs(items, active = 0) {
    return row(items.map((t, i) => box(i === active ? 'btnAction' : 'card', text(t, 'value', { align: 'center' }), { pad: 2 })), { gap: 2 });
  }

  // Scrim + centered popup, for previewing a popup inside a fixed "game screen" box (see file 05 for scene anchoring).
  const scrim = inner => `<div style="background:var(--k-scrim);padding:var(--k-sp-6);display:flex;justify-content:center;align-items:flex-start">${inner}</div>`;

  const api = { KIT, esc, skin, box, stack, row, grow, text, popup, panel, card, iconCell, hero, compareTable, kvTable, costChips, listRow, newCard, button, badge, stars, note, divider, progressBar, tabs, scrim };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UIKit = api;
})(typeof window !== 'undefined' ? window : globalThis);
