/**
 * RSVP: Concept B's 3-tap flow wearing Concept A's motion.
 *
 *  Token priority: ?g=<token> (personal invite link) > localStorage token (saved after a
 *  walk-up guest's first RSVP) > none (generic link).
 *  Flow: 1 attending tiles → 2 adults/kids steppers (collapse for "Can't make it") →
 *  3 Sun/Shine (synced with the fork vote) → 4 name + phone (generic links only) → submit.
 *  On success the form folds into a paper lantern that rises off the screen, and the
 *  confirmation card takes its place with the optional Bonus round (wish + name ideas).
 *  States: lookup shimmer, inline validation (client + ApiError.fields), busy button,
 *  network error with "Try again" (answers kept in localStorage, retried on `online`).
 *
 *  All guest-provided text is rendered with textContent.
 */
import { getGuest, submitRsvp, ApiError } from './api.js';
import { $, $$, MOTION, RM, gsap, clamp, store, greetName, firstName, initial, buzz, centerOf, EVENT } from './util.js';
import { burst, COL } from './leaves.js';
import { setVote } from './vote.js';
import { setMyWish } from './wishes.js';

const K_TOKEN = 'rsvpToken';
const K_DRAFT = 'rsvpDraft';
const LIMITS = { adults: [1, 10], kids: [0, 10] };
const MSG = {
  attending: "Pick one: Yes, Maybe or Can't.",
  vote: 'Take a guess! Tap Sun or Shine.',
  name: 'Add your name so we know whose lantern this is.',
  phoneShort: 'That number looks short. Please use 10 digits.',
  phoneLong: 'That number looks too long. Please check it.',
};
const FIELD_ORDER = ['attending', 'adults', 'kids', 'vote', 'name', 'phone'];

const S = {
  token: null, source: null, // 'link' | 'stored'
  guestName: '', notYou: false, lookupFailed: false,
  rsvp: null,
  attending: null, adults: 1, kids: 0, vote: null,
  busy: false,
};
let hooks = { onSaved: () => {}, onState: () => {} };
let form, done;

/* ================================ helpers ================================ */
const digits = (v) => String(v || '').replace(/\D/g, '');
function fmtPhone(v) {
  let d = digits(v);
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(v || '').trim();
}
const knownName = () => (S.notYou ? '' : S.guestName || (S.rsvp && S.rsvp.name) || '');
const showIdFields = () => !knownName() || S.notYou;
const teamLabel = (t) => (t === 'sun' ? 'Team Sun ☀️' : t === 'shine' ? 'Team Shine ✨' : '');

function splitNames(s) {
  s = String(s || '');
  const sun = (s.match(/Sun:\s*([^·]*)/i) || [])[1];
  const shine = (s.match(/Shine:\s*(.*)$/i) || [])[1];
  if (sun == null && shine == null) return { sun: s.trim(), shine: '' };
  return { sun: (sun || '').trim(), shine: (shine || '').trim() };
}
function joinNames(a, b) {
  a = a.trim(); b = b.trim();
  return [a && `Sun: ${a}`, b && `Shine: ${b}`].filter(Boolean).join(' · ');
}

/** Payload from the current form state. Always resends wish/baby_name so an edit never wipes them. */
function payload() {
  const r = S.rsvp || {};
  const idShown = showIdFields();
  const p = {
    name: idShown ? $('#f-name').value.trim() : knownName(),
    phone: idShown ? $('#f-phone').value.trim() : (r.phone || ''),
    attending: S.attending,
    adults: S.attending === 'no' ? 0 : S.adults,
    kids: S.attending === 'no' ? 0 : S.kids,
    vote: S.vote || '',
    wish: r.wish || '',
    baby_name: r.baby_name || '',
  };
  if (S.token && !S.notYou) p.token = S.token;
  return p;
}
function fromRsvp(r) {
  return { token: r.token, name: r.name, phone: r.phone || '', attending: r.attending, adults: r.adults, kids: r.kids, vote: r.vote || '', wish: r.wish || '', baby_name: r.baby_name || '' };
}

