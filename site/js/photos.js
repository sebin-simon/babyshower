/**
 * PHOTO MOMENTS: the one list hosts edit to add photos.
 *
 * HOW TO ADD A PHOTO (no other code changes needed):
 *   1. Drop the file in site/img/photos/ (or optimise it first:
 *        cd dev && node optimize-images.mjs ~/Desktop/scan.jpg ultrasound 800
 *      which writes ultrasound-800.jpg + ultrasound-800.webp).
 *   2. Set `src` below to its path, e.g. src: 'img/photos/ultrasound-800.jpg'.
 *      Optional: `webp` (same image as WebP), `width`/`height` (real pixel size,
 *      avoids layout shift), and a better `alt` description.
 *   An empty `src` shows the designed placeholder instead.
 *
 * Widths in srcset use each file's REAL pixel width (the -1600/-1200/-1800 files
 * are capped at the source size, see design/brand.md §6).
 */
import { $, h, svg, clamp, MOTION } from './util.js';

export const PHOTOS = {
  /** "From storybook to real life": the two images line up, so a wipe compares them. */
  wipe: {
    storybook: {
      src: 'img/photos/illustrated-wide-1000.jpg',
      srcset: 'img/photos/illustrated-wide-1000.jpg 1000w, img/photos/illustrated-wide-1800.jpg 1264w',
      webp: 'img/photos/illustrated-wide-1000.webp 1000w, img/photos/illustrated-wide-1800.webp 1264w',
      width: 1000, height: 666,
      alt: 'Storybook painting of Ayana and Sebin among yellow autumn trees, hands making a heart around a maple leaf on the bump',
    },
    real: {
      src: 'img/photos/couple-real-800.jpg',
      srcset: 'img/photos/couple-real-800.jpg 800w, img/photos/couple-real-1600.jpg 1600w',
      webp: 'img/photos/couple-real-800.webp 800w, img/photos/couple-real-1600.webp 1600w',
      width: 800, height: 533,
      alt: 'Photo of Ayana and Sebin in a yellow-leaf forest, hands making a heart around a maple leaf on the bump',
    },
  },

  /** First look: the sonogram polaroid. */
  ultrasound: {
    src: 'img/photos/baby-600.jpg', 
    webp: 'img/photos/baby-600.webp',
    alt: 'Our baby\'s first ultrasound',
    caption: 'Our very first look',
  },

  /** "Who will baby look like?" Square-ish, face-centred crops work best. */
  babyAyana: { 
    src: 'img/photos/ayana-600.jpg', 
    webp: 'img/photos/ayana-600.webp', alt: 'Ayana as a baby' },
  babySebin: { 
    src: 'img/photos/sebin-600.jpg', 
    webp: 'img/photos/sebin-600.webp', alt: 'Sebin as a baby' },

  /** Story strip: 3–6 polaroids. Captions are suggestions; change freely. */
  story: [
    { 
      src: 'img/photos/how-we-met-400.jpg',
      srcset: 'img/photos/how-we-met-400.jpg 300w, img/photos/how-we-met-600.jpg 896w',
      webp: 'img/photos/how-we-met-400.webp 600w, img/photos/how-we-met-600.webp 896w', caption: 'How we met', icon: 'camera', alt: '' },
    { 
      src: 'img/photos/big-yes-400.jpg',
      srcset: 'img/photos/big-yes-400.jpg 600w, img/photos/big-yes-600.jpg 896w',
      webp: 'img/photos/big-yes-400.webp 600w, img/photos/big-yes-600.webp 896w', caption: 'The big yes', icon: 'ring', alt: '' },
    {
      src: 'img/photos/cartoon-600.jpg',
      srcset: 'img/photos/cartoon-600.jpg 600w, img/photos/cartoon-1200.jpg 896w',
      webp: 'img/photos/cartoon-600.webp 600w, img/photos/cartoon-1200.webp 896w',
      width: 600, height: 804,
      caption: 'Our storybook',
      alt: 'Storybook cartoon of Ayana and Sebin in the golden forest with a hedgehog, a squirrel and lanterns',
    },
    { 
      src: 'img/photos/first-home-400.jpg',
      srcset: 'img/photos/first-home-400.jpg 600w, img/photos/first-home-600.jpg 896w',
      webp: 'img/photos/first-home-400.webp 600w, img/photos/first-home-600.webp 896w', caption: 'Our first home', icon: 'home', alt: '' },
    { 
      src: 'img/photos/day-we-found-out-400.jpg',
      srcset: 'img/photos/day-we-found-out-400.jpg 600w, img/photos/day-we-found-out-600.jpg 896w',
      webp: 'img/photos/day-we-found-out-400.webp 600w, img/photos/day-we-found-out-600.webp 896w', caption: 'The day we found out', icon: 'bigheart', alt: '' },
    { 
      src: 'img/photos/bump-400.jpg',
      srcset: 'img/photos/bump-400.jpg 600w, img/photos/bump-600.jpg 896w',
      webp: 'img/photos/bump-400.webp 600w, img/photos/bump-600.webp 896w', caption: 'Bump & beanie season', icon: 'leaf', alt: '' },
  ],
};

