/**
 * "Jars of light": the live Sun vs Shine tally (visible to guests before the reveal).
 * Every vote is a firefly floating in its team's jar; a glowing liquid level rises with
 * the share of votes; big count-up numbers and a split bar with the little light at the
 * boundary. New votes from polling arrive as a glowing mote that arcs into the jar.
 * Loading/failed states never show "0 vs 0": the numbers shimmer and the note says
 * "Counting fireflies…".
 */
import { $, $$, MOTION, gsap, ST, TIER, rand, svg, inView, toast, centerOf } from './util.js';
import { burst, COL } from './leaves.js';

const MAX_FLIES = { low: 18, mid: 30, high: 44 }[TIER];
const votes = { sun: 0, shine: 0 };
let loaded = false, revealed = !MOTION, pendingAnim = false;

function fillFlies(t) {
  const g = $(`.jar-${t} .flies`);
  const want = Math.min(votes[t], MAX_FLIES);
  const col = t === 'sun' ? '#e6f1fb' : '#ffe3ee';
  const halo = t === 'sun' ? '#6fa3d6' : '#ec8fb0';
  while (g.children.length > want) g.lastChild.remove();
  for (let i = g.children.length; i < want; i++) {
    const outer = svg('g', { transform: `translate(${rand(42, 118).toFixed(1)} ${rand(80, 206).toFixed(1)})` });
    const inner = svg('g', { class: 'fly-in' });
    inner.style.setProperty('--dx', rand(-9, 9).toFixed(1) + 'px');
    inner.style.setProperty('--dy', rand(-12, 6).toFixed(1) + 'px');
    inner.style.setProperty('--t', rand(3, 7).toFixed(1) + 's');
    inner.style.setProperty('--d', (-rand(0, 6)).toFixed(1) + 's');
    inner.append(svg('circle', { r: 7, fill: halo, opacity: 0.28 }), svg('circle', { class: 'core', r: 2.6, fill: col }));
    outer.appendChild(inner);
    g.appendChild(outer);
  }
}

