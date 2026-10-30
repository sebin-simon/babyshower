/**
 * The wishing line: wishes hang as cream gift tags on twine under sagging fairy lights.
 * When a line scrolls into view its bulbs light left to right and the tags swing in,
 * then sway gently forever. Phones show 6 wishes + "Show all".
 *
 * SECURITY: wish text and names come straight from guests and the backend does not
 * escape them, so everything is rendered with textContent (via h()) — never innerHTML.
 */
import { $, $$, h, svg, MOTION, gsap, ST, rand } from './util.js';
import { stringLights } from './scenery.js';

let list = [], mine = null, showAll = false, sig = '', triggers = [], litRows = 0, lastPer = 0;

const perRow = () => (innerWidth >= 1100 ? 4 : innerWidth >= 680 ? 3 : 2);
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const isMine = (w) => mine && norm(w.firstName) === norm(mine.firstName) && norm(w.text) === norm(mine.text);

function tag(w) {
  const team = w.vote === 'sun' || w.vote === 'shine' ? w.vote : '';
  const cap = h('figcaption', {}, h('span', { class: 'who-n', text: w.firstName || 'A friend' }));
  if (team) cap.appendChild(h('span', { class: 'tm', text: team === 'sun' ? 'Team Sun ☀️' : 'Team Shine ✨' }));
  const fig = h('figure', { class: `tag ${team}${isMine(w) ? ' mine' : ''}` },
    h('div', { class: 'tag-in', style: { '--sd': (-rand(0, 6)).toFixed(1) + 's' } },
      h('div', { class: 'paper' }, h('blockquote', { text: w.text }), cap)));
  return fig;
}

function empty(wall) {
  const lan = svg('svg', { viewBox: '0 0 120 200', 'aria-hidden': 'true' });
  lan.appendChild(svg('use', { href: 'img/svg/sprite.svg#lantern' }));
  wall.appendChild(h('div', { class: 'wall-empty' }, lan, h('b', { text: 'No wishes yet' }),
    h('p', { text: 'Be the first to hang a little note for baby. It only takes a moment after you RSVP.' })));
}

function render() {
  const wall = $('#wall'), more = $('#moreWishes');
  const per = perRow();
  if (per !== lastPer) { litRows = 0; lastPer = per; }
  const initial = per === 2 ? 6 : per * 3;
  // keep the guest's own wish first so they can see it landed
  const ordered = mine ? [...list.filter(isMine), ...list.filter((w) => !isMine(w))] : list;
  const shown = showAll ? ordered : ordered.slice(0, initial);
  more.hidden = showAll || ordered.length <= initial;
  more.textContent = `Show all ${ordered.length} wishes`;
  triggers.forEach((t) => t.kill()); triggers = [];
  wall.textContent = '';
  wall.setAttribute('aria-busy', 'false');
  if (!shown.length) { empty(wall); return; }
  // a short list hangs on a shorter line instead of one tag in a long empty row
  const n = Math.max(2, Math.min(per, shown.length));
  wall.style.setProperty('--wall-max', n < per ? n * 300 + 'px' : '');
  const sag = n === 2 ? 22 : 38, top = 6;
  for (let i = 0, row = 0; i < shown.length; i += n, row++) {
    const items = shown.slice(i, i + n);
    const animate = MOTION && row >= litRows;
    const line = h('div', { class: 'wline' + (animate ? ' off' : '') });
    const lights = h('div', { class: 'lights', 'aria-hidden': 'true' });
    const hh = stringLights(lights, { bulbs: n * 3 + 1, sag, top, tint: true });
    const tags = h('ul', { class: 'tags', style: { '--n': n } });
    items.forEach((w, j) => {
      const t = (j + 0.5) / n, off = top + 4 * t * (1 - t) * sag - hh;
      tags.appendChild(h('li', { class: 'tcell', style: { '--off': off.toFixed(1) + 'px' } }, tag(w)));
    });
    line.append(lights, tags);
    wall.appendChild(line);
    if (animate) {
      gsap.set($$('.tag', line), { rotation: -22, opacity: 0 });
      const rowIdx = row;
      triggers.push(ST.create({
        trigger: line, start: 'top 85%', once: true,
        onEnter: () => {
          litRows = Math.max(litRows, rowIdx + 1);
          line.classList.remove('off');
          $$('.bulb', line).forEach((b, k) => { b.style.transitionDelay = k * 40 + 'ms'; });
          gsap.to($$('.tag', line), { rotation: 0, opacity: 1, duration: 2.2, ease: 'elastic.out(1,.32)', stagger: 0.14 });
        },
      }));
    }
  }
  if (MOTION) ST.refresh();
}

/** @param {{firstName, text, vote}[]} wishes from getPublic() */
export function setWishes(wishes) {
  const next = Array.isArray(wishes) ? wishes.filter((w) => w && w.text) : [];
  const s = JSON.stringify(next) + '|' + JSON.stringify(mine);
  if (s === sig) return;
  sig = s;
  list = next;
  render();
}

/** Mark the guest's own wish (gold glow) and make sure it's visible. */
export function setMyWish(firstName, text) {
  mine = text ? { firstName, text } : null;
  sig = '';
  render();
  const t = $('#wall .tag.mine');
  if (t && MOTION) gsap.fromTo(t, { rotation: -30, y: -40, opacity: 0 }, { rotation: 0, y: 0, opacity: 1, duration: 2, ease: 'elastic.out(1,.3)', delay: 0.2 });
}

export function initWishes() {
  $('#moreWishes').addEventListener('click', () => { showAll = true; render(); });
  let rT, w = innerWidth;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { if (Math.abs(innerWidth - w) > 40 && perRow() !== lastPer) { w = innerWidth; render(); } }, 200);
  });
}

/** First load failed: say so kindly (polling keeps trying). */
export function wishesError() {
  const wall = $('#wall');
  if (list.length || wall.querySelector('.tag')) return;
  wall.textContent = '';
  wall.setAttribute('aria-busy', 'false');
  wall.appendChild(h('div', { class: 'wall-empty' }, h('b', { text: 'Wishes are on their way…' }),
    h('p', { text: "We couldn't load the wishing line just now. We'll keep trying." })));
}
