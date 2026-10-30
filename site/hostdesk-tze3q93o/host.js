/**
 * Sun or Shine: host desk (hidden page, passcode-gated server-side).
 *
 * The passcode is checked by the backend (host(key, 'summary')); the key is
 * kept in sessionStorage only. Every piece of guest text is rendered with
 * textContent (never innerHTML).
 */
import { CONFIG } from '../js/config.js';
import { host } from '../js/api.js';
import {
  normPhone, formatPhone, smsHref, waHref, siteBase, personalLink, greetingName, firstName,
  DEFAULT_TEMPLATES, fillTemplate, parsePaste, pasteSummary, toCsv, daysUntil, ago,
} from './lib.js';
import { createReveal } from './reveal.js';

/* ───────────────────────── basics ───────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => reducedMq.matches;

const SESSION_KEY = 'sos-host-session';
const TPL_KEY = 'sos-host-templates';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const REFRESH_MS = 60 * 1000;
const MIN_N = 1;
const MAX_N = 10;

// The site root is the folder above this page, e.g. https://<user>.github.io/<repo>/
const basePath = new URL('../', import.meta.url).pathname;
const BASE = siteBase(CONFIG.siteUrl, location.origin, basePath);
const linkFor = (token) => personalLink(BASE, token);

/** Small DOM builder. Text goes through textContent only. */
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c);
  return node;
}

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}
function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* private mode, quota, blocked */ }
}
function removeKey(storage, key) {
  try { storage.removeItem(key); } catch { /* ignore */ }
}
const session = () => { try { return window.sessionStorage; } catch { return null; } };
const local = () => { try { return window.localStorage; } catch { return null; } };

/* ───────────────────────── state ───────────────────────── */

const state = {
  key: '',
  summary: null,
  saved: { winners: [], savedAt: '' },
  lastLoad: 0,
  loading: false,
  rsFilter: 'all',
  invFilter: 'all',
  n: clampN(CONFIG.winnersDefault || 5),
  tpl: loadTemplates(),
  justAdded: new Set(),
  failures: 0,
  lockedUntil: 0,
};

function clampN(n) { return Math.max(MIN_N, Math.min(MAX_N, Math.round(Number(n) || 5))); }

/* ───────────────────────── toast ───────────────────────── */

let toastTimer = 0;
function toast(msg, action) {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  const act = $('#toastAct');
  act.hidden = !action;
  act.onclick = null;
  if (action) {
    act.textContent = action.label;
    act.onclick = () => { hideToast(); action.run(); };
  }
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 7000 : 3500);
}
function hideToast() { $('#toast').hidden = true; }

/* ───────────────────────── API wrapper ───────────────────────── */

async function call(op, payload) {
  try {
    return await host(state.key, op, payload);
  } catch (err) {
    if (err && err.code === 'unauthorized') {
      lock("Your passcode changed or the session ended. Please unlock again.");
    }
    throw err;
  }
}

/* ───────────────────────── gate ───────────────────────── */

function saveSession(key) { const s = session(); if (s) writeJson(s, SESSION_KEY, { key, t: Date.now() }); }
function loadSession() {
  const s = session();
  const v = s && readJson(s, SESSION_KEY);
  if (!v || typeof v.key !== 'string' || !v.key || Date.now() - (v.t || 0) > SESSION_TTL_MS) {
    if (s) removeKey(s, SESSION_KEY);
    return '';
  }
  return v.key;
}

let lockTimer = 0;
function gateMsg(text) { $('#gateMsg').textContent = text; }

async function onGateSubmit(e) {
  e.preventDefault();
  const input = $('#gateKey');
  const key = input.value.trim();
  if (Date.now() < state.lockedUntil) return;
  if (!key) { gateMsg('Type your host passcode.'); input.focus(); return; }
  const btn = $('#gateBtn');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  gateMsg('');
  try {
    const summary = await host(key, 'summary');
    state.failures = 0;
    state.key = key;
    saveSession(key);
    input.value = '';
    enterApp(summary);
  } catch (err) {
    if (err && err.code === 'unauthorized') {
      state.failures++;
      const gate = $('#gate');
      gate.classList.remove('shake');
      void gate.offsetWidth;
      gate.classList.add('shake');
      input.select();
      // Back-off after a few wrong tries (the server also pauses on each one).
      if (state.failures >= 3) {
        const wait = Math.min(60, 5 * (state.failures - 2));
        state.lockedUntil = Date.now() + wait * 1000;
        tickLock();
      } else {
        gateMsg("That passcode didn't work. Try again.");
      }
    } else {
      gateMsg((err && err.message) || "Couldn't reach the party server.");
    }
  } finally {
    if (Date.now() >= state.lockedUntil) btn.disabled = false;
    btn.textContent = 'Unlock';
  }
}

function tickLock() {
  clearTimeout(lockTimer);
  const left = Math.ceil((state.lockedUntil - Date.now()) / 1000);
  const btn = $('#gateBtn');
  if (left <= 0) { btn.disabled = false; gateMsg("Try again when you're ready."); return; }
  btn.disabled = true;
  gateMsg(`That passcode didn't work. Too many tries, so wait ${left}s.`);
  lockTimer = setTimeout(tickLock, 1000);
}

