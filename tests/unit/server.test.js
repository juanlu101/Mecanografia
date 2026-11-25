const test = require('node:test');
const assert = require('node:assert/strict');
const { loadServer } = require('../helpers/load-server');
const { loadClient } = require('../helpers/load-client');

const client = loadClient();
const { Store } = client;
const H = pin => Store.hashPin(pin);
const WEEK = Store.weekKey();

// Simula lo que envía la app al servidor
function profilePayload(type, p, extra = {}) {
  return Object.assign({ type, id: p.id, nombre: p.name, grupo: p.group, pin: p.pin,
    superadas: 3, mejorPpm: 12, minutos: 5, semana: WEEK, puntosSemana: 100, puntosTotal: 300,
    codigo: Store.exportCode(p) }, extra);
}
function student(name, group, pin) { return Store.newProfile(name, group, pin); }

test('responde aunque no haya nada aún', () => {
  const s = loadServer();
  assert.deepEqual(s.get({}), { ok: true, mensaje: 'Teclea: servicio activo' });
  assert.deepEqual(s.get({ accion: 'buscar', nombre: 'x', grupo: 'y', pin: 'z' }), { ok: true, codigo: null, existe: false });
  assert.deepEqual(s.get({ accion: 'grupos' }), { ok: true, grupos: null });
});

test('la clave por defecto es la de ejemplo (recordatorio de cambiarla)', () => {
  assert.equal(loadServer().clave, 'cambia-esta-clave');
});

test('un resultado crea las hojas con cabecera y añade una fila en Resultados', () => {
  const s = loadServer();
  const p = student('Ana Ruiz', '1º ESO A', '11111');
  assert.deepEqual(s.post(profilePayload('result', p, { leccion: 3, titulo: 'S y L', ppm: 9, precision: 96.5, estrellas: 1, superada: true, segundos: 60, fecha: new Date().toISOString(), envio: 'e1' })), { ok: true });
  const res = s.sheets.Resultados.rows();
  assert.equal(res.length, 1);
  assert.deepEqual([res[0].Nombre, res[0].Grupo, res[0]['Lección'], res[0].PPM, res[0]['Precisión %'], res[0].Superada], ['Ana Ruiz', '1º ESO A', 3, 9, 96.5, 'Sí']);
  assert.ok(res[0].Fecha instanceof Date);
  const prog = s.sheets.Progreso.rows();
  assert.equal(prog.length, 1);
  assert.equal(prog[0].Id, p.id);
  assert.equal(prog[0]['Clave nombre'], 'ana ruiz|1º eso a');
});

test('el mismo resultado reenviado dos veces solo aparece una vez', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '11111');
  const body = profilePayload('result', p, { leccion: 1, envio: 'repetido', fecha: new Date().toISOString() });
  s.post(body); s.post(body); s.post(body);
  assert.equal(s.sheets.Resultados.rows().length, 1);
  s.post(Object.assign({}, body, { envio: 'otro' }));
  assert.equal(s.sheets.Resultados.rows().length, 2);
});

test('Progreso: una fila por alumno que se actualiza; lo que no llega se conserva', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '11111');
  s.post(profilePayload('perfil', p));
  s.post(profilePayload('result', p, { superadas: 5, puntosSemana: 150, envio: 'a', fecha: new Date().toISOString() }));
  // mensaje de PIN: solo trae el PIN
  s.post({ type: 'pin', id: p.id, nombre: p.name, grupo: p.group, pin: p.pin, pinTxt: '11111' });
  const rows = s.sheets.Progreso.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Lecciones superadas'], 5);
  assert.equal(rows[0]['Puntos semana'], 150, 'el mensaje de PIN no borra los puntos');
  assert.ok(rows[0]['Código de progreso'].startsWith('TECLEA1.'), 'ni el código');
  assert.equal(rows[0]['PIN (texto)'], '11111');
});

test('PIN y huella se guardan como texto: los ceros a la izquierda no se pierden', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '00123');
  s.post({ type: 'pin', id: p.id, nombre: p.name, grupo: p.group, pin: p.pin, pinTxt: '00123' });
  const row = s.sheets.Progreso.rows()[0];
  assert.equal(row['PIN (texto)'], '00123');
  assert.equal(typeof row.PIN, 'string');
  // una huella que parece un número tampoco se convierte
  s.post({ type: 'perfil', id: 'q', nombre: 'Q', grupo: 'G', pin: '123456' });
  assert.equal(s.sheets.Progreso.rows()[1].PIN, '123456');
  assert.equal(s.get({ accion: 'buscar', nombre: 'Q', grupo: 'G', pin: '123456' }).codigo, '');
});

