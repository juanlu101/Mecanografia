const test = require('node:test');
const assert = require('node:assert/strict');
const { loadClient, plain, fakeFetch } = require('../helpers/load-client');

const URL_ = 'https://script.google.com/macros/s/X/exec';
const withServer = handler => {
  const fetch = fakeFetch(handler);
  const c = loadClient({ config: { SYNC_URL: URL_ }, fetch });
  return { c, fetch };
};
const queue = c => JSON.parse(c.storage.getItem('teclea:pendientes') || '[]');
const tick = () => new Promise(r => setTimeout(r, 0));

test('sin SYNC_URL no se envía nada ni se usa la cola', async () => {
  const fetch = fakeFetch(() => ({ ok: true }));
  const c = loadClient({ fetch });
  assert.equal(c.Sync.enabled(), false);
  c.Sync.send({ id: 'a' });
  c.Sync.sendPin({ id: 'a' }, '12345');
  assert.equal(await c.Sync.find('a', 'b', '1'), null);
  assert.equal(fetch.calls.length, 0);
  assert.equal(c.Sync.pending(), 0);
});

test('envío confirmado por la hoja: se quita de la cola', async () => {
  const { c, fetch } = withServer(() => ({ ok: true }));
  c.Sync.send({ type: 'result', id: 'a', codigo: 'X' });
  await c.Sync.flush(); await tick();
  assert.equal(c.Sync.pending(), 0);
  assert.equal(fetch.calls[0].method, 'POST');
  assert.notEqual(fetch.calls[0].mode, 'no-cors', 'debe poder leer la respuesta');
  const body = JSON.parse(fetch.calls[0].body);
  assert.ok(body.envio, 'cada envío lleva un identificador para no duplicarlo');
});

test('la hoja contesta ok:false (Google ocupado): se queda en la cola', async () => {
  let ok = false;
  const { c } = withServer(() => ({ ok }));
  c.Sync.send({ type: 'result', id: 'a' });
  await c.Sync.flush();
  assert.equal(c.Sync.pending(), 1);
  ok = true;
  await c.Sync.flush();
  assert.equal(c.Sync.pending(), 0);
});

test('sin conexión: se queda en la cola y no se envía a ciegas', async () => {
  const { c, fetch } = withServer(() => new TypeError('Failed to fetch'));
  c.navigator.onLine = false;
  c.Sync.send({ type: 'result', id: 'a' });
  for (let i = 0; i < 5; i++) await c.Sync.flush();
  assert.equal(c.Sync.pending(), 1);
  assert.ok(fetch.calls.every(x => x.mode !== 'no-cors'));
});

test('si Google devuelve una página de error (no JSON), el resultado NO se da por enviado', async () => {
  const { c } = withServer(() => '<html>Service invoked too many times</html>');
  c.Sync.send({ type: 'result', id: 'a' });
  for (let i = 0; i < 6; i++) await c.Sync.flush();
  assert.equal(c.Sync.pending(), 1, 'debe seguir pendiente hasta que la hoja confirme');
});

test('si el navegador no deja leer la respuesta (fallo de red con conexión), tras 3 intentos se envía a ciegas', async () => {
  const { c, fetch } = withServer(call => (call.mode === 'no-cors' ? { ok: true } : new TypeError('CORS')));
  c.Sync.send({ type: 'result', id: 'a' });
  for (let i = 0; i < 5 && c.Sync.pending(); i++) await c.Sync.flush();
  assert.equal(c.Sync.pending(), 0);
  assert.equal(fetch.calls.filter(x => x.mode !== 'no-cors').length, 3, 'tres intentos normales');
  assert.equal(fetch.calls.filter(x => x.mode === 'no-cors').length, 1, 'y uno a ciegas');
});

test('la cola mantiene el orden y solo el último envío de cada alumno lleva el código de progreso', async () => {
  const { c } = withServer(() => ({ ok: false }));
  c.Sync.send({ type: 'result', id: 'a', codigo: 'C1' });
  c.Sync.send({ type: 'result', id: 'b', codigo: 'B1' });
  c.Sync.send({ type: 'result', id: 'a', codigo: 'C2' });
  await tick();
  const q = queue(c);
  assert.deepEqual(q.map(x => x.codigo), ['', 'B1', 'C2']);
});

test('la cola nunca guarda el PIN en texto y no pasa de 300 envíos', async () => {
  const { c } = withServer(() => ({ ok: false }));
  c.storage.setItem('teclea:pendientes', JSON.stringify([{ id: 'a', envio: 'x', pinTxt: '12345' }]));
  for (let i = 0; i < 310; i++) c.Sync.send({ id: 'z' + i });
  await tick();
  const raw = c.storage.getItem('teclea:pendientes');
  assert.ok(!raw.includes('12345'));
  assert.equal(queue(c).length, 300);
});

test('dos flush a la vez no envían el mismo resultado dos veces', async () => {
  let n = 0;
  const { c } = withServer(async () => { n++; await new Promise(r => setTimeout(r, 5)); return { ok: true }; });
  c.storage.setItem('teclea:pendientes', JSON.stringify([{ id: 'a', envio: 'e1' }]));
  await Promise.all([c.Sync.flush(), c.Sync.flush(), c.Sync.flush()]);
  assert.equal(n, 1);
});

test('al recuperar la conexión se vacía la cola', async () => {
  const { c } = withServer(() => ({ ok: true }));
  c.storage.setItem('teclea:pendientes', JSON.stringify([{ id: 'a', envio: 'e1' }]));
  c.__listeners.online.forEach(fn => fn());
  await new Promise(r => setTimeout(r, 10));
  assert.equal(c.Sync.pending(), 0);
});