function lock(message) {
  const s = session();
  if (s) removeKey(s, SESSION_KEY);
  state.key = '';
  state.summary = null;
  if (reveal.isOpen()) reveal.close();
  $('#app').hidden = true;
  $('#gate').hidden = false;
  gateMsg(message || '');
  $('#gateKey').focus();
}

function enterApp(summary) {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  applySummary(summary);
  loadWinners();
  selectTab(tabFromHash(), false);
  const tab = $(`[role="tab"][aria-selected="true"]`);
  if (tab) tab.focus({ preventScroll: true });
}

/* ───────────────────────── tabs ───────────────────────── */

const TABS = ['overview', 'rsvps', 'invites', 'reveal'];
const tabFromHash = () => { const t = location.hash.replace('#', ''); return TABS.includes(t) ? t : 'overview'; };

function selectTab(name, focus = true) {
  for (const t of TABS) {
    const btn = $(`#t-${t}`);
    const on = t === name;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    $(`#p-${t}`).hidden = !on;
    if (on && focus) btn.focus();
  }
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  if (name === 'invites') drawQr();
  window.scrollTo(0, 0);
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (b) selectTab(b.dataset.tab, false);
});
$('#tabs').addEventListener('keydown', (e) => {
  const i = TABS.indexOf(document.activeElement && document.activeElement.dataset.tab);
  if (i < 0) return;
  let j = null;
  if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = TABS.length - 1;
  if (j == null) return;
  e.preventDefault();
  selectTab(TABS[j]);
});
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) selectTab(go.dataset.go);
});
window.addEventListener('hashchange', () => { if (!$('#app').hidden) selectTab(tabFromHash(), false); });

/* ───────────────────────── loading ───────────────────────── */

