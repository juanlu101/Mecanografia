/* Carga los scripts de la app en un contexto aislado de Node (como si fuera el navegador). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

class FakeStorage {
  constructor() { this.m = new Map(); this.fail = false; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.fail) throw new Error('QuotaExceeded'); this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

/**
 * opts.config: valores que sustituyen a los de CONFIG
 * opts.fetch: función fetch simulada (por defecto, falla como sin conexión)
 * opts.files: scripts a cargar
 */
function loadClient(opts = {}) {
  const storage = opts.storage || new FakeStorage();
  const listeners = {};
  const ctx = {
    console, Math, JSON, Promise, Error, TypeError, SyntaxError, Map, Set, Array, Object, String, Number, RegExp,
    TextEncoder, TextDecoder, Uint8Array, URLSearchParams, AbortController,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    localStorage: storage,
    navigator: { onLine: true },
    setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
    fetch: opts.fetch || (() => Promise.reject(new TypeError('Failed to fetch'))),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    __listeners: listeners
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const files = opts.files || ['js/config.js', 'js/keyboard.js', 'js/lessons.js', 'js/storage.js'];
  for (const f of files) {
    vm.runInContext(read(f), ctx, { filename: f });
    if (f === 'js/config.js' && opts.config) Object.assign(ctx.CONFIG, opts.config);
  }
  ctx.storage = storage;
  return ctx;
}

// Los objetos creados dentro del contexto tienen otros prototipos: se pasan a objetos normales para comparar
const plain = x => JSON.parse(JSON.stringify(x));

/* fetch simulado: responde con lo que devuelva handler({ url, method, body, params }) */
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const call = { url, method: init.method || 'GET', mode: init.mode, body: init.body, params: Object.fromEntries(u.searchParams) };
    calls.push(call);
    const res = await handler(call);
    if (res instanceof Error) throw res;
    return {
      ok: true,
      json: async () => { if (typeof res === 'string') return JSON.parse(res); return res; }
    };
  };
  fn.calls = calls;
  return fn;
}

module.exports = { loadClient, FakeStorage, plain, fakeFetch, ROOT };
