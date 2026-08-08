export const W = 64;
export const H = 64;

export function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hx(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function setp(im, x, y, c, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  im.data[i] = c[0];
  im.data[i + 1] = c[1];
  im.data[i + 2] = c[2];
  im.data[i + 3] = a;
}

export function getp(im, x, y) {
  const i = (y * W + x) * 4;
  return [im.data[i], im.data[i + 1], im.data[i + 2], im.data[i + 3]];
}

export function same(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export function rect(im, x0, y0, x1, y1, c, a = 255) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setp(im, x, y, c, a);
}

export function ellipse(im, cx, cy, rx, ry, c, a = 255) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) setp(im, x, y, c, a);
    }
  }
}

export function line(im, x0, y0, x1, y1, c, a = 255) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1,
    err = dx + dy;
  while (true) {
    setp(im, x0, y0, c, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function tri(im, x1, y1, x2, y2, x3, y3, c, a = 255) {
  const minX = Math.floor(Math.min(x1, x2, x3)),
    maxX = Math.ceil(Math.max(x1, x2, x3)),
    minY = Math.floor(Math.min(y1, y2, y3)),
    maxY = Math.ceil(Math.max(y1, y2, y3));
  const ar = (ax, ay, bx, by, cx, cy) => (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) / 2;
  const A = Math.abs(ar(x1, y1, x2, y2, x3, y3));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const aa = Math.abs(ar(x, y, x2, y2, x3, y3));
      const bb = Math.abs(ar(x1, y1, x, y, x3, y3));
      const cc = Math.abs(ar(x1, y1, x2, y2, x, y));
      if (Math.abs(A - aa - bb - cc) < 0.5) setp(im, x, y, c, a);
    }
  }
}

export function makeImage(ctx) {
  return ctx.createImageData(W, H);
}

export function cloneImage(ctx, src) {
  const out = makeImage(ctx);
  out.data.set(src.data);
  return out;
}

export function imageToBase64(ctx, im) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  c.getContext("2d").putImageData(im, 0, 0);
  return c.toDataURL("image/png");
}

export function base64ToImage(ctx, dataUrl) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d", { willReadFrequently: true });
      g.clearRect(0, 0, W, H);
      g.drawImage(im, 0, 0);
      resolve(g.getImageData(0, 0, W, H));
    };
    im.src = dataUrl;
  });
}

export function draftEye(im, x, y) {
  ellipse(im, x, y, 3, 3, [245, 248, 255]);
  setp(im, x, y, [15, 18, 32]);
}

export function buildTemplate(ctx, type, palette) {
  const im = makeImage(ctx);
  const p = rgb(palette[0]),
    s = rgb(palette[1]),
    a = rgb(palette[2]),
    dark = [15, 18, 32];
  if (type === "blank") return { im, empty: true };
  if (type === "humanoid") {
    ellipse(im, 32, 16, 10, 11, s);
    rect(im, 24, 28, 40, 45, p);
    rect(im, 19, 32, 23, 42, p);
    rect(im, 41, 32, 45, 42, p);
    rect(im, 25, 46, 30, 58, p);
    rect(im, 34, 46, 39, 58, p);
  } else if (type === "quad") {
    ellipse(im, 32, 38, 18, 12, p);
    ellipse(im, 22, 25, 10, 9, s);
    rect(im, 20, 48, 25, 56, p);
    rect(im, 36, 48, 41, 56, p);
    for (let t = 0; t < 15; t++) ellipse(im, 45 + t, 38 - Math.sin(t / 3) * 5, 2, 2, a);
  } else if (type === "round") {
    ellipse(im, 32, 34, 18, 19, p);
    rect(im, 18, 34, 23, 42, p);
    rect(im, 41, 34, 46, 42, p);
    rect(im, 25, 52, 30, 58, p);
    rect(im, 34, 52, 39, 58, p);
  } else if (type === "winged") {
    ellipse(im, 32, 34, 13, 16, p);
    ellipse(im, 32, 18, 10, 9, s);
    tri(im, 19, 34, 5, 22, 21, 47, s, 220);
    tri(im, 45, 34, 59, 22, 43, 47, s, 220);
  } else if (type === "mech") {
    rect(im, 16, 29, 48, 44, p);
    rect(im, 23, 20, 41, 29, s);
    ellipse(im, 22, 49, 6, 6, dark);
    ellipse(im, 42, 49, 6, 6, dark);
    ellipse(im, 22, 49, 3, 3, a);
    ellipse(im, 42, 49, 3, 3, a);
  } else if (type === "plant") {
    rect(im, 29, 28, 35, 53, p);
    ellipse(im, 24, 29, 12, 7, s);
    ellipse(im, 40, 29, 12, 7, s);
    ellipse(im, 32, 18, 14, 10, a);
    for (const x of [27, 32, 37]) line(im, x, 48, x + (x - 32), 60, s);
  } else if (type === "ghost") {
    ellipse(im, 32, 29, 15, 18, p, 230);
    for (let x = 18; x <= 46; x += 7) tri(im, x, 45, x + 4, 56, x + 8, 45, p, 220);
  }
  const ey = type === "quad" ? 24 : type === "mech" ? 31 : 18;
  draftEye(im, 28, ey);
  draftEye(im, 36, ey);
  line(im, 29, type === "quad" ? 31 : 25, 32, type === "quad" ? 33 : 27, dark);
  line(im, 32, type === "quad" ? 33 : 27, 35, type === "quad" ? 31 : 25, dark);
  return { im, empty: false };
}