async function refresh({ quiet = false } = {}) {
  if (!state.key || state.loading) return;
  state.loading = true;
  const btn = $('#refreshBtn');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  try {
    applySummary(await call('summary'));
    $('#banner').hidden = true;
  } catch (err) {
    if (err.code !== 'unauthorized') showBanner(`Couldn't refresh: ${err.message}`);
    if (!quiet) toast("Couldn't refresh. Check your connection.");
  } finally {
    state.loading = false;
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

function showBanner(text) {
  const b = $('#banner');
  b.replaceChildren(h('span', { text }), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Retry', onclick: () => refresh() }));
  b.hidden = false;
}

async function loadWinners() {
  try {
    const res = await call('getWinners');
    state.saved = { winners: res.winners || [], savedAt: res.savedAt || '' };
  } catch { /* shown as empty */ }
  renderSaved();
}

function applySummary(summary) {
  state.summary = summary;
  state.lastLoad = Date.now();
  renderOverview();
  renderRsvps();
  renderInvites();
  renderRevealTab();
  const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  $('#updated').textContent = `Updated ${time} · refreshes every minute`;
}

$('#refreshBtn').addEventListener('click', () => refresh());
$('#lockBtn').addEventListener('click', () => lock('Locked. See you soon!'));

// Auto-refresh every 60s while the page is visible (not during the reveal).
setInterval(() => {
  if (document.visibilityState === 'visible' && state.key && !reveal.isOpen()) refresh({ quiet: true });
}, REFRESH_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.key && !reveal.isOpen() && Date.now() - state.lastLoad > REFRESH_MS) refresh({ quiet: true });
});

/* ───────────────────────── shared bits ───────────────────────── */

const ATT_LABEL = { yes: 'Yes', maybe: 'Maybe', no: 'No' };
function statusChip(att) {
  const icon = { yes: '✓', maybe: '?', no: '✕' }[att] || '';
  return h('span', { class: `st ${att || 'no'}` }, h('span', { 'aria-hidden': 'true', text: icon }), ATT_LABEL[att] || '–');
}
function teamChip(vote) {
  if (vote === 'sun') return h('span', { class: 'team sun' }, h('span', { 'aria-hidden': 'true', text: '☀️' }), 'Team Sun');
  if (vote === 'shine') return h('span', { class: 'team shine' }, h('span', { 'aria-hidden': 'true', text: '✨' }), 'Team Shine');
  return h('span', { class: 'team none', text: 'No guess' });
}
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const pct = (a, total) => (total ? Math.round((a / total) * 100) : 0);

/* ───────────────────────── overview ───────────────────────── */

function renderOverview() {
  const s = state.summary;
  if (!s) return;
  const d = daysUntil(CONFIG.date, CONFIG.timeZone);
  $('#ovTitle').textContent = d > 1 ? `${d} days to go` : d === 1 ? 'Tomorrow!' : d === 0 ? "It's party day!" : 'Thanks for celebrating';
  const latest = s.rsvps[0];
  $('#ovLede').textContent = latest
    ? `Last RSVP ${ago(latest.updated_at || latest.created_at)} from ${firstName(latest.name)}.`
    : 'No RSVPs yet. Send a few invites from the Invites tab.';

  const maybes = s.rsvps.filter((r) => r.attending === 'maybe');
  const mA = maybes.reduce((a, r) => a + r.adults, 0);
  const mK = maybes.reduce((a, r) => a + r.kids, 0);
  $('#kHead').textContent = String(s.headcount);
  $('#kHeadSplit').textContent = `${plural(s.adults, 'adult')} · ${plural(s.kids, 'kid')}`;
  $('#kMaybe').textContent = s.maybeHeadcount ? `+ up to ${s.maybeHeadcount} from maybes (${plural(mA, 'adult')}, ${plural(mK, 'kid')})` : 'No maybes right now';
  $('#kYes').textContent = String(s.counts.yes);
  $('#kMaybeN').textContent = String(s.counts.maybe);
  $('#kNo').textContent = String(s.counts.no);

  const total = s.counts.yes + s.counts.maybe + s.counts.no;
  const unanswered = s.guests.filter((g) => !g.rsvped).length;
  stack($('#stackAtt'), $('#legAtt'), [
    { label: 'Yes', n: s.counts.yes, color: 'var(--ok)' },
    { label: 'Maybe', n: s.counts.maybe, color: 'var(--c-canopy-amber)' },
    { label: 'No', n: s.counts.no, color: '#9b8a7e' },
  ], total, 'Responses');
  $('#unanswered').textContent = s.guests.length
    ? (unanswered ? `${plural(unanswered, 'invite')} not answered yet` : 'Every invite has an answer 🎉')
    : '';

  const votes = s.sun + s.shine;
  stack($('#stackVote'), $('#legVote'), [
    { label: '☀️ Sun', n: s.sun, color: 'var(--c-sun-blue)' },
    { label: '✨ Shine', n: s.shine, color: 'var(--c-shine-pink)' },
  ], votes, 'Sun vs Shine');

  const list = $('#recent');
  const items = s.rsvps.slice(0, 5).map((r) => h('li', {},
    h('span', { text: r.name }),
    statusChip(r.attending),
    r.attending !== 'no' ? h('span', { class: 'hc', text: `${r.adults}+${r.kids}` }) : null,
    r.vote ? teamChip(r.vote) : null,
    h('span', { class: 'when', text: ago(r.updated_at || r.created_at) }),
  ));
  list.replaceChildren(...(items.length ? items : [h('li', { class: 'muted', text: 'Nothing yet.' })]));
}

function stack(bar, legend, parts, total, title) {
  bar.replaceChildren(...parts.map((p) => {
    const i = h('i');
    i.style.width = `${total ? (p.n / total) * 100 : 0}%`;
    i.style.background = p.color;
    return i;
  }));
  bar.setAttribute('aria-label', `${title}: ` + parts.map((p) => `${p.label.replace(/[^\w ]/g, '').trim()} ${p.n} (${pct(p.n, total)}%)`).join(', '));
  legend.replaceChildren(...parts.map((p) => {
    const sw = h('i');
    sw.style.background = p.color;
    return h('span', {}, sw, `${p.label} ${p.n}${total ? ` · ${pct(p.n, total)}%` : ''}`);
  }));
}

/* ───────────────────────── RSVPs ───────────────────────── */

function filteredRsvps() {
  const s = state.summary;
  if (!s) return [];
  const q = $('#rsSearch').value.trim().toLowerCase();
  const qd = normPhone(q);
  const f = state.rsFilter;
  return s.rsvps.filter((r) => {
    if (f === 'yes' || f === 'maybe' || f === 'no') { if (r.attending !== f) return false; }
    else if (f === 'sun' || f === 'shine') { if (r.vote !== f) return false; }
    else if (f === 'wish') { if (!r.wish) return false; }
    if (!q) return true;
    return [r.name, r.wish, r.baby_name].some((v) => String(v || '').toLowerCase().includes(q)) || (qd.length >= 3 && r.phone.includes(qd));
  });
}

function renderRsvps() {
  const s = state.summary;
  if (!s) return;
  $('#rsCount').textContent = `${plural(s.rsvps.length, 'RSVP')} · ${s.counts.yes} yes · ${s.counts.maybe} maybe · ${s.counts.no} no`;
  const rows = filteredRsvps().map((r) => {
    const wishCell = h('td', { class: 'wishcell' });
    if (r.wish) {
      wishCell.append(
        h('span', { class: `wish${r.hidden ? ' is-hidden' : ''}`, text: r.wish }),
        r.hidden ? h('span', { class: 'hidden-l', text: 'Hidden from the wall' }) : null,
        h('br'),
        h('button', {
          type: 'button', class: 'btn btn-ghost hide-btn',
          'aria-label': `${r.hidden ? 'Show' : 'Hide'} ${firstName(r.name)}'s wish ${r.hidden ? 'on' : 'from'} the wall`,
          text: r.hidden ? 'Show on wall' : 'Hide from wall',
          onclick: (e) => toggleWish(r, e.currentTarget),
        }),
      );
    }
    if (r.baby_name) wishCell.append(h('span', { class: 'idea', text: `Name idea: ${r.baby_name}` }));
    return h('tr', {},
      h('td', { class: 'n' }, h('b', { text: r.name }), h('small', { text: [formatPhone(r.phone), r.invited ? '' : 'via shared link'].filter(Boolean).join(' · ') })),
      h('td', { class: 'stc' }, statusChip(r.attending)),
      h('td', { class: 'num', 'data-l': 'Adults', text: String(r.adults) }),
      h('td', { class: 'num', 'data-l': 'Kids', text: String(r.kids) }),
      h('td', { class: 'vc' }, teamChip(r.vote)),
      wishCell,
      h('td', { class: 'upd', text: ago(r.updated_at || r.created_at) }),
    );
  });
  $('#rsBody').replaceChildren(...rows);
  $('#rsEmpty').hidden = rows.length > 0;
  $('#rsEmpty').textContent = s.rsvps.length ? 'No RSVPs match.' : 'No RSVPs yet.';
}

async function toggleWish(r, btn) {
  const next = !r.hidden;
  btn.disabled = true;
  try {
    await call('hideWish', { token: r.token, hidden: next });
    r.hidden = next;
    toast(next ? `${firstName(r.name)}'s wish is hidden from the wall` : `${firstName(r.name)}'s wish is back on the wall`);
    renderRsvps();
  } catch (err) {
    btn.disabled = false;
    toast(`Couldn't update the wish: ${err.message}`);
  }
}

$('#rsSearch').addEventListener('input', renderRsvps);
$('#rsFilters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  state.rsFilter = b.dataset.f;
  $$('#rsFilters [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderRsvps();
});

const CSV_COLUMNS = [
  { label: 'Name', key: 'name' },
  { label: 'Phone', get: (r) => formatPhone(r.phone) },
  { label: 'Attending', key: 'attending' },
  { label: 'Adults', key: 'adults' },
  { label: 'Kids', key: 'kids' },
  { label: 'Guess', key: 'vote' },
  { label: 'Wish', key: 'wish' },
  { label: 'Wish hidden', get: (r) => (r.hidden ? 'yes' : '') },
  { label: 'Name idea', key: 'baby_name' },
  { label: 'Invited', get: (r) => (r.invited ? 'yes' : 'shared link') },
  { label: 'Personal link', get: (r) => linkFor(r.token) },
  { label: 'First RSVP', key: 'created_at' },
  { label: 'Updated', key: 'updated_at' },
];
const csvText = () => toCsv(state.summary ? state.summary.rsvps : [], CSV_COLUMNS);

$('#csvDownload').addEventListener('click', () => {
  const blob = new Blob(['﻿' + csvText()], { type: 'text/csv;charset=utf-8' });
  const day = new Date().toISOString().slice(0, 10);
  download(blob, `sun-or-shine-rsvps-${day}.csv`);
  toast('CSV downloaded');
});
$('#csvCopy').addEventListener('click', async () => {
  toast((await copyText(csvText())) ? 'CSV copied. Paste it into a spreadsheet.' : "Couldn't copy. Try Export CSV instead.");
});

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall back */ }
  const ta = h('textarea', { readonly: true, 'aria-hidden': 'true' });
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/* ───────────────────────── invites ───────────────────────── */

