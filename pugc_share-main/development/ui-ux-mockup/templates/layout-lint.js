#!/usr/bin/env node
// layout-lint.js — catch misalignment and off-system values in mockup HTML WITHOUT a browser.
//
// Usage:
//   node layout-lint.js page.html [--css ui-kit.css] [--strict]
//   node layout-lint.js --screens js/screens.js [--css ui-kit.css] [--kit ui-kit.js] [--strict]   (module exporting SCREENS[] with render())
//   node layout-lint.js --self-test
//
// Errors (exit 1): absolute child overflowing its absolute parent, overlapping absolute siblings,
//   hand-computed popup height, font-size off the type scale, spacing off the grid, unknown hex color.
// Warnings (exit 1 only with --strict): manual left/top inside a kit popup, nowrap+hidden without ellipsis,
//   skins still on flat fallback (no real sprite yet).
// Opt-outs on purpose (must be justified in the screen's mapping): data-abs-ok (manual position allowed,
//   e.g. a 1:1 rebuild from .ui coordinates), data-overlap-ok (intentional overlap, e.g. a badge on a corner).
'use strict';
const fs = require('fs');
const path = require('path');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// ---------- tiny HTML parser (enough for generated mockup markup) ----------
function parse(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[4] != null) { if (m[4].trim()) cur.children.push({ tag: '#text', text: m[4], parent: cur }); continue; }
    const tag = m[1].toLowerCase();
    if (m[0][1] === '/') { let n = cur; while (n && n.tag !== tag) n = n.parent; if (n && n.parent) cur = n.parent; continue; }
    const attrs = {};
    (m[2] || '').replace(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (_, k, a, b, c) => { attrs[k.toLowerCase()] = a ?? b ?? c ?? ''; return ''; });
    const node = { tag, attrs, children: [], parent: cur };
    cur.children.push(node);
    if (!VOID.has(tag) && !m[3]) cur = node;
  }
  return root;
}
function styleOf(n) {
  const o = {};
  String(n.attrs && n.attrs.style || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) o[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim(); });
  return o;
}
const px = v => { const t = String(v == null ? '' : v).trim(); if (t === '0') return 0; const m = /^(-?\d+(?:\.\d+)?)px$/.exec(t); return m ? +m[1] : null; };
const hasClass = (n, c) => (' ' + (n.attrs && n.attrs.class || '') + ' ').includes(' ' + c + ' ');
const label = n => `<${n.tag}${n.attrs.class ? ' class="' + n.attrs.class + '"' : ''}${n.attrs['data-k'] ? ' data-k=' + n.attrs['data-k'] : ''}>`;
function* walk(n) { for (const c of n.children || []) { if (c.tag === '#text') continue; yield c; yield* walk(c); } }
const ancestorHas = (n, pred) => { for (let p = n.parent; p; p = p.parent) if (p.attrs && pred(p)) return true; return false; };

// ---------- token sets from ui-kit.css ----------
function loadTokens(cssPath) {
  const t = { fontSizes: new Set(), colors: new Set(['#ffffff', '#fff', '#000000', '#000']), grid: 4 };
  if (!cssPath || !fs.existsSync(cssPath)) return t;
  const css = fs.readFileSync(cssPath, 'utf8');
  css.replace(/--k-fs-[\w-]+\s*:\s*(\d+(?:\.\d+)?)px/g, (_, v) => { t.fontSizes.add(+v); return ''; });
  css.replace(/#[0-9a-fA-F]{3,8}\b/g, h => { t.colors.add(h.toLowerCase()); return ''; });
  const g = /--k-grid\s*:\s*(\d+)px/.exec(css); if (g) t.grid = +g[1];
  return t;
}
// Colors declared in the kit config (rarity / element tables, skin tints) are legal too.
function addKitColors(t, kitPath) {
  try { const { KIT } = require(path.resolve(kitPath)); JSON.stringify(KIT).replace(/#[0-9a-fA-F]{3,8}\b/g, h => { t.colors.add(h.toLowerCase()); return ''; }); }
  catch (e) { /* no kit next to the screens: only CSS tokens are legal */ }
  return t;
}

// ---------- lint ----------
function lint(html, tokens, where = 'page') {
  const out = { errors: [], warnings: [], info: [] };
  const E = (n, msg) => out.errors.push(`${where}: ${msg} — ${label(n)}`);
  const W = (n, msg) => out.warnings.push(`${where}: ${msg} — ${label(n)}`);
  const root = parse(html);
  let fallback = 0;
  for (const n of walk(root)) {
    const st = styleOf(n);
    const inKitPopup = hasClass(n, 'k-popup') || ancestorHas(n, p => hasClass(p, 'k-popup'));
    const absOk = n.attrs['data-abs-ok'] != null || ancestorHas(n, p => p.attrs['data-abs-ok'] != null);
    if (n.attrs['data-fallback']) fallback++;

    if (hasClass(n, 'k-popup') && st.height) E(n, `popup has a hand-set height (${st.height}); let content define it`);

    if (st['font-size'] && tokens.fontSizes.size) {
      const v = px(st['font-size']);
      if (v != null && !tokens.fontSizes.has(v)) E(n, `font-size ${v}px is not on the type scale [${[...tokens.fontSizes].sort((a, b) => a - b).join(', ')}]`);
    }
    for (const k of ['padding', 'margin', 'gap', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'row-gap', 'column-gap']) {
      if (!st[k]) continue;
      for (const part of st[k].split(/\s+/)) { const v = px(part); if (v != null && v !== 0 && Math.abs(v) % tokens.grid !== 0) E(n, `${k} ${v}px is off the ${tokens.grid}px grid`); }
    }
    for (const h of (n.attrs.style || '').match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
      if (tokens.colors.size > 4 && !tokens.colors.has(h.toLowerCase())) E(n, `color ${h} is not a token / rarity color`);
    }
    if (st.position === 'absolute' && (st.left || st.top) && inKitPopup && !absOk && !hasClass(n, 'k-skin')) W(n, 'manual left/top inside a kit popup — use stack()/row(), or mark data-abs-ok with a reason');
    if (st['white-space'] === 'nowrap' && st.overflow === 'hidden' && !/ellipsis/.test(st['text-overflow'] || '')) W(n, 'nowrap + overflow:hidden silently cuts text; use .k-ellipsis or let it wrap');

    // geometry for absolute boxes with explicit numbers (1:1 rebuilds from .ui)
    const r = rectOf(st);
    if (r && st.position === 'absolute') {
      const pr = rectOf(styleOf(n.parent || {}), true);
      if (pr && n.attrs['data-overlap-ok'] == null) {
        const tol = 0.5;
        if (r.l < -tol || r.t < -tol || r.l + r.w > pr.w + tol || r.t + r.h > pr.h + tol) E(n, `box ${fmt(r)} overflows its parent ${pr.w}x${pr.h}`);
      }
    }
  }
  // sibling overlaps among absolute numeric boxes
  for (const n of [root, ...walk(root)]) {
    const kids = (n.children || []).filter(c => c.tag !== '#text').map(c => ({ c, st: styleOf(c) })).filter(o => o.st.position === 'absolute' && !hasClass(o.c, 'k-skin') && o.c.attrs['data-overlap-ok'] == null).map(o => ({ c: o.c, r: rectOf(o.st) })).filter(o => o.r);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i].r, b = kids[j].r;
      const ox = Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l), oy = Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t);
      if (ox > 1 && oy > 1) E(kids[j].c, `overlaps sibling ${label(kids[i].c)} by ${Math.round(ox)}x${Math.round(oy)}px`);
    }
  }
  if (fallback) out.warnings.push(`${where}: ${fallback} skin layer(s) still on flat fallback (no real sprite configured in KIT.skins)`);
  return out;
}
function rectOf(st, sizeOnly) {
  const w = px(st.width), h = px(st.height);
  if (w == null || h == null) return null;
  if (sizeOnly) return { l: 0, t: 0, w, h };
  const l = px(st.left), t = px(st.top);
  if (l == null || t == null) return null;
  return { l, t, w, h };
}
const fmt = r => `(${r.l},${r.t}) ${r.w}x${r.h}`;

