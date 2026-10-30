/**
 * Site configuration. Everything here is PUBLIC (GitHub Pages serves it to
 * anyone), so never put secrets in this file. The host passcode lives only in
 * the Apps Script project's Script Properties.
 */

// Paste the Apps Script web app URL (ends in /exec) here after deploying.
// See backend/apps-script/SETUP.md.
const apiUrl = '';

/**
 * 'local'       → the dev mock server at /api (npm run dev in dev/)
 * 'apps-script' → the deployed Google Apps Script web app at apiUrl
 *
 * Local is used when apiUrl is empty or the page is served from localhost.
 * To hit the real backend from localhost, open the page with ?backend=apps-script.
 */
function pickBackend(url) {
  if (!url) return 'local';
  const loc = typeof location !== 'undefined' ? location : null;
  if (loc && new URLSearchParams(loc.search).get('backend') === 'apps-script') return 'apps-script';
  const host = loc ? loc.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' ||
    host.endsWith('.localhost');
  return isLocal ? 'local' : 'apps-script';
}

export const CONFIG = Object.freeze({
  hosts: 'Ayana & Sebin',

  // Saturday, November 7, 2026, 12:00 PM Pacific. PST applies (DST ends Nov 1), so -08:00.
  date: '2026-11-07T12:00:00-08:00',
  timeZone: 'America/Los_Angeles',
  // Assumed 3-hour party for calendar invites; adjust if the hosts give an end time.
  endDate: '2026-11-07T14:00:00-08:00',

  venue: 'eaves Redmond Campus',
  address: '15606 NE 40th St, Bldg Z, Redmond, WA',

  siteUrl: '', // public site URL, e.g. https://<user>.github.io/<repo>/ (fill in after deploy)
  apiUrl,
  backend: pickBackend(apiUrl),

  winnersDefault: 5,
});