function loadTemplates() {
  const ls = local();
  const v = ls && readJson(ls, TPL_KEY);
  return {
    active: v && (v.active === 'short' || v.active === 'warm') ? v.active : 'warm',
    warm: v && typeof v.warm === 'string' && v.warm.trim() ? v.warm : DEFAULT_TEMPLATES.warm,
    short: v && typeof v.short === 'string' && v.short.trim() ? v.short : DEFAULT_TEMPLATES.short,
  };
}
function saveTemplates() { const ls = local(); if (ls) writeJson(ls, TPL_KEY, state.tpl); }
const messageFor = (g) => fillTemplate(state.tpl[state.tpl.active], { name: g.name, link: linkFor(g.token) });

function inviteState(g) {
  if (g.rsvped) return 'rsvpd';
  if (g.opened) return 'opened';
  if (g.texted) return 'texted';
  return 'none';
}
const ORDER = { none: 0, texted: 1, opened: 2, rsvpd: 3 };
const queue = () => (state.summary ? state.summary.guests.filter((g) => inviteState(g) === 'none' && g.phone) : []);

function badge(g) {
  const st = inviteState(g);
  if (st === 'rsvpd') {
    const att = g.attending ? ` · ${ATT_LABEL[g.attending]}` : '';
    return h('span', { class: 'st rsvpd' }, h('span', { 'aria-hidden': 'true', text: '✓' }), `RSVP'd${att}`);
  }
  if (st === 'opened') return h('span', { class: 'st opened' }, h('span', { 'aria-hidden': 'true', text: '👀' }), 'Opened');
  if (st === 'texted') return h('span', { class: 'st texted' }, h('span', { 'aria-hidden': 'true', text: '✉' }), 'Texted');
  if (!g.phone) return h('span', { class: 'st nophone', text: 'No number' });
  return h('span', { class: 'st none', text: 'Not texted' });
}

