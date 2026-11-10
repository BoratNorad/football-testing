// Turns nflverse headshots into pixel-art portraits.
//
// Source priority for each player:
//   1. window.DEX_HEADSHOTS[id]  - pre-baked by tools/bake_headshots.py (works offline)
//   2. the player's nflverse headshot URL, pixelated live in the browser
//   3. a procedural helmet placeholder in team colors
(function () {
  // 16-bit (SNES/Genesis era) look: 64x64, ~40 colours. Big enough that faces stay recognizable.
  const SIZE = 64;          // logical pixels of a portrait
  const COLORS = 40;        // palette size
  const cache = new Map();  // key -> Promise<HTMLCanvasElement>

  // ---- tiny loader queue so 1900 list rows don't fire 1900 requests at once ----
  const MAX = 6;
  let active = 0;
  const queue = [];
  function enqueue(fn) {
    return new Promise((res, rej) => {
      queue.push(() => fn().then(res, rej).finally(() => { active--; pump(); }));
      pump();
    });
  }
  function pump() {
    while (active < MAX && queue.length) { active++; queue.shift()(); }
  }

  function loadImage(src, cors) {
    return new Promise((res, rej) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("load failed: " + src));
      img.src = src;
    });
  }

  // ---- k-means palette reduction ------------------------------------------------
  function quantize(data, k) {
    const pts = [];
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] >= 128) pts.push(i);
    if (!pts.length) return;
    // init centroids spread across luminance
    pts.sort((a, b) => (data[a] + data[a + 1] + data[a + 2]) - (data[b] + data[b + 1] + data[b + 2]));
    const cents = [];
    for (let j = 0; j < k; j++) {
      const i = pts[Math.floor((j + 0.5) / k * pts.length)];
      cents.push([data[i], data[i + 1], data[i + 2]]);
    }
    const assign = new Int16Array(pts.length);
    for (let iter = 0; iter < 6; iter++) {
      const sum = cents.map(() => [0, 0, 0, 0]);
      for (let p = 0; p < pts.length; p++) {
        const i = pts[p];
        let best = 0, bd = Infinity;
        for (let j = 0; j < k; j++) {
          const c = cents[j];
          const d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        assign[p] = best;
        const s = sum[best]; s[0] += data[i]; s[1] += data[i + 1]; s[2] += data[i + 2]; s[3]++;
      }
      for (let j = 0; j < k; j++) if (sum[j][3]) cents[j] = [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]];
    }
    for (let p = 0; p < pts.length; p++) {
      const i = pts[p], c = cents[assign[p]];
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  }

  // a touch of 16-bit vibrance: more contrast and saturation before the palette is reduced
  function enhance(data) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      let r = data[i], g = data[i + 1], b = data[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * 1.2; g = l + (g - l) * 1.2; b = l + (b - l) * 1.2;   // saturation
      r = (r - 128) * 1.08 + 128; g = (g - 128) * 1.08 + 128; b = (b - 128) * 1.08 + 128; // contrast
      data[i] = Math.max(0, Math.min(255, r)); data[i + 1] = Math.max(0, Math.min(255, g)); data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  function outline(data, size) {
    const a = (x, y) => data[(y * size + x) * 4 + 3] >= 128;
    // Only outline if the source has a transparent background (edges see-through)
    let transparentEdge = false;
    for (let x = 0; x < size && !transparentEdge; x++) if (!a(x, 0)) transparentEdge = true;
    if (!transparentEdge) return;
    const marks = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (a(x, y)) continue;
      if ((x > 0 && a(x - 1, y)) || (x < size - 1 && a(x + 1, y)) ||
          (y > 0 && a(x, y - 1)) || (y < size - 1 && a(x, y + 1))) marks.push((y * size + x) * 4);
    }
    for (const i of marks) { data[i] = 20; data[i + 1] = 20; data[i + 2] = 28; data[i + 3] = 255; }
  }

  /** Crop (square, biased toward the face) + downscale an image to SIZE x SIZE. */
  function downscale(img, prebaked) {
    const out = document.createElement("canvas");
    out.width = out.height = SIZE;
    const ctx = out.getContext("2d");
    if (prebaked) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      return out;
    }
    const w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
    const sx = (w - side) / 2, sy = (h - side) * 0.15;
    // step down for a cleaner average before the final pixel grid
    let src = img, sw = side, sh = side, ox = sx, oy = sy;
    let cur = side;
    while (cur / 2 > SIZE * 2) {
      cur = Math.floor(cur / 2);
      const t = document.createElement("canvas");
      t.width = t.height = cur;
      const tc = t.getContext("2d");
      tc.imageSmoothingQuality = "high";
      tc.drawImage(src, ox, oy, sw, sh, 0, 0, cur, cur);
      src = t; ox = oy = 0; sw = sh = cur;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, ox, oy, sw, sh, 0, 0, SIZE, SIZE);
    return out;
  }

  function stylize(canvas) {
    const ctx = canvas.getContext("2d");
    let id;
    try { id = ctx.getImageData(0, 0, SIZE, SIZE); } catch (e) { return canvas; } // tainted: pixel grid only
    const d = id.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
    enhance(d);
    quantize(d, COLORS);
    outline(d, SIZE);
    ctx.putImageData(id, 0, 0);
    return canvas;
  }

  function placeholder(player, team) {
    const c = document.createElement("canvas");
    c.width = c.height = SIZE;
    const ctx = c.getContext("2d");
    Sprites.drawHelmet(ctx, team, 8, 14, 4);
    c.dataset.placeholder = "1";
    return c;
  }

  async function build(player, team) {
    const baked = window.DEX_HEADSHOTS && window.DEX_HEADSHOTS[player.id];
    if (baked) {
      const img = await loadImage(baked, false);
      return downscale(img, true);
    }
    if (!player.headshot) return placeholder(player, team);
    return enqueue(async () => {
      try {
        // with CORS we can read pixels -> full palette reduction + outline
        return stylize(downscale(await loadImage(player.headshot, true), false));
      } catch (e) {
        try {
          // no CORS headers: we can still downscale onto a pixel grid
          return downscale(await loadImage(player.headshot, false), false);
        } catch (e2) {
          return placeholder(player, team);
        }
      }
    });
  }

  /** Returns a Promise of a SIZE x SIZE canvas. Callers should clone via copyTo. */
  function get(player, team) {
    const key = player.id;
    if (!cache.has(key)) cache.set(key, build(player, team));
    return cache.get(key);
  }

  /** Draw a portrait into a target canvas at integer scale. */
  async function paint(target, player, team) {
    const src = await get(player, team);
    const ctx = target.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(src, 0, 0, target.width, target.height);
    target.classList.toggle("is-placeholder", !!src.dataset.placeholder);
  }

  window.Portrait = { get, paint, SIZE };
})();
