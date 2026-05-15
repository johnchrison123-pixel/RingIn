/* eslint-disable */
// ──────────────────────────────────────────────────────────────────────────
// compressImage(file, opts) — shrink an oversized image client-side before
// upload. Cuts ~70-90% of bytes off a raw iPhone/Android camera shot
// (typical 4–8 MB → 200–500 KB) with no visible quality loss at the
// dimensions we actually display.
//
// Why it matters:
// - Saves bandwidth on the uploader's network (especially mobile data).
// - Saves Supabase Storage cost — the moments table holds 24h history;
//   chat images are forever. A 90% size cut compounds fast.
// - Faster previews on the recipient side.
//
// Approach:
// 1. Load File / Blob into an <img>.
// 2. Compute target dims (longest-edge clamp, keep aspect).
// 3. Draw onto <canvas> at target dims.
// 4. canvas.toBlob() with the preferred output format (WebP if supported,
//    JPEG fallback). Quality 0.82 = sweet spot.
// 5. If the output is somehow LARGER than the input (rare — happens on
//    already-tiny PNGs), return the original to avoid making things worse.
//
// Notes:
// - HEIC (iPhone) decoding: Safari handles it natively via the <img> path.
//   Chrome/Firefox don't — for those, the <img> load fails. The function
//   returns the original blob in that case so the upload still works,
//   just uncompressed. (Real HEIC decoding requires a heavy libheif WASM
//   download — punted for now.)
// - We always return a File (not a Blob) so downstream callers reading
//   `file.name` keep working.
// ──────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  maxEdge: 1600,           // longest-edge clamp in px. 1600 is sharp on retina at full width.
  quality: 0.82,           // 0–1 for JPEG/WebP. 0.82 = visually lossless at the sizes we render.
  preferWebP: true,
  // Skip compression for tiny files (under 200 KB). Not worth the time.
  skipBelowBytes: 200 * 1024,
};

function loadImage(file) {
  return new Promise(function(resolve, reject) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function() {
      // Don't revoke yet — canvas may still be drawing.
      resolve({ img: img, url: url });
    };
    img.onerror = function(e) {
      try { URL.revokeObjectURL(url); } catch (_) {}
      reject(new Error('image load failed'));
    };
    img.src = url;
  });
}

function canEncodeWebP() {
  // Feature-detect canvas WebP encoding. Cached after first call.
  if (canEncodeWebP._cache != null) return canEncodeWebP._cache;
  try {
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const dataUrl = c.toDataURL('image/webp');
    canEncodeWebP._cache = dataUrl.indexOf('data:image/webp') === 0;
  } catch (_) { canEncodeWebP._cache = false; }
  return canEncodeWebP._cache;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(function(resolve) {
    if (canvas.toBlob) {
      canvas.toBlob(function(blob) { resolve(blob); }, type, quality);
    } else {
      // toBlob() isn't supported in some older Safari versions — fall back.
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const byteStr = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        resolve(new Blob([arr], { type: type }));
      } catch (_) { resolve(null); }
    }
  });
}

export default async function compressImage(file, opts) {
  if (!file) return file;
  const o = Object.assign({}, DEFAULTS, opts || {});

  // Bail-outs
  if (!/^image\//i.test(file.type || '')) return file;          // not an image
  if (file.size < o.skipBelowBytes) return file;                 // already small
  if (typeof document === 'undefined') return file;              // SSR safety

  let loaded;
  try { loaded = await loadImage(file); }
  catch (_) { return file; }                                     // browser can't decode (e.g. HEIC on Chrome) — keep original

  const img = loaded.img;
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) { try { URL.revokeObjectURL(loaded.url); } catch (_) {} return file; }

  // Scale longest edge to maxEdge, preserve aspect.
  const long = Math.max(w0, h0);
  const scale = long > o.maxEdge ? o.maxEdge / long : 1;
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) { try { URL.revokeObjectURL(loaded.url); } catch (_) {} return file; }
  // Modest smoothing helps when downscaling.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  try { URL.revokeObjectURL(loaded.url); } catch (_) {}

  const outType = (o.preferWebP && canEncodeWebP()) ? 'image/webp' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, outType, o.quality);
  if (!blob) return file;

  // Don't make things worse — if the "compressed" output is bigger than
  // the input (happens with already-tiny PNGs, or some test images),
  // return the original.
  if (blob.size >= file.size) return file;

  // Produce a File with the right extension so downstream code that
  // inspects file.name keeps working.
  const ext = outType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '');
  const newName = baseName + '.' + ext;
  // File constructor is widely supported in browsers; if not available,
  // return the Blob and let downstream handle it.
  try {
    return new File([blob], newName, { type: outType, lastModified: Date.now() });
  } catch (_) {
    blob.name = newName;
    return blob;
  }
}

// Convenience helper for callers that just want stats.
export async function compressWithStats(file, opts) {
  const before = file && file.size ? file.size : 0;
  const out = await compressImage(file, opts);
  const after = out && out.size ? out.size : before;
  const cut = before > 0 ? Math.round((1 - after / before) * 100) : 0;
  return { file: out, beforeBytes: before, afterBytes: after, cutPct: cut };
}
