/**
 * The sky: one day in the golden forest, dawn to lantern-lit night, driven by scroll.
 * Each [data-sky] section names a palette; the fixed #sky gradient blends between the
 * palettes of the sections around the viewport centre (smoothstep). A soft sun crosses
 * the sky and sets at sunset. `darkness` (0..1) feeds the canvas (leaves dim, fireflies
 * appear). The browser chrome (theme-color) follows the sky.
 * Under reduced motion the colour blend is kept (colour only, nothing moves).
 *
 * Also drives the "little light" rail on the right edge.
 */
import { $, $$, clamp, RM } from './util.js';

// [top, middle, bottom, darkness]
const PAL = {
  dawn: ['#fff8ea', '#feecc8', '#f8d898', 0],
  morning: ['#fff6d8', '#ffe9ae', '#f8d470', 0],
  noon: ['#fff3c2', '#ffe48e', '#f6ca52', 0],
  afternoon: ['#ffefbb', '#fcd474', '#f1b746', 0],
  golden: ['#ffe5ab', '#f9c773', '#efa955', 0.05],
  lastlight: ['#ffe1ae', '#f8bf80', '#ef9e66', 0.1],
  sunset: ['#f7b27a', '#d9687a', '#7e2a48', 0.45],
  dusk: ['#5b1d29', '#3c1620', '#24111a', 0.88],
  night: ['#24111a', '#1a0d13', '#0f070b', 1],
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const RGB = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, [hex(v[0]), hex(v[1]), hex(v[2]), v[3]]]));
const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';

let sky, secs = [], marks = [], darkness = 0, scrollDelta = 0, lastY = 0, meta, rail;
let team = null;

function measure() {
  marks = secs.map((s) => {
    const r = s.getBoundingClientRect();
    return { c: r.top + scrollY + r.height / 2, p: RGB[s.dataset.sky] || RGB.noon };
  });
}
function progress() { return clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), 0, 1); }

function update() {
  if (!marks.length) return;
  const v = scrollY + innerHeight / 2;
  let i = 0;
  while (i < marks.length - 1 && marks[i + 1].c < v) i++;
  const a = marks[i], b = marks[Math.min(i + 1, marks.length - 1)];
  let t = b === a ? 0 : clamp((v - a.c) / (b.c - a.c), 0, 1);
  t = t * t * (3 - 2 * t);
  for (let k = 0; k < 3; k++) sky.style.setProperty('--sky' + (k + 1), mix(a.p[k], b.p[k], t));
  darkness = a.p[3] + (b.p[3] - a.p[3]) * t;
  const P = progress();
  const q = clamp(P / 0.62, 0, 1);
  sky.style.setProperty('--sx', (84 - q * 68).toFixed(1) + '%');
  sky.style.setProperty('--sy', (26 - Math.sin(q * Math.PI) * 18 + q * 14).toFixed(1) + '%');
  sky.style.setProperty('--sun-a', (0.8 * (1 - darkness)).toFixed(2));
  if (meta) meta.content = mix(a.p[0], b.p[0], t);
  if (rail) rail.style.transform = 'translateY(' + (innerHeight * (0.14 + P * 0.72)).toFixed(1) + 'px)';
}

export const sky_ = {
  getDarkness: () => darkness,
  consumeScrollDelta: () => { const d = scrollDelta; scrollDelta = 0; return d; },
  measure: () => { measure(); update(); },
  setTeam(t) { team = t; if (rail) { if (t) rail.dataset.team = t; else delete rail.dataset.team; rail.setAttribute('aria-label', t ? `Your little light: Team ${t === 'sun' ? 'Sun' : 'Shine'}. Jump to the vote` : 'The little light: jump to the vote'); } },
  get team() { return team; },
};

export function initSky() {
  sky = $('#sky');
  meta = document.querySelector('meta[name="theme-color"]');
  rail = $('#little-light');
  secs = $$('[data-sky]');
  lastY = scrollY;
  measure(); update();
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; scrollDelta += scrollY - lastY; lastY = scrollY; update(); });
  }, { passive: true });
  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { measure(); update(); }, 120); });
  addEventListener('load', () => { measure(); update(); });
  if ('ResizeObserver' in window) {
    let pend = false;
    new ResizeObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; measure(); update(); }); }).observe(document.body);
  }
  if (rail) rail.addEventListener('click', () => {
    const target = $('#guess');
    target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  });
  return sky_;
}
