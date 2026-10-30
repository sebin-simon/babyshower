/**
 * Sun or Shine: Google Apps Script backend.
 *
 * Bind this script to the host's (private) Google Sheet and deploy it as a
 * Web app ("Execute as: Me", "Who has access: Anyone"). See SETUP.md.
 *
 * The same file also runs, unmodified, inside dev/mock-server.mjs (with the
 * Apps Script services emulated), so the local mock and production share one
 * implementation of the API contract.
 *
 * ── API contract (every response is JSON; HTTP status is always 200) ───────
 *   GET  ?action=public            → {ok, sun, shine, total, wishes:[{firstName, text, vote}]}
 *   GET  ?action=guest&token=T     → {ok, guest:{name}, rsvp|null}   (stamps opened_at once)
 *   GET  (no action) / ?action=ping → {ok, service, version}
 *   POST {action:'rsvp', token?, name, phone?, attending, adults, kids, vote?, wish?, baby_name?}
 *                                  → {ok, rsvp, created}
 *   POST {action:'host', key, op, ...payload}  → see host_() below
 *   Errors: {ok:false, error:'<code>', message?, fields?}
 *
 * POST bodies arrive as text/plain JSON (the browser sends text/plain so the
 * request is "simple" and skips the CORS preflight that Apps Script can't answer).
 *
 * Written for the V8 runtime. Avoids optional chaining / nullish coalescing
 * to stay safe on older V8 runtime builds.
 */

var VERSION = '1.1.0';

/** Tab name → required header columns (order used when a tab is created). */
var TABS = {
  Guests: ['token', 'name', 'phone', 'added_at', 'texted_at', 'opened_at'],
  RSVPs: ['token', 'name', 'phone', 'attending', 'adults', 'kids', 'vote', 'wish',
          'baby_name', 'hidden', 'created_at', 'updated_at'],
  Meta: ['key', 'value']
};

var LIMITS = {
  name: 60,
  wish: 500,
  babyName: 60,
  countMax: 20,
  phoneMinDigits: 7,
  phoneMaxDigits: 15,
  wishesShown: 200,
  guestsPerBatch: 300,
  winners: 50
};

var ATTENDING = ['yes', 'maybe', 'no'];
var VOTES = ['sun', 'shine'];

var TOKEN_LEN = 8;
// 56 URL-safe characters with look-alikes (0 O o 1 l I) removed, since hosts
// may read links aloud or type them.
var TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

var AUTH_DELAY_MS = 1500;   // pause after a wrong host passcode (slows brute force)
var LOCK_WAIT_MS = 15000;   // how long a write waits for the script lock

/* ═════════════════════════════ Entry points ═════════════════════════════ */

/** Run once from the editor: creates the tabs and a starter host passcode. */
function setup() {
  Object.keys(TABS).forEach(function (name) { table_(name); });
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('HOST_KEY');
  if (!key) {
    key = randomString_(10);
    props.setProperty('HOST_KEY', key);
    console.log('Created HOST_KEY. Your host passcode is: ' + key);
  } else {
    console.log('HOST_KEY already set; left unchanged.');
  }
  console.log('Tabs ready: ' + Object.keys(TABS).join(', ') +
              '. Change the passcode any time in Project Settings → Script Properties → HOST_KEY.');
  return 'ok';
}

function doGet(e) {
  return respond_(function () {
    var p = (e && e.parameter) || {};
    switch (String(p.action || 'ping')) {
      case 'ping': return { ok: true, service: 'sun-or-shine', version: VERSION };
      case 'public': return getPublic_();
      case 'guest': return getGuest_(p.token);
      default: return fail_('unknown_action', 'Unknown action.');
    }
  });
}

