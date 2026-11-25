#!/usr/bin/env node
/*
  Draws the site's generated artwork: contour ("topographic") lines from a seeded
  noise field, in the brand's ink, paper and red. Nothing is traced or downloaded;
  the same seed always draws the same picture.

    node scripts/build_art.js        writes public/assets/art-topo-*.webp

  Needs Playwright with Chromium (the canvas does the drawing and the WebP
  encoding). It is a build-time tool only; the site itself has no dependencies.

  Files
    art-topo-dark-1600.webp / -900.webp   ink background, pale lines, one red contour.
                                          Closing panel, page heroes, 404.
    art-topo-light-1400.webp              paper background, ink lines. Behind the homepage hero.
    og-burnworth-1200.jpg                 1200 x 630 share card (link previews in messages and
                                          social apps): wordmark, headline and the dark artwork.
*/
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');

const OUT = path.resolve(__dirname, '..', 'public', 'assets');

// Runs inside the page.
function draw({width, height, seed, theme, cell}) {
  // Small seeded generator, so every build draws the same lines.
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // 2D simplex noise.
  const perm = new Uint8Array(512);
  const p = Array.from({length: 256}, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const noise = (x, y) => {
    const sk = (x + y) * F2, i = Math.floor(x + sk), j = Math.floor(y + sk), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const corner = (cx, cy, gi) => { let a = 0.5 - cx * cx - cy * cy; if (a < 0) return 0; a *= a; const g = grad[gi % 8]; return a * a * (g[0] * cx + g[1] * cy); };
    return 70 * (corner(x0, y0, perm[ii + perm[jj]]) + corner(x1, y1, perm[ii + i1 + perm[jj + j1]]) + corner(x2, y2, perm[ii + 1 + perm[jj + 1]]));
  };
  // Terrain: three octaves of noise plus two broad hills, so the lines gather
  // around a summit instead of wandering evenly.
  const hills = [{x: 0.68, y: 0.42, r: 0.42, h: 1.05}, {x: 0.2, y: 0.78, r: 0.36, h: 0.55}];
  const field = (x, y) => {
    const u = x / height, v = y / height;
    let f = 0.62 * noise(u * 1.15, v * 1.15) + 0.26 * noise(u * 2.6 + 9.1, v * 2.6 - 4.2) + 0.1 * noise(u * 5.4 - 2.7, v * 5.4 + 7.7);
    for (const hill of hills) { const dx = x / width - hill.x, dy = (y / height - hill.y) * (height / width); f += hill.h * Math.exp(-(dx * dx + dy * dy) / (hill.r * hill.r * 0.5)); }
    return f;
  };

  const cols = Math.ceil(width / cell) + 1, rows = Math.ceil(height / cell) + 1;
  const grid = new Float32Array(cols * rows);
  let min = Infinity, max = -Infinity, peak = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const value = field(i * cell, j * cell);
    grid[j * cols + i] = value;
    if (value < min) min = value;
    if (value > max) { max = value; peak = j * cols + i; }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const dark = theme === 'dark';
  // Opaque: a transparent WebP of thin lines is five times the size. The light
  // version is drawn on the page's paper colour and faded at the edges in CSS.
  ctx.fillStyle = dark ? '#11100f' : '#f3f0e8';
  ctx.fillRect(0, 0, width, height);

  // Marching squares: one short segment per cell edge crossing, per level.
  const LEVELS = 26;
  const accent = LEVELS - 5; // the red contour, near the summit
  const segments = (level) => {
    const path = new Path2D();
    const at = (a, b) => (level - a) / (b - a);
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = grid[j * cols + i], b = grid[j * cols + i + 1], c = grid[(j + 1) * cols + i + 1], d = grid[(j + 1) * cols + i];
      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x = i * cell, y = j * cell;
      const top = [x + at(a, b) * cell, y], right = [x + cell, y + at(b, c) * cell], bottom = [x + at(d, c) * cell, y + cell], left = [x, y + at(a, d) * cell];
      const line = (m, n) => { path.moveTo(m[0], m[1]); path.lineTo(n[0], n[1]); };
      switch (code) {
        case 1: case 14: line(left, bottom); break;
        case 2: case 13: line(bottom, right); break;
        case 3: case 12: line(left, right); break;
        case 4: case 11: line(top, right); break;
        case 6: case 9: line(top, bottom); break;
        case 7: case 8: line(left, top); break;
        case 5: line(left, top); line(bottom, right); break;
        case 10: line(left, bottom); line(top, right); break;
      }
    }
    return path;
  };

  ctx.lineCap = 'round';
  const scale = width / 1600;
  for (let n = 1; n < LEVELS; n++) {
    const level = min + (max - min) * (n / LEVELS);
    const path = segments(level);
    const index = n % 5 === 0; // every fifth line is heavier, as on a survey map
    if (n === accent) {
      ctx.save();
      ctx.strokeStyle = '#e2462f';
      ctx.lineWidth = 2.1 * scale;
      if (dark) { ctx.shadowColor = 'rgba(226,70,47,.55)'; ctx.shadowBlur = 16 * scale; }
      ctx.stroke(path);
      ctx.restore();
    } else {
      ctx.strokeStyle = dark ? `rgba(251,250,246,${index ? 0.2 : 0.085})` : `rgba(17,16,15,${index ? 0.17 : 0.075})`;
      ctx.lineWidth = (index ? 1.35 : 1) * scale;
      ctx.stroke(path);
    }
  }

  // The summit: a red point with two rings, like a pin dropped on a map.
  const px = (peak % cols) * cell, py = Math.floor(peak / cols) * cell;
  ctx.fillStyle = '#e2462f';
  ctx.beginPath(); ctx.arc(px, py, 5.5 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(226,70,47,.5)'; ctx.lineWidth = 1.2 * scale;
  ctx.beginPath(); ctx.arc(px, py, 14 * scale, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(226,70,47,.22)';
  ctx.beginPath(); ctx.arc(px, py, 26 * scale, 0, Math.PI * 2); ctx.stroke();

  return {canvas, peak: [px / width, py / height]};
}

const JOBS = [
  {name: 'art-topo-dark', theme: 'dark', seed: 20261124, width: 2400, height: 1500, sizes: [1600, 900], quality: 0.72},
  {name: 'art-topo-light', theme: 'light', seed: 20261124, width: 2100, height: 1500, sizes: [1400], quality: 0.8},
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const job of JOBS) {
    for (const size of job.sizes) {
      const result = await page.evaluate(async ({source, job, size}) => {
        const {canvas, peak} = (new Function('return ' + source)())({width: job.width, height: job.height, seed: job.seed, theme: job.theme, cell: 5});
        const out = document.createElement('canvas');
        out.width = size; out.height = Math.round(size * job.height / job.width);
        const ctx = out.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/webp', job.quality));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return {base64: btoa(binary), height: out.height, peak};
      }, {source: draw.toString(), job, size});
      const file = path.join(OUT, `${job.name}-${size}.webp`);
      fs.writeFileSync(file, Buffer.from(result.base64, 'base64'));
      console.log(`${path.basename(file)}  ${size}x${result.height}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  summit at ${result.peak.map((n) => (n * 100).toFixed(1) + '%').join(', ')}`);
    }
  }
  // Share card. JPEG, because some link-preview scrapers still skip WebP.
  const asset = (name, type) => `data:${type};base64,${fs.readFileSync(path.join(OUT, name)).toString('base64')}`;
  const wordmark = fs.readFileSync(path.join(__dirname, 'wordmark-path.txt'), 'utf8').trim();
  const card = await browser.newPage({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1});
  await card.setContent(`<!doctype html><meta charset="utf-8"><style>
    @font-face{font-family:Archivo;font-weight:400 700;src:url(${asset('archivo-latin.woff2', 'font/woff2')}) format('woff2')}
    @font-face{font-family:Accent;font-style:italic;font-weight:500;src:url(${asset('accent-italic.woff2', 'font/woff2')}) format('woff2')}
    *{box-sizing:border-box;margin:0}
    body{width:1200px;height:630px;padding:64px 72px;background:#11100f url(${asset('art-topo-dark-1600.webp', 'image/webp')}) 140px -190px/1500px auto no-repeat;color:#fbfaf6;font-family:Archivo,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;-webkit-font-smoothing:antialiased}
    body::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#11100f 22%,rgba(17,16,15,.55) 58%,rgba(17,16,15,0))}
    body>*{position:relative}
    svg{height:36px;width:auto;align-self:flex-start}
    h1{font-size:112px;font-weight:500;line-height:.94;letter-spacing:-.05em}
    em{font-family:Accent,Georgia,serif;font-style:italic;font-weight:500;letter-spacing:-.025em;color:#e2462f}
    p{display:flex;justify-content:space-between;align-items:baseline;font-size:26px;color:#cbc7bd;letter-spacing:-.01em}
    p b{font-weight:600;color:#fbfaf6}
  </style>
  <svg viewBox="0 0 670.5 77"><path fill="#fbfaf6" d="${wordmark}"/><circle fill="#e2462f" cx="663.3" cy="68.3" r="7.2"/></svg>
  <h1>Turn searches into<br><em>booked jobs.</em></h1>
  <p><span>Websites, SEO and ads for contractors and service businesses</span><b>burnworthco.com</b></p>`);
  await card.evaluate(() => document.fonts.ready);
  const og = path.join(OUT, 'og-burnworth-1200.jpg');
  await card.screenshot({path: og, type: 'jpeg', quality: 86});
  console.log(`${path.basename(og)}  1200x630  ${(fs.statSync(og).size / 1024).toFixed(0)} KB`);
  await browser.close();
})();