function renderInvites() {
  const s = state.summary;
  if (!s) return;
  const guests = s.guests.slice().sort((a, b) => (ORDER[inviteState(a)] - ORDER[inviteState(b)]) || String(a.added_at).localeCompare(String(b.added_at)));
  const done = guests.filter((g) => inviteState(g) !== 'none').length;
  $('#invProg').textContent = `${done} of ${guests.length} texted`;
  $('#invBar').style.width = `${pct(done, guests.length)}%`;
  $('#invBarWrap').setAttribute('aria-valuenow', String(pct(done, guests.length)));

  // "Text next (N left)": a real sms: link to the next person in the queue.
  const q = queue();
  const next = q[0];
  const tn = $('#textNext');
  if (next) {
    tn.href = smsHref(next.phone, messageFor(next));
    tn.setAttribute('aria-disabled', 'false');
    tn.dataset.token = next.token;
    $('#textNextL').textContent = `Text next: ${greetingName(next.name)} (${q.length} left)`;
  } else {
    tn.removeAttribute('href');
    tn.setAttribute('aria-disabled', 'true');
    delete tn.dataset.token;
    $('#textNextL').textContent = guests.length ? "Everyone's been texted 🎉" : 'Text next';
  }

  const f = state.invFilter;
  const shown = guests.filter((g) => f === 'all' || inviteState(g) === f);
  $('#clist').replaceChildren(...shown.map(inviteRow));
  $('#invEmpty').hidden = guests.length > 0;
  state.justAdded.clear();
  renderPreview();
  renderParse();
}

function inviteRow(g) {
  const st = inviteState(g);
  const msg = messageFor(g);
  const sms = smsHref(g.phone, msg);
  const wa = waHref(g.phone, msg);
  const fresh = st === 'none';
  const acts = h('div', { class: 'acts' },
    sms
      ? h('a', { class: `btn ${fresh ? 'btn-primary' : 'btn-ghost'} txt`, href: sms, 'data-act': 'sms', 'data-token': g.token, text: fresh ? 'Text invite' : 'Text again' })
      : null,
    wa
      ? h('a', { class: 'btn btn-wa', href: wa, target: '_blank', rel: 'noopener noreferrer', 'data-act': 'wa', 'data-token': g.token, 'aria-label': `WhatsApp ${g.name}`, text: 'WhatsApp' })
      : null,
    h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'copy', 'data-token': g.token, 'aria-label': `Copy ${g.name}'s link`, text: 'Copy link' }),
  );
  return h('li', { class: `crow${state.justAdded.has(g.token) ? ' flash' : ''}`, 'data-token': g.token },
    h('span', { class: 'av', 'aria-hidden': 'true', text: (g.name.trim()[0] || '?').toUpperCase() }),
    h('div', { class: 'who' }, h('b', { text: g.name }), h('span', { class: 'ph', text: formatPhone(g.phone) || 'No number: use Copy link' })),
    badge(g),
    acts,
    h('button', { type: 'button', class: 'del', 'data-act': 'del', 'data-token': g.token, 'aria-label': `Remove ${g.name} from the list`, title: 'Remove', text: '×' }),
  );
}

// Optimistic "Texted", serialized per guest so Undo can't race the first write.
const chains = new Map();
function queueWrite(token, fn) {
  const p = (chains.get(token) || Promise.resolve()).then(fn, fn);
  chains.set(token, p.catch(() => {}));
  return p;
}

function markTexted(token) {
  const g = state.summary && state.summary.guests.find((x) => x.token === token);
  if (!g) return;
  const wasFresh = inviteState(g) === 'none';
  const prev = { texted: g.texted, texted_at: g.texted_at };
  g.texted = true;
  g.texted_at = new Date().toISOString();
  // Re-render after the tap has started the sms: navigation.
  setTimeout(renderInvites, 0);
  queueWrite(token, () => call('markTexted', { token }))
    .catch((err) => { Object.assign(g, prev); renderInvites(); toast(`Couldn't mark ${firstName(g.name)} as texted: ${err.message}`); });
  if (wasFresh) {
    toast(`Marked ${greetingName(g.name)} as texted`, {
      label: 'Undo',
      run: () => {
        Object.assign(g, { texted: false, texted_at: '' });
        renderInvites();
        queueWrite(token, () => call('markTexted', { token, texted: false }))
          .catch((err) => toast(`Couldn't undo: ${err.message}`));
      },
    });
  }
}

$('#clist').addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const token = el.dataset.token;
  const g = state.summary.guests.find((x) => x.token === token);
  if (!g) return;
  const act = el.dataset.act;
  if (act === 'sms' || act === 'wa') {
    markTexted(token); // the link itself opens Messages / WhatsApp
  } else if (act === 'copy') {
    const ok = await copyText(linkFor(token));
    toast(ok ? `Copied ${greetingName(g.name)}'s link` : linkFor(token));
  } else if (act === 'del') {
    if (!window.confirm(`Remove ${g.name} from the invite list? Their RSVP, if any, is kept.`)) return;
    try {
      await call('deleteGuest', { token });
      state.summary.guests = state.summary.guests.filter((x) => x.token !== token);
      renderInvites();
      renderOverview();
      toast(`Removed ${g.name}`);
    } catch (err) {
      toast(`Couldn't remove: ${err.message}`);
    }
  }
});

