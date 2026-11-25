/* pixel-ui-kit.js — Interactive Game UI Preview Controller, Sprite Hydrator & Studio Workbench */

(function (global) {
  'use strict';

  const DEFAULT_CATALOG_BASE = '../_catalog/';
  const OVERRIDES_STORAGE_KEY = 'pixelui_slice9_overrides_v1';
  const UI_EDITS_STORAGE_PREFIX = 'pixelui_ui_edits_v1:';
  const BACKDROP_STORAGE_PREFIX = 'pixelui_backdrop_v1:';

  const STUDIO_SERVER_PORT = 17890;
  const FS_DB_NAME = 'pixelui_fs_handles_v1';
  const FS_STORE_NAME = 'handles';
  const FS_CATALOG_HANDLE_KEY = 'catalog_data_js';

  const CANVAS_PRESETS = {
    '1500x750': { w: 1500, h: 750, label: 'Default 1500×750 (2:1)', kind: 'phone' },
    '1334x750': { w: 1334, h: 750, label: 'Regular Phone 1334×750 (16:9)', kind: 'phone' },
    '1625x750': { w: 1625, h: 750, label: 'Large Phone 1625×750 (19.5:9)', kind: 'phone' },
    '1280x960': { w: 1280, h: 960, label: 'Tablet 1280×960 (4:3)', kind: 'tablet' },
    '1280x720': { w: 1280, h: 720, label: 'Legacy 1280×720 (16:9)', kind: 'legacy' },
  };

  const state = {
    selectedEl: null,
    selectedResourceSliceId: null,
    inspectorMode: 'widget', // 'widget' | 'resource'
    activeEditorSliceAttr: 'data-slice-id',
    currentMode: 'final',
    studioVisible: false,
    focusZoneVisible: false,
    safeZonesVisible: false,
    currentCanvasRes: '1280x720',
    l10nStressMode: 'base', // 'base' | 'long' | 'rtl'
    l10nOriginalText: new WeakMap(),
    l10nTrackedNodes: [],
    applyAllInstances: true,
    swapAllSprites: false,
    collapsedViews: new WeakMap(),
    elementSlice9Overrides: new WeakMap(),
    initialSlice9Defaults: new Map(),
    originalWidgetAttrs: new WeakMap(),
    originalWidgetText: new WeakMap(),
    widgetTransforms: new WeakMap(),
    pendingSavedTransforms: new WeakMap(),
    widgetLabelStates: new WeakMap(),
    widgetImageStates: new WeakMap(),
    originalLabelStyles: new WeakMap(),
    originalImageStyles: new WeakMap(),
    transformCollapsed: false,
    anchorPresetOpen: false,
    transformMenuOpen: false,
    labelCollapsed: false,
    labelGradientCollapsed: false,
    labelMenuOpen: false,
    imageCollapsed: false,
    imageGradientCollapsed: false,
    imageMenuOpen: false,
    buttonCollapsed: false,
    buttonGradientCollapsed: false,
    buttonMenuOpen: false,
    showHoverSpriteSlot: false,
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
    const catalog = getCatalog();
    const rawProjRel = catalog && typeof catalog.project_root_rel === 'string' ? catalog.project_root_rel.trim() : '';
    const projRel = rawProjRel ? (rawProjRel.endsWith('/') ? rawProjRel : rawProjRel + '/') : '../../';
    if (/^(Assets|assets|Tools|Sprite sheets)\//i.test(f)) {
      return getCatalogBase() + projRel + f;
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

  async function getFromStudioServer(apiPath) {
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
        const res = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok) {
            return { ok: true, method: 'studio-server', data };
          }
          if (data && data.ok === false) {
            return { ok: false, method: 'studio-server', error: data.error || 'Request failed', data };
          }
        }
      } catch {
        // Endpoint unreachable; try next candidate
      }
    }
    return { ok: false, method: 'offline', data: null };
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
          if (data && data.ok === false) {
            return { ok: false, method: 'studio-server', error: data.error || 'Export failed', data };
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
    return Boolean(
      el &&
        (el.id === '__verify_annotations__' ||
          el.id === '__px_transform_gizmo__' ||
          el.id === '__px_focus_zone__' ||
          el.id === '__px_safe_zones__' ||
          (el.classList &&
            (el.classList.contains('px-tint-overlay') || el.classList.contains('px-grad-overlay'))))
    );
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
      tintEdits: Object.assign({}, diskEdits.tintEdits || {}, localEdits.tintEdits || {}),
      labelEdits: Object.assign({}, diskEdits.labelEdits || {}, localEdits.labelEdits || {}),
      imageEdits: Object.assign({}, diskEdits.imageEdits || {}, localEdits.imageEdits || {}),
    };
  }

  function saveUiEdits(edits) {
    const slug = getPreviewSlugForEdits();
    const normalized = {
      textEdits: edits && edits.textEdits ? edits.textEdits : {},
      spriteEdits: edits && edits.spriteEdits ? edits.spriteEdits : {},
      transformEdits: edits && edits.transformEdits ? edits.transformEdits : {},
      tintEdits: edits && edits.tintEdits ? edits.tintEdits : {},
      labelEdits: edits && edits.labelEdits ? edits.labelEdits : {},
      imageEdits: edits && edits.imageEdits ? edits.imageEdits : {},
    };
    global.PIXELUI_EDITS = global.PIXELUI_EDITS || {};
    global.PIXELUI_EDITS[slug] = normalized;
    try {
      if (!global.localStorage) return;
      if (
        Object.keys(normalized.textEdits).length === 0 &&
        Object.keys(normalized.spriteEdits).length === 0 &&
        Object.keys(normalized.transformEdits).length === 0 &&
        Object.keys(normalized.tintEdits).length === 0 &&
        Object.keys(normalized.labelEdits).length === 0 &&
        Object.keys(normalized.imageEdits).length === 0
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
    'data-tint',
    'data-tint-mode',
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
      if (
        spriteEl &&
        (spriteEl.hasAttribute('data-slice-pressed') ||
          spriteEl.hasAttribute('data-slice-hover') ||
          spriteEl.hasAttribute('data-slice-id') ||
          state.widgetImageStates.has(spriteEl))
      ) {
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
    const interactive = !isWireframeMode() && !isEditMode();
    const isPressed = interactive && spriteEl.classList.contains('is-pressed');
    const isHovered = interactive && spriteEl.classList.contains('is-hovered');

    let nextSlice = idleId;
    if (isPressed && pressedId && resolveSliceUrl(pressedId)) {
      nextSlice = pressedId;
    } else if (isHovered && hoverId && resolveSliceUrl(hoverId)) {
      nextSlice = hoverId;
    }
    if (nextSlice) {
      applySliceToElement(spriteEl, nextSlice);
    }

    const imgState = state.widgetImageStates.get(spriteEl);
    if (imgState) {
      const activeTint = isPressed ? imgState.pressedColor || '#C5C5C5' : imgState.color || '#FFFFFF';
      applyEffectiveColorTint(spriteEl, nextSlice || idleId, activeTint, imgState.tintMode || 'auto');
    } else if (isPressed && !pressedId && nextSlice) {
      // Craftland default pressed color feedback when no dedicated pressed sprite is assigned
      const origTint = spriteEl.getAttribute('data-tint') || '';
      if (!origTint) {
        applyEffectiveColorTint(spriteEl, nextSlice, '#C5C5C5', 'auto');
      }
    } else if (!isPressed && !state.widgetImageStates.has(spriteEl)) {
      applyTintToElement(spriteEl, nextSlice || idleId);
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

    const lblState = state.widgetLabelStates.get(targetEl);
    if (lblState && lblState.overflow === 0) {
      fitLabelReduceFontSize(targetEl, lblState);
    }

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

    const parsePairAttr = raw => {
      if (!raw) return null;
      const parts = String(raw)
        .split(',')
        .map(s => Number(s.trim()));
      return parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? parts : null;
    };
    const anchorMin = parsePairAttr(el.getAttribute('data-anchor-min')) || [0.5, 0.5];
    const anchorMax = parsePairAttr(el.getAttribute('data-anchor-max')) || [anchorMin[0], anchorMin[1]];
    const pivot = parsePairAttr(el.getAttribute('data-pivot')) || [0.5, 0.5];
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
    refitDescendantLabels(el);
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

  /* ========================================================================
     Craftland UI Widget Label, Image & Button Components
     ======================================================================== */

  const CL_EYEDROPPER_SVG = `
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.5 2.5l3 3-1.4 1.4-3-3 1.4-1.4z"/>
      <path d="M9.1 3.9l3 3L6.2 12.8l-3.4.7.7-3.4 5.6-6.2z"/>
    </svg>
  `;

  const CL_TARGET_PICK_SVG = `
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4">
      <circle cx="8" cy="8" r="5.5"/>
      <circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none"/>
    </svg>
  `;

  const CL_LINE_SPACE_SVG = `
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
      <path d="M3 3h10M3 13h10M8 5v6M6.2 6.8L8 5l1.8 1.8M6.2 9.2L8 11l1.8-1.8"/>
    </svg>
  `;

  const CL_ALIGN_H_SVGS = {
    left: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M2.5 8h7.5M2.5 12h9.5"/></svg>',
    center: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M4.2 8h7.6M3.2 12h9.6"/></svg>',
    right: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M6 8h7.5M4 12h9.5"/></svg>',
    fillH: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>',
  };

  const CL_ALIGN_V_SVGS = {
    top: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 3h11M6 5.5v7.5M10 5.5v5"/></svg>',
    middle: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 8h11M6 4v8M10 5.5v5"/></svg>',
    bottom: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 13h11M6 3v7.5M10 5.5v5"/></svg>',
    fillV: '<svg viewBox="0 0 16 16" width="13" height="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 3v10M8 3v10M11.5 3v10"/></svg>',
  };

  const CL_FLIP_SVGS = {
    x: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 2v12" stroke-dasharray="2 1.5"/><path d="M6.2 4.5L2.5 11.5h3.7z" fill="currentColor" stroke="none"/><path d="M9.8 4.5L13.5 11.5H9.8z"/></svg>',
    y: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M2 8h12" stroke-dasharray="2 1.5"/><path d="M4.5 6.2L11.5 2.5v3.7z" fill="currentColor" stroke="none"/><path d="M4.5 9.8L11.5 13.5V9.8z"/></svg>',
  };

  function normalizeHexColor(raw, fallback = '#FFFFFF') {
    const s = String(raw || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase();
    }
    return fallback;
  }

  function parseCssColorToHexAlpha(cssStr, fallback = '#FFFFFF') {
    const s = String(cssStr || '').trim();
    if (!s) return { hex: fallback, alpha: 1 };
    if (s.startsWith('#')) {
      return { hex: normalizeHexColor(s, fallback), alpha: 1 };
    }
    const m = s.match(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!m) return { hex: fallback, alpha: 1 };
    const r = Math.max(0, Math.min(255, Math.round(parseFloat(m[1]) || 0)));
    const g = Math.max(0, Math.min(255, Math.round(parseFloat(m[2]) || 0)));
    const b = Math.max(0, Math.min(255, Math.round(parseFloat(m[3]) || 0)));
    const a = m[4] !== undefined ? clamp01(parseFloat(m[4])) : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex, alpha: a };
  }

  function hexToRgba(hex, alpha01 = 1) {
    const clean = normalizeHexColor(hex, '#FFFFFF');
    const r = parseInt(clean.slice(1, 3), 16);
    const g = parseInt(clean.slice(3, 5), 16);
    const b = parseInt(clean.slice(5, 7), 16);
    const a = roundTfNum(clamp01(alpha01), 3);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function applyEffectiveColorTint(el, sliceId, colorHex, tintMode = 'auto') {
    if (!el) return;
    const norm = normalizeHexColor(colorHex, '#FFFFFF');
    const cleanMode = ['auto', 'mask', 'multiply'].includes(String(tintMode || '').toLowerCase())
      ? String(tintMode).toLowerCase()
      : 'auto';
    if (norm === '#FFFFFF') {
      el.removeAttribute('data-tint');
      el.removeAttribute('data-tint-mode');
    } else {
      el.setAttribute('data-tint', norm);
      if (cleanMode === 'auto') el.removeAttribute('data-tint-mode');
      else el.setAttribute('data-tint-mode', cleanMode);
    }
    applyTintToElement(el, sliceId);
  }

  function snapshotLabelOriginals(targetEl) {
    if (!targetEl || state.originalLabelStyles.has(targetEl)) return;
    state.originalLabelStyles.set(targetEl, {
      color: targetEl.style.color || '',
      fontSize: targetEl.style.fontSize || '',
      fontWeight: targetEl.style.fontWeight || '',
      fontStyle: targetEl.style.fontStyle || '',
      textDecoration: targetEl.style.textDecoration || '',
      lineHeight: targetEl.style.lineHeight || '',
      textAlign: targetEl.style.textAlign || '',
      textAlignLast: targetEl.style.textAlignLast || '',
      display: targetEl.style.display || '',
      flexDirection: targetEl.style.flexDirection || '',
      justifyContent: targetEl.style.justifyContent || '',
      alignItems: targetEl.style.alignItems || '',
      overflow: targetEl.style.overflow || '',
      whiteSpace: targetEl.style.whiteSpace || '',
      wordBreak: targetEl.style.wordBreak || '',
      textShadow: targetEl.style.textShadow || '',
      filter: targetEl.style.filter || '',
      gradBg: targetEl.style.getPropertyValue('--px-label-grad-bg') || '',
      hadGradClass: targetEl.classList.contains('px-label-gradient'),
    });
  }

  function readInitialLabelState(targetEl) {
    const cs = getComputedStyle(targetEl);
    const parsedCol = parseCssColorToHexAlpha(cs.color, '#FFFFFF');
    const fs = Math.max(6, Math.round(parseFloat(cs.fontSize || '16') || 16));
    const fwNum = parseInt(cs.fontWeight || '400', 10);
    const isBold = cs.fontWeight === 'bold' || (Number.isFinite(fwNum) && fwNum >= 600);
    const isItalic = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
    const isUnderline = String(cs.textDecorationLine || cs.textDecoration || '').includes('underline');

    let alignH = 'left';
    if (cs.textAlign === 'center') alignH = 'center';
    else if (cs.textAlign === 'right' || cs.textAlign === 'end') alignH = 'right';
    else if (cs.textAlign === 'justify') alignH = 'fillH';
    else if (cs.display.includes('flex') && cs.justifyContent === 'center') alignH = 'center';

    let alignV = 'middle';
    if (cs.display.includes('flex')) {
      const axisProp = cs.flexDirection.startsWith('column') ? cs.justifyContent : cs.alignItems;
      if (axisProp === 'flex-start' || axisProp === 'start') alignV = 'top';
      else if (axisProp === 'flex-end' || axisProp === 'end') alignV = 'bottom';
      else if (axisProp === 'stretch' || axisProp === 'space-between') alignV = 'fillV';
    }

    const rawShadow = cs.textShadow && cs.textShadow !== 'none' ? cs.textShadow : '';
    const hasOutlineCls = targetEl.classList.contains('px-text-outline') || targetEl.classList.contains('px-text-outline-lg');
    const shadowParts = rawShadow ? rawShadow.split(/,(?![^(]*\))/) : [];
    const hasOutline = hasOutlineCls || shadowParts.length >= 4;
    const hasShadow = !hasOutline && shadowParts.length >= 1;
    let shadowColor = '#000000';
    let shadowAlpha = 1;
    let outlineColor = '#000000';
    let outlineAlpha = 1;
    const outlineWidth = targetEl.classList.contains('px-text-outline-lg') ? 2 : 1;
    if (rawShadow) {
      const colMatch = rawShadow.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,6}/);
      if (colMatch) {
        const parsedSh = parseCssColorToHexAlpha(colMatch[0], '#000000');
        if (hasOutline) {
          outlineColor = parsedSh.hex;
          outlineAlpha = roundTfNum(parsedSh.alpha, 2);
        } else {
          shadowColor = parsedSh.hex;
          shadowAlpha = roundTfNum(parsedSh.alpha, 2);
        }
      }
    }

    return {
      color: parsedCol.hex,
      alpha: Math.round(parsedCol.alpha * 100),
      fontSize: fs,
      alignH,
      alignV,
      _alignVEdited: false,
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      lineSpacing: 0,
      overflow: 1, // 0: Reduce Font Size, 1: Wrap around, 2: Overflow
      shadow: hasShadow,
      shadowColor,
      shadowOffset: [1, 1],
      shadowAlpha,
      outline: hasOutline,
      outlineColor,
      outlineAlpha,
      outlineWidth,
      gradient: 0, // 0: None, 1: Vertical Gradient, 2: Horizontal Gradient
      gradientTop: '#FFFFFF',
      gradientTopAlpha: 100,
      gradientBottom: '#FFFFFF',
      gradientBottomAlpha: 100,
      dirty: false,
    };
  }

  function getWidgetLabelState(el) {
    const info = getEditableTextInfo(el);
    const targetEl = (info && info.targetEl) || null;
    if (!targetEl) return null;
    let lbl = state.widgetLabelStates.get(targetEl);
    if (!lbl) {
      lbl = readInitialLabelState(targetEl);
      state.widgetLabelStates.set(targetEl, lbl);
    }
    return { targetEl, lbl, info };
  }

  function fitLabelReduceFontSize(targetEl, lbl) {
    if (!targetEl || !lbl || lbl.overflow !== 0) return;
    const baseSize = Math.max(6, Number(lbl.fontSize) || 16);
    targetEl.style.fontSize = `${baseSize}px`;
    if (targetEl.clientWidth <= 2 || targetEl.clientHeight <= 2) return;
    const isOverflowing = () =>
      targetEl.scrollWidth > targetEl.clientWidth + 1 || targetEl.scrollHeight > targetEl.clientHeight + 1;
    if (!isOverflowing()) return;

    let lo = 6;
    let hi = baseSize;
    let best = lo;
    for (let i = 0; i < 8; i++) {
      const mid = Math.round(((lo + hi) / 2) * 2) / 2;
      targetEl.style.fontSize = `${mid}px`;
      if (isOverflowing()) {
        hi = mid;
      } else {
        best = mid;
        lo = mid;
      }
      if (hi - lo <= 0.5) break;
    }
    targetEl.style.fontSize = `${Math.max(6, best)}px`;
  }

  function refitDescendantLabels(rootEl) {
    if (!rootEl) return;
    const check = node => {
      const lbl = state.widgetLabelStates.get(node);
      if (lbl && lbl.dirty && lbl.overflow === 0) {
        fitLabelReduceFontSize(node, lbl);
      }
    };
    check(rootEl);
    rootEl.querySelectorAll('*').forEach(check);
  }

  function applyWidgetLabelToDom(targetEl, lbl) {
    if (!targetEl || !lbl) return;
    snapshotLabelOriginals(targetEl);
    state.widgetLabelStates.set(targetEl, lbl);

    const aMul = clamp01((Number.isFinite(Number(lbl.alpha)) ? Number(lbl.alpha) : 100) / 100);
    const fs = Math.max(4, Number(lbl.fontSize) || 16);
    const orig = state.originalLabelStyles.get(targetEl) || {};

    targetEl.style.fontSize = `${fs}px`;
    targetEl.style.fontWeight = lbl.bold ? '700' : '400';
    targetEl.style.fontStyle = lbl.italic ? 'italic' : 'normal';
    targetEl.style.textDecoration = lbl.underline ? 'underline' : 'none';

    const ls = Number(lbl.lineSpacing) || 0;
    if (ls !== 0) {
      targetEl.style.lineHeight = `calc(1.2em + ${ls}px)`;
    } else {
      targetEl.style.lineHeight = orig.lineHeight || '';
    }

    // Horizontal alignment
    const csBefore = getComputedStyle(targetEl);
    const isFlex = csBefore.display.includes('flex');
    const isFlexCol = isFlex && csBefore.flexDirection.startsWith('column');
    if (lbl.alignH === 'fillH') {
      targetEl.style.textAlign = 'justify';
      targetEl.style.textAlignLast = 'justify';
    } else {
      targetEl.style.textAlign = lbl.alignH || 'left';
      targetEl.style.textAlignLast = '';
      if (isFlex) {
        const mapFlex = { left: 'flex-start', center: 'center', right: 'flex-end' };
        const fv = mapFlex[lbl.alignH] || 'center';
        if (isFlexCol) targetEl.style.alignItems = fv;
        else targetEl.style.justifyContent = fv;
      }
    }

    // Vertical alignment (only mutate layout display when explicitly edited)
    if (lbl._alignVEdited) {
      const mapV = { top: 'flex-start', middle: 'center', bottom: 'flex-end', fillV: 'stretch' };
      if (isFlex && !isFlexCol) {
        targetEl.style.alignItems = mapV[lbl.alignV] || 'center';
      } else {
        if (!isFlex) {
          targetEl.style.display = 'inline-flex';
          targetEl.style.flexDirection = 'column';
        }
        const mapColV = { top: 'flex-start', middle: 'center', bottom: 'flex-end', fillV: 'space-between' };
        targetEl.style.justifyContent = mapColV[lbl.alignV] || 'center';
      }
    }

    // Overflow mode: 0 = Reduce Font Size, 1 = Wrap around (Clamp), 2 = Overflow
    if (lbl.overflow === 2) {
      targetEl.style.overflow = 'visible';
      targetEl.style.whiteSpace = 'pre-wrap';
      targetEl.style.wordBreak = 'normal';
    } else {
      targetEl.style.overflow = 'hidden';
      targetEl.style.whiteSpace = 'pre-wrap';
      targetEl.style.wordBreak = 'break-word';
      if (lbl.overflow === 0) {
        fitLabelReduceFontSize(targetEl, lbl);
      }
    }

    // Color, Outline, Shadow & Gradient
    const hasSpriteBg =
      targetEl.hasAttribute('data-slice-id') ||
      targetEl.classList.contains('px-9slice') ||
      targetEl.classList.contains('px-sprite-box') ||
      targetEl.classList.contains('px-btn-square');
    const useGrad = Number(lbl.gradient) > 0 && !hasSpriteBg;

    const sx = Array.isArray(lbl.shadowOffset) ? Number(lbl.shadowOffset[0]) || 0 : 1;
    const sy = Array.isArray(lbl.shadowOffset) ? Number(lbl.shadowOffset[1]) || 0 : 1;
    const shCol = hexToRgba(lbl.shadowColor || '#000000', clamp01(lbl.shadowAlpha ?? 1) * aMul);
    const outW = Math.max(0, Number(lbl.outlineWidth) || 0);
    const outCol = hexToRgba(lbl.outlineColor || '#000000', clamp01(lbl.outlineAlpha ?? 1) * aMul);

    if (useGrad) {
      const dir = Number(lbl.gradient) === 2 ? '90deg' : '180deg';
      const topRgba = hexToRgba(lbl.gradientTop || '#FFFFFF', clamp01((lbl.gradientTopAlpha ?? 100) / 100) * aMul);
      const botRgba = hexToRgba(lbl.gradientBottom || '#FFFFFF', clamp01((lbl.gradientBottomAlpha ?? 100) / 100) * aMul);
      targetEl.style.setProperty('--px-label-grad-bg', `linear-gradient(${dir}, ${topRgba} 0%, ${botRgba} 100%)`);
      targetEl.classList.add('px-label-gradient');
      targetEl.style.textShadow = 'none';

      const filters = [];
      if (lbl.outline && outW > 0) {
        const dirs = [
          [-outW, -outW], [outW, -outW], [-outW, outW], [outW, outW],
          [0, -outW], [0, outW], [-outW, 0], [outW, 0],
        ];
        dirs.forEach(([dx, dy]) => filters.push(`drop-shadow(${dx}px ${dy}px 0 ${outCol})`));
      }
      if (lbl.shadow) {
        filters.push(`drop-shadow(${sx}px ${sy}px 0 ${shCol})`);
      }
      targetEl.style.filter = filters.length ? filters.join(' ') : orig.filter || '';
    } else {
      targetEl.classList.remove('px-label-gradient');
      targetEl.style.removeProperty('--px-label-grad-bg');
      targetEl.style.filter = orig.filter || '';
      targetEl.style.color = hexToRgba(lbl.color || '#FFFFFF', aMul);

      const shadows = [];
      if (lbl.outline && outW > 0) {
        const dirs = [
          [-outW, -outW], [0, -outW], [outW, -outW],
          [-outW, 0], [outW, 0],
          [-outW, outW], [0, outW], [outW, outW],
        ];
        if (outW >= 2.5) {
          const half = roundTfNum(outW / 2, 1);
          dirs.push([-half, -outW], [half, -outW], [-half, outW], [half, outW], [-outW, -half], [outW, -half], [-outW, half], [outW, half]);
        }
        dirs.forEach(([dx, dy]) => shadows.push(`${dx}px ${dy}px 0 ${outCol}`));
      }
      if (lbl.shadow) {
        shadows.push(`${sx}px ${sy}px 0 ${shCol}`);
      }
      targetEl.style.textShadow = shadows.length ? shadows.join(', ') : 'none';
    }
  }

  function saveWidgetLabelEdit(targetEl, lbl, persistToServer = false) {
    if (!targetEl || !lbl) return Promise.resolve({ ok: false });
    const pathKey = getElementCanvasPath(targetEl);
    if (pathKey) {
      const edits = loadUiEdits();
      edits.labelEdits[pathKey] = {
        color: normalizeHexColor(lbl.color, '#FFFFFF'),
        alpha: roundTfNum(clamp01((lbl.alpha ?? 100) / 100) * 100, 1),
        fontSize: roundTfNum(Math.max(4, Number(lbl.fontSize) || 16), 1),
        alignH: lbl.alignH || 'left',
        ...(lbl._alignVEdited ? { alignV: lbl.alignV || 'middle' } : {}),
        bold: Boolean(lbl.bold),
        italic: Boolean(lbl.italic),
        underline: Boolean(lbl.underline),
        lineSpacing: roundTfNum(Number(lbl.lineSpacing) || 0, 2),
        overflow: Number(lbl.overflow) || 0,
        shadow: Boolean(lbl.shadow),
        shadowColor: normalizeHexColor(lbl.shadowColor, '#000000'),
        shadowOffset: [
          roundTfNum(Array.isArray(lbl.shadowOffset) ? Number(lbl.shadowOffset[0]) || 0 : 1, 2),
          roundTfNum(Array.isArray(lbl.shadowOffset) ? Number(lbl.shadowOffset[1]) || 0 : 1, 2),
        ],
        shadowAlpha: roundTfNum(clamp01(lbl.shadowAlpha ?? 1), 3),
        outline: Boolean(lbl.outline),
        outlineColor: normalizeHexColor(lbl.outlineColor, '#000000'),
        outlineAlpha: roundTfNum(clamp01(lbl.outlineAlpha ?? 1), 3),
        outlineWidth: roundTfNum(Math.max(0, Number(lbl.outlineWidth) || 0), 2),
        gradient: Number(lbl.gradient) || 0,
        gradientTop: normalizeHexColor(lbl.gradientTop, '#FFFFFF'),
        gradientTopAlpha: roundTfNum(clamp01((lbl.gradientTopAlpha ?? 100) / 100) * 100, 1),
        gradientBottom: normalizeHexColor(lbl.gradientBottom, '#FFFFFF'),
        gradientBottomAlpha: roundTfNum(clamp01((lbl.gradientBottomAlpha ?? 100) / 100) * 100, 1),
      };
      saveUiEdits(edits);
    }
    if (persistToServer) return persistUiEditsToDisk();
    return Promise.resolve({ ok: true, method: 'browser-storage' });
  }

  function resetSingleElementLabel(el, edits) {
    const info = getEditableTextInfo(el);
    const targetEl = (info && info.targetEl) || el;
    if (!targetEl) return;
    const pathKey = getElementCanvasPath(targetEl);
    if (pathKey && edits) {
      if (edits.labelEdits && edits.labelEdits[pathKey]) delete edits.labelEdits[pathKey];
      if (edits.textEdits && edits.textEdits[pathKey] !== undefined) delete edits.textEdits[pathKey];
    }
    if (state.originalWidgetText.has(targetEl)) {
      setTargetElementText(targetEl, state.originalWidgetText.get(targetEl));
    }
    const orig = state.originalLabelStyles.get(targetEl);
    if (orig) {
      targetEl.style.color = orig.color;
      targetEl.style.fontSize = orig.fontSize;
      targetEl.style.fontWeight = orig.fontWeight;
      targetEl.style.fontStyle = orig.fontStyle;
      targetEl.style.textDecoration = orig.textDecoration;
      targetEl.style.lineHeight = orig.lineHeight;
      targetEl.style.textAlign = orig.textAlign;
      targetEl.style.textAlignLast = orig.textAlignLast;
      targetEl.style.display = orig.display;
      targetEl.style.flexDirection = orig.flexDirection;
      targetEl.style.justifyContent = orig.justifyContent;
      targetEl.style.alignItems = orig.alignItems;
      targetEl.style.overflow = orig.overflow;
      targetEl.style.whiteSpace = orig.whiteSpace;
      targetEl.style.wordBreak = orig.wordBreak;
      targetEl.style.textShadow = orig.textShadow;
      targetEl.style.filter = orig.filter;
      if (orig.gradBg) targetEl.style.setProperty('--px-label-grad-bg', orig.gradBg);
      else targetEl.style.removeProperty('--px-label-grad-bg');
      targetEl.classList.toggle('px-label-gradient', Boolean(orig.hadGradClass));
    }
    state.widgetLabelStates.delete(targetEl);
  }

  function exportLabelCraftlandJson(targetEl, lbl) {
    const info = getEditableTextInfo(targetEl);
    return {
      component: 'HudLabelWidget',
      'text.value': info ? info.currentText : '',
      'text.color': normalizeHexColor(lbl.color, '#FFFFFF'),
      alpha: roundTfNum(lbl.alpha ?? 100, 1),
      'text.fontSize': Math.round(lbl.fontSize || 16),
      'text.alignment.h': lbl.alignH || 'left',
      'text.alignment.v': lbl.alignV || 'middle',
      isBold: Boolean(lbl.bold),
      isItalic: Boolean(lbl.italic),
      isUnderline: Boolean(lbl.underline),
      'text.lineSpacing': roundTfNum(lbl.lineSpacing || 0, 2),
      'text.overflow': Number(lbl.overflow) || 0,
      'text.shadow': Boolean(lbl.shadow),
      'text.shadowColor': normalizeHexColor(lbl.shadowColor, '#000000'),
      shadowOffset: { x: lbl.shadowOffset ? lbl.shadowOffset[0] : 1, y: lbl.shadowOffset ? lbl.shadowOffset[1] : 1 },
      shadowAlpha: roundTfNum(lbl.shadowAlpha ?? 1, 3),
      isApplyOutline: Boolean(lbl.outline),
      outlineColor: normalizeHexColor(lbl.outlineColor, '#000000'),
      outlineAlpha: roundTfNum(lbl.outlineAlpha ?? 1, 3),
      outlineOffset: roundTfNum(lbl.outlineWidth ?? 1, 2),
      gradient: Number(lbl.gradient) || 0,
      gradientTop: normalizeHexColor(lbl.gradientTop, '#FFFFFF'),
      gradientTopAlpha: roundTfNum(lbl.gradientTopAlpha ?? 100, 1),
      gradientBottom: normalizeHexColor(lbl.gradientBottom, '#FFFFFF'),
      gradientBottomAlpha: roundTfNum(lbl.gradientBottomAlpha ?? 100, 1),
    };
  }

  /* ---- Craftland UI Widget Image & UI Widget Button ---- */

  function snapshotImageOriginals(targetEl) {
    if (!targetEl || state.originalImageStyles.has(targetEl)) return;
    state.originalImageStyles.set(targetEl, {
      opacity: targetEl.style.opacity || '',
      hadPx9: targetEl.classList.contains('px-9slice'),
      hadPx9NoCenter: targetEl.classList.contains('px-9slice-no-center'),
      hadSimple: targetEl.classList.contains('px-img-simple'),
      hadTiled: targetEl.classList.contains('px-img-tiled'),
      hadFit: targetEl.classList.contains('px-img-fit'),
      hadFilled: targetEl.classList.contains('px-img-filled'),
      hadFlip: targetEl.classList.contains('px-flip-active'),
      hadPassthrough: targetEl.classList.contains('px-btn-passthrough'),
      hadGrad: targetEl.classList.contains('px-has-grad'),
      hadImgGrad: targetEl.classList.contains('px-img-grad'),
      dataTint: targetEl.hasAttribute('data-tint') ? targetEl.getAttribute('data-tint') : null,
      dataTintMode: targetEl.hasAttribute('data-tint-mode') ? targetEl.getAttribute('data-tint-mode') : null,
    });
  }

  function inferInitialFillType(targetEl) {
    if (!targetEl) return 0;
    if (targetEl.classList.contains('px-img-tiled')) return 2;
    if (targetEl.classList.contains('px-img-filled')) return 3;
    if (targetEl.classList.contains('px-img-fit')) return 5;
    if (targetEl.classList.contains('px-img-simple')) return 0;
    if (targetEl.classList.contains('px-9slice')) return 1;
    if (targetEl.classList.contains('px-icon') || targetEl.tagName === 'IMG') return 5;
    return 0;
  }

  function readInitialImageState(targetEl) {
    const cs = getComputedStyle(targetEl);
    const rawTint = (targetEl.getAttribute('data-tint') || '').trim();
    const rawTintMode = (targetEl.getAttribute('data-tint-mode') || 'auto').trim().toLowerCase();
    const op = parseFloat(cs.opacity || '1');
    return {
      color: rawTint ? normalizeHexColor(rawTint, '#FFFFFF') : '#FFFFFF',
      tintMode: ['auto', 'mask', 'multiply'].includes(rawTintMode) ? rawTintMode : 'auto',
      alpha: Math.round(clamp01(Number.isFinite(op) ? op : 1) * 100),
      flipX: false,
      flipY: false,
      fillType: inferInitialFillType(targetEl), // 0 Simple, 1 9-Grid Pattern, 2 Tiled, 3 Filled, 5 Fit
      centerInvisible: targetEl.classList.contains('px-9slice-no-center'),
      fillDir: 0, // 0 Horizontal, 1 Vertical, 2 Radial90, 3 Radial180, 4 Radial360
      fillAmount: 1,
      invertFill: false,
      gradient: 0, // 0 None, 1 Vertical Gradient, 2 Horizontal Gradient
      gradientTop: '#FFFFFF',
      gradientTopAlpha: 100,
      gradientBottom: '#FFFFFF',
      gradientBottomAlpha: 100,
      pressedColor: '#C5C5C5',
      disableColor: '#808080',
      passthrough: targetEl.classList.contains('px-btn-passthrough'),
      dirty: false,
    };
  }

  function getWidgetImageState(targetEl) {
    if (!targetEl) return null;
    let img = state.widgetImageStates.get(targetEl);
    if (!img) {
      img = readInitialImageState(targetEl);
      state.widgetImageStates.set(targetEl, img);
    }
    return img;
  }

  function computeFilledMaskStyles(fillDir, fillAmount, invertFill) {
    const amt = clamp01(Number.isFinite(Number(fillAmount)) ? Number(fillAmount) : 1);
    const pct = roundTfNum((1 - amt) * 100, 2);
    if (fillDir === 0) {
      // Horizontal
      return {
        clip: invertFill ? `inset(0 0 0 ${pct}%)` : `inset(0 ${pct}% 0 0)`,
        mask: 'none',
      };
    }
    if (fillDir === 1) {
      // Vertical (default bottom-up like Craftland/NGUI)
      return {
        clip: invertFill ? `inset(0 0 ${pct}% 0)` : `inset(${pct}% 0 0 0)`,
        mask: 'none',
      };
    }
    if (fillDir === 2) {
      // Radial 90°
      const deg = roundTfNum(amt * 90, 2);
      const mask = invertFill
        ? `conic-gradient(from 0deg at 0% 100%, transparent 0deg ${roundTfNum(90 - deg, 2)}deg, #000 ${roundTfNum(90 - deg, 2)}deg 90deg, transparent 90deg)`
        : `conic-gradient(from 0deg at 0% 100%, #000 0deg ${deg}deg, transparent ${deg}deg)`;
      return { clip: 'none', mask };
    }
    if (fillDir === 3) {
      // Radial 180°
      const deg = roundTfNum(amt * 180, 2);
      const mask = invertFill
        ? `conic-gradient(from -90deg at 50% 100%, transparent 0deg ${roundTfNum(180 - deg, 2)}deg, #000 ${roundTfNum(180 - deg, 2)}deg 180deg, transparent 180deg)`
        : `conic-gradient(from -90deg at 50% 100%, #000 0deg ${deg}deg, transparent ${deg}deg)`;
      return { clip: 'none', mask };
    }
    // Radial 360°
    const deg = roundTfNum(amt * 360, 2);
    const mask = invertFill
      ? `conic-gradient(from 0deg at 50% 50%, transparent 0deg ${roundTfNum(360 - deg, 2)}deg, #000 ${roundTfNum(360 - deg, 2)}deg 360deg)`
      : `conic-gradient(from 0deg at 50% 50%, #000 0deg ${deg}deg, transparent ${deg}deg)`;
    return { clip: 'none', mask };
  }

  function applyWidgetImageToDom(targetEl, img, hostEl = null) {
    if (!targetEl || !img) return;
    snapshotWidgetOriginals(targetEl);
    snapshotImageOriginals(targetEl);
    state.widgetImageStates.set(targetEl, img);

    const orig = state.originalImageStyles.get(targetEl) || {};
    const sliceId = targetEl.getAttribute('data-slice-id') || '';

    // Alpha
    const alphaVal = clamp01((Number.isFinite(Number(img.alpha)) ? Number(img.alpha) : 100) / 100);
    if (alphaVal < 0.999) {
      targetEl.style.opacity = String(roundTfNum(alphaVal, 3));
    } else {
      targetEl.style.opacity = orig.opacity || '';
    }

    // Flip (H / V)
    const flipped = Boolean(img.flipX || img.flipY);
    targetEl.classList.toggle('px-flip-active', flipped);
    if (flipped) {
      targetEl.style.setProperty('--px-flip-x', img.flipX ? '-1' : '1');
      targetEl.style.setProperty('--px-flip-y', img.flipY ? '-1' : '1');
    } else {
      targetEl.style.removeProperty('--px-flip-x');
      targetEl.style.removeProperty('--px-flip-y');
    }

    // Fill Type: 0 Simple, 1 9-Grid Pattern, 2 Tiled, 3 Filled, 5 Fit
    targetEl.classList.remove('px-img-simple', 'px-img-tiled', 'px-img-fit', 'px-img-filled', 'px-9slice-no-center');
    targetEl.style.removeProperty('--px-fill-clip');
    targetEl.style.removeProperty('--px-fill-mask');

    const ft = Number(img.fillType);
    if (ft === 1) {
      if (targetEl.tagName !== 'IMG') {
        targetEl.classList.add('px-9slice');
      }
      targetEl.classList.toggle('px-9slice-no-center', Boolean(img.centerInvisible));
      if (sliceId) applySliceToElement(targetEl, sliceId);
    } else if (ft === 0) {
      targetEl.classList.add('px-img-simple');
    } else if (ft === 2) {
      targetEl.classList.add('px-img-tiled');
    } else if (ft === 3) {
      targetEl.classList.add('px-img-filled');
      const fm = computeFilledMaskStyles(Number(img.fillDir) || 0, img.fillAmount ?? 1, Boolean(img.invertFill));
      targetEl.style.setProperty('--px-fill-clip', fm.clip);
      targetEl.style.setProperty('--px-fill-mask', fm.mask);
    } else if (ft === 5) {
      targetEl.classList.add('px-img-fit');
    }

    // Color Tint (respects pressed state in Interactive mode)
    const interactivePressed = !isWireframeMode() && !isEditMode() && targetEl.classList.contains('is-pressed');
    const activeTint = interactivePressed ? img.pressedColor || '#C5C5C5' : img.color || '#FFFFFF';
    applyEffectiveColorTint(targetEl, sliceId, activeTint, img.tintMode || 'auto');

    // Gradient overlay
    const existingGrad = Array.from(targetEl.children).find(c => c.classList && c.classList.contains('px-grad-overlay'));
    if (Number(img.gradient) > 0) {
      const dir = Number(img.gradient) === 2 ? '90deg' : '180deg';
      const topRgba = hexToRgba(img.gradientTop || '#FFFFFF', clamp01((img.gradientTopAlpha ?? 100) / 100));
      const botRgba = hexToRgba(img.gradientBottom || '#FFFFFF', clamp01((img.gradientBottomAlpha ?? 100) / 100));
      targetEl.style.setProperty('--px-grad-bg', `linear-gradient(${dir}, ${topRgba} 0%, ${botRgba} 100%)`);
      if (targetEl.tagName === 'IMG') {
        targetEl.classList.add('px-img-grad');
      } else {
        targetEl.classList.add('px-has-grad');
        if (!existingGrad) {
          const ov = document.createElement('div');
          ov.className = 'px-grad-overlay';
          ov.setAttribute('aria-hidden', 'true');
          targetEl.insertBefore(ov, targetEl.firstChild);
        }
      }
    } else {
      targetEl.classList.remove('px-has-grad', 'px-img-grad');
      targetEl.style.removeProperty('--px-grad-bg');
      if (existingGrad) existingGrad.remove();
    }

    // Passthrough (DisableCollider on Buttons)
    const passthrough = Boolean(img.passthrough);
    targetEl.classList.toggle('px-btn-passthrough', passthrough);
    if (hostEl && hostEl !== targetEl) {
      hostEl.classList.toggle('px-btn-passthrough', passthrough);
    }
  }

  function saveWidgetImageEdit(targetEl, img, persistToServer = false) {
    if (!targetEl || !img) return Promise.resolve({ ok: false });
    const pathKey = getElementCanvasPath(targetEl);
    if (pathKey) {
      const edits = loadUiEdits();
      edits.imageEdits[pathKey] = {
        color: normalizeHexColor(img.color, '#FFFFFF'),
        tintMode: img.tintMode || 'auto',
        alpha: roundTfNum(clamp01((img.alpha ?? 100) / 100) * 100, 1),
        flipX: Boolean(img.flipX),
        flipY: Boolean(img.flipY),
        fillType: Number.isFinite(Number(img.fillType)) ? Number(img.fillType) : 0,
        centerInvisible: Boolean(img.centerInvisible),
        fillDir: Number(img.fillDir) || 0,
        fillAmount: roundTfNum(clamp01(img.fillAmount ?? 1), 3),
        invertFill: Boolean(img.invertFill),
        gradient: Number(img.gradient) || 0,
        gradientTop: normalizeHexColor(img.gradientTop, '#FFFFFF'),
        gradientTopAlpha: roundTfNum(clamp01((img.gradientTopAlpha ?? 100) / 100) * 100, 1),
        gradientBottom: normalizeHexColor(img.gradientBottom, '#FFFFFF'),
        gradientBottomAlpha: roundTfNum(clamp01((img.gradientBottomAlpha ?? 100) / 100) * 100, 1),
        pressedColor: normalizeHexColor(img.pressedColor, '#C5C5C5'),
        disableColor: normalizeHexColor(img.disableColor, '#808080'),
        passthrough: Boolean(img.passthrough),
      };
      if (edits.tintEdits && edits.tintEdits[pathKey]) {
        delete edits.tintEdits[pathKey];
      }
      saveUiEdits(edits);
    }
    if (persistToServer) return persistUiEditsToDisk();
    return Promise.resolve({ ok: true, method: 'browser-storage' });
  }

  function resetSingleElementImage(targetEl, edits, hostEl = null) {
    if (!targetEl) return;
    const pathKey = getElementCanvasPath(targetEl);
    if (pathKey && edits) {
      if (edits.imageEdits && edits.imageEdits[pathKey]) delete edits.imageEdits[pathKey];
      if (edits.tintEdits && edits.tintEdits[pathKey]) delete edits.tintEdits[pathKey];
    }
    resetSingleElementSpriteAttrs(targetEl, edits || { spriteEdits: {} });
    const orig = state.originalImageStyles.get(targetEl);
    if (orig) {
      targetEl.style.opacity = orig.opacity;
      targetEl.classList.toggle('px-9slice', Boolean(orig.hadPx9));
      targetEl.classList.toggle('px-9slice-no-center', Boolean(orig.hadPx9NoCenter));
      targetEl.classList.toggle('px-img-simple', Boolean(orig.hadSimple));
      targetEl.classList.toggle('px-img-tiled', Boolean(orig.hadTiled));
      targetEl.classList.toggle('px-img-fit', Boolean(orig.hadFit));
      targetEl.classList.toggle('px-img-filled', Boolean(orig.hadFilled));
      targetEl.classList.toggle('px-flip-active', Boolean(orig.hadFlip));
      targetEl.classList.toggle('px-btn-passthrough', Boolean(orig.hadPassthrough));
      targetEl.classList.toggle('px-has-grad', Boolean(orig.hadGrad));
      targetEl.classList.toggle('px-img-grad', Boolean(orig.hadImgGrad));
      if (orig.dataTint === null) targetEl.removeAttribute('data-tint');
      else targetEl.setAttribute('data-tint', orig.dataTint);
      if (orig.dataTintMode === null) targetEl.removeAttribute('data-tint-mode');
      else targetEl.setAttribute('data-tint-mode', orig.dataTintMode);
    } else {
      targetEl.style.opacity = '';
      targetEl.classList.remove(
        'px-9slice-no-center',
        'px-img-simple',
        'px-img-tiled',
        'px-img-fit',
        'px-img-filled',
        'px-flip-active',
        'px-btn-passthrough',
        'px-has-grad',
        'px-img-grad'
      );
    }
    targetEl.style.removeProperty('--px-flip-x');
    targetEl.style.removeProperty('--px-flip-y');
    targetEl.style.removeProperty('--px-fill-clip');
    targetEl.style.removeProperty('--px-fill-mask');
    targetEl.style.removeProperty('--px-grad-bg');
    const existingGrad = Array.from(targetEl.children).find(c => c.classList && c.classList.contains('px-grad-overlay'));
    if (existingGrad) existingGrad.remove();
    if (hostEl && hostEl !== targetEl) {
      hostEl.classList.remove('px-btn-passthrough');
    }
    state.widgetImageStates.delete(targetEl);
    applyTintToElement(targetEl, targetEl.getAttribute('data-slice-id'));
  }

  function exportImageCraftlandJson(targetEl, img, isBtn = false) {
    const sliceId = targetEl.getAttribute('data-slice-id') || '';
    const fillMap = { 0: 0, 1: 1, 2: 2, 3: 3, 5: 4 };
    if (isBtn) {
      return {
        component: 'HudButtonWidget',
        'button.spriteName': sliceId,
        'button.normal': normalizeHexColor(img.color, '#FFFFFF'),
        alpha: roundTfNum(img.alpha ?? 100, 1),
        'button.pressed': normalizeHexColor(img.pressedColor, '#C5C5C5'),
        'button.disabled': normalizeHexColor(img.disableColor, '#808080'),
        pressedSprite: targetEl.getAttribute('data-slice-pressed') || '',
        'button.fillType': fillMap[img.fillType] ?? 0,
        centerInvisible: Boolean(img.centerInvisible),
        flipX: Boolean(img.flipX),
        flipY: Boolean(img.flipY),
        'button.disableCollider': Boolean(img.passthrough),
        ...(Number(img.fillType) === 3
          ? { fillDir: Number(img.fillDir) || 0, fillAmount: roundTfNum(img.fillAmount ?? 1, 3), invertFill: Boolean(img.invertFill) }
          : {}),
        gradient: Number(img.gradient) || 0,
        gradientTop: normalizeHexColor(img.gradientTop, '#FFFFFF'),
        gradientTopAlpha: roundTfNum(img.gradientTopAlpha ?? 100, 1),
        gradientBottom: normalizeHexColor(img.gradientBottom, '#FFFFFF'),
        gradientBottomAlpha: roundTfNum(img.gradientBottomAlpha ?? 100, 1),
      };
    }
    return {
      component: 'HudImageWidget',
      'image.source': sliceId,
      'image.color': normalizeHexColor(img.color, '#FFFFFF'),
      alpha: roundTfNum(img.alpha ?? 100, 1),
      'image.reverse.x': Boolean(img.flipX),
      'image.reverse.y': Boolean(img.flipY),
      'image.fillType': fillMap[img.fillType] ?? 0,
      centerInvisible: Boolean(img.centerInvisible),
      ...(Number(img.fillType) === 3
        ? { fillDir: Number(img.fillDir) || 0, fillAmount: roundTfNum(img.fillAmount ?? 1, 3), invertFill: Boolean(img.invertFill) }
        : {}),
      gradient: Number(img.gradient) || 0,
      gradientTop: normalizeHexColor(img.gradientTop, '#FFFFFF'),
      gradientTopAlpha: roundTfNum(img.gradientTopAlpha ?? 100, 1),
      gradientBottom: normalizeHexColor(img.gradientBottom, '#FFFFFF'),
      gradientBottomAlpha: roundTfNum(img.gradientBottomAlpha ?? 100, 1),
    };
  }

  /* ---- Reusable Craftland Inspector Field Builders ---- */

  function renderClColorRow(opts) {
    const { scope, field, label, hex, alphaField, alphaVal, title } = opts;
    const normHex = normalizeHexColor(hex, '#FFFFFF');
    const alphaHtml = alphaField
      ? `<div class="wb-cl-alpha-inline">
           <input type="number" min="0" max="100" step="1" value="${Math.round(alphaVal ?? 100)}" data-${scope}-field="${alphaField}" aria-label="${escapeHtml(label)} Alpha">
           <span>%</span>
         </div>`
      : '';
    return `
      <div class="wb-cl-row">
        <span class="wb-cl-label" title="${escapeHtml(title || label)}">${escapeHtml(label)}</span>
        <div class="wb-cl-color-wrap">
          <div class="wb-cl-color-box">
            <span class="wb-cl-swatch" style="background:${normHex};">
              <input type="color" value="${normHex}" data-${scope}-color="${field}" aria-label="${escapeHtml(label)} Color Picker">
            </span>
            <input type="text" class="wb-cl-hex" value="${normHex}" maxlength="7" data-${scope}-hex="${field}" aria-label="${escapeHtml(label)} Hex">
          </div>
          ${alphaHtml}
          <button type="button" class="wb-cl-eyedropper" data-cl-eyedropper="${scope}:${field}" title="Pick color from screen" aria-label="Eyedropper for ${escapeHtml(label)}">
            ${CL_EYEDROPPER_SVG}
          </button>
        </div>
      </div>
    `;
  }

  function renderClSliderRow(opts) {
    const { scope, field, label, value, min, max, step, suffix, decimals, title } = opts;
    const numVal = Number.isFinite(Number(value)) ? Number(value) : max;
    const pct = roundTfNum(clamp01((numVal - min) / Math.max(0.0001, max - min)) * 100, 2);
    const displayVal = decimals > 0 ? formatTfVal(numVal, decimals) : String(Math.round(numVal));
    return `
      <div class="wb-cl-row">
        <span class="wb-cl-label" title="${escapeHtml(title || label)}">${escapeHtml(label)}</span>
        <div class="wb-cl-slider-row">
          <input
            type="range"
            class="wb-cl-slider"
            min="${min}"
            max="${max}"
            step="${step}"
            value="${numVal}"
            style="--pct:${pct}%;"
            data-${scope}-slider="${field}"
            aria-label="${escapeHtml(label)} Slider"
          >
          <div class="wb-cl-num-box">
            <input
              type="number"
              min="${min}"
              max="${max}"
              step="${step}"
              value="${displayVal}"
              data-${scope}-field="${field}"
              aria-label="${escapeHtml(label)} Value"
            >
            ${suffix ? `<span class="wb-cl-num-suffix">${escapeHtml(suffix)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderClGradientSection(scope, cardKey, obj, collapsed) {
    const gradType = Number(obj.gradient) || 0;
    const isHoriz = gradType === 2;
    const showStops = gradType > 0;
    return `
      <div class="wb-cl-sub">
        <button type="button" class="wb-cl-subhead" data-cl-grad-toggle="${cardKey}" aria-expanded="${collapsed ? 'false' : 'true'}">
          <span class="wb-tf-caret">${collapsed ? '▸' : '▾'}</span>
          <span>Gradient</span>
        </button>
        <div class="wb-cl-subbody${collapsed ? ' is-collapsed' : ''}" data-cl-grad-body="${cardKey}">
          <div class="wb-cl-row">
            <span class="wb-cl-label">Gradient Type</span>
            <select class="wb-cl-select" data-${scope}-field="gradient" aria-label="Gradient Type">
              <option value="0" ${gradType === 0 ? 'selected' : ''}>None</option>
              <option value="1" ${gradType === 1 ? 'selected' : ''}>Vertical Gradient</option>
              <option value="2" ${gradType === 2 ? 'selected' : ''}>Horizontal Gradient</option>
            </select>
          </div>
          <div class="wb-cl-conditional${showStops ? '' : ' is-hidden'}" data-cl-cond="${cardKey}-grad-stops">
            ${renderClColorRow({
              scope,
              field: 'gradientTop',
              label: isHoriz ? 'Left' : 'Top',
              hex: obj.gradientTop || '#FFFFFF',
              alphaField: 'gradientTopAlpha',
              alphaVal: obj.gradientTopAlpha ?? 100,
            })}
            ${renderClColorRow({
              scope,
              field: 'gradientBottom',
              label: isHoriz ? 'Right' : 'Bottom',
              hex: obj.gradientBottom || '#FFFFFF',
              alphaField: 'gradientBottomAlpha',
              alphaVal: obj.gradientBottomAlpha ?? 100,
            })}
          </div>
        </div>
      </div>
    `;
  }

  function renderClSpriteWidget(sliceId, attrName, options = {}) {
    const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
    const rec = resolved ? resolved.rec : null;
    const compact = Boolean(options.compact);
    const allowClear = Boolean(options.allowClear);
    const displayName = rec ? rec.id : sliceId || '';

    const barHtml = `
      <div class="wb-cl-sprite-bar${compact ? ' wb-cl-sprite-bar--compact' : ''}">
        <span class="wb-cl-sprite-mini">
          ${resolved ? `<img src="${escapeHtml(resolved.url)}" alt="${escapeHtml(sliceId)}">` : '—'}
        </span>
        <input
          type="text"
          class="wb-cl-sprite-name"
          list="wb-catalog-slices-list"
          value="${escapeHtml(displayName)}"
          placeholder="${compact ? 'None (fallback)' : 'Slice ID...'}"
          data-cl-sprite-input="${attrName}"
          title="${rec ? escapeHtml(rec.source_file) : 'Enter Slice ID or click picker'}"
          aria-label="Sprite Slice ID (${attrName})"
        >
        ${
          allowClear && sliceId
            ? `<button type="button" class="wb-cl-sprite-clear-btn" data-cl-sprite-clear="${attrName}" title="Clear sprite" aria-label="Clear sprite">×</button>`
            : ''
        }
        <button type="button" class="wb-cl-sprite-pick-btn" data-cl-sprite-pick="${attrName}" title="Choose Sprite…" aria-label="Choose Sprite">
          ${CL_TARGET_PICK_SVG}
        </button>
      </div>
    `;

    if (compact) return barHtml;

    return `
      <div class="wb-cl-sprite-widget">
        ${barHtml}
        <div class="wb-cl-sprite-preview" data-cl-sprite-pick="${attrName}" title="Click to choose sprite">
          ${
            resolved
              ? `<img src="${escapeHtml(resolved.url)}" alt="${escapeHtml(sliceId)}">`
              : '<span class="wb-cl-sprite-empty">No sprite assigned</span>'
          }
          ${rec ? `<span class="wb-cl-sprite-dim">${rec.width}×${rec.height}</span>` : ''}
          ${
            sliceId && rec
              ? `<button type="button" class="wb-cl-edit-s9-link" data-insp-edit-resource-s9="${escapeHtml(sliceId)}" title="Edit 9-slice borders in Resource Editor">Edit 9-Slice →</button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderLabelComponentCard(el) {
    const bundle = getWidgetLabelState(el);
    if (!bundle) return '';
    const { lbl, info } = bundle;
    const isCollapsed = Boolean(state.labelCollapsed);
    const isMenuOpen = Boolean(state.labelMenuOpen);
    const currentText = info ? info.currentText : '';
    const shX = Array.isArray(lbl.shadowOffset) ? lbl.shadowOffset[0] : 1;
    const shY = Array.isArray(lbl.shadowOffset) ? lbl.shadowOffset[1] : 1;

    return `
      <div class="wb-insp-card wb-cl-card" data-cl-card="label">
        <div class="wb-tf-head">
          <button type="button" class="wb-tf-toggle" data-cl-toggle="label" aria-expanded="${isCollapsed ? 'false' : 'true'}">
            <span class="wb-tf-caret">${isCollapsed ? '▸' : '▾'}</span>
            <span>UI Widget Label</span>
          </button>
          <div class="wb-tf-menu-wrap">
            <button type="button" class="wb-tf-dots-btn${isMenuOpen ? ' is-open' : ''}" data-cl-menu-toggle="label" title="UI Widget Label Actions" aria-label="UI Widget Label Actions">⋯</button>
            <div class="wb-tf-menu-dropdown${isMenuOpen ? ' is-open' : ''}" id="wb-cl-menu-label">
              <button type="button" class="wb-tf-menu-item" data-cl-menu-action="label:copy">Copy Craftland JSON</button>
              <div class="wb-tf-menu-sep"></div>
              <button type="button" class="wb-tf-menu-item wb-tf-menu-item--danger" data-cl-menu-action="label:reset">Reset Label</button>
            </div>
          </div>
        </div>

        <div class="wb-cl-body${isCollapsed ? ' is-collapsed' : ''}" data-cl-body="label">
          <div class="wb-cl-row wb-cl-row--top">
            <span class="wb-cl-label">Content</span>
            <textarea id="wb-insp-text-input" class="wb-cl-textarea" rows="2" placeholder="Enter label text...">${escapeHtml(currentText)}</textarea>
          </div>

          ${renderClColorRow({ scope: 'lbl', field: 'color', label: 'Color', hex: lbl.color })}

          ${renderClSliderRow({
            scope: 'lbl',
            field: 'alpha',
            label: 'Alpha',
            value: lbl.alpha,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
            decimals: 0,
          })}

          <div class="wb-cl-row">
            <span class="wb-cl-label">Font Size</span>
            <div class="wb-cl-icon-num">
              <span class="wb-cl-prefix-icon" aria-hidden="true">T</span>
              <input type="number" class="wb-cl-stepper-input" min="4" max="256" step="1" value="${Math.round(lbl.fontSize || 16)}" data-lbl-field="fontSize" aria-label="Font Size">
            </div>
          </div>

          <div class="wb-cl-row wb-cl-row--top">
            <span class="wb-cl-label">Text Align</span>
            <div class="wb-cl-ctrl">
              <div class="wb-cl-seg-row" role="group" aria-label="Horizontal Alignment">
                ${['left', 'center', 'right', 'fillH']
                  .map(
                    key => `<button type="button" class="wb-cl-seg-btn${lbl.alignH === key ? ' is-active' : ''}" data-lbl-align-h="${key}" title="Align ${key}" aria-pressed="${lbl.alignH === key ? 'true' : 'false'}">${CL_ALIGN_H_SVGS[key]}</button>`
                  )
                  .join('')}
              </div>
              <div class="wb-cl-seg-row" role="group" aria-label="Vertical Alignment">
                ${['top', 'middle', 'bottom', 'fillV']
                  .map(
                    key => `<button type="button" class="wb-cl-seg-btn${lbl.alignV === key ? ' is-active' : ''}" data-lbl-align-v="${key}" title="Vertical ${key}" aria-pressed="${lbl.alignV === key ? 'true' : 'false'}">${CL_ALIGN_V_SVGS[key]}</button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div class="wb-cl-row">
            <span class="wb-cl-label">Font</span>
            <div class="wb-cl-seg-row" role="group" aria-label="Font Style">
              <button type="button" class="wb-cl-seg-btn${lbl.bold ? ' is-active' : ''}" data-lbl-font-toggle="bold" aria-pressed="${lbl.bold ? 'true' : 'false'}" title="Bold"><strong>B</strong></button>
              <button type="button" class="wb-cl-seg-btn${lbl.italic ? ' is-active' : ''}" data-lbl-font-toggle="italic" aria-pressed="${lbl.italic ? 'true' : 'false'}" title="Italic"><em>I</em></button>
              <button type="button" class="wb-cl-seg-btn${lbl.underline ? ' is-active' : ''}" data-lbl-font-toggle="underline" aria-pressed="${lbl.underline ? 'true' : 'false'}" title="Underline"><span style="text-decoration:underline;">U</span></button>
            </div>
          </div>

          <div class="wb-cl-row">
            <span class="wb-cl-label">Line Spacing</span>
            <div class="wb-cl-icon-num">
              <span class="wb-cl-prefix-icon" aria-hidden="true">${CL_LINE_SPACE_SVG}</span>
              <input type="number" class="wb-cl-stepper-input" min="-64" max="128" step="1" value="${escapeHtml(formatTfVal(lbl.lineSpacing || 0, 1))}" data-lbl-field="lineSpacing" aria-label="Line Spacing">
            </div>
          </div>

          <div class="wb-cl-row">
            <span class="wb-cl-label">Overflow</span>
            <select class="wb-cl-select" data-lbl-field="overflow" aria-label="Overflow">
              <option value="0" ${Number(lbl.overflow) === 0 ? 'selected' : ''}>Reduce Font Size</option>
              <option value="1" ${Number(lbl.overflow) === 1 ? 'selected' : ''}>Wrap around</option>
              <option value="2" ${Number(lbl.overflow) === 2 ? 'selected' : ''}>Overflow</option>
            </select>
          </div>

          <div class="wb-cl-row">
            <span class="wb-cl-label">Is Apply Shadow</span>
            <input type="checkbox" class="wb-cl-check" data-lbl-field="shadow" ${lbl.shadow ? 'checked' : ''} aria-label="Is Apply Shadow">
          </div>

          <div class="wb-cl-conditional${lbl.shadow ? '' : ' is-hidden'}" data-cl-cond="label-shadow">
            ${renderClColorRow({ scope: 'lbl', field: 'shadowColor', label: 'Shadow Color', hex: lbl.shadowColor })}
            <div class="wb-cl-row">
              <span class="wb-cl-label">Shadow Offset</span>
              <div class="wb-tf-vec2">
                <label class="wb-tf-axis-field is-x" data-cl-scrub="shadowOffsetX">
                  <span class="wb-tf-scrub-edge" data-cl-scrub-handle="shadowOffsetX" title="Drag left/right to adjust Shadow Offset X"></span>
                  <span class="wb-tf-axis-tag">X</span>
                  <input type="number" step="1" value="${escapeHtml(formatTfVal(shX, 1))}" data-lbl-field="shadowOffsetX" aria-label="Shadow Offset X">
                </label>
                <label class="wb-tf-axis-field is-y" data-cl-scrub="shadowOffsetY">
                  <span class="wb-tf-scrub-edge" data-cl-scrub-handle="shadowOffsetY" title="Drag left/right to adjust Shadow Offset Y"></span>
                  <span class="wb-tf-axis-tag">Y</span>
                  <input type="number" step="1" value="${escapeHtml(formatTfVal(shY, 1))}" data-lbl-field="shadowOffsetY" aria-label="Shadow Offset Y">
                </label>
              </div>
            </div>
            ${renderClSliderRow({
              scope: 'lbl',
              field: 'shadowAlpha',
              label: 'Shadow Alpha',
              value: lbl.shadowAlpha,
              min: 0,
              max: 1,
              step: 0.05,
              suffix: '',
              decimals: 2,
            })}
          </div>

          <div class="wb-cl-row">
            <span class="wb-cl-label">Is Apply Outline</span>
            <input type="checkbox" class="wb-cl-check" data-lbl-field="outline" ${lbl.outline ? 'checked' : ''} aria-label="Is Apply Outline">
          </div>

          <div class="wb-cl-conditional${lbl.outline ? '' : ' is-hidden'}" data-cl-cond="label-outline">
            ${renderClColorRow({ scope: 'lbl', field: 'outlineColor', label: 'Outline Color', hex: lbl.outlineColor })}
            ${renderClSliderRow({
              scope: 'lbl',
              field: 'outlineAlpha',
              label: 'Outline Alpha',
              title: 'The transparency of the outline',
              value: lbl.outlineAlpha,
              min: 0,
              max: 1,
              step: 0.05,
              suffix: '',
              decimals: 2,
            })}
            <div class="wb-cl-row">
              <span class="wb-cl-label">Width</span>
              <input type="number" class="wb-cl-stepper-input" min="0" max="24" step="0.5" value="${escapeHtml(formatTfVal(lbl.outlineWidth ?? 1, 1))}" data-lbl-field="outlineWidth" aria-label="Outline Width">
            </div>
          </div>

          ${renderClGradientSection('lbl', 'label', lbl, Boolean(state.labelGradientCollapsed))}

          <div id="wb-text-feedback" class="wb-insp-feedback"></div>
        </div>
      </div>
    `;
  }

  function renderClImageTypeControls(img, cardKey) {
    const ft = Number.isFinite(Number(img.fillType)) ? Number(img.fillType) : 0;
    const is9Grid = ft === 1;
    const isFilled = ft === 3;
    return `
      <div class="wb-cl-row">
        <span class="wb-cl-label">Type</span>
        <select class="wb-cl-select" data-img-field="fillType" aria-label="Image Type">
          <option value="0" ${ft === 0 ? 'selected' : ''}>Simple</option>
          <option value="1" ${ft === 1 ? 'selected' : ''}>9-Grid Pattern</option>
          <option value="2" ${ft === 2 ? 'selected' : ''}>Tiled</option>
          <option value="3" ${ft === 3 ? 'selected' : ''}>Filled</option>
          <option value="5" ${ft === 5 ? 'selected' : ''}>Fit</option>
        </select>
      </div>

      <div class="wb-cl-conditional${is9Grid ? '' : ' is-hidden'}" data-cl-cond="${cardKey}-9grid">
        <div class="wb-cl-row">
          <span class="wb-cl-label" title="Invisible to Center (omits 9-slice center fill)">Invisible to Center</span>
          <input type="checkbox" class="wb-cl-check" data-img-field="centerInvisible" ${img.centerInvisible ? 'checked' : ''} aria-label="Invisible to Center">
        </div>
      </div>

      <div class="wb-cl-conditional${isFilled ? '' : ' is-hidden'}" data-cl-cond="${cardKey}-filled">
        <div class="wb-cl-row">
          <span class="wb-cl-label">Fill Direction</span>
          <select class="wb-cl-select" data-img-field="fillDir" aria-label="Fill Direction">
            <option value="0" ${Number(img.fillDir) === 0 ? 'selected' : ''}>Horizontal</option>
            <option value="1" ${Number(img.fillDir) === 1 ? 'selected' : ''}>Vertical</option>
            <option value="2" ${Number(img.fillDir) === 2 ? 'selected' : ''}>Radial 90°</option>
            <option value="3" ${Number(img.fillDir) === 3 ? 'selected' : ''}>Radial 180°</option>
            <option value="4" ${Number(img.fillDir) === 4 ? 'selected' : ''}>Radial 360°</option>
          </select>
        </div>
        ${renderClSliderRow({
          scope: 'img',
          field: 'fillAmount',
          label: 'Fill Value',
          value: img.fillAmount ?? 1,
          min: 0,
          max: 1,
          step: 0.01,
          suffix: '',
          decimals: 2,
        })}
        <div class="wb-cl-row">
          <span class="wb-cl-label">Invert Fill</span>
          <input type="checkbox" class="wb-cl-check" data-img-field="invertFill" ${img.invertFill ? 'checked' : ''} aria-label="Invert Fill">
        </div>
      </div>
    `;
  }

  function renderImageComponentCard(el) {
    if (!el) return '';
    const img = getWidgetImageState(el);
    const isCollapsed = Boolean(state.imageCollapsed);
    const isMenuOpen = Boolean(state.imageMenuOpen);
    const sliceAttrs = ['data-slice-id', 'data-slice-on', 'data-slice-off'].filter(a => Boolean(el.getAttribute(a)));
    if (sliceAttrs.length === 0) sliceAttrs.push('data-slice-id');
    const activeAttr = sliceAttrs.includes(state.activeEditorSliceAttr) ? state.activeEditorSliceAttr : sliceAttrs[0];
    const activeSliceId = el.getAttribute(activeAttr) || '';
    const resolved = activeSliceId ? resolveSliceUrl(activeSliceId) : null;
    const autoModeLabel = resolveEffectiveTintMode(el, activeSliceId, resolved ? resolved.rec : null);
    const matchingCount = activeSliceId ? findMatchingSpriteTargets(el, activeAttr).length : 0;

    const attrTabsHtml =
      sliceAttrs.length > 1
        ? `<div class="slice9-actions-row">${sliceAttrs
            .map(
              attr =>
                `<button type="button" class="wb-btn wb-btn-sm ${attr === activeAttr ? 'is-active' : ''}" data-insp-slice-attr="${attr}">${attr.replace('data-slice-', '')}</button>`
            )
            .join('')}</div>`
        : '';

    return `
      <div class="wb-insp-card wb-cl-card" data-cl-card="image">
        <div class="wb-tf-head">
          <button type="button" class="wb-tf-toggle" data-cl-toggle="image" aria-expanded="${isCollapsed ? 'false' : 'true'}">
            <span class="wb-tf-caret">${isCollapsed ? '▸' : '▾'}</span>
            <span>UI Widget Image</span>
          </button>
          <div class="wb-tf-menu-wrap">
            <button type="button" class="wb-tf-dots-btn${isMenuOpen ? ' is-open' : ''}" data-cl-menu-toggle="image" title="UI Widget Image Actions" aria-label="UI Widget Image Actions">⋯</button>
            <div class="wb-tf-menu-dropdown${isMenuOpen ? ' is-open' : ''}" id="wb-cl-menu-image">
              <div class="wb-tf-menu-heading">Tint Mode</div>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'auto' ? ' is-checked' : ''}" data-cl-menu-action="image:tint-auto">Auto (${autoModeLabel})</button>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'mask' ? ' is-checked' : ''}" data-cl-menu-action="image:tint-mask">Mask (White Icons)</button>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'multiply' ? ' is-checked' : ''}" data-cl-menu-action="image:tint-multiply">Multiply (Shaded Art)</button>
              <div class="wb-tf-menu-sep"></div>
              <button type="button" class="wb-tf-menu-item${state.swapAllSprites ? ' is-checked' : ''}" data-cl-menu-action="image:swap-all">Swap all matching (${matchingCount})</button>
              <button type="button" class="wb-tf-menu-item" data-cl-menu-action="image:copy">Copy Craftland JSON</button>
              <div class="wb-tf-menu-sep"></div>
              <button type="button" class="wb-tf-menu-item wb-tf-menu-item--danger" data-cl-menu-action="image:reset">Reset Image</button>
            </div>
          </div>
        </div>

        <div class="wb-cl-body${isCollapsed ? ' is-collapsed' : ''}" data-cl-body="image">
          ${attrTabsHtml}
          ${renderClColorRow({ scope: 'img', field: 'color', label: 'Color', hex: img.color })}

          <div class="wb-cl-row wb-cl-row--top">
            <span class="wb-cl-label">Sprite Shape</span>
            ${renderClSpriteWidget(activeSliceId, activeAttr)}
          </div>

          ${renderClSliderRow({
            scope: 'img',
            field: 'alpha',
            label: 'Alpha',
            value: img.alpha,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
            decimals: 0,
          })}

          <div class="wb-cl-row">
            <span class="wb-cl-label">Flip</span>
            <div class="wb-cl-seg-row" role="group" aria-label="Flip Sprite">
              <button type="button" class="wb-cl-seg-btn${img.flipX ? ' is-active' : ''}" data-img-flip="x" aria-pressed="${img.flipX ? 'true' : 'false'}" title="Flip Horizontal">${CL_FLIP_SVGS.x}</button>
              <button type="button" class="wb-cl-seg-btn${img.flipY ? ' is-active' : ''}" data-img-flip="y" aria-pressed="${img.flipY ? 'true' : 'false'}" title="Flip Vertical">${CL_FLIP_SVGS.y}</button>
            </div>
          </div>

          ${renderClImageTypeControls(img, 'image')}

          ${renderClGradientSection('img', 'image', img, Boolean(state.imageGradientCollapsed))}

          <div id="wb-sprite-feedback" class="wb-insp-feedback"></div>
        </div>
      </div>
    `;
  }

  function renderButtonComponentCard(el, spriteTargetEl) {
    const target = spriteTargetEl || el;
    const img = getWidgetImageState(target);
    const isCollapsed = Boolean(state.buttonCollapsed);
    const isMenuOpen = Boolean(state.buttonMenuOpen);
    const idleId = target.getAttribute('data-slice-id') || '';
    const pressedId = target.getAttribute('data-slice-pressed') || '';
    const hoverId = target.getAttribute('data-slice-hover') || '';
    const resolved = idleId ? resolveSliceUrl(idleId) : null;
    const autoModeLabel = resolveEffectiveTintMode(target, idleId, resolved ? resolved.rec : null);
    const matchingCount = idleId ? findMatchingSpriteTargets(target, 'data-slice-id').length : 0;
    const showHover = Boolean(hoverId || state.showHoverSpriteSlot);

    const targetInfoHtml =
      target !== el
        ? `<div class="wb-insp-hint">Targets sprite child <code>${escapeHtml(describeElementSelector(target))}</code></div>`
        : '';

    return `
      <div class="wb-insp-card wb-cl-card" data-cl-card="button">
        <div class="wb-tf-head">
          <button type="button" class="wb-tf-toggle" data-cl-toggle="button" aria-expanded="${isCollapsed ? 'false' : 'true'}">
            <span class="wb-tf-caret">${isCollapsed ? '▸' : '▾'}</span>
            <span>UI Widget Button</span>
          </button>
          <div class="wb-tf-menu-wrap">
            <button type="button" class="wb-tf-dots-btn${isMenuOpen ? ' is-open' : ''}" data-cl-menu-toggle="button" title="UI Widget Button Actions" aria-label="UI Widget Button Actions">⋯</button>
            <div class="wb-tf-menu-dropdown${isMenuOpen ? ' is-open' : ''}" id="wb-cl-menu-button">
              <div class="wb-tf-menu-heading">Tint Mode</div>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'auto' ? ' is-checked' : ''}" data-cl-menu-action="button:tint-auto">Auto (${autoModeLabel})</button>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'mask' ? ' is-checked' : ''}" data-cl-menu-action="button:tint-mask">Mask (White Icons)</button>
              <button type="button" class="wb-tf-menu-item${img.tintMode === 'multiply' ? ' is-checked' : ''}" data-cl-menu-action="button:tint-multiply">Multiply (Shaded Art)</button>
              <div class="wb-tf-menu-sep"></div>
              <button type="button" class="wb-tf-menu-item${showHover ? ' is-checked' : ''}" data-cl-menu-action="button:toggle-hover-slot">Show Hover Sprite Slot</button>
              <button type="button" class="wb-tf-menu-item${state.swapAllSprites ? ' is-checked' : ''}" data-cl-menu-action="button:swap-all">Swap all matching (${matchingCount})</button>
              <button type="button" class="wb-tf-menu-item" data-cl-menu-action="button:copy">Copy Craftland JSON</button>
              <div class="wb-tf-menu-sep"></div>
              <button type="button" class="wb-tf-menu-item wb-tf-menu-item--danger" data-cl-menu-action="button:reset">Reset Button</button>
            </div>
          </div>
        </div>

        <div class="wb-cl-body${isCollapsed ? ' is-collapsed' : ''}" data-cl-body="button">
          ${targetInfoHtml}
          <div class="wb-cl-row wb-cl-row--top">
            <span class="wb-cl-label">Sprite Resource</span>
            ${renderClSpriteWidget(idleId, 'data-slice-id')}
          </div>

          ${renderClColorRow({ scope: 'img', field: 'color', label: 'Color', hex: img.color })}

          ${renderClSliderRow({
            scope: 'img',
            field: 'alpha',
            label: 'Alpha',
            value: img.alpha,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
            decimals: 0,
          })}

          ${renderClColorRow({ scope: 'img', field: 'pressedColor', label: 'Pressed Color', hex: img.pressedColor || '#C5C5C5' })}

          ${renderClColorRow({ scope: 'img', field: 'disableColor', label: 'Disable Color', hex: img.disableColor || '#808080' })}

          <div class="wb-cl-row">
            <span class="wb-cl-label">Pressed Sprite</span>
            ${renderClSpriteWidget(pressedId, 'data-slice-pressed', { compact: true, allowClear: true })}
          </div>

          ${
            showHover
              ? `<div class="wb-cl-row">
                   <span class="wb-cl-label">Hover Sprite</span>
                   ${renderClSpriteWidget(hoverId, 'data-slice-hover', { compact: true, allowClear: true })}
                 </div>`
              : ''
          }

          <div class="wb-cl-row">
            <span class="wb-cl-label">Flip Type</span>
            <div class="wb-cl-seg-row" role="group" aria-label="Flip Button Sprite">
              <button type="button" class="wb-cl-seg-btn${img.flipX ? ' is-active' : ''}" data-img-flip="x" aria-pressed="${img.flipX ? 'true' : 'false'}" title="Flip Horizontal">${CL_FLIP_SVGS.x}</button>
              <button type="button" class="wb-cl-seg-btn${img.flipY ? ' is-active' : ''}" data-img-flip="y" aria-pressed="${img.flipY ? 'true' : 'false'}" title="Flip Vertical">${CL_FLIP_SVGS.y}</button>
            </div>
          </div>

          ${renderClImageTypeControls(img, 'button')}

          <div class="wb-cl-row">
            <span class="wb-cl-label" title="Disable Collider (click-through in Interactive mode)">Passthrough</span>
            <input type="checkbox" class="wb-cl-check" data-img-field="passthrough" ${img.passthrough ? 'checked' : ''} aria-label="Passthrough">
          </div>

          ${renderClGradientSection('img', 'button', img, Boolean(state.buttonGradientCollapsed))}

          <div id="wb-sprite-feedback" class="wb-insp-feedback"></div>
        </div>
      </div>
    `;
  }

  function resetWidgetEdits(el) {
    if (!el) return Promise.resolve({ ok: false });
    const edits = loadUiEdits();

    resetSingleElementImage(el, edits);
    const spriteTarget = getButtonSpriteTargetEl(el);
    if (spriteTarget && spriteTarget !== el) {
      resetSingleElementImage(spriteTarget, edits, el);
    }
    resetSingleElementTransform(el, edits);
    resetSingleElementLabel(el, edits);

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
    const tintEntries = Object.entries(edits.tintEdits || {});
    const labelEntries = Object.entries(edits.labelEdits || {});
    const imageEntries = Object.entries(edits.imageEdits || {});

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

    tintEntries.forEach(([pathKey, tintCfg]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || !tintCfg || typeof tintCfg !== 'object') return;
      snapshotWidgetOriginals(el);
      if (tintCfg.color) {
        el.setAttribute('data-tint', String(tintCfg.color));
        if (tintCfg.mode && tintCfg.mode !== 'auto') {
          el.setAttribute('data-tint-mode', String(tintCfg.mode));
        } else {
          el.removeAttribute('data-tint-mode');
        }
      } else {
        el.removeAttribute('data-tint');
        el.removeAttribute('data-tint-mode');
      }
      applyTintToElement(el, el.getAttribute('data-slice-id'));
    });

    labelEntries.forEach(([pathKey, savedLbl]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || !savedLbl || typeof savedLbl !== 'object') return;
      const base = readInitialLabelState(el);
      const lbl = Object.assign(base, savedLbl, {
        _alignVEdited: Object.prototype.hasOwnProperty.call(savedLbl, 'alignV'),
        dirty: true,
      });
      applyWidgetLabelToDom(el, lbl);
    });

    imageEntries.forEach(([pathKey, savedImg]) => {
      const el = resolveElementByCanvasPath(pathKey);
      if (!el || !savedImg || typeof savedImg !== 'object') return;
      const base = readInitialImageState(el);
      const img = Object.assign(base, savedImg, { dirty: true });
      const hostBtn = el.closest ? el.closest('button, .px-btn') : null;
      applyWidgetImageToDom(el, img, hostBtn && getButtonSpriteTargetEl(hostBtn) === el ? hostBtn : null);
    });

    return (
      spriteEntries.length +
      textEntries.length +
      transformEntries.length +
      tintEntries.length +
      labelEntries.length +
      imageEntries.length
    );
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

  function resolveEffectiveTintMode(el, sliceId, rec) {
    const rawMode = String((el && el.getAttribute('data-tint-mode')) || 'auto').trim().toLowerCase();
    if (rawMode === 'mask' || rawMode === 'multiply') return rawMode;
    const isWhite = Boolean(rec && rec.is_white_mask_candidate);
    if (isWhite) return 'mask';
    if (el && el.tagName === 'IMG') return 'mask';
    return 'multiply';
  }

  function applyTintToElement(el, sliceId) {
    if (!el || el.nodeType !== 1) return;
    const tintHex = (el.getAttribute('data-tint') || '').trim();
    const existingOverlay = Array.from(el.children).find(c => c.classList && c.classList.contains('px-tint-overlay'));

    if (!tintHex) {
      el.classList.remove('px-tint-mask', 'px-tint-multiply');
      el.style.removeProperty('--px-tint-color');
      el.style.removeProperty('--px-tint-mask-url');
      if (existingOverlay) existingOverlay.remove();
      return;
    }

    const resolved = sliceId ? resolveSliceUrl(sliceId) : null;
    const rec = resolved ? resolved.rec : null;
    const url = resolved ? resolved.url : el.tagName === 'IMG' ? el.getAttribute('src') : '';
    const mode = resolveEffectiveTintMode(el, sliceId, rec);

    el.style.setProperty('--px-tint-color', tintHex);

    if (mode === 'mask') {
      if (existingOverlay) existingOverlay.remove();
      el.classList.remove('px-tint-multiply');
      if (url) {
        el.style.setProperty('--px-tint-mask-url', `url("${url}")`);
      }
      el.classList.add('px-tint-mask');
    } else {
      el.classList.remove('px-tint-mask');
      el.style.removeProperty('--px-tint-mask-url');
      el.classList.add('px-tint-multiply');
      let overlay = existingOverlay;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'px-tint-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        el.insertBefore(overlay, el.firstChild);
      }
    }
  }

  function setWidgetTint(el, colorHex, mode = 'auto', persist = true) {
    if (!el) return Promise.resolve({ ok: false });
    const target = isButtonComponent(el) ? getButtonSpriteTargetEl(el) || el : el;
    snapshotWidgetOriginals(target);
    const cleanHex = String(colorHex || '').trim();
    const cleanMode = ['mask', 'multiply', 'auto'].includes(String(mode || '').toLowerCase())
      ? String(mode).toLowerCase()
      : 'auto';

    if (cleanHex) {
      target.setAttribute('data-tint', cleanHex);
      if (cleanMode === 'auto') target.removeAttribute('data-tint-mode');
      else target.setAttribute('data-tint-mode', cleanMode);
    } else {
      target.removeAttribute('data-tint');
      target.removeAttribute('data-tint-mode');
    }

    applyTintToElement(target, target.getAttribute('data-slice-id'));

    const pathKey = getElementCanvasPath(target);
    if (pathKey) {
      const edits = loadUiEdits();
      if (cleanHex) {
        edits.tintEdits[pathKey] = { color: cleanHex, mode: cleanMode };
      } else {
        delete edits.tintEdits[pathKey];
      }
      saveUiEdits(edits);
    }

    if (persist) return persistUiEditsToDisk();
    return Promise.resolve({ ok: true, method: 'browser-storage' });
  }

  function clearWidgetTint(el, persist = true) {
    return setWidgetTint(el, '', 'auto', persist);
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
      el.style.setProperty('--skin-url', `url("${url}")`);
      if (!el.style.getPropertyValue('--w')) el.style.setProperty('--w', String(rec.width));
      if (!el.style.getPropertyValue('--h')) el.style.setProperty('--h', String(rec.height));
      applyTintToElement(el, sliceId);
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
    applyTintToElement(el, sliceId);
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
    updateHudBudgetBadge();
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
    updateHudBudgetBadge();
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
    updateHudBudgetBadge();
  }

  /* ========================================================================
     HUD Ergonomics: Focus Zone Overlay, Custom Preview Backdrop & HUD Budget
     ======================================================================== */

  function ensureFocusZoneOverlay() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return null;
    let overlay = document.getElementById('__px_focus_zone__');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '__px_focus_zone__';
      overlay.setAttribute('aria-hidden', 'true');
      canvas.appendChild(overlay);
    }
    return overlay;
  }

  function toggleFocusZone(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !state.focusZoneVisible;
    state.focusZoneVisible = next;
    const overlay = ensureFocusZoneOverlay();
    if (overlay) {
      overlay.classList.toggle('is-visible', next);
    }
    document.querySelectorAll('[data-wb-focus-zone]').forEach(btn => {
      btn.classList.toggle('is-active', next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
    return next;
  }

  /* ========================================================================
     Craftland Multi-Resolution Switcher, Safe Zones Overlay & L10n Stress
     ======================================================================== */

  function getDefaultCanvasRes() {
    const body = document.body;
    const explicit = body && body.getAttribute('data-default-res');
    if (explicit && CANVAS_PRESETS[explicit]) return explicit;
    const profile = body && body.getAttribute('data-ui-profile');
    if (profile === 'craftland') return '1500x750';
    return '1280x720';
  }

  function updateCanvasFitZoom() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return 1;
    const slot = canvas.parentElement;
    canvas.style.zoom = '';
    if (isCleanMode()) {
      canvas.style.transform = '';
      canvas.classList.remove('is-canvas-downscaled');
      if (slot && slot.classList.contains('workbench-canvas-slot')) {
        slot.style.width = '';
        slot.style.height = '';
      }
      return 1;
    }
    const preset = CANVAS_PRESETS[state.currentCanvasRes] || CANVAS_PRESETS['1280x720'];
    const workspace = document.querySelector('.workbench-workspace');
    const reserve = state.studioVisible ? 264 + 356 + 24 : 48;
    const baseAvail = workspace ? workspace.clientWidth : (global.innerWidth || 1440);
    const availW = Math.max(360, baseAvail - reserve);
    const zoom = Math.min(1, availW / preset.w);
    const dpr = Number(global.devicePixelRatio || 1);
    const isNonIntegerOrDownscaled = zoom < 0.995 || dpr < 0.995 || Math.abs(dpr - Math.round(dpr)) > 0.01;
    if (zoom < 0.995) {
      canvas.style.transform = `scale(${zoom.toFixed(4)})`;
      if (slot && slot.classList.contains('workbench-canvas-slot')) {
        slot.style.width = `${Math.round(preset.w * zoom)}px`;
        slot.style.height = `${Math.round(preset.h * zoom)}px`;
      }
    } else {
      canvas.style.transform = '';
      if (slot && slot.classList.contains('workbench-canvas-slot')) {
        slot.style.width = '';
        slot.style.height = '';
      }
    }
    canvas.classList.toggle('is-canvas-downscaled', isNonIntegerOrDownscaled);
    renderTransformGizmo();
    return zoom;
  }

  function ensureSafeZonesOverlay() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return null;
    let overlay = document.getElementById('__px_safe_zones__');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = '__px_safe_zones__';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <div class="px-sz-center"><span class="px-sz-label">1280×750 SAFE FRAME</span></div>
        <div class="px-sz-thumb px-sz-thumb--left"><span class="px-sz-label">FF JOYSTICK</span></div>
        <div class="px-sz-thumb px-sz-thumb--right"><span class="px-sz-label">FF CONTROLS</span></div>
      `;
      canvas.appendChild(overlay);
    }
    updateSafeZonesGeometry();
    return overlay;
  }

  function updateSafeZonesGeometry() {
    const overlay = document.getElementById('__px_safe_zones__');
    if (!overlay) return;
    const preset = CANVAS_PRESETS[state.currentCanvasRes] || CANVAS_PRESETS['1280x720'];
    const safeW = Math.min(1280, preset.w);
    const safeH = Math.min(750, preset.h);
    const centerBox = overlay.querySelector('.px-sz-center');
    if (centerBox) {
      centerBox.style.width = `${safeW}px`;
      centerBox.style.height = `${safeH}px`;
      centerBox.style.left = `${Math.round((preset.w - safeW) / 2)}px`;
      centerBox.style.top = `${Math.round((preset.h - safeH) / 2)}px`;
    }
  }

  function toggleSafeZones(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !state.safeZonesVisible;
    state.safeZonesVisible = next;
    const overlay = ensureSafeZonesOverlay();
    if (overlay) {
      overlay.classList.toggle('is-visible', next);
    }
    document.querySelectorAll('[data-wb-safe-zones]').forEach(btn => {
      btn.classList.toggle('is-active', next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    });
    return next;
  }

  function setCanvasResolution(presetKey) {
    const key = CANVAS_PRESETS[presetKey] ? presetKey : getDefaultCanvasRes();
    const preset = CANVAS_PRESETS[key];
    state.currentCanvasRes = key;

    const root = document.documentElement;
    root.style.setProperty('--px-canvas-w', `${preset.w}px`);
    root.style.setProperty('--px-canvas-h', `${preset.h}px`);

    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.setAttribute('data-canvas-res', key);
      canvas.style.width = `${preset.w}px`;
      canvas.style.height = `${preset.h}px`;
    }

    const selectEl = document.querySelector('[data-wb-canvas-res]');
    if (selectEl && selectEl.value !== key) {
      selectEl.value = key;
    }

    const badgeEl = document.querySelector('.workbench-title .workbench-badge');
    if (badgeEl) {
      const profile = document.body && document.body.getAttribute('data-ui-profile');
      badgeEl.textContent =
        profile === 'craftland'
          ? `Craftland ${preset.w}×${preset.h}`
          : `${preset.w}×${preset.h} UI Preview`;
    }

    updateCanvasFitZoom();
    updateSafeZonesGeometry();
    if (typeof renderTransformGizmo === 'function') renderTransformGizmo();
    updateHudBudgetBadge();
    return preset;
  }

  function collectCanvasTextNodes() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return [];
    const nodes = [];
    const walker = document.createTreeWalker(canvas, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || isInternalOverlayElement(parent) || parent.closest('#__px_safe_zones__, #__px_focus_zone__, #__px_transform_gizmo__, #__verify_annotations__')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let cur = walker.nextNode();
    while (cur) {
      nodes.push(cur);
      cur = walker.nextNode();
    }
    return nodes;
  }

  function buildLongStressText(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    // Leave pure numeric/symbol readouts compact while testing tall glyph headroom
    if (/^[\d.,:+xX×%$/\-–—\s]+$/.test(trimmed)) {
      return `${trimmed}`;
    }
    const words = trimmed.split(/\s+/);
    const mult = words.length <= 2 ? 1.8 : 1.5;
    const targetLen = Math.max(trimmed.length + 4, Math.round(trimmed.length * mult));
    const filler = ' ỮỚကြီးüberlang';
    let out = `${trimmed}${filler}`;
    while (out.length < targetLen) {
      out += ' rozszerzenie';
    }
    return out.slice(0, targetLen);
  }

  function buildRtlStressText(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (/^[\d.,:+xX×%$/\-–—\s]+$/.test(trimmed)) return trimmed;
    const words = trimmed.split(/\s+/);
    if (words.length <= 2) return `مجموعة ${trimmed} متقدمة`;
    return `إعدادات الواجهة العربية المطوّلة (${trimmed})`;
  }

  function setL10nStressMode(mode) {
    const next = mode === 'long' || mode === 'rtl' ? mode : 'base';
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return next;

    // Restore previously tracked nodes first so edits/switches never compound
    for (const node of state.l10nTrackedNodes) {
      if (state.l10nOriginalText.has(node)) {
        node.nodeValue = state.l10nOriginalText.get(node);
      }
    }
    state.l10nTrackedNodes = [];

    if (next === 'base') {
      canvas.removeAttribute('dir');
      canvas.removeAttribute('data-l10n-mode');
    } else {
      const nodes = collectCanvasTextNodes();
      for (const node of nodes) {
        if (!state.l10nOriginalText.has(node)) {
          state.l10nOriginalText.set(node, node.nodeValue);
        }
        const orig = state.l10nOriginalText.get(node);
        node.nodeValue = next === 'long' ? buildLongStressText(orig) : buildRtlStressText(orig);
        state.l10nTrackedNodes.push(node);
      }
      canvas.setAttribute('data-l10n-mode', next);
      if (next === 'rtl') canvas.setAttribute('dir', 'rtl');
      else canvas.removeAttribute('dir');
    }

    state.l10nStressMode = next;
    const selectEl = document.querySelector('[data-wb-l10n-mode]');
    if (selectEl) {
      selectEl.value = next;
      selectEl.classList.toggle('is-active', next !== 'base');
    }
    updateHudBudgetBadge();
    return next;
  }

  function setCustomBackdrop(dataUrl, persist = true) {
    const canvas = document.getElementById('game-canvas');
    if (!canvas || !dataUrl) return false;
    canvas.style.setProperty('--px-custom-backdrop', `url("${dataUrl}")`);
    canvas.classList.add('has-custom-backdrop');
    const clearBtn = document.querySelector('[data-wb-backdrop-clear]');
    if (clearBtn) clearBtn.style.display = 'inline-flex';
    const pickBtn = document.querySelector('[data-wb-backdrop-pick]');
    if (pickBtn) pickBtn.classList.add('is-active');
    if (persist) {
      try {
        if (global.localStorage) {
          global.localStorage.setItem(BACKDROP_STORAGE_PREFIX + getPreviewSlugForEdits(), dataUrl);
        }
      } catch {
        // Ignore quota errors for very large screenshots
      }
    }
    return true;
  }

  function clearCustomBackdrop() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.classList.remove('has-custom-backdrop');
      canvas.style.removeProperty('--px-custom-backdrop');
    }
    const clearBtn = document.querySelector('[data-wb-backdrop-clear]');
    if (clearBtn) clearBtn.style.display = 'none';
    const pickBtn = document.querySelector('[data-wb-backdrop-pick]');
    if (pickBtn) pickBtn.classList.remove('is-active');
    try {
      if (global.localStorage) {
        global.localStorage.removeItem(BACKDROP_STORAGE_PREFIX + getPreviewSlugForEdits());
      }
    } catch {
      // Ignore storage errors
    }
  }

  function loadSavedBackdrop() {
    if (isCleanMode()) return;
    try {
      const saved = global.localStorage && global.localStorage.getItem(BACKDROP_STORAGE_PREFIX + getPreviewSlugForEdits());
      if (saved) setCustomBackdrop(saved, false);
    } catch {
      // Ignore storage errors
    }
  }

  function loadBackdropFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomBackdrop(reader.result, true);
      }
    };
    reader.readAsDataURL(file);
  }

  function computeHudBudget() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return null;
    const cRect = canvas.getBoundingClientRect();
    if (cRect.width <= 0 || cRect.height <= 0) return null;

    const isVis = el => {
      if (!el || el.nodeType !== 1 || isInternalOverlayElement(el)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };

    const activeView = canvas.querySelector('[data-ui-view].is-active') || canvas;
    const hasModal = Boolean(
      activeView.classList.contains('px-modal-backdrop') ||
        Array.from(activeView.querySelectorAll('.px-modal-backdrop')).some(isVis)
    );
    if (hasModal) {
      return { isModal: true, hudPct: 0, centerPct: 0 };
    }

    const focusRect = {
      left: cRect.left + cRect.width * 0.3,
      top: cRect.top + cRect.height * 0.3,
      right: cRect.left + cRect.width * 0.7,
      bottom: cRect.top + cRect.height * 0.7,
    };
    const focusArea = (focusRect.right - focusRect.left) * (focusRect.bottom - focusRect.top);
    const canvasArea = cRect.width * cRect.height;

    const widgets = [];
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
    const walk = container => {
      for (const child of Array.from(container.children)) {
        if (!isVis(child)) continue;
        if (child.classList.contains('world-backdrop-props') || child.getAttribute('data-wireframe-hide') === 'true') {
          continue;
        }
        if (
          child.matches('.px-hud-layer, .px-hud-top, .px-hud-bottom, .px-hud-left, .px-hud-right') ||
          isTransparentWrapper(child)
        ) {
          walk(child);
        } else {
          widgets.push(child);
        }
      }
    };
    walk(activeView);

    let hudArea = 0;
    let centerOverlap = 0;
    for (const w of widgets) {
      const r = w.getBoundingClientRect();
      const cl = Math.max(cRect.left, r.left);
      const ct = Math.max(cRect.top, r.top);
      const cr = Math.min(cRect.right, r.right);
      const cb = Math.min(cRect.bottom, r.bottom);
      if (cr > cl && cb > ct) hudArea += (cr - cl) * (cb - ct);

      const fl = Math.max(focusRect.left, r.left);
      const ft = Math.max(focusRect.top, r.top);
      const fr = Math.min(focusRect.right, r.right);
      const fb = Math.min(focusRect.bottom, r.bottom);
      if (fr > fl && fb > ft) centerOverlap += (fr - fl) * (fb - ft);
    }

    return {
      isModal: false,
      hudPct: Math.min(100, Math.round((hudArea / canvasArea) * 100)),
      centerPct: Math.min(100, Math.round((centerOverlap / focusArea) * 100)),
    };
  }

  function updateHudBudgetBadge() {
    if (isCleanMode()) return;
    const badge = document.getElementById('wb-hud-budget');
    if (!badge) return;
    const res = computeHudBudget();
    if (!res) return;
    badge.classList.remove('is-ok', 'is-warn', 'is-modal');
    if (res.isModal) {
      badge.classList.add('is-modal');
      badge.textContent = 'HUD: Modal';
      badge.title = 'Full modal/popup view — HUD visual budget applies to gameplay HUD views.';
      return;
    }
    const crowded = res.hudPct > 22 || res.centerPct > 5;
    badge.classList.add(crowded ? 'is-warn' : 'is-ok');
    badge.textContent = `HUD: ${res.hudPct}% · Center: ${res.centerPct}%`;
    badge.title = crowded
      ? `${res.hudPct}% of canvas covered by HUD · ${res.centerPct}% of Center 40% Focus Zone covered (advisory target: ≤22% / ≤5%).`
      : `${res.hudPct}% of canvas covered by HUD · ${res.centerPct}% of Center 40% Focus Zone covered (clean target: ≤22% / ≤5%).`;
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

    // Inject mobile HUD Designer Tools (Craftland Canvas Resolution, Safe Zones, Focus Zone, L10n Stress, Custom Backdrop, HUD Budget, Export .ui)
    const controlsBar = document.querySelector('.workbench-controls');
    if (controlsBar && !controlsBar.querySelector('[data-wb-focus-zone]')) {
      const resOptionsHtml = Object.entries(CANVAS_PRESETS)
        .map(([k, p]) => `<option value="${k}">${p.label}</option>`)
        .join('');
      const isCraftlandUi =
        (document.body && document.body.getAttribute('data-ui-profile') === 'craftland') ||
        Boolean(getCatalog() && getCatalog().craftland_project);
      const exportBtnHtml = isCraftlandUi
        ? `<button type="button" class="wb-btn wb-btn--primary" data-wb-export-ui title="Compile active preview view into a Craftland Studio .ui draft via MCP">Export .ui</button>`
        : '';
      const hudGroup = document.createElement('div');
      hudGroup.className = 'wb-group';
      hudGroup.innerHTML = `
        <span class="wb-label">Canvas</span>
        <select class="wb-select" data-wb-canvas-res title="Switch viewport resolution (Craftland presets + Legacy 1280×720)">${resOptionsHtml}</select>
        <button type="button" class="wb-btn" data-wb-safe-zones aria-pressed="false" title="Toggle Craftland 1280×750 Safe Frame & Free Fire reserved bottom-corner control zones">Safe Zones</button>
        <button type="button" class="wb-btn" data-wb-focus-zone aria-pressed="false" title="Toggle Center 40% Gameplay Focus Zone guide">Focus Zone</button>
        <select class="wb-select" data-wb-l10n-mode title="Localization stress test (Base / Long 1.6x + Tall diacritics / RTL Arabic)">
          <option value="base">L10n: Base</option>
          <option value="long">L10n: Long 1.6× + Tall</option>
          <option value="rtl">L10n: RTL (Arabic)</option>
        </select>
        <button type="button" class="wb-btn" data-wb-backdrop-pick title="Upload or drop a gameplay screenshot as a preview-only backdrop">Backdrop…</button>
        <button type="button" class="wb-btn" data-wb-backdrop-clear style="display:none;" title="Clear custom preview backdrop">×</button>
        <input type="file" id="wb-backdrop-file-input" accept="image/*" style="display:none;">
        <span id="wb-hud-budget" class="wb-budget-badge is-ok" title="Live advisory gameplay HUD coverage">HUD: --</span>
        ${exportBtnHtml}
      `;
      controlsBar.appendChild(hudGroup);

      const exportBtn = hudGroup.querySelector('[data-wb-export-ui]');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => openCraftlandExportModal());
      }

      const resSelect = hudGroup.querySelector('[data-wb-canvas-res]');
      const safeZonesBtn = hudGroup.querySelector('[data-wb-safe-zones]');
      const l10nSelect = hudGroup.querySelector('[data-wb-l10n-mode]');
      const focusBtn = hudGroup.querySelector('[data-wb-focus-zone]');
      const pickBtn = hudGroup.querySelector('[data-wb-backdrop-pick]');
      const clearBtn = hudGroup.querySelector('[data-wb-backdrop-clear]');
      const fileInput = hudGroup.querySelector('#wb-backdrop-file-input');

      if (resSelect) {
        resSelect.addEventListener('change', () => setCanvasResolution(resSelect.value));
      }
      if (safeZonesBtn) {
        safeZonesBtn.addEventListener('click', () => toggleSafeZones());
      }
      if (l10nSelect) {
        l10nSelect.addEventListener('change', () => setL10nStressMode(l10nSelect.value));
      }
      if (focusBtn) {
        focusBtn.addEventListener('click', () => toggleFocusZone());
      }
      global.addEventListener('resize', () => {
        updateCanvasFitZoom();
        if (typeof renderTransformGizmo === 'function') renderTransformGizmo();
      });
      if (typeof MutationObserver === 'function' && document.body) {
        const bodyObs = new MutationObserver(() => {
          updateCanvasFitZoom();
          if (typeof renderTransformGizmo === 'function') renderTransformGizmo();
        });
        bodyObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
      if (pickBtn && fileInput) {
        pickBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          if (file) loadBackdropFile(file);
          fileInput.value = '';
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => clearCustomBackdrop());
      }

      canvas.addEventListener('dragover', evt => {
        if (evt.dataTransfer && Array.from(evt.dataTransfer.types || []).includes('Files')) {
          evt.preventDefault();
          canvas.classList.add('is-backdrop-dragover');
        }
      });
      canvas.addEventListener('dragleave', () => {
        canvas.classList.remove('is-backdrop-dragover');
      });
      canvas.addEventListener('drop', evt => {
        canvas.classList.remove('is-backdrop-dragover');
        const file = evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files[0];
        if (file && file.type && file.type.startsWith('image/')) {
          evt.preventDefault();
          loadBackdropFile(file);
        }
      });
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

  function renderWidgetInspector(body, badge) {
    const el = state.selectedEl;
    if (!el || !document.body.contains(el)) {
      badge.textContent = 'None';
      body.innerHTML =
        '<div class="wb-insp-empty">Select any sprite from the bottom Resources tab to edit its 9-slice, or click a UI widget on the canvas to inspect its Transform, Label, Image, or Button components.</div>';
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

    const textInfo = getEditableTextInfo(el);
    const canAddOrEditText = Boolean(textInfo);

    badge.textContent = isBtnComp
      ? 'UI Widget Button'
      : activeSliceId
        ? 'UI Widget Image'
        : canAddOrEditText
          ? 'UI Widget Label'
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
      html += renderLabelComponentCard(el);
    }

    if (isBtnComp) {
      html += renderButtonComponentCard(el, buttonSpriteTargetEl);
    } else if (sliceAttrs.length > 0) {
      html += renderImageComponentCard(el);
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
      state.labelMenuOpen = false;
      state.imageMenuOpen = false;
      state.buttonMenuOpen = false;
      state.showHoverSpriteSlot = false;
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
        target.closest('#__verify_annotations__, #__px_transform_gizmo__, #__px_focus_zone__')
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
      ['label', 'image', 'button'].forEach(key => {
        const flag = `${key}MenuOpen`;
        if (state[flag]) {
          state[flag] = false;
          document.getElementById(`wb-cl-menu-${key}`)?.classList.remove('is-open');
          document.querySelector(`[data-cl-menu-toggle="${key}"]`)?.classList.remove('is-open');
        }
      });
    }

    function getSelectedImageContext() {
      if (!state.selectedEl) return null;
      const isBtn = isButtonComponent(state.selectedEl);
      const targetEl = isBtn ? getButtonSpriteTargetEl(state.selectedEl) || state.selectedEl : state.selectedEl;
      return { hostEl: state.selectedEl, targetEl, isBtn, cardKey: isBtn ? 'button' : 'image' };
    }

    function updateClSliderVisual(sliderEl, val) {
      if (!sliderEl) return;
      const min = parseFloat(sliderEl.min || '0');
      const max = parseFloat(sliderEl.max || '100');
      const pct = roundTfNum(clamp01((val - min) / Math.max(0.0001, max - min)) * 100, 2);
      sliderEl.value = String(val);
      sliderEl.style.setProperty('--pct', `${pct}%`);
    }

    function updateClGradientStopLabels(cardKey, gradType) {
      const stopsEl = document.querySelector(`[data-cl-cond="${cardKey}-grad-stops"]`);
      if (!stopsEl) return;
      stopsEl.classList.toggle('is-hidden', Number(gradType) === 0);
      const labels = stopsEl.querySelectorAll('.wb-cl-label');
      if (labels.length >= 2) {
        labels[0].textContent = Number(gradType) === 2 ? 'Left' : 'Top';
        labels[1].textContent = Number(gradType) === 2 ? 'Right' : 'Bottom';
      }
    }

    function applyLabelFieldEdit(field, rawVal, persist = false) {
      if (!state.selectedEl) return;
      const bundle = getWidgetLabelState(state.selectedEl);
      if (!bundle) return;
      const { targetEl, lbl } = bundle;

      switch (field) {
        case 'color':
        case 'shadowColor':
        case 'outlineColor':
        case 'gradientTop':
        case 'gradientBottom': {
          const hex = normalizeHexColor(rawVal, '');
          if (!hex) return;
          lbl[field] = hex;
          const colIn = document.querySelector(`[data-lbl-color="${field}"]`);
          const hexIn = document.querySelector(`[data-lbl-hex="${field}"]`);
          if (colIn && colIn.value.toUpperCase() !== hex) colIn.value = hex;
          if (colIn && colIn.parentElement) colIn.parentElement.style.background = hex;
          if (hexIn && document.activeElement !== hexIn) hexIn.value = hex;
          break;
        }
        case 'alpha':
        case 'gradientTopAlpha':
        case 'gradientBottomAlpha': {
          const v = Math.max(0, Math.min(100, parseFloat(rawVal)));
          if (!Number.isFinite(v)) return;
          lbl[field] = roundTfNum(v, 1);
          const s = document.querySelector(`[data-lbl-slider="${field}"]`);
          const n = document.querySelector(`[data-lbl-field="${field}"]`);
          if (s) updateClSliderVisual(s, lbl[field]);
          if (n && document.activeElement !== n) n.value = String(Math.round(lbl[field]));
          break;
        }
        case 'shadowAlpha':
        case 'outlineAlpha': {
          const v = clamp01(parseFloat(rawVal));
          if (!Number.isFinite(v)) return;
          lbl[field] = roundTfNum(v, 2);
          const s = document.querySelector(`[data-lbl-slider="${field}"]`);
          const n = document.querySelector(`[data-lbl-field="${field}"]`);
          if (s) updateClSliderVisual(s, lbl[field]);
          if (n && document.activeElement !== n) n.value = formatTfVal(lbl[field], 2);
          break;
        }
        case 'fontSize': {
          const v = Math.max(4, Math.min(256, parseFloat(rawVal)));
          if (!Number.isFinite(v)) return;
          lbl.fontSize = roundTfNum(v, 1);
          break;
        }
        case 'lineSpacing': {
          const v = Math.max(-64, Math.min(128, parseFloat(rawVal)));
          if (!Number.isFinite(v)) return;
          lbl.lineSpacing = roundTfNum(v, 1);
          break;
        }
        case 'outlineWidth': {
          const v = Math.max(0, Math.min(24, parseFloat(rawVal)));
          if (!Number.isFinite(v)) return;
          lbl.outlineWidth = roundTfNum(v, 2);
          break;
        }
        case 'shadowOffsetX': {
          const v = parseFloat(rawVal);
          if (!Number.isFinite(v)) return;
          lbl.shadowOffset = [roundTfNum(v, 1), Array.isArray(lbl.shadowOffset) ? lbl.shadowOffset[1] : 1];
          break;
        }
        case 'shadowOffsetY': {
          const v = parseFloat(rawVal);
          if (!Number.isFinite(v)) return;
          lbl.shadowOffset = [Array.isArray(lbl.shadowOffset) ? lbl.shadowOffset[0] : 1, roundTfNum(v, 1)];
          break;
        }
        case 'overflow': {
          const v = parseInt(rawVal, 10);
          lbl.overflow = [0, 1, 2].includes(v) ? v : 1;
          break;
        }
        case 'gradient': {
          const v = parseInt(rawVal, 10);
          lbl.gradient = [0, 1, 2].includes(v) ? v : 0;
          updateClGradientStopLabels('label', lbl.gradient);
          break;
        }
        case 'shadow': {
          lbl.shadow = Boolean(rawVal);
          document.querySelector('[data-cl-cond="label-shadow"]')?.classList.toggle('is-hidden', !lbl.shadow);
          break;
        }
        case 'outline': {
          lbl.outline = Boolean(rawVal);
          document.querySelector('[data-cl-cond="label-outline"]')?.classList.toggle('is-hidden', !lbl.outline);
          break;
        }
        default:
          return;
      }

      lbl.dirty = true;
      applyWidgetLabelToDom(targetEl, lbl);
      updateInspectorGeometryReadout();
      renderTransformGizmo();
      saveWidgetLabelEdit(targetEl, lbl, persist).then(result => {
        const fb = document.getElementById('wb-text-feedback');
        if (fb && persist) {
          fb.textContent =
            result.method === 'studio-server'
              ? '✓ Label saved to ui-edits.js'
              : '✓ Label saved in browser storage';
        }
      });
    }

    function applyImageFieldEdit(field, rawVal, persist = false) {
      const ctx = getSelectedImageContext();
      if (!ctx) return;
      const { hostEl, targetEl, isBtn, cardKey } = ctx;
      const img = getWidgetImageState(targetEl);
      if (!img) return;

      switch (field) {
        case 'color':
        case 'pressedColor':
        case 'disableColor':
        case 'gradientTop':
        case 'gradientBottom': {
          const hex = normalizeHexColor(rawVal, '');
          if (!hex) return;
          img[field] = hex;
          const colIn = document.querySelector(`[data-img-color="${field}"]`);
          const hexIn = document.querySelector(`[data-img-hex="${field}"]`);
          if (colIn && colIn.value.toUpperCase() !== hex) colIn.value = hex;
          if (colIn && colIn.parentElement) colIn.parentElement.style.background = hex;
          if (hexIn && document.activeElement !== hexIn) hexIn.value = hex;
          break;
        }
        case 'alpha':
        case 'gradientTopAlpha':
        case 'gradientBottomAlpha': {
          const v = Math.max(0, Math.min(100, parseFloat(rawVal)));
          if (!Number.isFinite(v)) return;
          img[field] = roundTfNum(v, 1);
          const s = document.querySelector(`[data-img-slider="${field}"]`);
          const n = document.querySelector(`[data-img-field="${field}"]`);
          if (s) updateClSliderVisual(s, img[field]);
          if (n && document.activeElement !== n) n.value = String(Math.round(img[field]));
          break;
        }
        case 'fillAmount': {
          const v = clamp01(parseFloat(rawVal));
          if (!Number.isFinite(v)) return;
          img.fillAmount = roundTfNum(v, 2);
          const s = document.querySelector('[data-img-slider="fillAmount"]');
          const n = document.querySelector('[data-img-field="fillAmount"]');
          if (s) updateClSliderVisual(s, img.fillAmount);
          if (n && document.activeElement !== n) n.value = formatTfVal(img.fillAmount, 2);
          break;
        }
        case 'fillType': {
          const v = parseInt(rawVal, 10);
          img.fillType = [0, 1, 2, 3, 5].includes(v) ? v : 0;
          document.querySelector(`[data-cl-cond="${cardKey}-9grid"]`)?.classList.toggle('is-hidden', img.fillType !== 1);
          document.querySelector(`[data-cl-cond="${cardKey}-filled"]`)?.classList.toggle('is-hidden', img.fillType !== 3);
          break;
        }
        case 'fillDir': {
          const v = parseInt(rawVal, 10);
          img.fillDir = [0, 1, 2, 3, 4].includes(v) ? v : 0;
          break;
        }
        case 'centerInvisible':
        case 'invertFill':
        case 'passthrough': {
          img[field] = Boolean(rawVal);
          break;
        }
        case 'gradient': {
          const v = parseInt(rawVal, 10);
          img.gradient = [0, 1, 2].includes(v) ? v : 0;
          updateClGradientStopLabels(cardKey, img.gradient);
          break;
        }
        default:
          return;
      }

      img.dirty = true;
      applyWidgetImageToDom(targetEl, img, isBtn ? hostEl : null);
      updateInspectorGeometryReadout();
      renderTransformGizmo();
      saveWidgetImageEdit(targetEl, img, persist).then(result => {
        const fb = document.getElementById('wb-sprite-feedback');
        if (fb && persist) {
          fb.textContent =
            result.method === 'studio-server'
              ? `✓ ${isBtn ? 'Button' : 'Image'} saved to ui-edits.js`
              : `✓ ${isBtn ? 'Button' : 'Image'} saved in browser storage`;
        }
      });
    }

    let clScrub = null;

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
        (state.anchorPresetOpen || state.transformMenuOpen || state.labelMenuOpen || state.imageMenuOpen || state.buttonMenuOpen) &&
        !evt.target.closest(
          '#wb-tf-preset-popover, [data-tf-preset-btn], #wb-tf-menu-dropdown, [data-tf-menu-toggle], .wb-tf-menu-dropdown, [data-cl-menu-toggle]'
        )
      ) {
        closeTransformPopovers();
      }

      const clToggleBtn = evt.target.closest('[data-cl-toggle]');
      if (clToggleBtn) {
        const key = clToggleBtn.getAttribute('data-cl-toggle');
        const flag = `${key}Collapsed`;
        state[flag] = !state[flag];
        clToggleBtn.setAttribute('aria-expanded', state[flag] ? 'false' : 'true');
        const caret = clToggleBtn.querySelector('.wb-tf-caret');
        if (caret) caret.textContent = state[flag] ? '▸' : '▾';
        document.querySelector(`[data-cl-body="${key}"]`)?.classList.toggle('is-collapsed', state[flag]);
        if (state[flag]) closeTransformPopovers();
        return;
      }

      const clGradToggleBtn = evt.target.closest('[data-cl-grad-toggle]');
      if (clGradToggleBtn) {
        const key = clGradToggleBtn.getAttribute('data-cl-grad-toggle');
        const flag = `${key}GradientCollapsed`;
        state[flag] = !state[flag];
        clGradToggleBtn.setAttribute('aria-expanded', state[flag] ? 'false' : 'true');
        const caret = clGradToggleBtn.querySelector('.wb-tf-caret');
        if (caret) caret.textContent = state[flag] ? '▸' : '▾';
        document.querySelector(`[data-cl-grad-body="${key}"]`)?.classList.toggle('is-collapsed', state[flag]);
        return;
      }

      const clMenuBtn = evt.target.closest('[data-cl-menu-toggle]');
      if (clMenuBtn) {
        evt.stopPropagation();
        const key = clMenuBtn.getAttribute('data-cl-menu-toggle');
        const flag = `${key}MenuOpen`;
        const nextOpen = !state[flag];
        closeTransformPopovers();
        state[flag] = nextOpen;
        clMenuBtn.classList.toggle('is-open', nextOpen);
        document.getElementById(`wb-cl-menu-${key}`)?.classList.toggle('is-open', nextOpen);
        return;
      }

      const clMenuAction = evt.target.closest('[data-cl-menu-action]');
      if (clMenuAction && state.selectedEl) {
        const rawAct = clMenuAction.getAttribute('data-cl-menu-action') || '';
        const [scope, act] = rawAct.split(':');
        closeTransformPopovers();
        if (scope === 'label') {
          const bundle = getWidgetLabelState(state.selectedEl);
          if (!bundle) return;
          if (act === 'copy') {
            const payload = JSON.stringify(exportLabelCraftlandJson(bundle.targetEl, bundle.lbl), null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(payload).catch(() => {});
            }
            const fb = document.getElementById('wb-text-feedback');
            if (fb) fb.textContent = '✓ Craftland Label JSON copied!';
          } else if (act === 'reset') {
            const edits = loadUiEdits();
            resetSingleElementLabel(state.selectedEl, edits);
            saveUiEdits(edits);
            renderHierarchyTree();
            renderInspector();
            persistUiEditsToDisk().then(result => {
              const fb = document.getElementById('wb-text-feedback');
              if (fb) {
                fb.textContent =
                  result.method === 'studio-server'
                    ? '✓ Label reset & saved to ui-edits.js'
                    : '✓ Label reset to default';
              }
            });
          }
          return;
        }
        if (scope === 'image' || scope === 'button') {
          const ctx = getSelectedImageContext();
          if (!ctx) return;
          const img = getWidgetImageState(ctx.targetEl);
          if (act === 'tint-auto' || act === 'tint-mask' || act === 'tint-multiply') {
            img.tintMode = act.replace('tint-', '');
            img.dirty = true;
            applyWidgetImageToDom(ctx.targetEl, img, ctx.isBtn ? ctx.hostEl : null);
            renderInspector();
            saveWidgetImageEdit(ctx.targetEl, img, true).then(result => {
              const fb = document.getElementById('wb-sprite-feedback');
              if (fb) {
                fb.textContent =
                  result.method === 'studio-server'
                    ? `✓ Tint mode (${img.tintMode}) saved`
                    : `✓ Tint mode (${img.tintMode}) applied`;
              }
            });
          } else if (act === 'swap-all') {
            state.swapAllSprites = !state.swapAllSprites;
            const spCb = document.getElementById('wb-sp-swap-all');
            if (spCb) spCb.checked = state.swapAllSprites;
            renderInspector();
          } else if (act === 'toggle-hover-slot') {
            state.showHoverSpriteSlot = !state.showHoverSpriteSlot;
            renderInspector();
          } else if (act === 'copy') {
            const payload = JSON.stringify(exportImageCraftlandJson(ctx.targetEl, img, ctx.isBtn), null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(payload).catch(() => {});
            }
            const fb = document.getElementById('wb-sprite-feedback');
            if (fb) fb.textContent = `✓ Craftland ${ctx.isBtn ? 'Button' : 'Image'} JSON copied!`;
          } else if (act === 'reset') {
            const edits = loadUiEdits();
            resetSingleElementImage(ctx.targetEl, edits, ctx.isBtn ? ctx.hostEl : null);
            saveUiEdits(edits);
            renderManifestTable();
            renderResourcesDockGrid();
            renderHierarchyTree();
            renderInspector();
            persistUiEditsToDisk().then(result => {
              const fb = document.getElementById('wb-sprite-feedback');
              if (fb) {
                fb.textContent =
                  result.method === 'studio-server'
                    ? `✓ ${ctx.isBtn ? 'Button' : 'Image'} reset & saved`
                    : `✓ ${ctx.isBtn ? 'Button' : 'Image'} reset to default`;
              }
            });
          }
          return;
        }
      }

      const eyedropBtn = evt.target.closest('[data-cl-eyedropper]');
      if (eyedropBtn && state.selectedEl) {
        const [scope, field] = (eyedropBtn.getAttribute('data-cl-eyedropper') || '').split(':');
        if (typeof global.EyeDropper === 'function') {
          const ed = new global.EyeDropper();
          ed.open()
            .then(res => {
              if (res && res.sRGBHex) {
                if (scope === 'lbl') applyLabelFieldEdit(field, res.sRGBHex, true);
                else if (scope === 'img') applyImageFieldEdit(field, res.sRGBHex, true);
              }
            })
            .catch(() => {});
        } else {
          const colIn = document.querySelector(`[data-${scope}-color="${field}"]`);
          if (colIn) colIn.click();
        }
        return;
      }

      const alignHBtn = evt.target.closest('[data-lbl-align-h]');
      if (alignHBtn && state.selectedEl) {
        const bundle = getWidgetLabelState(state.selectedEl);
        if (bundle) {
          const val = alignHBtn.getAttribute('data-lbl-align-h');
          bundle.lbl.alignH = val;
          bundle.lbl.dirty = true;
          document.querySelectorAll('[data-lbl-align-h]').forEach(b => {
            const active = b.getAttribute('data-lbl-align-h') === val;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          applyWidgetLabelToDom(bundle.targetEl, bundle.lbl);
          saveWidgetLabelEdit(bundle.targetEl, bundle.lbl, true).then(result => {
            const fb = document.getElementById('wb-text-feedback');
            if (fb) fb.textContent = result.method === 'studio-server' ? '✓ Label saved to ui-edits.js' : '✓ Label saved';
          });
        }
        return;
      }

      const alignVBtn = evt.target.closest('[data-lbl-align-v]');
      if (alignVBtn && state.selectedEl) {
        const bundle = getWidgetLabelState(state.selectedEl);
        if (bundle) {
          const val = alignVBtn.getAttribute('data-lbl-align-v');
          bundle.lbl.alignV = val;
          bundle.lbl._alignVEdited = true;
          bundle.lbl.dirty = true;
          document.querySelectorAll('[data-lbl-align-v]').forEach(b => {
            const active = b.getAttribute('data-lbl-align-v') === val;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          applyWidgetLabelToDom(bundle.targetEl, bundle.lbl);
          saveWidgetLabelEdit(bundle.targetEl, bundle.lbl, true).then(result => {
            const fb = document.getElementById('wb-text-feedback');
            if (fb) fb.textContent = result.method === 'studio-server' ? '✓ Label saved to ui-edits.js' : '✓ Label saved';
          });
        }
        return;
      }

      const fontToggleBtn = evt.target.closest('[data-lbl-font-toggle]');
      if (fontToggleBtn && state.selectedEl) {
        const bundle = getWidgetLabelState(state.selectedEl);
        if (bundle) {
          const prop = fontToggleBtn.getAttribute('data-lbl-font-toggle');
          bundle.lbl[prop] = !bundle.lbl[prop];
          bundle.lbl.dirty = true;
          fontToggleBtn.classList.toggle('is-active', Boolean(bundle.lbl[prop]));
          fontToggleBtn.setAttribute('aria-pressed', bundle.lbl[prop] ? 'true' : 'false');
          applyWidgetLabelToDom(bundle.targetEl, bundle.lbl);
          saveWidgetLabelEdit(bundle.targetEl, bundle.lbl, true).then(result => {
            const fb = document.getElementById('wb-text-feedback');
            if (fb) fb.textContent = result.method === 'studio-server' ? '✓ Label saved to ui-edits.js' : '✓ Label saved';
          });
        }
        return;
      }

      const flipBtn = evt.target.closest('[data-img-flip]');
      if (flipBtn && state.selectedEl) {
        const ctx = getSelectedImageContext();
        if (ctx) {
          const axis = flipBtn.getAttribute('data-img-flip');
          const img = getWidgetImageState(ctx.targetEl);
          if (axis === 'x') img.flipX = !img.flipX;
          else if (axis === 'y') img.flipY = !img.flipY;
          img.dirty = true;
          const active = axis === 'x' ? img.flipX : img.flipY;
          flipBtn.classList.toggle('is-active', Boolean(active));
          flipBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
          applyWidgetImageToDom(ctx.targetEl, img, ctx.isBtn ? ctx.hostEl : null);
          saveWidgetImageEdit(ctx.targetEl, img, true).then(result => {
            const fb = document.getElementById('wb-sprite-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? `✓ ${ctx.isBtn ? 'Button' : 'Image'} saved to ui-edits.js`
                  : `✓ ${ctx.isBtn ? 'Button' : 'Image'} saved`;
            }
          });
        }
        return;
      }

      const clSpriteClearBtn = evt.target.closest('[data-cl-sprite-clear]');
      if (clSpriteClearBtn && state.selectedEl) {
        evt.stopPropagation();
        const attrName = clSpriteClearBtn.getAttribute('data-cl-sprite-clear');
        const ctx = getSelectedImageContext();
        if (ctx && attrName) {
          clearWidgetSpriteAttr(ctx.targetEl, attrName, state.swapAllSprites).then(result => {
            const fb = document.getElementById('wb-sprite-feedback');
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? `✓ Cleared ${formatSliceAttrStateLabel(attrName)} & saved`
                  : `✓ Cleared ${formatSliceAttrStateLabel(attrName)}`;
            }
          });
        }
        return;
      }

      const clSpritePickBtn = evt.target.closest('[data-cl-sprite-pick]');
      if (clSpritePickBtn && !evt.target.closest('[data-insp-edit-resource-s9]') && state.selectedEl) {
        const attrName = clSpritePickBtn.getAttribute('data-cl-sprite-pick') || 'data-slice-id';
        const ctx = getSelectedImageContext();
        if (ctx) {
          openSpritePicker(attrName, ctx.targetEl);
        }
        return;
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

      const tintClearBtn = evt.target.closest('[data-insp-tint-clear]');
      if (tintClearBtn && state.selectedEl) {
        clearWidgetTint(state.selectedEl, true).then(result => {
          renderInspector();
          const fb = document.getElementById('wb-tint-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server' ? '✓ Tint cleared & saved to ui-edits.js' : '✓ Tint cleared';
          }
        });
        return;
      }

      const tintModeBtn = evt.target.closest('[data-insp-tint-mode]');
      if (tintModeBtn && state.selectedEl) {
        const nextMode = tintModeBtn.getAttribute('data-insp-tint-mode') || 'auto';
        const hexEl = document.getElementById('wb-insp-tint-hex');
        const colEl = document.getElementById('wb-insp-tint-color');
        const hexVal = (hexEl && hexEl.value.trim()) || (colEl && colEl.value) || '#f3c65f';
        setWidgetTint(state.selectedEl, hexVal, nextMode, true).then(result => {
          renderInspector();
          const fb = document.getElementById('wb-tint-feedback');
          if (fb) {
            fb.textContent =
              result.method === 'studio-server'
                ? `✓ Tint (${nextMode}) saved to ui-edits.js`
                : `✓ Tint (${nextMode}) applied`;
          }
        });
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
              const metaSynced =
                result && result.data && Array.isArray(result.data.meta_synced) ? result.data.meta_synced : [];
              fbAfter.textContent =
                result.method === 'studio-server' || result.method === 'file-system-api'
                  ? metaSynced.length > 0
                    ? '✓ Saved to catalog & Craftland .png.meta!'
                    : '✓ Saved permanently for future uses!'
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
            if (fb) {
              fb.textContent =
                result.method === 'studio-server'
                  ? '✓ Saved permanently to ui-edits.js!'
                  : '✓ Saved in browser storage';
            }
          });
        }
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-lbl-color') && state.selectedEl) {
        applyLabelFieldEdit(evt.target.getAttribute('data-lbl-color'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-lbl-hex') && state.selectedEl) {
        applyLabelFieldEdit(evt.target.getAttribute('data-lbl-hex'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-lbl-slider') && state.selectedEl) {
        applyLabelFieldEdit(evt.target.getAttribute('data-lbl-slider'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-lbl-field') && state.selectedEl) {
        const f = evt.target.getAttribute('data-lbl-field');
        const val = evt.target.type === 'checkbox' ? evt.target.checked : evt.target.value;
        applyLabelFieldEdit(f, val, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-img-color') && state.selectedEl) {
        applyImageFieldEdit(evt.target.getAttribute('data-img-color'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-img-hex') && state.selectedEl) {
        applyImageFieldEdit(evt.target.getAttribute('data-img-hex'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-img-slider') && state.selectedEl) {
        applyImageFieldEdit(evt.target.getAttribute('data-img-slider'), evt.target.value, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-img-field') && state.selectedEl) {
        const f = evt.target.getAttribute('data-img-field');
        const val = evt.target.type === 'checkbox' ? evt.target.checked : evt.target.value;
        applyImageFieldEdit(f, val, true);
      } else if (evt.target.hasAttribute && evt.target.hasAttribute('data-cl-sprite-input') && state.selectedEl) {
        const attrName = evt.target.getAttribute('data-cl-sprite-input') || 'data-slice-id';
        const ctx = getSelectedImageContext();
        if (ctx) {
          const val = String(evt.target.value || '').trim();
          if (!val && (attrName === 'data-slice-pressed' || attrName === 'data-slice-hover')) {
            clearWidgetSpriteAttr(ctx.targetEl, attrName, state.swapAllSprites);
          } else if (val) {
            changeWidgetSprite(ctx.targetEl, attrName, val, state.swapAllSprites).then(result => {
              const fb = document.getElementById('wb-sprite-feedback');
              if (fb) {
                fb.textContent = !result.ok
                  ? result.error || `Unknown slice ID: "${val}"`
                  : result.method === 'studio-server'
                    ? `✓ Set ${formatSliceAttrStateLabel(attrName)} → "${val}" & saved`
                    : `✓ Set ${formatSliceAttrStateLabel(attrName)} → "${val}"`;
              }
            });
          }
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
      } else if (evt.key === 'Enter' && evt.target && evt.target.hasAttribute('data-cl-sprite-input')) {
        evt.preventDefault();
        evt.target.blur();
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
      if (evt.target && evt.target.hasAttribute && state.selectedEl) {
        if (evt.target.hasAttribute('data-lbl-color')) {
          applyLabelFieldEdit(evt.target.getAttribute('data-lbl-color'), evt.target.value, false);
          return;
        }
        if (evt.target.hasAttribute('data-lbl-hex')) {
          const hex = normalizeHexColor(evt.target.value, '');
          if (hex) applyLabelFieldEdit(evt.target.getAttribute('data-lbl-hex'), hex, false);
          return;
        }
        if (evt.target.hasAttribute('data-lbl-slider')) {
          applyLabelFieldEdit(evt.target.getAttribute('data-lbl-slider'), evt.target.value, false);
          return;
        }
        if (evt.target.hasAttribute('data-lbl-field') && evt.target.type !== 'checkbox' && evt.target.tagName !== 'SELECT') {
          applyLabelFieldEdit(evt.target.getAttribute('data-lbl-field'), evt.target.value, false);
          return;
        }
        if (evt.target.hasAttribute('data-img-color')) {
          applyImageFieldEdit(evt.target.getAttribute('data-img-color'), evt.target.value, false);
          return;
        }
        if (evt.target.hasAttribute('data-img-hex')) {
          const hex = normalizeHexColor(evt.target.value, '');
          if (hex) applyImageFieldEdit(evt.target.getAttribute('data-img-hex'), hex, false);
          return;
        }
        if (evt.target.hasAttribute('data-img-slider')) {
          applyImageFieldEdit(evt.target.getAttribute('data-img-slider'), evt.target.value, false);
          return;
        }
        if (evt.target.hasAttribute('data-img-field') && evt.target.type !== 'checkbox' && evt.target.tagName !== 'SELECT') {
          applyImageFieldEdit(evt.target.getAttribute('data-img-field'), evt.target.value, false);
          return;
        }
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
        (state.anchorPresetOpen || state.transformMenuOpen || state.labelMenuOpen || state.imageMenuOpen || state.buttonMenuOpen) &&
        evt.target &&
        evt.target.closest &&
        !evt.target.closest(
          '#wb-tf-preset-popover, [data-tf-preset-btn], #wb-tf-menu-dropdown, [data-tf-menu-toggle], .wb-tf-menu-dropdown, [data-cl-menu-toggle]'
        )
      ) {
        closeTransformPopovers();
      }
      if (evt.button !== 0 || !evt.target || typeof evt.target.closest !== 'function') return;

      const clScrubHandle = state.selectedEl ? evt.target.closest('[data-cl-scrub-handle]') : null;
      if (clScrubHandle) {
        const field = clScrubHandle.getAttribute('data-cl-scrub-handle');
        const bundle = getWidgetLabelState(state.selectedEl);
        if (bundle && (field === 'shadowOffsetX' || field === 'shadowOffsetY')) {
          const scrubWrap = clScrubHandle.closest('[data-cl-scrub]') || clScrubHandle.parentElement;
          const inp = scrubWrap ? scrubWrap.querySelector(`[data-lbl-field="${field}"]`) : null;
          const startVal = field === 'shadowOffsetX'
            ? (Array.isArray(bundle.lbl.shadowOffset) ? bundle.lbl.shadowOffset[0] : 1)
            : (Array.isArray(bundle.lbl.shadowOffset) ? bundle.lbl.shadowOffset[1] : 1);
          evt.preventDefault();
          document.body.classList.add('is-tf-scrubbing');
          if (scrubWrap) scrubWrap.classList.add('is-scrubbing');
          clScrub = {
            field,
            inp,
            scrubWrap,
            lastClientX: evt.clientX,
            accumVal: Number(startVal) || 0,
          };
          return;
        }
      }

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
      if (clScrub) {
        const dx = evt.clientX - clScrub.lastClientX;
        clScrub.lastClientX = evt.clientX;
        if (dx === 0) return;
        const step = evt.altKey ? 0.1 : evt.shiftKey ? 2 : 0.5;
        clScrub.accumVal += dx * step;
        const nextVal = evt.altKey ? roundTfNum(clScrub.accumVal, 1) : Math.round(clScrub.accumVal);
        if (clScrub.inp) clScrub.inp.value = formatTfVal(nextVal, 1);
        applyLabelFieldEdit(clScrub.field, nextVal, false);
        return;
      }

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
      if (clScrub) {
        const endedCl = clScrub;
        clScrub = null;
        document.body.classList.remove('is-tf-scrubbing');
        if (endedCl.scrubWrap) endedCl.scrubWrap.classList.remove('is-scrubbing');
        const val = endedCl.inp ? parseFloat(endedCl.inp.value) : Math.round(endedCl.accumVal);
        if (Number.isFinite(val)) {
          applyLabelFieldEdit(endedCl.field, val, true);
        }
        return;
      }

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

  function slugToPascalDraft(slug) {
    const base = String(slug || 'Preview')
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    return (base || 'Preview') + 'Draft';
  }

  const craftlandExportState = {
    checked: false,
    serverOnline: false,
    mcpDetected: false,
    mcpUrl: '',
    mcpSource: '',
    projectRoot: '',
    existingUiDirs: ['Assets/HUDs/_Draft'],
  };

  function _exportPrefKey(kind) {
    const rootKey = (craftlandExportState.projectRoot || global.location.pathname || 'default').toLowerCase();
    return `px_export_${kind}::${rootKey}`;
  }

  function _readExportPref(kind) {
    try {
      return global.localStorage ? global.localStorage.getItem(_exportPrefKey(kind)) || '' : '';
    } catch {
      return '';
    }
  }

  function _writeExportPref(kind, value) {
    try {
      if (global.localStorage) {
        if (value) global.localStorage.setItem(_exportPrefKey(kind), value);
        else global.localStorage.removeItem(_exportPrefKey(kind));
      }
    } catch {
      // Ignore storage errors
    }
  }

  function renderCraftlandExportMcpState() {
    const banner = document.getElementById('wb-export-mcp-banner');
    const mcpLabel = document.getElementById('wb-export-mcp-label');
    const mcpInput = document.getElementById('wb-export-mcp-url');
    const dirLabel = document.getElementById('wb-export-ui-dir-label');
    const dirInput = document.getElementById('wb-export-ui-dir');
    const dirList = document.getElementById('wb-export-ui-dir-list');
    const dirChips = document.getElementById('wb-export-dir-chips');
    const saveRow = document.getElementById('wb-export-save-mcp-row');

    const dirs = Array.isArray(craftlandExportState.existingUiDirs) && craftlandExportState.existingUiDirs.length
      ? craftlandExportState.existingUiDirs
      : ['Assets/HUDs/_Draft'];

    if (dirList) {
      dirList.innerHTML = dirs.map(d => `<option value="${escapeHtml(d)}"></option>`).join('');
    }
    if (dirChips) {
      dirChips.hidden = false;
      dirChips.innerHTML = dirs
        .slice(0, 5)
        .map(d => `<button type="button" class="wb-export-dir-chip" data-wb-export-dir-pick="${escapeHtml(d)}">${escapeHtml(d)}</button>`)
        .join('');
    }

    if (!craftlandExportState.checked) {
      if (banner) {
        banner.className = 'wb-export-mcp-banner';
        banner.textContent = 'Checking project Craftland MCP configuration…';
      }
      return;
    }

    if (!craftlandExportState.serverOnline) {
      if (banner) {
        banner.className = 'wb-export-mcp-banner is-warn';
        banner.innerHTML =
          '<strong>Studio backend offline.</strong> Double-click <code>launch_ui_hub.bat</code> in UICreator to enable live export, then provide your MCP URL &amp; output directory if needed.';
      }
      if (mcpLabel) mcpLabel.textContent = 'Craftland MCP URL';
      if (dirLabel) dirLabel.textContent = 'Target Output Directory';
      if (saveRow) saveRow.hidden = false;
      return;
    }

    if (craftlandExportState.mcpDetected) {
      if (banner) {
        banner.className = 'wb-export-mcp-banner is-ok';
        const srcTag = craftlandExportState.mcpSource ? ` (${escapeHtml(craftlandExportState.mcpSource)})` : '';
        banner.innerHTML = `<strong>✓ MCP detected${srcTag}:</strong> <code>${escapeHtml(craftlandExportState.mcpUrl)}</code>`;
      }
      if (mcpLabel) mcpLabel.textContent = 'Craftland MCP URL Override (optional — auto-detected)';
      if (mcpInput) {
        mcpInput.placeholder = `Auto-detected: ${craftlandExportState.mcpUrl}`;
        mcpInput.classList.remove('is-prompt-required', 'is-field-error');
      }
      if (dirLabel) dirLabel.textContent = 'Target Output Directory';
      if (dirInput) {
        dirInput.classList.remove('is-prompt-required', 'is-field-error');
      }
      if (saveRow) {
        saveRow.hidden = !(mcpInput && mcpInput.value.trim());
      }
    } else {
      if (banner) {
        banner.className = 'wb-export-mcp-banner is-warn';
        banner.innerHTML =
          '<strong>⚠ No Craftland Studio MCP detected in this project.</strong> Please enter your Craftland MCP URL and choose an output directory below.';
      }
      if (mcpLabel) mcpLabel.textContent = 'Craftland MCP URL (Required)';
      if (mcpInput) {
        mcpInput.placeholder = 'e.g. http://127.0.0.1:18080/mcp';
        mcpInput.classList.toggle('is-prompt-required', !mcpInput.value.trim());
      }
      if (dirLabel) dirLabel.textContent = 'Target Output Directory (Required)';
      if (dirInput) {
        dirInput.classList.toggle('is-prompt-required', !dirInput.value.trim());
      }
      if (saveRow) saveRow.hidden = false;
    }
  }

  function ensureCraftlandExportModal() {
    let modal = document.getElementById('wb-export-ui-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'wb-export-ui-modal';
    modal.className = 'wb-export-modal-backdrop';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="wb-export-modal" role="dialog" aria-modal="true" aria-labelledby="wb-export-modal-title">
        <div class="wb-export-modal-head">
          <span id="wb-export-modal-title" class="wb-export-modal-title">Export View to Craftland Studio (.ui Draft)</span>
          <button type="button" class="wb-btn wb-btn-sm" data-wb-export-close>✕</button>
        </div>
        <div class="wb-export-modal-body">
          <div id="wb-export-mcp-banner" class="wb-export-mcp-banner">Checking project Craftland MCP configuration…</div>
          <div class="wb-export-field">
            <label for="wb-export-view">Active View (<code>[data-ui-view]</code>)</label>
            <select id="wb-export-view" class="wb-select"></select>
          </div>
          <div class="wb-export-field">
            <label for="wb-export-ui-name">Target Draft UI Name</label>
            <input id="wb-export-ui-name" class="wb-slice-input" type="text" placeholder="CheckpointRewardDraft">
          </div>
          <div class="wb-export-field">
            <label id="wb-export-ui-dir-label" for="wb-export-ui-dir">Target Output Directory</label>
            <input id="wb-export-ui-dir" class="wb-slice-input" type="text" list="wb-export-ui-dir-list" placeholder="e.g. Assets/HUDs/_Draft">
            <datalist id="wb-export-ui-dir-list"></datalist>
            <div id="wb-export-dir-chips" class="wb-export-dir-chips" hidden></div>
          </div>
          <div class="wb-export-field">
            <label id="wb-export-mcp-label" for="wb-export-mcp-url">Craftland MCP URL Override (optional)</label>
            <input id="wb-export-mcp-url" class="wb-slice-input" type="text" placeholder="Auto-detect from .mcp.json, .codex/config.toml, or .cursor/mcp.json">
            <label id="wb-export-save-mcp-row" class="wb-export-checkbox-row" hidden>
              <input id="wb-export-save-mcp" type="checkbox">
              <span>Save MCP URL to project <code>.mcp.json</code> for future exports</span>
            </label>
          </div>
          <div class="wb-export-actions">
            <button type="button" class="wb-btn" data-wb-export-run="dry">Dry-Run Plan</button>
            <button type="button" class="wb-btn wb-btn--primary" data-wb-export-run="live">Export to Craftland (.ui)</button>
          </div>
          <div id="wb-export-status" class="wb-export-status" hidden></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', evt => {
      if (evt.target === modal || evt.target.closest('[data-wb-export-close]')) {
        modal.hidden = true;
        return;
      }
      const dirPick = evt.target.closest('[data-wb-export-dir-pick]');
      if (dirPick) {
        const dirInput = document.getElementById('wb-export-ui-dir');
        if (dirInput) {
          dirInput.value = dirPick.getAttribute('data-wb-export-dir-pick') || '';
          dirInput.classList.remove('is-prompt-required', 'is-field-error');
          dirInput.focus();
        }
        return;
      }
      const runBtn = evt.target.closest('[data-wb-export-run]');
      if (runBtn) {
        const isDry = runBtn.getAttribute('data-wb-export-run') === 'dry';
        triggerCraftlandUiExport(isDry);
      }
    });

    modal.addEventListener('input', evt => {
      const target = evt.target;
      if (target && target.id === 'wb-export-mcp-url') {
        target.classList.remove('is-field-error');
        target.classList.toggle('is-prompt-required', !craftlandExportState.mcpDetected && !target.value.trim());
        const saveRow = document.getElementById('wb-export-save-mcp-row');
        if (saveRow) {
          saveRow.hidden = craftlandExportState.mcpDetected && !target.value.trim();
        }
      } else if (target && target.id === 'wb-export-ui-dir') {
        target.classList.remove('is-field-error');
        target.classList.toggle('is-prompt-required', !craftlandExportState.mcpDetected && !target.value.trim());
      }
    });
    return modal;
  }

  async function openCraftlandExportModal() {
    const modal = ensureCraftlandExportModal();
    const viewSelect = document.getElementById('wb-export-view');
    const nameInput = document.getElementById('wb-export-ui-name');
    const dirInput = document.getElementById('wb-export-ui-dir');
    const mcpInput = document.getElementById('wb-export-mcp-url');
    const statusBox = document.getElementById('wb-export-status');

    const views = Array.from(document.querySelectorAll('#game-canvas [data-ui-view]'));
    const activeViewEl =
      document.querySelector('#game-canvas [data-ui-view].is-active') ||
      views.find(v => !v.hidden) ||
      views[0];
    const activeViewId = activeViewEl ? activeViewEl.getAttribute('data-ui-view') : 'main';

    if (viewSelect) {
      if (views.length === 0) {
        viewSelect.innerHTML = `<option value="main">main</option>`;
      } else {
        viewSelect.innerHTML = views
          .map(v => {
            const vid = v.getAttribute('data-ui-view') || 'main';
            return `<option value="${escapeHtml(vid)}"${vid === activeViewId ? ' selected' : ''}>${escapeHtml(vid)}</option>`;
          })
          .join('');
      }
    }

    const slug = getPreviewSlugForEdits();
    if (nameInput && !nameInput.value.trim()) {
      nameInput.value = slugToPascalDraft(slug);
    }
    if (statusBox) {
      statusBox.hidden = true;
      statusBox.innerHTML = '';
    }

    craftlandExportState.checked = false;
    renderCraftlandExportMcpState();
    modal.hidden = false;

    const cfgRes = await getFromStudioServer('/api/export-config');
    craftlandExportState.checked = true;
    if (cfgRes.ok && cfgRes.data) {
      craftlandExportState.serverOnline = true;
      craftlandExportState.mcpDetected = Boolean(cfgRes.data.mcpDetected);
      craftlandExportState.mcpUrl = cfgRes.data.mcpUrl || '';
      craftlandExportState.mcpSource = cfgRes.data.mcpSource || '';
      craftlandExportState.projectRoot = cfgRes.data.projectRoot || '';
      craftlandExportState.existingUiDirs =
        Array.isArray(cfgRes.data.existingUiDirs) && cfgRes.data.existingUiDirs.length
          ? cfgRes.data.existingUiDirs
          : ['Assets/HUDs/_Draft'];
    } else {
      craftlandExportState.serverOnline = false;
      craftlandExportState.mcpDetected = false;
      craftlandExportState.mcpUrl = '';
      craftlandExportState.mcpSource = '';
    }

    const savedDir = _readExportPref('ui_dir');
    const savedMcp = _readExportPref('mcp_url');
    if (mcpInput && !mcpInput.value.trim() && !craftlandExportState.mcpDetected && savedMcp) {
      mcpInput.value = savedMcp;
    }
    if (dirInput && !dirInput.value.trim()) {
      if (savedDir) {
        dirInput.value = savedDir;
      } else if (craftlandExportState.mcpDetected) {
        dirInput.value = craftlandExportState.existingUiDirs[0] || 'Assets/HUDs/_Draft';
      }
      // When no MCP is detected and no directory was chosen yet, leave dirInput empty so the user is prompted to pick/enter one
    }

    renderCraftlandExportMcpState();
    if (craftlandExportState.serverOnline && !craftlandExportState.mcpDetected) {
      if (mcpInput && !mcpInput.value.trim()) {
        mcpInput.focus();
      } else if (dirInput && !dirInput.value.trim()) {
        dirInput.focus();
      }
    }
  }

  async function triggerCraftlandUiExport(dryRun) {
    const statusBox = document.getElementById('wb-export-status');
    const viewSelect = document.getElementById('wb-export-view');
    const nameInput = document.getElementById('wb-export-ui-name');
    const dirInput = document.getElementById('wb-export-ui-dir');
    const mcpInput = document.getElementById('wb-export-mcp-url');
    const saveMcpCb = document.getElementById('wb-export-save-mcp');

    const slug = getPreviewSlugForEdits();
    const view = (viewSelect && viewSelect.value) || '';
    const uiName = (nameInput && nameInput.value.trim()) || slugToPascalDraft(slug);
    const rawUiDir = (dirInput && dirInput.value.trim()) || '';
    const mcpUrl = (mcpInput && mcpInput.value.trim()) || '';
    const saveMcpConfig = Boolean(saveMcpCb && saveMcpCb.checked && mcpUrl);

    if (!dryRun) {
      if (craftlandExportState.checked && !craftlandExportState.mcpDetected && !mcpUrl) {
        if (mcpInput) {
          mcpInput.classList.add('is-field-error', 'is-prompt-required');
          mcpInput.focus();
        }
        if (statusBox) {
          statusBox.hidden = false;
          statusBox.className = 'wb-export-status is-error';
          statusBox.innerHTML =
            '<strong>MCP URL required:</strong> No Craftland Studio MCP server was detected in this project. Please enter the Craftland MCP URL above.';
        }
        return;
      }
      if (!rawUiDir) {
        if (dirInput) {
          dirInput.classList.add('is-field-error', 'is-prompt-required');
          dirInput.focus();
        }
        if (statusBox) {
          statusBox.hidden = false;
          statusBox.className = 'wb-export-status is-error';
          statusBox.innerHTML =
            '<strong>Output directory required:</strong> Please enter or pick a target Craftland directory (for example <code>Assets/HUDs/_Draft</code>).';
        }
        return;
      }
    }

    const uiDirectory = rawUiDir || 'Assets/HUDs/_Draft';
    if (rawUiDir) _writeExportPref('ui_dir', rawUiDir);
    if (mcpUrl) _writeExportPref('mcp_url', mcpUrl);

    if (statusBox) {
      statusBox.hidden = false;
      statusBox.className = 'wb-export-status';
      statusBox.textContent = dryRun
        ? 'Extracting 1500×750 DOM layout plan via Playwright (dry-run)…'
        : 'Extracting 1500×750 DOM layout plan and pushing entities to Craftland Studio MCP…';
    }

    await persistUiEditsToDisk();
    const res = await postToStudioServer('/api/export-craftland-ui', {
      slug,
      view,
      uiName,
      uiDirectory: dryRun ? uiDirectory : rawUiDir,
      mcpUrl,
      saveMcpConfig,
      dryRun: Boolean(dryRun),
    });

    if (!statusBox) return;
    if (!res.ok) {
      const errCode = res.data && res.data.code;
      if (errCode === 'MCP_NOT_DETECTED') {
        craftlandExportState.checked = true;
        craftlandExportState.serverOnline = true;
        craftlandExportState.mcpDetected = false;
        renderCraftlandExportMcpState();
        if (mcpInput) {
          mcpInput.classList.add('is-field-error', 'is-prompt-required');
          mcpInput.focus();
        }
        if (dirInput && !dirInput.value.trim()) {
          dirInput.classList.add('is-prompt-required');
        }
      } else if (errCode === 'OUTPUT_DIR_REQUIRED' && dirInput) {
        dirInput.classList.add('is-field-error', 'is-prompt-required');
        dirInput.focus();
      }
      statusBox.className = 'wb-export-status is-error';
      const errMsg =
        res.error ||
        'Studio backend server on port 17890 is not running. Start launch_ui_hub.bat or slice_sprites.py --serve.';
      statusBox.innerHTML = `<strong>Export failed:</strong> ${escapeHtml(errMsg)}`;
      return;
    }

    const d = res.data || {};
    if (d.savedMcpPath && mcpUrl) {
      craftlandExportState.mcpDetected = true;
      craftlandExportState.mcpUrl = mcpUrl;
      craftlandExportState.mcpSource = d.savedMcpPath;
      renderCraftlandExportMcpState();
    }
    const warnList = Array.isArray(d.warnings) ? d.warnings : [];
    const warnHtml =
      warnList.length > 0
        ? `<div class="wb-export-warns"><strong>Warnings (${warnList.length}):</strong><ul>${warnList
            .map(w => `<li>${escapeHtml(typeof w === 'string' ? w : w.message || JSON.stringify(w))}</li>`)
            .join('')}</ul></div>`
        : '';

    const syncedMetaList = Array.isArray(d.syncedMetaSlice9) ? d.syncedMetaSlice9 : [];
    const metaSyncHtml =
      syncedMetaList.length > 0
        ? `<div>9-Slice <code>.png.meta</code> ${d.dryRun ? 'pending sync' : 'synced'}: <strong>${syncedMetaList.length}</strong> texture(s)</div>`
        : '';

    statusBox.className = 'wb-export-status is-ok';
    if (d.dryRun) {
      statusBox.innerHTML = `
        <div><strong>✓ Dry-Run Plan Generated</strong> (${d.entityCount || 0} Craftland entities)</div>
        <div>Target: <code>${escapeHtml(d.uiPath || `${uiDirectory}/${uiName}.ui`)}</code></div>
        ${d.planPath ? `<div>Plan JSON: <code>${escapeHtml(d.planPath)}</code></div>` : ''}
        ${metaSyncHtml}
        ${warnHtml}
      `;
    } else {
      statusBox.innerHTML = `
        <div><strong>✓ Exported to Craftland Studio!</strong> (${d.entityCount || 0} entities created &amp; saved)</div>
        <div>Asset: <code>${escapeHtml(d.uiPath || `${uiDirectory}/${uiName}.ui`)}</code> (ID: <code>${escapeHtml(d.uiId || '')}</code>)</div>
        ${d.savedMcpPath ? `<div>Saved MCP config: <code>${escapeHtml(d.savedMcpPath)}</code></div>` : ''}
        ${d.planPath ? `<div>Plan JSON: <code>${escapeHtml(d.planPath)}</code></div>` : ''}
        ${metaSyncHtml}
        ${warnHtml}
      `;
    }
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
    loadSavedBackdrop();
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

    const resParam = params.get('res');
    setCanvasResolution(resParam || getDefaultCanvasRes());

    const l10nParam = params.get('l10n');
    if (l10nParam) setL10nStressMode(l10nParam);

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
    else {
      renderHierarchyTree();
      updateHudBudgetBadge();
    }
  }

  global.PixelUI = {
    init,
    hydrateSprites,
    applySliceToElement,
    applyTintToElement,
    setWidgetTint,
    clearWidgetTint,
    toggleFocusZone,
    toggleSafeZones,
    setCanvasResolution,
    setL10nStressMode,
    CANVAS_PRESETS,
    setCustomBackdrop,
    clearCustomBackdrop,
    computeHudBudget,
    updateHudBudgetBadge,
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
    getWidgetLabel: getWidgetLabelState,
    applyWidgetLabel: applyWidgetLabelToDom,
    getWidgetImage: getWidgetImageState,
    applyWidgetImage: applyWidgetImageToDom,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