/* ---------------------------------------------------------------------------------- */

/** <picture> for a PHOTOS entry; always lazy (all photos sit below the fold). */
function picture(p, sizes, cls) {
  const img = h('img', {
    src: p.src, alt: p.alt || '', loading: 'lazy', decoding: 'async',
    srcset: p.srcset || null, sizes: p.srcset ? sizes : null,
    width: p.width || null, height: p.height || null,
  });
  const webp = p.webp || '';
  if (!webp) { if (cls) img.className = cls; return img; }
  const isList = /\s\d+w/.test(webp);
  return h('picture', { class: cls || null },
    h('source', { type: 'image/webp', srcset: webp, sizes: isList ? sizes : null }),
    img);
}
const useIcon = (id, cls) => { const s = svg('svg', { class: cls || '', 'aria-hidden': 'true', viewBox: '0 0 64 64' }); s.appendChild(svg('use', { href: '#i-' + id })); return s; };

/* ---------- storybook ⟷ real wipe ---------- */
let wipeEl, handle, userWiped = false;
export function setWipe(x) {
  if (!wipeEl) return;
  x = clamp(x, 0, 100);
  wipeEl.style.setProperty('--x', x + '%');
  handle.setAttribute('aria-valuenow', String(Math.round(x)));
  handle.setAttribute('aria-valuetext', `Storybook ${Math.round(x)}%, real photo ${100 - Math.round(x)}%`);
}
export const wipeTouched = () => userWiped;

function initWipe() {
  wipeEl = $('#wipe'); handle = $('#wipeHandle');
  if (!wipeEl) return;
  const sizes = '(min-width: 1012px) 980px, calc(100vw - 48px)';
  const real = picture(PHOTOS.wipe.real, sizes, 'w-real');
  const story = picture(PHOTOS.wipe.storybook, sizes, 'w-story');
  // The storybook layer sits on top and is clipped; its alt stays (it's a different image).
  wipeEl.prepend(real, story);

  let dragging = false, down = null;
  const fromEvent = (e) => { const r = wipeEl.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
  wipeEl.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId };
    if (e.pointerType === 'mouse') { dragging = true; userWiped = true; setWipe(fromEvent(e)); }
  });
  wipeEl.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = Math.abs(e.clientX - down.x), dy = Math.abs(e.clientY - down.y);
    // horizontal-only: a vertical swipe keeps scrolling the page
    if (!dragging && dx > 6 && dx > dy) { dragging = true; userWiped = true; try { wipeEl.setPointerCapture(down.id); } catch { /* */ } }
    if (dragging) setWipe(fromEvent(e));
  });
  const up = (e) => {
    if (down && !dragging && Math.abs(e.clientX - down.x) < 6 && Math.abs(e.clientY - down.y) < 6) { userWiped = true; setWipe(fromEvent(e)); }
    dragging = false; down = null;
  };
  wipeEl.addEventListener('pointerup', up);
  wipeEl.addEventListener('pointercancel', () => { dragging = false; down = null; });
  handle.addEventListener('keydown', (e) => {
    const cur = parseFloat(handle.getAttribute('aria-valuenow')) || 0;
    const step = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20, Home: -100, End: 100 }[e.key];
    if (step != null) { e.preventDefault(); userWiped = true; setWipe(cur + step); }
  });
  if (!MOTION) setWipe(50);
}

