/* =========================================================
   GUARDADO DEL PROGRESO
   1. localStorage (automático, en este navegador)
   2. Código de progreso (para llevarlo a otro ordenador)
   3. Google Sheets (opcional, ver README y CONFIG.SYNC_URL)
   ========================================================= */
(function () {
  const KEY = 'teclea:v1';
  const QUEUE = 'teclea:pendientes';
  const PREFIX = 'TECLEA1.';

  const empty = () => ({ profiles: {}, current: null });

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.profiles) {
        const old = Object.values(d.profiles).some(p => 'pinTxt' in p);
        Object.values(d.profiles).forEach(normalize);
        if (old) save(d); // limpia los PIN en texto que hubiera guardado una versión anterior
        return d;
      }
    } catch (e) { /* sin datos o navegador sin almacenamiento */ }
    return empty();
  }

  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
  }

  function available() {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; }
  }

  function normalize(p) {
    // Versión 2 de las lecciones: el reto final pasó de la lección 26 a la 28
    if (!p.lv) {
      if (p.lessons && p.lessons[26]) { p.lessons[28] = p.lessons[26]; delete p.lessons[26]; }
      p.lv = 2;
    }
    // Versión 3: nueva etapa «Escribir de verdad» (29 y 30); el avanzado pasó de 29-31 a 31-33
    if (p.lv < 3) {
      if (p.lessons) for (const i of [31, 30, 29]) if (p.lessons[i]) { p.lessons[i + 2] = p.lessons[i]; delete p.lessons[i]; }
      p.lv = 3;
    }
    delete p.pinTxt; // el PIN en texto nunca se guarda en el ordenador (versiones anteriores sí lo hacían)
    p.lessons = p.lessons || {};
    p.keys = p.keys || {};
    p.days = p.days || {};
    p.tests = p.tests || [];
    p.writings = p.writings || [];
    p.pts = p.pts || {};
    p.totalSec = p.totalSec || 0;
    p.pin = p.pin || '';
    p.warm = p.warm || '';
    p.settings = Object.assign({ sound: true, kb: true, hands: true }, p.settings);
    return p;
  }

  // El PIN no se guarda tal cual, sino su "huella"
  function hashPin(pin) {
    let h = 0x811c9dc5;
    for (const c of 'teclea:' + String(pin)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  const checkPin = (p, pin) => !p.pin || p.pin === hashPin(pin);

  function newProfile(name, group, pin) {
    return normalize({
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(), group: (group || '').trim(), pin: pin ? hashPin(pin) : '',
      created: Date.now(), lastSeen: Date.now()
    });
  }

  /* --- Días de práctica, racha y objetivo diario --- */
  const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function addPractice(p, secs) {
    const k = dayKey();
    p.days[k] = (p.days[k] || 0) + secs;
    p.totalSec += secs;
  }

  function streak(p) {
    const d = new Date();
    if (!p.days[dayKey(d)]) d.setDate(d.getDate() - 1); // si hoy aún no ha practicado, cuenta desde ayer
    let n = 0;
    while (p.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const todaySec = p => p.days[dayKey()] || 0;

  /* --- Puntos para el ranking semanal ---
     p.pts[día] = [puntos por minutos, puntos extra]. Los de minutos tienen un tope diario. */
  const MAX_MIN_PTS_DAY = 300;
  function addPoints(p, minutePts, bonus) {
    const k = dayKey();
    const a = p.pts[k] || [0, 0];
    const m = Math.max(0, Math.min(minutePts, MAX_MIN_PTS_DAY - a[0]));
    p.pts[k] = [a[0] + m, a[1] + bonus];
    return m + bonus;
  }
  // Lunes de la semana actual
  function weekKey(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return dayKey(x);
  }
  function weekPoints(p) {
    const from = weekKey();
    return Object.entries(p.pts || {}).filter(([d]) => d >= from).reduce((s, [, v]) => s + v[0] + v[1], 0);
  }
  const totalPoints = p => Object.values(p.pts || {}).reduce((s, v) => s + v[0] + v[1], 0);

  /* --- Código de progreso: JSON → base64 seguro para URL --- */
  function toB64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64(b) {
    b = b.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    const bin = atob(b);
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  function exportCode(p) {
    const slim = { lv: p.lv, id: p.id, name: p.name, group: p.group, pin: p.pin, created: p.created, lastSeen: p.lastSeen,
      lessons: p.lessons, keys: p.keys, days: p.days, tests: p.tests, writings: p.writings, pts: p.pts, totalSec: p.totalSec, settings: p.settings };
    return PREFIX + toB64(JSON.stringify(slim));
  }

  function importCode(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code.startsWith(PREFIX)) throw new Error('El código no es válido. Debe empezar por ' + PREFIX);
    let p;
    try { p = JSON.parse(fromB64(code.slice(PREFIX.length))); } catch (e) { throw new Error('El código está incompleto o dañado.'); }
    if (!p || !p.id || !p.name) throw new Error('El código no contiene un perfil.');
    return normalize(p);
  }

  const better = (x, y) => !!x && (!y || x.stars > y.stars || (x.stars === y.stars && x.wpm > y.wpm));

  // Une dos copias del mismo alumno quedándose con lo mejor de cada una
  function merge(a, b) {
    const r = normalize(JSON.parse(JSON.stringify(a)));
    Object.entries(b.lessons || {}).forEach(([id, lb]) => {
      const la = r.lessons[id];
      if (!la) { r.lessons[id] = lb; return; }
      la.passed = la.passed || lb.passed;
      la.attempts = Math.max(la.attempts || 0, lb.attempts || 0);
      la.passes = Math.max(la.passes || 0, lb.passes || 0);
      if (better(lb.best, la.best)) la.best = lb.best;
    });
    Object.entries(b.keys || {}).forEach(([c, kb]) => {
      const ka = r.keys[c] || { h: 0, e: 0 };
      r.keys[c] = { h: Math.max(ka.h, kb.h || 0), e: Math.max(ka.e, kb.e || 0) };
    });
    Object.entries(b.days || {}).forEach(([d, s]) => { r.days[d] = Math.max(r.days[d] || 0, s); });
    Object.entries(b.pts || {}).forEach(([d, v]) => {
      const a = r.pts[d] || [0, 0];
      r.pts[d] = [Math.max(a[0], v[0] || 0), Math.max(a[1], v[1] || 0)];
    });
    const seenW = new Set(r.writings.map(w => w.date));
    (b.writings || []).forEach(w => { if (!seenW.has(w.date)) r.writings.push(w); });
    r.writings = r.writings.sort((x, y) => x.date - y.date).slice(-10);
    const seen = new Set(r.tests.map(t => t.date));
    (b.tests || []).forEach(t => { if (!seen.has(t.date)) r.tests.push(t); });
    r.tests = r.tests.sort((x, y) => x.date - y.date).slice(-30);
    r.totalSec = Math.max(r.totalSec || 0, b.totalSec || 0);
    if (b.pin && (b.lastSeen || 0) > (a.lastSeen || 0)) r.pin = b.pin;
    r.lastSeen = Math.max(r.lastSeen || 0, b.lastSeen || 0);
    return r;
  }

  /* --- Sincronización opcional con Google Sheets --- */
  const readQueue = () => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE)) || [];
      q.forEach(x => { delete x.pinTxt; });
      return q;
    } catch (e) { return []; }
  };
  const writeQueue = q => { try { localStorage.setItem(QUEUE, JSON.stringify(q.slice(-300))); } catch (e) { /* lleno */ } };

  async function getJSON(params, ms = 8000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const url = CONFIG.SYNC_URL + '?' + new URLSearchParams(params).toString();
      const r = await fetch(url, { signal: ctrl.signal });
      return await r.json();
    } finally { clearTimeout(t); }
  }

  let flushing = null, flushAgain = false;

  async function flushQueue() {
    let q = readQueue();
    while (q.length) {
      const item = q[0];
      let saved = false, res = null;
      try {
        res = await fetch(CONFIG.SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item)
        });
      } catch (e) {
        // Fallo de red. Si hay conexión, puede que el navegador no deje leer la respuesta de Google:
        // tras 3 intentos se envía «a ciegas» (como en versiones anteriores) para que no se atasque la cola.
        if (navigator.onLine !== false) {
          item.tries = (item.tries || 0) + 1;
          if (item.tries >= 3) {
            try {
              await fetch(CONFIG.SYNC_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(item) });
              saved = true;
            } catch (e2) { /* sin conexión */ }
          } else writeQueue(readQueue().map(x => (x.envio === item.envio ? item : x)));
        }
      }
      if (res) {
        // Google ha respondido: solo vale si confirma {ok:true}. Una página de error no cuenta como guardado.
        try { const j = await res.json(); saved = !!(j && j.ok); } catch (e) { saved = false; }
      }
      if (!saved) break;
      q = readQueue().filter(x => x.envio !== item.envio);
      writeQueue(q);
    }
  }
  const Sync = {
    enabled: () => !!(window.CONFIG && CONFIG.SYNC_URL),
    pending: () => readQueue().length,

    // Guarda el envío en una cola y la vacía. Si no hay conexión, se reintenta más tarde.
    send(payload) {
      if (!Sync.enabled()) return;
      payload.envio = payload.envio || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const q = readQueue();
      // del mismo alumno solo importa el último código de progreso: se quita de los anteriores
      q.forEach(x => { if (x.id === payload.id) x.codigo = ''; });
      q.push(payload);
      writeQueue(q);
      Sync.flush();
    },

    // Envía la cola de uno en uno. Solo se quita un envío cuando la hoja confirma que lo ha guardado;
    // si Google está saturado o no hay conexión, se queda en la cola y se reintenta más tarde.
    // Si ya se está enviando, devuelve ese mismo envío en curso (así se puede esperar a que acabe).
    // Si llega otra petición mientras tanto, se repasa la cola otra vez al terminar
    // (así no se queda esperando un envío añadido a mitad).
    flush() {
      if (!Sync.enabled()) return Promise.resolve();
      if (flushing) { flushAgain = true; return flushing; }
      flushing = (async () => {
        do { flushAgain = false; await flushQueue(); } while (flushAgain);
      })().finally(() => { flushing = null; });
      return flushing;
    },

    // Busca al alumno por nombre, grupo y PIN.
    // Devuelve { codigo } si lo encuentra, { existe: true } si hay alguien con ese nombre pero otro PIN,
    // { error: true } si no se ha podido consultar la hoja, o null si no hay nadie.
    async find(nombre, grupo, pin) {
      if (!Sync.enabled()) return null;
      try {
        const j = await getJSON({ accion: 'buscar', nombre, grupo: grupo || '', pin: hashPin(pin) });
        if (!j || !j.ok) return { error: true };
        if (j.codigo) return { codigo: j.codigo, sinPin: !!j.sinPin };
        if (j.existe) return { existe: true };
        return null;
      } catch (e) { return { error: true }; } // sin conexión o la hoja no responde
    },

    async ranking(id, grupo) {
      return getJSON({ accion: 'ranking', id, grupo: grupo || '', semana: weekKey() }, 10000);
    },

    async panel(clave) {
      const j = await getJSON({ accion: 'panel', clave }, 15000);
      if (!j || !j.ok) throw new Error(j && j.error === 'clave' ? 'La clave no es correcta.' : 'No se ha podido leer la hoja.');
      return j.alumnos || [];
    },

    // Envía el PIN en texto directamente a la hoja del profesor/a, sin pasar por la cola
    // (la cola se guarda en el ordenador y el PIN no debe quedarse allí).
    // Si no hay conexión, se volverá a enviar la próxima vez que el alumno entre.
    sendPin(p, pin) {
      if (!Sync.enabled() || !pin) return;
      try {
        fetch(CONFIG.SYNC_URL, {
          method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ type: 'pin', id: p.id, nombre: p.name, grupo: p.group, pin: p.pin, pinTxt: String(pin) })
        }).catch(() => {});
      } catch (e) { /* sin conexión */ }
    },

    async getGroups() {
      const j = await getJSON({ accion: 'grupos' }, 6000);
      return j && j.ok && Array.isArray(j.grupos) && j.grupos.length ? j.grupos : null;
    },

    async saveGroups(clave, list) {
      const j = await getJSON({ accion: 'guardargrupos', clave, grupos: JSON.stringify(list) });
      if (!j || !j.ok) throw new Error(j && j.error === 'clave' ? 'La clave no es correcta.' : 'No se han podido guardar los grupos.');
    },

    async resetPin(clave, id) {
      const j = await getJSON({ accion: 'quitarpin', clave, id });
      if (!j || !j.ok) throw new Error('No se ha podido quitar el PIN.');
    }
  };

  /* --- Grupos del desplegable ---
     Con Google Sheets se guardan en la hoja «Grupos»; sin ella, en este navegador. */
  const GKEY = 'teclea:grupos';
  const Groups = {
    get() {
      try { const g = JSON.parse(localStorage.getItem(GKEY)); if (Array.isArray(g) && g.length) return g; } catch (e) { /* nada */ }
      return (window.CONFIG && CONFIG.GROUPS) || [];
    },
    // Trae la lista de la hoja. Devuelve true si ha cambiado.
    async refresh() {
      if (!Sync.enabled()) return false;
      try {
        const g = await Sync.getGroups();
        if (!g) return false;
        const changed = JSON.stringify(g) !== JSON.stringify(Groups.get());
        try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch (e) { /* nada */ }
        return changed;
      } catch (e) { return false; }
    },
    async save(list, clave) {
      list = [...new Set(list.map(g => String(g).trim().replace(/\s+/g, ' ')).filter(Boolean))];
      if (Sync.enabled()) await Sync.saveGroups(clave, list);
      try { localStorage.setItem(GKEY, JSON.stringify(list)); } catch (e) { /* nada */ }
      return list;
    }
  };

  window.addEventListener('online', () => Sync.flush());
  setInterval(() => { if (readQueue().length) Sync.flush(); }, 60000);

  window.Store = { load, save, available, newProfile, normalize, exportCode, importCode, merge,
    hashPin, checkPin, addPractice, streak, todaySec, dayKey, addPoints, weekKey, weekPoints, totalPoints };
  window.Sync = Sync;
  window.Groups = Groups;
})();