export function applyOutline(im) {
  const copy = new Uint8ClampedArray(im.data);
  const col = [10, 13, 26];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (copy[i + 3] > 0) continue;
      let near = false;
      for (let yy = -1; yy <= 1; yy++) {
        for (let xx = -1; xx <= 1; xx++) {
          const nx = x + xx,
            ny = y + yy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (copy[(ny * W + nx) * 4 + 3] > 80) near = true;
        }
      }
      if (near) setp(im, x, y, col, 255);
    }
  }
}

export function mirrorX(ctx, im) {
  const old = new Uint8ClampedArray(im.data);
  const ni = makeImage(ctx);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = W - 1 - x;
      const si = (y * W + sx) * 4,
        di = (y * W + x) * 4;
      for (let k = 0; k < 4; k++) ni.data[di + k] = old[si + k];
    }
  }
  return ni;
}

export function flood(im, x, y, col) {
  const target = getp(im, x, y);
  if (same(target, [col[0], col[1], col[2], 255])) return;
  const q = [[x, y]],
    seen = new Set();
  while (q.length) {
    const [cx, cy] = q.pop();
    const k = cx + "," + cy;
    if (seen.has(k) || cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
    seen.add(k);
    if (!same(getp(im, cx, cy), target)) continue;
    setp(im, cx, cy, col, 255);
    q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}

export function nearestPaletteColor(r, g, b, pal) {
  let best = rgb(pal[0]),
    bd = 1e9;
  for (const h of pal) {
    const c = rgb(h);
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

function bgRemoveInfo(src, mode, th) {
  let bg = [0, 0, 0],
    n = 0;
  if (mode === "edge") {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
        const i = (y * W + x) * 4;
        if (src.data[i + 3] < 10) continue;
        bg[0] += src.data[i];
        bg[1] += src.data[i + 1];
        bg[2] += src.data[i + 2];
        n++;
      }
    }
    bg = n ? bg.map((v) => v / n) : [255, 255, 255];
  }
  return { mode, th, bg };
}

function isBgPixel(r, g, b, a, info) {
  if (a < 10) return true;
  const { mode, th } = info;
  if (mode === "none") return false;
  if (mode === "edge") {
    const d = Math.hypot(r - info.bg[0], g - info.bg[1], b - info.bg[2]);
    return d < th;
  }
  if (mode === "light") {
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    return mn > 255 - th && mx - mn < th * 1.35;
  }
  if (mode === "dark") {
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    return mx < th && mx - mn < th * 1.35;
  }
  if (mode === "green") return g > 80 && g > r + th && g > b + th;
  if (mode === "blue") return b > 80 && b > r + th && b > g + th;
  return false;
}

export function extractPaletteFromImage(src, mode = "edge", th = 55, seedRef) {
  const info = bgRemoveInfo(src, mode, th);
  const buckets = new Map();
  let s2 = 2166136261;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = src.data[i],
        g = src.data[i + 1],
        bb = src.data[i + 2],
        a = src.data[i + 3];
      if (isBgPixel(r, g, bb, a, info)) continue;
      if (((x + y) & 1) === 0) {
        s2 ^= r + g * 3 + bb * 7;
        s2 = Math.imul(s2, 16777619);
        const key = `${r >> 5},${g >> 5},${bb >> 5}`;
        const cur = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        cur.r += r;
        cur.g += g;
        cur.b += bb;
        cur.n++;
        buckets.set(key, cur);
      }
    }
  }
  if (seedRef) seedRef.value = s2 >>> 0;
  const cols = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((c) => hx(c.r / c.n, c.g / c.n, c.b / c.n));
  while (cols.length < 6) cols.push(hx(Math.random() * 255, Math.random() * 255, Math.random() * 255));
  return { palette: cols, info };
}

