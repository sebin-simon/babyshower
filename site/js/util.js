/**
 * Small shared helpers for the guest page. No dependencies.
 * Guest-supplied text must always go through textContent (see `h()` below).
 */
import { CONFIG } from './config.js';

export const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const gsap = window.gsap || null;
export const ST = window.ScrollTrigger || null;
export const HAS_GSAP = !!(gsap && ST);
if (HAS_GSAP) gsap.registerPlugin(ST);
/** Full motion: GSAP present and the guest hasn't asked for reduced motion. */
export const MOTION = HAS_GSAP && !RM;

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const buzz = (p) => { try { if (!RM && navigator.vibrate) navigator.vibrate(p); } catch { /* unsupported */ } };
export const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
export const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

/**
 * Build an element. Text children are set with textContent / text nodes only,
 * so guest data can never become markup.
 */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, pv] of Object.entries(v)) el.style.setProperty(p, String(pv)); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}
const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/* ---------- device tier: caps particle counts so mid-range phones stay at 60fps ---------- */
function computeTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const small = Math.min(screen.width, innerWidth) < 720;
  if (saveData || cores <= 2 || mem <= 2) return 'low';
  if (small || cores <= 4 || mem <= 4) return 'mid';
  return 'high';
}
export const TIER = computeTier();

/* ---------- storage (localStorage can throw in private mode / blocked storage) ---------- */
const NS = 'sunorshine.';
export const store = {
  get(k) { try { const v = localStorage.getItem(NS + k); return v == null ? null : JSON.parse(v); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(NS + k); } catch { /* ignore */ } },
};

/* ---------- names ---------- */
const KEEP_WHOLE = /\b(aunty|auntie|aunt|uncle|chechi|chettan|ammachi|appachan|grandma|grandpa|nana|nani|dadi|dada|ammumma|appooppan|mom|dad)\b/i;
/** Name for greetings: first name, but keep couples ("Rahul & Asha") and family titles ("Sunita Aunty") whole. */
export function greetName(full) {
  const n = String(full || '').trim().replace(/\s+/g, ' ');
  if (!n) return '';
  if (/&|\band\b|\+/i.test(n) || KEEP_WHOLE.test(n)) return n;
  return n.split(' ')[0];
}
export const firstName = (full) => String(full || '').trim().split(/\s+/)[0] || '';
export const initial = (full) => (String(full || '').trim()[0] || '✦').toUpperCase();

/* ---------- event formatting, always from CONFIG ---------- */
const tz = CONFIG.timeZone || 'America/Los_Angeles';
const start = new Date(CONFIG.date);
const end = new Date(CONFIG.endDate || CONFIG.date);
const fmt = (d, o) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(d);
function timeShort(d) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
  const hr = parts.find((p) => p.type === 'hour').value;
  const mn = parts.find((p) => p.type === 'minute').value;
  const ap = parts.find((p) => p.type === 'dayPeriod').value.toUpperCase();
  return { t: mn === '00' ? hr : hr + ':' + mn, full: hr + ':' + mn, ap };
}
const s = timeShort(start), e = timeShort(end);
const tzName = (() => {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(start).find((p) => p.type === 'timeZoneName').value; } catch { return 'PT'; }
})();
export const EVENT = Object.freeze({
  start, end,
  dateShort: fmt(start, { weekday: 'short', month: 'short', day: 'numeric' }),
  dateLong: fmt(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  monthDay: fmt(start, { month: 'long', day: 'numeric' }),
  timeRange: s.ap === e.ap ? `${s.t}–${e.t} ${e.ap}` : `${s.t} ${s.ap}–${e.t} ${e.ap}`,
  timeLong: `${s.full} ${s.ap === e.ap ? '' : s.ap + ' '}– ${e.full} ${e.ap} ${tzName === 'PST' || tzName === 'PDT' ? 'Pacific' : tzName}`.replace(/\s+/g, ' '),
  venue: CONFIG.venue,
  venueShort: (CONFIG.venue || '').replace(/\s+Campus$/i, ''),
  address: CONFIG.address,
  hosts: CONFIG.hosts,
});

/* ---------- toast ---------- */
let toastT;
export function toast(msg, ms = 3400) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), ms);
}