function doPost(e) {
  return respond_(function () {
    var body;
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (err) {
      return fail_('bad_request', 'Request body must be JSON.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail_('bad_request', 'Request body must be a JSON object.');
    }
    switch (String(body.action || '')) {
      case 'rsvp': return submitRsvp_(body);
      case 'host': return host_(body);
      default: return fail_('unknown_action', 'Unknown action.');
    }
  });
}

/* ═════════════════════════════ Public actions ═══════════════════════════ */

function getPublic_() {
  var rsvps = table_('RSVPs').rows;
  var sun = 0, shine = 0;
  rsvps.forEach(function (r) {
    if (r.vote === 'sun') sun++;
    else if (r.vote === 'shine') shine++;
  });
  var wishes = rsvps
    .filter(function (r) { return r.wish && !r.hidden; })
    .sort(newestFirst_)
    .slice(0, LIMITS.wishesShown)
    .map(function (r) { return { firstName: firstName_(r.name), text: r.wish, vote: r.vote }; });
  return { ok: true, sun: sun, shine: shine, total: sun + shine, wishes: wishes };
}

function getGuest_(rawToken) {
  var token = cleanToken_(rawToken);
  var notFound = fail_('not_found', "We couldn't find that invite link.");
  if (!token) return notFound;

  var guest = findBy_(table_('Guests').rows, 'token', token);
  var rsvp = findBy_(table_('RSVPs').rows, 'token', token);
  if (!guest && !rsvp) return notFound;

  // Stamp opened_at the first time the link is used. Best effort: if the lock
  // is busy we skip it rather than fail the guest's page load.
  if (guest && !guest.opened_at) {
    withLock_(function () {
      var G = table_('Guests');           // re-read inside the lock
      var g = findBy_(G.rows, 'token', token);
      if (g && !g.opened_at) { g.opened_at = now_(); G.update(g); }
      return { ok: true };
    });
  }

  return {
    ok: true,
    guest: { name: guest ? guest.name : rsvp.name },
    rsvp: rsvp ? guestRsvp_(rsvp) : null
  };
}

/**
 * Create or update an RSVP. Matching order for "is this the same person?":
 *   1. the token (invite link, or a token returned by an earlier RSVP)
 *   2. the normalized phone number
 *   3. case-insensitive name where the phones also match (covers guests who
 *      leave the phone blank and RSVP again under the same name)
 * A row that belongs to a *different* invited guest is never overwritten.
 */
function submitRsvp_(body) {
  var v = validateRsvp_(body);
  if (v.errors) return fail_('invalid', 'Please check the highlighted fields.', { fields: v.errors });
  var f = v.fields;
  var reqToken = cleanToken_(body.token);

  return withLock_(function () {
    var G = table_('Guests');
    var R = table_('RSVPs');

    var guestTokens = indexBy_(G.rows, 'token');
    var rsvpTokens = indexBy_(R.rows, 'token');
    var invite = reqToken ? guestTokens[reqToken] : null;

    // Rows we may update: ours, or rows not owned by some other invited guest.
    var mine = function (r) { return !invite || r.token === reqToken || !guestTokens[r.token]; };
    var nameKey = f.name.toLowerCase();
    var existing =
      (reqToken && rsvpTokens[reqToken]) ||
      (f.phone && R.rows.filter(function (r) { return r.phone === f.phone && mine(r); })[0]) ||
      R.rows.filter(function (r) {
        return r.name.toLowerCase() === nameKey && r.phone === f.phone && mine(r);
      })[0] ||
      null;

    // An invited guest (matched by phone) who has no RSVP yet: lets a guest
    // who RSVPs without their link still show as "RSVP'd" on the host page.
    var phoneInvite = (!invite && f.phone)
      ? G.rows.filter(function (g) { return g.phone === f.phone && !rsvpTokens[g.token]; })[0]
      : null;
    var inviteToken = invite ? reqToken : (phoneInvite ? phoneInvite.token : '');

    var token;
    if (existing) {
      token = existing.token;
      // Adopt the invite token if the row was created without one.
      if (inviteToken && token !== inviteToken && !guestTokens[token]) token = inviteToken;
    } else {
      token = inviteToken;
    }
    if (!token) token = newToken_(Object.assign({}, guestTokens, rsvpTokens));

    var ts = now_();
    var rec = Object.assign(existing || {}, f, {
      token: token,
      hidden: existing ? existing.hidden : false,
      created_at: (existing && existing.created_at) || ts,
      updated_at: ts
    });
    if (existing) R.update(rec); else R.append([rec]);

    return { ok: true, rsvp: guestRsvp_(rec), created: !existing };
  });
}

/** Returns {fields} on success or {errors:{field: message}}. */
function validateRsvp_(b) {
  var errors = {};
  var f = {};

  f.name = cleanText_(b.name, false);
  if (!f.name) errors.name = 'Please tell us your name.';
  else if (charLen_(f.name) > LIMITS.name) errors.name = 'Name must be ' + LIMITS.name + ' characters or fewer.';

  f.attending = String(b.attending == null ? '' : b.attending).trim().toLowerCase();
  if (ATTENDING.indexOf(f.attending) < 0) errors.attending = 'Please choose yes, maybe or no.';
  var coming = f.attending !== 'no';

  f.adults = parseCount_(b.adults, coming ? 1 : 0);
  f.kids = parseCount_(b.kids, 0);
  if (!validCount_(f.adults)) errors.adults = 'Adults must be a whole number from 0 to ' + LIMITS.countMax + '.';
  if (!validCount_(f.kids)) errors.kids = 'Kids must be a whole number from 0 to ' + LIMITS.countMax + '.';
  if (f.attending === 'no') { f.adults = 0; f.kids = 0; }
  else if (!errors.adults && !errors.kids && !errors.attending && f.adults + f.kids < 1) {
    errors.adults = 'Please count at least one person.';
  }

  f.vote = String(b.vote == null ? '' : b.vote).trim().toLowerCase();
  if (f.vote && VOTES.indexOf(f.vote) < 0) errors.vote = 'Please pick Team Sun or Team Shine.';
  else if (!f.vote && coming && !errors.attending) errors.vote = 'Please pick Team Sun or Team Shine.';

  f.wish = cleanText_(b.wish, true);
  if (charLen_(f.wish) > LIMITS.wish) errors.wish = 'Wishes must be ' + LIMITS.wish + ' characters or fewer.';

  f.baby_name = cleanText_(b.baby_name, false);
  if (charLen_(f.baby_name) > LIMITS.babyName) errors.baby_name = 'Name ideas must be ' + LIMITS.babyName + ' characters or fewer.';

  var rawPhone = cleanText_(b.phone, false);
  f.phone = normPhone_(rawPhone);
  if (rawPhone && (f.phone.length < LIMITS.phoneMinDigits || f.phone.length > LIMITS.phoneMaxDigits)) {
    errors.phone = 'Please enter a valid phone number (or leave it blank).';
  }

  return Object.keys(errors).length ? { errors: errors } : { fields: f };
}

/* ═════════════════════════════ Host actions ═════════════════════════════ */

/**
 * POST {action:'host', key, op, ...payload}. Payload fields may also be nested
 * under `payload`. Ops:
 *   summary                          → {counts:{yes,maybe,no}, adults, kids, headcount, maybeHeadcount,
 *                                       sun, shine, reveal, rsvps:[…], guests:[…with texted/opened/rsvped]}
 *   addGuests {guests:[{name,phone}]} → {guests:[added], skipped:[{name,phone,reason,token?}]}
 *   markTexted {token, texted?}      → {guest}   (texted:false clears it, for the host page's Undo)
 *   deleteGuest {token}              → {deleted}   (their RSVP, if any, is kept)
 *   hideWish {token, hidden}         → {rsvp}
 *   setReveal {reveal:'sun'|'shine'|''} / getReveal → {reveal}
 *   saveWinners {winners:[{token,name,bonus?}]} / getWinners → {winners, savedAt}
 *   pool                             → {reveal, pool:[{token,name}]}  (correct guessers, yes/maybe)
 */
function host_(body) {
  var expected = String(PropertiesService.getScriptProperties().getProperty('HOST_KEY') || '').trim();
  if (!expected || !safeEqual_(String(body.key == null ? '' : body.key).trim(), expected)) {
    Utilities.sleep(AUTH_DELAY_MS);
    return fail_('unauthorized', "That passcode didn't work.");
  }
  var p = (body.payload && typeof body.payload === 'object') ? body.payload : body;

  switch (String(body.op || '')) {
    case 'summary': return hostSummary_();
    case 'addGuests': return hostAddGuests_(p.guests);
    case 'markTexted': return hostMarkTexted_(p.token, p.texted);
    case 'deleteGuest': return hostDeleteGuest_(p.token);
    case 'hideWish': return hostHideWish_(p.token, p.hidden);
    case 'setReveal': return hostSetReveal_(p.reveal);
    case 'getReveal': return { ok: true, reveal: getReveal_() };
    case 'saveWinners': return hostSaveWinners_(p.winners);
    case 'getWinners': return hostGetWinners_();
    case 'pool': return hostPool_();
    default: return fail_('unknown_op', 'Unknown host operation.');
  }
}

function hostSummary_() {
  var guests = table_('Guests').rows;
  var rsvps = table_('RSVPs').rows.slice().sort(newestFirst_);
  var guestTokens = indexBy_(guests, 'token');
  var rsvpTokens = indexBy_(rsvps, 'token');

  var counts = { yes: 0, maybe: 0, no: 0 };
  var adults = 0, kids = 0, maybeHeadcount = 0, sun = 0, shine = 0;
  rsvps.forEach(function (r) {
    if (counts.hasOwnProperty(r.attending)) counts[r.attending]++;
    if (r.attending === 'yes') { adults += r.adults; kids += r.kids; }
    if (r.attending === 'maybe') maybeHeadcount += r.adults + r.kids;
    if (r.vote === 'sun') sun++;
    else if (r.vote === 'shine') shine++;
  });

  return {
    ok: true,
    counts: counts,
    adults: adults,
    kids: kids,
    headcount: adults + kids,
    maybeHeadcount: maybeHeadcount,
    sun: sun,
    shine: shine,
    reveal: getReveal_(),
    rsvps: rsvps.map(function (r) {
      var out = hostRsvp_(r);
      out.invited = !!guestTokens[r.token];
      return out;
    }),
    guests: guests.map(function (g) {
      var r = rsvpTokens[g.token];
      var out = publicGuest_(g);
      out.texted = !!g.texted_at;
      out.opened = !!g.opened_at;
      out.rsvped = !!r;
      out.attending = r ? r.attending : '';
      return out;
    })
  };
}

/** Dedupes by normalized phone; guests without a phone dedupe by name. */
function hostAddGuests_(list) {
  if (!Array.isArray(list) || !list.length) return fail_('invalid', 'Send a list of guests.');
  if (list.length > LIMITS.guestsPerBatch) {
    return fail_('invalid', 'Add at most ' + LIMITS.guestsPerBatch + ' guests at a time.');
  }
  return withLock_(function () {
    var G = table_('Guests');
    var R = table_('RSVPs');
    var taken = Object.assign({}, indexBy_(G.rows, 'token'), indexBy_(R.rows, 'token'));
    var byPhone = {}, byName = {};
    G.rows.forEach(function (g) {
      if (g.phone) byPhone[g.phone] = g; else byName[g.name.toLowerCase()] = g;
    });

    var added = [], skipped = [], ts = now_();
    list.forEach(function (item) {
      item = item || {};
      var name = cleanText_(item.name, false);
      var rawPhone = cleanText_(item.phone, false);
      var phone = normPhone_(rawPhone);
      if (!name || charLen_(name) > LIMITS.name) {
        skipped.push({ name: name, phone: phone, reason: 'invalid_name' }); return;
      }
      if (rawPhone && (phone.length < LIMITS.phoneMinDigits || phone.length > LIMITS.phoneMaxDigits)) {
        skipped.push({ name: name, phone: phone, reason: 'invalid_phone' }); return;
      }
      var dupe = phone ? byPhone[phone] : byName[name.toLowerCase()];
      if (dupe) {
        skipped.push({ name: name, phone: phone, reason: 'duplicate', token: dupe.token, existingName: dupe.name });
        return;
      }
      var g = { token: newToken_(taken), name: name, phone: phone, added_at: ts, texted_at: '', opened_at: '' };
      taken[g.token] = g;
      if (phone) byPhone[phone] = g; else byName[name.toLowerCase()] = g;
      added.push(g);
    });

    if (added.length) G.append(added);
    return { ok: true, guests: added.map(publicGuest_), skipped: skipped };
  });
}

/** texted defaults to true; false (or 'false') clears texted_at so the host can undo. */
function hostMarkTexted_(rawToken, texted) {
  var token = cleanToken_(rawToken);
  var clear = texted === false || String(texted).toLowerCase() === 'false';
  return withLock_(function () {
    var G = table_('Guests');
    var g = token && findBy_(G.rows, 'token', token);
    if (!g) return fail_('not_found', "We couldn't find that guest.");
    g.texted_at = clear ? '' : now_();
    G.update(g);
    return { ok: true, guest: publicGuest_(g) };
  });
}

function hostDeleteGuest_(rawToken) {
  var token = cleanToken_(rawToken);
  return withLock_(function () {
    var G = table_('Guests');
    var g = token && findBy_(G.rows, 'token', token);
    if (!g) return fail_('not_found', "We couldn't find that guest.");
    G.remove(g);
    return { ok: true, deleted: token };
  });
}

function hostHideWish_(rawToken, hidden) {
  var token = cleanToken_(rawToken);
  return withLock_(function () {
    var R = table_('RSVPs');
    var r = token && findBy_(R.rows, 'token', token);
    if (!r) return fail_('not_found', "We couldn't find that RSVP.");
    r.hidden = hidden === true || String(hidden).toLowerCase() === 'true';
    R.update(r);
    return { ok: true, rsvp: hostRsvp_(r) };
  });
}

function hostSetReveal_(reveal) {
  var value = String(reveal == null ? '' : reveal).trim().toLowerCase();
  if (value && VOTES.indexOf(value) < 0) return fail_('invalid', "Reveal must be 'sun', 'shine' or ''.");
  return withLock_(function () {
    setMeta_('reveal', value);
    return { ok: true, reveal: value };
  });
}

function hostSaveWinners_(list) {
  if (!Array.isArray(list)) return fail_('invalid', 'Send a list of winners.');
  if (list.length > LIMITS.winners) return fail_('invalid', 'Too many winners.');
  var winners = list.map(function (w) {
    w = w || {};
    var out = { token: cleanToken_(w.token), name: cleanText_(w.name, false).slice(0, LIMITS.name) };
    if (w.bonus === true) out.bonus = true; // drawn in the bonus round (not a correct guesser)
    return out;
  });
  var savedAt = now_();
  return withLock_(function () {
    setMeta_('winners', JSON.stringify(winners));
    setMeta_('winners_saved_at', savedAt);
    return { ok: true, winners: winners, savedAt: savedAt };
  });
}

function hostGetWinners_() {
  var winners = [];
  try { winners = JSON.parse(getMeta_('winners') || '[]'); } catch (err) { winners = []; }
  return { ok: true, winners: Array.isArray(winners) ? winners : [], savedAt: getMeta_('winners_saved_at') };
}

/** Everyone who guessed the revealed team and is attending (yes or maybe). */
function hostPool_() {
  var reveal = getReveal_();
  if (!reveal) return fail_('no_reveal', 'Set the reveal (sun or shine) first.');
  var seen = {};
  var pool = table_('RSVPs').rows
    .filter(function (r) {
      return r.vote === reveal && (r.attending === 'yes' || r.attending === 'maybe');
    })
    .filter(function (r) { return seen[r.token] ? false : (seen[r.token] = true); })
    .map(function (r) { return { token: r.token, name: r.name }; });
  return { ok: true, reveal: reveal, pool: pool };
}

function getReveal_() {
  var v = String(getMeta_('reveal') || '').toLowerCase();
  return VOTES.indexOf(v) >= 0 ? v : '';
}

/* ═════════════════════════════ Sheet access ═════════════════════════════ */

var SS_ = null;
function ss_() {
  if (SS_) return SS_;
  // Optional: set Script Property SHEET_ID to use a standalone (unbound) script.
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  SS_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!SS_) throw new Error('No spreadsheet: bind this script to a Sheet or set SHEET_ID.');
  // First run: create any missing tab (with its header row) up front.
  Object.keys(TABS).forEach(function (name) { if (!SS_.getSheetByName(name)) table_(name); });
  return SS_;
}

