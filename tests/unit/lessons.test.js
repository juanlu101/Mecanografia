const test = require('node:test');
const assert = require('node:assert/strict');
const { loadClient, plain } = require('../helpers/load-client');

const c = loadClient();
const { LESSONS, CORE_LESSONS, STAGES, KB, TEXTS } = c;
const typeable = t => [...t].every(ch => ch === ' ' || KB.getSteps(ch));
const RUNS = 40;

test('lecciones numeradas de la 0 a la 33, en orden y sin huecos', () => {
  assert.deepEqual(plain(LESSONS.map(l => l.id)), Array.from({ length: 34 }, (_, i) => i));
});

test('31 lecciones obligatorias (0-30) y 3 avanzadas opcionales (31-33)', () => {
  assert.equal(CORE_LESSONS.length, 31);
  assert.deepEqual(plain(LESSONS.filter(l => l.optional).map(l => l.id)), [31, 32, 33]);
  assert.ok(LESSONS.filter(l => l.optional).every(l => l.stage === 8));
  assert.ok(STAGES.find(s => s.n === 8).optional);
  assert.ok(!STAGES.find(s => s.n === 7).optional, '«Escribir de verdad» es obligatoria');
});

test('etapa 7 «Escribir de verdad»: corregir errores (29) y escritura libre de 3 minutos (30)', () => {
  const [real, write] = [LESSONS[29], LESSONS[30]];
  assert.deepEqual([real.type, real.stage, real.minWpm, real.passes], ['real', 7, 18, 2]);
  assert.deepEqual([write.type, write.stage, write.minWpm, write.seconds, write.passes], ['write', 7, 12, 180, 2]);
  assert.equal(write.make(), '', 'la escritura libre no tiene texto que copiar');
});

test('cada lección pertenece a una etapa existente y las etapas van en orden', () => {
  const ns = plain(STAGES.map(s => s.n));
  assert.deepEqual(ns, [1, 2, 3, 4, 5, 6, 7, 8]);
  let prev = 1;
  for (const l of LESSONS) {
    assert.ok(ns.includes(l.stage), `lección ${l.id}`);
    assert.ok(l.stage >= prev, `la lección ${l.id} retrocede de etapa`);
    prev = l.stage;
  }
});

test('requisitos: 95 % de precisión (93 % en textos), 2 aprobados y exámenes 6, 12, 18 y 28', () => {
  for (const l of LESSONS) {
    assert.equal(l.minAcc, l.stage === 6 || l.stage === 7 ? 93 : 95, `precisión de la lección ${l.id}`);
    assert.equal(l.passes, l.type === 'posture' ? 1 : 2, `aprobados de la lección ${l.id}`);
  }
  assert.deepEqual(plain(LESSONS.filter(l => l.exam).map(l => l.id)), [6, 12, 18, 28]);
  assert.equal(c.FOCUS_MIN_ACC, 90);
});

test('la velocidad mínima nunca baja de una lección a la siguiente dentro de cada etapa de textos', () => {
  for (const st of [6, 8]) {
    const texts = LESSONS.filter(l => l.stage === st);
    for (let i = 1; i < texts.length; i++) assert.ok(texts[i].minWpm >= texts[i - 1].minWpm, `lección ${texts[i].id}`);
  }
  assert.deepEqual(plain(LESSONS.filter(l => l.stage === 6).map(l => l.minWpm)), [14, 16, 17, 18, 20]);
  assert.deepEqual(plain(LESSONS.filter(l => l.stage === 8).map(l => l.minWpm)), [25, 30, 35]);
});

test('las lecciones de teclas introducen todas las letras del alfabeto una sola vez', () => {
  const intro = LESSONS.filter(l => l.type === 'keys').map(l => l.newKeys).join('');
  const letters = [...intro].filter(ch => /[a-zñ]/.test(ch));
  assert.equal(new Set(letters).size, letters.length, 'alguna letra se introduce dos veces');
  assert.deepEqual([...new Set(letters)].sort(), [...'abcdefghijklmnñopqrstuvwxyz'].sort());
});