export function drawPhotoToCanvas(im, mode = "crop") {
  const t = document.createElement("canvas");
  t.width = W;
  t.height = H;
  const tx = t.getContext("2d", { willReadFrequently: true });
  tx.clearRect(0, 0, W, H);
  const sc = mode === "fit" ? Math.min(W / im.width, H / im.height) : Math.max(W / im.width, H / im.height);
  const dw = im.width * sc,
    dh = im.height * sc;
  tx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return tx.getImageData(0, 0, W, H);
}

export function makePhotoDraft(ctx, photoImg, fitMode, bgMode, th = 55) {
  const src = drawPhotoToCanvas(photoImg, fitMode);
  const seedRef = { value: 12345 };
  const { palette, info } = extractPaletteFromImage(src, bgMode, th, seedRef);
  const out = makeImage(ctx);
  let kept = 0,
    removed = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = src.data[i],
        g = src.data[i + 1],
        bb = src.data[i + 2],
        a = src.data[i + 3];
      if (isBgPixel(r, g, bb, a, info)) {
        removed++;
        continue;
      }
      setp(out, x, y, nearestPaletteColor(r, g, bb, palette), 255);
      kept++;
    }
  }
  return { draft: out, palette, kept, removed, seed: seedRef.value, mode: info.mode };
}

export function materialFromPalette(palette) {
  const p = rgb(palette[0]);
  if (p[0] + p[1] + p[2] < 180) return "影紋碎片";
  if (p[0] > 180 && p[1] < 130) return "火色素";
  if (p[2] > 160) return "水晶色素";
  if (p[1] > 150) return "葉綠核心";
  if (p[0] > 170 && p[1] > 150) return "電光粉末";
  return "記憶色素";
}

export function elementFromPalette(palette) {
  const p = rgb(palette[0]);
  let e = "土";
  if (p[0] > 170 && p[1] < 130) e = "火";
  else if (p[2] > 150 && p[0] < 150) e = "水";
  else if (p[1] > 140 && p[0] < 160) e = "草";
  else if (p[0] > 170 && p[1] > 160 && p[2] < 120) e = "電";
  else if (p[0] + p[1] + p[2] > 610) e = "光";
  else if (p[0] + p[1] + p[2] < 190) e = "暗";
  return e;
}

export function suggestName(palette, rand = Math.random) {
  const e = elementFromPalette(palette);
  const mid = ["紋", "芯", "影", "焰", "泡", "芽", "輪", "點"][Math.floor(rand() * 8)];
  return e + mid + "獸";
}

export function effectiveMove(template, move = "auto") {
  if (move !== "auto") return move;
  if (template === "winged") return "fly";
  if (template === "mech") return "roll";
  if (template === "ghost" || template === "plant") return "float";
  if (template === "quad" || template === "round") return "hop";
  return "walk";
}

export function evoVariant(ctx, img, kind, palette, rand = Math.random) {
  const ni = cloneImage(ctx, img);
  const a = rgb(palette[2]);
  if (kind === "stable" || kind === "guard") {
    for (let t = 0; t < 6.28; t += 0.25)
      setp(ni, 32 + Math.round(Math.cos(t) * 14), 8 + Math.round(Math.sin(t) * 4), a, 230);
  }
  if (kind === "power") {
    tri(ni, 29, 6, 32, 0, 35, 6, a);
    for (const x of [20, 26, 38, 44]) line(ni, x, 54, x - 2, 61, a);
  }
  if (kind === "speed") {
    for (let y = 22; y < 48; y += 7)
      for (let x = 18; x < 47; x++)
        if ((x + y) % 5 < 2 && getp(ni, x, y)[3] > 0) setp(ni, x, y, a, 230);
    for (let t = 0; t < 18; t++) ellipse(ni, 45 + t, 38 - Math.sin(t / 3) * 5, 2, 2, a);
  }
  if (kind === "mind" || kind === "mutation") {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rand() * W),
        y = Math.floor(rand() * H);
      if (getp(ni, x, y)[3] > 0) setp(ni, x + (rand() > 0.5 ? 1 : -1), y, [180, 80, 255], 255);
    }
  }
  return ni;
}

// canvas overlay helpers
export function pxg(g, x, y, c, w = 1, h = 1) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