/* ================================ greeting + personalisation ================================ */
function setGreeting(mode) {
  const g = $('#greet'), av = $('#greetAv'), txt = $('#greetTxt');
  g.classList.toggle('skel', mode === 'loading');
  const n = greetName(knownName());
  const map = {
    loading: ['✦', 'Finding your invite…'],
    invited: [initial(n), `Hi ${n}! This invite is just for you`],
    returning: [initial(n), S.rsvp && S.rsvp.vote ? `Welcome back, ${n}! You're ${teamLabel(S.rsvp.vote)}` : `Welcome back, ${n}!`],
    saved: [initial(n), S.rsvp && S.rsvp.vote ? `You're all set, ${n}! ${teamLabel(S.rsvp.vote)}` : `You're all set, ${n}!`],
    bad: ['✦', "Hello, friend! You're invited"],
    generic: ['✦', "You're invited! Bring your best guess"],
  };
  const [a, t] = map[mode] || map.generic;
  av.textContent = a;
  txt.textContent = t;
  g.setAttribute('aria-busy', String(mode === 'loading'));
}

function personalizeForm() {
  const n = knownName();
  const who = $('#whoRow');
  if (n && !S.notYou) {
    who.hidden = false;
    $('#whoName').textContent = n;
    $('#whoAv').textContent = initial(n);
    $('#rsvpTitle').textContent = `Light your lantern, ${greetName(n)}`;
    $('#rsvpSub').textContent = 'Three quick taps. You can change your answers any time with this same link.';
  } else {
    who.hidden = true;
    $('#rsvpTitle').textContent = 'Light your lantern';
    $('#rsvpSub').textContent = 'Three taps, then your name. About 30 seconds.';
  }
  $('#qId').hidden = !showIdFields();
  if (S.rsvp && !S.notYou) $('#rsvpTitle').textContent = `Update your lantern, ${greetName(S.rsvp.name)}`;
  renumber();
  updateSubmitLabel();
}

function renumber() {
  const noCounts = S.attending === 'no';
  $('#voteN').textContent = noCounts ? '2' : '3';
  $('#idN').textContent = noCounts ? '3' : '4';
  $('#voteQ').textContent = noCounts ? 'Still want to guess? Sun or Shine' : 'Your guess: Sun or Shine?';
}
function updateSubmitLabel() {
  const t = $('#submitTxt');
  if (S.busy) { t.textContent = S.rsvp ? 'Updating your lantern…' : 'Lighting your lantern…'; return; }
  if (S.rsvp && !S.notYou) t.textContent = 'Update my lantern';
  else if (S.attending === 'no') t.textContent = S.vote ? 'Send my love & guess' : 'Send my love';
  else t.textContent = 'Send my light';
}

/* ================================ controls ================================ */
function setAttending(v, { silent } = {}) {
  S.attending = v;
  for (const r of $$('input[name="attending"]', form)) r.checked = r.value === v;
  const wrap = $('#countsWrap');
  const closed = v === 'no';
  wrap.classList.toggle('closed', closed);
  wrap.toggleAttribute('inert', closed);
  wrap.setAttribute('aria-hidden', String(closed));
  renumber();
  updateSubmitLabel();
  if (!silent) clearErr('attending');
}
function setCount(k, v, pop) {
  const [lo, hi] = LIMITS[k];
  S[k] = clamp(v | 0, lo, hi);
  $('#o-' + k).textContent = String(S[k]);
  for (const b of $$(`[data-step="${k}"]`, form)) {
    const d = +b.dataset.d;
    b.disabled = d < 0 ? S[k] <= lo : S[k] >= hi;
  }
  if (pop && MOTION) gsap.fromTo('#o-' + k, { scale: 1.35, y: pop > 0 ? -6 : 6 }, { scale: 1, y: 0, duration: 0.4, ease: 'back.out(3)' });
}
/** Called by the fork vote (vote.js) and by the form radios. */
export function syncVote(t) {
  S.vote = t;
  for (const r of $$('input[name="vote"]', form)) r.checked = r.value === t;
  if (t) clearErr('vote');
  updateSubmitLabel();
  if (MOTION && t) {
    const tile = $(`.vt-${t} .tile`, form);
    if (tile) gsap.fromTo($('.vt-ico', tile), { rotation: -18, scale: 0.8 }, { rotation: 0, scale: 1, duration: 1.1, ease: 'elastic.out(1,.35)' });
  }
}