function render(animate) {
  const total = votes.sun + votes.shine;
  const max = Math.max(votes.sun, votes.shine, 1);
  const jars = $('#jars');
  jars.dataset.state = 'ready';
  for (const t of ['sun', 'shine']) {
    const h = total ? 26 + (140 * votes[t]) / max : 0;
    const lvl = $(`.jar-${t} .lvl`);
    if (animate && MOTION) gsap.to(lvl, { attr: { y: 220 - h, height: h }, duration: 1.6, ease: 'power3.out' });
    else { lvl.setAttribute('y', String(220 - h)); lvl.setAttribute('height', String(h)); }
    $(`[data-jar-pct="${t}"]`).textContent = total ? Math.round((votes[t] / total) * 100) + '%' : '0%';
    fillFlies(t);
    const el = $(`[data-jar-count="${t}"]`);
    if (animate && MOTION) {
      const o = { v: parseInt(el.textContent, 10) || 0 };
      gsap.to(o, { v: votes[t], duration: 1.5, ease: 'power2.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } });
    } else el.textContent = String(votes[t]);
  }
  const sb = $('#splitbar');
  const sp = total ? Math.round((votes.sun / total) * 100) : 50;
  sb.style.setProperty('--p', sp + '%');
  sb.classList.toggle('empty', !total);
  sb.setAttribute('aria-label', total ? `${sp}% Team Sun, ${100 - sp}% Team Shine` : 'No guesses yet');
  const note = $('#tallyNoteTxt');
  $('#tallyNote').classList.remove('off');
  note.textContent = total
    ? `Live · ${total} ${total === 1 ? 'guess' : 'guesses'} so far · new fireflies arrive as RSVPs come in`
    : 'No fireflies yet. Be the first to cast a guess!';
}

/** Glowing mote that arcs into a jar; resolves when it lands (or at once if offscreen). */
function flyMote(t, from) {
  return new Promise((resolve) => {
    const jar = $(`.jar-${t} .jar`);
    if (!MOTION || !inView(jar)) return resolve(false);
    const r = jar.getBoundingClientRect();
    const m = document.createElement('span');
    m.className = 'mote';
    m.style.setProperty('--c', t === 'sun' ? '#a9cdee' : '#f5b5cc');
    document.body.appendChild(m);
    gsap.set(m, { x: from[0], y: from[1] });
    gsap.timeline({ onComplete: () => { m.remove(); const [x, y] = centerOf(jar); burst(x, y - 30, { n: 14, colors: COL[t], speed: 3, gravity: 0, shape: 'spark', life: 50, size: [2, 5] }); resolve(true); } })
      .to(m, { x: r.left + r.width / 2, duration: 1.1, ease: 'sine.inOut' }, 0)
      .to(m, { y: r.top + r.height * 0.3, duration: 1.1, ease: 'back.in(1.6)' }, 0);
  });
}

/**
 * Apply counts from getPublic().
 * @param {{sun:number, shine:number}} d
 * @param {{live?: boolean, mine?: 'sun'|'shine'|null}} [o] live: from a poll (announce new votes); mine: the guest's own vote just landed
 */
export async function applyTally(d, o = {}) {
  const next = { sun: Math.max(0, d.sun | 0), shine: Math.max(0, d.shine | 0) };
  const first = !loaded;
  loaded = true;
  const grew = ['sun', 'shine'].filter((t) => next[t] > votes[t]);
  if (first || !revealed) {
    Object.assign(votes, next);
    if (revealed) render(MOTION && first); else { pendingAnim = true; $('#jars').dataset.state = 'ready'; render(false); resetForReveal(); }
    return;
  }
  if ((o.live || o.mine) && grew.length) {
    const t = o.mine && grew.includes(o.mine) ? o.mine : grew[0];
    const added = next[t] - votes[t];
    const msg = o.mine
      ? `${t === 'sun' ? '☀️' : '✨'} Your firefly just joined Team ${t === 'sun' ? 'Sun' : 'Shine'}`
      : `${t === 'sun' ? '☀️' : '✨'} ${added > 1 ? added + ' new fireflies' : 'A new firefly'} just joined Team ${t === 'sun' ? 'Sun' : 'Shine'}`;
    toast(msg);
    $('#tallyLive').textContent = msg.replace(/^[^A-Za-z]+/, '');
    await flyMote(t, o.mine ? [innerWidth / 2, innerHeight * 0.18] : [innerWidth / 2, innerHeight - 90]);
  }
  Object.assign(votes, next);
  render(true);
}

/** Before the jars scroll into view, empty them so they can fill up on entry. */
function resetForReveal() {
  for (const t of ['sun', 'shine']) {
    const lvl = $(`.jar-${t} .lvl`);
    lvl.dataset.y = lvl.getAttribute('y'); lvl.dataset.h = lvl.getAttribute('height');
    lvl.setAttribute('y', '220'); lvl.setAttribute('height', '0');
    $(`[data-jar-count="${t}"]`).textContent = '0';
  }
}

export function tallyError() {
  if (loaded) return; // keep showing the last good numbers
  $('#jars').dataset.state = 'error';
  $('#tallyNote').classList.add('off');
  $('#tallyNoteTxt').textContent = 'Counting fireflies… (we\'ll keep trying)';
  $('#splitbar').classList.add('empty');
}

export function initTally() {
  if (!MOTION) return;
  ST.create({
    trigger: '#jars', start: 'top 80%', once: true,
    onEnter: () => {
      revealed = true;
      if (!pendingAnim) return; // data not here yet; render() will run on arrival
      pendingAnim = false;
      for (const t of ['sun', 'shine']) $(`[data-jar-count="${t}"]`).textContent = '0';
      render(true);
      const fl = $$('#jars .fly-in');
      if (fl.length) gsap.from(fl, { opacity: 0, duration: 0.6, stagger: { each: 0.02, from: 'random' } });
    },
  });
  gsap.from('.jarbox', { y: 40, opacity: 0, duration: 1, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: '#jars', start: 'top 85%', once: true } });
}
