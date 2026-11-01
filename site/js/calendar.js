/**
 * Add to Calendar (Google link + generated .ics) and Maps links.
 * Every value comes from CONFIG (js/config.js) via EVENT.
 */
import { CONFIG } from './config.js';
import { $$, EVENT } from './util.js';

const TITLE = `${CONFIG.hosts}'s Baby Shower & Gender Reveal`;
const DESC = 'Sun ☀️ (Boy) or Shine ✨ (Girl)? Your presence is our greatest gift, so please, no wrapped presents. ' +
  'Just bring your love and predictions! Attire: Light Neutrals / Garden Casual.';

const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const location = () => `${CONFIG.venue}, ${CONFIG.address}`;
const pageUrl = () => CONFIG.siteUrl || (window.location.origin + window.location.pathname);

export function googleCalendarUrl() {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${utcStamp(EVENT.start)}/${utcStamp(EVENT.end)}`,
    details: `${DESC}\n\nRSVP & vote: ${pageUrl()}`,
    location: location(),
    ctz: CONFIG.timeZone || 'America/Los_Angeles',
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

export function mapsUrl() {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(location());
}

/** RFC 5545 text escaping + 75-octet line folding. */
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
function fold(line) {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function buildIcs() {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sun or Shine//Guest Page//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:sun-or-shine-${utcStamp(EVENT.start)}@ayana-sebin`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(EVENT.start)}`,
    `DTEND:${utcStamp(EVENT.end)}`,
    `SUMMARY:${esc(TITLE)}`,
    `LOCATION:${esc(location())}`,
    `DESCRIPTION:${esc(DESC + '\n\nRSVP & vote: ' + pageUrl())}`,
    `URL:${pageUrl()}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Sun or Shine is tomorrow!', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs() {
  const blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sun-or-shine.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Fill [data-cfg] text, wire [data-gcal] / [data-ics] / [data-maps]. */
export function initCalendar() {
  for (const el of $$('[data-cfg]')) {
    const v = EVENT[el.dataset.cfg];
    if (v) el.textContent = v;
  }
  for (const el of $$('.cfg-hosts')) el.textContent = CONFIG.hosts;
  const g = googleCalendarUrl(), m = mapsUrl();
  for (const a of $$('[data-gcal]')) a.href = g;
  for (const a of $$('[data-maps]')) a.href = m;
  for (const b of $$('[data-ics]')) b.addEventListener('click', downloadIcs);
}