test('las primeras lecciones tienen al menos 120 caracteres', () => {
  for (const l of LESSONS.filter(l => l.type === 'keys')) assert.ok(l.len >= 120, `lección ${l.id}: ${l.len}`);
});

test('las teclas nuevas que se evalúan coinciden con lo que enseña cada lección', () => {
  const byId = id => LESSONS.find(l => l.id === id);
  assert.equal(byId(1).focusChars, 'fj');
  assert.equal(byId(14).focusChars, 'c,');
  assert.equal(byId(6).focusChars, '', 'los repasos no tienen teclas nuevas');
  assert.ok(/^[A-ZÑ]+$/.test(byId(19).focusChars), 'mayúsculas');
  assert.equal(byId(20).focusChars, 'áéíóúÁÉÍÓÚ');
  assert.equal(byId(21).focusChars, '¿?¡!:;');
  assert.equal(byId(22).focusChars, '12345');
  assert.equal(byId(23).focusChars, '67890');
  assert.equal(byId(25).focusChars, '');
});

for (const l of LESSONS.filter(l => l.make && l.type !== 'write')) {
  test(`lección ${l.id} (${l.title}): el texto generado se puede escribir y respeta lo aprendido`, () => {
    for (let i = 0; i < RUNS; i++) {
      const t = l.make().replace(/\s+/g, ' ').trim();
      assert.ok(t.length >= 60, `texto demasiado corto (${t.length})`);
      assert.ok(typeable(t), `carácter no escribible en: ${t}`);
      assert.ok(!/  /.test(t));
      if (l.type === 'keys') {
        const bad = [...new Set(t)].filter(ch => ch !== ' ' && !l.allowed.includes(ch));
        assert.deepEqual(bad, [], `usa teclas aún no enseñadas: ${bad.join('')}`);
        if (l.len) assert.ok(t.length >= l.len * 0.9, `longitud ${t.length} < ${l.len}`);
        for (const k of l.newKeys) assert.ok(t.includes(k), `no practica la tecla nueva «${k}»`);
      }
      if (l.type === 'numbers') {
        for (const d of l.focusDigits || l.digits) assert.ok(t.includes(d), `no aparece el ${d}`);
        assert.ok(![...t].some(ch => /\d/.test(ch) && !l.digits.includes(ch)), 'usa números no enseñados');
      }
      if (l.type === 'caps') assert.ok(/[A-ZÑ]/.test(t));
      if (l.type === 'accents') assert.ok(/[áéíóú]/.test(t));
      if (l.type === 'punct') for (const s of '¿?¡!') assert.ok(t.includes(s), s);
      if (['long', 'speed', 'real'].includes(l.type)) assert.ok(t.length >= 250);
    }
  });
}

test('la lección 0 no genera texto: es la explicación de la postura', () => {
  const l0 = LESSONS[0];
  assert.equal(l0.type, 'posture');
  assert.equal(l0.make, undefined);
});

test('los 32 textos y todas las frases se pueden escribir con lo que enseña el curso', () => {
  assert.equal(TEXTS.length, 32);
  for (const t of TEXTS) {
    assert.ok(typeable(t), t);
    assert.ok(!/  /.test(t) && t === t.trim());
  }
  assert.equal(new Set(TEXTS).size, TEXTS.length, 'textos repetidos');
});

test('takeText no repite textos hasta haber usado 20 distintos', () => {
  const cc = loadClient();
  const seen = [];
  for (let i = 0; i < 21; i++) seen.push(cc.takeText());
  assert.equal(new Set(seen).size, 21);
});

test('takeText funciona aunque el navegador no deje guardar datos', () => {
  const cc = loadClient();
  cc.storage.fail = true;
  assert.ok(cc.TEXTS.includes(cc.takeText()));
});