$('#textNext').addEventListener('click', (e) => {
  const a = e.currentTarget;
  if (a.getAttribute('aria-disabled') === 'true' || !a.dataset.token) { e.preventDefault(); return; }
  markTexted(a.dataset.token);
});

$('#invFilters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  state.invFilter = b.dataset.f;
  $$('#invFilters [data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderInvites();
});

/* paste parser */
let parsed = { lines: [], ready: [], counts: { ready: 0, duplicate: 0, missing: 0, invalid: 0 } };
function renderParse() {
  parsed = parsePaste($('#paste').value, state.summary ? state.summary.guests : []);
  $('#parseSum').textContent = pasteSummary(parsed);
  const LABEL = { ready: 'Ready', duplicate: 'Duplicate', missing: 'No number', invalid: 'Check' };
  $('#parseList').replaceChildren(...parsed.lines.slice(0, 100).map((l) => h('li', { 'data-status': l.status },
    h('span', { class: `pb ${l.status}`, text: LABEL[l.status] }),
    h('span', {},
      h('span', { class: 'pl-name', text: l.name || l.raw }),
      l.phone && l.status !== 'missing' ? h('span', { class: 'pl-note', text: ` ${formatPhone(l.phone)}` }) : null,
      l.note ? h('span', { class: 'pl-note', text: ` · ${l.note}` }) : null),
  )));
  const n = parsed.counts.ready;
  $('#addBtn').disabled = !n;
  $('#addBtn').textContent = n ? `Add ${plural(n, 'person', 'people')} to the list` : 'Add to list';
}
$('#paste').addEventListener('input', renderParse);

$('#addBtn').addEventListener('click', async () => {
  const ready = parsed.ready;
  if (!ready.length) return;
  const btn = $('#addBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  try {
    const res = await call('addGuests', { guests: ready.map((l) => ({ name: l.name, phone: l.phone })) });
    // Keep only the lines that still need attention.
    const keep = parsed.lines.filter((l) => l.status === 'missing' || l.status === 'invalid').map((l) => l.raw);
    $('#paste').value = keep.join('\n');
    res.guests.forEach((g) => state.justAdded.add(g.token));
    const skipped = res.skipped.length ? ` ${res.skipped.length} skipped (already on the list).` : '';
    toast(`Added ${plural(res.guests.length, 'person', 'people')}. Each got a personal link.${skipped}`);
    const added = new Set(state.justAdded);
    await refresh({ quiet: true });
    state.justAdded = added;
    renderInvites();
  } catch (err) {
    toast(`Couldn't add: ${err.message}`);
  } finally {
    renderParse();
  }
});

/* template + preview */
function renderTemplateEditor() {
  $$('#tplBox [data-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === state.tpl.active)));
  $('#tplText').value = state.tpl[state.tpl.active];
  renderPreview();
}
function renderPreview() {
  const q = queue();
  const sample = q[0] || (state.summary && state.summary.guests[0]) || { name: 'Priya Raman', token: 'pr7kXm2Q' };
  const text = messageFor(sample);
  $('#bubTo').textContent = `To: ${sample.name}`;
  $('#bubble').textContent = text;
  $('#chars').textContent = `${[...text].length} characters`;
  let hostName = '';
  try { hostName = new URL(BASE).host; } catch { hostName = BASE; }
  $('#lpHost').textContent = hostName;
}
$('#tplBox').addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  state.tpl.active = b.dataset.t;
  saveTemplates();
  renderTemplateEditor();
  renderInvites();
});
let tplTimer = 0;
$('#tplText').addEventListener('input', (e) => {
  state.tpl[state.tpl.active] = e.target.value;
  saveTemplates();
  renderPreview();
  clearTimeout(tplTimer);
  tplTimer = setTimeout(renderInvites, 250);
});
$('#tplReset').addEventListener('click', () => {
  state.tpl[state.tpl.active] = DEFAULT_TEMPLATES[state.tpl.active];
  saveTemplates();
  renderTemplateEditor();
  renderInvites();
});

