<#
.SYNOPSIS
    Extracts, crops, resizes (1:1 Bicubic Sharper or aspect-preserved), and PNG8-compresses
    AI-generated UI sprites/assets into clean transparent PNGs.
#>
param(
    [Parameter(Mandatory=$true)][string]$InputPath,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [ValidateSet('auto','white','green','magenta')][string]$Mode = 'auto',
    [ValidateSet('square','preserve')][string]$Aspect = 'square',
    [int]$Size = 256,
    [int]$Margin = 14,
    [int]$Padding = 12,
    [switch]$KeepAllComponents,
    [int]$Colors = 192,
    [switch]$Lossless,
    [switch]$KeepFull,
    [switch]$PowerOfTwo,
    [ValidateSet('resize','pad')][string]$PotMode = 'resize',
    [string]$PreviewPath = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$csharp = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class UiAssetProcessor {
    private static double BicubicSharperWeight(double x) {
        const double a = -0.65;
        x = Math.Abs(x);
        if (x <= 1.0) {
            return (a + 2.0) * x * x * x - (a + 3.0) * x * x + 1.0;
        } else if (x < 2.0) {
            return a * x * x * x - 5.0 * a * x * x + 8.0 * a * x - 4.0 * a;
        }
        return 0.0;
    }

    private static Bitmap DownsampleBicubicSharper(Bitmap src, int dstW, int dstH) {
        int sw = src.Width;
        int sh = src.Height;
        if (sw == dstW && sh == dstH) {
            return new Bitmap(src);
        }

        var sRect = new Rectangle(0, 0, sw, sh);
        var sData = src.LockBits(sRect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int sStride = sData.Stride;
        byte[] sBytes = new byte[sStride * sh];
        Marshal.Copy(sData.Scan0, sBytes, 0, sBytes.Length);
        src.UnlockBits(sData);

        double[] pr = new double[sw * sh];
        double[] pg = new double[sw * sh];
        double[] pb = new double[sw * sh];
        double[] pa = new double[sw * sh];

        for (int y = 0; y < sh; y++) {
            int row = y * sStride;
            int idxRow = y * sw;
            for (int x = 0; x < sw; x++) {
                int off = row + x * 4;
                double a = sBytes[off + 3] / 255.0;
                pa[idxRow + x] = a;
                pb[idxRow + x] = (sBytes[off] / 255.0) * a;
                pg[idxRow + x] = (sBytes[off + 1] / 255.0) * a;
                pr[idxRow + x] = (sBytes[off + 2] / 255.0) * a;
            }
        }

        double scaleX = (double)sw / dstW;
        double scaleY = (double)sh / dstH;
        double supportX = Math.Max(2.0, 2.0 * scaleX);
        double supportY = Math.Max(2.0, 2.0 * scaleY);

        double[] hr = new double[dstW * sh];
        double[] hg = new double[dstW * sh];
        double[] hb = new double[dstW * sh];
        double[] ha = new double[dstW * sh];

        for (int dx = 0; dx < dstW; dx++) {
            double center = (dx + 0.5) * scaleX - 0.5;
            int left = Math.Max(0, (int)Math.Floor(center - supportX));
            int right = Math.Min(sw - 1, (int)Math.Ceiling(center + supportX));
            int count = right - left + 1;
            double[] weights = new double[count];
            double wSum = 0;
            for (int i = 0; i < count; i++) {
                double w = BicubicSharperWeight(((left + i) - center) / scaleX);
                weights[i] = w;
                wSum += w;
            }
            if (wSum != 0) {
                for (int i = 0; i < count; i++) weights[i] /= wSum;
            }

            for (int y = 0; y < sh; y++) {
                double sr = 0, sg = 0, sb = 0, sa = 0;
                int row = y * sw;
                for (int i = 0; i < count; i++) {
                    double w = weights[i];
                    int idx = row + left + i;
                    sr += pr[idx] * w;
                    sg += pg[idx] * w;
                    sb += pb[idx] * w;
                    sa += pa[idx] * w;
                }
                int dIdx = y * dstW + dx;
                hr[dIdx] = sr; hg[dIdx] = sg; hb[dIdx] = sb; ha[dIdx] = sa;
            }
        }

        var dst = new Bitmap(dstW, dstH, PixelFormat.Format32bppArgb);
        var dRect = new Rectangle(0, 0, dstW, dstH);
        var dData = dst.LockBits(dRect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        int dStride = dData.Stride;
        byte[] dBytes = new byte[dStride * dstH];

        for (int dy = 0; dy < dstH; dy++) {
            double center = (dy + 0.5) * scaleY - 0.5;
            int top = Math.Max(0, (int)Math.Floor(center - supportY));
            int bottom = Math.Min(sh - 1, (int)Math.Ceiling(center + supportY));
            int count = bottom - top + 1;
            double[] weights = new double[count];
            double wSum = 0;
            for (int i = 0; i < count; i++) {
                double w = BicubicSharperWeight(((top + i) - center) / scaleY);
                weights[i] = w;
                wSum += w;
            }
            if (wSum != 0) {
                for (int i = 0; i < count; i++) weights[i] /= wSum;
            }

            int dRow = dy * dStride;
            for (int dx = 0; dx < dstW; dx++) {
                double sr = 0, sg = 0, sb = 0, sa = 0;
                for (int i = 0; i < count; i++) {
                    double w = weights[i];
                    int idx = (top + i) * dstW + dx;
                    sr += hr[idx] * w;
                    sg += hg[idx] * w;
                    sb += hb[idx] * w;
                    sa += ha[idx] * w;
                }

                sa = Math.Max(0.0, Math.Min(1.0, sa));
                int off = dRow + dx * 4;
                if (sa <= 0.012) {
                    dBytes[off] = 0; dBytes[off + 1] = 0; dBytes[off + 2] = 0; dBytes[off + 3] = 0;
                } else {
                    dBytes[off]     = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((sb / sa) * 255.0)));
                    dBytes[off + 1] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((sg / sa) * 255.0)));
                    dBytes[off + 2] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((sr / sa) * 255.0)));
                    dBytes[off + 3] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round(sa * 255.0)));
                }
            }
        }

        Marshal.Copy(dBytes, 0, dData.Scan0, dBytes.Length);
        dst.UnlockBits(dData);
        return dst;
    }

    private static string DetectCornerMode(byte[] bytes, int stride, int w, int h) {
        int[,] pts = { { 0, 0 }, { w - 1, 0 }, { 0, h - 1 }, { w - 1, h - 1 } };
        int whiteVotes = 0, greenVotes = 0, magentaVotes = 0;
        for (int i = 0; i < 4; i++) {
            int off = pts[i, 1] * stride + pts[i, 0] * 4;
            int b = bytes[off], g = bytes[off + 1], r = bytes[off + 2];
            if (r >= 220 && g >= 220 && b >= 220) whiteVotes++;
            else if (g - Math.Max(r, b) > 40) greenVotes++;
            else if (Math.Min(r, b) - g > 40) magentaVotes++;
        }
        if (greenVotes >= whiteVotes && greenVotes >= magentaVotes && greenVotes > 0) return "green";
        if (magentaVotes >= whiteVotes && magentaVotes >= greenVotes && magentaVotes > 0) return "magenta";
        return "white";
    }

    private static int NearestPow2(int n) {
        if (n <= 2) return 2;
        int lo = 2;
        while (lo * 2 <= n) lo *= 2;
        int hi = lo * 2;
        return (n - lo) < (hi - n) ? lo : hi;
    }

    private static int NextPow2(int n) {
        if (n <= 2) return 2;
        int p = 2;
        while (p < n) p *= 2;
        return p;
    }

    public static string ExtractAndResize(
        string inputPath,
        string rgbaOutPath,
        string fullOutPath,
        string mode,
        string aspect,
        int size,
        int margin,
        int padding,
        bool keepAllComponents,
        bool powerOfTwo,
        string potMode
    ) {
        using (var src = new Bitmap(inputPath)) {
            int w = src.Width;
            int h = src.Height;
            using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
                using (var g = Graphics.FromImage(bmp)) {
                    g.DrawImage(src, 0, 0, w, h);
                }

                var rect = new Rectangle(0, 0, w, h);
                var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int stride = data.Stride;
                byte[] bytes = new byte[stride * h];
                Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);

                string activeMode = mode == "auto" ? DetectCornerMode(bytes, stride, w, h) : mode;

                if (activeMode == "white") {
                    bool[] isBg = new bool[w * h];
                    int[] qBg = new int[w * h];
                    int head = 0, tail = 0;

                    Func<int, bool> isNearWhite = (int idx) => {
                        int py = idx / w;
                        int px = idx % w;
                        int off = py * stride + px * 4;
                        int b = bytes[off], gv = bytes[off + 1], r = bytes[off + 2];
                        int minC = Math.Min(r, Math.Min(gv, b));
                        int maxC = Math.Max(r, Math.Max(gv, b));
                        return minC >= 220 && (maxC - minC) <= 24;
                    };

                    for (int x = 0; x < w; x++) {
                        int iTop = x;
                        if (!isBg[iTop] && isNearWhite(iTop)) { isBg[iTop] = true; qBg[tail++] = iTop; }
                        int iBot = (h - 1) * w + x;
                        if (!isBg[iBot] && isNearWhite(iBot)) { isBg[iBot] = true; qBg[tail++] = iBot; }
                    }
                    for (int y = 1; y < h - 1; y++) {
                        int iL = y * w;
                        if (!isBg[iL] && isNearWhite(iL)) { isBg[iL] = true; qBg[tail++] = iL; }
                        int iR = y * w + (w - 1);
                        if (!isBg[iR] && isNearWhite(iR)) { isBg[iR] = true; qBg[tail++] = iR; }
                    }

                    while (head < tail) {
                        int p = qBg[head++];
                        int px = p % w;
                        int py = p / w;
                        if (px > 0) { int n = p - 1; if (!isBg[n] && isNearWhite(n)) { isBg[n] = true; qBg[tail++] = n; } }
                        if (px + 1 < w) { int n = p + 1; if (!isBg[n] && isNearWhite(n)) { isBg[n] = true; qBg[tail++] = n; } }
                        if (py > 0) { int n = p - w; if (!isBg[n] && isNearWhite(n)) { isBg[n] = true; qBg[tail++] = n; } }
                        if (py + 1 < h) { int n = p + w; if (!isBg[n] && isNearWhite(n)) { isBg[n] = true; qBg[tail++] = n; } }
                    }

                    for (int y = 0; y < h; y++) {
                        int rowOff = y * stride;
                        for (int x = 0; x < w; x++) {
                            if (isBg[y * w + x]) {
                                int off = rowOff + x * 4;
                                bytes[off] = 0; bytes[off + 1] = 0; bytes[off + 2] = 0; bytes[off + 3] = 0;
                            }
                        }
                    }

                    // 2-pass anti-white-fringe un-premultiply on outer boundary
                    for (int pass = 0; pass < 2; pass++) {
                        bool[] ring = new bool[w * h];
                        for (int y = 1; y < h - 1; y++) {
                            for (int x = 1; x < w - 1; x++) {
                                int idx = y * w + x;
                                if (isBg[idx]) continue;
                                int off = y * stride + x * 4;
                                if (bytes[off + 3] == 0) continue;
                                if (isBg[idx - 1] || isBg[idx + 1] || isBg[idx - w] || isBg[idx + w] ||
                                    isBg[idx - w - 1] || isBg[idx - w + 1] || isBg[idx + w - 1] || isBg[idx + w + 1]) {
                                    ring[idx] = true;
                                }
                            }
                        }
                        for (int y = 1; y < h - 1; y++) {
                            for (int x = 1; x < w - 1; x++) {
                                int idx = y * w + x;
                                if (!ring[idx]) continue;
                                int off = y * stride + x * 4;
                                int b = bytes[off], gv = bytes[off + 1], r = bytes[off + 2];
                                double luma = 0.299 * r + 0.587 * gv + 0.114 * b;
                                if (luma > 24.0) {
                                    double alphaF = Math.Max(0.0, Math.Min(1.0, (255.0 - luma) / 235.0));
                                    if (alphaF <= 0.04) {
                                        bytes[off] = 0; bytes[off + 1] = 0; bytes[off + 2] = 0; bytes[off + 3] = 0;
                                        isBg[idx] = true;
                                    } else {
                                        int alpha = (int)Math.Round(alphaF * 255.0);
                                        bytes[off]     = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((b - 255.0 * (1.0 - alphaF)) / alphaF)));
                                        bytes[off + 1] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((gv - 255.0 * (1.0 - alphaF)) / alphaF)));
                                        bytes[off + 2] = (byte)Math.Max(0, Math.Min(255, (int)Math.Round((r - 255.0 * (1.0 - alphaF)) / alphaF)));
                                        bytes[off + 3] = (byte)alpha;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Chroma key removal: green (#00FF00) or magenta (#FF00FF)
                    bool isMagenta = (activeMode == "magenta");
                    for (int y = 0; y < h; y++) {
                        int rowOff = y * stride;
                        for (int x = 0; x < w; x++) {
                            int off = rowOff + x * 4;
                            int b = bytes[off], gv = bytes[off + 1], r = bytes[off + 2];
                            int excess = isMagenta ? (Math.Min(r, b) - gv) : (gv - Math.Max(r, b));
                            if (excess > 18) {
                                double alphaF = 1.0 - (excess / 230.0);
                                if (alphaF <= 0.06) {
                                    bytes[off] = 0; bytes[off + 1] = 0; bytes[off + 2] = 0; bytes[off + 3] = 0;
                                } else {
                                    if (alphaF > 1.0) alphaF = 1.0;
                                    int alpha = (int)Math.Round(alphaF * 255.0);
                                    if (isMagenta) {
                                        int cap = gv;
                                        bytes[off]     = (byte)Math.Min(255, (int)Math.Round(Math.Min(b, cap) / alphaF));
                                        bytes[off + 1] = (byte)Math.Min(255, (int)Math.Round(gv / alphaF));
                                        bytes[off + 2] = (byte)Math.Min(255, (int)Math.Round(Math.Min(r, cap) / alphaF));
                                    } else {
                                        int maxRB = Math.Max(r, b);
                                        bytes[off]     = (byte)Math.Min(255, (int)Math.Round(b / alphaF));
                                        bytes[off + 1] = (byte)Math.Min(255, (int)Math.Round(maxRB / alphaF));
                                        bytes[off + 2] = (byte)Math.Min(255, (int)Math.Round(r / alphaF));
                                    }
                                    bytes[off + 3] = (byte)alpha;
                                }
                            }
                        }
                    }
                }

                // Connected-component analysis (strips watermarks & stray speckles)
                int[] compId = new int[w * h];
                int[] q = new int[w * h];
                var compSizes = new List<int>();
                compSizes.Add(0); // 1-based indexing
                int curId = 0, bestId = 0, bestSize = 0;

                for (int y = 0; y < h; y++) {
                    for (int x = 0; x < w; x++) {
                        int idx = y * w + x;
                        if (compId[idx] != 0) continue;
                        int off = y * stride + x * 4;
                        if (bytes[off + 3] <= 12) continue;

                        curId++;
                        int head = 0, tail = 0, count = 0;
                        compId[idx] = curId;
                        q[tail++] = idx;

                        while (head < tail) {
                            int p = q[head++];
                            count++;
                            int px = p % w;
                            int py = p / w;
                            if (px > 0) { int n = p - 1; if (compId[n] == 0 && bytes[py * stride + (px - 1) * 4 + 3] > 12) { compId[n] = curId; q[tail++] = n; } }
                            if (px + 1 < w) { int n = p + 1; if (compId[n] == 0 && bytes[py * stride + (px + 1) * 4 + 3] > 12) { compId[n] = curId; q[tail++] = n; } }
                            if (py > 0) { int n = p - w; if (compId[n] == 0 && bytes[(py - 1) * stride + px * 4 + 3] > 12) { compId[n] = curId; q[tail++] = n; } }
                            if (py + 1 < h) { int n = p + w; if (compId[n] == 0 && bytes[(py + 1) * stride + px * 4 + 3] > 12) { compId[n] = curId; q[tail++] = n; } }
                        }

                        compSizes.Add(count);
                        if (count > bestSize) { bestSize = count; bestId = curId; }
                    }
                }

                if (bestId == 0) {
                    throw new Exception("No foreground pixels remained after background removal.");
                }

                bool[] keepComp = new bool[curId + 1];
                keepComp[bestId] = true;
                int keptCount = 1;
                if (keepAllComponents) {
                    int minArea = Math.Max(25, (int)Math.Round(bestSize * 0.005));
                    for (int cid = 1; cid <= curId; cid++) {
                        if (cid != bestId && compSizes[cid] >= minArea) {
                            keepComp[cid] = true;
                            keptCount++;
                        }
                    }
                }

                int minX = w, minY = h, maxX = -1, maxY = -1;
                for (int y = 0; y < h; y++) {
                    int rowOff = y * stride;
                    for (int x = 0; x < w; x++) {
                        int idx = y * w + x;
                        int off = rowOff + x * 4;
                        int cid = compId[idx];
                        if (cid == 0 || !keepComp[cid]) {
                            bytes[off] = 0; bytes[off + 1] = 0; bytes[off + 2] = 0; bytes[off + 3] = 0;
                        } else if (bytes[off + 3] > 12) {
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;
                        }
                    }
                }

                Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
                bmp.UnlockBits(data);

                int cx0 = Math.Max(0, minX - padding);
                int cy0 = Math.Max(0, minY - padding);
                int cx1 = Math.Min(w - 1, maxX + padding);
                int cy1 = Math.Min(h - 1, maxY + padding);
                int cw = cx1 - cx0 + 1;
                int ch = cy1 - cy0 + 1;

                using (var cropped = new Bitmap(cw, ch, PixelFormat.Format32bppArgb)) {
                    using (var gc = Graphics.FromImage(cropped)) {
                        gc.DrawImage(bmp, new Rectangle(0, 0, cw, ch), new Rectangle(cx0, cy0, cw, ch), GraphicsUnit.Pixel);
                    }
                    if (!string.IsNullOrEmpty(fullOutPath)) {
                        cropped.Save(fullOutPath, ImageFormat.Png);
                    }

                    Bitmap finalBmp;
                    if (aspect == "square") {
                        int targetSize = size > 0 ? size : Math.Max(cw, ch);
                        if (powerOfTwo) {
                            targetSize = potMode == "pad" ? NextPow2(targetSize) : NearestPow2(targetSize);
                        }
                        int maxSide = Math.Max(cw, ch);
                        int marginScaled = (int)Math.Round(margin * ((double)maxSide / targetSize));
                        int squareSide = maxSide + 2 * marginScaled;
                        using (var squareFull = new Bitmap(squareSide, squareSide, PixelFormat.Format32bppArgb)) {
                            using (var gsq = Graphics.FromImage(squareFull)) {
                                gsq.Clear(Color.Transparent);
                                int ox = (squareSide - cw) / 2;
                                int oy = (squareSide - ch) / 2;
                                gsq.DrawImage(cropped, new Rectangle(ox, oy, cw, ch), new Rectangle(0, 0, cw, ch), GraphicsUnit.Pixel);
                            }
                            finalBmp = DownsampleBicubicSharper(squareFull, targetSize, targetSize);
                        }
                    } else {
                        // Preserve aspect ratio
                        int dstW = cw;
                        int dstH = ch;
                        if (size > 0 && Math.Max(cw, ch) != size) {
                            double scale = (double)size / Math.Max(cw, ch);
                            dstW = Math.Max(1, (int)Math.Round(cw * scale));
                            dstH = Math.Max(1, (int)Math.Round(ch * scale));
                        }
                        if (powerOfTwo) {
                            if (potMode == "pad") {
                                int potW = NextPow2(dstW);
                                int potH = NextPow2(dstH);
                                using (var resized = (dstW != cw || dstH != ch) ? DownsampleBicubicSharper(cropped, dstW, dstH) : new Bitmap(cropped)) {
                                    finalBmp = new Bitmap(potW, potH, PixelFormat.Format32bppArgb);
                                    using (var gp = Graphics.FromImage(finalBmp)) {
                                        gp.Clear(Color.Transparent);
                                        int ox = (potW - dstW) / 2;
                                        int oy = (potH - dstH) / 2;
                                        gp.DrawImage(resized, new Rectangle(ox, oy, dstW, dstH), new Rectangle(0, 0, dstW, dstH), GraphicsUnit.Pixel);
                                    }
                                }
                            } else {
                                int potW = NearestPow2(dstW);
                                int potH = NearestPow2(dstH);
                                finalBmp = (potW != cw || potH != ch) ? DownsampleBicubicSharper(cropped, potW, potH) : new Bitmap(cropped);
                            }
                        } else {
                            finalBmp = (dstW != cw || dstH != ch) ? DownsampleBicubicSharper(cropped, dstW, dstH) : new Bitmap(cropped);
                        }
                    }

                    int fw = finalBmp.Width;
                    int fh = finalBmp.Height;
                    finalBmp.Save(rgbaOutPath, ImageFormat.Png);
                    finalBmp.Dispose();

                    return string.Format("Mode={0}, Source={1}x{2}, Components={3} (Kept={4}), Crop={5}x{6}, Output={7}x{8}",
                        activeMode, w, h, curId, keptCount, cw, ch, fw, fh);
                }
            }
        }
    }

    public static void BuildPreview(string finalPngPath, string previewPath) {
        using (var target = new Bitmap(finalPngPath)) {
            int tw = target.Width;
            int th = target.Height;
            int pw = tw * 3;
            using (var prev = new Bitmap(pw, th, PixelFormat.Format32bppArgb)) {
                using (var gp = Graphics.FromImage(prev)) {
                    using (var dark = new SolidBrush(Color.FromArgb(255, 27, 26, 35))) {
                        gp.FillRectangle(dark, 0, 0, tw, th);
                    }
                    gp.DrawImage(target, 0, 0, tw, th);

                    using (var b1 = new SolidBrush(Color.FromArgb(255, 204, 204, 204)))
                    using (var b2 = new SolidBrush(Color.FromArgb(255, 255, 255, 255))) {
                        int tile = Math.Max(8, Math.Min(24, Math.Min(tw, th) / 12));
                        for (int ty = 0; ty < th; ty += tile) {
                            for (int tx = tw; tx < tw * 2; tx += tile) {
                                bool even = (((tx - tw) / tile) + (ty / tile)) % 2 == 0;
                                gp.FillRectangle(even ? b1 : b2, tx, ty, tile, tile);
                            }
                        }
                    }
                    gp.DrawImage(target, tw, 0, tw, th);

                    using (var purp = new SolidBrush(Color.FromArgb(255, 75, 46, 94))) {
                        gp.FillRectangle(purp, tw * 2, 0, tw, th);
                    }
                    gp.DrawImage(target, tw * 2, 0, tw, th);
                }
                prev.Save(previewPath, ImageFormat.Png);
            }
        }
    }
}
"@

Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Drawing