/**
 * Loads a tab as records keyed by header name, creating the tab and any
 * missing header columns on first use. Columns are found by header name, so
 * the host may reorder columns or add their own (e.g. "notes"); extra columns
 * are preserved on update.
 *
 * Every row we write is formatted as plain text first ('@') so Sheets never
 * coerces values: phones keep leading zeros, tokens stay strings, timestamps
 * don't turn into Date cells.
 */
function table_(name) {
  var cols = TABS[name];
  var ss = ss_();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var values = (lastRow && lastCol) ? sheet.getRange(1, 1, lastRow, lastCol).getValues() : [];

  var header = (values[0] || []).map(function (h) { return String(h).trim(); });
  while (header.length && !header[header.length - 1]) header.pop();
  var missing = cols.filter(function (c) { return header.indexOf(c) < 0; });
  if (missing.length) {
    header = header.concat(missing);
    sheet.getRange(1, 1, 1, header.length).setNumberFormat('@').setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  var idx = {};
  header.forEach(function (h, i) { if (h && !idx.hasOwnProperty(h)) idx[h] = i; });

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var raw = values[i];
    if (raw.every(function (v) { return v === '' || v == null; })) continue;
    var rec = { _row: i + 1, _raw: raw };
    cols.forEach(function (c) { rec[c] = fromCell_(raw[idx[c]]); });
    rows.push(normalizeRecord_(name, rec));
  }

  function toArray(rec) {
    var arr = header.map(function (_, i) { return rec._raw && i < rec._raw.length ? rec._raw[i] : ''; });
    cols.forEach(function (c) { if (rec.hasOwnProperty(c)) arr[idx[c]] = toCell_(rec[c]); });
    return arr;
  }

  return {
    rows: rows,
    update: function (rec) {
      var arr = toArray(rec);
      sheet.getRange(rec._row, 1, 1, arr.length).setNumberFormat('@').setValues([arr]);
      rec._raw = arr;
    },
    append: function (recs) {
      var arrs = recs.map(toArray);
      var start = sheet.getLastRow() + 1;
      var need = start + arrs.length - 1 - sheet.getMaxRows();
      if (need > 0) sheet.insertRowsAfter(sheet.getMaxRows(), need);
      sheet.getRange(start, 1, arrs.length, header.length).setNumberFormat('@').setValues(arrs);
      recs.forEach(function (rec, i) { rec._row = start + i; rec._raw = arrs[i]; rows.push(rec); });
    },
    remove: function (rec) {
      sheet.deleteRow(rec._row);
      rows.splice(rows.indexOf(rec), 1);
      rows.forEach(function (r) { if (r._row > rec._row) r._row--; });
    }
  };
}

