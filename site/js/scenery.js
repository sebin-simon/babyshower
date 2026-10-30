/**
 * Generated decorative scenery (no guest data): fairy-light strings, the leafy canopy
 * branches in the hero corners, and the sunset treeline with its lanterns.
 */
import { svg, h } from './util.js';

/** Sagging string of fairy lights. Returns its height in px. */
export function stringLights(el, { bulbs = 12, sag = 30, top = 8, tint = false } = {}) {
  const hgt = top + sag + 22;
  el.style.height = hgt + 'px';
  el.textContent = '';
  const wire = svg('svg', { class: 'wire', viewBox: `0 0 100 ${hgt}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  wire.appendChild(svg('path', { d: `M-2 ${top} Q50 ${top + 2 * sag} 102 ${top}`, 'vector-effect': 'non-scaling-stroke' }));
  el.appendChild(wire);
  for (let i = 0; i < bulbs; i++) {
    const t = (i + 0.5) / bulbs, y = top + 4 * t * (1 - t) * sag;
    const b = h('span', { class: 'bulb' + (tint ? (i % 3 === 1 ? ' b-sun' : i % 3 === 2 ? ' b-shine' : '') : '') });
    b.style.left = (t * 100).toFixed(2) + '%';
    b.style.top = y.toFixed(1) + 'px';
    b.style.setProperty('--d', (-Math.random() * 3.4).toFixed(2) + 's');
    el.appendChild(b);
  }
  return hgt;
}

/** Seeded PRNG so the canopy and treeline look the same on every visit. */
const prng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export function canopy(el, seed) {
  const r = prng(seed);
  const cols = ['#f2c230', '#e8a317', '#f6d04d', '#ffd98a', '#d9921c', '#c9841a'];
  const root = svg('svg', { viewBox: '0 0 400 260', 'aria-hidden': 'true' });
  root.appendChild(svg('path', { d: 'M-20 10C80 30 160 70 330 160', fill: 'none', stroke: '#5a3a1e', 'stroke-width': 11, 'stroke-linecap': 'round' }));
  root.appendChild(svg('path', { d: 'M120 50C150 90 170 120 210 150', fill: 'none', stroke: '#5a3a1e', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  root.appendChild(svg('path', { d: 'M230 108C236 130 228 150 240 170', fill: 'none', stroke: '#5a3a1e', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
  for (let i = 0; i < 24; i++) {
    const t = i / 23, x = 10 + t * 300 + (r() - 0.5) * 60, y = 18 + t * 120 + (r() - 0.5) * 90, sz = 46 + r() * 52, rot = r() * 360;
    const c = cols[Math.floor(r() * cols.length)];
    const u = svg('use', {
      href: r() < 0.7 ? '#s-maple' : '#s-ginkgo', x: (x - sz / 2).toFixed(0), y: (y - sz / 2).toFixed(0),
      width: sz.toFixed(0), height: sz.toFixed(0), fill: c, color: c, transform: `rotate(${rot.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})`,
    });
    root.appendChild(u);
  }
  el.appendChild(root);
}

export function treeline(root) {
  const r = prng(7);
  const far = svg('g', { fill: '#6a2633', opacity: 0.85 });
  const near = svg('g', { fill: '#2e1218' });
  const lamps = svg('g', {});
  for (let x = -40; x < 1500; x += 44 + r() * 34) {
    const hh = 130 + r() * 80, w = 46 + r() * 36;
    far.appendChild(svg('ellipse', { cx: x.toFixed(0), cy: (262 - hh).toFixed(0), rx: w.toFixed(0), ry: (w * 1.15).toFixed(0) }));
  }
  far.appendChild(svg('rect', { x: 0, y: 200, width: 1440, height: 62 }));
  for (let x = -20; x < 1480; x += 70 + r() * 60) {
    const hh = 70 + r() * 60, w = 40 + r() * 30;
    near.appendChild(svg('rect', { x: (x - 5).toFixed(0), y: (262 - hh).toFixed(0), width: 10, height: hh.toFixed(0) }));
    near.appendChild(svg('ellipse', { cx: x.toFixed(0), cy: (262 - hh - w * 0.5).toFixed(0), rx: w.toFixed(0), ry: (w * 0.95).toFixed(0) }));
    if (r() < 0.55) {
      const lx = x + 30 + r() * 20, ly = 150 + r() * 60;
      const g = svg('g', { class: 'lamp' });
      g.appendChild(svg('line', { x1: lx.toFixed(0), y1: (ly - 26).toFixed(0), x2: lx.toFixed(0), y2: (ly - 6).toFixed(0), stroke: '#1a0b0f', 'stroke-width': 1.5 }));
      g.appendChild(svg('circle', { cx: lx.toFixed(0), cy: ly.toFixed(0), r: 26, fill: 'url(#g-lamp)' }));
      g.appendChild(svg('rect', { x: (lx - 4).toFixed(0), y: (ly - 6).toFixed(0), width: 8, height: 12, rx: 2, fill: '#ffe7a3' }));
      lamps.appendChild(g);
    }
  }
  near.appendChild(svg('rect', { x: 0, y: 235, width: 1440, height: 30 }));
  root.append(far, near, lamps);
}
