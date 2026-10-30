#!/usr/bin/env node
/**
 * Local dev server for the Sun or Shine site. Zero dependencies, Node 20+.
 *
 *   npm run dev            → http://localhost:5173
 *   PORT=8080 HOST_KEY=secret npm run dev
 *   BIND=0.0.0.0 npm run dev   (to open it from a phone on the same Wi-Fi)
 *
 * - Serves ../site statically.
 * - Serves the API at /api with the exact contract of the Apps Script web app:
 *   it executes backend/apps-script/Code.gs itself in a node:vm sandbox, with
 *   SpreadsheetApp, PropertiesService, LockService, ContentService and
 *   Utilities emulated. So the mock can't drift from production, and the
 *   tests exercise the real backend code. Code.gs is reloaded when it changes.
 * - "Sheets" persist to dev/data.json (atomic write: temp file + rename).
 *
 * Env: PORT (5173), BIND (127.0.0.1), HOST_KEY (letmein), DATA_FILE (dev/data.json),
 *      MOCK_LATENCY_MS (0) adds a delay to /api calls to preview loading states.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEV_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DEV_DIR, '..');
const SITE_DIR = path.join(ROOT, 'site');
const CODE_GS = path.join(ROOT, 'backend', 'apps-script', 'Code.gs');
const MAX_BODY = 1024 * 1024;
const DEFAULT_MAX_ROWS = 1000; // a new Google Sheet tab has 1000 rows

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.ics': 'text/calendar; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

/* ─────────────────────────── Persistent store ─────────────────────────── */

/** data.json shape: { sheets: { [tab]: { maxRows, values: string[][] } } } */
function createStore(file) {
  let data = { sheets: {} };
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!data || typeof data.sheets !== 'object') throw new Error('missing "sheets"');
    } catch (err) {
      const backup = `${file}.corrupt-${Date.now()}`;
      fs.renameSync(file, backup);
      console.warn(`[mock] ${path.basename(file)} was unreadable (${err.message}); moved to ${backup}`);
      data = { sheets: {} };
    }
  }
  let dirty = false;
  return {
    data,
    markDirty() { dirty = true; },
    flush() {
      if (!dirty) return;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file); // atomic on the same filesystem
      dirty = false;
    },
  };
}

/* ─────────────────────── Apps Script service fakes ────────────────────── */
// Only the subset of each API that Code.gs uses, with the same semantics
// (1-based rows/cols, bounds errors, getLastRow ignoring empty rows).

function createGasServices(store, { hostKey, authDelayMs }) {
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const isEmpty = (v) => v === '' || v == null;

  class Range {
    constructor(sheet, row, col, numRows, numCols) {
      if (row < 1 || col < 1 || numRows < 1 || numCols < 1) throw new Error('Range coordinates are invalid.');
      if (row + numRows - 1 > sheet._t.maxRows) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      Object.assign(this, { sheet, row, col, numRows, numCols });
    }
    getValues() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const src = this.sheet._t.values[this.row - 1 + r] || [];
        const line = [];
        for (let c = 0; c < this.numCols; c++) {
          const v = src[this.col - 1 + c];
          line.push(v == null ? '' : v);
        }
        out.push(line);
      }
      return out;
    }
    setValues(values) {
      if (!Array.isArray(values) || values.length !== this.numRows ||
          values.some((line) => !Array.isArray(line) || line.length !== this.numCols)) {
        throw new Error(`The number of rows or columns in the data does not match the range (${this.numRows}x${this.numCols}).`);
      }
      const grid = this.sheet._t.values;
      values.forEach((line, r) => {
        const idx = this.row - 1 + r;
        while (grid.length <= idx) grid.push([]);
        line.forEach((v, c) => {
          // Cells are plain-text formatted by Code.gs, so store strings as Sheets would.
          grid[idx][this.col - 1 + c] = v == null ? '' : typeof v === 'string' ? v : String(v);
        });
      });
      store.markDirty();
      return this;
    }
    setNumberFormat() { return this; }
    setFontWeight() { return this; }
  }

  class Sheet {
    constructor(name) { this.name = name; }
    get _t() { return store.data.sheets[this.name]; }
    getName() { return this.name; }
    getMaxRows() { return this._t.maxRows; }
    getLastRow() {
      const v = this._t.values;
      for (let i = v.length - 1; i >= 0; i--) if (v[i] && v[i].some((x) => !isEmpty(x))) return i + 1;
      return 0;
    }
    getLastColumn() {
      let max = 0;
      for (const line of this._t.values) {
        if (!line) continue;
        for (let c = line.length - 1; c >= max; c--) if (!isEmpty(line[c])) { max = c + 1; break; }
      }
      return max;
    }
    getRange(row, col, numRows = 1, numCols = 1) { return new Range(this, row, col, numRows, numCols); }
    getDataRange() {
      return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
    }
    insertRowsAfter(after, howMany) {
      const v = this._t.values;
      if (after < v.length) v.splice(after, 0, ...Array.from({ length: howMany }, () => []));
      this._t.maxRows += howMany;
      store.markDirty();
      return this;
    }
    deleteRow(row) {
      if (row < 1 || row > this._t.maxRows) throw new Error('Those rows are out of bounds.');
      this._t.values.splice(row - 1, 1);
      this._t.maxRows -= 1;
      store.markDirty();
      return this;
    }
    setFrozenRows() { return this; }
  }

  const spreadsheet = {
    getSheetByName(name) { return store.data.sheets[name] ? new Sheet(name) : null; },
    insertSheet(name) {
      if (store.data.sheets[name]) throw new Error(`A sheet with the name "${name}" already exists.`);
      store.data.sheets[name] = { maxRows: DEFAULT_MAX_ROWS, values: [] };
      store.markDirty();
      return new Sheet(name);
    },
    getSheets() { return Object.keys(store.data.sheets).map((n) => new Sheet(n)); },
  };

  // Script Properties live in memory; HOST_KEY always comes from the env.
  const props = { HOST_KEY: hostKey };
  const scriptProperties = {
    getProperty: (k) => (Object.hasOwn(props, k) ? props[k] : null),
    setProperty(k, v) { props[k] = String(v); return this; },
    getProperties: () => ({ ...props }),
  };

  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => scriptProperties },
    // Node handles one request at a time and Code.gs is synchronous, so the lock is trivially free.
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {}, hasLock: () => true }) },
    ContentService: {
      MimeType: { JSON: 'application/json', TEXT: 'text/plain' },
      createTextOutput(content = '') {
        return {
          content, mimeType: 'text/plain',
          setMimeType(m) { this.mimeType = m; return this; },
          getContent() { return this.content; },
          getMimeType() { return this.mimeType; },
        };
      },
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      // Synchronous like the real one; capped so dev/tests stay snappy.
      sleep: (ms) => Atomics.wait(sleeper, 0, 0, Math.max(0, Math.min(ms, authDelayMs))),
    },
    Logger: { log: (...a) => console.log('[Code.gs]', ...a) },
  };
}