/* QR code for the site (reprinting the invitation) */
const qrUrl = () => BASE + '/';
let qrDrawn = '';
function makeQr() {
  if (typeof window.qrcode !== 'function') return null;
  const qr = window.qrcode(0, 'M');
  qr.addData(qrUrl());
  qr.make();
  return qr;
}
function paintQr(canvas, qr, px) {
  const count = qr.getModuleCount();
  const quiet = 4;
  const cell = Math.max(1, Math.floor(px / (count + quiet * 2)));
  const size = cell * (count + quiet * 2);
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, size, size);
  c.fillStyle = '#2a180c';
  for (let r = 0; r < count; r++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(r, col)) c.fillRect((col + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
}
function drawQr() {
  $('#qrUrl').textContent = qrUrl();
  if (qrDrawn === qrUrl()) return;
  const qr = makeQr();
  if (!qr) { $('#qrUrl').textContent = `${qrUrl()} (the QR library didn't load; check your connection)`; $('#qrDownload').disabled = true; return; }
  paintQr($('#qrCanvas'), qr, 464);
  $('#qrDownload').disabled = false;
  qrDrawn = qrUrl();
}
$('#qrDownload').addEventListener('click', () => {
  const qr = makeQr();
  if (!qr) return;
  const canvas = document.createElement('canvas');
  paintQr(canvas, qr, 1200);
  canvas.toBlob((blob) => { if (blob) { download(blob, 'sun-or-shine-qr.png'); toast('QR code downloaded'); } }, 'image/png');
});

/* ───────────────────────── reveal tab ───────────────────────── */

const reveal = createReveal({
  root: $('#rv'),
  reducedMotion,
  toast,
  onN: (n) => { state.n = n; renderN(); },
  onClose: ({ practice }) => {
    if (!practice) { loadWinners(); refresh({ quiet: true }); }
  },
});

function renderN() {
  $('#nOut').textContent = String(state.n);
  $('#nMinus').disabled = state.n <= MIN_N;
  $('#nPlus').disabled = state.n >= MAX_N;
}
$('#nMinus').addEventListener('click', () => { state.n = clampN(state.n - 1); renderN(); });
$('#nPlus').addEventListener('click', () => { state.n = clampN(state.n + 1); renderN(); });

const practiceOn = () => $('#practice').checked;
function renderPractice() {
  const on = practiceOn();
  $('#practiceTitle').textContent = on ? 'Practice run is ON' : 'Practice run is OFF: this is the real reveal';
  $('#practiceDesc').textContent = on
    ? "Fake names. Nothing is saved and guests don't see the result. Turn it off for the real reveal."
    : 'Holding a button now saves the answer to the Sheet and draws from your real guests.';
  $('.rehearse').classList.toggle('off', !on);
  renderRevealTab();
}
$('#practice').addEventListener('change', renderPractice);

const poolSize = (team) => (state.summary ? state.summary.rsvps.filter((r) => r.vote === team && (r.attending === 'yes' || r.attending === 'maybe')).length : 0);

function renderRevealTab() {
  renderN();
  const s = state.summary;
  if (!s) return;
  $('#poolPre').textContent = practiceOn()
    ? `Practice uses ${FAKE.sun.length} fake correct guessers. Try more gifts than that to rehearse the bonus round.`
    : `In the draw (correct guessers who said yes or maybe): ${poolSize('sun')} if it's a Sun, ${poolSize('shine')} if it's a Shine.`;
  const pill = $('#revealState');
  pill.className = `pill ${s.reveal || ''}`;
  pill.textContent = s.reveal ? `Revealed: ${s.reveal === 'sun' ? 'Sun ☀️' : 'Shine ✨'}` : 'Not revealed yet';
  $('#resetReveal').hidden = !s.reveal;
}

function renderSaved() {
  const { winners, savedAt } = state.saved;
  $('#savedWinners').replaceChildren(...winners.map((w) => h('li', {}, w.name, w.bonus ? h('span', { class: 'tagb', text: 'Bonus' }) : null)));
  $('#savedMeta').textContent = winners.length
    ? `${plural(winners.length, 'winner')} saved ${ago(savedAt)}.`
    : 'No winners saved yet. Practice runs never save.';
  $('#clearWinners').hidden = !winners.length;
}

$('#clearWinners').addEventListener('click', async () => {
  if (!window.confirm('Clear the saved winners? This cannot be undone.')) return;
  try { await call('saveWinners', { winners: [] }); state.saved = { winners: [], savedAt: '' }; renderSaved(); toast('Saved winners cleared'); }
  catch (err) { toast(`Couldn't clear: ${err.message}`); }
});
$('#resetReveal').addEventListener('click', async () => {
  if (!window.confirm('Reset the reveal to "not revealed yet"? Saved winners are kept.')) return;
  try { await call('setReveal', { reveal: '' }); state.summary.reveal = ''; renderRevealTab(); toast('Reveal reset'); }
  catch (err) { toast(`Couldn't reset: ${err.message}`); }
});

/* full screen (laptop → TV) */
function fsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function toggleFullscreen() {
  const el = document.documentElement;
  if (fsActive()) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch?.(() => {});
    return;
  }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast("Use your browser's full screen (Ctrl+Cmd+F on a Mac, F11 on Windows)"); return; }
  const p = req.call(el);
  if (p && p.catch) p.catch(() => toast("Full screen isn't available here"));
}
function renderFs() {
  const on = fsActive();
  $('#fsBtn span').textContent = on ? 'Exit full screen' : 'Present full screen';
  $('#rvFs span').textContent = on ? 'Exit full screen' : 'Full screen';
  $('#rvFs').setAttribute('aria-pressed', String(on));
}
$('#fsBtn').addEventListener('click', toggleFullscreen);
$('#rvFs').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', renderFs);
document.addEventListener('webkitfullscreenchange', renderFs);

