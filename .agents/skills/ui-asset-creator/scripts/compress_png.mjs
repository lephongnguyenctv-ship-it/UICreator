#!/usr/bin/env node
/**
 * Custom PNG8 (Indexed PLTE + tRNS) RGBA Quantizer & Compressor
 * Zero dependencies — uses only Node.js built-in fs & zlib.
 *
 * Pipeline:
 * 1. Decode 8-bit RGB/RGBA PNG (unfiltering None/Sub/Up/Average/Paeth).
 * 2. Quantize distinct RGBA colors via frequency-weighted Median-Cut + K-Means refinement
 *    in perceptual YCbCrA space, keeping alpha=0 exact and preserving pure black/white.
 * 3. Order palette with alpha<255 entries first (minimal tRNS chunk) and opaque colors
 *    sorted by luminance/chroma for tighter scanline prediction.
 * 4. Map pixels with edge-safe Floyd-Steinberg dithering (skipping flat outlines & alpha=0).
 * 5. Encode PNG8 with per-row optimal scanline filtering + multi-strategy zlib level 9.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------- CRC32 & PNG Chunk Helpers ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const out = Buffer.allocUnsafe(12 + len);
  out.writeUInt32BE(len, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  out.writeUInt32BE(crc, 8 + len);
  return out;
}

// ---------------- PNG Decoder (RGB/RGBA 8-bit) ----------------
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePng(filePath) {
  const raw = fs.readFileSync(filePath);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!raw.subarray(0, 8).equals(sig)) throw new Error('Not a valid PNG file');

  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  let plte = null, trns = null;
  const idatParts = [];

  while (pos < raw.length) {
    const len = raw.readUInt32BE(pos);
    const type = raw.subarray(pos + 4, pos + 8).toString('ascii');
    const data = raw.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2 && colorType !== 3)) {
        throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType} (expected 8-bit RGB, RGBA, or Indexed)`);
      }
    } else if (type === 'PLTE') {
      plte = data;
    } else if (type === 'tRNS') {
      trns = data;
    } else if (type === 'IDAT') {
      idatParts.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const bpp = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
  const stride = width * bpp;
  const inflated = zlib.inflateSync(Buffer.concat(idatParts));
  const rgba = new Uint8Array(width * height * 4);
  const prevRow = new Uint8Array(stride);
  const curRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    for (let i = 0; i < stride; i++) {
      const x = inflated[rowStart + 1 + i];
      const a = i >= bpp ? curRow[i - bpp] : 0;
      const b = prevRow[i];
      const c = i >= bpp ? prevRow[i - bpp] : 0;
      let val;
      if (filter === 0) val = x;
      else if (filter === 1) val = (x + a) & 0xff;
      else if (filter === 2) val = (x + b) & 0xff;
      else if (filter === 3) val = (x + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (x + paeth(a, b, c)) & 0xff;
      else throw new Error(`Unknown PNG filter ${filter}`);
      curRow[i] = val;
    }

    const outRow = y * width * 4;
    if (bpp === 4) {
      rgba.set(curRow, outRow);
    } else if (bpp === 3) {
      for (let x = 0; x < width; x++) {
        rgba[outRow + x * 4] = curRow[x * 3];
        rgba[outRow + x * 4 + 1] = curRow[x * 3 + 1];
        rgba[outRow + x * 4 + 2] = curRow[x * 3 + 2];
        rgba[outRow + x * 4 + 3] = 255;
      }
    } else {
      if (!plte) throw new Error('Indexed PNG missing PLTE chunk');
      for (let x = 0; x < width; x++) {
        const pIdx = curRow[x];
        rgba[outRow + x * 4] = plte[pIdx * 3];
        rgba[outRow + x * 4 + 1] = plte[pIdx * 3 + 1];
        rgba[outRow + x * 4 + 2] = plte[pIdx * 3 + 2];
        rgba[outRow + x * 4 + 3] = (trns && pIdx < trns.length) ? trns[pIdx] : 255;
      }
    }
    prevRow.set(curRow);
  }

  return { width, height, rgba };
}

// ---------------- Perceptual Color Space (Weighted Premultiplied RGBA) ----------------
// Converts RGBA (0..255) into weighted 4D vector [Y, Cb, Cr, A] for perceptual distance
function toPerceptual(r, g, b, a) {
  const af = a / 255.0;
  // Premultiply RGB by alpha so transparent pixels don't fight on RGB channels
  const pr = r * af;
  const pg = g * af;
  const pb = b * af;
  const Y = 0.299 * pr + 0.587 * pg + 0.114 * pb;
  const Cb = -0.168736 * pr - 0.331264 * pg + 0.5 * pb;
  const Cr = 0.5 * pr - 0.418688 * pg - 0.081312 * pb;
  // Weight alpha slightly higher to keep anti-aliased silhouettes smooth
  return [Y * 1.15, Cb * 1.35, Cr * 1.35, a * 1.6];
}

function distSq4(p1, p2) {
  const d0 = p1[0] - p2[0];
  const d1 = p1[1] - p2[1];
  const d2 = p1[2] - p2[2];
  const d3 = p1[3] - p2[3];
  return d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
}

// ---------------- Weighted Median-Cut + K-Means Quantizer ----------------
function quantizeGroup(samples, targetCount) {
  if (targetCount <= 0 || samples.length === 0) return [];
  if (samples.length <= targetCount) {
    return samples.map(s => ({ r: s.r, g: s.g, b: s.b, a: s.a, vec: s.vec }));
  }

  function makeBox(items) {
    const min = [Infinity, Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity, -Infinity];
    let totalW = 0;
    const mean = [0, 0, 0, 0];

    for (const it of items) {
      totalW += it.count;
      for (let d = 0; d < 4; d++) {
        const v = it.vec[d];
        if (v < min[d]) min[d] = v;
        if (v > max[d]) max[d] = v;
        mean[d] += v * it.count;
      }
    }
    for (let d = 0; d < 4; d++) mean[d] /= totalW;

    let err = 0;
    for (const it of items) err += it.count * distSq4(it.vec, mean);

    let splitAxis = 0;
    let maxSpan = -1;
    for (let d = 0; d < 4; d++) {
      const span = max[d] - min[d];
      if (span > maxSpan) { maxSpan = span; splitAxis = d; }
    }
    return { items, totalW, err, splitAxis };
  }

  const boxes = [makeBox(samples)];
  while (boxes.length < targetCount) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].items.length > 1 && boxes[i].err > bestScore) {
        bestScore = boxes[i].err;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;

    const box = boxes.splice(bestIdx, 1)[0];
    const axis = box.splitAxis;
    box.items.sort((u, v) => u.vec[axis] - v.vec[axis]);

    const halfW = box.totalW * 0.5;
    let acc = 0;
    let split = 1;
    for (let i = 0; i < box.items.length - 1; i++) {
      acc += box.items[i].count;
      if (acc >= halfW) { split = i + 1; break; }
    }
    boxes.push(makeBox(box.items.slice(0, split)));
    boxes.push(makeBox(box.items.slice(split)));
  }

  const centroids = boxes.map(box => {
    let sr = 0, sg = 0, sb = 0, sa = 0, sw = 0;
    for (const it of box.items) {
      const w = it.count;
      sr += it.r * w;
      sg += it.g * w;
      sb += it.b * w;
      sa += it.a * w;
      sw += w;
    }
    const r = Math.round(sr / sw);
    const g = Math.round(sg / sw);
    const b = Math.round(sb / sw);
    const a = Math.round(sa / sw);
    return { r, g, b, a, vec: toPerceptual(r, g, b, a) };
  });

  for (let iter = 0; iter < 4; iter++) {
    const k = centroids.length;
    const accR = new Float64Array(k);
    const accG = new Float64Array(k);
    const accB = new Float64Array(k);
    const accA = new Float64Array(k);
    const accW = new Float64Array(k);

    for (const s of samples) {
      let bestK = 0;
      let bestD = Infinity;
      for (let j = 0; j < k; j++) {
        const d = distSq4(s.vec, centroids[j].vec);
        if (d < bestD) { bestD = d; bestK = j; }
      }
      const w = s.count;
      accR[bestK] += s.r * w;
      accG[bestK] += s.g * w;
      accB[bestK] += s.b * w;
      accA[bestK] += s.a * w;
      accW[bestK] += w;
    }

    for (let j = 0; j < k; j++) {
      if (accW[j] > 0) {
        const r = Math.round(accR[j] / accW[j]);
        const g = Math.round(accG[j] / accW[j]);
        const b = Math.round(accB[j] / accW[j]);
        const a = Math.round(accA[j] / accW[j]);
        centroids[j] = { r, g, b, a, vec: toPerceptual(r, g, b, a) };
      }
    }
  }

  return centroids;
}

function buildPalette(rgba, width, height, maxColors = 256) {
  const n = width * height;
  const hist = new Map();

  let hasTransparent = false;
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const a = rgba[off + 3];
    if (a === 0) {
      hasTransparent = true;
      continue;
    }
    const r = rgba[off];
    const g = rgba[off + 1];
    const b = rgba[off + 2];
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const prev = hist.get(key);
    if (prev) prev.count++;
    else {
      hist.set(key, {
        r, g, b, a,
        count: 1,
        vec: toPerceptual(r, g, b, a),
      });
    }
  }

  const samples = Array.from(hist.values());
  const opaqueSamples = samples.filter(s => s.a === 255);
  const semiSamples = samples.filter(s => s.a < 255);
  const targetOpaqueAndSemi = hasTransparent ? maxColors - 1 : maxColors;

  // Cap semi-transparent edge slots so anti-aliased fringes never starve opaque interior colors
  let semiBudget = 0;
  let opaqueBudget = 0;
  if (semiSamples.length === 0) {
    opaqueBudget = targetOpaqueAndSemi;
  } else if (opaqueSamples.length === 0) {
    semiBudget = targetOpaqueAndSemi;
  } else {
    semiBudget = Math.min(semiSamples.length, Math.max(8, Math.min(24, Math.round(targetOpaqueAndSemi * 0.12))));
    opaqueBudget = Math.max(1, targetOpaqueAndSemi - semiBudget);
    if (opaqueSamples.length < opaqueBudget) {
      opaqueBudget = opaqueSamples.length;
      semiBudget = Math.min(semiSamples.length, targetOpaqueAndSemi - opaqueBudget);
    }
  }

  const centroids = [
    ...quantizeGroup(semiSamples, semiBudget),
    ...quantizeGroup(opaqueSamples, opaqueBudget),
  ];

  // Ensure pure black outline & pure white highlight exist cleanly if present in source
  const hasPureBlack = samples.some(s => s.r <= 4 && s.g <= 4 && s.b <= 4 && s.a === 255);
  const hasPureWhite = samples.some(s => s.r >= 252 && s.g >= 252 && s.b >= 252 && s.a === 255);
  if (hasPureBlack) {
    let minD = Infinity, idx = 0;
    for (let j = 0; j < centroids.length; j++) {
      const c = centroids[j];
      if (c.a === 255) {
        const d = c.r * c.r + c.g * c.g + c.b * c.b;
        if (d < minD) { minD = d; idx = j; }
      }
    }
    if (minD < 120) centroids[idx] = { r: 0, g: 0, b: 0, a: 255, vec: toPerceptual(0, 0, 0, 255) };
  }
  if (hasPureWhite) {
    let minD = Infinity, idx = 0;
    for (let j = 0; j < centroids.length; j++) {
      const c = centroids[j];
      if (c.a === 255) {
        const d = (255 - c.r) ** 2 + (255 - c.g) ** 2 + (255 - c.b) ** 2;
        if (d < minD) { minD = d; idx = j; }
      }
    }
    if (minD < 120) centroids[idx] = { r: 255, g: 255, b: 255, a: 255, vec: toPerceptual(255, 255, 255, 255) };
  }

  // Deduplicate exact identical entries and build ordered palette:
  // Index 0 = (0,0,0,0) if transparent exists, then semi-transparent (a < 255) sorted by alpha,
  // then opaque (a === 255) sorted by luminance for better PNG scanline compression.
  const uniq = new Map();
  for (const c of centroids) {
    const key = ((c.r << 24) | (c.g << 16) | (c.b << 8) | c.a) >>> 0;
    if (!uniq.has(key)) uniq.set(key, c);
  }
  const semi = [];
  const opaque = [];
  for (const c of uniq.values()) {
    if (c.a < 255) semi.push(c);
    else opaque.push(c);
  }
  semi.sort((u, v) => u.a - v.a || (u.r + u.g + u.b) - (v.r + v.g + v.b));
  opaque.sort((u, v) => (0.299 * u.r + 0.587 * u.g + 0.114 * u.b) - (0.299 * v.r + 0.587 * v.g + 0.114 * v.b));

  const palette = [];
  if (hasTransparent) palette.push({ r: 0, g: 0, b: 0, a: 0, vec: toPerceptual(0, 0, 0, 0) });
  for (const c of semi) palette.push(c);
  for (const c of opaque) palette.push(c);

  return palette;
}

// ---------------- Edge-Safe Floyd-Steinberg Dithering ----------------
function mapPixelsToPalette(rgba, width, height, palette) {
  const n = width * height;
  const indices = new Uint8Array(n);
  const palSize = palette.length;

  // Separate opaque palette indices for fast opaque lookup
  const firstOpaque = palette.findIndex(c => c.a === 255);
  const cache = new Map();

  function nearestIndex(r, g, b, a) {
    if (a === 0) return 0;
    const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const target = toPerceptual(r, g, b, a);
    let best = 0;
    let bestD = Infinity;
    const start = (a === 255 && firstOpaque >= 0) ? firstOpaque : (palette[0].a === 0 ? 1 : 0);
    for (let j = start; j < palSize; j++) {
      const d = distSq4(target, palette[j].vec);
      if (d < bestD) { bestD = d; best = j; }
    }
    cache.set(key, best);
    return best;
  }

  // Float error buffer for smooth gradient dithering (only on opaque pixels)
  const errBuf = new Float32Array(n * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const off = idx * 4;
      const a = rgba[off + 3];
      if (a === 0) {
        indices[idx] = 0;
        continue;
      }

      const origR = rgba[off];
      const origG = rgba[off + 1];
      const origB = rgba[off + 2];

      if (a < 255) {
        // Anti-aliased boundary: exact nearest match without error diffusion
        indices[idx] = nearestIndex(origR, origG, origB, a);
        continue;
      }

      const eOff = idx * 3;
      const r = Math.max(0, Math.min(255, Math.round(origR + errBuf[eOff])));
      const g = Math.max(0, Math.min(255, Math.round(origG + errBuf[eOff + 1])));
      const b = Math.max(0, Math.min(255, Math.round(origB + errBuf[eOff + 2])));

      const pIdx = nearestIndex(r, g, b, 255);
      indices[idx] = pIdx;

      const pal = palette[pIdx];
      // Sharpness-preserving thresholded dithering: only dither noticeable gradient steps,
      // keeping flat/near-flat cel shading completely stipple-free and Deflate-friendly
      const dr = r - pal.r;
      const dg = g - pal.g;
      const db = b - pal.b;
      const errMag = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
      if (errMag > 22 && errMag < 42) {
        const strength = 0.35;
        const er = dr * strength;
        const eg = dg * strength;
        const eb = db * strength;
        const push = (nx, ny, w) => {
          if (nx < 0 || nx >= width || ny >= height) return;
          const nIdx = ny * width + nx;
          if (rgba[nIdx * 4 + 3] !== 255) return; // never bleed across alpha edges
          const ne = nIdx * 3;
          errBuf[ne] += er * w;
          errBuf[ne + 1] += eg * w;
          errBuf[ne + 2] += eb * w;
        };
        push(x + 1, y, 7 / 16);
        push(x - 1, y + 1, 3 / 16);
        push(x, y + 1, 5 / 16);
        push(x + 1, y + 1, 1 / 16);
      }
    }
  }

  return indices;
}

// ---------------- Optimal PNG8 Encoder (PLTE + tRNS + Multi-Strategy Deflate) ----------------
function encodePng8(width, height, palette, indices) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // color type 3 = indexed palette
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const plte = Buffer.allocUnsafe(palette.length * 3);
  let lastAlphaIdx = -1;
  for (let i = 0; i < palette.length; i++) {
    plte[i * 3] = palette[i].r;
    plte[i * 3 + 1] = palette[i].g;
    plte[i * 3 + 2] = palette[i].b;
    if (palette[i].a < 255) lastAlphaIdx = i;
  }

  const trns = lastAlphaIdx >= 0 ? Buffer.allocUnsafe(lastAlphaIdx + 1) : null;
  if (trns) {
    for (let i = 0; i <= lastAlphaIdx; i++) trns[i] = palette[i].a;
  }

  // Build candidate scanline buffers:
  // A) All-None (often best for indexed PNG8!)
  // B) Adaptive minimum-SAD per row across all 5 filters
  const rawNone = Buffer.allocUnsafe(height * (width + 1));
  const rawAdaptive = Buffer.allocUnsafe(height * (width + 1));
  const candRow = Buffer.allocUnsafe(width + 1);

  for (let y = 0; y < height; y++) {
    const rowIn = indices.subarray(y * width, (y + 1) * width);
    const prevIn = y > 0 ? indices.subarray((y - 1) * width, y * width) : null;
    const outOff = y * (width + 1);

    // None
    rawNone[outOff] = 0;
    Buffer.from(rowIn.buffer, rowIn.byteOffset, width).copy(rawNone, outOff + 1);

    // Adaptive: test filters 0..4 and pick lowest sum-of-signed-bytes
    let bestFilter = 0;
    let bestSad = Infinity;
    let bestBuf = null;

    for (let f = 0; f <= 4; f++) {
      candRow[0] = f;
      let sad = 0;
      for (let x = 0; x < width; x++) {
        const cur = rowIn[x];
        const a = x > 0 ? rowIn[x - 1] : 0;
        const b = prevIn ? prevIn[x] : 0;
        const c = (prevIn && x > 0) ? prevIn[x - 1] : 0;
        let diff;
        if (f === 0) diff = cur;
        else if (f === 1) diff = (cur - a) & 0xff;
        else if (f === 2) diff = (cur - b) & 0xff;
        else if (f === 3) diff = (cur - ((a + b) >> 1)) & 0xff;
        else diff = (cur - paeth(a, b, c)) & 0xff;
        candRow[x + 1] = diff;
        sad += diff < 128 ? diff : 256 - diff;
      }
      if (sad < bestSad) {
        bestSad = sad;
        bestFilter = f;
        bestBuf = Buffer.from(candRow);
      }
    }
    bestBuf.copy(rawAdaptive, outOff);
  }

  // Test multiple zlib strategies & filter layouts, keep smallest IDAT
  const candidates = [];
  for (const rawBuf of [rawNone, rawAdaptive]) {
    for (const strategy of [zlib.constants.Z_DEFAULT_STRATEGY, zlib.constants.Z_FILTERED, zlib.constants.Z_RLE]) {
      candidates.push(zlib.deflateSync(rawBuf, { level: 9, memLevel: 9, strategy }));
    }
  }
  let bestIdat = candidates[0];
  for (const c of candidates) {
    if (c.length < bestIdat.length) bestIdat = c;
  }

  const chunks = [
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('PLTE', plte),
  ];
  if (trns) chunks.push(makeChunk('tRNS', trns));
  chunks.push(makeChunk('IDAT', bestIdat));
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return {
    buffer: Buffer.concat(chunks),
    paletteCount: palette.length,
    trnsCount: trns ? trns.length : 0,
    idatBytes: bestIdat.length,
  };
}

// ---------------- CLI Entry ----------------
const inputPath = process.argv[2];
const outputPath = process.argv[3];
const maxColors = process.argv[4] ? parseInt(process.argv[4], 10) : 192;

if (!inputPath || !outputPath || inputPath === '--help' || inputPath === '-h') {
  console.log('Usage: node compress_png.mjs <input.png> <output.png> [maxColors=192]');
  process.exit(inputPath === '--help' || inputPath === '-h' ? 0 : 1);
}

const inSize = fs.statSync(inputPath).size;
const { width, height, rgba } = decodePng(inputPath);
const palette = buildPalette(rgba, width, height, maxColors);
const indices = mapPixelsToPalette(rgba, width, height, palette);
const res = encodePng8(width, height, palette, indices);

fs.writeFileSync(outputPath, res.buffer);
const outSize = res.buffer.length;
const ratio = ((1 - outSize / inSize) * 100).toFixed(1);

console.log(
  `Compressed ${path.basename(inputPath)} (${inSize} B) -> ${path.basename(outputPath)} (${outSize} B, -${ratio}%) | ` +
  `${width}x${height} PNG8 | PLTE=${res.paletteCount} tRNS=${res.trnsCount} IDAT=${res.idatBytes}B`
);
