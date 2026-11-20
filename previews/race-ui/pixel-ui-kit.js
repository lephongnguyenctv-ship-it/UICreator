/* pixel-ui-kit.js — Interactive Game UI Preview Controller, Sprite Hydrator & Studio Workbench */

(function (global) {
  'use strict';

  const DEFAULT_CATALOG_BASE = '../_catalog/';
  const OVERRIDES_STORAGE_KEY = 'pixelui_slice9_overrides_v1';
  const UI_EDITS_STORAGE_PREFIX = 'pixelui_ui_edits_v1:';

  const STUDIO_SERVER_PORT = 17890;
  const FS_DB_NAME = 'pixelui_fs_handles_v1';
  const FS_STORE_NAME = 'handles';
  const FS_CATALOG_HANDLE_KEY = 'catalog_data_js';

  const state = {
    selectedEl: null,
    selectedResourceSliceId: null,
    inspectorMode: 'widget', // 'widget' | 'resource'
    activeEditorSliceAttr: 'data-slice-id',
    currentMode: 'final',
    studioVisible: false,
    applyAllInstances: true,
    swapAllSprites: false,
    collapsedViews: new WeakMap(),
    elementSlice9Overrides: new WeakMap(),
    initialSlice9Defaults: new Map(),
    originalWidgetAttrs: new WeakMap(),
    originalWidgetText: new WeakMap(),
    widgetTransforms: new WeakMap(),
    pendingSavedTransforms: new WeakMap(),
    transformCollapsed: false,
    anchorPresetOpen: false,
    transformMenuOpen: false,
    inlineEdit: null,
    spritePicker: {
      category: 'all',
      search: '',
      attrName: 'data-slice-id',
      targetEl: null,
    },
    resourceDock: {
      open: false,
      activeTab: 'resources', // 'resources' | 'manifest' | 'behavior'
      category: 'all',
      search: '',
      onlyUsed: false,
    },
    hierarchyItems: [],
  };

  function snapshotInitialSlice9Defaults() {
    if (state.initialSlice9Defaults.size > 0) return;
    const catalog = getCatalog();
    if (!catalog || !catalog.slices) return;
    Object.entries(catalog.slices).forEach(([id, rec]) => {
      if (rec && Array.isArray(rec.slice_9) && rec.slice_9.length === 4) {
        state.initialSlice9Defaults.set(id, [...rec.slice_9]);
      }
    });
  }

  function getCatalog() {
    return global.SPRITE_CATALOG || { slices: {} };
  }

  function getCatalogBase() {
    const bodyBase = document.body && document.body.getAttribute('data-catalog-base');
    return bodyBase || DEFAULT_CATALOG_BASE;
  }

  function resolveAssetUrl(filePath) {
    const f = String(filePath || '');
    if (!f) return '';
    if (/^(https?:|data:|\/|\.\.\/)/.test(f)) return f;
    if (f.startsWith('assets/') || f.startsWith('Sprite sheets/')) {
      return getCatalogBase() + '../../' + f;
    }
    return getCatalogBase() + f;
  }

  function loadSlice9Overrides() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveSlice9Overrides(overrides) {
    try {
      if (!global.localStorage) return;
      if (!overrides || Object.keys(overrides).length === 0) {
        global.localStorage.removeItem(OVERRIDES_STORAGE_KEY);
      } else {
        global.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
      }
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }

  function openHandleDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = global.indexedDB.open(FS_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FS_STORE_NAME)) {
          db.createObjectStore(FS_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    });
  }

  async function readCachedFileHandle() {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE_NAME, 'readonly');
      const req = tx.objectStore(FS_STORE_NAME).get(FS_CATALOG_HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function writeCachedFileHandle(handle) {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE_NAME, 'readwrite');
      const req = tx.objectStore(FS_STORE_NAME).put(handle, FS_CATALOG_HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function trySaveCatalogViaFilePicker() {
    if (typeof global.showSaveFilePicker !== 'function') return false;
    try {
      let handle = await readCachedFileHandle().catch(() => null);
      if (handle) {
        const perm =
          (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ||
          (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
        if (!perm) handle = null;
      }
      if (!handle) {
        handle = await global.showSaveFilePicker({
          suggestedName: 'catalog-data.js',
          types: [{ description: 'Sprite Catalog JS', accept: { 'application/javascript': ['.js'] } }],
        });
        await writeCachedFileHandle(handle).catch(() => {});
      }
      const catalog = getCatalog();
      const contents =
        '// Auto-generated by slice_sprites.py for file:// preview compatibility\n' +
        `window.SPRITE_CATALOG = ${JSON.stringify(catalog)};\n`;
      const writable = await handle.createWritable();
      await writable.write(contents);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }

  function persistSlice9ToDisk(payload) {
    return postToStudioServer('/api/save-slice9', payload).then(async result => {
      if (result.ok) return result;
      const savedViaPicker = await trySaveCatalogViaFilePicker();
      if (savedViaPicker) {
        return { ok: true, method: 'file-system-api', resolved: {} };
      }
      return { ok: true, method: 'browser-storage', resolved: {} };
    });
  }

  async function postToStudioServer(apiPath, payload) {
    const endpoints = [];
    if (global.location && /^https?:$/i.test(global.location.protocol)) {
      endpoints.push(new URL(apiPath, global.location.origin).href);
    }
    const studioEndpoint = `http://127.0.0.1:${STUDIO_SERVER_PORT}${apiPath}`;
    if (!endpoints.includes(studioEndpoint)) {
      endpoints.push(studioEndpoint);
    }
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            return { ok: true, method: 'studio-server', resolved: data.resolved || {}, data };
          }
        }
      } catch {
        // Endpoint unreachable; try next candidate
      }
    }
    return { ok: false, method: 'browser-storage', resolved: {} };
  }

  function getPreviewSlugForEdits() {
    const slug = getCurrentPreviewSlug(global.UI_PREVIEWS_CATALOG);
    return slug || 'default';
  }

  function isInternalOverlayElement(el) {
    return Boolean(el && (el.id === '__verify_annotations__' || el.id === '__px_transform_gizmo__'));
  }

  function getElementCanvasPath(el) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas || !el || !canvas.contains(el) || el === canvas || isInternalOverlayElement(el)) return '';
    const parts = [];
    let cur = el;
    while (cur && cur !== canvas) {
      const parent = cur.parentElement;
      if (!parent) return '';
      const kids = Array.from(parent.children).filter(c => !isInternalOverlayElement(c));
      const idx = kids.indexOf(cur);
      if (idx < 0) return '';
      parts.unshift(String(idx));
      cur = parent;
    }
    return parts.join('.');
  }

  function resolveElementByCanvasPath(pathStr) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas || !pathStr) return null;
    const parts = String(pathStr).split('.').map(n => parseInt(n, 10));
    let cur = canvas;
    for (const idx of parts) {
      if (Number.isNaN(idx) || idx < 0) return null;
      const kids = Array.from(cur.children).filter(c => !isInternalOverlayElement(c));
      if (idx >= kids.length) return null;
      cur = kids[idx];
    }
    return cur;
  }

  function loadUiEdits() {
    const slug = getPreviewSlugForEdits();
    const diskEdits = (global.PIXELUI_EDITS && global.PIXELUI_EDITS[slug]) || {};
    let localEdits = {};
    try {
      const raw = global.localStorage && global.localStorage.getItem(UI_EDITS_STORAGE_PREFIX + slug);
      if (raw) localEdits = JSON.parse(raw) || {};
    } catch {
      localEdits = {};
    }
    return {
      textEdits: Object.assign({}, diskEdits.textEdits || {}, localEdits.textEdits || {}),
      spriteEdits: Object.assign({}, diskEdits.spriteEdits || {}, localEdits.spriteEdits || {}),
      transformEdits: Object.assign({}, diskEdits.transformEdits || {}, localEdits.transformEdits || {}),
    };
  }

  function saveUiEdits(edits) {
    const slug = getPreviewSlugForEdits();
    const normalized = {
      textEdits: edits && edits.textEdits ? edits.textEdits : {},
      spriteEdits: edits && edits.spriteEdits ? edits.spriteEdits : {},
      transformEdits: edits && edits.transformEdits ? edits.transformEdits : {},
    };
    global.PIXELUI_EDITS = global.PIXELUI_EDITS || {};
    global.PIXELUI_EDITS[slug] = normalized;
    try {
      if (!global.localStorage) return;
      if (
        Object.keys(normalized.textEdits).length === 0 &&
        Object.keys(normalized.spriteEdits).length === 0 &&
        Object.keys(normalized.transformEdits).length === 0
      ) {
        global.localStorage.removeItem(UI_EDITS_STORAGE_PREFIX + slug);
      } else {
        global.localStorage.setItem(UI_EDITS_STORAGE_PREFIX + slug, JSON.stringify(normalized));
      }
    } catch {
      // Ignore storage errors
    }
  }

  function persistUiEditsToDisk() {
    const slug = getPreviewSlugForEdits();
    const edits = loadUiEdits();
    return postToStudioServer('/api/save-ui-edits', { slug, edits });
  }

  const STATE_SLICE_ATTRS = [
    'data-slice-id',
    'data-slice-hover',
    'data-slice-pressed',
    'data-slice-on',
    'data-slice-off',
    'data-slice-9',
  ];

  const BUTTON_STATE_DEFS = [
    { key: 'idle', label: 'Idle', attr: 'data-slice-id', optional: false },
    { key: 'hover', label: 'Hover', attr: 'data-slice-hover', optional: true },
    { key: 'pressed', label: 'Pressed', attr: 'data-slice-pressed', optional: true },
  ];

  function snapshotWidgetOriginals(el) {
    if (!el || state.originalWidgetAttrs.has(el)) return;
    const attrs = {};
    STATE_SLICE_ATTRS.forEach(name => {
      attrs[name] = el.hasAttribute(name) ? el.getAttribute(name) : null;
    });
    attrs['--w'] = el.style.getPropertyValue('--w') || '';
    attrs['--h'] = el.style.getPropertyValue('--h') || '';
    attrs._classes = {
      px9: el.classList.contains('px-9slice'),
      pxBtnSq: el.classList.contains('px-btn-square'),
    };
    attrs._tfStyles = {
      position: el.style.position || '',
      left: el.style.left || '',
      top: el.style.top || '',
      right: el.style.right || '',
      bottom: el.style.bottom || '',
      width: el.style.width || '',
      height: el.style.height || '',
      minWidth: el.style.minWidth || '',
      minHeight: el.style.minHeight || '',
      maxWidth: el.style.maxWidth || '',
      maxHeight: el.style.maxHeight || '',
      flex: el.style.flex || '',
      display: el.style.display || '',
      transformOrigin: el.style.transformOrigin || '',
      rotate: el.style.rotate || '',
    };
    state.originalWidgetAttrs.set(el, attrs);
  }

  function getDirectTextNode(el) {
    if (!el) return null;
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && (node.textContent || '').trim().length > 0) {
        return node;
      }
    }
    return null;
  }

  function isPureSpritePrimitive(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'IMG') return true;
    if (getDirectTextNode(el)) return false;
    return (
      el.classList.contains('px-icon') ||
      el.classList.contains('px-sprite-box') ||
      el.classList.contains('px-btn-square') ||
      el.classList.contains('toggle-sprite-btn') ||
      (el.hasAttribute('data-slice-id') && el.children.length === 0)
    );
  }

  function isButtonComponent(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute('data-ui-toggle') || el.classList.contains('toggle-sprite-btn')) return false;
    return (
      el.tagName === 'BUTTON' ||
      el.classList.contains('px-btn') ||
      el.classList.contains('px-btn-square') ||
      el.hasAttribute('data-slice-pressed') ||
      el.hasAttribute('data-slice-hover')
    );
  }

  function getButtonSpriteTargetEl(el) {
    if (!el || el.nodeType !== 1) return null;
    if (
      el.classList.contains('px-9slice') ||
      el.classList.contains('px-btn-square') ||
      el.classList.contains('px-sprite-box') ||
      el.tagName === 'IMG'
    ) {
      return el;
    }
    const childSprite = el.querySelector(
      '.px-btn-square, [data-slice-pressed], [data-slice-hover], .px-9slice[data-slice-id], .px-sprite-box[data-slice-id]'
    );
    if (childSprite) return childSprite;
    if (el.children.length === 1 && el.children[0].matches('img[data-slice-id], .px-icon[data-slice-id]')) {
      return el.children[0];
    }
    return el;
  }

  function resolveInteractiveButtonPair(target) {
    if (!target || typeof target.closest !== 'function') return null;
    const direct = target.closest('[data-slice-pressed], [data-slice-hover]');
    if (direct && !direct.hasAttribute('data-ui-toggle')) {
      const hostBtn = direct.closest('button, .px-btn');
      return {
        hostEl: hostBtn || direct,
        spriteEl: direct,
      };
    }
    const btn = target.closest('button, .px-btn');
    if (btn && !btn.hasAttribute('data-ui-toggle')) {
      const spriteEl = getButtonSpriteTargetEl(btn);
      if (spriteEl && (spriteEl.hasAttribute('data-slice-pressed') || spriteEl.hasAttribute('data-slice-hover'))) {
        return {
          hostEl: btn,
          spriteEl,
        };
      }
    }
    return null;
  }

  function syncButtonVisualState(spriteEl) {
    if (!spriteEl || !document.body.contains(spriteEl)) return;
    const pressedId = spriteEl.getAttribute('data-slice-pressed');
    const hoverId = spriteEl.getAttribute('data-slice-hover');
    const idleId = spriteEl.getAttribute('data-slice-id');

    let nextSlice = idleId;
    if (!isWireframeMode() && !isEditMode()) {
      if (spriteEl.classList.contains('is-pressed') && pressedId && resolveSliceUrl(pressedId)) {
        nextSlice = pressedId;
      } else if (spriteEl.classList.contains('is-hovered') && hoverId && resolveSliceUrl(hoverId)) {
        nextSlice = hoverId;
      }
    }
    if (nextSlice) {
      applySliceToElement(spriteEl, nextSlice);
    }
  }

  function hasNonEmptyOriginalText(el) {
    return Boolean(el && state.originalWidgetText.has(el) && state.originalWidgetText.get(el).length > 0);
  }

  function getEditableTextInfo(el) {
    if (!el || el.tagName === 'IMG') return null;
    const directNode = getDirectTextNode(el);
    if (directNode) {
      if (!state.originalWidgetText.has(el)) {
        state.originalWidgetText.set(el, directNode.textContent.trim().replace(/\s+/g, ' '));
      }
      return {
        targetEl: el,
        textNode: directNode,
        currentText: directNode.textContent.trim().replace(/\s+/g, ' '),
      };
    }

    if (!isPureSpritePrimitive(el) && hasNonEmptyOriginalText(el)) {
      return {
        targetEl: el,
        textNode: null,
        currentText: (el.textContent || '').trim().replace(/\s+/g, ' '),
      };
    }

    const isCompactWidget =
      el.matches('button, a, .wallet-chip, .hud-speech, .px-wire-box, h1, h2, h3, h4, p, span, strong, label') ||
      (el.children.length <= 3 && !el.querySelector('[data-ui-view]'));
    if (isCompactWidget) {
      const candidates = Array.from(el.querySelectorAll('span, strong, em, p, h1, h2, h3, h4, div, label')).filter(
        child =>
          !child.hasAttribute('data-slice-id') &&
          !isPureSpritePrimitive(child) &&
          (Boolean(getDirectTextNode(child)) || hasNonEmptyOriginalText(child))
      );
      if (candidates.length === 1) {
        const targetEl = candidates[0];
        const node = getDirectTextNode(targetEl);
        if (!state.originalWidgetText.has(targetEl) && node) {
          state.originalWidgetText.set(targetEl, node.textContent.trim().replace(/\s+/g, ' '));
        }
        return {
          targetEl,
          textNode: node,
          currentText: node
            ? node.textContent.trim().replace(/\s+/g, ' ')
            : (targetEl.textContent || '').trim().replace(/\s+/g, ' '),
        };
      }
    }
    return null;
  }

  function setTargetElementText(targetEl, nextText) {
    if (!targetEl) return;
    if (!state.originalWidgetText.has(targetEl)) {
      const origNode = getDirectTextNode(targetEl);
      state.originalWidgetText.set(targetEl, origNode ? origNode.textContent.trim().replace(/\s+/g, ' ') : (targetEl.textContent || '').trim());
    }
    const existingNode = getDirectTextNode(targetEl);
    if (existingNode) {
      existingNode.textContent = nextText;
    } else if (targetEl.children.length === 0) {
      targetEl.textContent = nextText;
    } else {
      targetEl.insertBefore(document.createTextNode(nextText), targetEl.firstChild);
    }
  }

  function applyWidgetTextEdit(el, nextText, persistToServer = false) {
    const info = getEditableTextInfo(el);
    const targetEl = info && info.targetEl ? info.targetEl : null;
    if (!targetEl) return false;

    setTargetElementText(targetEl, nextText);

    const pathKey = getElementCanvasPath(targetEl);
    if (pathKey) {
      const edits = loadUiEdits();
      edits.textEdits[pathKey] = nextText;
      saveUiEdits(edits);
    }

    renderHierarchyTree();
    if (state.selectedEl === el) {
      updateInspectorGeometryReadout();
    }

    if (persistToServer) {
      return persistUiEditsToDisk();
    }
    return Promise.resolve({ ok: true, method: 'browser-storage' });
  }

  function applySpriteAttrToElement(el, attrName, newSliceId) {
    if (!el || !newSliceId) return;
    snapshotWidgetOriginals(el);
    el.setAttribute(attrName, newSliceId);

    if (attrName === 'data-slice-id') {
      if (
        getButtonSpriteTargetEl(el) === el &&
        el.tagName !== 'IMG' &&
        !el.classList.contains('px-9slice') &&
        !el.classList.contains('px-btn-square') &&
        !el.classList.contains('px-sprite-box') &&
        !el.classList.contains('toggle-sprite-btn') &&
        !el.classList.contains('px-icon')
      ) {
        const resClassCheck = resolveSliceUrl(newSliceId);
        if (resClassCheck && resClassCheck.rec && Array.isArray(resClassCheck.rec.slice_9)) {
          el.classList.add('px-9slice');
        } else {
          el.classList.add('px-btn-square');
        }
      }
      el.removeAttribute('data-slice-9');
      if (el.dataset) delete el.dataset.htmlSlice9;
      state.elementSlice9Overrides.delete(el);
      const resolved = resolveSliceUrl(newSliceId);
      if (resolved && resolved.rec) {
        el.style.setProperty('--w', String(resolved.rec.width));
        el.style.setProperty('--h', String(resolved.rec.height));
      }
      applySliceToElement(el, newSliceId);
    } else {
      syncButtonVisualState(el);
    }
  }

  function findMatchingSpriteTargets(el, attrName) {
    const targets = [el];
    const oldSliceId = el.getAttribute(attrName);
    const isBtn = isButtonComponent(el);
    let selector = null;
    if (oldSliceId) {
      selector = `#game-canvas [${attrName}="${oldSliceId}"]`;
    } else if (attrName !== 'data-slice-id') {
      const idleId = el.getAttribute('data-slice-id');
      if (idleId) {
        selector = `#game-canvas [data-slice-id="${idleId}"]`;
      }
    }
    if (selector) {
      document.querySelectorAll(selector).forEach(node => {
        if (node === el) return;
        if (isBtn && !isButtonComponent(node)) return;
        targets.push(node);
      });
    }
    return targets;
  }

  function refreshStudioViewsAfterSpriteChange() {
    renderManifestTable();
    renderResourcesDockGrid();
    renderHierarchyTree();
    if (state.selectedEl || state.inspectorMode === 'resource') {
      renderInspector();
    }
  }

  function changeWidgetSprite(el, attrName, newSliceId, applyToAllMatching = false) {
    if (!el || !newSliceId) return Promise.resolve({ ok: false });
    const resolved = resolveSliceUrl(newSliceId);
    if (!resolved) {
      return Promise.resolve({ ok: false, error: `Unknown slice ID: ${newSliceId}` });
    }

    const baseTarget = isButtonComponent(el) ? getButtonSpriteTargetEl(el) || el : el;
    const edits = loadUiEdits();
    const targets = applyToAllMatching ? findMatchingSpriteTargets(baseTarget, attrName) : [baseTarget];

    targets.forEach(node => {
      applySpriteAttrToElement(node, attrName, newSliceId);
      const pKey = getElementCanvasPath(node);
      if (pKey) {
        edits.spriteEdits[pKey] = edits.spriteEdits[pKey] || {};
        edits.spriteEdits[pKey][attrName] = newSliceId;
      }
    });

    saveUiEdits(edits);
    refreshStudioViewsAfterSpriteChange();
    return persistUiEditsToDisk();
  }

  function clearWidgetSpriteAttr(el, attrName, applyToAllMatching = false) {
    if (!el || !attrName || attrName === 'data-slice-id') return Promise.resolve({ ok: false });
    const baseTarget = isButtonComponent(el) ? getButtonSpriteTargetEl(el) || el : el;
    const edits = loadUiEdits();
    const targets = applyToAllMatching ? findMatchingSpriteTargets(baseTarget, attrName) : [baseTarget];

    targets.forEach(node => {
      snapshotWidgetOriginals(node);
      node.removeAttribute(attrName);
      if (attrName === 'data-slice-hover') node.classList.remove('is-hovered');
      if (attrName === 'data-slice-pressed') node.classList.remove('is-pressed');
      syncButtonVisualState(node);
      const pKey = getElementCanvasPath(node);
      if (pKey) {
        edits.spriteEdits[pKey] = edits.spriteEdits[pKey] || {};
        edits.spriteEdits[pKey][attrName] = '';
      }
    });

    saveUiEdits(edits);
    refreshStudioViewsAfterSpriteChange();
    return persistUiEditsToDisk();
  }

  function resetSingleElementSpriteAttrs(node, edits) {
    if (!node) return;
    const nodePath = getElementCanvasPath(node);
    if (nodePath && edits.spriteEdits[nodePath]) {
      delete edits.spriteEdits[nodePath];
    }
    const origAttrs = state.originalWidgetAttrs.get(node);
    if (!origAttrs) return;

    STATE_SLICE_ATTRS.forEach(name => {
      if (origAttrs[name] === null) {
        node.removeAttribute(name);
      } else {
        node.setAttribute(name, origAttrs[name]);
      }
    });
    if (origAttrs._classes) {
      node.classList.toggle('px-9slice', Boolean(origAttrs._classes.px9));
      node.classList.toggle('px-btn-square', Boolean(origAttrs._classes.pxBtnSq));
    }
    if (origAttrs['--w']) node.style.setProperty('--w', origAttrs['--w']);
    else node.style.removeProperty('--w');
    if (origAttrs['--h']) node.style.setProperty('--h', origAttrs['--h']);
    else node.style.removeProperty('--h');
    if (node.dataset) {
      node.dataset.htmlSlice9 = origAttrs['data-slice-9'] || '';
    }
    node.classList.remove('is-hovered', 'is-pressed');
    state.elementSlice9Overrides.delete(node);
    const restoredId = node.getAttribute('data-slice-id');
    if (restoredId) {
      applySliceToElement(node, restoredId);
    } else if (node.tagName !== 'IMG') {
      node.style.removeProperty('--skin-url');
      node.style.removeProperty('--slice-t');
      node.style.removeProperty('--slice-r');
      node.style.removeProperty('--slice-b');
      node.style.removeProperty('--slice-l');
    }
  }

  /* ========================================================================
     Craftland RectTransform System (16 Presets, Live Math, Gizmos & Edits)
     ======================================================================== */

  const ANCHOR_PRESETS = [
    { id: 'top-left',       hLabel: 'Left',    vLabel: 'Top',     aMin: [0, 1],     aMax: [0, 1] },
    { id: 'top-center',     hLabel: 'Center',  vLabel: 'Top',     aMin: [0.5, 1],   aMax: [0.5, 1] },
    { id: 'top-right',      hLabel: 'Right',   vLabel: 'Top',     aMin: [1, 1],     aMax: [1, 1] },
    { id: 'top-stretch',    hLabel: 'Stretch', vLabel: 'Top',     aMin: [0, 1],     aMax: [1, 1] },
    { id: 'middle-left',    hLabel: 'Left',    vLabel: 'Middle',  aMin: [0, 0.5],   aMax: [0, 0.5] },
    { id: 'middle-center',  hLabel: 'Center',  vLabel: 'Middle',  aMin: [0.5, 0.5], aMax: [0.5, 0.5] },
    { id: 'middle-right',   hLabel: 'Right',   vLabel: 'Middle',  aMin: [1, 0.5],   aMax: [1, 0.5] },
    { id: 'middle-stretch', hLabel: 'Stretch', vLabel: 'Middle',  aMin: [0, 0.5],   aMax: [1, 0.5] },
    { id: 'bottom-left',    hLabel: 'Left',    vLabel: 'Bottom',  aMin: [0, 0],     aMax: [0, 0] },
    { id: 'bottom-center',  hLabel: 'Center',  vLabel: 'Bottom',  aMin: [0.5, 0],   aMax: [0.5, 0] },
    { id: 'bottom-right',   hLabel: 'Right',   vLabel: 'Bottom',  aMin: [1, 0],     aMax: [1, 0] },
    { id: 'bottom-stretch', hLabel: 'Stretch', vLabel: 'Bottom',  aMin: [0, 0],     aMax: [1, 0] },
    { id: 'stretch-left',   hLabel: 'Left',    vLabel: 'Stretch', aMin: [0, 0],     aMax: [0, 1] },
    { id: 'stretch-center', hLabel: 'Center',  vLabel: 'Stretch', aMin: [0.5, 0],   aMax: [0.5, 1] },
    { id: 'stretch-right',  hLabel: 'Right',   vLabel: 'Stretch', aMin: [1, 0],     aMax: [1, 1] },
    { id: 'stretch-both',   hLabel: 'Stretch', vLabel: 'Stretch', aMin: [0, 0],     aMax: [1, 1] },
  ];

  function tfNear(a, b, eps = 0.002) {
    return Math.abs(a - b) <= eps;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function roundTfNum(v, decimals = 2) {
    if (!Number.isFinite(v)) return 0;
    const f = Math.pow(10, decimals);
    const r = Math.round(v * f) / f;
    return Object.is(r, -0) ? 0 : r;
  }

  function formatTfVal(v, decimals = 2) {
    return String(roundTfNum(v, decimals));
  }

  function getCanvasZoomFactor() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return 1;
    const r = canvas.getBoundingClientRect();
    const baseW = canvas.offsetWidth || 1280;
    return r.width > 0 && baseW > 0 ? r.width / baseW : 1;
  }

  function getTransformParent(el) {
    const canvas = document.getElementById('game-canvas');
    if (!el || !canvas) return canvas;
    if (el.parentElement && canvas.contains(el.parentElement)) {
      return el.parentElement;
    }
    return canvas;
  }

  function findMatchingAnchorPreset(anchorMin, anchorMax) {
    const [x0, y0] = anchorMin;
    const [x1, y1] = anchorMax;
    return (
      ANCHOR_PRESETS.find(
        p =>
          tfNear(x0, p.aMin[0]) &&
          tfNear(y0, p.aMin[1]) &&
          tfNear(x1, p.aMax[0]) &&
          tfNear(y1, p.aMax[1])
      ) || null
    );
  }

  function getAnchorAxisLabels(anchorMin, anchorMax) {
    const preset = findMatchingAnchorPreset(anchorMin, anchorMax);
    if (preset) {
      return { hLabel: preset.hLabel, vLabel: preset.vLabel, preset };
    }
    const [x0, y0] = anchorMin;
    const [x1, y1] = anchorMax;
    let hLabel = 'Custom';
    if (tfNear(x0, 0) && tfNear(x1, 0)) hLabel = 'Left';
    else if (tfNear(x0, 0.5) && tfNear(x1, 0.5)) hLabel = 'Center';
    else if (tfNear(x0, 1) && tfNear(x1, 1)) hLabel = 'Right';
    else if (tfNear(x0, 0) && tfNear(x1, 1)) hLabel = 'Stretch';

    let vLabel = 'Custom';
    if (tfNear(y0, 1) && tfNear(y1, 1)) vLabel = 'Top';
    else if (tfNear(y0, 0.5) && tfNear(y1, 0.5)) vLabel = 'Middle';
    else if (tfNear(y0, 0) && tfNear(y1, 0)) vLabel = 'Bottom';
    else if (tfNear(y0, 0) && tfNear(y1, 1)) vLabel = 'Stretch';

    return { hLabel, vLabel, preset: null };
  }

  function renderAnchorPresetSvg(aMin, aMax, size = 36) {
    const x0 = clamp01(aMin[0]);
    const y0 = clamp01(aMin[1]);
    const x1 = clamp01(aMax[0]);
    const y1 = clamp01(aMax[1]);
    const stretchX = Math.abs(x1 - x0) > 0.002;
    const stretchY = Math.abs(y1 - y0) > 0.002;

    let ix;
    let iw;
    if (stretchX) {
      ix = 6;
      iw = 24;
    } else if (stretchY) {
      iw = 10;
      const cx = 4 + x0 * 28;
      ix = tfNear(x0, 0) ? 7 : tfNear(x0, 1) ? 19 : Math.max(6, Math.min(20, cx - iw / 2));
    } else {
      iw = 12;
      ix = tfNear(x0, 0) ? 6 : tfNear(x0, 1) ? 18 : 4 + x0 * 28 - iw / 2;
      ix = Math.max(6, Math.min(18, ix));
    }

    let iy;
    let ih;
    if (stretchY) {
      iy = 6;
      ih = 24;
    } else if (stretchX) {
      ih = 10;
      const cy = 32 - y0 * 28;
      iy = tfNear(y0, 1) ? 7 : tfNear(y0, 0) ? 19 : Math.max(6, Math.min(20, cy - ih / 2));
    } else {
      ih = 12;
      iy = tfNear(y0, 1) ? 6 : tfNear(y0, 0) ? 18 : 32 - y0 * 28 - ih / 2;
      iy = Math.max(6, Math.min(18, iy));
    }

    const lines = [];
    if (!stretchX && !stretchY) {
      const ax = roundTfNum(4 + x0 * 28, 2);
      const ay = roundTfNum(32 - y0 * 28, 2);
      lines.push(`<line x1="${ax}" y1="4" x2="${ax}" y2="32" stroke="#f59e0b" stroke-width="1.2"/>`);
      lines.push(`<line x1="4" y1="${ay}" x2="32" y2="${ay}" stroke="#f59e0b" stroke-width="1.2"/>`);
    }

    const arrows = [];
    if (stretchX) {
      const cy = roundTfNum(iy + ih / 2, 2);
      arrows.push(
        `<line x1="7.5" y1="${cy}" x2="28.5" y2="${cy}" stroke="#10b981" stroke-width="1.4"/>` +
          `<polyline points="10.5,${cy - 2.6} 7.2,${cy} 10.5,${cy + 2.6}" fill="none" stroke="#10b981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<polyline points="25.5,${cy - 2.6} 28.8,${cy} 25.5,${cy + 2.6}" fill="none" stroke="#10b981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
    if (stretchY) {
      const cx = roundTfNum(ix + iw / 2, 2);
      arrows.push(
        `<line x1="${cx}" y1="7.5" x2="${cx}" y2="28.5" stroke="#10b981" stroke-width="1.4"/>` +
          `<polyline points="${cx - 2.6},10.5 ${cx},7.2 ${cx + 2.6},10.5" fill="none" stroke="#10b981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
          `<polyline points="${cx - 2.6},25.5 ${cx},28.8 ${cx + 2.6},25.5" fill="none" stroke="#10b981" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }

    const dotMap = new Map();
    [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ].forEach(([px, py]) => {
      const sx = roundTfNum(4 + px * 28, 2);
      const sy = roundTfNum(32 - py * 28, 2);
      dotMap.set(`${sx},${sy}`, `<rect x="${sx - 1.7}" y="${sy - 1.7}" width="3.4" height="3.4" fill="#3b82f6" rx="0.5"/>`);
    });

    return `
      <svg viewBox="0 0 36 36" width="${size}" height="${size}" aria-hidden="true">
        <rect x="4" y="4" width="28" height="28" fill="none" stroke="#5b6270" stroke-width="1"/>
        ${lines.join('')}
        <rect x="${roundTfNum(ix, 2)}" y="${roundTfNum(iy, 2)}" width="${roundTfNum(iw, 2)}" height="${roundTfNum(ih, 2)}" fill="none" stroke="#9aa4b8" stroke-width="1.2"/>
        ${arrows.join('')}
        ${Array.from(dotMap.values()).join('')}
      </svg>
    `;
  }

  function measureElementTransformBox(el, anchorMin, anchorMax, pivot, existingRotate = 0) {
    const parent = getTransformParent(el);
    if (!parent || !el) return null;
    const zoom = getCanvasZoomFactor();
    const pRect = parent.getBoundingClientRect();
    if (pRect.width <= 0 || pRect.height <= 0) return null;

    const prevRotate = el.style.rotate;
    const rotDeg = existingRotate || parseFloat(prevRotate || '0') || 0;
    if (prevRotate) el.style.rotate = '0deg';
    const eRect = el.getBoundingClientRect();
    if (prevRotate) el.style.rotate = prevRotate;

    const parentW = pRect.width / zoom;
    const parentH = pRect.height / zoom;
    const width = Math.max(1, Math.round(eRect.width / zoom));
    const height = Math.max(1, Math.round(eRect.height / zoom));
    const cssLeft = (eRect.left - pRect.left) / zoom;
    const cssTop = (eRect.top - pRect.top) / zoom;

    const anchorPxX = ((anchorMin[0] + anchorMax[0]) / 2) * parentW;
    const anchorPxY = ((anchorMin[1] + anchorMax[1]) / 2) * parentH;
    const pivotPxX = cssLeft + pivot[0] * width;
    const pivotPxY = parentH - cssTop - (1 - pivot[1]) * height;

    return {
      parentW,
      parentH,
      cssLeft,
      cssTop,
      posX: Math.round(pivotPxX - anchorPxX),
      posY: Math.round(pivotPxY - anchorPxY),
      width,
      height,
      rotate: rotDeg,
    };
  }

  function getWidgetTransformState(el) {
    if (!el) return null;
    const existing = state.widgetTransforms.get(el);
    if (existing) {
      if (!existing.dirty) {
        const measured = measureElementTransformBox(
          el,
          existing.anchorMin,
          existing.anchorMax,
          existing.pivot,
          existing.rotate
        );
        if (measured) {
          existing.posX = measured.posX;
          existing.posY = measured.posY;
          existing.width = measured.width;
          existing.height = measured.height;
          if (!existing.lockAspect) {
            existing.aspectRatio = measured.height > 0 ? measured.width / measured.height : 1;
          }
        }
      }
      return existing;
    }

    const anchorMin = [0.5, 0.5];
    const anchorMax = [0.5, 0.5];
    const pivot = [0.5, 0.5];
    const measured = measureElementTransformBox(el, anchorMin, anchorMax, pivot, 0);
    const tf = {
      posX: measured ? measured.posX : 0,
      posY: measured ? measured.posY : 0,
      width: measured ? measured.width : 100,
      height: measured ? measured.height : 40,
      anchorMin,
      anchorMax,
      pivot,
      rotate: measured ? measured.rotate : 0,
      lockAspect: false,
      aspectRatio: measured && measured.height > 0 ? measured.width / measured.height : 1,
      dirty: false,
    };
    state.widgetTransforms.set(el, tf);
    return tf;
  }

  function applyWidgetTransformToDom(el, tf, options = {}) {
    if (!el || !tf) return false;
    const parent = getTransformParent(el);
    if (!parent) return false;

    const pRect = parent.getBoundingClientRect();
    if (pRect.width <= 0 || pRect.height <= 0) {
      state.widgetTransforms.set(el, tf);
      if (tf.dirty) {
        state.pendingSavedTransforms.set(el, tf);
      }
      return false;
    }

    snapshotWidgetOriginals(el);
    state.widgetTransforms.set(el, tf);
    state.pendingSavedTransforms.delete(el);

    if (!options.applyCss) {
      return true;
    }

    const zoom = getCanvasZoomFactor();
    const parentW = pRect.width / zoom;
    const parentH = pRect.height / zoom;

    const width = Math.max(1, Math.round(tf.width));
    const height = Math.max(1, Math.round(tf.height));
    const [aMinX, aMinY] = tf.anchorMin;
    const [aMaxX, aMaxY] = tf.anchorMax;
    const [pivX, pivY] = tf.pivot;

    const anchorPxX = ((aMinX + aMaxX) / 2) * parentW;
    const anchorPxY = ((aMinY + aMaxY) / 2) * parentH;
    const pivotPxX = anchorPxX + tf.posX;
    const pivotPxY = anchorPxY + tf.posY;
    const targetCssLeft = pivotPxX - pivX * width;
    const targetCssTop = parentH - pivotPxY - (1 - pivY) * height;

    const cs = getComputedStyle(el);
    if (cs.display === 'inline') {
      el.style.display = 'inline-block';
    }
    if (cs.position === 'static') {
      el.style.position = 'relative';
    }
    el.style.flex = '0 0 auto';
    el.style.minWidth = '0px';
    el.style.minHeight = '0px';
    el.style.maxWidth = 'none';
    el.style.maxHeight = 'none';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;

    // Measure un-offset flow origin with rotation temporarily zeroed so bounding rects stay axis-aligned
    el.style.rotate = '0deg';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.left = '0px';
    el.style.top = '0px';

    const curRect = el.getBoundingClientRect();
    const curParentRect = parent.getBoundingClientRect();
    const naturalLeft = (curRect.left - curParentRect.left) / zoom;
    const naturalTop = (curRect.top - curParentRect.top) / zoom;

    el.style.left = `${Math.round(targetCssLeft - naturalLeft)}px`;
    el.style.top = `${Math.round(targetCssTop - naturalTop)}px`;
    el.style.transformOrigin = `${roundTfNum(pivX * 100, 2)}% ${roundTfNum((1 - pivY) * 100, 2)}%`;
    el.style.rotate = tf.rotate ? `${roundTfNum(tf.rotate, 2)}deg` : '';

    return true;
  }

  function saveWidgetTransformEdit(el, tf, persistToServer = false) {
    if (!el || !tf) return Promise.resolve({ ok: true, method: 'browser-storage' });
    const pathKey = getElementCanvasPath(el);
    if (pathKey) {
      const edits = loadUiEdits();
      edits.transformEdits[pathKey] = {
        posX: roundTfNum(tf.posX, 2),
        posY: roundTfNum(tf.posY, 2),
        width: Math.max(1, Math.round(tf.width)),
        height: Math.max(1, Math.round(tf.height)),
        anchorMin: [roundTfNum(tf.anchorMin[0], 4), roundTfNum(tf.anchorMin[1], 4)],
        anchorMax: [roundTfNum(tf.anchorMax[0], 4), roundTfNum(tf.anchorMax[1], 4)],
        pivot: [roundTfNum(tf.pivot[0], 4), roundTfNum(tf.pivot[1], 4)],
        rotate: roundTfNum(tf.rotate || 0, 2),
        lockAspect: Boolean(tf.lockAspect),
        aspectRatio: roundTfNum(tf.aspectRatio || 1, 4),
      };
      saveUiEdits(edits);
    }
    if (persistToServer) {
      return persistUiEditsToDisk();
    }
    return Promise.resolve({ ok: true, method: 'browser-storage' });
  }

  function flushPendingTransforms() {
    if (!state.pendingSavedTransforms) return;
    document.querySelectorAll('#game-canvas *').forEach(el => {
      const pending = state.pendingSavedTransforms.get(el);
      if (pending) {
        applyWidgetTransformToDom(el, pending, { applyCss: Boolean(pending.dirty) });
      }
    });
  }

  function recalculatePosForNewAnchor(el, tf, nextAnchorMin, nextAnchorMax) {
    const parent = getTransformParent(el);
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const zoom = getCanvasZoomFactor();
    const parentW = pRect.width > 0 ? pRect.width / zoom : 1280;
    const parentH = pRect.height > 0 ? pRect.height / zoom : 720;

    // Compute current visual pivot in parent Craftland coordinates from old anchor+pos
    const oldAnchorX = ((tf.anchorMin[0] + tf.anchorMax[0]) / 2) * parentW;
    const oldAnchorY = ((tf.anchorMin[1] + tf.anchorMax[1]) / 2) * parentH;
    const pivotPxX = oldAnchorX + tf.posX;
    const pivotPxY = oldAnchorY + tf.posY;

    const newAnchorX = ((nextAnchorMin[0] + nextAnchorMax[0]) / 2) * parentW;
    const newAnchorY = ((nextAnchorMin[1] + nextAnchorMax[1]) / 2) * parentH;

    tf.anchorMin = [roundTfNum(nextAnchorMin[0], 4), roundTfNum(nextAnchorMin[1], 4)];
    tf.anchorMax = [roundTfNum(nextAnchorMax[0], 4), roundTfNum(nextAnchorMax[1], 4)];
    tf.posX = Math.round(pivotPxX - newAnchorX);
    tf.posY = Math.round(pivotPxY - newAnchorY);
  }

  function snapWidgetTransformToAnchor(el, tf, aMin, aMax) {
    const parent = getTransformParent(el);
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const zoom = getCanvasZoomFactor();
    const parentW = pRect.width > 0 ? pRect.width / zoom : 1280;
    const parentH = pRect.height > 0 ? pRect.height / zoom : 720;

    tf.anchorMin = [roundTfNum(aMin[0], 4), roundTfNum(aMin[1], 4)];
    tf.anchorMax = [roundTfNum(aMax[0], 4), roundTfNum(aMax[1], 4)];

    const [aMinX, aMinY] = tf.anchorMin;
    const [aMaxX, aMaxY] = tf.anchorMax;
    const [pivX, pivY] = tf.pivot;
    const stretchX = tfNear(aMinX, 0) && tfNear(aMaxX, 1);
    const stretchY = tfNear(aMinY, 0) && tfNear(aMaxY, 1);

    if (stretchX) {
      tf.width = Math.max(1, Math.round(parentW));
    }
    if (stretchY) {
      tf.height = Math.max(1, Math.round(parentH));
    }
    if (tf.lockAspect && tf.aspectRatio > 0) {
      if (stretchX && !stretchY) {
        tf.height = Math.max(1, Math.round(tf.width / tf.aspectRatio));
      } else if (stretchY && !stretchX) {
        tf.width = Math.max(1, Math.round(tf.height * tf.aspectRatio));
      } else if (stretchX && stretchY) {
        tf.aspectRatio = tf.height > 0 ? tf.width / tf.height : 1;
      }
    } else {
      tf.aspectRatio = tf.height > 0 ? tf.width / tf.height : 1;
    }

    if (stretchX) {
      tf.posX = Math.round((pivX - 0.5) * tf.width);
    } else if (tfNear(aMinX, 0) && tfNear(aMaxX, 0)) {
      tf.posX = Math.round(pivX * tf.width);
    } else if (tfNear(aMinX, 0.5) && tfNear(aMaxX, 0.5)) {
      tf.posX = Math.round((pivX - 0.5) * tf.width);
    } else if (tfNear(aMinX, 1) && tfNear(aMaxX, 1)) {
      tf.posX = Math.round((pivX - 1) * tf.width);
    } else {
      tf.posX = 0;
    }

    if (stretchY) {
      tf.posY = Math.round((pivY - 0.5) * tf.height);
    } else if (tfNear(aMinY, 1) && tfNear(aMaxY, 1)) {
      tf.posY = -Math.round((1 - pivY) * tf.height);
    } else if (tfNear(aMinY, 0.5) && tfNear(aMaxY, 0.5)) {
      tf.posY = Math.round((pivY - 0.5) * tf.height);
    } else if (tfNear(aMinY, 0) && tfNear(aMaxY, 0)) {
      tf.posY = Math.round(pivY * tf.height);
    } else {
      tf.posY = 0;
    }

    tf.dirty = true;
    applyWidgetTransformToDom(el, tf, { applyCss: true });
  }

  function resetSingleElementTransform(el, edits) {
    if (!el) return;
    const pKey = getElementCanvasPath(el);
    if (pKey && edits && edits.transformEdits && edits.transformEdits[pKey] !== undefined) {
      delete edits.transformEdits[pKey];
    }
    const orig = state.originalWidgetAttrs.get(el);
    if (orig && orig._tfStyles) {
      Object.entries(orig._tfStyles).forEach(([prop, val]) => {
        el.style[prop] = val || '';
      });
    }
    state.widgetTransforms.delete(el);
    state.pendingSavedTransforms.delete(el);
  }

  function ensureTransformGizmoLayer() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas || isCleanMode()) return null;
    let layer = document.getElementById('__px_transform_gizmo__');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = '__px_transform_gizmo__';
      layer.setAttribute('aria-hidden', 'true');
      canvas.appendChild(layer);
    }
    return layer;
  }

  function renderTransformGizmo() {
    const canvas = document.getElementById('game-canvas');
    const layer = document.getElementById('__px_transform_gizmo__') || (isEditMode() && !isCleanMode() ? ensureTransformGizmoLayer() : null);
    if (!canvas || !layer) {
      if (canvas) canvas.classList.remove('has-gizmo');
      return;
    }

    const el = state.selectedEl;
    if (
      isCleanMode() ||
      !isEditMode() ||
      state.inspectorMode !== 'widget' ||
      !el ||
      !document.body.contains(el) ||
      !canvas.contains(el)
    ) {
      layer.classList.remove('is-active');
      layer.innerHTML = '';
      canvas.classList.remove('has-gizmo');
      return;
    }

    const parent = getTransformParent(el);
    if (!parent) return;
    const cRect = canvas.getBoundingClientRect();
    const pRect = parent.getBoundingClientRect();
    if (pRect.width <= 0 || pRect.height <= 0) {
      layer.classList.remove('is-active');
      layer.innerHTML = '';
      canvas.classList.remove('has-gizmo');
      return;
    }

    const tf = getWidgetTransformState(el);
    if (!tf) return;

    const zoom = getCanvasZoomFactor();
    const parentLeft = (pRect.left - cRect.left) / zoom;
    const parentTop = (pRect.top - cRect.top) / zoom;
    const parentW = pRect.width / zoom;
    const parentH = pRect.height / zoom;

    const [aMinX, aMinY] = tf.anchorMin;
    const [aMaxX, aMaxY] = tf.anchorMax;
    const [pivX, pivY] = tf.pivot;

    const aLeft = parentLeft + aMinX * parentW;
    const aRight = parentLeft + aMaxX * parentW;
    const aTop = parentTop + (1 - aMaxY) * parentH;
    const aBottom = parentTop + (1 - aMinY) * parentH;

    const anchorPxX = ((aMinX + aMaxX) / 2) * parentW;
    const anchorPxY = ((aMinY + aMaxY) / 2) * parentH;
    const boxLeft = parentLeft + anchorPxX + tf.posX - pivX * tf.width;
    const boxTop = parentTop + (parentH - (anchorPxY + tf.posY)) - (1 - pivY) * tf.height;

    const anchorPieces = [];
    const sameAnchorPt = tfNear(aMinX, aMaxX) && tfNear(aMinY, aMaxY);
    if (sameAnchorPt) {
      anchorPieces.push(
        `<div class="px-gizmo-anchor-guide-h" style="left:${roundTfNum(parentLeft, 1)}px;top:${roundTfNum(aTop, 1)}px;width:${roundTfNum(parentW, 1)}px;"></div>` +
          `<div class="px-gizmo-anchor-guide-v" style="left:${roundTfNum(aLeft, 1)}px;top:${roundTfNum(parentTop, 1)}px;height:${roundTfNum(parentH, 1)}px;"></div>` +
          `<div class="px-gizmo-anchor-dot" style="left:${roundTfNum(aLeft, 1)}px;top:${roundTfNum(aTop, 1)}px;"></div>`
      );
    } else {
      anchorPieces.push(
        `<div class="px-gizmo-anchor-box" style="left:${roundTfNum(Math.min(aLeft, aRight), 1)}px;top:${roundTfNum(Math.min(aTop, aBottom), 1)}px;width:${roundTfNum(Math.max(2, Math.abs(aRight - aLeft)), 1)}px;height:${roundTfNum(Math.max(2, Math.abs(aBottom - aTop)), 1)}px;"></div>`
      );
      const pts = new Map();
      [
        [aLeft, aTop],
        [aRight, aTop],
        [aLeft, aBottom],
        [aRight, aBottom],
      ].forEach(([px, py]) => {
        const key = `${Math.round(px)},${Math.round(py)}`;
        if (!pts.has(key)) {
          pts.set(
            key,
            `<div class="px-gizmo-anchor-dot" style="left:${roundTfNum(px, 1)}px;top:${roundTfNum(py, 1)}px;"></div>`
          );
        }
      });
      anchorPieces.push(Array.from(pts.values()).join(''));
    }

    const originX = roundTfNum(pivX * 100, 2);
    const originY = roundTfNum((1 - pivY) * 100, 2);
    const rotDeg = roundTfNum(tf.rotate || 0, 2);
    const roleLabel = describeTreeLabel(el);

    layer.innerHTML = `
      ${anchorPieces.join('')}
      <div
        class="px-gizmo-box"
        style="left:${roundTfNum(boxLeft, 1)}px;top:${roundTfNum(boxTop, 1)}px;width:${Math.max(1, Math.round(tf.width))}px;height:${Math.max(1, Math.round(tf.height))}px;transform-origin:${originX}% ${originY}%;rotate:${rotDeg}deg;"
      >
        <div class="px-gizmo-move-bar" data-tf-drag-move title="Drag to move widget">✥ ${escapeHtml(roleLabel)}</div>
        <div class="px-gizmo-pivot" style="left:${originX}%;top:${originY}%;" title="Pivot (${roundTfNum(pivX, 2)}, ${roundTfNum(pivY, 2)})"></div>
        <div class="px-gizmo-handle" data-tf-handle="nw"></div>
        <div class="px-gizmo-handle" data-tf-handle="n"></div>
        <div class="px-gizmo-handle" data-tf-handle="ne"></div>
        <div class="px-gizmo-handle" data-tf-handle="e"></div>
        <div class="px-gizmo-handle" data-tf-handle="se"></div>
        <div class="px-gizmo-handle" data-tf-handle="s"></div>
        <div class="px-gizmo-handle" data-tf-handle="sw"></div>
        <div class="px-gizmo-handle" data-tf-handle="w"></div>
      </div>
    `;
    layer.classList.add('is-active');
    canvas.classList.add('has-gizmo');
  }

  function syncTransformInspectorWidgets(el, tf) {
    if (!el || !tf || state.selectedEl !== el) return;
    const fieldMap = {
      posX: formatTfVal(tf.posX, 1),
      posY: formatTfVal(tf.posY, 1),
      width: String(Math.max(1, Math.round(tf.width))),
      height: String(Math.max(1, Math.round(tf.height))),
      anchorMinX: formatTfVal(tf.anchorMin[0], 3),
      anchorMinY: formatTfVal(tf.anchorMin[1], 3),
      anchorMaxX: formatTfVal(tf.anchorMax[0], 3),
      anchorMaxY: formatTfVal(tf.anchorMax[1], 3),
      pivotX: formatTfVal(tf.pivot[0], 3),
      pivotY: formatTfVal(tf.pivot[1], 3),
      rotate: formatTfVal(tf.rotate || 0, 2),
    };
    const active = document.activeElement;
    Object.entries(fieldMap).forEach(([key, val]) => {
      const inp = document.querySelector(`[data-tf-input="${key}"]`);
      if (inp && inp !== active) {
        inp.value = val;
      }
    });

    const { hLabel, vLabel, preset } = getAnchorAxisLabels(tf.anchorMin, tf.anchorMax);
    const hNode = document.getElementById('wb-tf-label-h');
    const vNode = document.getElementById('wb-tf-label-v');
    const presetBtn = document.querySelector('[data-tf-preset-btn]');
    if (hNode) hNode.textContent = hLabel;
    if (vNode) vNode.textContent = vLabel;
    if (presetBtn) presetBtn.innerHTML = renderAnchorPresetSvg(tf.anchorMin, tf.anchorMax, 40);

    document.querySelectorAll('[data-tf-preset-pick]').forEach(tile => {
      tile.classList.toggle('is-active', Boolean(preset && tile.getAttribute('data-tf-preset-pick') === preset.id));
    });

    const lockBtn = document.querySelector('[data-tf-lock-aspect]');
    if (lockBtn) {
      lockBtn.classList.toggle('is-active', Boolean(tf.lockAspect));
      lockBtn.setAttribute('aria-pressed', tf.lockAspect ? 'true' : 'false');
    }

    updateInspectorGeometryReadout();
    renderTransformGizmo();
  }

  function renderTransformComponentCard(el) {
    const tf = getWidgetTransformState(el);
    if (!tf) return '';
    const { hLabel, vLabel, preset } = getAnchorAxisLabels(tf.anchorMin, tf.anchorMax);
    const isCollapsed = Boolean(state.transformCollapsed);
    const isPresetOpen = Boolean(state.anchorPresetOpen);
    const isMenuOpen = Boolean(state.transformMenuOpen);

    const presetsGridHtml = ANCHOR_PRESETS.map(p => {
      const isActive = preset && preset.id === p.id;
      return `
        <button
          type="button"
          class="wb-tf-preset-tile${isActive ? ' is-active' : ''}"
          data-tf-preset-pick="${p.id}"
          title="${p.vLabel}-${p.hLabel} (Click: keep position • Alt/Shift+Click: snap)"
          aria-label="${p.vLabel} ${p.hLabel} Anchor Preset"
        >
          ${renderAnchorPresetSvg(p.aMin, p.aMax, 34)}
        </button>
      `;
    }).join('');

    const linkIconSvg = `
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M6.5 9.5a3 3 0 0 0 4.2.3l1.8-1.8a3 3 0 0 0-4.2-4.2L7.2 4.8"/>
        <path d="M9.5 6.5a3 3 0 0 0-4.2-.3L3.5 8a3 3 0 0 0 4.2 4.2l1.1-1"/>
      </svg>
    `;
    const resetIconSvg = `
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 8a5 5 0 1 0 1.5-3.5L3 6"/>
        <path d="M3 2.8V6h3.2"/>
      </svg>
    `;

    return `
      <div class="wb-insp-card wb-transform-card">
        <div class="wb-tf-head">
          <button type="button" class="wb-tf-toggle" data-tf-toggle aria-expanded="${isCollapsed ? 'false' : 'true'}">
            <span class="wb-tf-caret">${isCollapsed ? '▸' : '▾'}</span>
            <span>Transform</span>
          </button>
          <div class="wb-tf-menu-wrap">
            <button type="button" class="wb-tf-dots-btn${isMenuOpen ? ' is-open' : ''}" data-tf-menu-toggle title="Transform Actions" aria-label="Transform Actions">⋯</button>
            <div class="wb-tf-menu-dropdown${isMenuOpen ? ' is-open' : ''}" id="wb-tf-menu-dropdown">
              <button type="button" class="wb-tf-menu-item" data-tf-menu-action="snap">Snap to Active Anchor</button>
              <button type="button" class="wb-tf-menu-item" data-tf-menu-action="reset">Reset Transform</button>
              <button type="button" class="wb-tf-menu-item" data-tf-menu-action="copy">Copy Transform JSON</button>
            </div>
          </div>
        </div>

        <div class="wb-tf-body${isCollapsed ? ' is-collapsed' : ''}">
          <div class="wb-tf-top">
            <div class="wb-tf-preset-wrap">
              <span id="wb-tf-label-h" class="wb-tf-label-h">${escapeHtml(hLabel)}</span>
              <span id="wb-tf-label-v" class="wb-tf-label-v">${escapeHtml(vLabel)}</span>
              <button
                type="button"
                class="wb-tf-preset-btn${isPresetOpen ? ' is-open' : ''}"
                data-tf-preset-btn
                title="Anchor Presets (${escapeHtml(vLabel)}-${escapeHtml(hLabel)})"
                aria-expanded="${isPresetOpen ? 'true' : 'false'}"
              >
                ${renderAnchorPresetSvg(tf.anchorMin, tf.anchorMax, 40)}
              </button>
              <div id="wb-tf-preset-popover" class="wb-tf-preset-popover${isPresetOpen ? ' is-open' : ''}" role="dialog" aria-label="Anchor Presets">
                <div class="wb-tf-preset-grid">${presetsGridHtml}</div>
                <div class="wb-tf-preset-hint">Click: set anchor • Alt/Shift+Click: snap</div>
              </div>
            </div>

            <div class="wb-tf-fields-grid">
              <div class="wb-tf-num-cell" data-tf-scrub="posX">
                <label for="wb-tf-posx">PosX</label>
                <div class="wb-tf-input-box">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="posX" title="Drag left/right on left border to adjust"></span>
                  <input id="wb-tf-posx" type="number" step="1" value="${escapeHtml(formatTfVal(tf.posX, 1))}" data-tf-input="posX">
                </div>
              </div>
              <div class="wb-tf-num-cell" data-tf-scrub="posY">
                <label for="wb-tf-posy">PosY</label>
                <div class="wb-tf-input-box">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="posY" title="Drag left/right on left border to adjust"></span>
                  <input id="wb-tf-posy" type="number" step="1" value="${escapeHtml(formatTfVal(tf.posY, 1))}" data-tf-input="posY">
                </div>
              </div>
              <span></span>
              <span></span>
              <div class="wb-tf-num-cell" data-tf-scrub="width">
                <label for="wb-tf-width">Width</label>
                <div class="wb-tf-input-box">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="width" title="Drag left/right on left border to adjust"></span>
                  <input id="wb-tf-width" type="number" min="1" step="1" value="${Math.max(1, Math.round(tf.width))}" data-tf-input="width">
                </div>
              </div>
              <div class="wb-tf-num-cell" data-tf-scrub="height">
                <label for="wb-tf-height">Height</label>
                <div class="wb-tf-input-box">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="height" title="Drag left/right on left border to adjust"></span>
                  <input id="wb-tf-height" type="number" min="1" step="1" value="${Math.max(1, Math.round(tf.height))}" data-tf-input="height">
                </div>
              </div>
              <button
                type="button"
                class="wb-tf-icon-btn${tf.lockAspect ? ' is-active' : ''}"
                data-tf-lock-aspect
                aria-pressed="${tf.lockAspect ? 'true' : 'false'}"
                title="Lock Width/Height Aspect Ratio"
                aria-label="Lock Aspect Ratio"
              >${linkIconSvg}</button>
              <button
                type="button"
                class="wb-tf-icon-btn"
                data-tf-reset
                title="Reset Transform"
                aria-label="Reset Transform"
              >${resetIconSvg}</button>
            </div>
          </div>

          <div class="wb-tf-vec-rows">
            <div class="wb-tf-vec-row">
              <span class="wb-tf-vec-label">AnchorMin</span>
              <div class="wb-tf-vec2">
                <label class="wb-tf-axis-field is-x" data-tf-scrub="anchorMinX">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="anchorMinX" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">X</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.anchorMin[0], 3))}" data-tf-input="anchorMinX" aria-label="AnchorMin X">
                </label>
                <label class="wb-tf-axis-field is-y" data-tf-scrub="anchorMinY">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="anchorMinY" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">Y</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.anchorMin[1], 3))}" data-tf-input="anchorMinY" aria-label="AnchorMin Y">
                </label>
              </div>
            </div>

            <div class="wb-tf-vec-row">
              <span class="wb-tf-vec-label">AnchorMax</span>
              <div class="wb-tf-vec2">
                <label class="wb-tf-axis-field is-x" data-tf-scrub="anchorMaxX">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="anchorMaxX" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">X</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.anchorMax[0], 3))}" data-tf-input="anchorMaxX" aria-label="AnchorMax X">
                </label>
                <label class="wb-tf-axis-field is-y" data-tf-scrub="anchorMaxY">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="anchorMaxY" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">Y</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.anchorMax[1], 3))}" data-tf-input="anchorMaxY" aria-label="AnchorMax Y">
                </label>
              </div>
            </div>

            <div class="wb-tf-vec-row">
              <span class="wb-tf-vec-label">Pivot</span>
              <div class="wb-tf-vec2">
                <label class="wb-tf-axis-field is-x" data-tf-scrub="pivotX">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="pivotX" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">X</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.pivot[0], 3))}" data-tf-input="pivotX" aria-label="Pivot X">
                </label>
                <label class="wb-tf-axis-field is-y" data-tf-scrub="pivotY">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="pivotY" title="Drag left/right on left border to adjust"></span>
                  <span class="wb-tf-axis-tag">Y</span>
                  <input type="number" step="0.05" value="${escapeHtml(formatTfVal(tf.pivot[1], 3))}" data-tf-input="pivotY" aria-label="Pivot Y">
                </label>
              </div>
            </div>

            <div class="wb-tf-vec-row" data-tf-scrub="rotate">
              <span class="wb-tf-vec-label">Rotate</span>
              <div class="wb-tf-rotate-wrap">
                <div class="wb-tf-input-box">
                  <span class="wb-tf-scrub-edge" data-tf-scrub-handle="rotate" title="Drag left/right on left border to adjust"></span>
                  <input type="number" step="1" class="wb-tf-rotate-input" value="${escapeHtml(formatTfVal(tf.rotate || 0, 2))}" data-tf-input="rotate" aria-label="Rotate">
                </div>
              </div>
            </div>
          </div>

          <div id="wb-tf-feedback" class="wb-insp-feedback"></div>
        </div>
      </div>
    `;
  }

  function resetWidgetEdits(el) {
    if (!el) return Promise.resolve({ ok: false });
    const edits = loadUiEdits();

    resetSingleElementSpriteAttrs(el, edits);
    const spriteTarget = getButtonSpriteTargetEl(el);
    if (spriteTarget && spriteTarget !== el) {
      resetSingleElementSpriteAttrs(spriteTarget, edits);
    }
    resetSingleElementTransform(el, edits);

    // Reset text edits on el or its targetEl
    const info = getEditableTextInfo(el);
    const textTarget = (info && info.targetEl) || el;
    const textPath = getElementCanvasPath(textTarget);
    if (textPath && edits.textEdits[textPath] !== undefined) {
      delete edits.textEdits[textPath];
    }
    if (state.originalWidgetText.has(textTarget)) {
      setTargetElementText(textTarget, state.originalWidgetText.get(textTarget));
    }

    saveUiEdits(edits);
    renderManifestTable();
    renderResourcesDockGrid();
    renderHierarchyTree();
    renderInspector();
    renderTransformGizmo();
    return persistUiEditsToDisk();
  }

  function applySavedUiEdits() {
    const edits = loadUiEdits();
    const spriteEntries = Object.entries(edits.spriteEdits || {});
    const textEntries = Object.entries(edits.textEdits || {});
    const transformEntries = Object.entries(edits.transformEdits || {});

    spriteEntries.forEach(([pathKey, attrMap]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || !attrMap || typeof attrMap !== 'object') return;
      Object.entries(attrMap).forEach(([attrName, sliceId]) => {
        if (sliceId === '' && (attrName === 'data-slice-hover' || attrName === 'data-slice-pressed')) {
          snapshotWidgetOriginals(el);
          el.removeAttribute(attrName);
        } else if (sliceId && resolveSliceUrl(sliceId)) {
          applySpriteAttrToElement(el, attrName, sliceId);
        }
      });
    });

    textEntries.forEach(([pathKey, txt]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || typeof txt !== 'string' || isPureSpritePrimitive(el)) return;
      setTargetElementText(el, txt);
    });

    transformEntries.forEach(([pathKey, savedTf]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || !savedTf || typeof savedTf !== 'object') return;
      const tf = {
        posX: Number.isFinite(Number(savedTf.posX)) ? Number(savedTf.posX) : 0,
        posY: Number.isFinite(Number(savedTf.posY)) ? Number(savedTf.posY) : 0,
        width: Math.max(1, Number.isFinite(Number(savedTf.width)) ? Number(savedTf.width) : 100),
        height: Math.max(1, Number.isFinite(Number(savedTf.height)) ? Number(savedTf.height) : 40),
        anchorMin: Array.isArray(savedTf.anchorMin) && savedTf.anchorMin.length === 2
          ? [Number(savedTf.anchorMin[0]) || 0, Number(savedTf.anchorMin[1]) || 0]
          : [0.5, 0.5],
        anchorMax: Array.isArray(savedTf.anchorMax) && savedTf.anchorMax.length === 2
          ? [Number(savedTf.anchorMax[0]) || 0, Number(savedTf.anchorMax[1]) || 0]
          : [0.5, 0.5],
        pivot: Array.isArray(savedTf.pivot) && savedTf.pivot.length === 2
          ? [Number(savedTf.pivot[0]), Number(savedTf.pivot[1])]
          : [0.5, 0.5],
        rotate: Number.isFinite(Number(savedTf.rotate)) ? Number(savedTf.rotate) : 0,
        lockAspect: Boolean(savedTf.lockAspect),
        aspectRatio: Number.isFinite(Number(savedTf.aspectRatio)) && Number(savedTf.aspectRatio) > 0
          ? Number(savedTf.aspectRatio)
          : 1,
        dirty: true,
      };
      if (!Number.isFinite(tf.pivot[0])) tf.pivot[0] = 0.5;
      if (!Number.isFinite(tf.pivot[1])) tf.pivot[1] = 0.5;
      applyWidgetTransformToDom(el, tf, { applyCss: true });
    });

    return spriteEntries.length + textEntries.length + transformEntries.length;
  }

  function parseSlice9Attr(raw) {
    if (!raw) return null;
    const parts = raw
      .split(',')
      .map(n => parseInt(n.trim(), 10))
      .filter(n => !Number.isNaN(n));
    return parts.length === 4 ? parts : null;
  }

  function resolveSliceUrl(sliceId) {
    const catalog = getCatalog();
    const rec = catalog.slices && catalog.slices[sliceId];
    if (!rec) return null;
    return {
      rec,
      url: resolveAssetUrl(rec.file),
    };
  }

  function resolveEffectiveSlice9(el, sliceId, rec) {
    const perEl = el ? state.elementSlice9Overrides.get(el) : null;
    if (Array.isArray(perEl) && perEl.length === 4) {
      return perEl;
    }

    const overrides = loadSlice9Overrides();
    if (sliceId && Array.isArray(overrides[sliceId]) && overrides[sliceId].length === 4) {
      return overrides[sliceId];
    }

    if (el) {
      if (el.dataset && el.dataset.htmlSlice9 === undefined) {
        el.dataset.htmlSlice9 = el.getAttribute('data-slice-9') || '';
      }
      const htmlAttr = (el.dataset && el.dataset.htmlSlice9) || el.getAttribute('data-slice-9');
      const parsed = parseSlice9Attr(htmlAttr);
      if (parsed) return parsed;
    }

    return rec && Array.isArray(rec.slice_9) && rec.slice_9.length === 4 ? rec.slice_9 : null;
  }

  function applySliceToElement(el, sliceId) {
    const resolved = resolveSliceUrl(sliceId);
    if (!resolved) {
      console.warn('[PixelUI] Unknown slice ID:', sliceId, el);
      return;
    }
    const { rec, url } = resolved;

    if (el.tagName === 'IMG') {
      el.src = url;
      if (!el.style.getPropertyValue('--w')) el.style.setProperty('--w', String(rec.width));
      if (!el.style.getPropertyValue('--h')) el.style.setProperty('--h', String(rec.height));
      return;
    }

    el.style.setProperty('--skin-url', `url("${url}")`);
    if (!el.style.getPropertyValue('--w')) el.style.setProperty('--w', String(rec.width));
    if (!el.style.getPropertyValue('--h')) el.style.setProperty('--h', String(rec.height));

    const sliceArr = resolveEffectiveSlice9(el, sliceId, rec);
    if (Array.isArray(sliceArr) && sliceArr.length === 4) {
      const [t, r, b, l] = sliceArr;
      el.style.setProperty('--slice-t', String(t));
      el.style.setProperty('--slice-r', String(r));
      el.style.setProperty('--slice-b', String(b));
      el.style.setProperty('--slice-l', String(l));
    }
  }

  function hydrateSprites(root = document) {
    const nodes = root.querySelectorAll('[data-slice-id]');
    nodes.forEach(el => {
      const id = el.getAttribute('data-slice-id');
      if (id) applySliceToElement(el, id);
    });

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      const cursorId = canvas.getAttribute('data-cursor-slice');
      if (cursorId) {
        const resolved = resolveSliceUrl(cursorId);
        if (resolved) {
          canvas.style.cursor = `url("${resolved.url}") 2 2, auto`;
        }
      }
      const hoverCursorId = canvas.getAttribute('data-cursor-hover-slice');
      if (hoverCursorId) {
        const resolved = resolveSliceUrl(hoverCursorId);
        if (resolved) {
          document.documentElement.style.setProperty('--px-hover-cursor', `url("${resolved.url}") 3 2, pointer`);
        }
      }
    }
  }

  function isWireframeMode() {
    return Boolean(document.body && document.body.classList.contains('mode-wireframe'));
  }

  function isEditMode() {
    return Boolean(document.body && document.body.classList.contains('mode-edit'));
  }

  function setRenderMode(mode) {
    const raw = String(mode || '').toLowerCase();
    const normalized = raw === 'wireframe' ? 'wireframe' : raw === 'edit' ? 'edit' : 'final';
    const isWireframe = normalized === 'wireframe';
    const isEdit = normalized === 'edit';
    state.currentMode = normalized;

    if (document.body) {
      document.body.classList.toggle('mode-wireframe', isWireframe);
      document.body.classList.toggle('mode-final', !isWireframe);
      document.body.classList.toggle('mode-edit', isEdit);
      document.body.classList.toggle('mode-interactive', !isWireframe && !isEdit);
    }

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.classList.toggle('is-wireframe', isWireframe);
      if (isWireframe || isEdit) {
        canvas.querySelectorAll('.is-hovered, .is-pressed').forEach(node => {
          node.classList.remove('is-hovered', 'is-pressed');
          if (node.hasAttribute('data-slice-id')) {
            syncButtonVisualState(node);
          }
        });
      }
    }

    document.querySelectorAll('[data-wb-mode]').forEach(btn => {
      const m = String(btn.getAttribute('data-wb-mode') || '').toLowerCase();
      const active = normalized === 'final' ? m === 'final' || m === 'interactive' : m === normalized;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const isClean = isCleanMode();
    if (!isClean) {
      setStudioPanels(isEdit);
      if (isEdit) {
        ensureTransformGizmoLayer();
        setBottomDock(true, 'resources');
        renderHierarchyTree();
        renderResourcesDockGrid();
        renderInspector();
      } else if (isWireframe) {
        state.anchorPresetOpen = false;
        state.transformMenuOpen = false;
        setBottomDock(true, 'behavior');
      } else {
        state.anchorPresetOpen = false;
        state.transformMenuOpen = false;
        setBottomDock(false);
      }
      renderTransformGizmo();
    }

    const hubLink = document.querySelector('[data-wb-hub-link]');
    if (hubLink) {
      hubLink.setAttribute('href', isWireframe ? '../index.html?thumb=wireframe' : '../index.html');
    }

    document.dispatchEvent(new CustomEvent('pixelui:modechange', { detail: { mode: normalized } }));
  }

  function setState(stateId) {
    const views = document.querySelectorAll('[data-ui-view]');
    if (!views.length) return;

    let matched = false;
    views.forEach(view => {
      const isMatch = view.getAttribute('data-ui-view') === stateId;
      view.classList.toggle('is-active', isMatch);
      view.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
      if (isMatch) {
        matched = true;
        state.collapsedViews.set(view, false);
      }
    });

    if (!matched && views[0]) {
      views[0].classList.add('is-active');
      views[0].setAttribute('aria-hidden', 'false');
      state.collapsedViews.set(views[0], false);
      stateId = views[0].getAttribute('data-ui-view');
    }

    document.querySelectorAll('[data-ui-state-trigger]').forEach(btn => {
      const target = btn.getAttribute('data-ui-state-trigger');
      const active = target === stateId;
      if (btn.classList.contains('wb-btn')) {
        btn.classList.toggle('is-active', active);
      }
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    flushPendingTransforms();
    renderHierarchyTree();
    renderTransformGizmo();
    document.dispatchEvent(new CustomEvent('pixelui:statechange', { detail: { state: stateId } }));
  }

  function setPixelScale(scale) {
    const numeric = Math.max(1, Math.min(5, parseInt(scale, 10) || 3));
    document.documentElement.style.setProperty('--pixel-scale', String(numeric));
    document.querySelectorAll('[data-wb-scale]').forEach(btn => {
      btn.classList.toggle('is-active', parseInt(btn.getAttribute('data-wb-scale'), 10) === numeric);
    });
    if (state.selectedEl || state.inspectorMode === 'resource') {
      renderInspector();
    }
    renderTransformGizmo();
  }

  function setScene(sceneName) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    canvas.classList.remove('scene-cozy-meadow', 'scene-dungeon', 'scene-night', 'scene-checker');
    canvas.classList.add(`scene-${sceneName}`);
    document.querySelectorAll('[data-wb-scene]').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-wb-scene') === sceneName);
    });
  }

  function getCanvasSliceUsageCounts() {
    const counts = new Map();
    const attrs = ['data-slice-id', 'data-slice-hover', 'data-slice-pressed', 'data-slice-on', 'data-slice-off'];
    document.querySelectorAll('#game-canvas *').forEach(el => {
      attrs.forEach(attr => {
        const val = el.getAttribute && el.getAttribute(attr);
        if (val) {
          counts.set(val, (counts.get(val) || 0) + 1);
        }
      });
    });
    return counts;
  }

  function getActive9SliceId() {
    if (state.inspectorMode === 'resource' && state.selectedResourceSliceId) {
      return state.selectedResourceSliceId;
    }
    if (state.selectedEl) {
      const spriteEl = isButtonComponent(state.selectedEl) ? getButtonSpriteTargetEl(state.selectedEl) : state.selectedEl;
      return spriteEl ? spriteEl.getAttribute(state.activeEditorSliceAttr || 'data-slice-id') : null;
    }
    return null;
  }

  function renderManifestTable() {
    const tbody = document.getElementById('wb-manifest-body');
    if (!tbody) return;
    const catalog = getCatalog();
    const seen = new Map();

    document.querySelectorAll('#game-canvas [data-slice-id], #game-canvas [data-slice-hover], #game-canvas [data-slice-pressed]').forEach(el => {
      const role = el.getAttribute('data-ui-role') || el.getAttribute('alt') || el.tagName.toLowerCase();
      ['data-slice-id', 'data-slice-hover', 'data-slice-pressed'].forEach(attr => {
        const id = el.getAttribute(attr);
        if (!id) return;
        const label = attr === 'data-slice-id' ? role : `${role} (${attr.replace('data-slice-', '')})`;
        if (!seen.has(id)) {
          seen.set(id, { id, roles: new Set([label]) });
        } else {
          seen.get(id).roles.add(label);
        }
      });
    });

    const overrides = loadSlice9Overrides();
    const rows = [];
    for (const [id, info] of seen.entries()) {
      const rec = catalog.slices && catalog.slices[id];
      const thumbUrl = rec ? resolveAssetUrl(rec.file) : '';
      const dims = rec ? `${rec.width}x${rec.height}` : '?';
      const src = rec ? rec.source_file : 'missing';
      const eff9 = overrides[id] || (rec && rec.slice_9);
      const slice9 = eff9 ? `[${eff9.join(', ')}]${overrides[id] ? ' *' : ''}` : '-';
      const isSelected = state.inspectorMode === 'resource' && state.selectedResourceSliceId === id;
      rows.push(
        `<tr class="manifest-row-clickable${isSelected ? ' is-selected' : ''}" data-res-pick="${escapeHtml(id)}" title="Click to edit 9-slice in Right tab">
          <td><img class="manifest-thumb" src="${thumbUrl}" alt=""></td>
          <td><code>${escapeHtml(id)}</code></td>
          <td>${escapeHtml(Array.from(info.roles).join(', '))}</td>
          <td>${escapeHtml(src)}</td>
          <td>${dims}</td>
          <td>${slice9}</td>
        </tr>`
      );
    }
    tbody.innerHTML = rows.join('');
  }

  function setBottomDock(open, tabName) {
    if (isCleanMode()) return;
    const dock = document.getElementById('wb-bottom-dock');
    if (!dock) return;

    const nextOpen = Boolean(open);
    state.resourceDock.open = nextOpen;
    if (tabName) {
      state.resourceDock.activeTab = tabName;
    }

    dock.classList.toggle('is-open', nextOpen);

    const activeTab = state.resourceDock.activeTab || 'resources';
    dock.querySelectorAll('[data-dock-tab]').forEach(btn => {
      const isMatch = btn.getAttribute('data-dock-tab') === activeTab;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });

    dock.querySelectorAll('.wb-dock-pane').forEach(pane => {
      pane.classList.toggle('is-active', pane.getAttribute('data-dock-pane') === activeTab);
    });

    const resToolbar = document.getElementById('wb-res-toolbar');
    if (resToolbar) {
      resToolbar.style.display = activeTab === 'resources' ? 'flex' : 'none';
    }

    const behaviorBtn = document.querySelector('[data-wb-behavior]');
    const manifestBtn = document.querySelector('[data-wb-manifest]');
    const resourcesBtn = document.querySelector('[data-wb-resources]');
    if (behaviorBtn) {
      const active = nextOpen && activeTab === 'behavior';
      behaviorBtn.classList.toggle('is-active', active);
      behaviorBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (manifestBtn) {
      const active = nextOpen && activeTab === 'manifest';
      manifestBtn.classList.toggle('is-active', active);
      manifestBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (resourcesBtn) {
      const active = nextOpen && activeTab === 'resources';
      resourcesBtn.classList.toggle('is-active', active);
      resourcesBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    if (nextOpen && activeTab === 'resources') {
      renderResourcesDockGrid();
    } else if (nextOpen && activeTab === 'manifest') {
      renderManifestTable();
    }
  }

  function syncResourceCardBadge(sliceId, slice9Arr, isOverride = true) {
    if (!sliceId) return;
    const grid = document.getElementById('wb-resources-grid');
    if (!grid) return;
    const card = grid.querySelector(`.wb-res-card[data-res-pick="${sliceId}"]`);
    if (!card) return;
    const badge = card.querySelector('[data-res-9s-badge]');
    if (badge) {
      badge.className = Array.isArray(slice9Arr) ? 'wb-res-9s-badge' : '';
      badge.textContent = Array.isArray(slice9Arr)
        ? `9s:[${slice9Arr.join(',')}]${isOverride ? '*' : ''}`
        : card.getAttribute('data-card-cat') || '';
    }
  }

  function renderResourcesDockGrid() {
    const grid = document.getElementById('wb-resources-grid');
    const countBadge = document.getElementById('wb-res-count-badge');
    if (!grid) return;

    const catalog = getCatalog();
    const allSlices = catalog && catalog.slices ? Object.values(catalog.slices) : [];
    const usageCounts = getCanvasSliceUsageCounts();
    const overrides = loadSlice9Overrides();
    const query = (state.resourceDock.search || '').trim().toLowerCase();
    const cat = state.resourceDock.category || 'all';
    const onlyUsed = Boolean(state.resourceDock.onlyUsed);

    const filtered = allSlices.filter(rec => {
      if (cat !== 'all' && rec.category !== cat) return false;
      if (onlyUsed && !usageCounts.has(rec.id)) return false;
      if (!query) return true;
      return (
        String(rec.id || '').toLowerCase().includes(query) ||
        String(rec.source_file || '').toLowerCase().includes(query) ||
        String(rec.category || '').toLowerCase().includes(query)
      );
    });

    if (countBadge) {
      countBadge.textContent =
        filtered.length === allSlices.length
          ? `${allSlices.length}`
          : `${filtered.length}/${allSlices.length}`;
    }

    if (!filtered.length) {
      grid.innerHTML = '<div class="wb-insp-empty" style="grid-column:1/-1;">No matching sprites in catalog.</div>';
      return;
    }

    grid.innerHTML = filtered
      .map(rec => {
        const url = resolveAssetUrl(rec.file);
        const isSelected = state.inspectorMode === 'resource' && state.selectedResourceSliceId === rec.id;

        return `
          <button
            type="button"
            class="wb-res-card${isSelected ? ' is-selected' : ''}"
            data-res-pick="${escapeHtml(rec.id)}"
            data-card-cat="${escapeHtml(rec.category)}"
            title="${escapeHtml(rec.id)} (${escapeHtml(rec.source_file)})"
          >
            <div class="wb-res-thumb">
              <img src="${escapeHtml(url)}" alt="${escapeHtml(rec.id)}" loading="lazy">
            </div>
            <div class="wb-res-id">${escapeHtml(rec.id)}</div>
          </button>
        `;
      })
      .join('');
  }

  function selectResourceSprite(sliceId, options = {}) {
    if (!sliceId) return false;
    const resolved = resolveSliceUrl(sliceId);
    if (!resolved) return false;

    if (state.selectedEl) {
      state.selectedEl.classList.remove('px-selected-element');
    }

    state.selectedResourceSliceId = sliceId;
    state.inspectorMode = 'resource';
    state.anchorPresetOpen = false;
    state.transformMenuOpen = false;

    if (!isEditMode() && !isCleanMode()) {
      setRenderMode('edit');
    } else if (!state.studioVisible && !isCleanMode()) {
      setStudioPanels(true);
    }

    document.querySelectorAll('#wb-resources-grid .wb-res-card').forEach(card => {
      card.classList.toggle('is-selected', card.getAttribute('data-res-pick') === sliceId);
    });
    document.querySelectorAll('#wb-manifest-body tr[data-res-pick]').forEach(row => {
      row.classList.toggle('is-selected', row.getAttribute('data-res-pick') === sliceId);
    });

    renderHierarchyTree();
    renderInspector();
    renderTransformGizmo();

    if (options.scrollIntoView) {
      const card = document.querySelector(`#wb-resources-grid .wb-res-card[data-res-pick="${sliceId}"]`);
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ block: 'nearest' });
      }
    }
    return true;
  }

  /* ========================================================================
     Studio 3-Panel Shell (Left Hierarchy Tree + Right Unity 9-Slice Editor)
     ======================================================================== */

  function isCleanMode() {
    return Boolean(document.body && document.body.classList.contains('clean-mode'));
  }

  function updateCanvasFitZoom() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    if (isCleanMode()) {
      canvas.style.zoom = '';
      return;
    }
    const workspace = document.querySelector('.workbench-workspace');
    if (!workspace) {
      canvas.style.zoom = '';
      return;
    }
    const reserve = state.studioVisible ? 264 + 356 + 24 : 0;
    const avail = Math.max(480, workspace.clientWidth - reserve);
    if (avail < 1280) {
      const z = Math.max(0.54, Math.min(1, avail / 1280));
      canvas.style.zoom = z.toFixed(3);
    } else {
      canvas.style.zoom = '';
    }
    renderTransformGizmo();
  }

  function setStudioPanels(visible) {
    state.studioVisible = Boolean(visible);
    if (document.body) {
      document.body.classList.toggle('hide-studio-panels', !state.studioVisible);
    }
    updateCanvasFitZoom();
  }

  function getCurrentPreviewSlug(catalog) {
    const parts = String((global.location && global.location.pathname) || '')
      .split('/')
      .filter(Boolean);
    const previews = catalog && Array.isArray(catalog.previews) ? catalog.previews : [];
    const slugSet = new Set(previews.map(p => p.slug));
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = decodeURIComponent(parts[i]);
      if (slugSet.has(seg)) return seg;
    }
    if (parts.length >= 2 && /\.html?$/i.test(parts[parts.length - 1])) {
      return decodeURIComponent(parts[parts.length - 2]);
    }
    return parts.length >= 1 ? decodeURIComponent(parts[parts.length - 1]) : '';
  }

  function populatePreviewSwitcher(catalog) {
    const select = document.getElementById('wb-ui-select');
    if (!select) return;
    const previews = catalog && Array.isArray(catalog.previews) ? catalog.previews : [];
    const currentSlug = getCurrentPreviewSlug(catalog);

    select.innerHTML = '';
    if (previews.length === 0) {
      const fallback = document.createElement('option');
      fallback.value = currentSlug;
      fallback.textContent = currentSlug || 'Current UI';
      fallback.selected = true;
      select.appendChild(fallback);
      return;
    }

    let matched = false;
    previews.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.slug;
      const status = p.verification && p.verification.status;
      const mark = status === 'PASSED' ? '✓ ' : status === 'FAILED' ? '✕ ' : '';
      opt.textContent = `${mark}${p.title} (${p.slug})`;
      if (p.slug === currentSlug) {
        opt.selected = true;
        matched = true;
      }
      select.appendChild(opt);
    });

    if (!matched && currentSlug) {
      const cur = document.createElement('option');
      cur.value = currentSlug;
      cur.textContent = currentSlug;
      cur.selected = true;
      select.insertBefore(cur, select.firstChild);
    }
  }

  function ensurePreviewsCatalogLoaded(callback) {
    if (global.UI_PREVIEWS_CATALOG && Array.isArray(global.UI_PREVIEWS_CATALOG.previews)) {
      callback(global.UI_PREVIEWS_CATALOG);
    } else if (!document.querySelector('script[data-previews-catalog="true"]')) {
      const script = document.createElement('script');
      script.src = getCatalogBase() + 'previews-data.js';
      script.async = true;
      script.setAttribute('data-previews-catalog', 'true');
      script.onload = () => {
        if (global.UI_PREVIEWS_CATALOG) callback(global.UI_PREVIEWS_CATALOG);
      };
      document.head.appendChild(script);
    }

    if (global.location && /^https?:$/i.test(global.location.protocol)) {
      fetch(new URL('/api/previews', global.location.origin).href, { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data && Array.isArray(data.previews)) {
            global.UI_PREVIEWS_CATALOG = data;
            callback(data);
          }
        })
        .catch(() => {
          // Static server without /api/previews; previews-data.js handles it
        });
    }
  }

  function ensurePreviewSwitcher() {
    if (isCleanMode()) return;
    const titleBar = document.querySelector('.workbench-bar .workbench-title');
    if (!titleBar) return;

    if (!titleBar.querySelector('[data-wb-hub-link]')) {
      const hubLink = document.createElement('a');
      hubLink.className = 'wb-btn wb-hub-link';
      hubLink.href = '../index.html';
      hubLink.setAttribute('data-wb-hub-link', 'true');
      hubLink.title = 'Back to Game UI Preview Hub';
      hubLink.textContent = '⊞ All UIs';
      titleBar.insertBefore(hubLink, titleBar.firstChild);
    }

    if (!document.getElementById('wb-ui-select')) {
      const wrap = document.createElement('div');
      wrap.className = 'wb-ui-switcher';
      wrap.innerHTML =
        '<label class="wb-label" for="wb-ui-select">UI</label>' +
        '<select id="wb-ui-select" class="wb-ui-select" aria-label="Switch UI Preview"></select>';
      titleBar.appendChild(wrap);

      const select = wrap.querySelector('#wb-ui-select');
      select.addEventListener('change', () => {
        const targetSlug = select.value;
        const currentSlug = getCurrentPreviewSlug(global.UI_PREVIEWS_CATALOG);
        if (!targetSlug || targetSlug === currentSlug) return;
        const targetMode = encodeURIComponent(state.currentMode || 'final');
        global.location.href = `../${encodeURIComponent(targetSlug)}/index.html?mode=${targetMode}`;
      });
    }

    ensurePreviewsCatalogLoaded(populatePreviewSwitcher);
  }

  function ensureSpritePickerModal() {
    if (isCleanMode() || document.getElementById('wb-sprite-picker-modal')) return;

    if (!document.getElementById('wb-catalog-slices-list')) {
      const datalist = document.createElement('datalist');
      datalist.id = 'wb-catalog-slices-list';
      const catalog = getCatalog();
      const ids = catalog && catalog.slices ? Object.keys(catalog.slices).sort() : [];
      datalist.innerHTML = ids.map(id => `<option value="${escapeHtml(id)}"></option>`).join('');
      document.body.appendChild(datalist);
    }

    const modal = document.createElement('div');
    modal.id = 'wb-sprite-picker-modal';
    modal.className = 'wb-modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Choose Widget Sprite');
    modal.innerHTML = `
      <div class="wb-sprite-picker-box">
        <div class="wb-sp-head">
          <div>
            <div id="wb-sp-title" class="wb-sp-title">Choose Sprite</div>
            <div id="wb-sp-subtitle" class="wb-insp-hint">Click any sprite below to assign it to the selected widget.</div>
          </div>
          <div class="slice9-actions-row">
            <label class="wb-check-row">
              <input type="checkbox" id="wb-sp-swap-all">
              <span>Swap on all matching widgets</span>
            </label>
            <button type="button" class="wb-btn wb-btn-sm" data-close-sprite-picker>Close</button>
          </div>
        </div>
        <div class="wb-sp-toolbar">
          <div class="wb-sp-cats" id="wb-sp-cats">
            <button type="button" class="wb-btn wb-btn-sm is-active" data-sp-cat="all">All</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="panel">Panel</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="button">Button</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="dialog">Dialog</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="icon">Icon</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="emote">Emote</button>
            <button type="button" class="wb-btn wb-btn-sm" data-sp-cat="cursor">Cursor</button>
          </div>
          <input id="wb-sp-search" class="wb-sp-search" type="search" placeholder="Filter slice ID or source PNG..." aria-label="Filter sprites">
        </div>
        <div id="wb-sp-grid" class="wb-sp-grid"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function renderSpritePickerGrid() {
    const grid = document.getElementById('wb-sp-grid');
    if (!grid) return;
    const catalog = getCatalog();
    const allSlices = catalog && catalog.slices ? Object.values(catalog.slices) : [];
    const query = (state.spritePicker.search || '').trim().toLowerCase();
    const cat = state.spritePicker.category || 'all';
    const pickerTarget =
      (state.spritePicker.targetEl && document.body.contains(state.spritePicker.targetEl) && state.spritePicker.targetEl) ||
      state.selectedEl;
    const currentId =
      pickerTarget && state.spritePicker.attrName
        ? pickerTarget.getAttribute(state.spritePicker.attrName)
        : '';

    const filtered = allSlices.filter(rec => {
      if (cat !== 'all' && rec.category !== cat) return false;
      if (!query) return true;
      return (
        String(rec.id || '').toLowerCase().includes(query) ||
        String(rec.source_file || '').toLowerCase().includes(query) ||
        String(rec.category || '').toLowerCase().includes(query)
      );
    });

    if (!filtered.length) {
      grid.innerHTML = '<div class="wb-insp-empty" style="grid-column:1/-1;">No matching sprites in catalog.</div>';
      return;
    }

    grid.innerHTML = filtered
      .map(rec => {
        const url = resolveAssetUrl(rec.file);
        const meta = Array.isArray(rec.slice_9) ? `9s:[${rec.slice_9.join(',')}]` : rec.category;
        const isCurrent = rec.id === currentId ? ' is-current' : '';
        return `
          <button type="button" class="wb-sp-card${isCurrent}" data-sp-pick="${escapeHtml(rec.id)}" title="${escapeHtml(rec.source_file)}">
            <div class="wb-sp-thumb">
              <img src="${escapeHtml(url)}" alt="${escapeHtml(rec.id)}" loading="lazy">
            </div>
            <div class="wb-sp-id">${escapeHtml(rec.id)}</div>
            <div class="wb-sp-meta">
              <span>${rec.width}×${rec.height}</span>
              <span>${escapeHtml(meta)}</span>
            </div>
          </button>
        `;
      })
      .join('');
  }

  function formatSliceAttrStateLabel(attrName) {
    if (attrName === 'data-slice-id') return 'Idle';
    if (attrName === 'data-slice-hover') return 'Hover';
    if (attrName === 'data-slice-pressed') return 'Pressed';
    if (attrName === 'data-slice-on') return 'On';
    if (attrName === 'data-slice-off') return 'Off';
    return attrName;
  }

  function openSpritePicker(attrName, targetEl) {
    ensureSpritePickerModal();
    const modal = document.getElementById('wb-sprite-picker-modal');
    if (!modal || !state.selectedEl) return;

    const effectiveTarget =
      targetEl ||
      (isButtonComponent(state.selectedEl) ? getButtonSpriteTargetEl(state.selectedEl) : null) ||
      state.selectedEl;
    state.spritePicker.attrName = attrName || state.activeEditorSliceAttr || 'data-slice-id';
    state.spritePicker.targetEl = effectiveTarget;

    const titleEl = document.getElementById('wb-sp-title');
    const subEl = document.getElementById('wb-sp-subtitle');
    const swapCb = document.getElementById('wb-sp-swap-all');
    if (titleEl) {
      titleEl.textContent = `Choose ${formatSliceAttrStateLabel(state.spritePicker.attrName)} Sprite for "${describeTreeLabel(state.selectedEl)}"`;
    }
    if (subEl) {
      const curVal = effectiveTarget ? effectiveTarget.getAttribute(state.spritePicker.attrName) || 'none' : 'none';
      subEl.textContent = `State: ${formatSliceAttrStateLabel(state.spritePicker.attrName)} (${state.spritePicker.attrName}) • current: ${curVal}`;
    }
    if (swapCb) {
      swapCb.checked = Boolean(state.swapAllSprites);
    }

    renderSpritePickerGrid();
    modal.classList.add('is-open');
    const searchEl = document.getElementById('wb-sp-search');
    if (searchEl) searchEl.focus();
  }

  function closeSpritePicker() {
    const modal = document.getElementById('wb-sprite-picker-modal');
    if (modal) modal.classList.remove('is-open');
  }

  function ensureStudioShell() {
    if (isCleanMode()) return;
    ensurePreviewSwitcher();
    ensureSpritePickerModal();
    const stage = document.querySelector('.workbench-stage');
    const canvas = document.getElementById('game-canvas');
    if (!stage || !canvas) return;

    // Ensure Mode toolbar has Wireframe | Edit UI | Interactive (no extra row of studio buttons)
    const modeBtn = document.querySelector('.workbench-controls [data-wb-mode]');
    const modeGroup = modeBtn && modeBtn.closest('.wb-group');
    if (modeGroup) {
      const finalBtn = modeGroup.querySelector('[data-wb-mode="final"]') || modeGroup.querySelector('[data-wb-mode="interactive"]');
      if (finalBtn && finalBtn.textContent.trim() === 'Final UI') {
        finalBtn.textContent = 'Interactive';
      }
      if (!modeGroup.querySelector('[data-wb-mode="edit"]') && finalBtn) {
        const editBtn = document.createElement('button');
        editBtn.className = 'wb-btn';
        editBtn.setAttribute('data-wb-mode', 'edit');
        editBtn.textContent = 'Edit UI';
        modeGroup.insertBefore(editBtn, finalBtn);
      }
    }

    if (!document.getElementById('wb-hierarchy-panel')) {
      const workspace = document.createElement('div');
      workspace.className = 'workbench-workspace';

      const leftSidebar = document.createElement('aside');
      leftSidebar.id = 'wb-hierarchy-panel';
      leftSidebar.className = 'wb-sidebar wb-sidebar--left';
      leftSidebar.setAttribute('aria-label', 'UI Hierarchy Tree');
      leftSidebar.innerHTML = `
        <div class="wb-sidebar-head">
          <span class="wb-sidebar-title">UI Hierarchy</span>
          <span class="wb-tree-tag">Edit Mode</span>
        </div>
        <div class="wb-sidebar-body">
          <div id="wb-hierarchy-tree" class="wb-tree-list"></div>
        </div>
      `;

      const canvasSlot = document.createElement('div');
      canvasSlot.className = 'workbench-canvas-slot';

      const rightSidebar = document.createElement('aside');
      rightSidebar.id = 'wb-inspector-panel';
      rightSidebar.className = 'wb-sidebar wb-sidebar--right';
      rightSidebar.setAttribute('aria-label', 'Sprite & 9-Slice Inspector');
      rightSidebar.innerHTML = `
        <div class="wb-sidebar-head">
          <span class="wb-sidebar-title">Inspector</span>
          <span id="wb-insp-badge" class="wb-tree-tag">None</span>
        </div>
        <div id="wb-inspector-body" class="wb-sidebar-body">
          <div class="wb-insp-empty">Select any sprite from the bottom Resources tab to edit its 9-slice, or click a UI widget on the canvas to edit its text &amp; sprite.</div>
        </div>
      `;

      canvas.parentNode.insertBefore(workspace, canvas);
      canvasSlot.appendChild(canvas);
      workspace.appendChild(leftSidebar);
      workspace.appendChild(canvasSlot);
      workspace.appendChild(rightSidebar);
    }

    document
      .querySelectorAll(
        '.workbench-controls [data-wb-scene], .workbench-controls [data-wb-behavior], .workbench-controls [data-wb-debug], .workbench-controls [data-wb-manifest], .workbench-controls [data-wb-resources]'
      )
      .forEach(btn => {
        const grp = btn.closest('.wb-group');
        btn.remove();
        if (grp && !grp.querySelector('button, select, input')) {
          grp.remove();
        }
      });

    if (!document.getElementById('wb-bottom-dock')) {
      const dock = document.createElement('section');
      dock.id = 'wb-bottom-dock';
      dock.className = 'wb-bottom-dock';
      dock.setAttribute('aria-label', 'Bottom Workbench Dock');
      dock.innerHTML = `
        <div class="wb-dock-head">
          <div class="wb-dock-tabs">
            <button type="button" class="wb-btn wb-btn-sm is-active" data-dock-tab="resources">
              Resources <span id="wb-res-count-badge" class="wb-tree-tag">0</span>
            </button>
            <button type="button" class="wb-btn wb-btn-sm" data-dock-tab="manifest">Sprites Used</button>
            <button type="button" class="wb-btn wb-btn-sm" data-dock-tab="behavior">Behavior Spec</button>
          </div>
          <div id="wb-res-toolbar" class="wb-dock-toolbar">
            <div class="wb-dock-cats" id="wb-res-cats">
              <button type="button" class="wb-btn wb-btn-sm is-active" data-res-cat="all">All</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="panel">Panel</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="button">Button</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="dialog">Dialog</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="icon">Icon</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="emote">Emote</button>
              <button type="button" class="wb-btn wb-btn-sm" data-res-cat="cursor">Cursor</button>
            </div>
            <label class="wb-check-row">
              <input type="checkbox" id="wb-res-only-used">
              <span>Used in UI</span>
            </label>
            <input id="wb-res-search" class="wb-dock-search" type="search" placeholder="Search sprite ID or source PNG..." aria-label="Search resource sprites">
          </div>
        </div>
        <div id="wb-dock-pane-resources" class="wb-dock-pane is-active" data-dock-pane="resources">
          <div id="wb-resources-grid" class="wb-res-grid"></div>
        </div>
        <div id="wb-dock-pane-manifest" class="wb-dock-pane" data-dock-pane="manifest"></div>
        <div id="wb-dock-pane-behavior" class="wb-dock-pane" data-dock-pane="behavior"></div>
      `;

      const ws = document.querySelector('.workbench-workspace');
      if (ws && ws.parentNode === stage) {
        ws.insertAdjacentElement('afterend', dock);
      } else {
        stage.appendChild(dock);
      }

      const manifestDrawer = document.getElementById('wb-manifest-drawer');
      const manifestPane = document.getElementById('wb-dock-pane-manifest');
      if (manifestDrawer && manifestPane) {
        manifestPane.appendChild(manifestDrawer);
      }

      const behaviorDrawer = document.getElementById('wb-behavior-drawer');
      const behaviorPane = document.getElementById('wb-dock-pane-behavior');
      if (behaviorDrawer && behaviorPane) {
        behaviorPane.appendChild(behaviorDrawer);
      }
    }

    global.addEventListener('resize', updateCanvasFitZoom);
    updateCanvasFitZoom();
  }

  function isTreeElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isInternalOverlayElement(el)) return false;
    if (
      el.matches(
        '[data-ui-view], .hud-base-layer, [data-slice-id], [data-ui-role], button, .px-9slice, .px-sprite-box, .px-icon, .px-wire-box, .px-row, .px-stack, .px-grid, h1, h2, h3, h4, p'
      )
    ) {
      return true;
    }
    return el.matches('span, strong, em, label, div') && getDirectText(el).length > 0;
  }

  function getDirectText(el) {
    let txt = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        txt += n.textContent || '';
      }
    }
    return txt.trim().replace(/\s+/g, ' ');
  }

  function describeTreeLabel(el) {
    if (el.hasAttribute('data-ui-view')) {
      return `View: ${el.getAttribute('data-ui-view')}`;
    }
    if (el.classList.contains('hud-base-layer')) {
      return 'Persistent HUD Layer';
    }
    const role =
      el.getAttribute('data-ui-role') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('alt') ||
      el.getAttribute('title');
    if (role) return role;

    const direct = getDirectText(el);
    if (direct) return direct.length > 24 ? direct.slice(0, 22) + '…' : direct;

    const firstCls = Array.from(el.classList).find(c => !c.startsWith('px-'));
    if (firstCls) return `.${firstCls}`;
    return el.tagName.toLowerCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHierarchyTree() {
    const container = document.getElementById('wb-hierarchy-tree');
    const canvas = document.getElementById('game-canvas');
    if (!container || !canvas) return;

    const items = [];
    function collect(node, depth, insideCollapsed) {
      for (const child of Array.from(node.children)) {
        if (!isTreeElement(child)) {
          collect(child, depth, insideCollapsed);
          continue;
        }
        const isView = child.hasAttribute('data-ui-view');
        if (isView && !state.collapsedViews.has(child)) {
          state.collapsedViews.set(child, !child.classList.contains('is-active'));
        }
        const isCollapsed = state.collapsedViews.get(child) === true;

        // Count inspected descendants to decide if expand arrow is needed
        let hasInspectedKids = false;
        (function probe(n) {
          for (const c of Array.from(n.children)) {
            if (isTreeElement(c)) {
              hasInspectedKids = true;
              return;
            }
            probe(c);
            if (hasInspectedKids) return;
          }
        })(child);

        items.push({
          el: child,
          depth,
          isView,
          isCollapsed,
          hasChildren: hasInspectedKids,
        });

        if (!isCollapsed) {
          collect(child, depth + 1, false);
        }
      }
    }

    collect(canvas, 0, false);
    state.hierarchyItems = items;

    const html = items
      .map((item, idx) => {
        const { el, depth, isView, isCollapsed, hasChildren } = item;
        const selected = state.inspectorMode === 'widget' && el === state.selectedEl;
        const sliceId = el.getAttribute('data-slice-id');
        const label = describeTreeLabel(el);
        const tag = el.classList.contains('px-9slice')
          ? '9s'
          : el.tagName === 'IMG'
            ? 'img'
            : el.tagName === 'BUTTON'
              ? 'btn'
              : sliceId
                ? 'spr'
                : isView
                  ? el.classList.contains('is-active')
                    ? 'active'
                    : 'hidden'
                  : el.tagName.toLowerCase();

        const arrow = hasChildren ? (isCollapsed ? '▸' : '▾') : '';
        const classes = [
          'wb-tree-node',
          selected ? 'is-selected' : '',
          isView ? 'is-view-root' : '',
          sliceId ? 'has-slice' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return `<div class="${classes}" data-tree-idx="${idx}" style="padding-left:${6 + depth * 12}px">
          <button type="button" class="wb-tree-toggle" data-tree-toggle="${idx}" aria-label="Toggle children">${arrow}</button>
          <span class="wb-tree-label" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <span class="wb-tree-tag">${escapeHtml(tag)}</span>
        </div>`;
      })
      .join('');

    container.innerHTML = html;
  }

  function findBorderOverlapChildren(el) {
    if (!el || !el.classList || !el.classList.contains('px-9slice') || isWireframeMode()) {
      return [];
    }
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const bT = parseFloat(style.borderTopWidth || '0');
    const bR = parseFloat(style.borderRightWidth || '0');
    const bB = parseFloat(style.borderBottomWidth || '0');
    const bL = parseFloat(style.borderLeftWidth || '0');
    const innerLeft = rect.left + bL;
    const innerTop = rect.top + bT;
    const innerRight = rect.right - bR;
    const innerBottom = rect.bottom - bB;

    const hits = [];
    for (const child of Array.from(el.children)) {
      if (isInternalOverlayElement(child)) continue;
      const cs = getComputedStyle(child);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (child.getAttribute('data-overflow-ok') === 'true' || child.getAttribute('data-border-overlap-ok') === 'true') {
        continue;
      }
      const cr = child.getBoundingClientRect();
      if (cr.width <= 0.5 || cr.height <= 0.5) continue;
      if (
        cr.left < innerLeft - 2 ||
        cr.top < innerTop - 2 ||
        cr.right > innerRight + 2 ||
        cr.bottom > innerBottom + 2
      ) {
        hits.push(describeTreeLabel(child));
      }
    }
    return hits;
  }

  function applyLiveSlice9(el, sliceId, arr, applyToAll) {
    const clamped = arr.map(v => Math.max(0, parseInt(v, 10) || 0));
    if ((applyToAll || state.inspectorMode === 'resource') && sliceId) {
      const overrides = loadSlice9Overrides();
      overrides[sliceId] = clamped;
      saveSlice9Overrides(overrides);

      document.querySelectorAll(`#game-canvas [data-slice-id="${sliceId}"]`).forEach(node => {
        state.elementSlice9Overrides.delete(node);
        applySliceToElement(node, sliceId);
      });
      syncResourceCardBadge(sliceId, clamped, true);
    } else if (el) {
      state.elementSlice9Overrides.set(el, clamped);
      if (sliceId) applySliceToElement(el, sliceId);
    }

    const activeTab = document.getElementById('wb-inspector-body');
    if (activeTab) {
      renderManifestTable();
    }
  }

  function updateInspectorGeometryReadout() {
    const el = state.selectedEl;
    if (!el || state.inspectorMode !== 'widget') return;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const sizeNode = document.getElementById('wb-insp-size');
    const innerNode = document.getElementById('wb-insp-inner');
    const warnNode = document.getElementById('wb-insp-border-warn');
    if (sizeNode) {
      sizeNode.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
    }
    if (innerNode) {
      const bT = parseFloat(cs.borderTopWidth || '0');
      const bR = parseFloat(cs.borderRightWidth || '0');
      const bB = parseFloat(cs.borderBottomWidth || '0');
      const bL = parseFloat(cs.borderLeftWidth || '0');
      const iw = Math.max(0, Math.round(rect.width - bL - bR));
      const ih = Math.max(0, Math.round(rect.height - bT - bB));
      innerNode.textContent = `${iw} × ${ih} px`;
    }
    if (warnNode) {
      const overlaps = findBorderOverlapChildren(el);
      if (overlaps.length > 0) {
        warnNode.style.display = 'block';
        warnNode.textContent = `Border overlap detected: ${overlaps.join(', ')} touches the 9-slice frame border.`;
      } else {
        warnNode.style.display = 'none';
      }
    }
  }

  function renderResourceInspector(body, badge) {
    const sliceId = state.selectedResourceSliceId;
    const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
    if (!sliceId || !resolved || !resolved.rec) {
      badge.textContent = 'None';
      body.innerHTML =
        '<div class="wb-insp-empty">Select any sprite from the bottom Resources tab to edit its 9-slice borders.</div>';
      return;
    }

    const rec = resolved.rec;
    badge.textContent = '9-Slice Resource';

    const usageCounts = getCanvasSliceUsageCounts();
    const usedCount = usageCounts.get(sliceId) || 0;
    const eff9 = resolveEffectiveSlice9(null, sliceId, rec) || [0, 0, 0, 0];
    const [sT, sR, sB, sL] = eff9;

    const maxStageW = 248;
    const maxStageH = 164;
    let stageScale = Math.floor(Math.min(maxStageW / rec.width, maxStageH / rec.height));
    let dispW;
    let dispH;
    if (stageScale >= 1) {
      dispW = rec.width * stageScale;
      dispH = rec.height * stageScale;
    } else {
      const fit = Math.min(maxStageW / rec.width, maxStageH / rec.height);
      stageScale = fit;
      dispW = Math.max(1, Math.round(rec.width * fit));
      dispH = Math.max(1, Math.round(rec.height * fit));
    }

    const hasTargetWidget = Boolean(state.selectedEl && document.body.contains(state.selectedEl));
    const targetIsBtn = hasTargetWidget && isButtonComponent(state.selectedEl);
    const assignBtnHtml = !hasTargetWidget
      ? ''
      : targetIsBtn
        ? `<div class="slice9-actions-row">
             <button type="button" class="wb-btn wb-btn-sm" data-assign-resource-to-widget="${escapeHtml(sliceId)}" data-assign-attr="data-slice-id">Assign Idle</button>
             <button type="button" class="wb-btn wb-btn-sm" data-assign-resource-to-widget="${escapeHtml(sliceId)}" data-assign-attr="data-slice-hover">Assign Hover</button>
             <button type="button" class="wb-btn wb-btn-sm" data-assign-resource-to-widget="${escapeHtml(sliceId)}" data-assign-attr="data-slice-pressed">Assign Pressed</button>
           </div>`
        : `<div class="slice9-actions-row">
             <button type="button" class="wb-btn wb-btn-sm" data-assign-resource-to-widget="${escapeHtml(sliceId)}">
               Assign to "${escapeHtml(describeTreeLabel(state.selectedEl))}"
             </button>
           </div>`;

    body.innerHTML = `
      <div class="wb-insp-card">
        <div class="wb-insp-section-title">Selected Sprite Resource</div>
        <div class="wb-insp-kv">
          <span class="wb-insp-k">Slice ID</span><span class="wb-insp-v">${escapeHtml(rec.id)}</span>
          <span class="wb-insp-k">Native Size</span><span class="wb-insp-v">${rec.width} × ${rec.height} px</span>
          <span class="wb-insp-k">Category</span><span class="wb-insp-v">${escapeHtml(rec.category)}</span>
          <span class="wb-insp-k">Source PNG</span><span class="wb-insp-v">${escapeHtml(rec.source_file)}</span>
          <span class="wb-insp-k">Canvas Usage</span><span class="wb-insp-v">${usedCount} widget${usedCount === 1 ? '' : 's'}</span>
        </div>
        ${assignBtnHtml}
        <div id="wb-res-feedback" class="wb-insp-feedback"></div>
      </div>

      <div class="wb-insp-card">
        <div class="wb-insp-section-title">Unity-Style 9-Slice Editor (${rec.width}×${rec.height})</div>
        <div class="slice9-editor-stage">
          <div
            id="slice9-canvas-wrap"
            class="slice9-canvas-wrap"
            data-slice-id="${escapeHtml(sliceId)}"
            data-native-w="${rec.width}"
            data-native-h="${rec.height}"
            data-zoom="${stageScale}"
            style="width:${dispW}px;height:${dispH}px;"
          >
            <img class="slice9-preview-img" src="${resolved.url}" alt="${escapeHtml(sliceId)}" draggable="false">
            <div class="slice9-line is-h" data-slice-edge="t" data-edge="T:${sT}" style="top:${Math.round(sT * stageScale)}px;"></div>
            <div class="slice9-line is-h" data-slice-edge="b" data-edge="B:${sB}" style="top:${Math.round((rec.height - sB) * stageScale)}px;"></div>
            <div class="slice9-line is-v" data-slice-edge="l" data-edge="L:${sL}" style="left:${Math.round(sL * stageScale)}px;"></div>
            <div class="slice9-line is-v" data-slice-edge="r" data-edge="R:${sR}" style="left:${Math.round((rec.width - sR) * stageScale)}px;"></div>
          </div>
        </div>

        <div class="slice9-inputs-grid">
          <div class="slice9-input-cell">
            <label for="s9-in-t">Top</label>
            <input id="s9-in-t" type="number" min="0" max="${Math.floor(rec.height / 2)}" value="${sT}" data-s9-input="t">
          </div>
          <div class="slice9-input-cell">
            <label for="s9-in-r">Right</label>
            <input id="s9-in-r" type="number" min="0" max="${Math.floor(rec.width / 2)}" value="${sR}" data-s9-input="r">
          </div>
          <div class="slice9-input-cell">
            <label for="s9-in-b">Bottom</label>
            <input id="s9-in-b" type="number" min="0" max="${Math.floor(rec.height / 2)}" value="${sB}" data-s9-input="b">
          </div>
          <div class="slice9-input-cell">
            <label for="s9-in-l">Left</label>
            <input id="s9-in-l" type="number" min="0" max="${Math.floor(rec.width / 2)}" value="${sL}" data-s9-input="l">
          </div>
        </div>

        <div class="wb-insp-section-title" style="margin-top:4px;">Live 9-Slice Stretch Preview</div>
        <div class="slice9-live-preview-stage">
          <div
            id="slice9-live-preview-box"
            class="px-9slice slice9-live-preview-box"
            style="--skin-url:url(&quot;${resolved.url}&quot;);--slice-t:${sT};--slice-r:${sR};--slice-b:${sB};--slice-l:${sL};"
          >
            <span id="slice9-live-preview-label">9-Slice Preview (${sT}, ${sR}, ${sB}, ${sL})</span>
          </div>
        </div>

        <div class="slice9-actions-row">
          <button type="button" class="wb-btn wb-btn-sm wb-btn--primary" data-s9-save>Save 9-Slice</button>
          <button type="button" class="wb-btn wb-btn-sm" data-s9-reset>Reset Default</button>
        </div>
        <div id="wb-s9-feedback" class="wb-insp-feedback"></div>
      </div>
    `;
  }

  function describeElementSelector(el) {
    if (!el) return '';
    const tagSel = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '');
    const clsList = Array.from(el.classList).filter(c => c !== 'px-selected-element' && c !== 'is-hovered' && c !== 'is-pressed').join('.');
    return clsList ? `${tagSel}.${clsList}` : tagSel;
  }

  function renderButtonComponentCard(el, spriteTargetEl, canAddOrEditText) {
    const target = spriteTargetEl || el;
    const idleId = target.getAttribute('data-slice-id') || '';
    const matchingCount = idleId ? findMatchingSpriteTargets(target, 'data-slice-id').length : 0;
    const targetInfoHtml =
      target !== el
        ? `<div class="wb-insp-hint">Sprite states target child <code>${escapeHtml(describeElementSelector(target))}</code></div>`
        : '';

    const rowsHtml = BUTTON_STATE_DEFS.map(stateDef => {
      const stId = target.getAttribute(stateDef.attr) || '';
      const stResolved = stId ? resolveSliceUrl(stId) : null;
      const stRec = stResolved ? stResolved.rec : null;
      return `
        <div class="wb-btn-state-row" data-btn-state="${stateDef.key}">
          <div class="wb-btn-state-head">
            <div class="wb-btn-state-thumb">
              ${stResolved ? `<img src="${escapeHtml(stResolved.url)}" alt="${escapeHtml(stId)}">` : '<span>—</span>'}
            </div>
            <div class="wb-btn-state-meta">
              <div class="wb-btn-state-title-line">
                <span class="wb-btn-state-badge is-${stateDef.key}">${stateDef.label}</span>
                <span class="wb-btn-state-dim">${stRec ? `${stRec.width}×${stRec.height}` : 'Unassigned'}</span>
              </div>
              <div class="wb-btn-state-file" title="${stRec ? escapeHtml(stRec.source_file) : ''}">
                ${stRec ? escapeHtml(stRec.source_file) : stateDef.optional ? 'Optional (falls back to Idle)' : 'Base resting button sprite'}
              </div>
            </div>
          </div>
          <div class="wb-slice-edit-row">
            <input
              class="wb-slice-input"
              type="text"
              list="wb-catalog-slices-list"
              value="${escapeHtml(stId)}"
              placeholder="${stateDef.optional ? 'Optional Slice ID...' : 'Slice ID...'}"
              data-btn-state-input="${stateDef.attr}"
              aria-label="${stateDef.label} Slice ID"
            >
            <button type="button" class="wb-btn wb-btn-sm" data-btn-state-apply="${stateDef.attr}">Apply</button>
          </div>
          <div class="slice9-actions-row">
            <button type="button" class="wb-btn wb-btn-sm wb-btn--primary" data-btn-state-browse="${stateDef.attr}">Browse…</button>
            ${
              stId && stRec
                ? `<button type="button" class="wb-btn wb-btn-sm" data-insp-edit-resource-s9="${escapeHtml(stId)}">Edit 9-Slice →</button>`
                : ''
            }
            ${
              stateDef.optional && stId
                ? `<button type="button" class="wb-btn wb-btn-sm wb-btn--warn" data-btn-state-clear="${stateDef.attr}">Clear</button>`
                : ''
            }
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="wb-insp-card">
        <div class="wb-insp-section-title">Button</div>
        ${targetInfoHtml}
        <div class="wb-btn-state-list">${rowsHtml}</div>
        <label class="wb-check-row">
          <input type="checkbox" id="wb-swap-all-sprites-cb" ${state.swapAllSprites ? 'checked' : ''}>
          <span>Swap on all ${matchingCount} matching button${matchingCount === 1 ? '' : 's'}</span>
        </label>
        ${!canAddOrEditText ? '<div class="slice9-actions-row"><button type="button" class="wb-btn wb-btn-sm wb-btn--warn" data-reset-widget-edits>Reset Widget</button></div>' : ''}
        <div id="wb-sprite-feedback" class="wb-insp-feedback"></div>
      </div>
    `;
  }

  function renderWidgetInspector(body, badge) {
    const el = state.selectedEl;
    if (!el || !document.body.contains(el)) {
      badge.textContent = 'None';
      body.innerHTML =
        '<div class="wb-insp-empty">Select any sprite from the bottom Resources tab to edit its 9-slice, or click a UI widget on the canvas to edit its text &amp; sprite.</div>';
      return;
    }

    const role = describeTreeLabel(el);
    const selectorText = describeElementSelector(el);
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pixelScale = getComputedStyle(document.documentElement).getPropertyValue('--pixel-scale').trim() || '3';

    const isBtnComp = isButtonComponent(el);
    const buttonSpriteTargetEl = isBtnComp ? getButtonSpriteTargetEl(el) : null;

    const sliceAttrs = ['data-slice-id', 'data-slice-pressed', 'data-slice-on', 'data-slice-off'].filter(a =>
      Boolean(el.getAttribute(a))
    );
    if (
      sliceAttrs.length === 0 &&
      (el.classList.contains('px-9slice') || el.classList.contains('px-sprite-box') || el.classList.contains('px-icon') || el.tagName === 'IMG')
    ) {
      sliceAttrs.push('data-slice-id');
    }
    if (!sliceAttrs.includes(state.activeEditorSliceAttr)) {
      state.activeEditorSliceAttr = sliceAttrs[0] || 'data-slice-id';
    }
    const activeSliceId = sliceAttrs.length > 0 ? el.getAttribute(state.activeEditorSliceAttr) : null;
    const resolved = activeSliceId ? resolveSliceUrl(activeSliceId) : null;
    const rec = resolved ? resolved.rec : null;

    const textInfo = getEditableTextInfo(el);
    const canAddOrEditText = Boolean(textInfo);
    const currentTextValue = textInfo ? textInfo.currentText : '';

    badge.textContent = isBtnComp
      ? 'Button Widget'
      : activeSliceId
        ? el.classList.contains('px-9slice')
          ? '9-Slice Widget'
          : 'Sprite Widget'
        : canAddOrEditText
          ? 'Text Widget'
          : 'Layout Widget';

    const is9SliceEl = el.classList.contains('px-9slice');
    const bT = parseFloat(cs.borderTopWidth || '0');
    const bR = parseFloat(cs.borderRightWidth || '0');
    const bB = parseFloat(cs.borderBottomWidth || '0');
    const bL = parseFloat(cs.borderLeftWidth || '0');
    const innerW = Math.max(0, Math.round(rect.width - bL - bR));
    const innerH = Math.max(0, Math.round(rect.height - bT - bB));
    const overlaps = findBorderOverlapChildren(el);
    const targetView = el.getAttribute('data-ui-state-trigger');
    const gotoBtnHtml = targetView
      ? `<div style="margin-top:6px;"><button type="button" class="wb-btn wb-btn-sm" data-insp-goto-view="${escapeHtml(targetView)}">Open View: ${escapeHtml(targetView)} →</button></div>`
      : '';

    const childIconEl = el.tagName !== 'IMG' ? el.querySelector('[data-slice-id]') : null;
    const childIconId = childIconEl ? childIconEl.getAttribute('data-slice-id') : null;
    const childIconBtnHtml =
      childIconEl && childIconId && (!isBtnComp || childIconEl !== buttonSpriteTargetEl)
        ? `<button type="button" class="wb-btn wb-btn-sm" data-insp-select-child-icon>Select Child Icon (${escapeHtml(childIconId)})</button>`
        : '';

    let html = `
      <div class="wb-insp-card">
        <div class="wb-insp-section-title">Selected Element</div>
        <div class="wb-insp-kv">
          <span class="wb-insp-k">Role</span><span class="wb-insp-v">${escapeHtml(role)}</span>
          <span class="wb-insp-k">Node</span><span class="wb-insp-v">${escapeHtml(selectorText)}</span>
          <span class="wb-insp-k">Rendered</span><span id="wb-insp-size" class="wb-insp-v">${Math.round(rect.width)} × ${Math.round(rect.height)} px</span>
          ${is9SliceEl ? `<span class="wb-insp-k">Safe Interior</span><span id="wb-insp-inner" class="wb-insp-v">${innerW} × ${innerH} px</span>` : ''}
          <span class="wb-insp-k">Pixel Scale</span><span class="wb-insp-v">${escapeHtml(pixelScale)}x</span>
        </div>
        ${gotoBtnHtml}
        ${childIconBtnHtml ? `<div style="margin-top:4px;">${childIconBtnHtml}</div>` : ''}
        <div id="wb-insp-border-warn" class="wb-insp-warn" style="display:${overlaps.length > 0 ? 'block' : 'none'};">
          ${overlaps.length > 0 ? `Border overlap detected: ${escapeHtml(overlaps.join(', '))} touches the 9-slice frame border.` : ''}
        </div>
      </div>
    `;

    html += renderTransformComponentCard(el);

    if (canAddOrEditText) {
      html += `
        <div class="wb-insp-card">
          <div class="wb-insp-section-title">Text</div>
          <textarea id="wb-insp-text-input" class="wb-text-input" rows="2" placeholder="Enter widget text...">${escapeHtml(currentTextValue)}</textarea>
          <div class="wb-insp-hint">Tip: You can also double-click text on the canvas in Edit UI mode.</div>
          <div class="slice9-actions-row">
            <button type="button" class="wb-btn wb-btn-sm wb-btn--primary" data-ui-edits-save>Save Text &amp; Sprites</button>
            <button type="button" class="wb-btn wb-btn-sm wb-btn--warn" data-reset-widget-edits>Reset Widget</button>
          </div>
          <div id="wb-text-feedback" class="wb-insp-feedback"></div>
        </div>
      `;
    }

    if (isBtnComp) {
      html += renderButtonComponentCard(el, buttonSpriteTargetEl, canAddOrEditText);
    } else if (sliceAttrs.length > 0) {
      const sameSliceCount = activeSliceId ? findMatchingSpriteTargets(el, state.activeEditorSliceAttr).length : 0;
      const attrTabsHtml =
        sliceAttrs.length > 1
          ? `<div class="slice9-actions-row">${sliceAttrs
              .map(
                attr =>
                  `<button type="button" class="wb-btn wb-btn-sm ${attr === state.activeEditorSliceAttr ? 'is-active' : ''}" data-insp-slice-attr="${attr}">${attr.replace('data-slice-', '')}</button>`
              )
              .join('')}</div>`
          : '';

      html += `
        <div class="wb-insp-card">
          <div class="wb-insp-section-title">Sprite</div>
          ${attrTabsHtml}
          <div class="wb-slice-edit-row">
            <input id="wb-insp-slice-input" class="wb-slice-input" type="text" list="wb-catalog-slices-list" value="${escapeHtml(activeSliceId || '')}" placeholder="Slice ID...">
            <button type="button" class="wb-btn wb-btn-sm" data-insp-apply-slice>Apply</button>
          </div>
          <div class="slice9-actions-row">
            <button type="button" class="wb-btn wb-btn-sm wb-btn--primary" data-open-sprite-picker>Browse Sprites…</button>
            ${
              activeSliceId && rec
                ? `<button type="button" class="wb-btn wb-btn-sm" data-insp-edit-resource-s9="${escapeHtml(activeSliceId)}">Edit 9-Slice →</button>`
                : ''
            }
            ${!canAddOrEditText ? '<button type="button" class="wb-btn wb-btn-sm wb-btn--warn" data-reset-widget-edits>Reset Widget</button>' : ''}
          </div>
          <label class="wb-check-row">
            <input type="checkbox" id="wb-swap-all-sprites-cb" ${state.swapAllSprites ? 'checked' : ''}>
            <span>Swap on all ${sameSliceCount} matching widget${sameSliceCount === 1 ? '' : 's'}</span>
          </label>
          ${
            rec
              ? `<div class="wb-insp-kv">
                  <span class="wb-insp-k">Native Size</span><span class="wb-insp-v">${rec.width} × ${rec.height} px</span>
                  <span class="wb-insp-k">Category</span><span class="wb-insp-v">${escapeHtml(rec.category)}</span>
                  <span class="wb-insp-k">Source PNG</span><span class="wb-insp-v">${escapeHtml(rec.source_file)}</span>
                </div>`
              : '<div class="wb-insp-hint">No sprite currently assigned. Click Browse Sprites… to pick one.</div>'
          }
          <div id="wb-sprite-feedback" class="wb-insp-feedback"></div>
        </div>
      `;
    }

    body.innerHTML = html;
  }

  function renderInspector() {
    const body = document.getElementById('wb-inspector-body');
    const badge = document.getElementById('wb-insp-badge');
    if (!body || !badge) return;

    if (state.inspectorMode === 'resource' && state.selectedResourceSliceId) {
      renderResourceInspector(body, badge);
      return;
    }

    renderWidgetInspector(body, badge);
  }

  function syncSlice9EditorWidgets(slice9Arr, rec) {
    const wrap = document.getElementById('slice9-canvas-wrap');
    if (!wrap || !rec) return;
    const zoom = parseFloat(wrap.getAttribute('data-zoom') || '1');
    const [t, r, b, l] = slice9Arr;

    const lineT = wrap.querySelector('[data-slice-edge="t"]');
    const lineB = wrap.querySelector('[data-slice-edge="b"]');
    const lineL = wrap.querySelector('[data-slice-edge="l"]');
    const lineR = wrap.querySelector('[data-slice-edge="r"]');

    if (lineT) {
      lineT.style.top = `${Math.round(t * zoom)}px`;
      lineT.setAttribute('data-edge', `T:${t}`);
    }
    if (lineB) {
      lineB.style.top = `${Math.round((rec.height - b) * zoom)}px`;
      lineB.setAttribute('data-edge', `B:${b}`);
    }
    if (lineL) {
      lineL.style.left = `${Math.round(l * zoom)}px`;
      lineL.setAttribute('data-edge', `L:${l}`);
    }
    if (lineR) {
      lineR.style.left = `${Math.round((rec.width - r) * zoom)}px`;
      lineR.setAttribute('data-edge', `R:${r}`);
    }

    const inT = document.getElementById('s9-in-t');
    const inR = document.getElementById('s9-in-r');
    const inB = document.getElementById('s9-in-b');
    const inL = document.getElementById('s9-in-l');
    if (inT) inT.value = String(t);
    if (inR) inR.value = String(r);
    if (inB) inB.value = String(b);
    if (inL) inL.value = String(l);

    const previewBox = document.getElementById('slice9-live-preview-box');
    if (previewBox) {
      previewBox.style.setProperty('--slice-t', String(t));
      previewBox.style.setProperty('--slice-r', String(r));
      previewBox.style.setProperty('--slice-b', String(b));
      previewBox.style.setProperty('--slice-l', String(l));
      const previewLabel = document.getElementById('slice9-live-preview-label');
      if (previewLabel) {
        previewLabel.textContent = `9-Slice Preview (${t}, ${r}, ${b}, ${l})`;
      }
    }

    updateInspectorGeometryReadout();
  }

  function selectElement(el) {
    if (!el || !document.body.contains(el)) return;

    if (state.selectedEl && state.selectedEl !== el) {
      state.selectedEl.classList.remove('px-selected-element');
      state.anchorPresetOpen = false;
      state.transformMenuOpen = false;
    }

    state.selectedEl = el;
    state.inspectorMode = 'widget';
    el.classList.add('px-selected-element');

    document.querySelectorAll('#wb-resources-grid .wb-res-card.is-selected').forEach(card => {
      card.classList.remove('is-selected');
    });
    document.querySelectorAll('#wb-manifest-body tr.is-selected').forEach(row => {
      row.classList.remove('is-selected');
    });

    // If inside an inactive view, activate that view so user can see the element
    const viewAncestor = el.closest('[data-ui-view]');
    if (viewAncestor && !viewAncestor.classList.contains('is-active')) {
      setState(viewAncestor.getAttribute('data-ui-view'));
    }

    renderHierarchyTree();
    renderInspector();
    renderTransformGizmo();

    const selectedRow = document.querySelector('#wb-hierarchy-tree .wb-tree-node.is-selected');
    if (selectedRow && typeof selectedRow.scrollIntoView === 'function') {
      selectedRow.scrollIntoView({ block: 'nearest' });
    }
  }

  function wireStudioInteractions() {
    if (isCleanMode()) return;

    const canvas = document.getElementById('game-canvas');
    function pickStudioElement(target) {
      if (
        !target ||
        typeof target.closest !== 'function' ||
        !canvas ||
        !canvas.contains(target) ||
        target.closest('#__verify_annotations__, #__px_transform_gizmo__')
      ) {
        return null;
      }
      const btn = target.closest('button');
      if (btn && canvas.contains(btn)) {
        const btnSpriteEl = !btn.hasAttribute('data-ui-toggle') ? getButtonSpriteTargetEl(btn) : null;
        if (btnSpriteEl && btnSpriteEl !== btn && (target === btnSpriteEl || btnSpriteEl.contains(target))) {
          return btn;
        }
        if (target.tagName === 'IMG' || target.hasAttribute('data-slice-id')) {
          return target;
        }
        return btn;
      }
      if (getDirectText(target).length > 0) {
        return target;
      }
      const pickable = target.closest(
        '[data-slice-id], [data-ui-role], button, a, .px-9slice, .px-sprite-box, .px-icon, .px-wire-box, h1, h2, h3, h4, p'
      );
      return pickable && canvas.contains(pickable) ? pickable : null;
    }

    function readInlineEditableText(targetEl) {
      if (targetEl.children.length === 0) {
        return targetEl.textContent.replace(/\s+/g, ' ').trim();
      }
      const txtNode = getDirectTextNode(targetEl);
      if (txtNode) return txtNode.textContent.replace(/\s+/g, ' ').trim();
      return Array.from(targetEl.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function startInlineTextEdit(ownerEl) {
      const info = getEditableTextInfo(ownerEl);
      const targetEl = info && info.targetEl ? info.targetEl : null;
      if (!targetEl || !canvas || !canvas.contains(targetEl)) return;

      if (state.inlineEdit) {
        if (state.inlineEdit.targetEl === targetEl) return;
        state.inlineEdit.finish(true);
      }

      const prevText = info ? info.currentText : readInlineEditableText(targetEl);
      const nonEditableChildren = [];
      Array.from(targetEl.children).forEach(child => {
        nonEditableChildren.push({ el: child, prev: child.getAttribute('contenteditable') });
        child.setAttribute('contenteditable', 'false');
      });

      targetEl.setAttribute('contenteditable', 'plaintext-only');
      if (targetEl.contentEditable !== 'plaintext-only' && !targetEl.isContentEditable) {
        targetEl.setAttribute('contenteditable', 'true');
      }
      targetEl.classList.add('px-inline-editing');

      const finish = commit => {
        if (!state.inlineEdit || state.inlineEdit.targetEl !== targetEl) return;
        state.inlineEdit = null;
        targetEl.removeEventListener('input', onInlineInput);
        targetEl.removeEventListener('keydown', onInlineKeyDown);
        targetEl.removeEventListener('blur', onInlineBlur);
        targetEl.removeAttribute('contenteditable');
        targetEl.classList.remove('px-inline-editing');
        nonEditableChildren.forEach(item => {
          if (item.prev === null) item.el.removeAttribute('contenteditable');
          else item.el.setAttribute('contenteditable', item.prev);
        });

        const nextText = commit ? readInlineEditableText(targetEl) : prevText;
        if (!commit) {
          setTargetElementText(targetEl, prevText);
        }
        const inspInput = document.getElementById('wb-insp-text-input');
        if (inspInput) inspInput.value = nextText;

        const saveResultPromise = applyWidgetTextEdit(ownerEl, nextText, Boolean(commit));
        if (commit && saveResultPromise && typeof saveResultPromise.then === 'function') {
          saveResultPromise.then(result => {
            const fb = document.getElementById('wb-text-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Inline edit saved permanently to ui-edits.js!'
                  : '✓ Inline edit saved in browser storage';
            }
          });
        }
      };

      const onInlineInput = () => {
        const liveText = readInlineEditableText(targetEl);
        const inspInput = document.getElementById('wb-insp-text-input');
        if (inspInput) inspInput.value = liveText;
      };

      const onInlineKeyDown = evt => {
        if (evt.key === 'Enter' && !evt.shiftKey) {
          evt.preventDefault();
          evt.stopPropagation();
          finish(true);
        } else if (evt.key === 'Escape') {
          evt.preventDefault();
          evt.stopPropagation();
          finish(false);
        }
      };

      const onInlineBlur = () => {
        finish(true);
      };

      state.inlineEdit = { ownerEl, targetEl, prevText, finish };
      targetEl.addEventListener('input', onInlineInput);
      targetEl.addEventListener('keydown', onInlineKeyDown);
      targetEl.addEventListener('blur', onInlineBlur);
      targetEl.focus();

      try {
        const sel = global.getSelection && global.getSelection();
        if (sel) {
          const range = document.createRange();
          const txtNode = getDirectTextNode(targetEl);
          if (txtNode) range.selectNodeContents(txtNode);
          else range.selectNodeContents(targetEl);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {
        // Ignore selection errors
      }
    }

    let tfDrag = null;
    let tfScrub = null;
    let suppressNextScrubClick = false;
    let suppressNextCanvasClick = false;

    if (canvas) {
      canvas.addEventListener(
        'click',
        evt => {
          if (suppressNextCanvasClick) {
            suppressNextCanvasClick = false;
            evt.preventDefault();
            evt.stopPropagation();
            evt.stopImmediatePropagation();
            return;
          }
          if (!isEditMode() && !evt.shiftKey) return;
          const target = evt.target;
          if (!target || typeof target.closest !== 'function') return;
          if (state.inlineEdit && (target === state.inlineEdit.targetEl || state.inlineEdit.targetEl.contains(target))) {
            return;
          }
          const pickable = pickStudioElement(target);
          if (!pickable) return;

          if (!isEditMode() && evt.shiftKey) {
            setRenderMode('edit');
          }
          evt.preventDefault();
          evt.stopPropagation();
          evt.stopImmediatePropagation();
          selectElement(pickable);
        },
        true
      );

      canvas.addEventListener(
        'dblclick',
        evt => {
          if (!isEditMode()) return;
          const target = evt.target;
          if (!target || typeof target.closest !== 'function') return;
          if (state.inlineEdit && (target === state.inlineEdit.targetEl || state.inlineEdit.targetEl.contains(target))) {
            return;
          }
          const pickable = pickStudioElement(target);
          if (!pickable) return;
          evt.preventDefault();
          evt.stopPropagation();
          evt.stopImmediatePropagation();
          selectElement(pickable);
          startInlineTextEdit(pickable);
        },
        true
      );
    }

    function closeTransformPopovers() {
      if (state.anchorPresetOpen) {
        state.anchorPresetOpen = false;
        const pop = document.getElementById('wb-tf-preset-popover');
        const btn = document.querySelector('[data-tf-preset-btn]');
        if (pop) pop.classList.remove('is-open');
        if (btn) btn.classList.remove('is-open');
      }
      if (state.transformMenuOpen) {
        state.transformMenuOpen = false;
        const menu = document.getElementById('wb-tf-menu-dropdown');
        const dots = document.querySelector('[data-tf-menu-toggle]');
        if (menu) menu.classList.remove('is-open');
        if (dots) dots.classList.remove('is-open');
      }
    }

    // Left hierarchy tree clicks & inspector actions
    document.addEventListener('click', evt => {
      if (suppressNextScrubClick) {
        suppressNextScrubClick = false;
        if (evt.target && evt.target.closest && evt.target.closest('[data-tf-scrub]')) {
          evt.preventDefault();
          evt.stopPropagation();
          if (document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-tf-scrub]')) {
            document.activeElement.blur();
          }
          return;
        }
      }

      if (
        (state.anchorPresetOpen || state.transformMenuOpen) &&
        !evt.target.closest('#wb-tf-preset-popover, [data-tf-preset-btn], #wb-tf-menu-dropdown, [data-tf-menu-toggle]')
      ) {
        closeTransformPopovers();
      }

      const tfToggleBtn = evt.target.closest('[data-tf-toggle]');
      if (tfToggleBtn) {
        state.transformCollapsed = !state.transformCollapsed;
        tfToggleBtn.setAttribute('aria-expanded', state.transformCollapsed ? 'false' : 'true');
        const caret = tfToggleBtn.querySelector('.wb-tf-caret');
        if (caret) caret.textContent = state.transformCollapsed ? '▸' : '▾';
        const bodyEl = tfToggleBtn.closest('.wb-transform-card')?.querySelector('.wb-tf-body');
        if (bodyEl) bodyEl.classList.toggle('is-collapsed', state.transformCollapsed);
        if (state.transformCollapsed) closeTransformPopovers();
        return;
      }

      const tfMenuBtn = evt.target.closest('[data-tf-menu-toggle]');
      if (tfMenuBtn) {
        evt.stopPropagation();
        if (state.anchorPresetOpen) {
          state.anchorPresetOpen = false;
          document.getElementById('wb-tf-preset-popover')?.classList.remove('is-open');
          document.querySelector('[data-tf-preset-btn]')?.classList.remove('is-open');
        }
        state.transformMenuOpen = !state.transformMenuOpen;
        tfMenuBtn.classList.toggle('is-open', state.transformMenuOpen);
        document.getElementById('wb-tf-menu-dropdown')?.classList.toggle('is-open', state.transformMenuOpen);
        return;
      }

      const tfMenuActionBtn = evt.target.closest('[data-tf-menu-action]');
      if (tfMenuActionBtn && state.selectedEl) {
        const action = tfMenuActionBtn.getAttribute('data-tf-menu-action');
        closeTransformPopovers();
        const tf = getWidgetTransformState(state.selectedEl);
        if (action === 'snap') {
          snapWidgetTransformToAnchor(state.selectedEl, tf, tf.anchorMin, tf.anchorMax);
          syncTransformInspectorWidgets(state.selectedEl, tf);
          saveWidgetTransformEdit(state.selectedEl, tf, true).then(result => {
            const fb = document.getElementById('wb-tf-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Snapped & saved to ui-edits.js!'
                  : '✓ Snapped & saved in browser storage';
            }
          });
        } else if (action === 'reset') {
          const edits = loadUiEdits();
          resetSingleElementTransform(state.selectedEl, edits);
          saveUiEdits(edits);
          renderInspector();
          renderTransformGizmo();
          persistUiEditsToDisk().then(result => {
            const fb = document.getElementById('wb-tf-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Transform reset & saved to ui-edits.js!'
                  : '✓ Transform reset in browser storage';
            }
          });
        } else if (action === 'copy') {
          const payload = JSON.stringify(
            {
              posX: roundTfNum(tf.posX, 2),
              posY: roundTfNum(tf.posY, 2),
              width: Math.max(1, Math.round(tf.width)),
              height: Math.max(1, Math.round(tf.height)),
              anchorMin: tf.anchorMin,
              anchorMax: tf.anchorMax,
              pivot: tf.pivot,
              rotate: roundTfNum(tf.rotate || 0, 2),
            },
            null,
            2
          );
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(payload).catch(() => {});
          }
          const fb = document.getElementById('wb-tf-feedback');
          if (fb) fb.textContent = '✓ Transform JSON copied!';
        }
        return;
      }

      const tfPresetBtn = evt.target.closest('[data-tf-preset-btn]');
      if (tfPresetBtn) {
        evt.stopPropagation();
        if (state.transformMenuOpen) {
          state.transformMenuOpen = false;
          document.getElementById('wb-tf-menu-dropdown')?.classList.remove('is-open');
          document.querySelector('[data-tf-menu-toggle]')?.classList.remove('is-open');
        }
        state.anchorPresetOpen = !state.anchorPresetOpen;
        tfPresetBtn.classList.toggle('is-open', state.anchorPresetOpen);
        document.getElementById('wb-tf-preset-popover')?.classList.toggle('is-open', state.anchorPresetOpen);
        return;
      }

      const tfPresetTile = evt.target.closest('[data-tf-preset-pick]');
      if (tfPresetTile && state.selectedEl) {
        const presetId = tfPresetTile.getAttribute('data-tf-preset-pick');
        const preset = ANCHOR_PRESETS.find(p => p.id === presetId);
        if (preset) {
          const tf = getWidgetTransformState(state.selectedEl);
          const shouldSnap = Boolean(evt.altKey || evt.shiftKey);
          if (shouldSnap) {
            snapWidgetTransformToAnchor(state.selectedEl, tf, preset.aMin, preset.aMax);
          } else {
            recalculatePosForNewAnchor(state.selectedEl, tf, preset.aMin, preset.aMax);
            tf.dirty = true;
            applyWidgetTransformToDom(state.selectedEl, tf, { applyCss: false });
          }
          closeTransformPopovers();
          syncTransformInspectorWidgets(state.selectedEl, tf);
          saveWidgetTransformEdit(state.selectedEl, tf, true).then(result => {
            const fb = document.getElementById('wb-tf-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? `✓ ${shouldSnap ? 'Snapped to' : 'Anchor set:'} ${preset.vLabel}-${preset.hLabel} & saved!`
                  : `✓ ${shouldSnap ? 'Snapped to' : 'Anchor set:'} ${preset.vLabel}-${preset.hLabel}`;
            }
          });
        }
        return;
      }

      const tfLockBtn = evt.target.closest('[data-tf-lock-aspect]');
      if (tfLockBtn && state.selectedEl) {
        const tf = getWidgetTransformState(state.selectedEl);
        tf.lockAspect = !tf.lockAspect;
        if (tf.lockAspect) {
          tf.aspectRatio = tf.height > 0 ? tf.width / tf.height : 1;
        }
        syncTransformInspectorWidgets(state.selectedEl, tf);
        if (tf.dirty) {
          saveWidgetTransformEdit(state.selectedEl, tf, true);
        }
        return;
      }

      const tfResetBtn = evt.target.closest('[data-tf-reset]');
      if (tfResetBtn && state.selectedEl) {
        closeTransformPopovers();
        const edits = loadUiEdits();
        resetSingleElementTransform(state.selectedEl, edits);
        saveUiEdits(edits);
        renderInspector();
        renderTransformGizmo();
        persistUiEditsToDisk().then(result => {
          const fb = document.getElementById('wb-tf-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server'
                ? '✓ Transform reset & saved to ui-edits.js!'
                : '✓ Transform reset in browser storage';
          }
        });
        return;
      }

      const toggleBtn = evt.target.closest('[data-tree-toggle]');
      if (toggleBtn) {
        evt.stopPropagation();
        const idx = parseInt(toggleBtn.getAttribute('data-tree-toggle'), 10);
        const item = state.hierarchyItems[idx];
        if (item && item.hasChildren) {
          state.collapsedViews.set(item.el, !item.isCollapsed);
          renderHierarchyTree();
        }
        return;
      }

      const treeNode = evt.target.closest('[data-tree-idx]');
      if (treeNode) {
        const idx = parseInt(treeNode.getAttribute('data-tree-idx'), 10);
        const item = state.hierarchyItems[idx];
        if (item && item.el) {
          selectElement(item.el);
        }
        return;
      }

      const gotoViewBtn = evt.target.closest('[data-insp-goto-view]');
      if (gotoViewBtn) {
        const targetView = gotoViewBtn.getAttribute('data-insp-goto-view');
        if (targetView) setState(targetView);
        return;
      }

      const childIconBtn = evt.target.closest('[data-insp-select-child-icon]');
      if (childIconBtn && state.selectedEl) {
        const childIcon = state.selectedEl.tagName !== 'IMG' ? state.selectedEl.querySelector('[data-slice-id]') : null;
        if (childIcon) selectElement(childIcon);
        return;
      }

      const sliceTab = evt.target.closest('[data-insp-slice-attr]');
      if (sliceTab) {
        state.activeEditorSliceAttr = sliceTab.getAttribute('data-insp-slice-attr');
        renderInspector();
        return;
      }

      const openPickerBtn = evt.target.closest('[data-open-sprite-picker]');
      if (openPickerBtn && state.selectedEl) {
        openSpritePicker(state.activeEditorSliceAttr, state.selectedEl);
        return;
      }

      const btnBrowse = evt.target.closest('[data-btn-state-browse]');
      if (btnBrowse && state.selectedEl) {
        const attrName = btnBrowse.getAttribute('data-btn-state-browse') || 'data-slice-id';
        const spriteTarget = getButtonSpriteTargetEl(state.selectedEl) || state.selectedEl;
        openSpritePicker(attrName, spriteTarget);
        return;
      }

      const btnClear = evt.target.closest('[data-btn-state-clear]');
      if (btnClear && state.selectedEl) {
        const attrName = btnClear.getAttribute('data-btn-state-clear');
        const spriteTarget = getButtonSpriteTargetEl(state.selectedEl) || state.selectedEl;
        clearWidgetSpriteAttr(spriteTarget, attrName, state.swapAllSprites).then(result => {
          const fb = document.getElementById('wb-sprite-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server'
                ? `✓ Cleared ${formatSliceAttrStateLabel(attrName)} state & saved!`
                : `✓ Cleared ${formatSliceAttrStateLabel(attrName)} state (browser storage)`;
          }
        });
        return;
      }

      if (evt.target.closest('[data-close-sprite-picker]') || evt.target.id === 'wb-sprite-picker-modal') {
        closeSpritePicker();
        return;
      }

      const catBtn = evt.target.closest('[data-sp-cat]');
      if (catBtn) {
        const cat = catBtn.getAttribute('data-sp-cat') || 'all';
        state.spritePicker.category = cat;
        document.querySelectorAll('#wb-sp-cats [data-sp-cat]').forEach(btn => {
          btn.classList.toggle('is-active', btn.getAttribute('data-sp-cat') === cat);
        });
        renderSpritePickerGrid();
        return;
      }

      const showSpriteFeedback = (feedbackId, result, sliceId, attrName, verb = 'Swapped') => {
        const fb = document.getElementById(feedbackId);
        if (!fb) return;
        const stateLabel = formatSliceAttrStateLabel(attrName);
        fb.textContent = !result.ok
          ? result.error || `Unknown slice ID: "${sliceId}"`
          : result.method === 'studio-server'
            ? `✓ ${verb} ${stateLabel} → "${sliceId}" & saved to disk!`
            : `✓ ${verb} ${stateLabel} → "${sliceId}" (browser storage)`;
      };

      const applyInputSliceValue = (targetEl, attrName, rawVal, feedbackId) => {
        const newSliceId = String(rawVal || '').trim();
        if (!newSliceId && (attrName === 'data-slice-hover' || attrName === 'data-slice-pressed')) {
          return clearWidgetSpriteAttr(targetEl, attrName, state.swapAllSprites).then(result => {
            const fb = document.getElementById(feedbackId);
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? `✓ Cleared ${formatSliceAttrStateLabel(attrName)} state & saved!`
                  : `✓ Cleared ${formatSliceAttrStateLabel(attrName)} state (browser storage)`;
            }
          });
        }
        return changeWidgetSprite(targetEl, attrName, newSliceId, state.swapAllSprites).then(result => {
          showSpriteFeedback(feedbackId, result, newSliceId, attrName, 'Swapped');
        });
      };

      const pickCard = evt.target.closest('[data-sp-pick]');
      if (pickCard && state.selectedEl) {
        const newSliceId = pickCard.getAttribute('data-sp-pick');
        const attrName = state.spritePicker.attrName || state.activeEditorSliceAttr || 'data-slice-id';
        const targetEl =
          (state.spritePicker.targetEl && document.body.contains(state.spritePicker.targetEl) && state.spritePicker.targetEl) ||
          (isButtonComponent(state.selectedEl) ? getButtonSpriteTargetEl(state.selectedEl) : null) ||
          state.selectedEl;
        closeSpritePicker();
        changeWidgetSprite(targetEl, attrName, newSliceId, state.swapAllSprites).then(result => {
          showSpriteFeedback('wb-sprite-feedback', result, newSliceId, attrName, 'Set');
        });
        return;
      }

      const btnApply = evt.target.closest('[data-btn-state-apply]');
      if (btnApply && state.selectedEl) {
        const attrName = btnApply.getAttribute('data-btn-state-apply') || 'data-slice-id';
        const row = btnApply.closest('[data-btn-state]');
        const inp = row ? row.querySelector(`[data-btn-state-input="${attrName}"]`) : null;
        const targetEl = getButtonSpriteTargetEl(state.selectedEl) || state.selectedEl;
        applyInputSliceValue(targetEl, attrName, inp ? inp.value : '', 'wb-sprite-feedback');
        return;
      }

      const applySliceBtn = evt.target.closest('[data-insp-apply-slice]');
      if (applySliceBtn && state.selectedEl) {
        const inp = document.getElementById('wb-insp-slice-input');
        const attrName = state.activeEditorSliceAttr || 'data-slice-id';
        applyInputSliceValue(state.selectedEl, attrName, inp ? inp.value : '', 'wb-sprite-feedback');
        return;
      }

      const saveEditsBtn = evt.target.closest('[data-ui-edits-save]');
      if (saveEditsBtn && state.selectedEl) {
        const textInput = document.getElementById('wb-insp-text-input');
        if (textInput) {
          applyWidgetTextEdit(state.selectedEl, textInput.value, false);
        }
        const fb = document.getElementById('wb-text-feedback');
        if (fb) fb.textContent = 'Saving...';
        saveEditsBtn.disabled = true;
        persistUiEditsToDisk().then(result => {
          saveEditsBtn.disabled = false;
          const fbAfter = document.getElementById('wb-text-feedback');
          if (fbAfter) {
            fbAfter.textContent =
              result.method === 'studio-server'
                ? '✓ Saved permanently to ui-edits.js!'
                : '✓ Saved in browser storage (start server to write disk)';
          }
        });
        return;
      }

      const resetWidgetBtn = evt.target.closest('[data-reset-widget-edits]');
      if (resetWidgetBtn && state.selectedEl) {
        resetWidgetBtn.disabled = true;
        resetWidgetEdits(state.selectedEl).then(result => {
          const fbText = document.getElementById('wb-text-feedback');
          const fbSprite = document.getElementById('wb-sprite-feedback');
          const msg =
            result.method === 'studio-server'
              ? '✓ Reset widget & updated ui-edits.js.'
              : '✓ Reset widget to default.';
          if (fbText) fbText.textContent = msg;
          else if (fbSprite) fbSprite.textContent = msg;
        });
        return;
      }

      const saveBtn = evt.target.closest('[data-s9-save]');
      if (saveBtn) {
        const sliceId = getActive9SliceId();
        const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
        if (sliceId && resolved) {
          const targetEl = state.inspectorMode === 'widget' ? state.selectedEl : null;
          const arr = resolveEffectiveSlice9(targetEl, sliceId, resolved.rec) || [0, 0, 0, 0];
          const clamped = arr.map(v => Math.max(0, parseInt(v, 10) || 0));
          const overrides = loadSlice9Overrides();
          overrides[sliceId] = clamped;
          saveSlice9Overrides(overrides);

          const catalog = getCatalog();
          if (catalog.slices && catalog.slices[sliceId]) {
            catalog.slices[sliceId].slice_9 = [...clamped];
          }
          document.querySelectorAll(`#game-canvas [data-slice-id="${sliceId}"]`).forEach(node => {
            state.elementSlice9Overrides.delete(node);
            applySliceToElement(node, sliceId);
          });
          renderManifestTable();
          syncResourceCardBadge(sliceId, clamped, true);

          const fb = document.getElementById('wb-s9-feedback');
          if (fb) fb.textContent = 'Saving...';
          saveBtn.disabled = true;
          persistSlice9ToDisk({ slice_id: sliceId, slice_9: clamped }).then(result => {
            saveBtn.disabled = false;
            const fbAfter = document.getElementById('wb-s9-feedback');
            if (fbAfter) {
              fbAfter.textContent =
                result.method === 'studio-server' || result.method === 'file-system-api'
                  ? '✓ Saved permanently for future uses!'
                  : '✓ Saved in browser storage (start slice_sprites.py --serve to write to disk)';
            }
          });
        }
        return;
      }

      const resetBtn = evt.target.closest('[data-s9-reset]');
      if (resetBtn) {
        const sliceId = getActive9SliceId();
        if (state.selectedEl) {
          state.elementSlice9Overrides.delete(state.selectedEl);
        }
        if (sliceId) {
          const overrides = loadSlice9Overrides();
          delete overrides[sliceId];
          saveSlice9Overrides(overrides);

          resetBtn.disabled = true;
          persistSlice9ToDisk({ reset_slice_id: sliceId }).then(result => {
            resetBtn.disabled = false;
            const catalog = getCatalog();
            const restored =
              (result.resolved && Array.isArray(result.resolved[sliceId]) && result.resolved[sliceId]) ||
              state.initialSlice9Defaults.get(sliceId);
            if (restored && catalog.slices && catalog.slices[sliceId]) {
              catalog.slices[sliceId].slice_9 = [...restored];
            } else if (catalog.slices && catalog.slices[sliceId] && result.resolved && sliceId in result.resolved) {
              catalog.slices[sliceId].slice_9 = result.resolved[sliceId];
            }
            document.querySelectorAll(`#game-canvas [data-slice-id="${sliceId}"]`).forEach(node => {
              state.elementSlice9Overrides.delete(node);
              applySliceToElement(node, sliceId);
            });
            renderManifestTable();
            renderResourcesDockGrid();
            renderInspector();
            const fbAfter = document.getElementById('wb-s9-feedback');
            if (fbAfter) fbAfter.textContent = '✓ Reset to default slice.';
          });
        } else {
          renderInspector();
        }
        return;
      }

      const dockTabBtn = evt.target.closest('[data-dock-tab]');
      if (dockTabBtn) {
        const tabName = dockTabBtn.getAttribute('data-dock-tab');
        if (tabName) setBottomDock(true, tabName);
        return;
      }

      const resCatBtn = evt.target.closest('#wb-res-cats [data-res-cat]');
      if (resCatBtn) {
        const cat = resCatBtn.getAttribute('data-res-cat') || 'all';
        state.resourceDock.category = cat;
        document.querySelectorAll('#wb-res-cats [data-res-cat]').forEach(btn => {
          btn.classList.toggle('is-active', btn.getAttribute('data-res-cat') === cat);
        });
        renderResourcesDockGrid();
        return;
      }

      const resPickEl = evt.target.closest('[data-res-pick]');
      if (resPickEl) {
        const sliceId = resPickEl.getAttribute('data-res-pick');
        if (sliceId) {
          selectResourceSprite(sliceId, {
            scrollIntoView: Boolean(resPickEl.closest('#wb-manifest-body')),
          });
        }
        return;
      }

      const editResS9Btn = evt.target.closest('[data-insp-edit-resource-s9]');
      if (editResS9Btn) {
        const sliceId = editResS9Btn.getAttribute('data-insp-edit-resource-s9');
        if (sliceId) {
          selectResourceSprite(sliceId, { scrollIntoView: true });
        }
        return;
      }

      const assignResBtn = evt.target.closest('[data-assign-resource-to-widget]');
      if (assignResBtn && state.selectedEl && document.body.contains(state.selectedEl)) {
        const sliceId = assignResBtn.getAttribute('data-assign-resource-to-widget');
        const attrName = assignResBtn.getAttribute('data-assign-attr') || state.activeEditorSliceAttr || 'data-slice-id';
        const targetEl = isButtonComponent(state.selectedEl)
          ? getButtonSpriteTargetEl(state.selectedEl) || state.selectedEl
          : state.selectedEl;
        if (sliceId && targetEl) {
          changeWidgetSprite(targetEl, attrName, sliceId, state.swapAllSprites).then(result => {
            const fb = document.getElementById('wb-res-feedback');
            if (fb) {
              const stateLabel = formatSliceAttrStateLabel(attrName);
              fb.textContent = !result.ok
                ? result.error || 'Failed to assign sprite.'
                : result.method === 'studio-server'
                  ? `✓ Assigned ${stateLabel} "${sliceId}" & saved to ui-edits.js!`
                  : `✓ Assigned ${stateLabel} "${sliceId}" (browser storage)`;
            }
          });
        }
        return;
      }
    });

    function getTransformFieldNumericValue(tf, field) {
      if (!tf) return 0;
      switch (field) {
        case 'posX':
          return tf.posX || 0;
        case 'posY':
          return tf.posY || 0;
        case 'width':
          return tf.width || 1;
        case 'height':
          return tf.height || 1;
        case 'anchorMinX':
          return tf.anchorMin ? tf.anchorMin[0] : 0.5;
        case 'anchorMinY':
          return tf.anchorMin ? tf.anchorMin[1] : 0.5;
        case 'anchorMaxX':
          return tf.anchorMax ? tf.anchorMax[0] : 0.5;
        case 'anchorMaxY':
          return tf.anchorMax ? tf.anchorMax[1] : 0.5;
        case 'pivotX':
          return tf.pivot ? tf.pivot[0] : 0.5;
        case 'pivotY':
          return tf.pivot ? tf.pivot[1] : 0.5;
        case 'rotate':
          return tf.rotate || 0;
        default:
          return 0;
      }
    }

    function getTransformFieldScrubStep(field, evt) {
      const isNorm =
        field === 'anchorMinX' ||
        field === 'anchorMinY' ||
        field === 'anchorMaxX' ||
        field === 'anchorMaxY' ||
        field === 'pivotX' ||
        field === 'pivotY';
      if (isNorm) {
        if (evt.altKey) return 0.001;
        if (evt.shiftKey) return 0.02;
        return 0.005;
      }
      if (evt.altKey) return 0.1;
      if (evt.shiftKey) return 5;
      return 1;
    }

    function applyTransformFieldEdit(el, tf, field, val) {
      if (!el || !tf || !Number.isFinite(val)) return;
      let applyCss = true;
      switch (field) {
        case 'posX':
          tf.posX = roundTfNum(val, 2);
          break;
        case 'posY':
          tf.posY = roundTfNum(val, 2);
          break;
        case 'width': {
          const nextW = Math.max(1, Math.round(val));
          tf.width = nextW;
          if (tf.lockAspect && tf.aspectRatio > 0) {
            tf.height = Math.max(1, Math.round(nextW / tf.aspectRatio));
          } else {
            tf.aspectRatio = tf.height > 0 ? tf.width / tf.height : 1;
          }
          break;
        }
        case 'height': {
          const nextH = Math.max(1, Math.round(val));
          tf.height = nextH;
          if (tf.lockAspect && tf.aspectRatio > 0) {
            tf.width = Math.max(1, Math.round(nextH * tf.aspectRatio));
          } else {
            tf.aspectRatio = tf.height > 0 ? tf.width / tf.height : 1;
          }
          break;
        }
        case 'anchorMinX': {
          const nx = roundTfNum(clamp01(val), 4);
          recalculatePosForNewAnchor(
            el,
            tf,
            [nx, tf.anchorMin[1]],
            [Math.max(tf.anchorMax[0], nx), tf.anchorMax[1]]
          );
          applyCss = false;
          break;
        }
        case 'anchorMinY': {
          const ny = roundTfNum(clamp01(val), 4);
          recalculatePosForNewAnchor(
            el,
            tf,
            [tf.anchorMin[0], ny],
            [tf.anchorMax[0], Math.max(tf.anchorMax[1], ny)]
          );
          applyCss = false;
          break;
        }
        case 'anchorMaxX': {
          const nx = roundTfNum(clamp01(val), 4);
          recalculatePosForNewAnchor(
            el,
            tf,
            [Math.min(tf.anchorMin[0], nx), tf.anchorMin[1]],
            [nx, tf.anchorMax[1]]
          );
          applyCss = false;
          break;
        }
        case 'anchorMaxY': {
          const ny = roundTfNum(clamp01(val), 4);
          recalculatePosForNewAnchor(
            el,
            tf,
            [tf.anchorMin[0], Math.min(tf.anchorMin[1], ny)],
            [tf.anchorMax[0], ny]
          );
          applyCss = false;
          break;
        }
        case 'pivotX':
          tf.pivot = [roundTfNum(val, 4), tf.pivot[1]];
          break;
        case 'pivotY':
          tf.pivot = [tf.pivot[0], roundTfNum(val, 4)];
          break;
        case 'rotate':
          tf.rotate = roundTfNum(val, 2);
          break;
        default:
          return;
      }
      tf.dirty = true;
      applyWidgetTransformToDom(el, tf, { applyCss });
    }

    // Apply-to-all checkboxes and inspector/sprite-picker inputs
    document.addEventListener('change', evt => {
      if (!evt.target) return;
      if (evt.target.id === 'wb-apply-all-cb') {
        state.applyAllInstances = Boolean(evt.target.checked);
      } else if (evt.target.id === 'wb-res-only-used') {
        state.resourceDock.onlyUsed = Boolean(evt.target.checked);
        renderResourcesDockGrid();
      } else if (evt.target.id === 'wb-swap-all-sprites-cb') {
        state.swapAllSprites = Boolean(evt.target.checked);
        const spCb = document.getElementById('wb-sp-swap-all');
        if (spCb) spCb.checked = state.swapAllSprites;
      } else if (evt.target.id === 'wb-sp-swap-all') {
        state.swapAllSprites = Boolean(evt.target.checked);
        const inspCb = document.getElementById('wb-swap-all-sprites-cb');
        if (inspCb) inspCb.checked = state.swapAllSprites;
      } else if (evt.target.id === 'wb-insp-text-input' && state.selectedEl) {
        const res = applyWidgetTextEdit(state.selectedEl, evt.target.value, true);
        if (res && typeof res.then === 'function') {
          res.then(result => {
            const fb = document.getElementById('wb-text-feedback');
            if (fb && !fb.textContent) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Saved permanently to ui-edits.js!'
                  : '✓ Saved in browser storage';
            }
          });
        }
      } else if (evt.target.closest && evt.target.closest('[data-tf-input]') && state.selectedEl) {
        const tfInp = evt.target.closest('[data-tf-input]');
        const field = tfInp.getAttribute('data-tf-input');
        const val = parseFloat(tfInp.value);
        const tf = getWidgetTransformState(state.selectedEl);
        if (!Number.isFinite(val)) {
          syncTransformInspectorWidgets(state.selectedEl, tf);
          return;
        }
        applyTransformFieldEdit(state.selectedEl, tf, field, val);
        syncTransformInspectorWidgets(state.selectedEl, tf);
        saveWidgetTransformEdit(state.selectedEl, tf, true).then(result => {
          const fb = document.getElementById('wb-tf-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server'
                ? '✓ Transform saved to ui-edits.js!'
                : '✓ Transform saved in browser storage';
          }
        });
      }
    });

    document.addEventListener('keydown', evt => {
      if (evt.key === 'Escape') {
        const modal = document.getElementById('wb-sprite-picker-modal');
        if (modal && modal.classList.contains('is-open')) {
          closeSpritePicker();
        }
        closeTransformPopovers();
      } else if (evt.key === 'Enter' && evt.target && evt.target.id === 'wb-insp-slice-input') {
        evt.preventDefault();
        const applyBtn = document.querySelector('[data-insp-apply-slice]');
        if (applyBtn) applyBtn.click();
      } else if (evt.key === 'Enter' && evt.target && evt.target.hasAttribute('data-btn-state-input')) {
        evt.preventDefault();
        const attrName = evt.target.getAttribute('data-btn-state-input');
        const applyBtn = attrName ? document.querySelector(`[data-btn-state-apply="${attrName}"]`) : null;
        if (applyBtn) applyBtn.click();
      } else if (
        evt.key === 'Enter' &&
        evt.target &&
        evt.target.closest &&
        evt.target.closest('[data-tf-input]') &&
        state.selectedEl
      ) {
        evt.preventDefault();
        const tfInp = evt.target.closest('[data-tf-input]');
        const field = tfInp.getAttribute('data-tf-input');
        const val = parseFloat(tfInp.value);
        if (!Number.isFinite(val)) return;
        const tf = getWidgetTransformState(state.selectedEl);
        applyTransformFieldEdit(state.selectedEl, tf, field, val);
        syncTransformInspectorWidgets(state.selectedEl, tf);
        saveWidgetTransformEdit(state.selectedEl, tf, true).then(result => {
          const fb = document.getElementById('wb-tf-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server'
                ? '✓ Transform saved to ui-edits.js!'
                : '✓ Transform saved in browser storage';
          }
        });
      }
    });

    document.addEventListener('input', evt => {
      if (evt.target && evt.target.id === 'wb-insp-text-input' && state.selectedEl) {
        applyWidgetTextEdit(state.selectedEl, evt.target.value, false);
        return;
      }
      if (evt.target && evt.target.id === 'wb-sp-search') {
        state.spritePicker.search = evt.target.value || '';
        renderSpritePickerGrid();
        return;
      }
      if (evt.target && evt.target.id === 'wb-res-search') {
        state.resourceDock.search = evt.target.value || '';
        renderResourcesDockGrid();
        return;
      }
      const tfInp = evt.target && evt.target.closest ? evt.target.closest('[data-tf-input]') : null;
      if (tfInp && state.selectedEl) {
        const raw = String(tfInp.value || '').trim();
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return;
        const val = parseFloat(raw);
        if (!Number.isFinite(val)) return;
        const field = tfInp.getAttribute('data-tf-input');
        const tf = getWidgetTransformState(state.selectedEl);
        applyTransformFieldEdit(state.selectedEl, tf, field, val);
        syncTransformInspectorWidgets(state.selectedEl, tf);
        saveWidgetTransformEdit(state.selectedEl, tf, false);
        return;
      }
      const inp = evt.target && evt.target.closest ? evt.target.closest('[data-s9-input]') : null;
      if (!inp) return;
      const sliceId = getActive9SliceId();
      const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
      if (!resolved) return;

      const t = parseInt(document.getElementById('s9-in-t')?.value || '0', 10) || 0;
      const r = parseInt(document.getElementById('s9-in-r')?.value || '0', 10) || 0;
      const b = parseInt(document.getElementById('s9-in-b')?.value || '0', 10) || 0;
      const l = parseInt(document.getElementById('s9-in-l')?.value || '0', 10) || 0;
      const next = [
        Math.max(0, Math.min(Math.floor(resolved.rec.height / 2), t)),
        Math.max(0, Math.min(Math.floor(resolved.rec.width / 2), r)),
        Math.max(0, Math.min(Math.floor(resolved.rec.height / 2), b)),
        Math.max(0, Math.min(Math.floor(resolved.rec.width / 2), l)),
      ];

      const targetEl = state.inspectorMode === 'widget' ? state.selectedEl : null;
      const applyAll = state.inspectorMode === 'resource' ? true : state.applyAllInstances;
      applyLiveSlice9(targetEl, sliceId, next, applyAll);
      syncSlice9EditorWidgets(next, resolved.rec);
    });

    // Direct canvas widget drag-move & Transform gizmo resize handles
    document.addEventListener('mousedown', evt => {
      if (
        (state.anchorPresetOpen || state.transformMenuOpen) &&
        evt.target &&
        evt.target.closest &&
        !evt.target.closest('#wb-tf-preset-popover, [data-tf-preset-btn], #wb-tf-menu-dropdown, [data-tf-menu-toggle]')
      ) {
        closeTransformPopovers();
      }
      if (evt.button !== 0 || !evt.target || typeof evt.target.closest !== 'function') return;

      const scrubHandle = state.selectedEl ? evt.target.closest('[data-tf-scrub-handle]') : null;
      if (scrubHandle) {
        const field = scrubHandle.getAttribute('data-tf-scrub-handle');
        const scrubWrap = scrubHandle.closest('[data-tf-scrub]') || scrubHandle.parentElement;
        const inp =
          (scrubWrap && scrubWrap.querySelector(`[data-tf-input="${field}"]`)) ||
          document.querySelector(`[data-tf-input="${field}"]`);
        const tf = getWidgetTransformState(state.selectedEl);
        const startVal = getTransformFieldNumericValue(tf, field);
        evt.preventDefault();
        suppressNextScrubClick = true;
        document.body.classList.add('is-tf-scrubbing');
        if (scrubWrap) scrubWrap.classList.add('is-scrubbing');
        tfScrub = {
          field,
          inp,
          scrubWrap,
          el: state.selectedEl,
          startClientX: evt.clientX,
          lastClientX: evt.clientX,
          accumVal: startVal,
          started: true,
        };
        return;
      }

      if (!isEditMode()) return;

      const resizeHandle = evt.target.closest('.px-gizmo-handle[data-tf-handle]');
      if (resizeHandle && state.selectedEl) {
        evt.preventDefault();
        evt.stopPropagation();
        const tf = getWidgetTransformState(state.selectedEl);
        tfDrag = {
          kind: 'resize',
          handle: resizeHandle.getAttribute('data-tf-handle') || 'se',
          el: state.selectedEl,
          started: true,
          startClientX: evt.clientX,
          startClientY: evt.clientY,
          zoom: getCanvasZoomFactor(),
          startPosX: tf.posX,
          startPosY: tf.posY,
          startWidth: tf.width,
          startHeight: tf.height,
          pivot: [...tf.pivot],
          rotate: tf.rotate || 0,
          lockAspect: Boolean(tf.lockAspect),
          aspectRatio: tf.aspectRatio || (tf.height > 0 ? tf.width / tf.height : 1),
        };
        return;
      }

      const moveBar = evt.target.closest('.px-gizmo-move-bar[data-tf-drag-move]');
      if (moveBar && state.selectedEl) {
        evt.preventDefault();
        evt.stopPropagation();
        const tf = getWidgetTransformState(state.selectedEl);
        tfDrag = {
          kind: 'move',
          el: state.selectedEl,
          started: true,
          startClientX: evt.clientX,
          startClientY: evt.clientY,
          zoom: getCanvasZoomFactor(),
          startPosX: tf.posX,
          startPosY: tf.posY,
        };
        return;
      }

      if (
        state.inlineEdit &&
        state.inlineEdit.targetEl &&
        (evt.target === state.inlineEdit.targetEl || state.inlineEdit.targetEl.contains(evt.target))
      ) {
        return;
      }

      const dragTarget = pickStudioElement(evt.target);
      if (dragTarget) {
        const tf = getWidgetTransformState(dragTarget);
        tfDrag = {
          kind: 'move',
          el: dragTarget,
          started: false,
          startClientX: evt.clientX,
          startClientY: evt.clientY,
          zoom: getCanvasZoomFactor(),
          startPosX: tf.posX,
          startPosY: tf.posY,
        };
      }
    });

    document.addEventListener('mousemove', evt => {
      if (tfScrub) {
        if (!tfScrub.started) {
          if (Math.abs(evt.clientX - tfScrub.startClientX) <= 3) return;
          tfScrub.started = true;
          suppressNextScrubClick = true;
          if (tfScrub.inp && document.activeElement === tfScrub.inp) {
            tfScrub.inp.blur();
          }
          try {
            const sel = global.getSelection && global.getSelection();
            if (sel && sel.removeAllRanges) sel.removeAllRanges();
          } catch {
            // Ignore selection errors
          }
          document.body.classList.add('is-tf-scrubbing');
          if (tfScrub.scrubWrap) tfScrub.scrubWrap.classList.add('is-scrubbing');
        }

        const dx = evt.clientX - tfScrub.lastClientX;
        tfScrub.lastClientX = evt.clientX;
        if (dx === 0) return;

        tfScrub.accumVal += dx * getTransformFieldScrubStep(tfScrub.field, evt);
        let nextVal = tfScrub.accumVal;
        if (tfScrub.field === 'width' || tfScrub.field === 'height') {
          tfScrub.accumVal = Math.max(1, tfScrub.accumVal);
          nextVal = Math.max(1, Math.round(tfScrub.accumVal));
        } else if (
          tfScrub.field === 'anchorMinX' ||
          tfScrub.field === 'anchorMinY' ||
          tfScrub.field === 'anchorMaxX' ||
          tfScrub.field === 'anchorMaxY'
        ) {
          tfScrub.accumVal = clamp01(tfScrub.accumVal);
          nextVal = roundTfNum(tfScrub.accumVal, 3);
        } else if (tfScrub.field === 'pivotX' || tfScrub.field === 'pivotY') {
          nextVal = roundTfNum(tfScrub.accumVal, 3);
        } else {
          nextVal = evt.altKey ? roundTfNum(tfScrub.accumVal, 1) : Math.round(tfScrub.accumVal);
        }

        const tf = getWidgetTransformState(tfScrub.el);
        applyTransformFieldEdit(tfScrub.el, tf, tfScrub.field, nextVal);
        syncTransformInspectorWidgets(tfScrub.el, tf);
        if (tfScrub.inp) {
          const isNorm =
            tfScrub.field === 'anchorMinX' ||
            tfScrub.field === 'anchorMinY' ||
            tfScrub.field === 'anchorMaxX' ||
            tfScrub.field === 'anchorMaxY' ||
            tfScrub.field === 'pivotX' ||
            tfScrub.field === 'pivotY';
          tfScrub.inp.value = formatTfVal(getTransformFieldNumericValue(tf, tfScrub.field), isNorm ? 3 : evt.altKey ? 1 : 2);
        }
        saveWidgetTransformEdit(tfScrub.el, tf, false);
        return;
      }

      if (!tfDrag) return;
      const rawDxScreen = evt.clientX - tfDrag.startClientX;
      const rawDyScreen = evt.clientY - tfDrag.startClientY;
      if (!tfDrag.started) {
        if (Math.hypot(rawDxScreen, rawDyScreen) <= 4) return;
        tfDrag.started = true;
        suppressNextCanvasClick = true;
        if (state.selectedEl !== tfDrag.el) {
          selectElement(tfDrag.el);
          // Re-snapshot initial PosX/PosY in case selection did anything
          const curTf = getWidgetTransformState(tfDrag.el);
          tfDrag.startPosX = curTf.posX;
          tfDrag.startPosY = curTf.posY;
        }
      }

      const zoom = tfDrag.zoom || 1;
      const rawDx = rawDxScreen / zoom;
      const rawDy = rawDyScreen / zoom;
      const tf = getWidgetTransformState(tfDrag.el);

      if (tfDrag.kind === 'move') {
        tf.posX = Math.round(tfDrag.startPosX + rawDx);
        tf.posY = Math.round(tfDrag.startPosY - rawDy);
        tf.dirty = true;
        applyWidgetTransformToDom(tfDrag.el, tf, { applyCss: true });
        syncTransformInspectorWidgets(tfDrag.el, tf);
        saveWidgetTransformEdit(tfDrag.el, tf, false);
        return;
      }

      if (tfDrag.kind === 'resize') {
        const rad = ((tfDrag.rotate || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const localDx = rawDx * cos + rawDy * sin;
        const localDy = -rawDx * sin + rawDy * cos;

        const handle = tfDrag.handle || '';
        const hasW = handle.includes('w');
        const hasE = handle.includes('e');
        const hasN = handle.includes('n');
        const hasS = handle.includes('s');

        const dW = hasE ? localDx : hasW ? -localDx : 0;
        const dH = hasS ? localDy : hasN ? -localDy : 0;

        let nextW = Math.max(8, Math.round(tfDrag.startWidth + dW));
        let nextH = Math.max(8, Math.round(tfDrag.startHeight + dH));

        if (tfDrag.lockAspect && tfDrag.aspectRatio > 0) {
          if ((hasW || hasE) && !(hasN || hasS)) {
            nextH = Math.max(8, Math.round(nextW / tfDrag.aspectRatio));
          } else if ((hasN || hasS) && !(hasW || hasE)) {
            nextW = Math.max(8, Math.round(nextH * tfDrag.aspectRatio));
          } else if (Math.abs(dW / Math.max(1, tfDrag.startWidth)) >= Math.abs(dH / Math.max(1, tfDrag.startHeight))) {
            nextH = Math.max(8, Math.round(nextW / tfDrag.aspectRatio));
          } else {
            nextW = Math.max(8, Math.round(nextH * tfDrag.aspectRatio));
          }
        } else {
          tf.aspectRatio = nextH > 0 ? nextW / nextH : 1;
        }

        const appliedDW = nextW - tfDrag.startWidth;
        const appliedDH = nextH - tfDrag.startHeight;
        const [pivX, pivY] = tfDrag.pivot;

        const localShiftX = hasE ? pivX * appliedDW : hasW ? -(1 - pivX) * appliedDW : 0;
        const localShiftY = hasS ? (1 - pivY) * appliedDH : hasN ? -pivY * appliedDH : 0;

        const worldDx = localShiftX * cos - localShiftY * sin;
        const worldDy = localShiftX * sin + localShiftY * cos;

        tf.width = nextW;
        tf.height = nextH;
        tf.posX = Math.round(tfDrag.startPosX + worldDx);
        tf.posY = Math.round(tfDrag.startPosY - worldDy);
        tf.dirty = true;
        applyWidgetTransformToDom(tfDrag.el, tf, { applyCss: true });
        syncTransformInspectorWidgets(tfDrag.el, tf);
        saveWidgetTransformEdit(tfDrag.el, tf, false);
      }
    });

    document.addEventListener('mouseup', () => {
      if (tfScrub) {
        const endedScrub = tfScrub;
        tfScrub = null;
        document.body.classList.remove('is-tf-scrubbing');
        if (endedScrub.scrubWrap) endedScrub.scrubWrap.classList.remove('is-scrubbing');
        if (endedScrub.started) {
          suppressNextScrubClick = true;
          const tf = getWidgetTransformState(endedScrub.el);
          saveWidgetTransformEdit(endedScrub.el, tf, true).then(result => {
            const fb = document.getElementById('wb-tf-feedback');
            if (fb && state.selectedEl === endedScrub.el) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Transform saved to ui-edits.js!'
                  : '✓ Transform saved in browser storage';
            }
          });
          setTimeout(() => {
            suppressNextScrubClick = false;
          }, 80);
        }
        return;
      }

      if (!tfDrag) return;
      const ended = tfDrag;
      tfDrag = null;
      if (ended.started) {
        suppressNextCanvasClick = true;
        const tf = getWidgetTransformState(ended.el);
        saveWidgetTransformEdit(ended.el, tf, true).then(result => {
          const fb = document.getElementById('wb-tf-feedback');
          if (fb && state.selectedEl === ended.el) {
            fb.textContent =
              result.method === 'studio-server'
                ? '✓ Transform saved to ui-edits.js!'
                : '✓ Transform saved in browser storage';
          }
        });
        setTimeout(() => {
          suppressNextCanvasClick = false;
        }, 80);
      }
    });

    // Draggable green Unity-style 9-slice lines
    let activeDrag = null;
    document.addEventListener('mousedown', evt => {
      const line = evt.target.closest && evt.target.closest('.slice9-line[data-slice-edge]');
      if (!line) return;
      const wrap = document.getElementById('slice9-canvas-wrap');
      if (!wrap) return;
      evt.preventDefault();
      const sliceId = wrap.getAttribute('data-slice-id');
      const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
      if (!resolved) return;

      activeDrag = {
        edge: line.getAttribute('data-slice-edge'),
        wrap,
        sliceId,
        rec: resolved.rec,
        zoom: parseFloat(wrap.getAttribute('data-zoom') || '1'),
      };
    });

    document.addEventListener('mousemove', evt => {
      if (!activeDrag) return;
      const { edge, wrap, sliceId, rec, zoom } = activeDrag;
      const wRect = wrap.getBoundingClientRect();
      const targetEl = state.inspectorMode === 'widget' ? state.selectedEl : null;
      const cur = resolveEffectiveSlice9(targetEl, sliceId, rec) || [0, 0, 0, 0];
      const next = [...cur];

      if (edge === 't') {
        const px = Math.round((evt.clientY - wRect.top) / zoom);
        next[0] = Math.max(0, Math.min(Math.floor(rec.height / 2), px));
      } else if (edge === 'r') {
        const px = Math.round((wRect.right - evt.clientX) / zoom);
        next[1] = Math.max(0, Math.min(Math.floor(rec.width / 2), px));
      } else if (edge === 'b') {
        const px = Math.round((wRect.bottom - evt.clientY) / zoom);
        next[2] = Math.max(0, Math.min(Math.floor(rec.height / 2), px));
      } else if (edge === 'l') {
        const px = Math.round((evt.clientX - wRect.left) / zoom);
        next[3] = Math.max(0, Math.min(Math.floor(rec.width / 2), px));
      }

      const applyAll = state.inspectorMode === 'resource' ? true : state.applyAllInstances;
      applyLiveSlice9(targetEl, sliceId, next, applyAll);
      syncSlice9EditorWidgets(next, rec);
    });

    document.addEventListener('mouseup', () => {
      if (activeDrag) {
        activeDrag = null;
      }
    });
  }

  function wireInteractions() {
    document.addEventListener('click', evt => {
      const stateBtn = evt.target.closest('[data-ui-state-trigger]');
      if (stateBtn) {
        setState(stateBtn.getAttribute('data-ui-state-trigger'));
        return;
      }

      const tabBtn = evt.target.closest('[data-ui-tab]');
      if (tabBtn) {
        const group = tabBtn.closest('[data-ui-tab-group]') || document;
        const tabId = tabBtn.getAttribute('data-ui-tab');
        group.querySelectorAll('[data-ui-tab]').forEach(b => {
          b.classList.toggle('is-active', b.getAttribute('data-ui-tab') === tabId);
        });
        group.querySelectorAll('[data-ui-tab-panel]').forEach(p => {
          p.classList.toggle('is-active', p.getAttribute('data-ui-tab-panel') === tabId);
        });
        return;
      }

      const toggleBtn = evt.target.closest('[data-ui-toggle]');
      if (toggleBtn) {
        if (isWireframeMode()) return;
        const nextOn = toggleBtn.getAttribute('aria-pressed') !== 'true';
        toggleBtn.setAttribute('aria-pressed', nextOn ? 'true' : 'false');
        toggleBtn.classList.toggle('is-on', nextOn);
        const swapId = toggleBtn.getAttribute(nextOn ? 'data-slice-on' : 'data-slice-off');
        if (swapId) {
          toggleBtn.setAttribute('data-slice-id', swapId);
          applySliceToElement(toggleBtn, swapId);
        }
        return;
      }

      const wbMode = evt.target.closest('[data-wb-mode]');
      if (wbMode) {
        setRenderMode(wbMode.getAttribute('data-wb-mode'));
        return;
      }

      const wbStudio = evt.target.closest('[data-wb-studio]');
      if (wbStudio) {
        setStudioPanels(!state.studioVisible);
        return;
      }

      const wbBehavior = evt.target.closest('[data-wb-behavior]');
      if (wbBehavior) {
        if (state.resourceDock.open && state.resourceDock.activeTab === 'behavior') {
          setBottomDock(false);
        } else {
          setBottomDock(true, 'behavior');
        }
        return;
      }

      const wbScale = evt.target.closest('[data-wb-scale]');
      if (wbScale) {
        setPixelScale(wbScale.getAttribute('data-wb-scale'));
        return;
      }

      const wbScene = evt.target.closest('[data-wb-scene]');
      if (wbScene) {
        setScene(wbScene.getAttribute('data-wb-scene'));
        return;
      }

      const wbDebug = evt.target.closest('[data-wb-debug]');
      if (wbDebug) {
        const on = document.body.classList.toggle('px-debug-outlines');
        wbDebug.classList.toggle('is-active', on);
        return;
      }

      const wbResources = evt.target.closest('[data-wb-resources]');
      if (wbResources) {
        if (state.resourceDock.open && state.resourceDock.activeTab === 'resources') {
          setBottomDock(false);
        } else {
          setBottomDock(true, 'resources');
        }
        return;
      }

      const wbManifest = evt.target.closest('[data-wb-manifest]');
      if (wbManifest) {
        if (state.resourceDock.open && state.resourceDock.activeTab === 'manifest') {
          setBottomDock(false);
        } else {
          setBottomDock(true, 'manifest');
        }
      }
    });

    // Hover & Pressed sprite state swapping (Idle / Hover / Pressed)
    document.addEventListener('mouseover', evt => {
      if (isWireframeMode() || isEditMode()) return;
      const pair = resolveInteractiveButtonPair(evt.target);
      if (!pair) return;
      if (evt.relatedTarget && pair.hostEl.contains(evt.relatedTarget)) return;
      pair.spriteEl.classList.add('is-hovered');
      if (pair.hostEl !== pair.spriteEl) pair.hostEl.classList.add('is-hovered');
      syncButtonVisualState(pair.spriteEl);
    });

    document.addEventListener('mouseout', evt => {
      if (isWireframeMode() || isEditMode()) return;
      const pair = resolveInteractiveButtonPair(evt.target);
      if (!pair) return;
      if (evt.relatedTarget && pair.hostEl.contains(evt.relatedTarget)) return;
      pair.spriteEl.classList.remove('is-hovered');
      if (pair.hostEl !== pair.spriteEl) pair.hostEl.classList.remove('is-hovered');
      syncButtonVisualState(pair.spriteEl);
    });

    document.addEventListener('mousedown', evt => {
      if (isWireframeMode() || isEditMode()) return;
      const pair = resolveInteractiveButtonPair(evt.target);
      if (!pair) return;
      pair.spriteEl.classList.add('is-pressed');
      if (pair.hostEl !== pair.spriteEl) pair.hostEl.classList.add('is-pressed');
      syncButtonVisualState(pair.spriteEl);
    });

    const releasePressed = () => {
      document.querySelectorAll('.is-pressed').forEach(node => {
        node.classList.remove('is-pressed');
        if (node.hasAttribute('data-slice-id') || node.hasAttribute('data-slice-pressed') || node.hasAttribute('data-slice-hover')) {
          syncButtonVisualState(node);
        }
      });
    };
    document.addEventListener('mouseup', releasePressed);
    document.addEventListener('mouseleave', releasePressed);
  }

  function init() {
    snapshotInitialSlice9Defaults();
    const params = new URLSearchParams(global.location.search);
    if (params.get('clean') === '1') {
      document.body.classList.add('clean-mode');
    }

    ensureStudioShell();
    applySavedUiEdits();
    hydrateSprites(document);
    wireInteractions();
    wireStudioInteractions();

    // Re-apply saved edits after any same-tick DOMContentLoaded page scripts finish hydrating dynamic widgets
    setTimeout(() => {
      if (applySavedUiEdits() > 0) {
        renderManifestTable();
        renderResourcesDockGrid();
        renderHierarchyTree();
        if (state.selectedEl || state.inspectorMode === 'resource') renderInspector();
      } else {
        flushPendingTransforms();
        renderResourcesDockGrid();
      }
      renderTransformGizmo();
    }, 0);

    const scaleParam = params.get('scale');
    if (scaleParam) setPixelScale(scaleParam);

    const sceneParam = params.get('scene');
    if (sceneParam) setScene(sceneParam);

    const activeModeBtn = document.querySelector('[data-wb-mode].is-active');
    const initialMode =
      params.get('mode') ||
      (document.body && document.body.getAttribute('data-default-mode')) ||
      (activeModeBtn && activeModeBtn.getAttribute('data-wb-mode')) ||
      'final';
    setRenderMode(initialMode);

    const initialState =
      params.get('state') ||
      (document.querySelector('[data-ui-view].is-active') &&
        document.querySelector('[data-ui-view].is-active').getAttribute('data-ui-view')) ||
      (document.querySelector('[data-ui-view]') &&
        document.querySelector('[data-ui-view]').getAttribute('data-ui-view'));

    if (initialState) setState(initialState);
    else renderHierarchyTree();
  }

  global.PixelUI = {
    init,
    hydrateSprites,
    applySliceToElement,
    setState,
    setRenderMode,
    isWireframeMode,
    isEditMode,
    setPixelScale,
    setScene,
    renderManifestTable,
    selectElement,
    selectResourceSprite,
    setBottomDock,
    setStudioPanels,
    saveSlice9: persistSlice9ToDisk,
    getOverrides: loadSlice9Overrides,
    changeWidgetSprite,
    clearWidgetSpriteAttr,
    isButtonComponent,
    getButtonSpriteTargetEl,
    applyWidgetTextEdit,
    resetWidgetEdits,
    openSpritePicker,
    getWidgetTransform: getWidgetTransformState,
    applyWidgetTransform: applyWidgetTransformToDom,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
