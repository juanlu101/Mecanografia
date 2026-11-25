const test = require('node:test');
const assert = require('node:assert/strict');
const { loadClient, plain } = require('../helpers/load-client');

const fresh = () => loadClient();
const daysAgo = (S, n) => { const d = new Date(); d.setDate(d.getDate() - n); return S.dayKey(d); };

/* ---------------- PIN ---------------- */
test('hashPin: siempre igual para el mismo PIN, distinto para PIN distintos y nunca el PIN en claro', () => {
  const { Store } = fresh();
  assert.equal(Store.hashPin('12345'), Store.hashPin('12345'));
  assert.equal(Store.hashPin(12345), Store.hashPin('12345'));
  const all = new Set();
  for (let i = 0; i < 100000; i += 7) all.add(Store.hashPin(String(i).padStart(5, '0')));
  assert.ok(all.size > 14200, 'demasiadas colisiones');
  assert.ok(!Store.hashPin('12345').includes('12345'));
  assert.notEqual(Store.hashPin('01234'), Store.hashPin('1234'), 'los ceros a la izquierda cuentan');
});

test('checkPin: acepta el PIN correcto, rechaza otro y deja pasar perfiles sin PIN', () => {
  const { Store } = fresh();
  const p = Store.newProfile('Ana', '1º ESO A', '24680');
  assert.ok(Store.checkPin(p, '24680'));
  assert.ok(!Store.checkPin(p, '24681'));
  assert.ok(Store.checkPin(Store.newProfile('Luis', '', ''), 'cualquiera'));
});

/* ---------------- perfiles ---------------- */
test('newProfile: limpia espacios, guarda solo la huella del PIN y crea ids distintos', () => {
  const { Store } = fresh();
  const p = Store.newProfile('  Ana Ruiz ', ' 2º ESO B ', '11111');
  assert.equal(p.name, 'Ana Ruiz');
  assert.equal(p.group, '2º ESO B');
  assert.equal(p.pin, Store.hashPin('11111'));
  assert.ok(!('pinTxt' in p));
  assert.ok(!JSON.stringify(p).includes('11111'));
  assert.equal(p.lv, 3);
  assert.equal(p.warm, '');
  assert.deepEqual(plain(p.writings), []);
  const ids = new Set(Array.from({ length: 200 }, () => Store.newProfile('x', '', '').id));
  assert.equal(ids.size, 200);
});

test('normalize: rellena lo que falta y conserva lo que hay', () => {
  const { Store } = fresh();
  const p = Store.normalize({ id: 'a', name: 'A', settings: { sound: false } });
  assert.deepEqual(plain(p.settings), { sound: false, kb: true, hands: true });
  for (const k of ['lessons', 'keys', 'days', 'pts']) assert.deepEqual(plain(p[k]), {});
  assert.deepEqual(plain(p.tests), []);
  assert.equal(p.totalSec, 0);
});

test('normalize: el reto final de la versión anterior (lección 26) pasa a la 28', () => {
  const { Store } = fresh();
  const old = Store.normalize({ id: 'a', name: 'A', lessons: { 25: { passed: true }, 26: { passed: true, best: { stars: 3 } } } });
  assert.ok(old.lessons[28].passed);
  assert.equal(old.lessons[28].best.stars, 3);
  assert.equal(old.lessons[26], undefined);
  assert.ok(old.lessons[25].passed);
  // un perfil nuevo no se toca
  const nw = Store.normalize({ id: 'b', name: 'B', lv: 2, lessons: { 26: { passed: true } } });
  assert.ok(nw.lessons[26].passed);
  assert.equal(nw.lessons[28], undefined);
  // normalizar dos veces no vuelve a mover nada
  Store.normalize(old);
  assert.ok(old.lessons[28].passed && !old.lessons[26]);
});