$outDir = Split-Path -Parent $OutputPath
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$fullOutPath = ''
if ($KeepFull) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($OutputPath)
    $parentDir = if ($outDir) { $outDir } else { '.' }
    $fullOutPath = Join-Path $parentDir "${baseName}_full.png"
}

$tempRgbaPath = if ($Lossless) {
    $OutputPath
} else {
    Join-Path ([System.IO.Path]::GetTempPath()) ("ui_asset_" + [System.Guid]::NewGuid().ToString('N') + ".png")
}

try {
    $summary = [UiAssetProcessor]::ExtractAndResize(
        $InputPath,
        $tempRgbaPath,
        $fullOutPath,
        $Mode,
        $Aspect,
        $Size,
        $Margin,
        $Padding,
        [bool]$KeepAllComponents,
        [bool]$PowerOfTwo,
        $PotMode
    )
    Write-Output $summary

    if (-not $Lossless) {
        $compressor = Join-Path $PSScriptRoot 'compress_png.mjs'
        if (-not (Test-Path $compressor)) {
            throw "Missing compressor script at $compressor"
        }
        $compressOut = & node $compressor $tempRgbaPath $OutputPath $Colors 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "compress_png.mjs failed: $compressOut"
        }
        Write-Output $compressOut
    } else {
        $bytesLen = (Get-Item $OutputPath).Length
        Write-Output "Saved lossless RGBA: $OutputPath ($bytesLen B)"
    }

    if ($KeepFull -and (Test-Path $fullOutPath)) {
        $fullLen = (Get-Item $fullOutPath).Length
        Write-Output "Saved full cutout: $fullOutPath ($fullLen B)"
    }

    if ($PreviewPath) {
        $prevDir = Split-Path -Parent $PreviewPath
        if ($prevDir -and -not (Test-Path $prevDir)) {
            New-Item -ItemType Directory -Path $prevDir -Force | Out-Null
        }
        [UiAssetProcessor]::BuildPreview($OutputPath, $PreviewPath)
        Write-Output "Saved preview strip: $PreviewPath"
    }
} finally {
    if (-not $Lossless -and (Test-Path $tempRgbaPath)) {
        Remove-Item -Path $tempRgbaPath -Force -ErrorAction SilentlyContinue
    }
}
