/**
 * TECLEA — receptor de resultados para Google Sheets (opcional)
 *
 * Qué hace:
 *  - Hoja "Resultados": una fila por cada lección terminada (nombre, grupo, ppm, precisión…).
 *  - Hoja "Progreso": una fila por alumno con su resumen y su código de progreso.
 *    El alumno recupera su progreso en cualquier ordenador con su nombre, grupo y PIN.
 *  - Panel del profesor/a: la app lee la hoja "Progreso" con la clave de abajo.
 *  - Ranking semanal: los alumnos ven los 5 primeros de su clase (nombre + inicial)
 *    y la media de cada clase. No se envían nombres completos ni otros datos.
 *  - Hoja "Grupos": la lista del desplegable de grupos (se edita desde el panel).
 *  - El PIN de cada alumno se guarda también en texto para que el profesor/a
 *    pueda consultarlo. Solo se envía al panel, con la clave.
 *
 * Instalación: ver README.md (sección "Guardar el progreso en Google Sheets").
 */

// ⚠️ CAMBIA ESTA CLAVE: es la que pedirá el panel del profesor/a.
const CLAVE_PROFESOR = 'pacopepe';

const HOJA_RESULTADOS = 'Resultados';
const HOJA_PROGRESO = 'Progreso';
const CAB_PROGRESO = ['Id', 'Nombre', 'Grupo', 'Clave nombre', 'PIN', 'Lecciones superadas', 'Mejor PPM',
  'Minutos', 'Última actividad', 'Código de progreso', 'Semana', 'Puntos semana', 'Puntos total', 'PIN (texto)'];
const COL = { id: 1, nombre: 2, grupo: 3, clave: 4, pin: 5, superadas: 6, ppm: 7, minutos: 8, ultima: 9, codigo: 10,
  semana: 11, puntosSemana: 12, puntosTotal: 13, pinTxt: 14 };
const HOJA_GRUPOS = 'Grupos';