test('normalize: el avanzado de la versión 2 (29-31) pasa a 31-33 y quedan libres la 29 y la 30', () => {
  const { Store } = fresh();
  const p = Store.normalize({ id: 'a', name: 'A', lv: 2, lessons: { 28: { passed: true }, 29: { passed: true, best: { wpm: 26 } }, 30: { passed: false, passes: 1 }, 31: { passed: true } } });
  assert.equal(p.lv, 3);
  assert.equal(p.lessons[31].best.wpm, 26);
  assert.equal(p.lessons[32].passes, 1);
  assert.ok(p.lessons[33].passed);
  assert.equal(p.lessons[29], undefined);
  assert.equal(p.lessons[30], undefined);
  assert.ok(p.lessons[28].passed);
  Store.normalize(p);
  assert.ok(p.lessons[33].passed && !p.lessons[29], 'no se mueve dos veces');
  // un perfil de la versión 1 pasa por las dos migraciones
  const v1 = Store.normalize({ id: 'b', name: 'B', lessons: { 26: { passed: true } } });
  assert.ok(v1.lessons[28].passed && !v1.lessons[26] && v1.lv === 3);
});

test('merge: une los textos de escritura libre sin duplicar y se queda con los 10 últimos', () => {
  const { Store } = fresh();
  const a = Store.normalize({ id: 'x', name: 'A', writings: Array.from({ length: 8 }, (_, i) => ({ date: i, text: 't' + i })) });
  const b = Store.normalize({ id: 'x', name: 'A', writings: Array.from({ length: 6 }, (_, i) => ({ date: i + 5, text: 't' + (i + 5) })) });
  const r = Store.merge(a, b);
  assert.deepEqual(plain(r.writings.map(w => w.date)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('normalize y load: borran el PIN en texto que guardaban versiones anteriores', () => {
  const c = fresh();
  c.storage.setItem('teclea:v1', JSON.stringify({ current: null, profiles: { a: { id: 'a', name: 'A', pin: 'x', pinTxt: '54321' } } }));
  const db = c.Store.load();
  assert.ok(!('pinTxt' in db.profiles.a));
  assert.ok(!c.storage.getItem('teclea:v1').includes('54321'), 'debe quedar borrado también en el almacenamiento');
});

test('load: datos dañados o vacíos no rompen la app', () => {
  const c = fresh();
  assert.deepEqual(plain(c.Store.load()), { profiles: {}, current: null });
  c.storage.setItem('teclea:v1', '{esto no es json');
  assert.deepEqual(plain(c.Store.load()), { profiles: {}, current: null });
  c.storage.setItem('teclea:v1', '"hola"');
  assert.deepEqual(plain(c.Store.load()), { profiles: {}, current: null });
});

test('save/load: guardar y recuperar; si el navegador no deja guardar, save devuelve false', () => {
  const c = fresh();
  const p = c.Store.newProfile('Ana', 'G', '12345');
  assert.equal(c.Store.save({ profiles: { [p.id]: p }, current: p.id }), true);
  assert.equal(c.Store.load().profiles[p.id].name, 'Ana');
  c.storage.fail = true;
  assert.equal(c.Store.save({ profiles: {}, current: null }), false);
  assert.equal(c.Store.available(), false);
});

/* ---------------- código de progreso ---------------- */
test('código de progreso: ida y vuelta con tildes, ñ y todo el progreso', () => {
  const { Store } = fresh();
  const p = Store.newProfile('Iñaki Núñez Gómez', '2º Bach C', '13579');
  p.lessons = { 0: { passed: true, passes: 1 }, 5: { passed: false, passes: 1, attempts: 3, best: { wpm: 9, acc: 96, stars: 1 } } };
  p.keys = { 'ñ': { h: 10, e: 2 } };
  p.days = { '2026-11-20': 300 };
  p.pts = { '2026-11-20': [50, 70] };
  p.tests = [{ title: 'x', mins: 1, wpm: 20, acc: 97, date: 1 }];
  p.totalSec = 300;
  const code = Store.exportCode(p);
  assert.ok(code.startsWith('TECLEA1.'));
  assert.ok(/^TECLEA1\.[A-Za-z0-9_-]+$/.test(code), 'solo caracteres seguros');
  const back = Store.importCode(code);
  for (const k of ['id', 'name', 'group', 'pin', 'lessons', 'keys', 'days', 'pts', 'tests', 'totalSec', 'lv']) {
    assert.deepEqual(plain(back[k]), plain(p[k]), k);
  }
});

test('código de progreso: tolera espacios y saltos de línea al pegarlo', () => {
  const { Store } = fresh();
  const p = Store.newProfile('Ana', 'G', '12345');
  const code = Store.exportCode(p);
  const messy = '  ' + code.slice(0, 20) + '\n ' + code.slice(20, 40) + '\t' + code.slice(40) + '\n';
  assert.equal(Store.importCode(messy).id, p.id);
});

test('código de progreso: errores claros si no es válido', () => {
  const { Store } = fresh();
  assert.throws(() => Store.importCode(''), /no es válido/);
  assert.throws(() => Store.importCode('hola'), /no es válido/);
  assert.throws(() => Store.importCode('TECLEA1.%%%'), /dañado/);
  assert.throws(() => Store.importCode('TECLEA1.' + Buffer.from('{"x":1}').toString('base64')), /no contiene un perfil/);
  const ok = Store.exportCode(Store.newProfile('Ana', 'G', '1'));
  assert.throws(() => Store.importCode(ok.slice(0, ok.length - 15)), /dañado/);
});

test('el código de progreso nunca contiene el PIN en texto', () => {
  const { Store } = fresh();
  const p = Store.newProfile('Ana', 'G', '97531');
  p.pinTxt = '97531';
  assert.ok(!Store.exportCode(p).includes(Buffer.from('97531').toString('base64').slice(0, 6)));
  assert.ok(!('pinTxt' in Store.importCode(Store.exportCode(p))));
});

test('un código de la versión anterior (sin versión) migra el reto final al importarlo', () => {
  const { Store } = fresh();
  const old = { id: 'x', name: 'Viejo', lessons: { 26: { passed: true } } };
  const code = 'TECLEA1.' + Buffer.from(JSON.stringify(old)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const p = Store.importCode(code);
  assert.ok(p.lessons[28].passed);
  assert.equal(p.lessons[26], undefined);
});

/* ---------------- unir progresos ---------------- */
test('merge: se queda con lo mejor de cada ordenador', () => {
  const { Store } = fresh();
  const a = Store.normalize({ id: 'x', name: 'A', pin: 'pa', lastSeen: 100, totalSec: 50,
    lessons: { 1: { passed: true, passes: 2, attempts: 2, best: { wpm: 10, acc: 96, stars: 1 } }, 2: { passed: false, passes: 1, attempts: 1, best: { wpm: 5, acc: 95, stars: 1 } } },
    keys: { f: { h: 10, e: 1 } }, days: { d1: 30, d2: 10 }, pts: { d1: [10, 5] }, tests: [{ date: 1, wpm: 10 }] });
  const b = Store.normalize({ id: 'x', name: 'A', pin: 'pb', lastSeen: 200, totalSec: 80,
    lessons: { 1: { passed: false, passes: 1, attempts: 5, best: { wpm: 12, acc: 97, stars: 2 } }, 2: { passed: false, passes: 1, attempts: 2 }, 3: { passed: true, passes: 2 } },
    keys: { f: { h: 5, e: 4 }, j: { h: 3, e: 0 } }, days: { d1: 20, d3: 40 }, pts: { d1: [3, 9], d3: [1, 1] }, tests: [{ date: 1, wpm: 10 }, { date: 2, wpm: 15 }] });
  const r = Store.merge(a, b);
  assert.equal(r.lessons[1].passed, true, 'superada en un ordenador = superada');
  assert.equal(r.lessons[1].attempts, 5);
  assert.equal(r.lessons[1].best.stars, 2, 'mejor marca');
  assert.equal(r.lessons[3].passed, true, 'lección que solo estaba en el otro');
  assert.deepEqual(plain(r.keys), { f: { h: 10, e: 4 }, j: { h: 3, e: 0 } });
  assert.deepEqual(plain(r.days), { d1: 30, d2: 10, d3: 40 });
  assert.deepEqual(plain(r.pts), { d1: [10, 9], d3: [1, 1] });
  assert.deepEqual(plain(r.tests.map(t => t.date)), [1, 2], 'pruebas sin duplicar');
  assert.equal(r.totalSec, 80);
  assert.equal(r.pin, 'pb', 'el PIN más reciente');
  assert.equal(r.lastSeen, 200);
  assert.equal(a.lessons[1].best.stars, 1, 'no modifica el original');
});

test('merge: los aprobados de una lección se conservan (no se pierde el «1 de 2»)', () => {
  const { Store } = fresh();
  const a = Store.normalize({ id: 'x', name: 'A', lessons: { 7: { passed: false, passes: 0, attempts: 3 } } });
  const b = Store.normalize({ id: 'x', name: 'A', lessons: { 7: { passed: false, passes: 1, attempts: 1 } } });
  assert.equal(Store.merge(a, b).lessons[7].passes, 1);
  assert.equal(Store.merge(b, a).lessons[7].passes, 1);
});

test('merge: el PIN más antiguo no sustituye al nuevo', () => {
  const { Store } = fresh();
  const a = Store.normalize({ id: 'x', name: 'A', pin: 'nuevo', lastSeen: 500 });
  const b = Store.normalize({ id: 'x', name: 'A', pin: 'viejo', lastSeen: 100 });
  assert.equal(Store.merge(a, b).pin, 'nuevo');
});

/* ---------------- días, racha y puntos ---------------- */
test('dayKey: formato AAAA-MM-DD con ceros', () => {
  const { Store } = fresh();
  assert.equal(Store.dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(Store.dayKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('addPractice suma al día de hoy y al total', () => {
  const { Store } = fresh();
  const p = Store.newProfile('A', '', '');
  Store.addPractice(p, 30); Store.addPractice(p, 45);
  assert.equal(Store.todaySec(p), 75);
  assert.equal(p.totalSec, 75);
});

test('racha: días seguidos contando hoy o, si hoy no ha practicado, desde ayer', () => {
  const S = fresh().Store;
  const p = S.newProfile('A', '', '');
  assert.equal(S.streak(p), 0);
  p.days = { [daysAgo(S, 1)]: 10, [daysAgo(S, 2)]: 10 };
  assert.equal(S.streak(p), 2, 'hoy aún no ha practicado');
  p.days[daysAgo(S, 0)] = 5;
  assert.equal(S.streak(p), 3);
  p.days = { [daysAgo(S, 0)]: 5, [daysAgo(S, 2)]: 5 };
  assert.equal(S.streak(p), 1, 'un día sin practicar corta la racha');
  p.days = { [daysAgo(S, 3)]: 5 };
  assert.equal(S.streak(p), 0);
});

test('puntos: los de minutos tienen un tope de 300 al día; los extra no', () => {
  const S = fresh().Store;
  const p = S.newProfile('A', '', '');
  assert.equal(S.addPoints(p, 200, 0), 200);
  assert.equal(S.addPoints(p, 200, 50), 150, 'solo caben 100 por minutos + 50 extra');
  assert.equal(S.addPoints(p, 80, 20), 20);
  assert.deepEqual(plain(p.pts[S.dayKey()]), [300, 70]);
  assert.equal(S.addPoints(p, -50, 0), 0, 'nunca resta');
});

test('weekKey: devuelve el lunes de la semana (también en domingo y a final de mes)', () => {
  const S = fresh().Store;
  assert.equal(S.weekKey(new Date(2026, 10, 25)), '2026-11-23'); // miércoles
  assert.equal(S.weekKey(new Date(2026, 10, 23)), '2026-11-23'); // lunes
  assert.equal(S.weekKey(new Date(2026, 10, 29)), '2026-11-23'); // domingo
  assert.equal(S.weekKey(new Date(2026, 11, 2)), '2026-11-30');  // cambio de mes
  assert.equal(S.weekKey(new Date(2027, 0, 1)), '2026-12-28');   // cambio de año
});

test('puntos de la semana: solo desde el lunes; los totales lo cuentan todo', () => {
  const S = fresh().Store;
  const p = S.newProfile('A', '', '');
  const monday = S.weekKey();
  const before = new Date(monday + 'T12:00'); before.setDate(before.getDate() - 1);
  p.pts = { [monday]: [10, 5], [S.dayKey(before)]: [100, 100] };
  assert.equal(S.weekPoints(p), 15);
  assert.equal(S.totalPoints(p), 215);
  assert.equal(S.weekPoints({}), 0);
});