test('el código de progreso nunca se pierde por un envío sin código', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '11111');
  s.post(profilePayload('perfil', p));
  const code = s.sheets.Progreso.rows()[0]['Código de progreso'];
  s.post(profilePayload('result', p, { codigo: '', envio: 'x', fecha: new Date().toISOString() }));
  assert.equal(s.sheets.Progreso.rows()[0]['Código de progreso'], code);
});

test('si Google está ocupado (sin turno), contesta ok:false para que la app reintente', () => {
  const s = loadServer();
  s.google.state.lockFree = false;
  assert.deepEqual(s.post(profilePayload('perfil', student('A', 'G', '1'))), { ok: false, error: 'ocupado' });
  assert.equal(s.sheets.Progreso, undefined);
});

test('un envío mal formado no rompe el servidor', () => {
  const s = loadServer();
  const out = JSON.parse(s.ctx.doPost({ postData: { contents: '{no json' } }).getContent());
  assert.equal(out.ok, false);
});

/* ---------------- buscar (entrar desde otro ordenador) ---------------- */
test('buscar: con el PIN correcto devuelve su código; con otro dice que existe; ignora mayúsculas, tildes y espacios', () => {
  const s = loadServer();
  const p = student('Lucía Pérez', '1º ESO A', '24680');
  s.post(profilePayload('perfil', p));
  const ok = s.get({ accion: 'buscar', nombre: '  lucia   PEREZ ', grupo: '1º eso a', pin: H('24680') });
  assert.equal(Store.importCode(ok.codigo).id, p.id);
  assert.equal(ok.sinPin, false);
  assert.deepEqual(s.get({ accion: 'buscar', nombre: 'Lucía Pérez', grupo: '1º ESO A', pin: H('99999') }), { ok: true, codigo: null, existe: true });
  assert.deepEqual(s.get({ accion: 'buscar', nombre: 'Lucía Pérez', grupo: '1º ESO B', pin: H('24680') }), { ok: true, codigo: null, existe: false }, 'otro grupo = otra persona');
});

test('buscar: dos alumnos con el mismo nombre y grupo se distinguen por el PIN', () => {
  const s = loadServer();
  const a = student('Ana Ruiz', 'G', '11111'), b = student('Ana Ruiz', 'G', '22222');
  s.post(profilePayload('perfil', a)); s.post(profilePayload('perfil', b));
  assert.equal(Store.importCode(s.get({ accion: 'buscar', nombre: 'Ana Ruiz', grupo: 'G', pin: H('11111') }).codigo).id, a.id);
  assert.equal(Store.importCode(s.get({ accion: 'buscar', nombre: 'Ana Ruiz', grupo: 'G', pin: H('22222') }).codigo).id, b.id);
});

test('quitar PIN: entonces cualquier PIN recupera al alumno (sinPin) y se borran PIN y PIN en texto', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '11111');
  s.post(profilePayload('perfil', p));
  s.post({ type: 'pin', id: p.id, nombre: 'Ana', grupo: 'G', pin: p.pin, pinTxt: '11111' });
  assert.deepEqual(s.get({ accion: 'quitarpin', clave: 'mal', id: p.id }), { ok: false, error: 'clave' });
  assert.deepEqual(s.get({ accion: 'quitarpin', clave: s.clave, id: p.id }), { ok: true });
  const row = s.sheets.Progreso.rows()[0];
  assert.equal(row.PIN, '');
  assert.equal(row['PIN (texto)'], '');
  const r = s.get({ accion: 'buscar', nombre: 'Ana', grupo: 'G', pin: H('55555') });
  assert.equal(r.sinPin, true);
  assert.equal(Store.importCode(r.codigo).id, p.id);
  assert.deepEqual(s.get({ accion: 'quitarpin', clave: s.clave, id: 'no-existe' }), { ok: false });
});

/* ---------------- panel ---------------- */
test('panel: exige la clave y devuelve alumnos con su PIN en texto solo si tienen PIN', () => {
  const s = loadServer();
  const a = student('Ana', 'G', '11111'), b = student('Luis', 'G', '');
  s.post(profilePayload('perfil', a)); s.post(profilePayload('perfil', b));
  s.post({ type: 'pin', id: a.id, nombre: 'Ana', grupo: 'G', pin: a.pin, pinTxt: '11111' });
  assert.deepEqual(s.get({ accion: 'panel', clave: '' }), { ok: false, error: 'clave' });
  assert.deepEqual(s.get({ accion: 'panel' }), { ok: false, error: 'clave' });
  const r = s.get({ accion: 'panel', clave: s.clave });
  assert.equal(r.alumnos.length, 2);
  const ana = r.alumnos.find(x => x.nombre === 'Ana');
  assert.deepEqual([ana.tienePin, ana.pinTxt], [true, '11111']);
  assert.equal(r.alumnos.find(x => x.nombre === 'Luis').tienePin, false);
});