/** Loads Code.gs into a fresh sandbox, re-loading whenever the file changes. */
function createBackend(store, opts) {
  let loaded = null;
  return () => {
    const mtime = fs.statSync(CODE_GS).mtimeMs;
    if (!loaded || loaded.mtime !== mtime) {
      const quietConsole = opts.quiet ? { ...console, log() {}, error() {}, warn() {} } : console;
      const ctx = vm.createContext({ ...createGasServices(store, opts), console: quietConsole });
      vm.runInContext(fs.readFileSync(CODE_GS, 'utf8'), ctx, { filename: CODE_GS });
      if (loaded && !opts.quiet) console.log('[mock] Code.gs changed; reloaded');
      loaded = { mtime, ctx };
    }
    return loaded.ctx;
  };
}

/* ─────────────────────────────── HTTP ─────────────────────────────────── */

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url, { getBackend, store, latencyMs }) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  const parameter = Object.fromEntries(url.searchParams);
  const parameters = {};
  for (const [k, v] of url.searchParams) (parameters[k] ||= []).push(v);
  const e = { parameter, parameters, queryString: url.search.slice(1), contentLength: -1 };

  if (req.method === 'POST') {
    const contents = await readBody(req);
    e.contentLength = Buffer.byteLength(contents);
    e.postData = { contents, length: e.contentLength, type: req.headers['content-type'] || '', name: 'postData' };
  }
  if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));

  const ctx = getBackend();
  const output = req.method === 'GET' ? ctx.doGet(e) : ctx.doPost(e);
  store.flush();
  // Like Apps Script: always HTTP 200; errors are reported in the JSON body.
  res.writeHead(200, { 'Content-Type': `${output.getMimeType()}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(output.getContent());
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end();
  }
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  let file = path.resolve(SITE_DIR, '.' + path.posix.normalize('/' + rel));
  if (file !== SITE_DIR && !file.startsWith(SITE_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end(`Not found: ${url.pathname}`);
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st2.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}

/**
 * Starts the server. Resolves to { server, port, url, close() }.
 * Used by `npm run dev` and by api.test.mjs (with port 0 and a temp data file).
 */
export async function startServer({
  port = Number(process.env.PORT ?? 5173),
  bind = process.env.BIND || '127.0.0.1',
  hostKey = process.env.HOST_KEY || 'letmein',
  dataFile = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(DEV_DIR, 'data.json'),
  latencyMs = Number(process.env.MOCK_LATENCY_MS || 0),
  authDelayMs = 300,
  quiet = false,
} = {}) {
  const store = createStore(dataFile);
  const getBackend = createBackend(store, { hostKey, authDelayMs, quiet });
  getBackend(); // fail fast if Code.gs has a syntax error

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api' || url.pathname === '/api/') {
        await handleApi(req, res, url, { getBackend, store, latencyMs });
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      if (!quiet) console.error('[mock]', err);
      if (!res.headersSent) sendJson(res, err.status || 500, { ok: false, error: 'server_error', message: err.message });
      else res.end();
    }
    if (!quiet && url.pathname.startsWith('/api')) {
      console.log(`[mock] ${req.method} ${url.pathname}${url.search}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, bind, resolve);
  });
  const actualPort = server.address().port;
  return {
    server,
    port: actualPort,
    url: `http://${bind === '0.0.0.0' ? 'localhost' : bind}:${actualPort}`,
    dataFile,
    close: () => new Promise((r) => server.close(r)),
  };
}

// Run directly (npm run dev), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { port, dataFile } = await startServer();
  const url = `http://localhost:${port}`;
  const key = process.env.HOST_KEY || 'letmein';
  console.log(`\n  Sun or Shine dev server\n  Site:  ${url}/\n  API:   ${url}/api\n  Data:  ${dataFile}\n  Host passcode: ${key}\n`);
}
