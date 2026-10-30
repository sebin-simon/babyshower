/**
 * Client API adapter. One contract, two backends (chosen by CONFIG.backend):
 *   'apps-script' → CONFIG.apiUrl (the Google Apps Script /exec URL)
 *   'local'       → /api on the dev mock server (dev/mock-server.mjs)
 *
 * GETs send query params. POSTs send a JSON body as text/plain: that keeps
 * the request a CORS "simple request", so the browser doesn't send a preflight
 * OPTIONS, which Apps Script can't answer. Apps Script replies with a 302 to
 * script.googleusercontent.com; fetch follows it (redirect: 'follow').
 *
 * Every function resolves with the parsed `{ok:true, …}` response, or rejects
 * with an ApiError whose `message` is safe to show to guests. For validation
 * failures, `err.fields` maps field name → message.
 *
 * Guest-supplied text (names, wishes) must be rendered with textContent,
 * never innerHTML.
 */
import { CONFIG } from './config.js';

const GET_TIMEOUT_MS = 15000;  // Apps Script cold starts can take several seconds
const POST_TIMEOUT_MS = 25000;
const GET_RETRIES = 1;
const RETRY_DELAY_MS = 800;

const MESSAGES = {
  network: "We couldn't reach the party server. Please check your connection and try again.",
  timeout: 'The party server is taking a while to answer. Please try again in a moment.',
  bad_response: 'The party server sent an unexpected reply. Please try again later.',
  not_configured: "The RSVP service isn't connected yet. Please try again later.",
  http_error: 'Something went wrong reaching the party server. Please try again.',
  invalid: 'Please check the highlighted fields.',
  unauthorized: "That passcode didn't work.",
  not_found: "We couldn't find that invite link, but you can still RSVP below!",
  busy: 'Lots of guests at once! Please try again in a few seconds.',
  no_reveal: 'Choose Sun or Shine first.',
  server_error: 'Something went wrong on our side. Please try again.',
};

export class ApiError extends Error {
  /**
   * @param {string} code  machine-readable (e.g. 'invalid', 'unauthorized', 'network')
   * @param {string} message  friendly text for guests
   * @param {{fields?: object, detail?: string, status?: number, retryable?: boolean}} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = extra.fields || null;
    this.detail = extra.detail || '';
    this.status = extra.status || 0;
    this.retryable = !!extra.retryable;
  }
}

const friendly = (code, fallback) => MESSAGES[code] || fallback || MESSAGES.server_error;

function endpoint() {
  if (CONFIG.backend === 'local') return new URL('/api', location.origin).href;
  if (!CONFIG.apiUrl) throw new ApiError('not_configured', friendly('not_configured'));
  return CONFIG.apiUrl;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function requestOnce(method, data, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const init = { method, redirect: 'follow', cache: 'no-store', credentials: 'omit', signal: ctrl.signal };
  let url = endpoint();

  if (method === 'GET') {
    const u = new URL(url);
    for (const [k, v] of Object.entries(data)) if (v != null) u.searchParams.set(k, String(v));
    url = u.href;
  } else {
    init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    init.body = JSON.stringify(data);
  }

  let res, text;
  try {
    res = await fetch(url, init);
    text = await res.text();
  } catch (err) {
    const code = ctrl.signal.aborted ? 'timeout' : 'network';
    throw new ApiError(code, friendly(code), { detail: String(err && err.message), retryable: true });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const code = res.status === 404 ? 'not_configured' : 'http_error';
    throw new ApiError(code, friendly(code), {
      status: res.status, detail: text.slice(0, 200), retryable: res.status >= 500 || res.status === 429,
    });
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // Usually an HTML page from Google: the deployment isn't set to
    // "Who has access: Anyone", or the URL isn't the /exec one.
    console.warn('[api] Non-JSON response. Check the Apps Script deployment access and URL.', text.slice(0, 200));
    throw new ApiError('bad_response', friendly('bad_response'), { detail: text.slice(0, 200) });
  }

  if (!json || json.ok !== true) {
    const code = (json && json.error) || 'server_error';
    throw new ApiError(code, friendly(code, json && json.message), {
      fields: json && json.fields, detail: (json && json.message) || '', retryable: code === 'busy',
    });
  }
  return json;
}

async function request(method, data) {
  const isGet = method === 'GET';
  const retries = isGet ? GET_RETRIES : 0; // POSTs aren't retried: they may not be idempotent
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(method, data, isGet ? GET_TIMEOUT_MS : POST_TIMEOUT_MS);
    } catch (err) {
      if (attempt < retries && err instanceof ApiError && err.retryable) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
}

/** Live tally and wishes wall: {ok, sun, shine, total, wishes:[{firstName, text, vote}]} */
export function getPublic() {
  return request('GET', { action: 'public' });
}

/** Personal invite lookup: {ok, guest:{name}, rsvp|null}. Rejects with code 'not_found'. */
export function getGuest(token) {
  return request('GET', { action: 'guest', token });
}

/**
 * Create or update an RSVP.
 * @param {{token?, name, phone?, attending:'yes'|'maybe'|'no', adults?, kids?, vote?:'sun'|'shine', wish?, baby_name?}} data
 * @returns {Promise<{ok, rsvp, created}>} keep `rsvp.token` (e.g. in localStorage) so the guest can edit later.
 */
export function submitRsvp(data) {
  return request('POST', { ...data, action: 'rsvp' });
}

/**
 * Host operations (passcode-gated). op: summary | addGuests | markTexted | deleteGuest |
 * hideWish | setReveal | getReveal | saveWinners | getWinners | pool
 */
export function host(key, op, payload = {}) {
  return request('POST', { ...payload, action: 'host', key, op });
}
