const test = require('node:test');
const assert = require('node:assert/strict');
const { loadClient } = require('../helpers/load-client');

const { KB } = loadClient();
const step = ch => KB.getSteps(ch);
const fingerOf = ch => KB.KEY_BY_CODE[step(ch).at(-1).code].finger;

// Asignación estándar de dedos en mecanografía (teclado español)
const EXPECTED = {
  lp: 'qaz1º<', lr: 'wsx2', lm: 'edc3', li: 'rfvtgb45',
  ri: 'yhnujm67', rm: 'ik,8', rr: 'ol.9', rp: 'pñ-0\'¡`+´ç'
};

test('cada tecla tiene un código único y un dedo válido', () => {
  const codes = KB.ROWS.flat().map(k => k.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const k of KB.ROWS.flat()) assert.ok(k.finger === 'mod' || KB.FINGERS[k.finger], `${k.code} sin dedo`);
});

test('la fila guía: A S D F con la izquierda y J K L Ñ con la derecha', () => {
  const home = { a: 'lp', s: 'lr', d: 'lm', f: 'li', j: 'ri', k: 'rm', l: 'rr', 'ñ': 'rp' };
  for (const [c, f] of Object.entries(home)) assert.equal(fingerOf(c), f, c);
});

test('cada letra, número y signo se pulsa con el dedo correcto', () => {
  for (const [finger, chars] of Object.entries(EXPECTED)) {
    for (const c of chars) {
      const key = KB.findKey(c);
      assert.ok(key, `falta la tecla de ${c}`);
      assert.equal(key.finger, finger, `«${c}» debería ser ${finger} y es ${key.finger}`);
    }
  }
});

test('teclas de control: borrar e Intro con el meñique derecho; Tab y Bloq Mayús con el izquierdo', () => {
  assert.deepEqual(['Backspace', 'Enter', 'Tab', 'CapsLock'].map(c => KB.KEY_BY_CODE[c].finger), ['rp', 'rp', 'lp', 'lp']);
});

test('la barra espaciadora se pulsa con el pulgar', () => {
  assert.equal(KB.KEY_BY_CODE.Space.finger, 'th');
  assert.equal(KB.findKey(' ').code, 'Space');
});

test('todas las letras minúsculas se escriben con una sola pulsación y sin Mayús', () => {
  for (const c of 'abcdefghijklmnñopqrstuvwxyzç') {
    const s = step(c);
    assert.ok(s, c);
    assert.equal(s.length, 1, c);
    assert.equal(s[0].shift, false, c);
  }
});

test('las mayúsculas usan la tecla Mayús de la mano contraria', () => {
  for (const c of 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ') {
    const s = step(c);
    assert.equal(s.length, 1, c);
    assert.equal(s[0].shift, true, c);
    const info = KB.stepInfo(s[0]);
    const hand = KB.FINGERS[info.key.finger].hand;
    assert.equal(info.codes[1], hand === 'L' ? 'ShiftRight' : 'ShiftLeft', `${c}: Mayús equivocada`);
  }
});

test('vocales con tilde: primero la tecla de la tilde (sin mostrar nada) y luego la vocal', () => {
  for (const [acc, v] of [['á', 'A'], ['é', 'E'], ['í', 'I'], ['ó', 'O'], ['ú', 'U']]) {
    const s = step(acc);
    assert.equal(s.length, 2, acc);
    assert.deepEqual([s[0].code, s[0].shift, !!s[0].dead], ['Quote', false, true], acc);
    assert.deepEqual([s[1].code, s[1].shift], ['Key' + v, false], acc);
    const up = step(acc.toUpperCase());
    assert.equal(up[0].shift, false, 'la tilde no lleva Mayús');
    assert.equal(up[1].shift, true, 'la vocal mayúscula sí');
  }
  const u = step('ü');
  assert.deepEqual([u[0].code, u[0].shift, u[1].code], ['Quote', true, 'KeyU']);
});

test('las teclas muertas no se pueden escribir solas', () => {
  for (const c of ['´', '`', '^', '¨']) assert.equal(step(c), null, c);
});

test('signos de la distribución española', () => {
  const cases = {
    '¿': ['Equal', true], '¡': ['Equal', false], '?': ['Minus', true], "'": ['Minus', false],
    '!': ['Digit1', true], '"': ['Digit2', true], ':': ['Period', true], ';': ['Comma', true],
    '(': ['Digit8', true], ')': ['Digit9', true], '-': ['Slash', false], '_': ['Slash', true],
    ',': ['Comma', false], '.': ['Period', false], '/': ['Digit7', true], '%': ['Digit5', true]
  };
  for (const [c, [code, shift]] of Object.entries(cases)) {
    const s = step(c);
    assert.ok(s, c);
    assert.deepEqual([s[0].code, s[0].shift], [code, shift], c);
  }
  for (const d of '0123456789') assert.deepEqual([step(d)[0].code, step(d)[0].shift], ['Digit' + d, false]);
});

test('caracteres que el curso no enseña no se pueden escribir', () => {
  for (const c of ['@', '€', '#', '\\', '|', '[', ']', '{', '}', '~', '\n', '\t']) assert.equal(step(c), null, c);
});

test('keyLabel: nombres de teclas que se muestran al alumno', () => {
  assert.equal(KB.keyLabel(KB.KEY_BY_CODE.Space), 'Espacio');
  assert.equal(KB.keyLabel(KB.KEY_BY_CODE.KeyF), 'F');
  assert.equal(KB.keyLabel(KB.KEY_BY_CODE.Semicolon), 'Ñ');
  assert.equal(KB.keyLabel(KB.KEY_BY_CODE.ShiftLeft), 'Mayús');
  assert.equal(KB.keyLabel(KB.KEY_BY_CODE.Quote), '´');
});

test('esc evita inyectar HTML', () => {
  assert.equal(KB.esc('<b>"x" & \'y\'</b>'), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
});
