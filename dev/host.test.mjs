/**
 * Unit tests for the host page's pure helpers (site/hostdesk-tze3q93o/lib.js).
 * Run: `npm test` (from dev/).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normPhone, intlDigits, formatPhone, smsHref, waHref, siteBase, personalLink, greetingName,
  DEFAULT_TEMPLATES, fillTemplate, parsePaste, pasteSummary, splitLine, toCsv, cryptoInt, drawable, daysUntil,
} from '../site/hostdesk-tze3q93o/lib.js';

test('phones: normalize like the backend, US numbers get +1', () => {
  assert.equal(normPhone('(425) 555-0142'), '4255550142');
  assert.equal(normPhone('+1 425.555.0142'), '4255550142');
  assert.equal(normPhone('0044 20 7946 0958'), '442079460958');
  assert.equal(intlDigits('425-555-0142'), '14255550142');
  assert.equal(intlDigits('442079460958'), '442079460958');
  assert.equal(formatPhone('14255550142'), '(425) 555-0142');
  assert.equal(formatPhone('442079460958'), '+442079460958');
  assert.equal(formatPhone(''), '');
});

test('sms and WhatsApp hrefs', () => {
  const text = 'Hi Priya! RSVP: https://x.github.io/repo/?g=AbC&d=1 ☀️';
  const enc = encodeURIComponent(text);
  assert.equal(smsHref('(425) 555-0142', text), `sms:+14255550142?&body=${enc}`);
  assert.equal(waHref('(425) 555-0142', text), `https://wa.me/14255550142?text=${enc}`);
  assert.equal(waHref('+44 20 7946 0958', 'x'), 'https://wa.me/442079460958?text=x');
  assert.equal(smsHref('', text), '');
  assert.ok(!smsHref('4255550142', 'a&b').includes('a&b'), 'body is encoded');
});

test('site base: siteUrl wins, else origin + GitHub Pages project base path', () => {
  assert.equal(siteBase('', 'https://ayana.github.io', '/sun-or-shine/'), 'https://ayana.github.io/sun-or-shine');
  assert.equal(siteBase('', 'http://localhost:5174', '/'), 'http://localhost:5174');
  assert.equal(siteBase('https://ayana.github.io/sun-or-shine/', 'http://localhost:5174', '/'), 'https://ayana.github.io/sun-or-shine');
  assert.equal(siteBase('https://sunorshine.party/index.html?x=1', 'x', '/'), 'https://sunorshine.party');
  assert.equal(personalLink('https://ayana.github.io/repo', 'AbC23xyz'), 'https://ayana.github.io/repo/?g=AbC23xyz');
});

test('greeting names keep couples and family titles whole', () => {
  assert.equal(greetingName('Priya Raman'), 'Priya');
  assert.equal(greetingName('Rahul & Asha'), 'Rahul & Asha');
  assert.equal(greetingName('Rahul and Asha Menon'), 'Rahul and Asha Menon');
  assert.equal(greetingName('Sunita Aunty'), 'Sunita Aunty');
  assert.equal(greetingName('Uncle Joe'), 'Uncle Joe');
  assert.equal(greetingName('  '), 'friend');
});

test('templates fill {name} and {link}; a deleted {link} is appended', () => {
  const link = 'https://x.io/?g=pr7k';
  const warm = fillTemplate(DEFAULT_TEMPLATES.warm, { name: 'Priya Raman', link });
  assert.match(warm, /^Hi Priya! 🍂 Ayana & Sebin here\./);
  assert.ok(warm.endsWith(`\n${link}`), 'link on its own line');
  const short = fillTemplate(DEFAULT_TEMPLATES.short, { name: 'Sunita Aunty', link });
  assert.match(short, /^Sunita Aunty, you're invited!/);
  assert.equal(fillTemplate('Hello {name}', { name: 'Kai Lee', link }), `Hello Kai\n${link}`);
});

test('paste parser: ready, duplicate, missing number, bad number', () => {
  assert.deepEqual(splitLine('Grace Kim\t(206) 555-0177'), { name: 'Grace Kim', rawPhone: '(206) 555-0177' });
  assert.deepEqual(splitLine('425 555 0181, Rohan & Asha Menon'), { name: 'Rohan & Asha Menon', rawPhone: '425 555 0181' });
  assert.deepEqual(splitLine('1. Priya Raman 425-555-0142'), { name: 'Priya Raman', rawPhone: '425-555-0142' });

  const existing = [{ name: 'Asha', phone: '4255550181' }];
  const res = parsePaste([
    'Rohan & Asha Menon, 425 555 0181',   // duplicate of an existing guest
    'Grace Kim\t(206) 555-0177',          // ready
    'Uncle Joe',                          // needs a number
    '',
    'Kavya Nair, +1 (425) 555-0199',      // ready
    'Kavya again, 4255550199',            // duplicate within the paste
    'Shorty, 555-0100',                   // too short
    'Tiny, 555-01',                       // too short, not "missing"
    'Ben, +44 20 7946 0958',              // ready (international)
  ].join('\n'), existing);
  assert.deepEqual(res.lines.map((l) => l.status), ['duplicate', 'ready', 'missing', 'ready', 'duplicate', 'invalid', 'invalid', 'ready']);
  assert.deepEqual(res.ready.map((l) => [l.name, l.phone]), [['Grace Kim', '2065550177'], ['Kavya Nair', '4255550199'], ['Ben', '442079460958']]);
  assert.equal(res.lines[0].dupeOf, 'Asha');
  assert.equal(pasteSummary(res), '3 people ready · 2 already on your list · 1 line needs a number: “Uncle Joe” · 2 lines need a fix');
  assert.equal(pasteSummary(parsePaste('', [])), '0 people ready');
});

test('CSV quotes, escapes and defuses formulas', () => {
  const csv = toCsv([{ a: 'Priya, R', b: '=HYPERLINK("x")', c: 'say "hi"\nthere' }],
    [{ label: 'A', key: 'a' }, { label: 'B', key: 'b' }, { label: 'C', key: 'c' }]);
  assert.equal(csv, 'A,B,C\r\n"Priya, R","\'=HYPERLINK(""x"")","say ""hi""\nthere"\r\n');
});

test('cryptoInt is unbiased-ish and in range; drawable excludes winners and absent people', () => {
  const counts = [0, 0, 0];
  for (let i = 0; i < 3000; i++) counts[cryptoInt(3)]++;
  assert.ok(counts.every((c) => c > 850 && c < 1150), `roughly uniform: ${counts}`);
  assert.equal(cryptoInt(1), 0);
  assert.throws(() => cryptoInt(0));

  const p = (t) => ({ token: t, name: t });
  const pool = [p('a'), p('b'), p('c')];
  const bonusPool = [p('a'), p('b'), p('c'), p('d'), p('e')];
  assert.deepEqual(drawable({ pool, winners: [p('a')], absent: [p('b')] }).map((x) => x.token), ['c']);
  assert.deepEqual(drawable({ pool, bonusPool, winners: [p('a'), p('c')], absent: [p('b')], bonus: true }).map((x) => x.token), ['d', 'e']);
});

test('daysUntil counts calendar days in the party time zone', () => {
  const party = '2026-11-07T12:00:00-08:00';
  assert.equal(daysUntil(party, 'America/Los_Angeles', new Date('2026-10-29T16:00:00Z')), 9);
  assert.equal(daysUntil(party, 'America/Los_Angeles', new Date('2026-11-07T07:30:00Z')), 1, 'still Nov 6 in Redmond');
  assert.equal(daysUntil(party, 'America/Los_Angeles', new Date('2026-11-07T20:00:00Z')), 0);
});