/** Typed, normalized view of a row (tolerates hand edits in the Sheet). */
function normalizeRecord_(tab, r) {
  if (tab === 'Guests' || tab === 'RSVPs') r.phone = normPhone_(r.phone);
  if (tab === 'RSVPs') {
    r.attending = r.attending.toLowerCase();
    r.vote = r.vote.toLowerCase();
    r.adults = Number(r.adults) || 0;
    r.kids = Number(r.kids) || 0;
    r.hidden = r.hidden.toUpperCase() === 'TRUE';
  }
  return r;
}

function fromCell_(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return String(v).trim();
}

function toCell_(v) {
  if (v == null) return '';
  if (v === true) return 'TRUE';
  if (v === false) return '';
  var s = String(v);
  // Formula-injection guard: a leading space stops Sheets treating guest
  // text like "=IMPORTXML(...)" as a formula. fromCell_ trims it on read.
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

function getMeta_(key) {
  var row = findBy_(table_('Meta').rows, 'key', key);
  return row ? row.value : '';
}

/** Caller must hold the lock. */
function setMeta_(key, value) {
  var M = table_('Meta');
  var row = findBy_(M.rows, 'key', key);
  if (row) { row.value = String(value); M.update(row); }
  else M.append([{ key: key, value: String(value) }]);
}

/* ═════════════════════════════ Helpers ══════════════════════════════════ */

function respond_(fn) {
  var out;
  try {
    out = fn();
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    out = { ok: false, error: 'server_error', message: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message, extra) {
  return Object.assign({ ok: false, error: code }, message ? { message: message } : {}, extra || {});
}

/** Runs fn while holding the script-wide lock; returns a 'busy' error on timeout. */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    return fail_('busy', 'Lots of guests at once! Please try again in a few seconds.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function guestRsvp_(r) {
  return {
    token: r.token, name: r.name, phone: r.phone, attending: r.attending,
    adults: r.adults, kids: r.kids, vote: r.vote, wish: r.wish, baby_name: r.baby_name,
    created_at: r.created_at, updated_at: r.updated_at
  };
}

function hostRsvp_(r) {
  var out = guestRsvp_(r);
  out.hidden = !!r.hidden;
  return out;
}

function publicGuest_(g) {
  return {
    token: g.token, name: g.name, phone: g.phone,
    added_at: g.added_at, texted_at: g.texted_at, opened_at: g.opened_at
  };
}

function cleanText_(v, multiline) {
  var s = v == null ? '' : String(v);
  if (s.normalize) s = s.normalize('NFC');
  if (multiline) {
    s = s.replace(/\r\n?/g, '\n')
         .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u2028\u2029]/g, '')
         .replace(/[ \t]+\n/g, '\n')
         .replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, ' ').replace(/\s+/g, ' ');
  }
  return s.trim();
}

