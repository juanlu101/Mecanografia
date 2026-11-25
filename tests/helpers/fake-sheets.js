/* Simula SpreadsheetApp, LockService, ContentService, Utilities y Session de Google Apps Script.
   Como Google Sheets de verdad, los textos que parecen números o fechas se convierten
   (salvo que empiecen por ' o la celda tenga formato de texto «@»). */

function convert(v, asText) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (asText) return v;
  if (v.startsWith('=')) return { formula: v }; // como Sheets: se ejecutaría como fórmula
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return v;
}

const display = v => (v instanceof Date
  ? `${v.getDate()}/${v.getMonth() + 1}/${v.getFullYear()}`
  : v === undefined || v === null ? '' : String(v));

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc, text: false }); }
  cells(fn) {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(fn(this.r - 1 + i, this.c - 1 + j));
      out.push(row);
    }
    return out;
  }
  getValues() { return this.cells((i, j) => { const v = (this.sheet.data[i] || [])[j]; return v === undefined ? '' : v; }); }
  getDisplayValues() { return this.getValues().map(r => r.map(display)); }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some(r => r.length !== this.nc)) throw new Error('Las dimensiones no coinciden');
    vals.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.r - 1 + i, this.c - 1 + j, convert(v, this.text))));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  clearContent() { this.cells((i, j) => this.sheet.set(i, j, '')); return this; }
  setFontWeight() { return this; }
  setNumberFormat(f) { this.text = f === '@'; return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  set(i, j, v) { while (this.data.length <= i) this.data.push([]); this.data[i][j] = v; }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some(v => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); }
  appendRow(vals) { const i = this.getLastRow(); vals.forEach((v, j) => this.set(i, j, convert(v, false))); }
  getRange(r, c, nr, nc) {
    if (r < 1 || c < 1 || (nr !== undefined && nr < 1) || (nc !== undefined && nc < 1)) throw new Error('Rango no válido');
    return new Range(this, r, c, nr, nc);
  }
  setFrozenRows() {}
  // Utilidad de pruebas: filas como objetos usando la cabecera
  rows() {
    const [head, ...rest] = this.data.slice(0, this.getLastRow());
    return rest.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] === undefined ? '' : r[i]])));
  }
}

function createGoogle() {
  const sheets = {};
  const state = { lockFree: true };
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = new Sheet(n))
  };
  return {
    sheets, state,
    globals: {
      SpreadsheetApp: { getActiveSpreadsheet: () => ss },
      LockService: { getScriptLock: () => ({ tryLock: () => state.lockFree, waitLock: () => { if (!state.lockFree) throw new Error('lock'); }, releaseLock: () => {} }) },
      ContentService: {
        MimeType: { JSON: 'application/json' },
        createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return this.content; } })
      },
      Session: { getScriptTimeZone: () => 'Europe/Madrid' },
      Utilities: {
        formatDate: (d, tz, fmt) => {
          if (fmt !== 'yyyy-MM-dd') throw new Error('formato no simulado');
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
      }
    }
  };
}

module.exports = { createGoogle, convert, Sheet };