/* ---------------- ranking ---------------- */
function rankingSetup() {
  const s = loadServer();
  const add = (name, group, pts, semana = WEEK) => {
    const p = student(name, group, '1');
    s.post(profilePayload('perfil', p, { puntosSemana: pts, semana }));
    return p;
  };
  return { s, add };
}

test('ranking: cuenta los puntos de esta semana aunque Google convierta la semana en fecha', () => {
  const { s, add } = rankingSetup();
  const p = add('Ana Ruiz', '1º ESO A', 120);
  const cell = s.sheets.Progreso.rows()[0].Semana;
  const r = s.get({ accion: 'ranking', id: p.id, grupo: '1º ESO A', semana: WEEK });
  assert.equal(r.yo.puntos, 120, `la semana guardada como ${cell instanceof Date ? 'fecha' : typeof cell} debe seguir contando`);
});

test('ranking: los puntos de otra semana cuentan como 0', () => {
  const { s, add } = rankingSetup();
  const p = add('Ana', 'G', 500, '2020-01-06');
  assert.equal(s.get({ accion: 'ranking', id: p.id, grupo: 'G', semana: WEEK }).yo.puntos, 0);
});

test('ranking: los 5 primeros de la clase, empates en la misma posición y mi posición aunque no esté entre ellos', () => {
  const { s, add } = rankingSetup();
  const pts = [90, 50, 50, 40, 30, 20, 10];
  const ps = pts.map((n, i) => add(`Alumno${i} Apellido${i}`, '2º ESO B', n));
  add('Otro Grupo', '3º ESO A', 1000);
  const r = s.get({ accion: 'ranking', id: ps[6].id, grupo: '2º ESO B', semana: WEEK });
  assert.equal(r.total, 7);
  assert.deepEqual(r.clase.map(x => x.puntos), [90, 50, 50, 40, 30]);
  assert.deepEqual(r.clase.map(x => x.posicion), [1, 2, 2, 4, 5]);
  assert.deepEqual(r.yo, { posicion: 7, puntos: 10 });
  assert.ok(r.clase.every(x => !x.yo));
  const r2 = s.get({ accion: 'ranking', id: ps[1].id, grupo: '2º ESO B', semana: WEEK });
  assert.equal(r2.clase.find(x => x.yo).nombre, 'Alumno1 A.');
});

test('ranking: solo nombre e inicial; nunca PIN, ids ni códigos', () => {
  const { s, add } = rankingSetup();
  const p = add('Lucía Pérez Gil', 'G', 10);
  s.post({ type: 'pin', id: p.id, nombre: p.name, grupo: 'G', pin: p.pin, pinTxt: '24680' });
  const raw = JSON.stringify(s.get({ accion: 'ranking', id: p.id, grupo: 'G', semana: WEEK }));
  assert.ok(raw.includes('Lucía P.'));
  for (const secret of ['Pérez', '24680', p.pin, p.id, 'TECLEA1']) assert.ok(!raw.includes(secret), `filtra ${secret}`);
});

test('ranking de clases: media por alumno contando a los que no practican, y marca la mía', () => {
  const { s, add } = rankingSetup();
  const me = add('A', '1º ESO A', 100); add('B', '1º ESO A', 0);   // media 50
  add('C', '1º ESO B', 60); add('D', '1º ESO B', 60);              // media 60
  add('E', '1º ESO C', 10, '2020-01-06');                          // otra semana: media 0
  const r = s.get({ accion: 'ranking', id: me.id, grupo: '1º eso a', semana: WEEK });
  assert.deepEqual(r.clases.map(x => [x.grupo, x.media, x.alumnos, x.mia]),
    [['1º ESO B', 60, 2, false], ['1º ESO A', 50, 2, true], ['1º ESO C', 0, 1, false]]);
});

test('ranking: un alumno sin grupo o un grupo vacío no rompe nada', () => {
  const { s, add } = rankingSetup();
  const p = add('Solo', '', 5);
  const r = s.get({ accion: 'ranking', id: p.id, grupo: '', semana: WEEK });
  assert.equal(r.yo.puntos, 5);
  assert.deepEqual(s.get({ accion: 'ranking', id: 'x', grupo: 'Nadie', semana: WEEK }).clase, []);
});

