/**
 * Sun or Shine: guest page entry point (vanilla ES modules, no build step).
 *
 * Modules:
 *   util.js      helpers, device tier, storage, CONFIG-driven event formatting
 *   sky.js       dawn→night sky blend + the little light rail
 *   leaves.js    canvas: falling leaves, bokeh, fireflies, bursts
 *   scenery.js   string lights, canopy, sunset treeline
 *   calendar.js  Google Calendar link, .ics, Maps
 *   photos.js    PHOTOS list (hosts edit this) + wipe, story strip, sonogram, lookalike
 *   vote.js      the fork-in-the-path vote
 *   rsvp.js      token lookup, 3-tap RSVP, lantern moment, confirmation, bonus round
 *   tally.js     jars of light (live tally)
 *   wishes.js    the wishing line
 *   motion.js    GSAP choreography (skipped under reduced motion)
 */
import { getPublic } from './api.js';
import { $, $$, MOTION, RM, ST, EVENT } from './util.js';
import { initSky } from './sky.js';
import { initAmbient } from './leaves.js';
import { stringLights, canopy, treeline } from './scenery.js';
import { initCalendar } from './calendar.js';
import { initPhotos } from './photos.js';
import { initVote, setVoteCounts } from './vote.js';
import { initRsvp, syncVote, editRsvp } from './rsvp.js';
import { initTally, applyTally, tallyError } from './tally.js';
import { initWishes, setWishes, wishesError } from './wishes.js';
import { initMotion } from './motion.js';
import { initBgm } from './bgm.js';

clearTimeout(window.__motionFallback);
if (!MOTION) document.documentElement.classList.remove('motion');

/* ---------- static scenery ---------- */
const small = innerWidth < 720;
stringLights($('#heroLights'), { bulbs: small ? 9 : 18, sag: small ? 26 : 44, top: 4 });
canopy($('#canopyL'), 11);
canopy($('#canopyR'), 29);
treeline($('#treeline'));
initCalendar();

/* ---------- sky + canvas ---------- */
const sky = initSky();
initAmbient(sky);

/* ---------- content ---------- */
initPhotos();
initWishes();
initVote((t) => { syncVote(t); sky.setTeam(t); });
initTally();
initBgm();

/* ---------- public data: tally + wishes, polled while the tab is visible ---------- */
const POLL_MS = 30000;
let lastFetch = 0, polling = null;
async function refreshPublic(o = {}) {
  lastFetch = Date.now();
  try {
    const d = await getPublic();
    setVoteCounts(d.sun, d.shine);
    setWishes(d.wishes);
    await applyTally(d, o);
  } catch {
    tallyError();
    wishesError();
  }
}
function startPolling() {
  clearInterval(polling);
  polling = setInterval(() => { if (document.visibilityState === 'visible') refreshPublic({ live: true }); }, POLL_MS);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastFetch > POLL_MS) refreshPublic({ live: true });
});
refreshPublic();
startPolling();

/* ---------- CTA + dock state ---------- */
const state = { submitted: false, vote: null };
const vis = { cta: true, guess: false, rsvp: false };
function updateDock() {
  const dock = $('#dock');
  const show = !vis.cta && !vis.guess && !vis.rsvp;
  dock.classList.toggle('show', show);
  dock.setAttribute('aria-hidden', String(!show));
  for (const a of $$('a', dock)) a.tabIndex = show ? 0 : -1;
  $('#dockCta').hidden = state.submitted;
  $('#dockDone').hidden = !state.submitted;
}
function onRsvpState(s) {
  state.submitted = s.submitted;
  state.vote = s.vote;
  const team = s.vote === 'sun' ? "You're Team Sun ☀️" : s.vote === 'shine' ? "You're Team Shine ✨" : "You're on the list 💌";
  $('#heroCtaTxt').textContent = s.submitted ? 'Edit my RSVP' : 'RSVP & cast your guess';
  $('#heroCta').setAttribute('href', s.submitted ? '#rsvp' : '#guess');
  $('#heroMicro').textContent = s.submitted ? `${team} · see you ${EVENT.monthDay}` : 'About 30 seconds · 3 taps';
  $('#dockDoneTxt').textContent = team;
  $('#finRsvp').textContent = s.submitted ? 'Edit my RSVP' : 'RSVP';
  $('#addWish').setAttribute('href', s.submitted ? '#bonus' : '#rsvp');
  if (s.vote) sky.setTeam(s.vote);
  updateDock();
}
for (const el of [$('#heroCta'), $('#dockEdit'), $('#finRsvp')]) {
  el.addEventListener('click', (e) => { if (state.submitted) { e.preventDefault(); editRsvp(); } });
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.target.classList.contains('h-cta')) vis.cta = e.isIntersecting;
      if (e.target.id === 'guess') vis.guess = e.isIntersecting;
      if (e.target.id === 'rsvp') vis.rsvp = e.isIntersecting;
    }
    updateDock();
  }, { threshold: 0.12 });
  io.observe($('.h-cta')); io.observe($('#guess')); io.observe($('#rsvp'));

  // Pause CSS loops (lantern sway, sonogram, fireflies, bulbs) while offscreen.
  const pause = new IntersectionObserver((es) => { for (const e of es) e.target.classList.toggle('is-off', !e.isIntersecting); }, { rootMargin: '120px 0px' });
  for (const el of $$('.hero, #sono, .jarbox, #wishes, .finale, #guess, #doneCard, #firstlook')) pause.observe(el);
}

initRsvp({
  onState: onRsvpState,
  onSaved: ({ vote }) => refreshPublic({ mine: vote || null }),
});

/* ---------- countdown ---------- */
function tick() {
  let ms = EVENT.start.getTime() - Date.now();
  const endMs = EVENT.end.getTime() - Date.now();
  const d = $('#cdD'), hh = $('#cdH'), m = $('#cdM');
  if (ms <= 0) {
    const box = $('#countdown');
    box.textContent = '';
    const p = document.createElement('p');
    p.className = 'cd-when';
    p.textContent = endMs > 0 ? "It's party time! Come find the lanterns. 🎉" : 'Thank you for celebrating our little light with us. 💛';
    box.appendChild(p);
    return false;
  }
  const D = Math.floor(ms / 864e5); ms -= D * 864e5;
  const H = Math.floor(ms / 36e5); ms -= H * 36e5;
  const M = Math.floor(ms / 6e4);
  d.textContent = String(D).padStart(2, '0');
  hh.textContent = String(H).padStart(2, '0');
  m.textContent = String(M).padStart(2, '0');
  $('#countdown').setAttribute('aria-label', `${D} days, ${H} hours and ${M} minutes until the party`);
  return true;
}
if (tick()) { const iv = setInterval(() => { if (!tick()) clearInterval(iv); }, 30000); }

/* ---------- motion (after fonts, so the title split measures real glyphs) ---------- */
if (MOTION) {
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(() => {
    initMotion();
    ST.refresh();
    sky.measure();
  });
  addEventListener('load', () => { ST.refresh(); sky.measure(); });
}
if (RM) document.documentElement.classList.add('rm');