/**
 * Digits only, so "(425) 555-0101", "+1 425.555.0101" and "4255550101" match.
 * A "00" international prefix is dropped (0044… ≡ +44…), as is the US "1"
 * on an 11-digit number.
 */
function normPhone_(v) {
  var d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.slice(0, 2) === '00') d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
  return d;
}

function cleanToken_(v) {
  var s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9_-]{4,32}$/.test(s) ? s : '';
}

function parseCount_(v, dflt) {
  if (v === '' || v == null) return dflt;
  var n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

function validCount_(n) {
  return Number.isInteger(n) && n >= 0 && n <= LIMITS.countMax;
}

/** Length in characters (code points), so an emoji counts as one. */
function charLen_(s) { return Array.from(s || '').length; }

function firstName_(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

function now_() { return new Date().toISOString(); }

function newestFirst_(a, b) {
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

function findBy_(rows, field, value) {
  for (var i = 0; i < rows.length; i++) if (rows[i][field] === value) return rows[i];
  return null;
}

function indexBy_(rows, field) {
  var map = {};
  rows.forEach(function (r) { if (r[field]) map[r[field]] = r; });
  return map;
}

/** Unbiased random string from TOKEN_ALPHABET, seeded by Utilities.getUuid(). */
function randomString_(len) {
  var out = '';
  var limit = 256 - (256 % TOKEN_ALPHABET.length); // reject bytes ≥ limit to avoid modulo bias
  while (out.length < len) {
    var hex = Utilities.getUuid().replace(/-/g, '');
    for (var i = 0; i + 1 < hex.length && out.length < len; i += 2) {
      if (i === 12 || i === 16) continue; // skip UUID v4's fixed version/variant bytes
      var b = parseInt(hex.substr(i, 2), 16);
      if (b < limit) out += TOKEN_ALPHABET.charAt(b % TOKEN_ALPHABET.length);
    }
  }
  return out;
}

function newToken_(taken) {
  for (;;) {
    var t = randomString_(TOKEN_LEN);
    if (!taken[t]) return t;
  }
}

/** Comparison whose time doesn't depend on where the strings first differ. */
function safeEqual_(a, b) {
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