/* ---------- story polaroids ---------- */
const TILTS = [-5, 3, -2, 4, -4, 2.5];
function initChapters() {
  const ul = $('#chapters');
  if (!ul) return;
  PHOTOS.story.slice(0, 6).forEach((p, i) => {
    const pic = h('div', { class: 'pic' + (p.src ? '' : ' ph-pic') });
    if (p.src) pic.appendChild(picture(p, '(min-width: 900px) 200px, 64vw'));
    else pic.append(useIcon(p.icon || 'camera'), h('span', { text: 'photo coming soon ✨' }));
    const fig = h('figure', { class: 'polaroid', style: { '--r': TILTS[i % TILTS.length] + 'deg' } },
      h('span', { class: 'tape', 'aria-hidden': 'true' }), pic, h('figcaption', { text: p.caption || '' }));
    if (!p.src) fig.setAttribute('aria-label', `${p.caption}: photo coming soon`);
    ul.appendChild(h('li', {}, fig));
  });
}

/* ---------- first look (sonogram) ---------- */
function initSono() {
  const box = $('#sonoPic');
  if (!box) return;
  const p = PHOTOS.ultrasound;
  $('#sonoCap').textContent = p.caption || 'Our very first look';
  if (p.src) {
    box.appendChild(picture(p, '(min-width: 860px) 330px, 80vw'));
    $('#sonoLede').textContent = 'A tiny heartbeat, a blurry profile and a very big feeling. Say hello to our little light.';
    return;
  }
  // Live sonogram placeholder: scan fan, sweeping line, beating heart, EKG trace.
  const screen = h('div', { class: 'sono-screen', role: 'img', 'aria-label': 'Ultrasound coming soon' });
  const heart = svg('svg', { class: 'sono-heart', viewBox: '0 0 24 24', 'aria-hidden': 'true' }); heart.appendChild(svg('use', { href: '#i-heart' }));
  const bean = svg('svg', { class: 'sono-bean', viewBox: '0 0 100 80', 'aria-hidden': 'true' });
  bean.appendChild(svg('path', { d: 'M30 62C10 58 6 30 24 18C40 6 70 10 78 30C84 46 74 58 60 56C52 55 50 46 56 42', fill: 'none', stroke: 'rgba(210,240,236,.7)', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  const beat = svg('svg', { class: 'sono-beat', viewBox: '0 0 200 30', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  beat.appendChild(svg('path', { d: 'M0 18H70L78 4L88 28L96 10L102 18H200' }));
  const meta = h('span', { class: 'sono-meta', 'aria-hidden': 'true' }, 'FIRST LOOK', h('br'), 'BABY A & S');
  screen.append(h('div', { class: 'sono-fan', 'aria-hidden': 'true' }), bean, h('div', { class: 'sono-scan', 'aria-hidden': 'true' }), heart, meta,
    h('span', { class: 'sono-txt', 'aria-hidden': 'true', text: 'Ultrasound coming soon ✨' }), beat);
  box.appendChild(screen);
}

/* ---------- who will baby look like? ---------- */
function babyFace(boxId, p, mxId) {
  const box = $(boxId), mx = $(mxId);
  if (p.src) {
    box.appendChild(picture(p, '30vw'));
    const img2 = picture({ ...p, alt: '' }, '40vw');
    mx.appendChild(img2);
  } else {
    box.append(useIcon('onesie', 'ph-ico'), h('small', { text: 'photo soon ✨' }));
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', `${p.alt}: photo coming soon`);
  }
}
function initLookalike() {
  if (!$('#bbA')) return;
  babyFace('#bbA', PHOTOS.babyAyana, '#mxA');
  babyFace('#bbB', PHOTOS.babySebin, '#mxB');
  const input = $('#mix'), a = $('#mxA'), b = $('#mxB'), pct = $('#mixPct'), lbl = $('#mixLbl'), note = $('#llNote');
  const NOTES = ['Mama\'s mini-me, you say? Bold.', 'Leaning Ayana. Noted!', 'A perfect mix. Diplomatic!', 'Leaning Sebin. Noted!', 'Papa\'s twin, you say? Bold.'];
  const set = () => {
    const v = +input.value;
    a.style.opacity = String((100 - v) / 100);
    b.style.opacity = String(v / 100);
    pct.textContent = `${100 - v} · ${v}`;
    const l = v < 35 ? 'Mostly Ayana' : v > 65 ? 'Mostly Sebin' : 'A perfect mix';
    lbl.textContent = l;
    input.setAttribute('aria-valuetext', `${l}, ${100 - v}% Ayana, ${v}% Sebin`);
    return v;
  };
  let noteT;
  input.addEventListener('input', () => {
    const v = set();
    clearTimeout(noteT);
    noteT = setTimeout(() => { note.textContent = NOTES[Math.min(4, Math.floor(v / 20.01))]; }, 350);
  });
  set();
}

export function initPhotos() {
  initWipe();
  initChapters();
  initSono();
  initLookalike();
}