export function lineg(g, x0, y0, x1, y1, c) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0),
    sx = x0 < x1 ? 1 : -1,
    dy = -Math.abs(y1 - y0),
    sy = y0 < y1 ? 1 : -1,
    err = dx + dy;
  while (true) {
    pxg(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

export function drawEyeAt(g, x, y, style, mood, c, sz = 2) {
  const dark = "#111629",
    s = Math.max(1, sz);
  if (mood === "sleep") return lineg(g, x - s - 1, y, x + s + 1, y, c);
  if (mood === "happy") {
    lineg(g, x - s - 1, y, x - 1, y + s, c);
    lineg(g, x - 1, y + s, x + 1, y + s, c);
    lineg(g, x + 1, y + s, x + s + 1, y, c);
    return;
  }
  if (mood === "angry") return lineg(g, x - s - 1, y - s, x + s + 1, y + 1, "#ff5f7e");
  if (style === "x") {
    lineg(g, x - s, y - s, x + s, y + s, c);
    lineg(g, x + s, y - s, x - s, y + s, c);
    return;
  }
  if (style === "sharp") return lineg(g, x - s - 1, y, x + s + 1, y - 1, c);
  if (style === "glow") {
    pxg(g, x - s - 2, y - s - 2, "rgba(88,199,255,.45)", s * 2 + 5, s * 2 + 5);
    pxg(g, x - s, y - s, c, s * 2 + 1, s * 2 + 1);
    pxg(g, x, y, dark);
    return;
  }
  pxg(g, x - s, y - s, c, s * 2 + 1, s * 2 + 1);
  pxg(g, x - s + 1, y - s + 1, "#ffffff", Math.max(1, s), Math.max(1, s));
  pxg(g, x, y, dark);
}

export function drawMouthAt(g, x, y, style, mood, c, sz = 4) {
  const dark = "#1a1d2d",
    s = Math.max(2, sz);
  if (style === "none") return;
  if (mood === "sleep") return lineg(g, x - s, y, x + s, y, dark);
  if (mood === "hungry" || style === "open") {
    pxg(g, x - s, y - 2, dark, s * 2 + 1, 5);
    pxg(g, x - 1, y, "#ff9f5f", 3, 2);
    return;
  }
  if (mood === "angry" || style === "fang") {
    lineg(g, x - s, y, x + s, y, dark);
    pxg(g, x - Math.max(2, Math.floor(s * 0.7)), y + 1, "#ffffff", 2, 4);
    pxg(g, x + Math.max(1, Math.floor(s * 0.45)), y + 1, "#ffffff", 2, 4);
    return;
  }
  if (style === "flat") return lineg(g, x - s, y, x + s, y, dark);
  lineg(g, x - s, y, x - Math.floor(s / 2), y + 2, dark);
  lineg(g, x - Math.floor(s / 2), y + 2, x + Math.floor(s / 2), y + 2, dark);
  lineg(g, x + Math.floor(s / 2), y + 2, x + s, y, dark);
}

export function drawExpression(g, expr, face) {
  if (!face.enabled) return;
  const mood = expr.mood;
  const ec = face.color || "#ffffff";
  const lx = face.eyeLX,
    ly = face.eyeLY,
    rx = face.eyeRX,
    ry = face.eyeRY;
  if (face.eyes) {
    if (face.eyeStyle === "single")
      drawEyeAt(g, Math.round((lx + rx) / 2), Math.round((ly + ry) / 2), face.eyeStyle, mood, ec, face.eyeSize);
    else {
      drawEyeAt(g, lx, ly, face.eyeStyle, mood, ec, face.eyeSize);
      drawEyeAt(g, rx, ry, face.eyeStyle, mood, ec, face.eyeSize);
    }
  }
  if (face.mouth) drawMouthAt(g, face.mouthX, face.mouthY, face.mouthStyle, mood, ec, face.mouthSize);
  if (face.handles) {
    for (const q of [
      { x: lx, y: ly, c: "#58c7ff" },
      { x: rx, y: ry, c: "#58c7ff" },
      { x: face.mouthX, y: face.mouthY, c: "#ff5f7e" },
    ]) {
      pxg(g, q.x - 2, q.y - 2, q.c, 5, 1);
      pxg(g, q.x - 2, q.y + 2, q.c, 5, 1);
      pxg(g, q.x - 2, q.y - 2, q.c, 1, 5);
      pxg(g, q.x + 2, q.y - 2, q.c, 1, 5);
    }
  }
}
