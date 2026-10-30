/**
 * API contract tests. Run: `npm test` (from dev/).
 *
 * Each test starts a fresh mock server (which executes the real Code.gs) on a
 * random port with a throwaway data file, then talks to it through the real
 * client adapter site/js/api.js.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './mock-server.mjs';

const HOST_KEY = 'test-key';
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sun-or-shine-test-'));
after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

// api.js resolves '/api' against location.origin, so give Node a location.
// It must exist before config.js is imported (it picks the backend once).
globalThis.location = new URL('http://127.0.0.1/');
const api = await import('../site/js/api.js');
const { CONFIG } = await import('../site/js/config.js');

let n = 0;
async function fresh(t) {
  const srv = await startServer({
    port: 0, bind: '127.0.0.1', hostKey: HOST_KEY, authDelayMs: 50, quiet: true,
    dataFile: path.join(tmpRoot, `data-${++n}.json`),
  });
  globalThis.location = new URL(`${srv.url}/`);
  t.after(() => srv.close());
  return srv;
}

const host = (op, payload) => api.host(HOST_KEY, op, payload);
const rejectsWith = (promise, code) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.name, 'ApiError');
    assert.equal(err.code, code);
    assert.ok(err.message.length > 0, 'has a friendly message');
    return true;
  });

const yes = (extra) => ({ name: 'Priya Raman', phone: '425-555-0101', attending: 'yes', adults: 2, kids: 1, vote: 'sun', ...extra });

test('config picks the local backend when apiUrl is empty', () => {
  assert.equal(CONFIG.apiUrl, '');
  assert.equal(CONFIG.backend, 'local');
  assert.equal(CONFIG.date, '2026-11-07T12:00:00-08:00');
  assert.equal(new Date(CONFIG.date).toISOString(), '2026-11-07T20:00:00.000Z');
});

test('ping, empty state and sheet auto-creation', async (t) => {
  const srv = await fresh(t);
  const ping = await (await fetch(`${srv.url}/api`)).json();
  assert.deepEqual({ ok: ping.ok, service: ping.service }, { ok: true, service: 'sun-or-shine' });

  const pub = await api.getPublic();
  assert.deepEqual(pub, { ok: true, sun: 0, shine: 0, total: 0, wishes: [] });

  const data = JSON.parse(fs.readFileSync(srv.dataFile, 'utf8'));
  assert.deepEqual(data.sheets.RSVPs.values[0],
    ['token', 'name', 'phone', 'attending', 'adults', 'kids', 'vote', 'wish', 'baby_name', 'hidden', 'created_at', 'updated_at']);
  assert.deepEqual(data.sheets.Guests.values[0], ['token', 'name', 'phone', 'added_at', 'texted_at', 'opened_at']);
});

test('RSVP is created, then upserted by token, by phone, and by name+phone', async (t) => {
  const srv = await fresh(t);
  const first = await api.submitRsvp(yes({ wish: 'Welcome, little one!' }));
  assert.equal(first.created, true);
  assert.match(first.rsvp.token, /^[A-Za-z0-9]{8}$/);
  assert.equal(first.rsvp.phone, '4255550101');
  assert.equal(first.rsvp.adults, 2);

  // By token: change everything including the phone.
  const byToken = await api.submitRsvp({ token: first.rsvp.token, name: 'Priya R', phone: '(425) 555-0199', attending: 'maybe', adults: 1, kids: 0, vote: 'shine' });
  assert.equal(byToken.created, false);
  assert.equal(byToken.rsvp.token, first.rsvp.token);
  assert.equal(byToken.rsvp.attending, 'maybe');
  assert.equal(byToken.rsvp.phone, '4255550199');
  assert.equal(byToken.rsvp.created_at, first.rsvp.created_at);

  // By phone (different formatting, +1 prefix, no token).
  const byPhone = await api.submitRsvp({ name: 'Priya', phone: '+1 425.555.0199', attending: 'no' });
  assert.equal(byPhone.created, false);
  assert.equal(byPhone.rsvp.token, first.rsvp.token);
  assert.equal(byPhone.rsvp.attending, 'no');
  assert.equal(byPhone.rsvp.adults, 0, '"no" zeroes the headcount');

  // By case-insensitive name when neither has a phone.
  const a = await api.submitRsvp({ name: 'Uncle Joe', attending: 'yes', vote: 'sun' });
  const b = await api.submitRsvp({ name: '  uncle   JOE ', attending: 'maybe', vote: 'shine' });
  assert.equal(b.created, false);
  assert.equal(b.rsvp.token, a.rsvp.token);
  // Same name but a phone this time is a different person.
  const c = await api.submitRsvp({ name: 'Uncle Joe', phone: '2065550000', attending: 'yes', vote: 'sun' });
  assert.equal(c.created, true);

  const sum = await host('summary');
  assert.equal(sum.rsvps.length, 3);

  // The guest link lookup returns the saved RSVP for pre-filling.
  const g = await api.getGuest(first.rsvp.token);
  assert.equal(g.guest.name, 'Priya');
  assert.equal(g.rsvp.attending, 'no');
});

test('validation errors are reported per field', async (t) => {
  await fresh(t);
  const fields = async (data) => {
    try { await api.submitRsvp(data); } catch (err) { assert.equal(err.code, 'invalid'); return err.fields; }
    assert.fail('expected a validation error');
  };

  assert.deepEqual(Object.keys(await fields({})).sort(), ['attending', 'name']);
  assert.ok((await fields(yes({ name: 'x'.repeat(61) }))).name);
  assert.ok((await fields(yes({ attending: 'perhaps' }))).attending);
  assert.ok((await fields(yes({ adults: 21 }))).adults);
  assert.ok((await fields(yes({ kids: -1 }))).kids);
  assert.ok((await fields(yes({ adults: 1.5 }))).adults);
  assert.ok((await fields(yes({ adults: 0, kids: 0 }))).adults);
  assert.ok((await fields(yes({ vote: '' }))).vote, 'vote required when attending');
  assert.ok((await fields(yes({ attending: 'maybe', vote: undefined }))).vote);
  assert.ok((await fields(yes({ vote: 'moon' }))).vote);
  assert.ok((await fields(yes({ wish: 'w'.repeat(501) }))).wish);
  assert.ok((await fields(yes({ baby_name: 'b'.repeat(61) }))).baby_name);
  assert.ok((await fields(yes({ phone: '12-34' }))).phone);

  // Boundaries and "no" without a vote are fine; emoji count as one character.
  const ok = await api.submitRsvp({ name: 'n'.repeat(60), attending: 'no', wish: '💖'.repeat(500) });
  assert.equal(ok.rsvp.vote, '');
  assert.equal(ok.rsvp.adults, 0);
  // Control characters are stripped and whitespace collapsed.
  const clean = await api.submitRsvp(yes({ name: ' Ana\u0000  \tMaria ', phone: '', wish: 'line1\r\n\r\n\r\n\r\nline2' }));
  assert.equal(clean.rsvp.name, 'Ana Maria');
  assert.equal(clean.rsvp.wish, 'line1\n\nline2');

  await rejectsWith(api.getGuest('nope!!'), 'not_found');
  await rejectsWith(api.getGuest('Zz9Zz9Zz'), 'not_found');
});

test('public tally and wishes: first names only, newest first, hidden excluded', async (t) => {
  await fresh(t);
  const r1 = await api.submitRsvp({ name: 'Maya Lin', phone: '4255550001', attending: 'yes', vote: 'sun', wish: 'Sunny days ahead!' });
  await api.submitRsvp({ name: 'Leo Park', phone: '4255550002', attending: 'maybe', vote: 'shine', wish: '=HYPERLINK("http://x")' });
  await api.submitRsvp({ name: 'Ravi', phone: '4255550003', attending: 'yes', vote: 'shine', wish: '' });
  await api.submitRsvp({ name: 'Nora Diaz', phone: '4255550004', attending: 'no', vote: 'shine', wish: 'So sorry to miss it' });

  let pub = await api.getPublic();
  assert.equal(pub.sun, 1);
  assert.equal(pub.shine, 3);
  assert.equal(pub.total, 4);
  assert.deepEqual(pub.wishes.map((w) => w.firstName), ['Nora', 'Leo', 'Maya']);
  assert.equal(pub.wishes[1].text, '=HYPERLINK("http://x")', 'formula-looking text round-trips as plain text');
  assert.equal(pub.wishes[2].vote, 'sun');
  assert.ok(!JSON.stringify(pub).includes('425555'), 'no phone numbers in public data');
  assert.ok(!JSON.stringify(pub).includes('Lin'), 'no last names in public data');

  await host('hideWish', { token: r1.rsvp.token, hidden: true });
  pub = await api.getPublic();
  assert.deepEqual(pub.wishes.map((w) => w.firstName), ['Nora', 'Leo']);
  assert.equal(pub.sun, 1, 'hiding a wish keeps the vote');

  await host('hideWish', { token: r1.rsvp.token, hidden: false });
  assert.equal((await api.getPublic()).wishes.length, 3);
});

test('host: wrong or missing key is unauthorized', async (t) => {
  await fresh(t);
  await rejectsWith(api.host('wrong', 'summary'), 'unauthorized');
  await rejectsWith(api.host('', 'summary'), 'unauthorized');
  await rejectsWith(api.host(HOST_KEY.toUpperCase(), 'getReveal'), 'unauthorized');
  await rejectsWith(host('dance'), 'unknown_op');
  assert.equal((await host('getReveal')).reveal, '');
});

test('host: addGuests dedupes by phone, invite links track opened/texted/rsvped', async (t) => {
  await fresh(t);
  const res = await host('addGuests', {
    guests: [
      { name: 'Asha Menon', phone: '(425) 555-1000' },
      { name: 'Asha M (dup)', phone: '+1 425 555 1000' },
      { name: 'Grandma', phone: '' },
      { name: 'grandma', phone: '' },
      { name: '', phone: '4255551111' },
      { name: 'Ben', phone: '0044 20 7946 0958' },
    ],
  });
  assert.deepEqual(res.guests.map((g) => g.name), ['Asha Menon', 'Grandma', 'Ben']);
  assert.equal(res.guests[2].phone, '442079460958', 'non-US numbers keep their country code');
  for (const g of res.guests) assert.match(g.token, /^[A-Za-z0-9]{8}$/);
  assert.equal(new Set(res.guests.map((g) => g.token)).size, 3);
  assert.deepEqual(res.skipped.map((s) => s.reason), ['duplicate', 'duplicate', 'invalid_name']);
  assert.equal(res.skipped[0].token, res.guests[0].token);

  const again = await host('addGuests', { guests: [{ name: 'Asha', phone: '4255551000' }, { name: 'Kai', phone: '4255552000' }] });
  assert.deepEqual(again.guests.map((g) => g.name), ['Kai']);
  assert.equal(again.skipped[0].reason, 'duplicate');

  const [asha, grandma, ben] = res.guests;
  await host('markTexted', { token: asha.token });
  const view = await api.getGuest(asha.token);
  assert.deepEqual(view, { ok: true, guest: { name: 'Asha Menon' }, rsvp: null });

  // RSVP through the invite link.
  const rs = await api.submitRsvp({ token: asha.token, name: 'Asha', attending: 'yes', adults: 2, vote: 'shine' });
  assert.equal(rs.rsvp.token, asha.token);
  // Ben RSVPs without his link; his phone links him to his invite.
  const benRs = await api.submitRsvp({ name: 'Ben', phone: '+44 20 7946 0958', attending: 'maybe', vote: 'sun' });
  assert.equal(benRs.rsvp.token, ben.token);

  let sum = await host('summary');
  const byName = Object.fromEntries(sum.guests.map((g) => [g.name, g]));
  assert.deepEqual(
    { texted: byName['Asha Menon'].texted, opened: byName['Asha Menon'].opened, rsvped: byName['Asha Menon'].rsvped, attending: byName['Asha Menon'].attending },
    { texted: true, opened: true, rsvped: true, attending: 'yes' });
  assert.deepEqual({ texted: byName.Grandma.texted, opened: byName.Grandma.opened, rsvped: byName.Grandma.rsvped }, { texted: false, opened: false, rsvped: false });
  assert.equal(byName.Ben.rsvped, true);
  assert.ok(sum.rsvps.every((r) => r.invited));

  const openedAt = byName['Asha Menon'].opened_at;
  await api.getGuest(asha.token);
  sum = await host('summary');
  assert.equal(sum.guests.find((g) => g.token === asha.token).opened_at, openedAt, 'opened_at is stamped only once');

  await host('deleteGuest', { token: grandma.token });
  sum = await host('summary');
  assert.deepEqual(sum.guests.map((g) => g.name), ['Asha Menon', 'Ben', 'Kai']);
  await rejectsWith(host('deleteGuest', { token: grandma.token }), 'not_found');
  await rejectsWith(host('markTexted', { token: 'missing1' }), 'not_found');
});

test('host: pool returns only correct guessers who are attending yes/maybe', async (t) => {
  await fresh(t);
  await rejectsWith(host('pool'), 'no_reveal');
  const mk = (name, attending, vote) => api.submitRsvp({ name, attending, vote, adults: attending === 'no' ? 0 : 1 });
  await mk('Sunny Yes', 'yes', 'sun');
  await mk('Sunny Maybe', 'maybe', 'sun');
  await mk('Sunny No', 'no', 'sun');
  await mk('Shiny Yes', 'yes', 'shine');
  await mk('Shiny Maybe', 'maybe', 'shine');
  await mk('No Vote', 'no', '');

  await rejectsWith(host('setReveal', { reveal: 'moon' }), 'invalid');
  assert.equal((await host('setReveal', { reveal: 'sun' })).reveal, 'sun');
  assert.equal((await host('getReveal')).reveal, 'sun');
  let pool = (await host('pool')).pool;
  assert.deepEqual(pool.map((p) => p.name).sort(), ['Sunny Maybe', 'Sunny Yes']);
  assert.ok(pool.every((p) => /^[A-Za-z0-9]{8}$/.test(p.token)));

  await host('setReveal', { reveal: 'shine' });
  pool = (await host('pool')).pool;
  assert.deepEqual(pool.map((p) => p.name).sort(), ['Shiny Maybe', 'Shiny Yes']);

  assert.deepEqual((await host('getWinners')).winners, []);
  const saved = await host('saveWinners', { winners: pool });
  assert.ok(saved.savedAt);
  const got = await host('getWinners');
  assert.deepEqual(got.winners, pool);
  assert.equal(got.savedAt, saved.savedAt);

  await host('setReveal', { reveal: '' });
  await rejectsWith(host('pool'), 'no_reveal');
});

test('host: markTexted can be undone, and winners keep their bonus flag', async (t) => {
  await fresh(t);
  const { guests: [g] } = await host('addGuests', { guests: [{ name: 'Undo Me', phone: '4255553000' }] });
  const marked = await host('markTexted', { token: g.token });
  assert.ok(marked.guest.texted_at, 'texted_at is stamped');
  let sum = await host('summary');
  assert.equal(sum.guests[0].texted, true);

  const undone = await host('markTexted', { token: g.token, texted: false });
  assert.equal(undone.guest.texted_at, '');
  sum = await host('summary');
  assert.equal(sum.guests[0].texted, false, 'Undo clears the texted status');
  await host('markTexted', { token: g.token, texted: true });
  assert.equal((await host('summary')).guests[0].texted, true);

  const winners = [
    { token: 'AAAAaaaa', name: 'Correct Guesser' },
    { token: 'BBBBbbbb', name: 'Bonus Guest', bonus: true },
    { token: 'CCCCcccc', name: 'Not Bonus', bonus: 'yes' },
  ];
  await host('saveWinners', { winners });
  const got = await host('getWinners');
  assert.deepEqual(got.winners, [
    { token: 'AAAAaaaa', name: 'Correct Guesser' },
    { token: 'BBBBbbbb', name: 'Bonus Guest', bonus: true },
    { token: 'CCCCcccc', name: 'Not Bonus' },
  ]);
  await host('saveWinners', { winners: [] });
  assert.deepEqual((await host('getWinners')).winners, [], 'winners can be cleared');
});

test('host: summary headcounts', async (t) => {
  await fresh(t);
  await api.submitRsvp({ name: 'A', attending: 'yes', adults: 2, kids: 2, vote: 'sun' });
  await api.submitRsvp({ name: 'B', attending: 'yes', adults: 1, kids: 0, vote: 'shine' });
  await api.submitRsvp({ name: 'C', attending: 'maybe', adults: 2, kids: 1, vote: 'sun' });
  await api.submitRsvp({ name: 'D', attending: 'no', adults: 5, kids: 5 });
  await api.submitRsvp({ name: 'E', attending: 'yes', kids: 1, vote: 'sun' }); // adults default to 1
  const s = await host('summary');
  assert.deepEqual(s.counts, { yes: 3, maybe: 1, no: 1 });
  assert.equal(s.adults, 4);
  assert.equal(s.kids, 3);
  assert.equal(s.headcount, 7);
  assert.equal(s.maybeHeadcount, 3);
  assert.deepEqual({ sun: s.sun, shine: s.shine }, { sun: 3, shine: 1 });
  assert.equal(s.rsvps.length, 5);
  assert.equal(s.rsvps[0].name, 'E', 'newest first');
  assert.equal(s.rsvps.find((r) => r.name === 'D').adults, 0);
});

test('raw contract: text/plain POST, bad JSON, unknown action, persistence, static files', async (t) => {
  const srv = await fresh(t);
  const post = (body) => fetch(`${srv.url}/api`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });

  let res = await post('{not json');
  assert.equal(res.status, 200, 'errors still come back as HTTP 200, like Apps Script');
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal((await res.json()).error, 'bad_request');
  assert.equal((await (await post(JSON.stringify({ action: 'launch' }))).json()).error, 'unknown_action');
  assert.equal((await (await fetch(`${srv.url}/api?action=launch`)).json()).error, 'unknown_action');

  // Host payload may also be nested under `payload`.
  res = await post(JSON.stringify({ action: 'host', key: HOST_KEY, op: 'addGuests', payload: { guests: [{ name: 'Zed', phone: '4255559999' }] } }));
  const added = await res.json();
  assert.equal(added.ok, true);
  assert.equal(added.guests[0].phone, '4255559999');

  // Persisted atomically to the data file, with no leftover temp files.
  const data = JSON.parse(fs.readFileSync(srv.dataFile, 'utf8'));
  assert.equal(data.sheets.Guests.values[1][1], 'Zed');
  assert.deepEqual(fs.readdirSync(path.dirname(srv.dataFile)).filter((f) => f.endsWith('.tmp')), []);

  // A restarted server sees the same data.
  await srv.close();
  const again = await startServer({ port: 0, hostKey: HOST_KEY, quiet: true, dataFile: srv.dataFile });
  t.after(() => again.close());
  globalThis.location = new URL(`${again.url}/`);
  assert.deepEqual((await host('summary')).guests.map((g) => g.name), ['Zed']);

  res = await fetch(`${again.url}/js/api.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/javascript/);
  assert.equal((await fetch(`${again.url}/../backend/apps-script/Code.gs`)).status, 404);
  assert.equal((await fetch(`${again.url}/%2e%2e/dev/data.json`)).status, 404);
});
