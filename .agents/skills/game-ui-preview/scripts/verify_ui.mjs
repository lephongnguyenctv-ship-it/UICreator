#!/usr/bin/env node
/**
 * verify_ui.mjs — Playwright automated DOM, sprite asset, pixel-art, geometry,
 * interactive state audit, and clean/annotated screenshot capture.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
    const dirs = fs.readdirSync(pwRoot).filter(d => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      for (const rel of [
        path.join('chrome-win64', 'chrome.exe'),
        path.join('chrome-win', 'chrome.exe'),
        path.join('chrome-linux', 'chrome'),
      ]) {
        const full = path.join(pwRoot, d, rel);
        if (fs.existsSync(full)) return full;
      }
    }
  }
  return undefined;
}

function parseArgs(argv) {
  const opts = { page: '', out: '', states: null, mode: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page' && argv[i + 1]) {
      opts.page = argv[++i];
    } else if (arg === '--out' && argv[i + 1]) {
      opts.out = argv[++i];
    } else if (arg === '--states' && argv[i + 1]) {
      opts.states = argv[++i]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } else if (arg === '--mode' && argv[i + 1]) {
      const m = argv[++i].trim().toLowerCase();
      if (!['final', 'wireframe', 'both'].includes(m)) {
        console.error(`Invalid --mode "${m}". Expected final, wireframe, or both.`);
        process.exit(2);
      }
      opts.mode = m;
    }
  }
  if (!opts.page) {
    console.error(
      'Usage: node verify_ui.mjs --page <path/to/index.html> [--out <dir>] [--states s1,s2] [--mode final|wireframe|both]'
    );
    process.exit(2);
  }
  return opts;
}

async function auditCurrentState(page, stateName) {
  return page.evaluate(async stateLabel => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      return {
        state: stateLabel,
        fatal: 'Missing #game-canvas element',
        assetsChecked: 0,
        brokenAssets: [{ selector: '#game-canvas', reason: 'Missing #game-canvas' }],
        pixelatedViolations: [],
        viewportDefects: [],
        overflowDefects: [],
        overlapDefects: [],
        textLegibilityDefects: [],
      };
    }

    const canvasRect = canvas.getBoundingClientRect();
    const isWireframe =
      (document.body && document.body.classList.contains('mode-wireframe')) ||
      canvas.classList.contains('is-wireframe');

    function describeEl(el) {
      if (!el || !el.tagName) return 'unknown';
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      const cls = Array.from(el.classList || []).slice(0, 3).join('.');
      if (cls) s += '.' + cls;
      const sliceId = el.getAttribute('data-slice-id');
      if (sliceId) s += `[data-slice-id="${sliceId}"]`;
      return s;
    }

    function isVisible(el) {
      if (!el || el.nodeType !== 1) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') <= 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0.5 && rect.height > 0.5;
    }

    function extractCssUrls(cssValue) {
      if (!cssValue || cssValue === 'none') return [];
      const urls = [];
      const re = /url\((['"]?)(.*?)\1\)/g;
      let match;
      while ((match = re.exec(cssValue)) !== null) {
        if (match[2] && !match[2].startsWith('data:')) {
          urls.push(match[2]);
        }
      }
      return urls;
    }

    function testImageUrl(url) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ ok: img.naturalWidth > 0, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ ok: false, w: 0, h: 0 });
        img.src = url;
      });
    }

    const brokenAssets = [];
    const pixelatedViolations = [];
    const viewportDefects = [];
    const overflowDefects = [];
    const overlapDefects = [];
    const textLegibilityDefects = [];
    const warnings = [];

    const allElements = [canvas, ...Array.from(canvas.querySelectorAll('*'))];
    const cssUrlsToVerify = new Map();
    let assetsChecked = 0;

    function isInternalOverlay(el) {
      return Boolean(
        el &&
          (el.id === '__verify_annotations__' ||
            el.id === '__px_transform_gizmo__' ||
            el.id === '__px_focus_zone__' ||
            el.classList.contains('px-tint-overlay'))
      );
    }

    for (const el of allElements) {
      if (!isVisible(el) || isInternalOverlay(el)) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const sel = describeEl(el);

      // 1. Check <img> elements (skip empty placeholders in wireframe mode)
      if (el.tagName === 'IMG') {
        const hasSrc = Boolean(el.getAttribute('src'));
        if (!isWireframe || hasSrc) {
          assetsChecked++;
          if (!el.complete || el.naturalWidth === 0) {
            brokenAssets.push({ selector: sel, url: el.src || '(empty)', reason: 'IMG failed to load' });
          }
        }
      }

      // 2. Collect CSS background-image and border-image-source URLs (final mode)
      if (!isWireframe) {
        for (const prop of [style.backgroundImage, style.borderImageSource]) {
          for (const u of extractCssUrls(prop)) {
            if (!cssUrlsToVerify.has(u)) {
              cssUrlsToVerify.set(u, sel);
            }
          }
        }
      }

      // 3. Check image-rendering: pixelated on sprite classes (final mode)
      if (
        !isWireframe &&
        el.matches('.px-9slice, .px-sprite-box, .px-icon, img[data-slice-id], .px-btn-square') &&
        style.imageRendering !== 'pixelated' &&
        style.imageRendering !== 'crisp-edges'
      ) {
        pixelatedViolations.push({
          selector: sel,
          imageRendering: style.imageRendering,
        });
      }

      // 4. Viewport bounds check (1280x720 canvas)
      if (el !== canvas && el.getAttribute('data-viewport-clip-ok') !== 'true') {
        if (
          rect.left < canvasRect.left - 2 ||
          rect.top < canvasRect.top - 2 ||
          rect.right > canvasRect.right + 2 ||
          rect.bottom > canvasRect.bottom + 2
        ) {
          viewportDefects.push({
            selector: sel,
            rect: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom),
            },
            canvas: { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) },
          });
        }
      }

      // 5. Text legibility & text box overflow
      const hasDirectText = Array.from(el.childNodes).some(
        n => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0
      );
      if (hasDirectText) {
        const fontSize = parseFloat(style.fontSize || '0');
        if (fontSize < 10) {
          textLegibilityDefects.push({
            selector: sel,
            fontSize,
            text: el.textContent.trim().slice(0, 40),
          });
        }
        if (
          style.display !== 'inline' &&
          !el.classList.contains('px-ellipsis') &&
          el.getAttribute('data-overflow-ok') !== 'true' &&
          el.clientWidth > 0 &&
          el.clientHeight > 0
        ) {
          if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
            overflowDefects.push({
              selector: sel,
              type: 'text-scroll-overflow',
              scroll: { w: el.scrollWidth, h: el.scrollHeight },
              client: { w: el.clientWidth, h: el.clientHeight },
              rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            });
          }
        }
      }

      // 5b. Non-blocking design-rhythm soft warnings
      if (
        hasDirectText &&
        style.whiteSpace === 'nowrap' &&
        style.overflow === 'hidden' &&
        style.textOverflow !== 'ellipsis' &&
        !el.classList.contains('px-ellipsis')
      ) {
        warnings.push({
          type: 'silent-text-clip',
          selector: sel,
          message: 'nowrap + overflow:hidden without text-overflow:ellipsis may silently cut text; use .px-ellipsis or allow wrapping.',
        });
      }

      if (
        el.matches('.px-modal, .px-dialog, .px-modal-backdrop > .px-9slice') &&
        el.style &&
        el.style.height &&
        el.getAttribute('data-fixed-height-ok') !== 'true'
      ) {
        warnings.push({
          type: 'fixed-modal-height',
          selector: sel,
          message: `Modal/popup has inline fixed height (${el.style.height}); prefer letting content define height.`,
        });
      }

      // 6. Parent container child-containment check (including 9-slice border safe interior)
      if (el.matches('.px-9slice, .px-wire-box, .px-btn, .px-slot, .px-card, .px-dialog-content')) {
        const checkInnerBorder =
          el.classList.contains('px-9slice') &&
          !isWireframe &&
          el.getAttribute('data-border-overlap-ok') !== 'true';
        const bT = checkInnerBorder ? parseFloat(style.borderTopWidth || '0') : 0;
        const bR = checkInnerBorder ? parseFloat(style.borderRightWidth || '0') : 0;
        const bB = checkInnerBorder ? parseFloat(style.borderBottomWidth || '0') : 0;
        const bL = checkInnerBorder ? parseFloat(style.borderLeftWidth || '0') : 0;
        const innerLeft = rect.left + bL;
        const innerTop = rect.top + bT;
        const innerRight = rect.right - bR;
        const innerBottom = rect.bottom - bB;

        for (const child of Array.from(el.children)) {
          if (!isVisible(child) || isInternalOverlay(child) || child.getAttribute('data-overflow-ok') === 'true') continue;
          const cRect = child.getBoundingClientRect();
          if (
            cRect.left < rect.left - 2 ||
            cRect.top < rect.top - 2 ||
            cRect.right > rect.right + 2 ||
            cRect.bottom > rect.bottom + 2
          ) {
            overflowDefects.push({
              selector: describeEl(child),
              parentSelector: sel,
              type: 'child-exceeds-parent',
              rect: { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height },
              parentRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            });
          } else if (
            checkInnerBorder &&
            child.getAttribute('data-border-overlap-ok') !== 'true' &&
            (cRect.left < innerLeft - 2 ||
              cRect.top < innerTop - 2 ||
              cRect.right > innerRight + 2 ||
              cRect.bottom > innerBottom + 2)
          ) {
            overflowDefects.push({
              selector: describeEl(child),
              parentSelector: sel,
              type: 'child-overlaps-9slice-border',
              rect: { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height },
              parentInnerRect: {
                left: Math.round(innerLeft),
                top: Math.round(innerTop),
                width: Math.round(innerRight - innerLeft),
                height: Math.round(innerBottom - innerTop),
              },
            });
          }
        }
      }

      // 7. Sibling overlap check inside layout containers
      if (el.matches('.px-row, .px-stack, .px-grid, .px-hud-top, .px-hud-bottom')) {
        const flowChildren = Array.from(el.children).filter(c => {
          if (!isVisible(c) || isInternalOverlay(c)) return false;
          if (c.getAttribute('data-overlap-ok') === 'true') return false;
          const cs = getComputedStyle(c);
          return cs.position !== 'absolute' || c.getAttribute('data-check-overlap') === 'true';
        });

        for (let i = 0; i < flowChildren.length; i++) {
          for (let j = i + 1; j < flowChildren.length; j++) {
            const a = flowChildren[i];
            const b = flowChildren[j];
            const rA = a.getBoundingClientRect();
            const rB = b.getBoundingClientRect();
            const ix = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
            const iy = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));
            if (ix > 2 && iy > 2 && ix * iy > 4) {
              overlapDefects.push({
                container: sel,
                selectorA: describeEl(a),
                selectorB: describeEl(b),
                overlapArea: Math.round(ix * iy),
                rect: {
                  left: Math.max(rA.left, rB.left),
                  top: Math.max(rA.top, rB.top),
                  width: ix,
                  height: iy,
                },
              });
            }
          }
        }
      }
    }

    // Advisory HUD Visual Budget check on non-modal gameplay views in final mode
    if (!isWireframe) {
      const activeView = canvas.querySelector('[data-ui-view].is-active') || canvas;
      const hasModal = Boolean(
        activeView.classList.contains('px-modal-backdrop') ||
          Array.from(activeView.querySelectorAll('.px-modal-backdrop')).some(m => isVisible(m))
      );
      if (!hasModal && canvasRect.width > 0 && canvasRect.height > 0) {
        const focusRect = {
          left: canvasRect.left + canvasRect.width * 0.3,
          top: canvasRect.top + canvasRect.height * 0.3,
          right: canvasRect.left + canvasRect.width * 0.7,
          bottom: canvasRect.top + canvasRect.height * 0.7,
        };
        const focusArea = (focusRect.right - focusRect.left) * (focusRect.bottom - focusRect.top);
        const canvasArea = canvasRect.width * canvasRect.height;

        const hudWidgets = [];
        const isTransparentWrapper = el => {
          if (el.matches('.px-9slice, .px-sprite-box, .px-btn, .px-wire-box, img, button')) return false;
          if (el.children.length === 0) return false;
          const cs = getComputedStyle(el);
          const bgCol = cs.backgroundColor || '';
          const hasBgCol = bgCol !== '' && bgCol !== 'transparent' && bgCol !== 'rgba(0, 0, 0, 0)';
          const hasBgImg = cs.backgroundImage && cs.backgroundImage !== 'none';
          const hasBorderImg = cs.borderImageSource && cs.borderImageSource !== 'none';
          return !hasBgCol && !hasBgImg && !hasBorderImg;
        };
        const walkHud = container => {
          for (const child of Array.from(container.children)) {
            if (!isVisible(child) || isInternalOverlay(child)) continue;
            if (child.classList.contains('world-backdrop-props') || child.getAttribute('data-wireframe-hide') === 'true') continue;
            if (
              child.matches('.px-hud-layer, .px-hud-top, .px-hud-bottom, .px-hud-left, .px-hud-right') ||
              isTransparentWrapper(child)
            ) {
              walkHud(child);
            } else {
              hudWidgets.push(child);
            }
          }
        };
        walkHud(activeView);

        let hudArea = 0;
        let centerOverlap = 0;
        for (const w of hudWidgets) {
          const r = w.getBoundingClientRect();
          const cl = Math.max(canvasRect.left, r.left);
          const ct = Math.max(canvasRect.top, r.top);
          const cr = Math.min(canvasRect.right, r.right);
          const cb = Math.min(canvasRect.bottom, r.bottom);
          if (cr > cl && cb > ct) {
            hudArea += (cr - cl) * (cb - ct);
          }
          const fl = Math.max(focusRect.left, r.left);
          const ft = Math.max(focusRect.top, r.top);
          const fr = Math.min(focusRect.right, r.right);
          const fb = Math.min(focusRect.bottom, r.bottom);
          if (fr > fl && fb > ft) {
            centerOverlap += (fr - fl) * (fb - ft);
          }
        }
        const hudPct = Math.min(100, Math.round((hudArea / canvasArea) * 100));
        const centerPct = Math.min(100, Math.round((centerOverlap / focusArea) * 100));
        if (hudPct > 25 || centerPct > 5) {
          warnings.push({
            type: 'hud-budget-high',
            selector: describeEl(activeView),
            hudCoveragePct: hudPct,
            centerFocusIntrusionPct: centerPct,
            message: `Gameplay HUD covers ~${hudPct}% of screen (Center 40% intrusion: ${centerPct}%). Consider trimming HUD clutter or clearing the center focus zone.`,
          });
        }
      }
    }

    // Verify all CSS URLs asynchronously
    for (const [url, sel] of cssUrlsToVerify.entries()) {
      assetsChecked++;
      const res = await testImageUrl(url);
      if (!res.ok) {
        brokenAssets.push({ selector: sel, url, reason: 'CSS sprite URL failed to load' });
      }
    }

    return {
      state: stateLabel,
      mode: isWireframe ? 'wireframe' : 'final',
      canvasSize: { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) },
      assetsChecked,
      brokenAssets,
      pixelatedViolations,
      viewportDefects,
      overflowDefects,
      overlapDefects,
      textLegibilityDefects,
      warnings,
    };
  }, stateName);
}

async function injectDefectAnnotations(page, audit) {
  await page.evaluate(report => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const isWireframe =
      (document.body && document.body.classList.contains('mode-wireframe')) ||
      canvas.classList.contains('is-wireframe');
    const layer = document.createElement('div');
    layer.id = '__verify_annotations__';
    layer.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:9999;';

    const boxes = [];
    for (const d of report.overflowDefects || []) {
      if (d.rect) boxes.push({ rect: d.rect, color: '#ef4444', label: 'OVERFLOW' });
    }
    for (const d of report.viewportDefects || []) {
      if (d.rect) {
        boxes.push({
          rect: {
            left: d.rect.left,
            top: d.rect.top,
            width: d.rect.right - d.rect.left,
            height: d.rect.bottom - d.rect.top,
          },
          color: '#dc2626',
          label: 'OUT-OF-BOUNDS',
        });
      }
    }
    for (const d of report.overlapDefects || []) {
      if (d.rect) boxes.push({ rect: d.rect, color: '#f59e0b', label: 'OVERLAP' });
    }

    for (const b of boxes) {
      const marker = document.createElement('div');
      marker.style.cssText = `
        position:absolute;
        left:${b.rect.left - canvasRect.left}px;
        top:${b.rect.top - canvasRect.top}px;
        width:${Math.max(4, b.rect.width)}px;
        height:${Math.max(4, b.rect.height)}px;
        border:2px solid ${b.color};
        background:${b.color}28;
      `;
      const tag = document.createElement('span');
      tag.textContent = b.label;
      tag.style.cssText = `
        position:absolute;top:-16px;left:0;
        background:${b.color};color:#fff;font:bold 10px monospace;padding:1px 4px;
      `;
      marker.appendChild(tag);
      layer.appendChild(marker);
    }

    canvas.appendChild(layer);
  }, audit);
}

async function clearDefectAnnotations(page) {
  await page.evaluate(() => {
    const layer = document.getElementById('__verify_annotations__');
    if (layer) layer.remove();
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pageAbs = path.resolve(opts.page);
  if (!fs.existsSync(pageAbs)) {
    console.error(`Page file not found: ${pageAbs}`);
    process.exit(1);
  }

  const outDir = path.resolve(opts.out || path.join(path.dirname(pageAbs), 'verification'));
  const shotsDir = path.join(outDir, 'screenshots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const executablePath = resolveChromiumExecutable(chromium);

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--allow-file-access-from-files'],
  });

  const consoleErrors = [];
  const pageErrors = [];
  const stateReports = [];
  const screenshots = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const modesToTest =
      opts.mode === 'both' ? ['final', 'wireframe'] : opts.mode ? [opts.mode] : [null];

    for (const modeArg of modesToTest) {
      const pageUrl =
        pathToFileURL(pageAbs).href + '?clean=1' + (modeArg ? `&mode=${encodeURIComponent(modeArg)}` : '');
      await page.goto(pageUrl, { waitUntil: 'load' });
      await page.waitForTimeout(250);

      const resolvedMode = await page.evaluate(() =>
        (document.body && document.body.classList.contains('mode-wireframe')) ||
        (document.getElementById('game-canvas') &&
          document.getElementById('game-canvas').classList.contains('is-wireframe'))
          ? 'wireframe'
          : 'final'
      );

      // Discover states from [data-ui-view] or --states CLI arg
      const discoveredStates = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[data-ui-view]'))
          .map(el => el.getAttribute('data-ui-view'))
          .filter(Boolean);
      });

      const statesToTest =
        opts.states && opts.states.length > 0
          ? opts.states
          : discoveredStates.length > 0
            ? Array.from(new Set(discoveredStates))
            : ['default'];

      for (const stateId of statesToTest) {
        if (stateId !== 'default') {
          // Prefer clicking an actual visible in-canvas trigger to test real UI navigation
          const clickedInCanvas = await page.evaluate(target => {
            const triggers = Array.from(
              document.querySelectorAll(`#game-canvas [data-ui-state-trigger="${target}"]`)
            );
            for (const btn of triggers) {
              const st = getComputedStyle(btn);
              const r = btn.getBoundingClientRect();
              if (st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0) {
                btn.click();
                return true;
              }
            }
            if (window.PixelUI && typeof window.PixelUI.setState === 'function') {
              window.PixelUI.setState(target);
              return false;
            }
            return false;
          }, stateId);

          await page.waitForTimeout(180);

          // Also click one interactive micro-element in the newly opened view if present
          await page.evaluate(() => {
            const activeView = document.querySelector('[data-ui-view].is-active');
            if (!activeView) return;
            const secondSlot = activeView.querySelectorAll('[data-item-slot]')[1];
            if (secondSlot) secondSlot.click();
          });
          await page.waitForTimeout(80);
          void clickedInCanvas;
        }

        const audit = await auditCurrentState(page, stateId);

        const cleanName =
          resolvedMode === 'wireframe' ? `${stateId}-wireframe-clean.png` : `${stateId}-clean.png`;
        const cleanPath = path.join(shotsDir, cleanName);
        const canvasHandle = await page.$('#game-canvas');
        if (canvasHandle) {
          await canvasHandle.screenshot({ path: cleanPath });
        } else {
          await page.screenshot({ path: cleanPath });
        }
        screenshots.push(path.relative(outDir, cleanPath).replace(/\\/g, '/'));

        const hasGeometryDefects =
          audit.overflowDefects.length > 0 ||
          audit.overlapDefects.length > 0 ||
          audit.viewportDefects.length > 0;

        if (hasGeometryDefects) {
          await injectDefectAnnotations(page, audit);
          const annName =
            resolvedMode === 'wireframe'
              ? `${stateId}-wireframe-annotated.png`
              : `${stateId}-annotated.png`;
          const annPath = path.join(shotsDir, annName);
          if (canvasHandle) {
            await canvasHandle.screenshot({ path: annPath });
          } else {
            await page.screenshot({ path: annPath });
          }
          screenshots.push(path.relative(outDir, annPath).replace(/\\/g, '/'));
          await clearDefectAnnotations(page);
        }

        stateReports.push(audit);
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    statesTested: stateReports.length,
    totalAssetsVerified: stateReports.reduce((acc, s) => acc + s.assetsChecked, 0),
    consoleErrors: consoleErrors.length + pageErrors.length,
    brokenAssets: stateReports.reduce((acc, s) => acc + s.brokenAssets.length, 0),
    pixelatedViolations: stateReports.reduce((acc, s) => acc + s.pixelatedViolations.length, 0),
    viewportDefects: stateReports.reduce((acc, s) => acc + s.viewportDefects.length, 0),
    overflowDefects: stateReports.reduce((acc, s) => acc + s.overflowDefects.length, 0),
    overlapDefects: stateReports.reduce((acc, s) => acc + s.overlapDefects.length, 0),
    textLegibilityDefects: stateReports.reduce((acc, s) => acc + s.textLegibilityDefects.length, 0),
    warnings: stateReports.reduce((acc, s) => acc + (s.warnings ? s.warnings.length : 0), 0),
  };

  const totalErrors =
    summary.consoleErrors +
    summary.brokenAssets +
    summary.pixelatedViolations +
    summary.viewportDefects +
    summary.overflowDefects +
    summary.overlapDefects +
    summary.textLegibilityDefects;

  const report = {
    status: totalErrors === 0 ? 'PASSED' : 'FAILED',
    page: path.relative(process.cwd(), pageAbs).replace(/\\/g, '/'),
    timestamp: new Date().toISOString(),
    summary,
    consoleErrors: [...consoleErrors, ...pageErrors],
    states: stateReports,
    screenshots,
  };

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  try {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const buildGalleryScript = path.join(scriptDir, 'build_gallery.py');
    if (fs.existsSync(buildGalleryScript)) {
      const previewsRoot = path.dirname(path.dirname(pageAbs));
      const catalogDir = path.join(previewsRoot, '_catalog');
      const pyArgs = fs.existsSync(catalogDir)
        ? [buildGalleryScript, '--previews-root', previewsRoot, '--catalog', catalogDir, '--no-sync-kit']
        : [buildGalleryScript, '--no-sync-kit'];
      spawnSync('python', pyArgs, { stdio: 'ignore' });
    }
  } catch {
    // Non-fatal if Python is unavailable during standalone verify_ui.mjs run
  }

  console.log(`VERIFICATION ${report.status}`);
  console.log(`States tested: ${summary.statesTested} | Assets verified: ${summary.totalAssetsVerified}`);
  console.log(
    `Errors -> console:${summary.consoleErrors} broken:${summary.brokenAssets} pixelated:${summary.pixelatedViolations} ` +
      `viewport:${summary.viewportDefects} overflow:${summary.overflowDefects} overlap:${summary.overlapDefects} text:${summary.textLegibilityDefects} | Warnings: ${summary.warnings}`
  );
  console.log(`Report: ${reportPath}`);
  for (const shot of screenshots) {
    console.log(`Screenshot: ${path.join(outDir, shot)}`);
  }

  process.exit(report.status === 'PASSED' ? 0 : 1);
}

main().catch(err => {
  console.error('verify_ui fatal error:', err);
  process.exit(1);
});