/* ================================ errors ================================ */
function clearErr(field) {
  const el = $(`[data-err="${field}"]`);
  if (el) { el.textContent = ''; el.classList.remove('on'); }
  const input = { name: '#f-name', phone: '#f-phone', wish: '#f-wish' }[field];
  if (input) $(input).removeAttribute('aria-invalid');
  const q = { attending: '#qAtt', vote: '#qVote', adults: '#qCount', kids: '#qCount' }[field];
  if (q) $(q).classList.remove('has-err');
}
function clearErrors() { for (const f of [...FIELD_ORDER, 'wish', 'baby_name']) clearErr(f); }
function showErrors(fields) {
  clearErrors();
  let firstEl = null;
  for (const f of FIELD_ORDER.concat(Object.keys(fields).filter((k) => !FIELD_ORDER.includes(k)))) {
    const msg = fields[f];
    if (!msg) continue;
    const el = $(`[data-err="${f}"]`);
    if (!el) continue;
    if ((f === 'name' || f === 'phone') && $('#qId').hidden) { // e.g. invite name rejected: let them fix it
      $('#qId').hidden = false;
      $('#f-name').value = knownName();
    }
    el.textContent = msg;
    el.classList.add('on');
    const input = { name: '#f-name', phone: '#f-phone' }[f];
    if (input) $(input).setAttribute('aria-invalid', 'true');
    const q = { attending: '#qAtt', vote: '#qVote', adults: '#qCount', kids: '#qCount' }[f];
    if (q) $(q).classList.add('has-err');
    if (!firstEl) firstEl = input ? $(input) : (f === 'attending' ? $('input[name="attending"]', form) : f === 'vote' ? $('input[name="vote"]', form) : $(`[data-step="${f}"]`, form));
  }
  if (firstEl) {
    const blk = firstEl.closest('.q') || firstEl;
    blk.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => firstEl.focus({ preventScroll: true }), RM ? 0 : 350);
    if (MOTION) gsap.fromTo(blk, { x: -8 }, { x: 0, duration: 0.55, ease: 'elastic.out(1,.3)' });
  }
  $('#formStatus').textContent = 'Please check the highlighted answers.';
}
function validate(p) {
  const e = {};
  if (!p.attending) e.attending = MSG.attending;
  if (p.attending && p.attending !== 'no' && !p.vote) e.vote = MSG.vote;
  if (!p.name) e.name = MSG.name;
  if (p.phone) {
    let d = digits(p.phone);
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length < 10) e.phone = MSG.phoneShort;
    else if (d.length > 15) e.phone = MSG.phoneLong;
  }
  return e;
}

/* ================================ network alert + draft ================================ */
function showNet(msg) {
  $('#netMsg').textContent = msg;
  $('#netAlert').hidden = false;
}
const hideNet = () => { $('#netAlert').hidden = true; };
function saveDraft(p) { store.set(K_DRAFT, { ...p, _t: S.token || null, _at: Date.now() }); }
function restoreDraft() {
  const d = store.get(K_DRAFT);
  if (!d || (d._t || null) !== (S.token || null) || Date.now() - (d._at || 0) > 1000 * 60 * 60 * 24 * 14) return false;
  if (d.attending) setAttending(d.attending, { silent: true });
  if (d.attending !== 'no') { setCount('adults', d.adults ?? 1); setCount('kids', d.kids ?? 0); }
  if (d.vote) setVote(d.vote, { instant: true });
  if (showIdFields()) { $('#f-name').value = d.name || ''; $('#f-phone').value = d.phone || ''; }
  showNet("Your answers from last time are safe on this phone. Tap Try again to send them.");
  return true;
}

