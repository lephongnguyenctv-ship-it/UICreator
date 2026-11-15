"""Small PVRTC1 4bpp RGBA encoder (pure numpy). Needed for the iOS bundle (Unity TextureFormat 33).

Layout and interpolation were calibrated against texture2ddecoder:
  * blocks are stored in Morton order with y in the even bits, x in the odd bits (y is the LSB);
  * the low-res A/B images are sampled at pixel 4*b+2 and interpolated with a triangle kernel (wrap-around);
  * modulation weights are 0, 3/8, 5/8, 1 (2 bits per pixel, row-major in the block).
Quality: simple min/max endpoints + least-squares refinement. Good enough for particle masks and flipbooks.
Texture sides must be powers of two (>= 8).
"""
import numpy as np


def _interleave(bx, by, nbits):
    r = 0
    for i in range(nbits):
        r |= ((by >> i) & 1) << (2 * i) | ((bx >> i) & 1) << (2 * i + 1)
    return r


def _block_order(bw, bh):
    """Byte index of every block (row-major bx,by) in the Morton layout (also works for non-square)."""
    nbits = min(bw, bh).bit_length() - 1
    out = np.zeros((bh, bw), np.int64)
    for by in range(bh):
        for bx in range(bw):
            low = _interleave(bx & ((1 << nbits) - 1), by & ((1 << nbits) - 1), nbits)
            if bw > bh:
                high = bx >> nbits
            else:
                high = by >> nbits
            out[by, bx] = (high << (2 * nbits)) | low
    return out


def _tri_upsample(low, w, h):
    """Upsample a (bh,bw,C) endpoint image to (h,w,C): triangle kernel centred on pixel 4*b+2, wrap-around."""
    bh, bw, c = low.shape
    xs = np.arange(w)
    ys = np.arange(h)
    # pixel p lies between samples b0 and b0+1 where sample b is at 4b+2
    fx = (xs - 2) / 4.0
    fy = (ys - 2) / 4.0
    x0 = np.floor(fx).astype(int)
    y0 = np.floor(fy).astype(int)
    tx = (fx - x0)[None, :, None]
    ty = (fy - y0)[:, None, None]
    x0m, x1m = x0 % bw, (x0 + 1) % bw
    y0m, y1m = y0 % bh, (y0 + 1) % bh
    top = low[y0m][:, x0m] * (1 - tx) + low[y0m][:, x1m] * tx
    bot = low[y1m][:, x0m] * (1 - tx) + low[y1m][:, x1m] * tx
    return top * (1 - ty) + bot * ty


def _quant(low, opaque):
    """Quantise endpoints (float 0..255, shape (bh,bw,4)) -> (codes A, codes B, dequantised A, dequantised B)."""
    def q(v, bits):
        m = (1 << bits) - 1
        return np.clip(np.rint(v / 255.0 * m), 0, m).astype(np.int64)

    def dq(c, bits):
        m = (1 << bits) - 1
        return c.astype(np.float32) / m * 255.0

    A, B = low
    res = {}
    for name, e, is_b in (("A", A, False), ("B", B, True)):
        if opaque:
            bits = (5, 5, 5 if is_b else 4, 0)
        else:
            bits = (4, 4, 4 if is_b else 3, 3)
        codes = [q(e[..., i], bits[i]) if bits[i] else np.zeros(e.shape[:2], np.int64) for i in range(4)]
        deq = np.stack([dq(codes[i], bits[i]) if bits[i] else np.full(e.shape[:2], 255.0, np.float32) for i in range(4)], -1)
        if not opaque:
            # 3-bit alpha is expanded to 4 bits (a<<1) then replicated to 8 bits
            a4 = codes[3] * 2
            deq[..., 3] = (a4 * 17).astype(np.float32)
        res[name] = (codes, deq, bits)
    return res