test('sendPin: envía el PIN en texto directamente, sin guardarlo en la cola', async () => {
  const { c, fetch } = withServer(() => ({ ok: true }));
  const p = c.Store.newProfile('Ana', 'G', '24680');
  c.Sync.sendPin(p, '24680');
  await tick();
  assert.equal(fetch.calls.length, 1);
  const body = JSON.parse(fetch.calls[0].body);
  assert.deepEqual([body.type, body.pinTxt, body.id, body.pin], ['pin', '24680', p.id, p.pin]);
  assert.equal(c.Sync.pending(), 0);
  assert.ok(!(c.storage.getItem('teclea:pendientes') || '').includes('24680'));
});

test('find: interpreta todas las respuestas de la hoja', async () => {
  let reply;
  const { c, fetch } = withServer(() => reply);
  reply = { ok: true, codigo: 'TECLEA1.x', sinPin: false };
  assert.deepEqual(plain(await c.Sync.find('Ana', 'G', '12345')), { codigo: 'TECLEA1.x', sinPin: false });
  assert.equal(fetch.calls[0].params.pin, c.Store.hashPin('12345'), 'se envía la huella, no el PIN');
  assert.equal(fetch.calls[0].params.accion, 'buscar');
  reply = { ok: true, codigo: null, existe: true };
  assert.deepEqual(plain(await c.Sync.find('Ana', 'G', '1')), { existe: true });
  reply = { ok: true, codigo: null, existe: false };
  assert.equal(await c.Sync.find('Ana', 'G', '1'), null);
  reply = { ok: false };
  assert.deepEqual(plain(await c.Sync.find('Ana', 'G', '1')), { error: true });
  reply = new TypeError('offline');
  assert.deepEqual(plain(await c.Sync.find('Ana', 'G', '1')), { error: true }, 'sin conexión es un error, no «no existe»');
  reply = '<html>';
  assert.deepEqual(plain(await c.Sync.find('Ana', 'G', '1')), { error: true });
});

test('panel: clave incorrecta y error de lectura dan mensajes distintos', async () => {
  let reply;
  const { c } = withServer(() => reply);
  reply = { ok: false, error: 'clave' };
  await assert.rejects(c.Sync.panel('x'), /clave no es correcta/);
  reply = { ok: false };
  await assert.rejects(c.Sync.panel('x'), /No se ha podido leer/);
  reply = { ok: true, alumnos: [{ id: 'a' }] };
  assert.equal((await c.Sync.panel('x')).length, 1);
});

test('ranking: pide la semana actual (lunes) y el grupo del alumno', async () => {
  const { c, fetch } = withServer(() => ({ ok: true }));
  await c.Sync.ranking('p1', '1º ESO A');
  assert.deepEqual(fetch.calls[0].params, { accion: 'ranking', id: 'p1', grupo: '1º ESO A', semana: c.Store.weekKey() });
});

test('grupos: por defecto los 18 de config; se actualizan desde la hoja y se guardan limpios', async () => {
  let reply = { ok: true, grupos: null };
  const { c, fetch } = withServer(() => reply);
  assert.equal(c.Groups.get().length, 18);
  assert.equal(c.Groups.get()[0], '1º ESO A');
  assert.equal(c.Groups.get().at(-1), '2º Bach C');
  assert.equal(await c.Groups.refresh(), false, 'la hoja aún no tiene grupos');
  reply = { ok: true, grupos: ['A', 'B'] };
  assert.equal(await c.Groups.refresh(), true);
  assert.deepEqual(plain(c.Groups.get()), ['A', 'B']);
  assert.equal(await c.Groups.refresh(), false, 'sin cambios');
  reply = { ok: true };
  const saved = await c.Groups.save(['  3º ESO D ', 'A', 'A', '', '1º  ESO   A'], 'clave');
  assert.deepEqual(plain(saved), ['3º ESO D', 'A', '1º ESO A']);
  const call = fetch.calls.at(-1);
  assert.equal(call.params.accion, 'guardargrupos');
  assert.deepEqual(JSON.parse(call.params.grupos), ['3º ESO D', 'A', '1º ESO A']);
  reply = { ok: false, error: 'clave' };
  await assert.rejects(c.Groups.save(['X'], 'mal'), /clave/);
  assert.deepEqual(plain(c.Groups.get()), ['3º ESO D', 'A', '1º ESO A'], 'si falla no cambia la lista');
});

test('grupos sin Google Sheets: se guardan solo en el navegador', async () => {
  const c = loadClient();
  await c.Groups.save(['X', 'Y'], '');
  assert.deepEqual(plain(c.Groups.get()), ['X', 'Y']);
  assert.equal(await c.Groups.refresh(), false);
});

test('un envío añadido mientras se comprueba la cola no se queda esperando', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  let first = true;
  const { c } = withServer(async () => { if (first) { first = false; await gate; } return { ok: true }; });
  c.storage.setItem('teclea:pendientes', JSON.stringify([{ id: 'a', envio: 'e1' }]));
  const running = c.Sync.flush();          // primer envío, todavía sin respuesta
  c.Sync.send({ id: 'b' });                // llega otro mientras tanto
  release();
  await running;
  assert.equal(c.Sync.pending(), 0, 'los dos deben quedar enviados');
});

test('una cola vacía en marcha no bloquea el envío que llega justo después', async () => {
  const { c } = withServer(() => ({ ok: true }));
  const p = c.Sync.flush();                // cola vacía (como al abrir el mapa)
  c.Sync.send({ id: 'nuevo' });            // el perfil recién creado
  await p;
  assert.equal(c.Sync.pending(), 0);
});