/* ================================ busy ================================ */
function setBusy(b) {
  S.busy = b;
  const btn = $('#submitBtn');
  btn.disabled = b;
  btn.setAttribute('aria-busy', String(b));
  form.setAttribute('aria-busy', String(b));
  updateSubmitLabel();
}

/* ================================ submit ================================ */
async function submit(e) {
  if (e) e.preventDefault();
  if (S.busy) return;
  const p = payload();
  const errs = validate(p);
  if (Object.keys(errs).length) { showErrors(errs); buzz(30); return; }
  clearErrors();
  hideNet();
  setBusy(true);
  saveDraft(p);
  $('#formStatus').textContent = 'Sending your RSVP…';
  try {
    const res = await submitRsvp(p);
    setBusy(false);
    store.del(K_DRAFT);
    onSaved(res.rsvp);
  } catch (err) {
    setBusy(false);
    const api = err instanceof ApiError ? err : new ApiError('network', String(err && err.message));
    if (api.code === 'invalid' && api.fields) { showErrors(api.fields); return; }
    const safe = api.retryable || api.code === 'network' || api.code === 'timeout';
    showNet(safe ? "We couldn't reach the forest just now. Your answers are safe on this phone." : api.message);
    $('#formStatus').textContent = api.message;
    $('#netRetry').focus({ preventScroll: false });
  }
}

function onSaved(rsvp) {
  const wasNew = !S.rsvp;
  S.rsvp = rsvp;
  S.token = rsvp.token;
  S.source = S.source === 'link' && !S.notYou ? 'link' : 'stored';
  S.notYou = false;
  S.guestName = rsvp.name;
  store.set(K_TOKEN, rsvp.token);
  const first = greetName(rsvp.name);
  $('#formStatus').textContent = rsvp.attending === 'no' ? `Thank you, ${first}! Your RSVP is saved.` : `Saved! See you there, ${first}.`;
  const team = rsvp.vote || null;
  const after = () => hooks.onSaved({ vote: team, created: wasNew });
  celebrate(team, () => { showDone({ fresh: true }); }, after);
  setGreeting('saved');
  emit();
}