function report(results, strict) {
  let e = 0, w = 0;
  for (const r of results) { r.errors.forEach(x => console.log('ERROR', x)); r.warnings.forEach(x => console.log('WARN ', x)); e += r.errors.length; w += r.warnings.length; }
  console.log(`layout-lint: ${e} error(s), ${w} warning(s)`);
  return e > 0 || (strict && w > 0) ? 1 : 0;
}

function selfTest() {
  const tokens = { fontSizes: new Set([13, 15, 17]), colors: new Set(['#fff', '#382200', '#ffffff', '#000', '#000000']), grid: 4 };
  const bad = `<div class="k-popup" style="height:300px"><div style="position:relative;width:100px;height:50px">
    <div style="position:absolute;left:0;top:0;width:60px;height:40px"></div>
    <div style="position:absolute;left:50px;top:10px;width:60px;height:40px;font-size:14px;padding:6px;color:#123456"></div></div></div>`;
  const good = `<div class="k-popup"><div class="k-stack k-gap-3"><div style="font-size:15px;padding:8px;color:#382200">ok</div></div></div>`;
  const b = lint(bad, tokens, 'bad'), g = lint(good, tokens, 'good');
  const want = ['hand-set height', 'type scale', 'off the 4px grid', 'not a token', 'overflows its parent', 'overlaps sibling', 'manual left/top'];
  const all = [...b.errors, ...b.warnings].join('\n');
  const missing = want.filter(k => !all.includes(k));
  const ok = !missing.length && g.errors.length === 0 && g.warnings.length === 0;
  console.log(ok ? 'self-test PASS' : 'self-test FAIL, missing: ' + missing.join(', ') + ' | good: ' + JSON.stringify(g));
  return ok ? 0 : 1;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--self-test')) process.exit(selfTest());
  const strict = a.includes('--strict');
  const cssI = a.indexOf('--css'); const css = cssI >= 0 ? a[cssI + 1] : path.join(__dirname, 'ui-kit.css');
  const kitI = a.indexOf('--kit'); const kit = kitI >= 0 ? a[kitI + 1] : path.join(__dirname, 'ui-kit.js');
  const tokens = addKitColors(loadTokens(css), kit);
  const scrI = a.indexOf('--screens');
  const results = [];
  if (scrI >= 0) {
    const mod = require(path.resolve(a[scrI + 1]));
    const screens = mod.SCREENS || mod;
    for (const s of screens) {
      try { results.push(lint(s.render(), tokens, s.id)); if (s.sceneWidget) results.push(lint(s.sceneWidget(), tokens, s.id + ':scene')); }
      catch (e) { results.push({ errors: [`${s.id}: render() crashed — ${e.message}`], warnings: [], info: [] }); }
    }
  } else {
    const file = a.find(x => !x.startsWith('--') && x !== css && x !== kit);
    if (!file) { console.log('usage: node layout-lint.js page.html | --screens screens.js [--css ui-kit.css] [--strict] | --self-test'); process.exit(2); }
    results.push(lint(fs.readFileSync(file, 'utf8'), tokens, path.basename(file)));
  }
  process.exit(report(results, strict));
}
module.exports = { parse, lint, loadTokens };
