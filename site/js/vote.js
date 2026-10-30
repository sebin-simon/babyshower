/**
 * "Which way will the little light go?" The fork-in-the-path vote.
 * Tapping a side sends the little light down that branch (the trail lights up in the
 * team colour), then it becomes the team icon with a pop and a particle burst.
 * The choice is synced both ways with the RSVP form's Sun/Shine radios.
 * Accessibility: aria-pressed buttons + an aria-live status line.
 */
import { $, $$, MOTION, gsap, buzz, centerOf } from './util.js';
import { burst, COL } from './leaves.js';

let team = null, orbTween = null, onChange = () => {};
const LEN = {};
let paths, lit, orb, duel, sec, status;

function setUI(t) {
  for (const b of $$('.side')) b.setAttribute('aria-pressed', String(b.dataset.team === t));
  duel.classList.toggle('chosen', !!t);
  if (t) sec.dataset.team = t; else delete sec.dataset.team;
  status.textContent = '';
  if (!t) { status.textContent = 'Two paths, one little light. Which will it be?'; return; }
  const name = t === 'sun' ? 'Team Sun ☀️💙' : 'Team Shine ✨💖';
  const b = document.createElement('b');
  b.className = t === 'sun' ? 't-sun' : 't-shine';
  b.textContent = name;
  const a = document.createElement('a');
  a.href = '#rsvp';
  a.textContent = 'Finish your RSVP ↓';
  status.append("You're ", b, '. Changed your mind? Tap the other side. ', a);
}

function ignite(t) {
  const ico = $(`.side-${t} .side-ico`);
  const [x, y] = centerOf(ico);
  if (t === 'sun') {
    burst(x, y, { n: 34, colors: COL.sun, speed: 7, gravity: 0.05, shape: 'spark', life: 70, size: [3, 7] });
    burst(x, y, { n: 14, colors: COL.gold, speed: 5, gravity: 0.1, shape: 'leaf', life: 90, size: [9, 14] });
  } else {
    burst(x, y, { n: 54, colors: COL.shine, speed: 8, gravity: 0.03, drag: 0.96, shape: 'spark', life: 85, size: [3, 8] });
  }
  if (MOTION) gsap.fromTo(ico, { scale: 0.7 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1,.4)', transformOrigin: '50% 50%' });
  buzz(18);
}

/**
 * @param {'sun'|'shine'|null} t
 * @param {{instant?: boolean, silent?: boolean}} [o] instant: no travel animation; silent: don't notify listeners
 */
export function setVote(t, o = {}) {
  if (t !== 'sun' && t !== 'shine') t = null;
  if (t === team && !o.force) return;
  const prev = team;
  team = t;
  setUI(t);
  if (!o.silent) onChange(t);
  if (!t) {
    for (const k of ['sun', 'shine']) lit[k].style.strokeDashoffset = LEN[k];
    orb.style.opacity = '1';
    orb.setAttribute('transform', 'translate(200 16)');
    return;
  }
  if (!MOTION || o.instant) {
    orb.style.opacity = '0';
    lit[t].style.strokeDashoffset = '0';
    if (prev && prev !== t) lit[prev].style.strokeDashoffset = LEN[prev];
    return;
  }
  if (prev && prev !== t) gsap.to(lit[prev], { strokeDashoffset: LEN[prev], duration: 0.5, ease: 'power2.in' });
  if (orbTween) orbTween.kill();
  const path = paths[t], L = path.getTotalLength(), s = { v: 0 };
  gsap.set(orb, { opacity: 1 });
  orbTween = gsap.to(s, {
    v: 1, duration: 1.15, ease: 'power2.inOut',
    onUpdate() {
      const p = path.getPointAtLength(s.v * L);
      orb.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      lit[t].style.strokeDashoffset = String(LEN[t] * (1 - s.v));
    },
    onComplete() { gsap.to(orb, { opacity: 0, duration: 0.25 }); ignite(t); },
  });
}
export const getVote = () => team;

/** Live counts under each card ("12 fireflies so far"). */
export function setVoteCounts(sun, shine) {
  const fmt = (n) => (n === 1 ? '1 firefly so far' : `${n} fireflies so far`);
  const a = $('[data-count="sun"]'), b = $('[data-count="shine"]');
  if (a) a.textContent = fmt(sun);
  if (b) b.textContent = fmt(shine);
}

export function initVote(listener) {
  if (listener) onChange = listener;
  duel = $('#duel'); sec = $('#guess'); orb = $('#orb'); status = $('#voteStatus');
  paths = { sun: $('#p-sun'), shine: $('#p-shine') };
  lit = { sun: $('#lit-sun'), shine: $('#lit-shine') };
  for (const k of Object.keys(lit)) {
    LEN[k] = lit[k].getTotalLength();
    lit[k].style.strokeDasharray = String(LEN[k]);
    lit[k].style.strokeDashoffset = String(LEN[k]);
  }
  for (const b of $$('.side')) b.addEventListener('click', () => setVote(b.dataset.team));
}