/* ---------------- grupos ---------------- */
test('grupos: guardar exige clave, no acepta lista vacía y conserva los nombres tal cual', () => {
  const s = loadServer();
  assert.deepEqual(s.get({ accion: 'guardargrupos', clave: 'mal', grupos: '["A"]' }), { ok: false, error: 'clave' });
  assert.equal(s.get({ accion: 'guardargrupos', clave: s.clave, grupos: '[]' }).ok, false);
  const list = ['1º ESO A', '2024', '3º ESO D', '2026-01-05'];
  assert.deepEqual(s.get({ accion: 'guardargrupos', clave: s.clave, grupos: JSON.stringify(list) }), { ok: true });
  assert.deepEqual(s.get({ accion: 'grupos' }).grupos, list, 'ni números ni fechas deben transformarse');
  assert.deepEqual(s.get({ accion: 'guardargrupos', clave: s.clave, grupos: '["Z"]' }), { ok: true });
  assert.deepEqual(s.get({ accion: 'grupos' }).grupos, ['Z'], 'la lista nueva sustituye a la anterior');
});

/* ---------------- hojas de versiones anteriores ---------------- */
test('una hoja Progreso de una versión anterior recibe las columnas nuevas sin perder datos', () => {
  const s = loadServer();
  const { Sheet } = require('../helpers/fake-sheets');
  const old = new Sheet('Progreso');
  old.appendRow(['Id', 'Nombre', 'Grupo', 'Clave nombre', 'PIN', 'Lecciones superadas', 'Mejor PPM', 'Minutos', 'Última actividad', 'Código de progreso']);
  old.appendRow(['pold', 'Viejo', 'G', 'viejo|g', "'abc", 2, 10, 3, new Date(), 'TECLEA1.xyz']);
  s.sheets.Progreso = old;
  s.post({ type: 'perfil', id: 'pold', nombre: 'Viejo', grupo: 'G', semana: WEEK, puntosSemana: 40 });
  const rows = s.sheets.Progreso.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Puntos semana'], 40);
  assert.equal(rows[0]['Código de progreso'], 'TECLEA1.xyz');
  assert.equal(rows[0].PIN, 'abc');
  assert.ok('PIN (texto)' in rows[0]);
});

test('utilidades: normalización de nombres y abreviatura para el ranking', () => {
  const s = loadServer();
  assert.equal(s.ctx.clave_('  Lucía   PÉREZ ', '1º ESO A'), 'lucia perez|1º eso a');
  assert.equal(s.ctx.corto_('Lucía Pérez Gil'), 'Lucía P.');
  assert.equal(s.ctx.corto_('Hugo'), 'Hugo');
  assert.equal(s.ctx.corto_('ana ñúñez'), 'ana Ñ.');
  assert.equal(s.ctx.corto_(''), '');
});

test('ranking: filas antiguas donde Google ya guardó la semana como fecha siguen contando', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '1');
  s.post(profilePayload('perfil', p, { puntosSemana: 77 }));
  const [y, m, d] = WEEK.split('-').map(Number);
  s.sheets.Progreso.getRange(2, 11).setValues([[new Date(y, m - 1, d)]]); // como lo guardaba la versión anterior
  assert.ok(s.sheets.Progreso.rows()[0].Semana instanceof Date);
  assert.equal(s.get({ accion: 'ranking', id: p.id, grupo: 'G', semana: WEEK }).yo.puntos, 77);
});

test('los textos de los alumnos nunca se convierten en fórmulas de la hoja', () => {
  const s = loadServer();
  const p = student('=HYPERLINK("http://x","clic")', '+1º ESO A', '1');
  s.post(profilePayload('result', p, { leccion: 30, titulo: '=1+1', texto: '=IMPORTXML("http://malo")', envio: 'f1', fecha: new Date().toISOString() }));
  const [res] = s.sheets.Resultados.rows();
  assert.equal(res.Nombre, '=HYPERLINK("http://x","clic")');
  assert.equal(res['Texto (escritura libre)'], '=IMPORTXML("http://malo")');
  assert.equal(res['Título'], '=1+1');
  const raw = s.sheets.Resultados.data[1];
  assert.ok(raw.every(v => typeof v !== 'string' || !v.startsWith("'")), 'el apóstrofo no queda visible');
});

test('el texto de la escritura libre se guarda entero en Resultados', () => {
  const s = loadServer();
  const p = student('Ana', 'G', '1');
  const texto = 'Mi fin de semana fue genial. ' .repeat(40);
  s.post(profilePayload('result', p, { leccion: 30, titulo: 'Escritura libre: tema', texto, envio: 'w1', fecha: new Date().toISOString() }));
  assert.equal(s.sheets.Resultados.rows()[0]['Texto (escritura libre)'], texto);
});