def encode(rgba, refine=4):
    """rgba: uint8 array (h,w,4). Returns PVRTC 4bpp bytes of the top level (no mips)."""
    h, w, _ = rgba.shape
    assert w >= 8 and h >= 8 and (w & (w - 1)) == 0 and (h & (h - 1)) == 0, "PVRTC needs power-of-two sides >= 8"
    bw, bh = w // 4, h // 4
    img = rgba.astype(np.float32)
    opaque = bool(img[..., 3].min() >= 250)

    # initial endpoints: per-channel min / max of a 6x6 neighbourhood around each block
    pad = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode="wrap")
    lo = np.zeros((bh, bw, 4), np.float32)
    hi = np.zeros((bh, bw, 4), np.float32)
    for by in range(bh):
        for bx in range(bw):
            win = pad[by * 4: by * 4 + 6, bx * 4: bx * 4 + 6].reshape(-1, 4)
            lo[by, bx] = win.min(0)
            hi[by, bx] = win.max(0)
    A, B = lo, hi

    mods_w = np.array([0.0, 3 / 8, 5 / 8, 1.0], np.float32)
    best = None
    for it in range(refine + 1):
        qr = _quant((A, B), opaque)
        Ad, Bd = qr["A"][1], qr["B"][1]
        Af = _tri_upsample(Ad, w, h)
        Bf = _tri_upsample(Bd, w, h)
        d = Bf - Af
        # modulation: best of 4 weights per pixel
        errs = []
        for mw in mods_w:
            rec = Af + mw * d
            errs.append(((rec - img) ** 2).sum(-1))
        errs = np.stack(errs, -1)
        mod = errs.argmin(-1)
        err = float(errs.min(-1).sum())
        if best is None or err < best[0]:
            best = (err, qr, mod.copy())
        if it == refine:
            break
        # refine endpoints by a few Jacobi-style least-squares sweeps given the current modulation
        mw_img = mods_w[mod][..., None]
        for _ in range(2):
            Af = _tri_upsample(A, w, h)
            Bf = _tri_upsample(B, w, h)
            rec = Af * (1 - mw_img) + Bf * mw_img
            resid = img - rec
            # gradient wrt the low-res samples = tri-kernel adjoint of resid * weight
            gA = _adjoint(resid * (1 - mw_img), bw, bh)
            gB = _adjoint(resid * mw_img, bw, bh)
            nA = _adjoint(np.broadcast_to((1 - mw_img) ** 2, resid.shape).copy(), bw, bh) + 1e-3
            nB = _adjoint(np.broadcast_to(mw_img ** 2, resid.shape).copy(), bw, bh) + 1e-3
            A = np.clip(A + 0.6 * gA / nA, 0, 255)
            B = np.clip(B + 0.6 * gB / nB, 0, 255)

    _, qr, mod = best
    ca, cb = qr["A"][0], qr["B"][0]
    data = np.zeros((bh, bw, 2), np.uint32)
    # modulation bits, pixel i = y*4+x at bits 2i..2i+1
    m = mod.reshape(bh, 4, bw, 4).transpose(0, 2, 1, 3).reshape(bh, bw, 16).astype(np.uint32)
    mbits = np.zeros((bh, bw), np.uint32)
    for i in range(16):
        mbits |= m[..., i] << np.uint32(2 * i)
    # make the first modulation "free" bit consistent with the standard mode: mode bit = 0
    if opaque:
        a_col = (ca[2].astype(np.uint32) << 1) | (ca[1].astype(np.uint32) << 5) | (ca[0].astype(np.uint32) << 10) | (1 << 15)
        b_col = (cb[2].astype(np.uint32)) | (cb[1].astype(np.uint32) << 5) | (cb[0].astype(np.uint32) << 10) | (1 << 15)
    else:
        a_col = (ca[2].astype(np.uint32) << 1) | (ca[1].astype(np.uint32) << 4) | (ca[0].astype(np.uint32) << 8) | (ca[3].astype(np.uint32) << 12)
        b_col = (cb[2].astype(np.uint32)) | (cb[1].astype(np.uint32) << 4) | (cb[0].astype(np.uint32) << 8) | (cb[3].astype(np.uint32) << 12)
    data[..., 0] = mbits
    data[..., 1] = a_col | (b_col << 16)
    order = _block_order(bw, bh)
    out = np.zeros((bw * bh, 2), np.uint32)
    out[order.reshape(-1)] = data.reshape(-1, 2)
    return out.astype("<u4").tobytes()


def _adjoint(res, bw, bh):
    """Adjoint of _tri_upsample: accumulate pixel residuals back into the low-res grid."""
    h, w, c = res.shape
    acc = np.zeros((bh, bw, c), np.float32)
    xs = np.arange(w)
    ys = np.arange(h)
    fx = (xs - 2) / 4.0
    fy = (ys - 2) / 4.0
    x0 = np.floor(fx).astype(int)
    y0 = np.floor(fy).astype(int)
    tx = fx - x0
    ty = fy - y0
    for dy, wy in ((0, 1 - ty), (1, ty)):
        for dx, wx in ((0, 1 - tx), (1, tx)):
            wgt = (wy[:, None] * wx[None, :])[..., None]
            yy = np.broadcast_to(((y0 + dy) % bh)[:, None], (h, w))
            xx = np.broadcast_to(((x0 + dx) % bw)[None, :], (h, w))
            np.add.at(acc, (yy, xx), res * wgt)
    return acc


def decode_check(data, w, h):
    """Decode with texture2ddecoder (if present) and return an RGBA uint8 array."""
    import texture2ddecoder as t
    raw = t.decode_pvrtc(data, w, h, False)
    arr = np.frombuffer(raw, np.uint8).reshape(h, w, 4)
    return arr[..., [2, 1, 0, 3]]  # BGRA -> RGBA
