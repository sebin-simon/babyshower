/**
 * Canvas particles.
 *  - Ambient layer (#ambient): falling leaves (pre-rendered from the brand leaf SVGs),
 *    warm daytime bokeh, and fireflies that fade in as the sky darkens.
 *  - FX layer (#fx): one-shot bursts (sparks, confetti, leaves) for votes and RSVPs.
 * Both pause when the tab is hidden; the FX loop stops when no particles are left.
 * Particle counts are capped by device tier and trimmed further if frames run slow.
 * Reduced motion: no loops; a single static scatter of leaves is drawn instead.
 */
import { RM, TIER, clamp, rand, pick } from './util.js';

export const COL = {
  sun: ['#d6e7f6', '#6fa3d6', '#ffd98a', '#f2c230', '#ffffff'],
  shine: ['#ffffff', '#fadbe5', '#ec8fb0', '#ffd98a', '#f5b5cc'],
  gold: ['#ffd98a', '#f2c230', '#e8a317', '#fff6d6'],
};
const CAPS = {
  low: { leaves: 8, bokeh: 4, flies: 10, dpr: 1.5, parts: 140, k: 0.5 },
  mid: { leaves: 14, bokeh: 6, flies: 16, dpr: 2, parts: 260, k: 0.8 },
  high: { leaves: 26, bokeh: 10, flies: 28, dpr: 2, parts: 480, k: 1 },
}[TIER];

const DPR = Math.min(window.devicePixelRatio || 1, CAPS.dpr);
let W = innerWidth, H = innerHeight;

/* ---------- sprites ---------- */
function glowSprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.25, inner); g.addColorStop(0.5, outer); g.addColorStop(1, 'rgba(255,200,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return c;
}
const GLOW = glowSprite('rgba(255,251,230,1)', 'rgba(255,214,120,.45)');
const BOKEH = glowSprite('rgba(255,244,205,.55)', 'rgba(255,220,140,.18)');
const STAR = new Path2D('M50 0C54 34 66 46 100 50C66 54 54 66 50 100C46 66 34 54 0 50C34 46 46 34 50 0Z');

// Leaf mix per brand.md: ~40% maple-1, 25% maple-2, 25% gingko, 10% oak; colours gold, amber, honey, rust.
const LEAF_FILES = [['leaf-maple-1', 0.4], ['leaf-maple-2', 0.25], ['leaf-gingko', 0.25], ['leaf-oak', 0.1]];
const LEAF_COLORS = ['#f2c230', '#e8a317', '#c9841a', '#a4511f', '#f6d04d'];
const LEAF_PX = 64; // bitmap size; drawn at 24–56px
let leafBitmaps = []; // [{w: weight, imgs: [canvas per colour]}]