/* press and hold (1.5 s) to reveal; keyboard: Enter twice within 3 s */
const HOLD_MS = 1500;
$$('.hold').forEach((btn) => {
  const fill = $('.fill', btn);
  let t0 = 0, raf = 0, armedAt = 0;
  const setFill = (p) => { fill.style.transform = `scaleX(${p})`; };
  const end = (go) => {
    cancelAnimationFrame(raf);
    t0 = 0;
    setFill(0);
    if (go) startReveal(btn.dataset.team);
  };
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / HOLD_MS);
    setFill(p);
    if (p >= 1) { end(true); return; }
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    t0 = performance.now();
    raf = requestAnimationFrame(tick);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, () => { if (t0) end(false); }));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.repeat) return;
    const now = Date.now();
    if (now - armedAt < 3000) {
      armedAt = 0;
      btn.classList.remove('armed');
      startReveal(btn.dataset.team);
    } else {
      armedAt = now;
      btn.classList.add('armed');
      toast(`Press Enter again to reveal ${btn.dataset.team === 'sun' ? 'Sun' : 'Shine'}`);
      setTimeout(() => btn.classList.remove('armed'), 3000);
    }
  });
});

const FAKE = {
  sun: ['Marcus T.', 'Jordan P.', 'Arjun K.', 'Neha S.', 'Rohan M.', 'Kevin D.', 'Ishaan R.', 'Elena G.'],
  shine: ['Priya N.', 'Anjali S.', 'Deepa R.', 'Grace H.', 'Meera P.', 'Divya K.', 'Leah W.', 'Kavya D.'],
  extra: ['Sam O.', 'Tara K.', 'Owen F.', 'Mina J.', 'Ruth L.', 'Ben M.'],
};
const fakeList = (names, prefix) => names.map((name, i) => ({ token: `practice-${prefix}-${i}`, name }));

function startReveal(team) {
  if (reveal.isOpen()) return;
  hideToast();
  const practice = practiceOn();
  // On a laptop, go full screen with the hold's user activation (no-op if not allowed).
  if (!fsActive() && window.matchMedia('(pointer: fine)').matches && navigator.userActivation && navigator.userActivation.isActive) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { const p = req.call(el); if (p && p.catch) p.catch(() => {}); }
  }
  if (practice) {
    const other = team === 'sun' ? 'shine' : 'sun';
    const pool = fakeList(FAKE[team], team);
    const bonusPool = [...fakeList(FAKE[other], other), ...fakeList(FAKE.extra, 'x')];
    reveal.open({
      team, practice: true, n: state.n,
      stat: `${pool.length} of ${pool.length + FAKE[other].length} guests guessed right · practice run`,
      // Practice never calls setReveal, pool or saveWinners.
      prepare: async () => ({ pool, bonusPool, winners: [], save: null }),
    });
    return;
  }
  const s = state.summary;
  const prevReveal = s ? s.reveal : '';
  const voters = s ? s.sun + s.shine : 0;
  const correct = s ? s[team] : 0;
  reveal.open({
    team, practice: false, n: state.n,
    stat: `${correct} of ${plural(voters, 'guest')} guessed right`,
    prepare: async () => {
      await call('setReveal', { reveal: team });
      const [poolRes, summary, saved] = await Promise.all([call('pool'), call('summary'), call('getWinners')]);
      applySummary(summary);
      state.saved = { winners: saved.winners || [], savedAt: saved.savedAt || '' };
      renderSaved();
      // Bonus round: everyone else who said yes or maybe (the correct guessers are excluded by token).
      const bonusPool = summary.rsvps
        .filter((r) => r.attending === 'yes' || r.attending === 'maybe')
        .map((r) => ({ token: r.token, name: r.name }));
      return {
        pool: poolRes.pool,
        bonusPool,
        // Resume a draw that was interrupted (same answer as before).
        winners: prevReveal === team ? state.saved.winners : [],
        save: (winners) => call('saveWinners', { winners }).then((res) => {
          state.saved = { winners: res.winners, savedAt: res.savedAt };
          renderSaved();
          return res;
        }),
      };
    },
  });
}

/* ───────────────────────── boot ───────────────────────── */

$('#gateForm').addEventListener('submit', onGateSubmit);
renderTemplateEditor();
renderN();
renderFs();

(async function boot() {
  const key = loadSession();
  if (!key) { $('#gateKey').focus(); return; }
  state.key = key;
  try {
    enterApp(await host(key, 'summary'));
  } catch (err) {
    if (err && err.code === 'unauthorized') lock('Please unlock again.');
    else {
      // Keep the session; show the app with a retry banner.
      $('#gate').hidden = true;
      $('#app').hidden = false;
      selectTab(tabFromHash(), false);
      showBanner(`Couldn't load: ${err.message}`);
    }
  }
})();
