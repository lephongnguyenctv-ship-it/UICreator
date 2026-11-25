#!/usr/bin/env node
/**
 * extract_craftland_plan.mjs — Headless Playwright DOM layout & style extractor
 * that compiles a live 1500x750 UICreator preview view into a deterministic
 * Craftland Studio entity plan (craftland-ui-entity-plan/v2).
 */

import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const localAppData =
      process.env.LOCALAPPDATA ||
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
    const npxCache = path.join(localAppData, 'npm-cache', '_npx');
    if (fs.existsSync(npxCache)) {
      for (const dir of fs.readdirSync(npxCache)) {
        const candidate = path.join(npxCache, dir, 'node_modules', 'playwright');
        if (fs.existsSync(candidate)) {
          return require(candidate);
        }
      }
    }
    throw new Error('Playwright module not found in node_modules or npx cache.');
  }
}

function resolveChromiumExecutable(chromium) {
  try {
    const defaultPath = chromium.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) {
      return defaultPath;
    }
  } catch {
    // Fallback to ms-playwright cache discovery
  }

  const localAppData =
    process.env.LOCALAPPDATA ||
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(localAppData, 'ms-playwright');
  if (fs.existsSync(pwRoot)) {
    const dirs = fs
      .readdirSync(pwRoot)
      .filter(d => d.startsWith('chromium-') || d.startsWith('chromium_headless_shell-'))
      .sort()
      .reverse();
    for (const d of dirs) {
      for (const rel of [
        path.join('chrome-win64', 'chrome.exe'),
        path.join('chrome-win', 'chrome.exe'),
        path.join('chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
        path.join('chrome-linux', 'chrome'),
      ]) {
        const full = path.join(pwRoot, d, rel);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  for (const sysChrome of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]) {
    if (fs.existsSync(sysChrome)) return sysChrome;
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = {
    page: '',
    view: '',
    width: 1500,
    height: 750,
    out: '',
    projectRoot: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page' && argv[i + 1]) {
      opts.page = argv[++i];
    } else if (arg === '--view' && argv[i + 1]) {
      opts.view = argv[++i].trim();
    } else if (arg === '--width' && argv[i + 1]) {
      opts.width = parseInt(argv[++i], 10) || 1500;
    } else if (arg === '--height' && argv[i + 1]) {
      opts.height = parseInt(argv[++i], 10) || 750;
    } else if (arg === '--out' && argv[i + 1]) {
      opts.out = argv[++i];
    } else if (arg === '--project-root' && argv[i + 1]) {
      opts.projectRoot = argv[++i];
    }
  }
  if (!opts.page) {
    console.error(
      'Usage: node extract_craftland_plan.mjs --page <path/to/index.html> [--view <viewId>] [--width 1500] [--height 750] [--out <plan.json>]'
    );
    process.exit(2);
  }
  return opts;
}

function stableId(key) {
  return crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 12);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pagePath = path.resolve(opts.page);
  if (!fs.existsSync(pagePath)) {
    console.error(`Error: Preview HTML file not found at ${pagePath}`);
    process.exit(2);
  }

  const { chromium } = loadPlaywright();
  const executablePath = resolveChromiumExecutable(chromium);
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: Math.max(1600, opts.width + 100),
        height: Math.max(960, opts.height + 120),
      },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const baseUrl = pathToFileURL(pagePath).href;
    const targetUrl = `${baseUrl}?clean=1&mode=final&res=${opts.width}x${opts.height}${
      opts.view ? `&state=${encodeURIComponent(opts.view)}` : ''
    }`;

    await page.goto(targetUrl, { waitUntil: 'load', timeout: 30000 });

    const extracted = await page.evaluate(
      async ({ targetView, canvasW, canvasH }) => {
        if (window.PixelUI) {
          if (typeof window.PixelUI.setRenderMode === 'function') {
            window.PixelUI.setRenderMode('final');
          }
          if (typeof window.PixelUI.setCanvasResolution === 'function') {
            window.PixelUI.setCanvasResolution(`${canvasW}x${canvasH}`);
          }
          if (targetView && typeof window.PixelUI.setState === 'function') {
            window.PixelUI.setState(targetView);
          }
        }

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
          canvas.style.width = `${canvasW}px`;
          canvas.style.height = `${canvasH}px`;
          document.documentElement.style.setProperty('--px-canvas-w', `${canvasW}px`);
          document.documentElement.style.setProperty('--px-canvas-h', `${canvasH}px`);
        }

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        if (!canvas) {
          throw new Error('Missing #game-canvas in preview page');
        }

        const catalog = window.SPRITE_CATALOG || { slices: {} };
        const slicesMap = catalog.slices || {};
        const views = Array.from(canvas.querySelectorAll('[data-ui-view]'));
        let activeViewEl =
          (targetView && canvas.querySelector(`[data-ui-view="${targetView}"]`)) ||
          canvas.querySelector('[data-ui-view].is-active') ||
          views.find(v => !v.hidden && getComputedStyle(v).display !== 'none') ||
          views[0] ||
          null;
        const resolvedViewId = activeViewEl ? activeViewEl.getAttribute('data-ui-view') || 'main' : 'main';

        // Identify preview slug for saved ui-edits
        const pathParts = window.location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
        const slug = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : 'default';
        const diskEdits = (window.PIXELUI_EDITS && window.PIXELUI_EDITS[slug]) || {};
        const transformEdits = diskEdits.transformEdits || {};
        const labelEdits = diskEdits.labelEdits || {};
        const imageEdits = diskEdits.imageEdits || {};
        const tintEdits = diskEdits.tintEdits || {};

        const canvasRect = canvas.getBoundingClientRect();
        const warnings = [];
        const rawEntities = [];
        let priorityCounter = 0;

        function isInternalOverlay(el) {
          if (!el || el.nodeType !== 1) return true;
          if (
            el.id === '__verify_annotations__' ||
            el.id === '__px_transform_gizmo__' ||
            el.id === '__px_focus_zone__' ||
            el.id === '__px_safe_zones__'
          ) {
            return true;
          }
          if (
            el.classList.contains('px-tint-overlay') ||
            el.classList.contains('px-grad-overlay') ||
            el.classList.contains('world-backdrop-props') ||
            el.classList.contains('ctx-icon-only-label')
          ) {
            return true;
          }
          return false;
        }

        function shouldSkipElement(el) {
          if (!el || el.nodeType !== 1) return true;
          if (isInternalOverlay(el)) return true;
          if (el.hidden) return true;
          if (el.getAttribute('data-export-ignore') === 'true') return true;
          if (el.getAttribute('data-render-mode') === 'wireframe') return true;
          if (el.hasAttribute('data-ui-view') && activeViewEl && el !== activeViewEl) return true;

          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0.001) {
            return true;
          }
          const r = el.getBoundingClientRect();
          if (r.width < 0.5 || r.height < 0.5) return true;
          return false;
        }

        function getCanvasPath(el) {
          if (!el || !canvas.contains(el) || el === canvas) return '';
          const parts = [];
          let cur = el;
          while (cur && cur !== canvas) {
            const p = cur.parentElement;
            if (!p) return '';
            const kids = Array.from(p.children).filter(c => !isInternalOverlay(c));
            const idx = kids.indexOf(cur);
            if (idx < 0) return '';
            parts.unshift(String(idx));
            cur = p;
          }
          return parts.join('.');
        }

        function rgbToHexAndAlpha(cssColor) {
          if (!cssColor || cssColor === 'transparent' || cssColor === 'none') {
            return { hex: '#FFFFFF', alpha: 0 };
          }
          const s = String(cssColor).trim();
          if (/^#[0-9a-fA-F]{6}$/.test(s)) {
            return { hex: s.toUpperCase(), alpha: 1 };
          }
          if (/^#[0-9a-fA-F]{3}$/.test(s)) {
            return {
              hex: ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase(),
              alpha: 1,
            };
          }
          const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
          if (!m) return { hex: '#FFFFFF', alpha: 1 };
          const r = Math.max(0, Math.min(255, Math.round(parseFloat(m[1]))));
          const g = Math.max(0, Math.min(255, Math.round(parseFloat(m[2]))));
          const b = Math.max(0, Math.min(255, Math.round(parseFloat(m[3]))));
          const a = m[4] === undefined ? 1 : Math.max(0, Math.min(1, parseFloat(m[4])));
          const toHex = n => n.toString(16).padStart(2, '0').toUpperCase();
          return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: a };
        }

        function extractCssUrl(val) {
          if (!val || val === 'none') return null;
          const m = /url\((['"]?)(.*?)\1\)/.exec(val);
          if (!m || !m[2] || m[2].startsWith('data:')) return null;
          return m[2];
        }

        function cleanEntityName(el, fallbackTag) {
          const explicit = el.getAttribute('data-craftland-name') || el.getAttribute('cname');
          if (explicit && explicit.trim()) return explicit.trim();

          const role = el.getAttribute('data-ui-role');
          if (role && role.trim()) {
            const cleaned = role
              .replace(/\s*\([^)]*\)\s*$/, '')
              .replace(/^Context:\s*/i, '')
              .trim();
            if (cleaned) return cleaned;
          }

          if (el.id && el.id.trim()) return el.id.trim();

          const cpField = el.getAttribute('data-cp-field');
          if (cpField && cpField.trim()) return cpField.trim();

          const semClass = Array.from(el.classList || []).find(
            c =>
              !c.startsWith('px-') &&
              !c.startsWith('is-') &&
              c !== 'cp-canvas-layer' &&
              c !== 'hud-base-layer'
          );
          if (semClass) return semClass;
          return fallbackTag || el.tagName.toLowerCase();
        }

        function isCompositeInlineTextElement(el) {
          if (!el || el.tagName === 'IMG' || el.tagName === 'BUTTON') return false;
          if (el.hasAttribute('data-slice-id') || el.classList.contains('px-9slice') || el.classList.contains('px-sprite-box')) {
            return false;
          }
          const hasDirectText = Array.from(el.childNodes).some(
            n => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0
          );
          const elemChildren = Array.from(el.children).filter(c => !isInternalOverlay(c));
          if (elemChildren.length === 0) {
            return hasDirectText;
          }
          // Check if all children are pure inline text spans/strongs without sprites or backgrounds
          const INLINE_TAGS = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'U']);
          const allInlineText = elemChildren.every(child => {
            if (!INLINE_TAGS.has(child.tagName)) return false;
            if (
              child.hasAttribute('data-slice-id') ||
              child.classList.contains('px-9slice') ||
              child.classList.contains('px-sprite-box') ||
              child.classList.contains('px-icon') ||
              child.querySelector('[data-slice-id], img, .px-9slice, .px-sprite-box')
            ) {
              return false;
            }
            const ccs = getComputedStyle(child);
            const bg = rgbToHexAndAlpha(ccs.backgroundColor);
            if (bg.alpha > 0.05) return false;
            if (ccs.backgroundImage && ccs.backgroundImage !== 'none') return false;
            return true;
          });
          if (!allInlineText) return false;
          const totalText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
          return totalText.length > 0 && (hasDirectText || elemChildren.length === 1);
        }

        function resolveElementSpriteInfo(el, cs, cPath) {
          const sliceId = (el.getAttribute('data-slice-id') || '').trim();
          const imgEdit = imageEdits[cPath] || {};
          const tintEdit = tintEdits[cPath] || {};

          if (sliceId && slicesMap[sliceId]) {
            const rec = slicesMap[sliceId];
            const nativeSlice9 = Array.isArray(rec.slice_9) && rec.slice_9.length === 4 ? [...rec.slice_9] : null;
            let slice9 = nativeSlice9 ? [...nativeSlice9] : null;
            const attrS9 = el.getAttribute('data-slice-9');
            if (attrS9) {
              const parts = attrS9.split(',').map(n => parseInt(n.trim(), 10));
              if (parts.length === 4 && parts.every(n => !Number.isNaN(n))) {
                slice9 = parts;
              }
            }
            return {
              sliceId,
              fileId: rec.craftland_file_id || null,
              assetPath: rec.craftland_asset_path || rec.source_file || rec.file || null,
              slice9,
              nativeSlice9,
              nativeWidth: rec.width || 0,
              nativeHeight: rec.height || 0,
              category: rec.category || 'panel',
            };
          }

          // Check <img src> or CSS background-image / border-image-source
          let rawUrl = null;
          if (el.tagName === 'IMG' && el.getAttribute('src')) {
            rawUrl = el.getAttribute('src');
          } else {
            rawUrl = extractCssUrl(cs.borderImageSource) || extractCssUrl(cs.backgroundImage);
          }

          if (rawUrl) {
            return {
              sliceId: sliceId || null,
              fileId: null,
              assetPath: rawUrl,
              slice9: null,
              nativeWidth: el.naturalWidth || 0,
              nativeHeight: el.naturalHeight || 0,
              category: 'image',
            };
          }

          // Check visible solid background-color fallback
          const bg = rgbToHexAndAlpha(cs.backgroundColor);
          if (bg.alpha > 0.02) {
            return {
              sliceId: 'ws_t_34_m_ws_icon_square',
              fileId: 'b063b0439839b3d97a8fd2aa6a57ef8b',
              assetPath: 'lib://fftextures/WorkshopIconLibrary/T_34_M_WS_ICON_SQUARE.png',
              slice9: null,
              nativeWidth: 64,
              nativeHeight: 64,
              category: 'solid-color',
              solidColor: bg.hex,
              solidAlpha: bg.alpha,
            };
          }

          return null;
        }

        function resolveFillType(el, cs, spriteInfo, cPath, elRect) {
          const imgEdit = imageEdits[cPath] || {};
          if (typeof imgEdit.fillType === 'number' && [0, 1, 2, 3, 5].includes(imgEdit.fillType)) {
            return imgEdit.fillType;
          }
          const attrFt = el.getAttribute('data-fill-type');
          if (attrFt !== null && attrFt !== '') {
            const parsed = parseInt(attrFt, 10);
            if ([0, 1, 2, 3, 5].includes(parsed)) return parsed;
          }
          if (el.classList.contains('px-img-filled')) return 3;
          if (el.classList.contains('px-img-tiled')) return 2;
          if (el.classList.contains('px-img-fit')) return 5;
          if (el.classList.contains('px-img-simple')) return 0;
          if (
            el.classList.contains('px-9slice') ||
            el.hasAttribute('data-slice-9') ||
            (spriteInfo && spriteInfo.slice9 && el.tagName !== 'IMG' && !el.classList.contains('px-icon'))
          ) {
            // In Craftland Studio, fillType 1 renders .png.meta 9-slice corners at 1:1 native pixel size.
            // If the widget is thinner/smaller than the texture's native .meta border sum (e.g. a 5px progress bar),
            // using fillType 1 inflates the widget to the full border height (24-40px); use Simple (0) instead.
            const effS9 = (spriteInfo && (spriteInfo.nativeSlice9 || spriteInfo.slice9)) || null;
            if (effS9 && elRect) {
              const minH = (Number(effS9[0]) || 0) + (Number(effS9[2]) || 0);
              const minW = (Number(effS9[1]) || 0) + (Number(effS9[3]) || 0);
              if (elRect.height < minH || elRect.width < minW) {
                return 0;
              }
            }
            return 1;
          }
          if (el.tagName === 'IMG' || el.classList.contains('px-icon') || cs.objectFit === 'contain') {
            return 5;
          }
          return 0;
        }

        function resolveTintAndAlpha(el, cs, spriteInfo, cPath) {
          const imgEdit = imageEdits[cPath] || {};
          const tintEdit = tintEdits[cPath] || {};
          let colorHex = '#FFFFFF';

          if (imgEdit.color) {
            colorHex = imgEdit.color.toUpperCase();
          } else if (tintEdit.color) {
            colorHex = tintEdit.color.toUpperCase();
          } else if (el.getAttribute('data-tint')) {
            colorHex = rgbToHexAndAlpha(el.getAttribute('data-tint')).hex;
          } else if (spriteInfo && spriteInfo.solidColor) {
            colorHex = spriteInfo.solidColor;
          } else {
            const tintChild = Array.from(el.children).find(c => c.classList.contains('px-tint-overlay'));
            if (tintChild) {
              const tcs = getComputedStyle(tintChild);
              const parsed = rgbToHexAndAlpha(tcs.backgroundColor);
              if (parsed.alpha > 0) colorHex = parsed.hex;
            }
          }

          let opacity = parseFloat(cs.opacity || '1');
          if (!Number.isFinite(opacity)) opacity = 1;
          if (spriteInfo && typeof spriteInfo.solidAlpha === 'number') {
            opacity *= spriteInfo.solidAlpha;
          }
          let alphaPct = Math.round(Math.max(0, Math.min(1, opacity)) * 100);
          if (typeof imgEdit.alpha === 'number') {
            alphaPct = Math.round(Math.max(0, Math.min(100, imgEdit.alpha)));
          }
          return { colorHex, alphaPct };
        }

        function computeCraftlandTransform(elRect, parentRect, cPath, isFullBleedChild = false) {
          const tfEdit = transformEdits[cPath] || {};
          const Wp = Math.max(1, parentRect.width);
          const Hp = Math.max(1, parentRect.height);
          const w = Math.max(1, elRect.width);
          const h = Math.max(1, elRect.height);
          const xBL = elRect.left - parentRect.left;
          const yBL = Hp - (elRect.top - parentRect.top) - h;

          let aMin = [0, 0];
          let aMax = [0, 0];
          let pivot = [0, 0];
          let rotate = 0;

          if (isFullBleedChild) {
            aMin = [0, 0];
            aMax = [1, 1];
            pivot = [0.5, 0.5];
          } else if (tfEdit && Array.isArray(tfEdit.anchorMin) && Array.isArray(tfEdit.anchorMax)) {
            aMin = [Number(tfEdit.anchorMin[0]) || 0, Number(tfEdit.anchorMin[1]) || 0];
            aMax = [Number(tfEdit.anchorMax[0]) || 0, Number(tfEdit.anchorMax[1]) || 0];
            pivot = Array.isArray(tfEdit.pivot)
              ? [Number(tfEdit.pivot[0]) || 0.5, Number(tfEdit.pivot[1]) || 0.5]
              : [0.5, 0.5];
            rotate = Number(tfEdit.rotate) || 0;
          }

          const Wa = (aMax[0] - aMin[0]) * Wp;
          const Ha = (aMax[1] - aMin[1]) * Hp;
          const sizeDeltaX = Math.round((w - Wa) * 100) / 100;
          const sizeDeltaY = Math.round((h - Ha) * 100) / 100;

          const anchorRefX = aMin[0] * Wp + pivot[0] * Wa;
          const anchorRefY = aMin[1] * Hp + pivot[1] * Ha;
          const childPivotX = xBL + pivot[0] * w;
          const childPivotY = yBL + pivot[1] * h;

          const posX = Math.round((childPivotX - anchorRefX) * 100) / 100;
          const posY = Math.round((childPivotY - anchorRefY) * 100) / 100;

          return {
            rotate,
            anchorMin: { x: aMin[0], y: aMin[1] },
            anchorMax: { x: aMax[0], y: aMax[1] },
            pivot: { x: pivot[0], y: pivot[1] },
            anchoredPosition: { x: posX, y: posY },
            sizeDelta: { x: sizeDeltaX, y: sizeDeltaY },
            computedRect: {
              x: Math.round(elRect.left - canvasRect.left),
              y: Math.round(canvasRect.height - (elRect.top - canvasRect.top) - h),
              width: Math.round(w),
              height: Math.round(h),
            },
          };
        }

        function extractTextProperties(el, cs, cPath) {
          const lblEdit = labelEdits[cPath] || {};
          const rawText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
          const value = rawText.length > 0 ? rawText : ' ';

          const fontSize = Math.max(
            1,
            Math.round(Number(lblEdit.fontSize) || parseFloat(cs.fontSize || '24') || 24)
          );
          const color = lblEdit.color
            ? lblEdit.color.toUpperCase()
            : rgbToHexAndAlpha(cs.color).hex;

          const fw = cs.fontWeight || '400';
          const isBold =
            lblEdit.bold !== undefined
              ? Boolean(lblEdit.bold)
              : fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600;
          const isItalic =
            lblEdit.italic !== undefined ? Boolean(lblEdit.italic) : cs.fontStyle === 'italic';
          const isUnderline =
            lblEdit.underline !== undefined
              ? Boolean(lblEdit.underline)
              : (cs.textDecorationLine || cs.textDecoration || '').includes('underline');

          let alignH = lblEdit.alignH || 'left';
          if (!lblEdit.alignH) {
            const ta = (cs.textAlign || '').toLowerCase();
            if (ta.includes('center')) alignH = 'center';
            else if (ta.includes('right') || ta.includes('end')) alignH = 'right';
            else alignH = 'left';
          }
          const alignV = lblEdit.alignV || 'middle';

          const hasCssShadow = Boolean(cs.textShadow && cs.textShadow !== 'none');
          const hasOutlineClass =
            el.classList.contains('px-text-outline') || el.classList.contains('px-text-outline-lg');
          const outline =
            lblEdit.outline !== undefined ? Boolean(lblEdit.outline) : Boolean(hasOutlineClass || hasCssShadow);
          const shadow =
            lblEdit.shadow !== undefined ? Boolean(lblEdit.shadow) : Boolean(hasCssShadow || hasOutlineClass);

          return {
            value,
            font: 'Default',
            fontSize,
            color,
            alignment: { h: alignH, v: alignV },
            bold: isBold,
            italic: isItalic,
            underline: isUnderline,
            outline,
            outlineColor: (lblEdit.outlineColor || '#000000').toUpperCase(),
            outlineAlpha: lblEdit.outlineAlpha !== undefined ? Number(lblEdit.outlineAlpha) : 1,
            outlineWidth: lblEdit.outlineWidth !== undefined ? Number(lblEdit.outlineWidth) : 1,
            shadow,
            shadowColor: (lblEdit.shadowColor || '#000000').toUpperCase(),
            shadowOffset: Array.isArray(lblEdit.shadowOffset)
              ? { x: Number(lblEdit.shadowOffset[0]) || 1, y: Number(lblEdit.shadowOffset[1]) || 1 }
              : { x: 1, y: 1 },
            overflow: typeof lblEdit.overflow === 'number' ? lblEdit.overflow : 0,
          };
        }

        function isPassThroughWrapper(el, spriteInfo, isText, isBtn) {
          if (spriteInfo || isText || isBtn) return false;
          if (el.hasAttribute('data-ui-view')) return true;
          const hasSemanticIdentity =
            el.hasAttribute('data-craftland-name') ||
            el.hasAttribute('data-ui-role') ||
            el.hasAttribute('cname') ||
            Boolean(el.id);
          return !hasSemanticIdentity;
        }

        const rootKey = 'root';
        rawEntities.push({
          key: rootKey,
          parentKey: null,
          entityType: 'UIRootEntity',
          name: 'Root',
          priority: 0,
          alpha: 100,
          transform: {
            rotate: 0,
            anchorMin: { x: 0, y: 0 },
            anchorMax: { x: 0, y: 0 },
            pivot: { x: 0.5, y: 0.5 },
            anchoredPosition: { x: canvasW / 2, y: canvasH / 2 },
            sizeDelta: { x: canvasW, y: canvasH },
            computedRect: { x: 0, y: 0, width: canvasW, height: canvasH },
          },
        });

        function walk(el, parentKey, parentRect, domPath) {
          if (shouldSkipElement(el)) return;

          const cs = getComputedStyle(el);
          const elRect = el.getBoundingClientRect();
          const cPath = getCanvasPath(el);

          // Check for unsupported CSS features to report as advisory warnings
          if (
            cs.backgroundImage &&
            cs.backgroundImage.includes('gradient(') &&
            !el.classList.contains('px-label-gradient') &&
            !el.hasAttribute('data-slice-id')
          ) {
            warnings.push({
              type: 'unsupported-css-gradient',
              selector: cleanEntityName(el),
              message: `Element "${cleanEntityName(el)}" uses a CSS gradient without a sprite texture.`,
            });
          }

          const isBtn =
            el.tagName === 'BUTTON' ||
            el.classList.contains('px-btn') ||
            el.classList.contains('px-btn-square') ||
            el.getAttribute('role') === 'button';
          const isText = isCompositeInlineTextElement(el);
          const spriteInfo = !isText ? resolveElementSpriteInfo(el, cs, cPath) : null;

          if (isPassThroughWrapper(el, spriteInfo, isText, isBtn)) {
            const kids = Array.from(el.children);
            for (let i = 0; i < kids.length; i++) {
              walk(kids[i], parentKey, parentRect, `${domPath}/${kids[i].tagName.toLowerCase()}[${i}]`);
            }
            return;
          }

          const name = cleanEntityName(el);
          const nodeKey = `${domPath}:${name}`;
          priorityCounter += 10;
          const zAdjust = parseInt(cs.zIndex, 10);
          const priority = priorityCounter + (Number.isFinite(zAdjust) ? Math.max(-9, Math.min(9, zAdjust)) : 0);

          const isFullBleed =
            Math.abs(elRect.left - parentRect.left) <= 1.5 &&
            Math.abs(elRect.top - parentRect.top) <= 1.5 &&
            Math.abs(elRect.width - parentRect.width) <= 2.5 &&
            Math.abs(elRect.height - parentRect.height) <= 2.5 &&
            cs.position === 'absolute';

          const transform = computeCraftlandTransform(elRect, parentRect, cPath, isFullBleed);

          if (isText) {
            const textProps = extractTextProperties(el, cs, cPath);
            const lblEdit = labelEdits[cPath] || {};
            const alpha =
              typeof lblEdit.alpha === 'number'
                ? Math.round(lblEdit.alpha)
                : Math.round(Math.max(0, Math.min(1, parseFloat(cs.opacity || '1'))) * 100);
            rawEntities.push({
              key: nodeKey,
              parentKey,
              entityType: 'UITextEntity',
              name,
              priority,
              alpha,
              transform,
              text: textProps,
            });
            return;
          }

          const visibleKids = Array.from(el.children).filter(c => !shouldSkipElement(c));
          const { colorHex, alphaPct } = resolveTintAndAlpha(el, cs, spriteInfo, cPath);
          const fillType = spriteInfo ? resolveFillType(el, cs, spriteInfo, cPath, elRect) : 0;
          const imgEdit = imageEdits[cPath] || {};

          if (isBtn) {
            const btnSp = spriteInfo || {
              sliceId: 'ws_t_34_m_ws_icon_square',
              fileId: 'b063b0439839b3d97a8fd2aa6a57ef8b',
              assetPath: 'lib://fftextures/WorkshopIconLibrary/T_34_M_WS_ICON_SQUARE.png',
              slice9: null,
            };
            rawEntities.push({
              key: nodeKey,
              parentKey,
              entityType: 'UIButtonEntity',
              name,
              priority,
              alpha: alphaPct,
              transform,
              button: {
                sliceId: btnSp.sliceId || null,
                fileId: btnSp.fileId || null,
                assetPath: btnSp.assetPath || null,
                normal: colorHex,
                highlight: colorHex,
                pressed: (imgEdit.pressedColor || '#C5C5C5').toUpperCase(),
                disabled: (imgEdit.disableColor || '#808080').toUpperCase(),
                fillType: btnSp.slice9 ? 1 : fillType,
                slicedBorder: btnSp.slice9
                  ? {
                      top: btnSp.slice9[0],
                      right: btnSp.slice9[1],
                      bottom: btnSp.slice9[2],
                      left: btnSp.slice9[3],
                    }
                  : { top: 0, right: 0, bottom: 0, left: 0 },
                disableCollider: Boolean(imgEdit.passthrough || el.classList.contains('px-btn-passthrough')),
              },
            });

            // If button itself has direct text and no child elements, emit a child UITextEntity
            const directText = Array.from(el.childNodes)
              .filter(n => n.nodeType === 3)
              .map(n => n.textContent || '')
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (directText && visibleKids.length === 0) {
              const lblKey = `${nodeKey}/Label`;
              priorityCounter += 10;
              rawEntities.push({
                key: lblKey,
                parentKey: nodeKey,
                entityType: 'UITextEntity',
                name: `${name}Txt`,
                priority: priorityCounter,
                alpha: 100,
                transform: {
                  rotate: 0,
                  anchorMin: { x: 0, y: 0 },
                  anchorMax: { x: 1, y: 1 },
                  pivot: { x: 0.5, y: 0.5 },
                  anchoredPosition: { x: 0, y: 0 },
                  sizeDelta: { x: 0, y: 0 },
                  computedRect: transform.computedRect,
                },
                text: extractTextProperties(el, cs, cPath),
              });
            }

            for (let i = 0; i < visibleKids.length; i++) {
              walk(visibleKids[i], nodeKey, elRect, `${domPath}/${visibleKids[i].tagName.toLowerCase()}[${i}]`);
            }
            return;
          }

          if (spriteInfo) {
            const imagePayload = {
              sliceId: spriteInfo.sliceId || null,
              fileId: spriteInfo.fileId || null,
              assetPath: spriteInfo.assetPath || null,
              color: colorHex,
              fillType,
              slicedBorder: spriteInfo.slice9
                ? {
                    top: spriteInfo.slice9[0],
                    right: spriteInfo.slice9[1],
                    bottom: spriteInfo.slice9[2],
                    left: spriteInfo.slice9[3],
                  }
                : { top: 0, right: 0, bottom: 0, left: 0 },
              centerInvisible: Boolean(
                imgEdit.centerInvisible || el.classList.contains('px-9slice-no-center')
              ),
              fillDir: typeof imgEdit.fillDir === 'number' ? imgEdit.fillDir : 0,
              fillAmount: typeof imgEdit.fillAmount === 'number' ? imgEdit.fillAmount : 1,
              reverse: {
                x: Boolean(imgEdit.flipX),
                y: Boolean(imgEdit.flipY),
              },
            };

            // Alpha-cascade safety: if background has alpha < 100 and also has child entities,
            // emit a UIEmptyEntity container (alpha 100) + first-child UIImageEntity for the background.
            if (alphaPct < 100 && visibleKids.length > 0) {
              rawEntities.push({
                key: nodeKey,
                parentKey,
                entityType: 'UIEmptyEntity',
                name,
                priority,
                alpha: 100,
                transform,
              });
              const bgKey = `${nodeKey}/Bg`;
              priorityCounter += 10;
              rawEntities.push({
                key: bgKey,
                parentKey: nodeKey,
                entityType: 'UIImageEntity',
                name: `${name}Bg`,
                priority: priorityCounter,
                alpha: alphaPct,
                transform: {
                  rotate: 0,
                  anchorMin: { x: 0, y: 0 },
                  anchorMax: { x: 1, y: 1 },
                  pivot: { x: 0.5, y: 0.5 },
                  anchoredPosition: { x: 0, y: 0 },
                  sizeDelta: { x: 0, y: 0 },
                  computedRect: transform.computedRect,
                },
                image: imagePayload,
              });
            } else {
              rawEntities.push({
                key: nodeKey,
                parentKey,
                entityType: 'UIImageEntity',
                name,
                priority,
                alpha: alphaPct,
                transform,
                image: imagePayload,
              });
            }

            for (let i = 0; i < visibleKids.length; i++) {
              walk(visibleKids[i], nodeKey, elRect, `${domPath}/${visibleKids[i].tagName.toLowerCase()}[${i}]`);
            }
            return;
          }

          // Structural container (UIEmptyEntity)
          rawEntities.push({
            key: nodeKey,
            parentKey,
            entityType: 'UIEmptyEntity',
            name,
            priority,
            alpha: alphaPct,
            transform,
          });

          for (let i = 0; i < visibleKids.length; i++) {
            walk(visibleKids[i], nodeKey, elRect, `${domPath}/${visibleKids[i].tagName.toLowerCase()}[${i}]`);
          }
        }

        const topChildren = Array.from(canvas.children);
        for (let i = 0; i < topChildren.length; i++) {
          walk(topChildren[i], rootKey, canvasRect, `root/${topChildren[i].tagName.toLowerCase()}[${i}]`);
        }

        return {
          view: resolvedViewId,
          slug,
          canvas: { width: canvasW, height: canvasH },
          rawEntities,
          warnings,
        };
      },
      { targetView: opts.view, canvasW: opts.width, canvasH: opts.height }
    );

    const keyToId = new Map();
    for (const ent of extracted.rawEntities) {
      keyToId.set(ent.key, stableId(ent.key));
    }

    const entities = extracted.rawEntities.map(ent => {
      const { key, parentKey, ...rest } = ent;
      return {
        id: keyToId.get(key),
        parentId: parentKey ? keyToId.get(parentKey) || null : null,
        ...rest,
      };
    });

    const plan = {
      format: 'craftland-ui-entity-plan/v2',
      sourceHtml: pagePath.replace(/\\/g, '/'),
      slug: extracted.slug,
      view: extracted.view,
      canvas: extracted.canvas,
      entityCount: entities.length,
      warnings: extracted.warnings,
      entities,
    };

    const jsonText = JSON.stringify(plan, null, 2) + '\n';
    if (opts.out) {
      const outPath = path.resolve(opts.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, jsonText, 'utf8');
    } else {
      process.stdout.write(jsonText);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