async function loadLeafBitmaps() {
  const out = [];
  await Promise.all(LEAF_FILES.map(async ([name, w], idx) => {
    try {
      const res = await fetch(`img/svg/${name}.svg`);
      if (!res.ok) return;
      const src = await res.text();
      const imgs = [];
      for (const col of LEAF_COLORS) {
        const tinted = src.replace(/currentColor/g, col).replace(/color="#[0-9a-f]{3,6}"/i, `color="${col}"`)
          .replace('<svg ', `<svg width="${LEAF_PX}" height="${LEAF_PX}" `);
        const url = URL.createObjectURL(new Blob([tinted], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = url;
        try { await img.decode(); } catch { URL.revokeObjectURL(url); continue; }
        const c = document.createElement('canvas'); c.width = c.height = LEAF_PX;
        c.getContext('2d').drawImage(img, 0, 0, LEAF_PX, LEAF_PX);
        URL.revokeObjectURL(url);
        imgs.push(c);
      }
      if (imgs.length) out[idx] = { w, imgs };
    } catch { /* offline: fall back to vector maple */ }
  }));
  leafBitmaps = out.filter(Boolean);
}
const MAPLE = new Path2D('M50 6L57 23L66 17L64 37L79 27L77 40L94 41L84 51L90 58L70 65L73 73L53 69L50 69L47 69L27 73L30 65L10 58L16 51L6 41L23 40L21 27L36 37L34 17L43 23Z');
function pickLeafBitmap() {
  if (!leafBitmaps.length) return null;
  let r = Math.random() * leafBitmaps.reduce((a, b) => a + b.w, 0);
  for (const l of leafBitmaps) { if ((r -= l.w) <= 0) return pick(l.imgs); }
  return pick(leafBitmaps[0].imgs);
}

/* ---------- ambient layer ---------- */
const amb = { c: null, x: null, on: false, running: false, visible: true, inView: true, leaves: [], bokeh: [], flies: [], wind: 0, sky: null };
const perf = { acc: 0, n: 0, last: 0, trimmed: 0 };

function newLeaf(init) {
  const depth = rand(0.55, 1.2);
  return {
    x: rand(-20, W + 20), y: init ? rand(-H * 0.2, H) : rand(-90, -30),
    s: rand(24, 56) * (0.6 + depth * 0.4), r: rand(0, 6.28), vr: rand(-0.018, 0.018),
    vy: rand(0.35, 0.85) * depth, sw: rand(0.4, 1.3), ph: rand(0, 6.28), fl: rand(0, 6.28), vf: rand(0.012, 0.03),
    img: pickLeafBitmap(), c: pick(LEAF_COLORS), a: rand(0.72, 0.95), depth,
  };
}
function seed() {
  amb.leaves = Array.from({ length: CAPS.leaves }, () => newLeaf(true));
  amb.bokeh = Array.from({ length: CAPS.bokeh }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(50, 130), vx: rand(-0.12, 0.12), vy: rand(-0.1, 0.06), ph: rand(0, 6) }));
  amb.flies = Array.from({ length: CAPS.flies }, () => ({ x: rand(0, W), y: rand(H * 0.15, H), ph: rand(0, 6.28), sp: rand(0.006, 0.016), r: rand(10, 22), ax: rand(20, 60), ay: rand(14, 40) }));
}
function drawLeaf(ctx, l) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.rotate(l.r);
  const flip = 0.25 + 0.75 * Math.abs(Math.cos(l.fl));
  ctx.scale(flip, 1);
  if (l.img) ctx.drawImage(l.img, -l.s / 2, -l.s / 2, l.s, l.s);
  else { const k = l.s / 100; ctx.scale(k, k); ctx.translate(-50, -50); ctx.fillStyle = l.c; ctx.fill(MAPLE); }
  ctx.restore();
}
function size() {
  W = innerWidth; H = innerHeight;
  for (const c of [amb.c, fx.c]) {
    if (!c) continue;
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  }
}
function frame(t) {
  amb.running = false;
  if (!amb.on || !amb.visible || !amb.inView) return;
  // adaptive quality: if frames average > 24ms for ~1.5s, trim a third of the particles (twice at most)
  if (perf.last) { perf.acc += t - perf.last; perf.n++; }
  perf.last = t;
  if (perf.n >= 90) {
    if (perf.acc / perf.n > 24 && perf.trimmed < 2) {
      perf.trimmed++;
      amb.leaves.length = Math.max(5, Math.round(amb.leaves.length * 0.66));
      amb.flies.length = Math.max(6, Math.round(amb.flies.length * 0.66));
      amb.bokeh.length = Math.max(2, Math.round(amb.bokeh.length * 0.6));
    }
    perf.acc = 0; perf.n = 0;
  }
  const ctx = amb.x;
  ctx.clearRect(0, 0, W, H);
  const d = amb.sky ? amb.sky.consumeScrollDelta() : 0;
  const dark = amb.sky ? amb.sky.getDarkness() : 0;
  amb.wind += (clamp(d, -80, 80) * 0.03 - amb.wind) * 0.08;
  const day = 1 - dark;
  if (day > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of amb.bokeh) {
      b.x += b.vx; b.y += b.vy - d * 0.05; b.ph += 0.01;
      if (b.y < -150) b.y = H + 100; if (b.y > H + 150) b.y = -100;
      if (b.x < -150) b.x = W + 100; if (b.x > W + 150) b.x = -100;
      ctx.globalAlpha = (0.45 + Math.sin(b.ph) * 0.2) * day;
      ctx.drawImage(BOKEH, b.x - b.s / 2, b.y - b.s / 2, b.s, b.s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  for (const l of amb.leaves) {
    l.ph += 0.012; l.fl += l.vf; l.r += l.vr + amb.wind * 0.01;
    l.x += Math.sin(l.ph) * l.sw * 0.6 + amb.wind * l.depth;
    l.y += l.vy - d * 0.22 * l.depth; // scrolling down lifts the leaves
    if (l.y > H + 50 || l.x < -70 || l.x > W + 70) Object.assign(l, newLeaf(false));
    if (l.y < -140) l.y = H + 30;
    ctx.globalAlpha = l.a * (1 - dark * 0.55);
    drawLeaf(ctx, l);
  }
  if (dark > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    for (const f of amb.flies) {
      f.ph += f.sp;
      f.y -= d * 0.1; if (f.y < -40) f.y = H + 20; if (f.y > H + 40) f.y = -20;
      const x = f.x + Math.sin(f.ph * 1.3) * f.ax, y = f.y + Math.cos(f.ph) * f.ay;
      ctx.globalAlpha = dark * (0.35 + 0.65 * Math.abs(Math.sin(f.ph * 2.2)));
      ctx.drawImage(GLOW, x - f.r, y - f.r, f.r * 2, f.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  schedule();
}
function schedule() {
  if (amb.running || !amb.on || !amb.visible || !amb.inView) return;
  amb.running = true;
  requestAnimationFrame(frame);
}
function drawStatic() {
  // Reduced motion: one still frame of leaves resting along the edges, nothing moves.
  const ctx = amb.x;
  ctx.clearRect(0, 0, W, H);
  const n = Math.min(10, CAPS.leaves);
  for (let i = 0; i < n; i++) {
    const l = newLeaf(true);
    const edge = i % 2 ? rand(0, W * 0.16) : rand(W * 0.84, W);
    l.x = edge; l.y = rand(H * 0.05, H * 0.95); l.fl = 0;
    ctx.globalAlpha = 0.55;
    drawLeaf(ctx, l);
  }
  ctx.globalAlpha = 1;
}

export async function initAmbient(sky) {
  amb.c = document.getElementById('ambient');
  fx.c = document.getElementById('fx');
  if (!amb.c || !amb.c.getContext) return;
  amb.x = amb.c.getContext('2d');
  fx.x = fx.c.getContext('2d');
  amb.sky = sky;
  size();
  await loadLeafBitmaps();
  seed();
  let rT;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { const ow = W; size(); if (Math.abs(ow - W) > 80) seed(); if (RM) drawStatic(); }, 160);
  });
  if (RM) { drawStatic(); return; }
  document.addEventListener('visibilitychange', () => {
    amb.visible = document.visibilityState === 'visible';
    perf.last = 0;
    schedule();
    if (amb.visible && fx.parts.length) runFx();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { amb.inView = es[0].isIntersecting; schedule(); }).observe(amb.c);
  }
  amb.on = true;
  schedule();
}

/* ---------- FX bursts ---------- */
const fx = { c: null, x: null, parts: [], running: false };
/**
 * @param {number} x @param {number} y viewport coords
 * @param {{n?, colors?, speed?, angle?, spread?, gravity?, drag?, life?, size?, shape?: 'spark'|'confetti'|'leaf'|'glow'}} o
 */
export function burst(x, y, o = {}) {
  if (RM || !fx.x || document.visibilityState === 'hidden') return;
  const n = Math.max(1, Math.round((o.n || 30) * CAPS.k));
  const room = CAPS.parts - fx.parts.length;
  if (room <= 0) return;
  const cols = o.colors || COL.gold, sp = o.speed || 6, ang = o.angle == null ? -Math.PI / 2 : o.angle, spr = o.spread == null ? Math.PI * 2 : o.spread;
  const sz = o.size || [3, 8];
  for (let i = 0; i < Math.min(n, room); i++) {
    const a = ang + (Math.random() - 0.5) * spr, v = sp * rand(0.35, 1);
    fx.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity == null ? 0.12 : o.gravity, drag: o.drag || 0.975,
      life: (o.life || 80) * rand(0.6, 1), max: o.life || 80, s: rand(sz[0], sz[1]), c: pick(cols), shape: o.shape || 'spark',
      r: rand(0, 6.28), vr: rand(-0.2, 0.2), fl: rand(0, 6.28), img: o.shape === 'leaf' ? pickLeafBitmap() : null,
    });
  }
  runFx();
}
function runFx() { if (!fx.running) { fx.running = true; requestAnimationFrame(fxLoop); } }
function fxLoop() {
  const ctx = fx.x;
  ctx.clearRect(0, 0, W, H);
  if (document.visibilityState === 'hidden') { fx.running = false; return; }
  fx.parts = fx.parts.filter((p) => p.life > 0);
  for (const p of fx.parts) {
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.fl += 0.15; p.life--;
    const a = clamp((p.life / p.max) * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y);
    if (p.shape === 'glow') { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GLOW, -p.s, -p.s, p.s * 2, p.s * 2); }
    else if (p.shape === 'spark') {
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(GLOW, -p.s * 1.6, -p.s * 1.6, p.s * 3.2, p.s * 3.2);
      ctx.globalCompositeOperation = 'source-over'; ctx.rotate(p.r * 0.3); const k = p.s / 50; ctx.scale(k, k); ctx.translate(-50, -50); ctx.fillStyle = p.c; ctx.fill(STAR);
    } else if (p.shape === 'confetti') { ctx.rotate(p.r); ctx.scale(1, Math.cos(p.fl)); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
    else if (p.shape === 'leaf') {
      ctx.rotate(p.r); ctx.scale(Math.cos(p.fl * 0.5), 1);
      if (p.img) ctx.drawImage(p.img, -p.s, -p.s, p.s * 2, p.s * 2);
      else { const k = p.s / 50; ctx.scale(k, k); ctx.translate(-50, -50); ctx.fillStyle = p.c; ctx.fill(MAPLE); }
    }
    ctx.restore();
  }
  if (fx.parts.length) requestAnimationFrame(fxLoop);
  else { fx.running = false; ctx.clearRect(0, 0, W, H); }
}