function doPost(e) {
  const lock = LockService.getScriptLock();
  // Si hay muchos envíos a la vez y no se consigue el turno, la app lo reintentará más tarde
  if (!lock.tryLock(15000)) return salida_({ ok: false, error: 'ocupado' });
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (d.type === 'result') {
      const res = hoja_(ss, HOJA_RESULTADOS,
        ['Fecha', 'Nombre', 'Grupo', 'Lección', 'Título', 'PPM', 'Precisión %', 'Estrellas', 'Superada', 'Segundos', 'Envío', 'Texto (escritura libre)']);
      if (!yaRecibido_(res, d.envio)) {
        // Lo que escriben los alumnos va como texto: así nunca se interpreta como una fórmula
        res.appendRow([new Date(d.fecha), texto_(d.nombre), texto_(d.grupo), d.leccion, texto_(d.titulo), d.ppm, d.precision,
          d.estrellas, d.superada ? 'Sí' : 'No', d.segundos, texto_(d.envio), texto_(d.texto)]);
      }
    }

    // Resumen del alumno (también llega al crear el perfil, con type 'perfil')
    if (d.id) {
      const prog = hoja_(ss, HOJA_PROGRESO, CAB_PROGRESO);
      const fila = buscarFila_(prog, COL.id, d.id);
      const actual = fila ? prog.getRange(fila, 1, 1, CAB_PROGRESO.length).getValues()[0] : null;
      const valores = [
        d.id, texto_(d.nombre), texto_(d.grupo), clave_(d.nombre, d.grupo),
        d.pin !== undefined ? (d.pin ? "'" + d.pin : '') : (actual ? actual[COL.pin - 1] : ''),
        d.superadas !== undefined ? d.superadas : (actual ? actual[COL.superadas - 1] : 0),
        d.mejorPpm !== undefined ? d.mejorPpm : (actual ? actual[COL.ppm - 1] : 0),
        d.minutos !== undefined ? d.minutos : (actual ? actual[COL.minutos - 1] : 0),
        new Date(),
        d.codigo ? d.codigo : (actual ? actual[COL.codigo - 1] : ''),
        d.semana !== undefined ? texto_(d.semana) : (actual ? actual[COL.semana - 1] : ''),
        d.puntosSemana !== undefined ? d.puntosSemana : (actual ? actual[COL.puntosSemana - 1] : 0),
        d.puntosTotal !== undefined ? d.puntosTotal : (actual ? actual[COL.puntosTotal - 1] : 0),
        d.pinTxt !== undefined ? (d.pinTxt ? "'" + d.pinTxt : '') : (actual ? actual[COL.pinTxt - 1] : '')
      ];
      if (fila) prog.getRange(fila, 1, 1, valores.length).setValues([valores]);
      else prog.appendRow(valores);
    }
    return salida_({ ok: true });
  } catch (err) {
    return salida_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const prog = ss.getSheetByName(HOJA_PROGRESO);
  const filas = prog && prog.getLastRow() > 1
    ? prog.getRange(2, 1, prog.getLastRow() - 1, CAB_PROGRESO.length).getValues() : [];

  // El alumno busca su progreso: nombre + grupo + PIN
  if (p.accion === 'buscar') {
    const clave = clave_(p.nombre, p.grupo);
    const mismas = filas.filter(f => f[COL.clave - 1] === clave);
    const suya = mismas.find(f => String(f[COL.pin - 1]) === p.pin) || mismas.find(f => !f[COL.pin - 1]);
    if (suya) return salida_({ ok: true, codigo: suya[COL.codigo - 1], sinPin: !suya[COL.pin - 1] });
    return salida_({ ok: true, codigo: null, existe: mismas.length > 0 });
  }

  // Ranking semanal (sin clave: solo nombre + inicial y puntos)
  if (p.accion === 'ranking') {
    const semana = String(p.semana || '');
    const grupoClave = norm_(p.grupo);
    const puntos = f => (semanaTxt_(f[COL.semana - 1]) === semana ? Number(f[COL.puntosSemana - 1]) || 0 : 0);
    const deMiClase = filas.filter(f => norm_(f[COL.grupo - 1]) === grupoClave)
      .map(f => ({ id: f[COL.id - 1], nombre: corto_(f[COL.nombre - 1]), puntos: puntos(f) }))
      .sort((a, b) => b.puntos - a.puntos);
    deMiClase.forEach((x, i) => { x.posicion = i > 0 && x.puntos === deMiClase[i - 1].puntos ? deMiClase[i - 1].posicion : i + 1; });
    const yo = deMiClase.find(x => x.id === p.id);
    const clases = {};
    filas.forEach(f => {
      const g = norm_(f[COL.grupo - 1]);
      const c = clases[g] = clases[g] || { grupo: String(f[COL.grupo - 1] || ''), alumnos: 0, puntos: 0 };
      c.alumnos++; c.puntos += puntos(f);
    });
    return salida_({
      ok: true, semana, total: deMiClase.length,
      clase: deMiClase.slice(0, 5).map(x => ({ nombre: x.nombre, puntos: x.puntos, posicion: x.posicion, yo: x.id === p.id })),
      yo: yo ? { posicion: yo.posicion, puntos: yo.puntos } : null,
      clases: Object.keys(clases).map(g => ({ grupo: clases[g].grupo, alumnos: clases[g].alumnos,
        media: Math.round(clases[g].puntos / clases[g].alumnos), mia: g === grupoClave }))
        .sort((a, b) => b.media - a.media)
    });
  }

  // Lista de grupos del desplegable (pública)
  if (p.accion === 'grupos') {
    const hg = ss.getSheetByName(HOJA_GRUPOS);
    const grupos = hg && hg.getLastRow() > 1
      ? hg.getRange(2, 1, hg.getLastRow() - 1, 1).getDisplayValues().map(f => String(f[0]).trim()).filter(Boolean) : null;
    return salida_({ ok: true, grupos });
  }

  // Panel del profesor/a
  if (p.accion === 'panel' || p.accion === 'quitarpin' || p.accion === 'guardargrupos') {
    if (p.clave !== CLAVE_PROFESOR) return salida_({ ok: false, error: 'clave' });
    if (p.accion === 'quitarpin') {
      const fila = buscarFila_(prog, COL.id, p.id);
      if (fila) { prog.getRange(fila, COL.pin).setValue(''); prog.getRange(fila, COL.pinTxt).setValue(''); }
      return salida_({ ok: !!fila });
    }
    if (p.accion === 'guardargrupos') {
      const lista = JSON.parse(p.grupos || '[]').map(g => String(g).trim()).filter(Boolean);
      if (!lista.length) return salida_({ ok: false, error: 'vacia' });
      const hg = hoja_(ss, HOJA_GRUPOS, ['Grupo']);
      if (hg.getLastRow() > 1) hg.getRange(2, 1, hg.getLastRow() - 1, 1).clearContent();
      hg.getRange(2, 1, lista.length, 1).setNumberFormat('@').setValues(lista.map(g => [g]));
      return salida_({ ok: true });
    }
    return salida_({
      ok: true,
      alumnos: filas.map(f => ({ id: f[COL.id - 1], nombre: f[COL.nombre - 1], grupo: f[COL.grupo - 1],
        tienePin: !!f[COL.pin - 1], pinTxt: String(f[COL.pinTxt - 1] || ''), codigo: f[COL.codigo - 1] }))
    });
  }

  return salida_({ ok: true, mensaje: 'Teclea: servicio activo' });
}

/* ---------- utilidades ---------- */
function norm_(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function clave_(nombre, grupo) {
  return norm_(nombre) + '|' + norm_(grupo);
}

// Google Sheets convierte en número o fecha los textos que lo parecen ("2026-11-23", "2024"...).
// Con un apóstrofo delante se guardan tal cual.
function texto_(v) {
  return v === undefined || v === null || v === '' ? '' : "'" + String(v);
}

// La semana puede venir como texto o, en filas antiguas, convertida en fecha por Google
function semanaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v || '');
}

// "Lucía Pérez Gil" -> "Lucía P."
function corto_(nombre) {
  const w = String(nombre || '').trim().split(/\s+/);
  return w[0] + (w[1] ? ' ' + w[1].charAt(0).toUpperCase() + '.' : '');
}

function buscarFila_(hoja, col, valor) {
  if (!hoja) return 0;
  const n = hoja.getLastRow();
  if (n < 2) return 0;
  const vals = hoja.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === valor) return i + 2;
  return 0;
}

// Evita filas repetidas si la app reenvía un resultado que ya había llegado
function yaRecibido_(hoja, envio) {
  if (!envio) return false;
  const n = hoja.getLastRow();
  if (n < 2) return false;
  const desde = Math.max(2, n - 200);
  const vals = hoja.getRange(desde, 11, n - desde + 1, 1).getValues();
  return vals.some(v => v[0] === envio);
}

function hoja_(ss, nombre, cabecera) {
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(cabecera);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, cabecera.length).setFontWeight('bold');
  } else if (h.getLastColumn() < cabecera.length) {
    // hoja de una versión anterior: se añaden las columnas nuevas a la cabecera
    h.getRange(1, 1, 1, cabecera.length).setValues([cabecera]).setFontWeight('bold');
  }
  return h;
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
