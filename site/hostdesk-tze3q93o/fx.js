/**
 * Tiny canvas particle engine for the reveal: sparks, confetti, maple leaves
 * and glowing embers. One rAF loop that stops itself when nothing is left.
 * Frame-rate independent (motion is scaled by elapsed time), DPR capped at 2.
 * Every call is a no-op under prefers-reduced-motion.
 */

const MAPLE = 'M50 6 L56 24 L66 18 L63 38 L80 28 L76 42 L93 44 L82 56 L88 62 L64 64 L66 78 L54 70 L52 96 L48 96 L46 70 L34 78 L36 64 L12 62 L18 56 L7 44 L24 42 L20 28 L37 38 L34 18 L44 24 Z';
const GINKGO = 'M50 62 C30 62 10 48 8 26 C20 18 34 16 46 24 L50 34 L54 24 C66 16 80 18 92 26 C90 48 70 62 50 62 Z M48.6 60 L51.4 60 L51.4 94 L48.6 94 Z';
const STAR = 'M50 0 C54 34 66 46 100 50 C66 54 54 66 50 100 C46 66 34 54 0 50 C34 46 46 34 50 0 Z';

export const COLORS = {
  sun: ['#ffd98a', '#f2c230', '#9cccf2', '#4f8fd6', '#ffffff', '#d6e7f6'],
  shine: ['#ffffff', '#fadbe5', '#ff8fc0', '#ffd98a', '#ec8fb0'],
  gold: ['#ffd98a', '#f2c230', '#e8a317', '#fff3c4', '#c9841a'],
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function glowSprite(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner);
  g.addColorStop(0.5, outer);
  g.addColorStop(1, 'rgba(255,200,90,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

export function createFx(canvas, { reducedMotion = () => false } = {}) {
  const ctx = canvas.getContext('2d');
  const paths = { maple: new Path2D(MAPLE), ginkgo: new Path2D(GINKGO), star: new Path2D(STAR) };
  const GLOW = glowSprite('rgba(255,251,230,1)', 'rgba(255,214,120,.45)');
  let parts = [];
  let running = false;
  let last = 0;
  let W = 0, H = 0;
  let rain = null;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const k = clamp((now - last) / 16.667, 0.25, 3); // 1 = one 60fps frame
    last = now;
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      const drag = Math.pow(p.drag, k);
      p.vx *= drag;
      p.vy = p.vy * drag + p.g * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.r += p.vr * k;
      p.fl += 0.15 * k;
      p.life -= k;
      const a = clamp((p.life / p.max) * 2, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(p.x, p.y);
      if (p.shape === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(GLOW, -p.s, -p.s, p.s * 2, p.s * 2);
      } else if (p.shape === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(GLOW, -p.s * 1.6, -p.s * 1.6, p.s * 3.2, p.s * 3.2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.rotate(p.r * 0.3);
        const s = p.s / 50;
        ctx.scale(s, s);
        ctx.translate(-50, -50);
        ctx.fillStyle = p.c;
        ctx.fill(paths.star);
      } else if (p.shape === 'confetti') {
        ctx.rotate(p.r);
        ctx.scale(1, Math.cos(p.fl));
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      } else {
        ctx.rotate(p.r);
        const s = p.s / 50;
        ctx.scale(s * Math.cos(p.fl * 0.5), s);
        ctx.translate(-50, -50);
        ctx.fillStyle = p.c;
        ctx.fill(p.shape === 'ginkgo' ? paths.ginkgo : paths.maple);
      }
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  /** Burst of n particles from (x, y). */
  function burst(x, y, o = {}) {
    if (reducedMotion()) return;
    const n = o.n || 30;
    const cols = o.colors || COLORS.gold;
    const sp = o.speed || 6;
    const ang = o.angle == null ? -Math.PI / 2 : o.angle;
    const spr = o.spread == null ? Math.PI * 2 : o.spread;
    const size = o.size || [3, 8];
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spr;
      const v = sp * rand(0.35, 1);
      const life = (o.life || 80) * rand(0.6, 1);
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: o.gravity == null ? 0.12 : o.gravity, drag: o.drag || 0.975,
        life, max: o.life || 80, s: rand(size[0], size[1]), c: pick(cols),
        shape: Array.isArray(o.shape) ? pick(o.shape) : (o.shape || 'spark'),
        r: rand(0, 6.28), vr: rand(-0.2, 0.2), fl: rand(0, 6.28),
      });
    }
    start();
  }

  /** Embers drifting in from the edges towards (cx, cy). */
  function converge(cx, cy, n = 70) {
    if (reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28);
      const r = rand(160, Math.max(W, H) * 0.6);
      const life = rand(40, 75);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      parts.push({ x, y, vx: (cx - x) / life, vy: (cy - y) / life, g: 0, drag: 1, life, max: life * 1.6, s: rand(10, 22), c: '#ffd98a', shape: 'glow', r: 0, vr: 0, fl: 0 });
    }
    start();
  }

  /** The finale: Sun = confetti fountain + maple leaves from the corners; Shine = a pink glitter starburst. */
  function boom(team) {
    const cx = W / 2;
    const cy = H * 0.45;
    const big = Math.min(1.6, Math.max(0.8, Math.min(W, H) / 700)); // scale up on a TV
    if (team === 'sun') {
      burst(cx, H * 0.95, { n: 130, colors: COLORS.sun, speed: 17 * big, angle: -Math.PI / 2, spread: Math.PI * 0.8, gravity: 0.25, shape: 'confetti', life: 150, size: [8, 14] });
      burst(0, H, { n: 40, colors: COLORS.gold, speed: 15 * big, angle: -Math.PI / 3, spread: 0.8, gravity: 0.2, shape: ['maple', 'maple', 'ginkgo'], life: 170, size: [14, 26] });
      burst(W, H, { n: 40, colors: COLORS.gold, speed: 15 * big, angle: (-Math.PI * 2) / 3, spread: 0.8, gravity: 0.2, shape: ['maple', 'maple', 'ginkgo'], life: 170, size: [14, 26] });
    } else {
      burst(cx, cy, { n: 240, colors: COLORS.shine, speed: 15 * big, spread: Math.PI * 2, gravity: 0.04, drag: 0.955, shape: 'spark', life: 170, size: [3, 10] });
      burst(cx, cy, { n: 60, colors: ['#ff8fc0', '#ffd98a', '#ffffff'], speed: 9 * big, gravity: 0.12, shape: 'confetti', life: 150, size: [7, 12] });
    }
  }

  /** Gentle continuous rain after the reveal. */
  function startRain(team, density = 1) {
    stopRain();
    if (reducedMotion()) return;
    rain = setInterval(() => {
      if (document.hidden) return;
      if (Math.random() > density) return;
      if (team === 'sun') {
        burst(rand(0, W), -20, { n: 1, colors: COLORS.gold, speed: 1.5, angle: Math.PI / 2, spread: 0.8, gravity: 0.03, drag: 0.99, shape: ['maple', 'ginkgo'], life: 260, size: [12, 22] });
        burst(rand(0, W), -20, { n: 1, colors: ['#9cccf2', '#4f8fd6', '#ffffff', '#ffd98a'], speed: 2, angle: Math.PI / 2, spread: 0.6, gravity: 0.04, drag: 0.99, shape: 'confetti', life: 220, size: [8, 12] });
      } else {
        burst(rand(0, W), rand(-20, H * 0.4), { n: 2, colors: COLORS.shine, speed: 0.8, angle: Math.PI / 2, spread: 1.2, gravity: 0.01, drag: 0.99, shape: 'spark', life: 160, size: [3, 7] });
      }
    }, 120);
  }

  function stopRain() {
    if (rain) clearInterval(rain);
    rain = null;
  }

  function clear() {
    stopRain();
    parts = [];
    ctx.clearRect(0, 0, W, H);
  }

  return { size, burst, converge, boom, startRain, stopRain, clear, get W() { return W; }, get H() { return H; } };
}