test('sanitizeText: convierte comillas y rayas, y quita lo que no se enseña', () => {
  const r = c.sanitizeText('“Hola” — dijo… ‘ana’@cole.es\n\tadiós   €', ch => !!KB.getSteps(ch));
  assert.equal(r.text, '"Hola" - dijo... \'ana\'cole.es adiós');
  assert.equal(r.removed, 2);
});

test('sanitizeText: texto vacío o nulo', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(c.sanitizeText(null, () => true))), { text: '', removed: 0 });
});

test('práctica libre: sin límite usa el texto tal cual; cronometrada lo repite para que sobre', () => {
  const free = c.freeLesson('Mi texto', 'hola que tal', 0);
  assert.equal(free.make(), 'hola que tal');
  assert.equal(free.timeLimit, 0);
  assert.ok(free.custom && free.free);
  const timed = c.freeLesson('Prueba', 'hola que tal', 60);
  assert.equal(timed.timeLimit, 60);
  assert.ok(timed.make().length >= 480);
  assert.equal(timed.id, 'prueba');
});

test('repaso personalizado: se centra en las teclas pedidas y solo usa letras aprendidas', () => {
  const learned = LESSONS.find(l => l.id === 6).allowed;
  const l = c.customLesson(['g', 'h'], learned, 7);
  for (let i = 0; i < RUNS; i++) {
    const t = l.make();
    assert.ok(t.startsWith('ggg hhh'));
    assert.ok([...t].every(ch => ch === ' ' || learned.includes(ch)), t);
  }
  assert.equal(l.minAcc, 95);
  assert.ok(l.custom);
});

test('temas de escritura libre: 20, distintos y sin repetir', () => {
  assert.equal(c.TOPICS.length, 20);
  assert.equal(new Set(c.TOPICS).size, 20);
  assert.ok(c.TOPICS.includes(c.writingTopic()));
});

test('calidad de la escritura libre: acepta un texto normal', () => {
  const t = 'El fin de semana pasado fui al cine con mis primos. Vimos una película de aventuras muy divertida. ' +
    'Después comimos pizza en el centro y volvimos a casa andando porque hacía buen tiempo.';
  const q = c.writingQuality(t);
  assert.ok(q.words >= 30);
  assert.deepEqual(plain(q.checks), { enough: true, varied: true, real: true });
});

test('calidad de la escritura libre: detecta textos cortos, letras al azar y repeticiones', () => {
  assert.equal(c.writingQuality('hola que tal estoy bien').checks.enough, false, 'pocas palabras');
  const random = Array.from({ length: 40 }, (_, i) => 'sdfgh jklñ qwrt xzcv bnmp'.split(' ')[i % 5] + i).join(' ');
  assert.equal(c.writingQuality(random).checks.real, false, 'letras sin vocales');
  assert.equal(c.writingQuality('aaaaa eeeee ' + 'casa '.repeat(5)).checks.real, false, 'teclas aporreadas');
  const rep = 'hola '.repeat(30) + 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte';
  assert.equal(c.writingQuality(rep).checks.varied, false, 'la misma palabra una y otra vez');
  assert.deepEqual(plain(c.writingQuality('').checks), { enough: false, varied: false, real: false });
});

test('calentamiento: 1 minuto, centrado en las teclas pedidas y solo con letras aprendidas', () => {
  const learned = LESSONS.find(l => l.id === 12).allowed;
  const w = c.warmupLesson(['q', 'p'], learned);
  assert.deepEqual([w.warmup, w.timeLimit, w.custom, w.minAcc], [true, 60, true, 90]);
  for (let i = 0; i < RUNS; i++) {
    const t = w.make();
    assert.ok(t.length >= 700, 'texto de sobra para un minuto');
    assert.ok(t.startsWith('qqq ppp'));
    assert.ok([...t].every(ch => ch === ' ' || learned.includes(ch)));
  }
});
