/**
 * Pure helpers for the host page (no DOM). Imported by host.js and reveal.js,
 * and unit-tested in Node by dev/host.test.mjs.
 */

/* ───────────────────────────── Phones ───────────────────────────── */

/** Digits only, same rules as Code.gs normPhone_: drops a "00" prefix and a US "1" on 11 digits. */
export function normPhone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.slice(0, 2) === '00') d = d.slice(2);
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d;
}

/** Digits with country code: 10-digit numbers are assumed to be US/Canada (+1). */
export function intlDigits(phone) {
  const d = normPhone(phone);
  if (!d) return '';
  return d.length === 10 ? '1' + d : d;
}

/** "(425) 555-0142" for US numbers, "+44 2079460958" style otherwise. */
export function formatPhone(phone) {
  const d = normPhone(phone);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return d ? '+' + d : '';
}

/**
 * `sms:+14255550142?&body=…`. The `?&` form opens a pre-filled message on both
 * iOS (which reads `&body=`) and Android (which reads `?body=`).
 */
export function smsHref(phone, text) {
  const d = intlDigits(phone);
  if (!d) return '';
  return `sms:+${d}?&body=${encodeURIComponent(text)}`;
}

/** WhatsApp click-to-chat: digits with country code, no "+". */
export function waHref(phone, text) {
  const d = intlDigits(phone);
  if (!d) return '';
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/* ───────────────────────────── Links ───────────────────────────── */

/**
 * The public site root, without a trailing slash.
 * siteUrl (CONFIG.siteUrl) wins; otherwise origin + basePath, where basePath is
 * the folder above the host page (e.g. "/repo/" on a GitHub Pages project site).
 */
export function siteBase(siteUrl, origin, basePath) {
  let base = String(siteUrl || '').trim();
  if (base) {
    base = base.replace(/[?#].*$/, '').replace(/\/index\.html?$/i, '');
  } else {
    const p = String(basePath || '/').replace(/[?#].*$/, '');
    base = String(origin || '') + (p.startsWith('/') ? p : '/' + p);
  }
  return base.replace(/\/+$/, '');
}

/** `${base}/?g=${token}` */
export function personalLink(base, token) {
  return `${base}/?g=${encodeURIComponent(token)}`;
}

/* ───────────────────────────── Names & templates ───────────────────────────── */

// Family titles and honorifics: if a name contains one, greet with the whole name
// ("Sunita Aunty", "Uncle Joe"), never just the first word.
const TITLES = new Set([
  'aunty', 'auntie', 'aunt', 'uncle', 'ji', 'didi', 'bhaiya', 'bhai', 'bhabhi', 'chechi', 'chetta', 'chettan',
  'chechy', 'amma', 'appa', 'achan', 'ammachi', 'appachan', 'ammumma', 'appooppan', 'mama', 'mami', 'maama',
  'nani', 'nana', 'dadi', 'dada', 'grandma', 'grandpa', 'granny', 'grandmother', 'grandfather', 'mom', 'mum',
  'dad', 'kaka', 'kaki', 'mausi', 'bua', 'chacha', 'chachi', 'thatha', 'paati', 'akka', 'anna', 'athai', 'periamma',
  'chithi', 'chittappa', 'pappa', 'mummy', 'daddy', 'dr', 'mr', 'mrs', 'ms', 'miss', 'sir', 'madam', 'fr', 'sr',
]);

/** "Priya Raman" → "Priya"; couples and family titles are kept whole. */
export function greetingName(name) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) return 'friend';
  if (/&|\+|\band\b/i.test(n)) return n;
  const words = n.split(' ');
  if (words.some((w) => TITLES.has(w.toLowerCase().replace(/[^a-z]/g, '')))) return n;
  return words[0];
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export const DEFAULT_TEMPLATES = Object.freeze({
  warm:
    "Hi {name}! 🍂 Ayana & Sebin here. We're celebrating our little one with a Baby Shower & Gender Reveal on Sat, Nov 7 at 12 PM in Redmond, and it wouldn't be the same without you.\n\n" +
    'Will baby be a Sun ☀️ or a Shine ✨? RSVP and cast your guess (30 sec):\n{link}',
  short:
    "{name}, you're invited! ☀️✨ Baby Shower & Gender Reveal, Sat Nov 7, 12 PM, Redmond. RSVP + guess Sun or Shine: {link} – Ayana & Sebin",
});

/** Fills {name} and {link}. If the host deleted {link}, the link is appended so it's never lost. */
export function fillTemplate(tpl, { name, link }) {
  let t = String(tpl || '');
  if (!t.includes('{link}')) t = t.replace(/\s+$/, '') + '\n{link}';
  return t.replace(/\{name\}/g, greetingName(name)).replace(/\{link\}/g, link);
}

/* ───────────────────────────── Paste parser ───────────────────────────── */

const PHONE_END = /(\+?\(?\d[\d\s().\-]{2,}\d)\s*$/;
const PHONE_START = /^(\+?\(?\d[\d\s().\-]{5,}\d)(?=\s*[,;\t|:–—-]|\s+\D)/;

function cleanName(s) {
  return String(s || '')
    .replace(/^[\s,;:|–—\-]+|[\s,;:|–—\-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Checks a raw phone string. Returns {phone, ok, reason}. */
function checkPhone(raw) {
  const s = String(raw || '').trim();
  const intl = /^\s*(\+|00)/.test(s);
  const d = normPhone(s);
  if (d.length === 10) return { phone: d, ok: true };
  if (intl && d.length >= 8 && d.length <= 15) return { phone: d, ok: true };
  return { phone: d, ok: false, reason: d.length < 10 ? 'short' : 'long' };
}

/** Splits one pasted line into {name, rawPhone}. Accepts "Name, phone", tabs, "phone, name" and "Name phone". */
export function splitLine(line) {
  let s = String(line || '').replace(/ /g, ' ').trim();
  s = s.replace(/^(?:[-*•·]\s+|\d{1,3}[.)]\s+)/, ''); // list bullets / numbering
  if (s.includes('\t')) {
    const cells = s.split('\t').map((c) => c.trim()).filter(Boolean);
    const i = cells.findIndex((c) => (c.match(/\d/g) || []).length >= 7 && !/[a-z]{2,}/i.test(c));
    if (i >= 0) {
      const rawPhone = cells[i];
      cells.splice(i, 1);
      return { name: cleanName(cells.join(' ')), rawPhone };
    }
    return { name: cleanName(cells.join(' ')), rawPhone: '' };
  }
  // A trailing run of 4+ digits is treated as a (possibly mistyped) number, so
  // "Sam, 555-01" is flagged as too short rather than "needs a number".
  let m = s.match(PHONE_END);
  if (m && (m[1].match(/\d/g) || []).length >= 4) {
    return { name: cleanName(s.slice(0, m.index)), rawPhone: m[1] };
  }
  m = s.match(PHONE_START);
  if (m && (m[1].match(/\d/g) || []).length >= 7) {
    return { name: cleanName(s.slice(m[0].length)), rawPhone: m[1] };
  }
  return { name: cleanName(s), rawPhone: '' };
}

/**
 * Parses pasted contacts against the existing guest list.
 * Each line → {raw, name, phone, status, note, dupeOf?}, where status is
 *   'ready' | 'duplicate' | 'missing' (no number) | 'invalid' (bad number or no name)
 */
export function parsePaste(text, existing = []) {
  const byPhone = new Map();
  const byName = new Map();
  for (const g of existing) {
    const p = normPhone(g.phone);
    if (p) byPhone.set(p, g.name);
    else byName.set(String(g.name || '').toLowerCase(), g.name);
  }
  const seenPhone = new Map();
  const lines = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const { name, rawPhone } = splitLine(raw);
    const item = { raw: raw.trim(), name, phone: '', status: 'ready', note: '' };
    if (!rawPhone) {
      item.status = 'missing';
      item.note = 'needs a number';
    } else {
      const ph = checkPhone(rawPhone);
      item.phone = ph.phone;
      if (!name) { item.status = 'invalid'; item.note = 'needs a name'; }
      else if (!ph.ok) { item.status = 'invalid'; item.note = ph.reason === 'short' ? 'number looks too short' : 'number looks too long'; }
      else if (byPhone.has(ph.phone)) { item.status = 'duplicate'; item.dupeOf = byPhone.get(ph.phone); item.note = `already on your list as ${byPhone.get(ph.phone)}`; }
      else if (seenPhone.has(ph.phone)) { item.status = 'duplicate'; item.dupeOf = seenPhone.get(ph.phone); item.note = `same number as ${seenPhone.get(ph.phone)} above`; }
      else seenPhone.set(ph.phone, name);
    }
    lines.push(item);
  }
  const count = (s) => lines.filter((l) => l.status === s).length;
  return { lines, ready: lines.filter((l) => l.status === 'ready'), counts: { ready: count('ready'), duplicate: count('duplicate'), missing: count('missing'), invalid: count('invalid') } };
}

/** "2 people ready · 1 already on your list · 1 line needs a number: “Uncle Joe”" */
export function pasteSummary(res) {
  const { ready, duplicate, missing, invalid } = res.counts;
  const parts = [`${ready} ${ready === 1 ? 'person' : 'people'} ready`];
  if (duplicate) parts.push(`${duplicate} already on your list`);
  if (missing) {
    const first = res.lines.find((l) => l.status === 'missing');
    parts.push(`${missing} ${missing === 1 ? 'line needs' : 'lines need'} a number: “${first.raw.slice(0, 28)}”`);
  }
  if (invalid) parts.push(`${invalid} ${invalid === 1 ? 'line needs' : 'lines need'} a fix`);
  return parts.join(' · ');
}

/* ───────────────────────────── CSV ───────────────────────────── */

/**
 * RFC 4180 CSV. Cells that a spreadsheet would run as a formula (= + - @, tab, CR)
 * get a leading apostrophe, since guests typed this text.
 */
export function toCsv(rows, columns) {
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => cell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(','));
  return [head, ...body].join('\r\n') + '\r\n';
}

/* ───────────────────────────── Randomness ───────────────────────────── */

/** Unbiased integer in [0, n) from crypto.getRandomValues (rejection sampling). */
export function cryptoInt(n, cryptoObj = globalThis.crypto) {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('n must be a positive integer');
  if (n === 1) return 0;
  const max = 0x100000000;
  const limit = max - (max % n);
  const buf = new Uint32Array(1);
  for (;;) {
    cryptoObj.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/* ───────────────────────────── Draw ───────────────────────────── */

/**
 * Who can still be drawn. Correct guessers first; in the bonus round, the other
 * attendees too. Winners and people marked "not here" are excluded.
 */
export function drawable({ pool, bonusPool = [], winners = [], absent = [], bonus = false }) {
  const out = new Set([...winners, ...absent].map((p) => p.token));
  const list = bonus ? [...pool, ...bonusPool] : pool;
  const seen = new Set();
  return list.filter((p) => {
    if (out.has(p.token) || seen.has(p.token)) return false;
    seen.add(p.token);
    return true;
  });
}

/** Days until the party (by calendar day in the party's time zone). 0 = today, negative = past. */
export function daysUntil(isoDate, timeZone, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const a = Date.parse(fmt.format(now) + 'T00:00:00Z');
  const b = Date.parse(fmt.format(new Date(isoDate)) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/** "3 min ago", "2 h ago", "Oct 28" */
export function ago(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!t) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