/* ================================ the fold-into-lantern moment ================================ */
function celebrate(team, swap, after) {
  if (!MOTION) { swap(); after(); return; }
  const btn = $('#submitBtn');
  const [bx, by] = centerOf(btn);
  burst(bx, by, { n: 40, colors: team ? COL[team] : COL.gold, speed: 7, gravity: 0.08, shape: 'spark', life: 70 });
  buzz([12, 40, 18]);

  const r = form.getBoundingClientRect();
  const visTop = Math.max(r.top, 70), visBot = Math.min(r.bottom, innerHeight - 70);
  const cy = (visTop + visBot) / 2, cx = r.left + r.width / 2;
  const lan = $('#fly-lantern');
  const lw = 92, lh = lw * 1.4;
  lan.dataset.team = team || '';
  lan.hidden = false;
  gsap.set(lan, { x: cx - lw / 2, y: cy - lh / 2, scale: 0.6, opacity: 0, rotation: 0 });

  const kids = Array.from(form.children).filter((c) => !c.classList.contains('fold-pleats'));
  const tl = gsap.timeline();
  tl.to(kids, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0)
    .to('.fold-pleats', { opacity: 1, duration: 0.35 }, 0.05)
    .to(form, {
      scaleX: 0.3, scaleY: Math.min(0.5, 220 / Math.max(r.height, 1)), borderRadius: '44% 44% 34% 34% / 30% 30% 22% 22%',
      transformOrigin: `50% ${(cy - r.top).toFixed(0)}px`, duration: 0.7, ease: 'power3.in',
    }, 0.1)
    .to(lan, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 0.62)
    .to(form, { opacity: 0, duration: 0.25 }, 0.66)
    .call(() => {
      gsap.set(form, { clearProps: 'transform,borderRadius,opacity' });
      gsap.set(kids, { clearProps: 'opacity' });
      gsap.set('.fold-pleats', { clearProps: 'opacity' });
      swap();
    }, null, 1.0)
    .to(lan, { y: `-=${cy + lh + 260}`, duration: 3.6, ease: 'power1.in' }, 0.95)
    .to(lan, { rotation: 7, duration: 0.6, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.95)
    .to(lan, { x: '+=26', duration: 0.9, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.95)
    .to(lan, { opacity: 0, duration: 0.7 }, 3.9)
    .call(after, null, 1.9)
    .call(() => { lan.hidden = true; }, null, 4.6);
  const trail = setInterval(() => {
    if (lan.hidden) { clearInterval(trail); return; }
    const lr = lan.getBoundingClientRect();
    burst(lr.left + lr.width / 2, lr.bottom - 14, { n: 2, colors: COL.gold, speed: 1.4, angle: Math.PI / 2, spread: 1.4, gravity: 0.02, shape: 'spark', life: 45, size: [2, 5] });
  }, 80);
}

/* ================================ confirmation ================================ */
function showDone({ fresh = false, returning = false } = {}) {
  const r = S.rsvp;
  if (!r) return;
  const n = greetName(r.name);
  done.dataset.team = r.vote || '';
  const copy = {
    yes: [`See you there, ${n}!`, `Your light is on its way. See you ${EVENT.monthDay} under the golden canopy.`],
    maybe: [`We'll keep a lantern lit, ${n}`, 'We hope you can make it! Update your RSVP any time with this same page.'],
    no: [`We'll miss you, ${n}!`, 'Thank you for sending your love. Your little light will be with us on the day.'],
  }[r.attending] || [`Thank you, ${n}!`, ''];
  $('#doneEyebrow').textContent = returning ? 'Welcome back' : r.attending === 'no' ? 'Love received' : 'Lantern lit';
  $('#doneTitle').textContent = copy[0];
  $('#doneMsg').textContent = copy[1];
  const sum = $('#doneSum');
  sum.textContent = '';
  const li = (text, cls) => { const el = document.createElement('li'); el.textContent = text; if (cls) el.className = cls; sum.appendChild(el); };
  li({ yes: 'Coming 🎉', maybe: 'Maybe 🤞', no: "Can't make it 💌" }[r.attending] || '');
  if (r.attending !== 'no') {
    const parts = [`${r.adults} ${r.adults === 1 ? 'adult' : 'adults'}`];
    if (r.kids) parts.push(`${r.kids} ${r.kids === 1 ? 'kid' : 'kids'}`);
    li(parts.join(' · '));
  }
  if (r.vote) li(`Your guess: ${teamLabel(r.vote)}`, r.vote);
  // Walk-up guests get a personal link to edit from another phone.
  $('#saveLink').hidden = S.source === 'link';
  // Bonus round prefill
  $('#f-wish').value = r.wish || '';
  const bn = splitNames(r.baby_name);
  $('#f-bn-sun').value = bn.sun;
  $('#f-bn-shine').value = bn.shine;
  $('#wishSaved').hidden = !r.wish;
  $('#nameSaved').hidden = !r.baby_name;
  $('#saveWish').textContent = r.wish ? 'Update my wish' : 'Hang my wish';
  $('#saveNames').textContent = r.baby_name ? 'Update my ideas' : 'Send my ideas';

  form.hidden = true;
  done.hidden = false;
  $('#rsvpLede').textContent = 'All set. You can change your answers any time.';
  if (fresh) {
    if (MOTION) gsap.fromTo(done, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', clearProps: 'opacity,transform' });
    done.focus({ preventScroll: true });
    done.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  }
  if (r.wish) setMyWish(firstName(r.name), r.wish);
  emit();
}

function showForm() {
  const r = S.rsvp;
  if (r) {
    setAttending(r.attending, { silent: true });
    setCount('adults', r.attending === 'no' ? 1 : r.adults);
    setCount('kids', r.attending === 'no' ? 0 : r.kids);
    syncVote(r.vote || null);
    if (showIdFields()) { $('#f-name').value = r.name || ''; $('#f-phone').value = fmtPhone(r.phone || ''); }
  }
  personalizeForm();
  done.hidden = true;
  form.hidden = false;
  $('#rsvpLede').textContent = 'Change anything you like, then tap Update.';
  $('#rsvpTitle').focus({ preventScroll: true });
  form.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
  emit();
}

/* ================================ bonus round ================================ */
async function saveBonus(kind) {
  if (!S.rsvp) return;
  const btn = kind === 'wish' ? $('#saveWish') : $('#saveNames');
  const errKey = kind === 'wish' ? 'wish' : 'baby_name';
  const p = fromRsvp(S.rsvp);
  if (kind === 'wish') p.wish = $('#f-wish').value.trim();
  else p.baby_name = joinNames($('#f-bn-sun').value, $('#f-bn-shine').value);
  clearErr(errKey);
  const label = btn.textContent;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = kind === 'wish' ? 'Hanging…' : 'Sending…';
  try {
    const res = await submitRsvp(p);
    S.rsvp = res.rsvp;
    if (kind === 'wish') {
      $('#wishSaved').hidden = !S.rsvp.wish;
      $('#bonusStatus').textContent = S.rsvp.wish ? 'Your wish is on the wishing line.' : 'Your wish was removed.';
      btn.textContent = S.rsvp.wish ? 'Update my wish' : 'Hang my wish';
      setMyWish(firstName(S.rsvp.name), S.rsvp.wish);
      const [x, y] = centerOf(btn);
      burst(x, y, { n: 18, colors: COL.gold, speed: 4, gravity: 0.05, life: 50, size: [2, 6] });
      hooks.onSaved({ vote: null, wish: true });
    } else {
      $('#nameSaved').hidden = !S.rsvp.baby_name;
      $('#bonusStatus').textContent = 'Your name ideas were sent to Ayana and Sebin.';
      btn.textContent = S.rsvp.baby_name ? 'Update my ideas' : 'Send my ideas';
    }
  } catch (err) {
    btn.textContent = label;
    const el = $(`[data-err="${errKey}"]`);
    const msg = err instanceof ApiError && err.fields && (err.fields[errKey] || Object.values(err.fields)[0]) || (err && err.message) || 'Something went wrong. Please try again.';
    el.textContent = msg;
    el.classList.add('on');
    if (kind === 'wish') $('#f-wish').setAttribute('aria-invalid', 'true');
    $('#bonusStatus').textContent = msg;
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

/* ================================ lookup ================================ */
async function lookup() {
  if (!S.token) { setGreeting('generic'); personalizeForm(); restoreDraft(); return; }
  if (S.source === 'link') setGreeting('loading');
  const alert = $('#lookupAlert');
  try {
    const res = await getGuest(S.token);
    S.guestName = (res.guest && res.guest.name) || '';
    S.lookupFailed = false;
    alert.hidden = true;
    if (res.rsvp) {
      S.rsvp = res.rsvp;
      setAttending(res.rsvp.attending, { silent: true });
      setCount('adults', res.rsvp.attending === 'no' ? 1 : res.rsvp.adults);
      setCount('kids', res.rsvp.attending === 'no' ? 0 : res.rsvp.kids);
      if (res.rsvp.vote) setVote(res.rsvp.vote, { instant: true });
      setGreeting('returning');
      personalizeForm();
      showDone({ returning: true });
    } else {
      setGreeting('invited');
      personalizeForm();
      restoreDraft();
    }
  } catch (err) {
    const code = err && err.code;
    if (code === 'not_found') {
      if (S.source === 'link') {
        $('#lookupMsg').textContent = err.message; // "We couldn't find that invite link, but you can still RSVP below!"
        $('#lookupRetry').hidden = true;
        alert.hidden = false;
        setGreeting('bad');
      } else {
        store.del(K_TOKEN);
        setGreeting('generic');
      }
      S.token = null; S.source = null;
    } else {
      // Offline or server hiccup: never block. Keep the token, ask for a name, offer a retry.
      S.lookupFailed = true;
      $('#lookupMsg').textContent = "We couldn't load your invite just now, but you can still RSVP below.";
      $('#lookupRetry').hidden = false;
      alert.hidden = false;
      setGreeting('generic');
    }
    personalizeForm();
    restoreDraft();
  }
  emit();
}

function emit() { hooks.onState({ submitted: !!S.rsvp, vote: S.rsvp ? S.rsvp.vote : S.vote, name: S.rsvp ? S.rsvp.name : knownName() }); }

/* ================================ init ================================ */
export function initRsvp(h = {}) {
  hooks = { ...hooks, ...h };
  form = $('#rsvpForm');
  done = $('#doneCard');

  const params = new URLSearchParams(location.search);
  const linkToken = (params.get('g') || '').trim();
  const stored = store.get(K_TOKEN);
  if (linkToken) { S.token = linkToken; S.source = 'link'; }
  else if (typeof stored === 'string' && stored) { S.token = stored; S.source = 'stored'; }

  for (const r of $$('input[name="attending"]', form)) r.addEventListener('change', () => setAttending(r.value));
  for (const r of $$('input[name="vote"]', form)) r.addEventListener('change', () => { setVote(r.value); syncVote(r.value); });
  for (const b of $$('[data-step]', form)) b.addEventListener('click', () => { const k = b.dataset.step, d = +b.dataset.d; setCount(k, S[k] + d, d); clearErr(k); });
  $('#f-name').addEventListener('input', () => clearErr('name'));
  $('#f-phone').addEventListener('input', () => clearErr('phone'));
  $('#f-phone').addEventListener('blur', (e) => { e.target.value = fmtPhone(e.target.value); });
  form.addEventListener('submit', submit);
  $('#netRetry').addEventListener('click', () => submit());
  $('#lookupRetry').addEventListener('click', () => lookup());
  addEventListener('online', () => { if (!$('#netAlert').hidden && store.get(K_DRAFT) && !S.busy) submit(); });
  $('#notYou').addEventListener('click', () => {
    S.notYou = true;
    $('#f-name').value = ''; $('#f-phone').value = '';
    setGreeting('generic');
    personalizeForm();
    $('#f-name').focus();
  });
  $('#editBtn').addEventListener('click', showForm);
  $('#saveWish').addEventListener('click', () => saveBonus('wish'));
  $('#saveNames').addEventListener('click', () => saveBonus('names'));
  $('#f-wish').addEventListener('input', () => { clearErr('wish'); $('#wishSaved').hidden = true; });
  for (const b of $$('[data-prompt]')) b.addEventListener('click', () => {
    const ta = $('#f-wish');
    ta.value = ta.value.trim() ? ta.value.replace(/\s*$/, ' ') + b.dataset.prompt : b.dataset.prompt;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  });
  $('#copyLink').addEventListener('click', async () => {
    if (!S.token) return;
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set('g', S.token);
    let ok = false;
    try { await navigator.clipboard.writeText(url.href); ok = true; } catch {
      const ta = document.createElement('textarea'); ta.value = url.href; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove();
    }
    $('#copyTxt').textContent = ok ? 'Link copied ✓' : url.href;
  });

  setCount('adults', 1);
  setCount('kids', 0);
  personalizeForm();
  return lookup();
}

/** Re-open the form prefilled (hero / dock "Edit my RSVP"). */
export function editRsvp() { if (S.rsvp) showForm(); else $('#guess').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); }
