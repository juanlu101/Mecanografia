/* Recorrido del alumno: perfil, lección 0, reglas para aprobar, examen, Mayús, tildes, tiempo activo… */
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServers } = require('../helpers/servers');
const H = require('../helpers/browser');

let env, browser;
before(async () => { env = await startServers(); browser = await H.launch(); });
after(async () => { await browser.close(); await env.stop(); });
beforeEach(() => env.reset()); // cada prueba empieza con la hoja vacía

async function newStudent(opts = {}, name = 'Lucía Pérez', group = '1º ESO A', pin = '24680') {
  const { context, page } = await H.openApp(browser, env, opts);
  await H.createStudent(page, name, group, pin);
  assert.ok(await page.isVisible('#screen-map'), 'debería entrar al mapa');
  return { context, page };
}
const lessonOpen = (page, id) => page.click(`.tile[data-lesson="${id}"]`);
const stored = page => page.evaluate(() => Object.values(Store.load().profiles)[0]);

describe('crear perfil', () => {
  test('el grupo es obligatorio y se elige de la lista de 18', async () => {
    const { context, page } = await H.openApp(browser, env);
    const opts = await page.$$eval('select[name=group] option', o => o.map(x => x.value).filter(Boolean));
    assert.equal(opts.length, 18);
    await page.fill('input[name=name]', 'Ana'); await page.fill('input[name=pin]', '12345');
    await page.click('#new-profile button[type=submit]');
    assert.ok(await page.isVisible('#screen-profiles'), 'sin grupo no entra');
    assert.equal(await page.evaluate(() => Object.keys(Store.load().profiles).length), 0);
    await context.close();
  });

  test('un perfil nuevo necesita un PIN de 5 cifras', async () => {
    const { context, page } = await H.openApp(browser, env);
    await H.createStudent(page, 'Ana Gil', '1º ESO B', '1234');
    assert.match(await page.textContent('#new-msg'), /5 números/);
    await H.createStudent(page, 'Ana Gil', '1º ESO B', '12a45');
    assert.equal(await page.inputValue('input[name=pin]'), '1245', 'las letras se quitan');
    assert.match(await page.textContent('#new-msg'), /5 números/);
    await H.createStudent(page, 'Ana Gil', '1º ESO B', '12345');
    assert.ok(await page.isVisible('#screen-map'));
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  test('el campo PIN solo admite números y como mucho 5', async () => {
    const { context, page } = await H.openApp(browser, env);
    await page.type('input[name=pin]', 'a1b2c3d4e5f6');
    assert.equal(await page.inputValue('input[name=pin]'), '12345');
    await context.close();
  });

  test('el título del formulario explica cómo entrar', async () => {
    const { context, page } = await H.openApp(browser, env);
    assert.equal(await page.textContent('#new-title'), 'Entrar con mi nombre');
    assert.match(await page.textContent('#new-sub'), /PIN de siempre/);
    assert.match(await page.textContent('.credits'), /Juan Luis Torralbo Muñoz/);
    await context.close();
  });
});

describe('lección 0 y primeras lecciones', () => {
  test('solo están abiertas la lección 0 y la 1 no hasta hacer la 0', async () => {
    const { context, page } = await newStudent();
    assert.equal(await page.isDisabled('.tile[data-lesson="0"]'), false);
    assert.equal(await page.isDisabled('.tile[data-lesson="1"]'), true);
    assert.match(await page.textContent('#summary .continue'), /antes de nada/);
    await context.close();
  });

  test('lección 0: no se avanza sin comprobar el teclado ni sin colocar los dedos', async () => {
    const { context, page } = await newStudent();
    await lessonOpen(page, 0);
    await page.click('#posture-next'); await page.click('#posture-next');
    assert.equal(await page.isDisabled('#posture-next'), true);
    await H.key(page, 'Semicolon', ';');
    assert.match(await page.textContent('#p-status'), /Español \(España\)/, 'detecta teclado no español');
    await H.key(page, 'KeyL', 'l');
    assert.match(await page.textContent('#p-status'), /a la derecha de la L/);
    assert.equal(await page.isDisabled('#posture-next'), true);
    await H.key(page, 'Semicolon', 'ñ');
    assert.match(await page.textContent('#p-status'), /español/);
    await page.click('#posture-next');
    assert.equal(await page.isDisabled('#posture-next'), true);
    await H.key(page, 'KeyA', 'a'); await H.key(page, 'KeyF', 'f');
    assert.equal(await page.$$eval('#p-seq kbd.done', x => x.length), 1, 'una tecla equivocada no avanza');
    for (const [c, k] of [['KeyS', 's'], ['KeyD', 'd'], ['KeyF', 'f'], ['KeyJ', 'j'], ['KeyK', 'k'], ['KeyL', 'l'], ['Semicolon', 'ñ'], ['Space', ' ']]) await H.key(page, c, k);
    assert.equal(await page.isDisabled('#posture-next'), false);
    await page.click('#posture-next'); await page.click('#posture-next');
    assert.match(await page.textContent('#lesson-title'), /Lección 1/i);
    const p = await stored(page);
    assert.equal(p.lessons[0].passed, true);
    await context.close();
  });

  test('lección 1: hay que aprobarla 2 veces; tras la primera el mapa muestra «1 de 2»', async () => {
    const { context, page } = await newStudent();
    await H.doPosture(page);
    assert.match(await page.textContent('#intro-goal'), /2 veces.*95%.*5 palabras.*90% de las teclas nuevas/);
    await H.playLesson(page);
    assert.match(await page.textContent('#res-title'), /Aprobada! 1 de 2/);
    assert.equal(await page.isHidden('#btn-next'), true);
    await page.click('#btn-map');
    assert.match(await page.textContent('.tile[data-lesson="1"]'), /Aprobada 1 de 2/);
    assert.equal(await page.isDisabled('.tile[data-lesson="2"]'), true);
    await lessonOpen(page, 1);
    assert.match(await page.textContent('#intro-goal'), /Te falta una/);
    await H.playLesson(page);
    assert.match(await page.textContent('#res-title'), /Lección superada/);
    assert.equal(await page.isVisible('#btn-next'), true);
    await page.keyboard.press('Enter');
    assert.match(await page.textContent('#lesson-title'), /Lección 2/);
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  test('suspender por precisión: no cuenta como aprobado y explica por qué', async () => {
    const { context, page } = await newStudent();
    await H.doPosture(page);
    await H.playLesson(page, { errorsEvery: 8 });
    assert.match(await page.textContent('#res-title'), /otra vez/);
    assert.match(await page.textContent('#res-msg'), /más despacio/);
    assert.match(await page.textContent('#res-acc-goal'), /✗ objetivo: 95%/);
    assert.equal((await stored(page)).lessons[1].passes || 0, 0);
    await context.close();
  });

  test('suspender por las teclas nuevas aunque la precisión general sea buena', async () => {
    const { context, page } = await newStudent();
    await page.evaluate(() => { const d = Store.load(); const p = Object.values(d.profiles)[0]; p.lessons = { 0: { passed: true }, 1: { passed: true, passes: 2 }, 2: { passed: true, passes: 2 }, 3: { passed: true, passes: 2 }, 4: { passed: true, passes: 2 } }; Store.save(d); });
    await page.reload(); await H.loginFromList(page, 'Lucía', '24680');
    await lessonOpen(page, 5); // G y H: pocas apariciones de las teclas nuevas en un texto largo
    await page.keyboard.press('Space');
    // falla solo en algunas G/H: lo justo para bajar del 90 % en las nuevas sin bajar del 95 % en total
    await page.evaluate(() => {
      const t = __text(); let n = 0;
      for (const ch of t) { if ('gh'.includes(ch) && n++ % 4 === 0) __fire('keydown', { key: '#', code: 'Backslash' }); __type(ch); }
    });
    await page.waitForSelector('#screen-results:not([hidden])');
    const goals = await page.textContent('#res-acc-goal');
    assert.match(goals, /✗ teclas nuevas/);
    if (/✓ objetivo: 95%/.test(goals)) assert.match(await page.textContent('#res-msg'), /teclas nuevas/);
    await context.close();
  });

  test('pausa con Esc: el tiempo de la pausa no cuenta y se puede continuar', async () => {
    const { context, page } = await newStudent();
    await H.doPosture(page);
    await page.keyboard.press('Space');
    await page.evaluate(() => __typeAll({ stopAt: 10 }));
    await page.keyboard.press('Escape');
    assert.equal(await page.textContent('#intro-eyebrow'), 'Pausa');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Space');
    await page.evaluate(() => { const t = __text(); for (const ch of t.slice(10)) __type(ch); });
    await page.waitForSelector('#screen-results:not([hidden])');
    assert.match(await page.textContent('#res-time'), /^\d s$/, 'la pausa de 1,5 s no se suma');
    await context.close();
  });

  test('el tiempo sin escribir no cuenta como práctica (máximo 5 s entre teclas)', async () => {
    const { context, page } = await newStudent();
    await H.doPosture(page);
    await page.keyboard.press('Space');
    await page.evaluate(() => __type(__text()[0]));
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const t = __text(); for (const ch of t.slice(1)) __type(ch); });
    await page.waitForSelector('#screen-results:not([hidden])');
    const p = await stored(page);
    const today = await page.evaluate(() => Store.dayKey());
    assert.ok(p.days[today] <= 6, `cuenta ${p.days[today]} s en vez de ~5`);
    assert.ok(p.days[today] >= 4);
    await context.close();
  });
});

describe('teclas especiales', () => {
  const unlocked = { config: { UNLOCK_ALL: true } };

  test('examen de etapa: sin teclado ni manos y con aviso', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 6);
    assert.match(await page.textContent('#intro-eyebrow'), /Examen de etapa/);
    assert.match(await page.textContent('#intro-goal'), /Examen sin ayudas/);
    await page.keyboard.press('Space');
    assert.equal(await page.isVisible('#kb'), false);
    assert.equal(await page.isVisible('#hands'), false);
    assert.match(await page.textContent('#hint'), /sin ayudas/);
    assert.match(await page.textContent('.tile-exam, #lesson-title'), /Examen/i);
    await context.close();
  });

  test('Mayús con la misma mano o Bloq Mayús cuentan como error; con la mano contraria avanza', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 19);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => __text()[0]), 'F');
    await page.evaluate(() => { __fire('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true }); __fire('keydown', { key: 'F', code: 'KeyF', shiftKey: true }); __fire('keyup', { key: 'Shift', code: 'ShiftLeft' }); });
    assert.match(await page.textContent('#hint'), /otra mano.*derecha/);
    await page.evaluate(() => __fire('keydown', { key: 'F', code: 'KeyF', shiftKey: false }));
    assert.match(await page.textContent('#hint'), /no Bloq Mayús/);
    assert.equal(await page.$$eval('#text .ch.ok, #text .ch.fixed', x => x.length), 0);
    await page.evaluate(() => __type('F'));
    assert.equal(await page.$$eval('#text .ch.fixed', x => x.length), 1);
    assert.doesNotMatch(await page.textContent('#hint'), /otra mano/);
    // la J usa la Mayús izquierda
    await page.evaluate(() => { __type('f'); __type(' '); });
    await page.evaluate(() => { __fire('keydown', { key: 'Shift', code: 'ShiftRight', shiftKey: true }); __fire('keydown', { key: 'J', code: 'KeyJ', shiftKey: true }); __fire('keyup', { key: 'Shift', code: 'ShiftRight' }); });
    assert.match(await page.textContent('#hint'), /izquierda/);
    await context.close();
  });

  test('tildes: primero la tecla de la tilde y luego la vocal; la pista lo explica', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 20);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => __text()[0]), 'á');
    assert.match(await page.textContent('#hint'), /primero la tilde/);
    await page.evaluate(() => __fire('keydown', { key: 'Dead', code: 'Quote' }));
    assert.match(await page.textContent('#hint'), /ahora la vocal/);
    await page.evaluate(() => __fire('keydown', { key: 'á', code: 'KeyA' }));
    assert.equal(await page.$$eval('#text .ch.ok', x => x.length), 1);
    // tilde equivocada (con Mayús = diéresis) cuenta como error
    await page.evaluate(() => { __type(' '); __fire('keydown', { key: 'Dead', code: 'Quote', shiftKey: true }); });
    assert.ok((await page.textContent('#live-acc')) !== '100');
    await H.playLesson(page).catch(() => {});
    await context.close();
  });

  test('lección de tildes completa escrita correctamente se aprueba', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 20);
    await H.playLesson(page);
    assert.match(await page.textContent('#res-title'), /Aprobada|Perfecto|Muy bien|superada/);
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  test('todas las lecciones (1 a 33, salvo la escritura libre) se pueden completar escribiendo bien', async () => {
    const { context, page } = await newStudent(unlocked);
    for (let id = 1; id <= 33; id++) {
      if (id === 30) continue; // la escritura libre se prueba aparte
      await lessonOpen(page, id);
      await H.playLesson(page);
      const title = await page.textContent('#res-title');
      assert.doesNotMatch(title, /otra vez/, `lección ${id}: ${title} — ${await page.textContent('#res-msg')}`);
      await page.click('#btn-map');
    }
    assert.deepEqual(page.errors, []);
    await context.close();
  });

  test('aviso si el teclado no está en español', async () => {
    const { context, page } = await newStudent();
    await H.doPosture(page);
    await page.keyboard.press('Space');
    for (let i = 0; i < 3; i++) await H.key(page, 'KeyQ', 'a');
    assert.equal(await page.isVisible('#layout-warning'), true);
    assert.match(await page.textContent('#layout-warning'), /Español \(España\)/);
    await context.close();
  });
});

describe('práctica libre, diploma y etapa avanzada', () => {
  test('práctica libre: limpia el texto pegado y no cuenta para desbloquear', async () => {
    const { context, page } = await newStudent({ config: { UNLOCK_ALL: true } });
    await page.click('#btn-free');
    await page.selectOption('select[name=src]', 'paste');
    await page.fill('textarea[name=text]', 'Escribe a “ana@cole.es” — ya…');
    await page.click('#free-form button[type=submit]');
    assert.equal(await page.evaluate(() => __text()), 'Escribe a "anacole.es" - ya...');
    assert.match(await page.textContent('#intro-tip'), /1 carácter/);
    await H.playLesson(page);
    assert.match(await page.textContent('#res-title'), /Texto completado/);
    assert.equal(await page.isVisible('#res-stars'), false);
    const p = await stored(page);
    assert.equal(p.tests.length, 1);
    await context.close();
  });

  test('práctica libre: texto demasiado corto', async () => {
    const { context, page } = await newStudent({ config: { UNLOCK_ALL: true } });
    await page.click('#btn-free');
    await page.selectOption('select[name=src]', 'paste');
    await page.fill('textarea[name=text]', '@@@ €€ hola');
    await page.click('#free-form button[type=submit]');
    assert.match(await page.textContent('#free-msg'), /demasiado corto/);
    await context.close();
  });

  test('prueba cronometrada de 1 minuto: termina sola al acabar el tiempo', async () => {
    const { context, page } = await H.openApp(browser, env, { clock: true, config: { UNLOCK_ALL: true } });
    await H.createStudent(page, 'Hugo Sanz', '2º ESO A', '13579');
    await page.click('#btn-free');
    await page.check('input[name=t][value="60"]', { force: true });
    await page.click('#free-form button[type=submit]');
    await page.keyboard.press('Space');
    await page.evaluate(() => __typeAll({ stopAt: 50 }));
    await page.clock.runFor(30000);
    assert.match(await page.textContent('#live-timer'), /^0:3[01]$/);
    await page.clock.runFor(31000);
    await page.waitForSelector('#screen-results:not([hidden])');
    assert.match(await page.textContent('#res-title'), /Prueba de 1 min terminada/);
    assert.equal(await page.textContent('#res-wpm'), '10', '50 caracteres en 1 minuto = 10 ppm');
    await context.close();
  });

  test('práctica libre bloqueada hasta aprender todas las letras', async () => {
    const { context, page } = await newStudent();
    assert.equal(await page.isDisabled('#btn-free'), true);
    assert.equal(await page.isDisabled('#btn-review'), true);
    await context.close();
  });

  test('al terminar el curso: diploma y acceso a la etapa avanzada; el avanzado aparece en el diploma', async () => {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.seedProfile(page, { name: 'Hugo Sanz', group: '1º ESO A', lessons: H.allPassed([...Array(32).keys()]) }, '12345');
    await page.reload(); await H.loginFromList(page, 'Hugo', '12345');
    assert.match(await page.textContent('#summary'), /31\/31/);
    assert.match(await page.textContent('#summary'), /1\/3/);
    assert.match(await page.textContent('#summary .continue'), /Mi diploma.*Nivel avanzado: 30 ppm/s);
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.click('#btn-diploma');
    assert.equal(await page.evaluate(() => window.__printed), true);
    assert.equal(await page.textContent('#dip-name'), 'Hugo Sanz');
    assert.match(await page.textContent('#dip-adv'), /25 palabras/);
    await page.emulateMedia({ media: 'print' });
    assert.equal(await page.isVisible('#diploma'), true);
    assert.equal(await page.isVisible('#app'), false);
    await context.close();
  });

  test('un alumno a medias no ve el diploma', async () => {
    const { context, page } = await newStudent();
    assert.equal(await page.$('#btn-diploma'), null);
    await context.close();
  });

  test('mapa de calor de teclas: aparece cuando hay datos y colorea las teclas con errores', async () => {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.seedProfile(page, { name: 'Ana', group: '1º ESO A', keys: { f: { h: 100, e: 1 }, j: { h: 50, e: 30 }, k: { h: 2, e: 2 } } }, '12345');
    await page.reload(); await H.loginFromList(page, 'Ana', '12345');
    assert.equal(await page.isVisible('#heat-section'), true);
    const bg = c => page.$eval(`#heat [data-code="${c}"]`, n => n.style.background);
    assert.match(await bg('KeyF'), /rgb\(\d+, 2\d\d, \d+\)|hsl\(1[01]\d/, 'F casi sin errores: verde');
    assert.match(await bg('KeyJ'), /rgb\(2\d\d, \d{1,3}, \d{1,3}\)|hsl\(0/, 'J con muchos errores: rojo');
    assert.equal(await bg('KeyK'), '', 'pocas pulsaciones: sin color');
    await context.close();
  });
});

describe('calentamiento diario', () => {
  async function studentAt(lessonsPassed) {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.seedProfile(page, { name: 'Ana Ruiz', group: '1º ESO A', lessons: H.allPassed(lessonsPassed), keys: { g: { h: 10, e: 8 }, h: { h: 20, e: 6 } } }, '12345');
    await page.reload(); await H.loginFromList(page, 'Ana', '12345');
    return { context, page };
  }

  test('antes de terminar la fila guía no hay calentamiento', async () => {
    const { context, page } = await studentAt([0, 1, 2, 3, 4]);
    await lessonOpen(page, 5);
    assert.match(await page.textContent('#intro-eyebrow'), /Lección 5/);
    await context.close();
  });

  test('la primera lección del día empieza con 1 minuto de calentamiento y después sigue', async () => {
    const { context, page } = await studentAt([0, 1, 2, 3, 4, 5, 6]);
    await lessonOpen(page, 7);
    assert.match(await page.textContent('#intro-eyebrow'), /Calentamiento diario · 1 minuto/);
    assert.match(await page.textContent('#intro-goal'), /una vez al día/);
    assert.equal(await page.isVisible('#live-timer-box'), true);
    assert.ok((await page.evaluate(() => __text())).startsWith('ggg hhh'), 'centrado en las teclas que más falla');
    await H.playLesson(page);
    assert.equal(await page.textContent('#res-title'), '¡Calentamiento hecho!');
    assert.equal(await page.isVisible('#res-stars'), false);
    assert.equal(await page.textContent('#btn-next'), 'Seguir: lección 7 →');
    await page.click('#btn-next');
    assert.match(await page.textContent('#intro-eyebrow'), /Lección 7/);
    await page.click('#btn-back');
    await lessonOpen(page, 5);
    assert.match(await page.textContent('#intro-eyebrow'), /Lección 5/, 'solo una vez al día');
    await context.close();
  });

  test('salir del calentamiento sin hacerlo no lo salta', async () => {
    const { context, page } = await studentAt([0, 1, 2, 3, 4, 5, 6]);
    await lessonOpen(page, 7);
    await page.keyboard.press('Escape');
    await lessonOpen(page, 7);
    assert.match(await page.textContent('#intro-eyebrow'), /Calentamiento/);
    await context.close();
  });

  test('la práctica libre y el repaso no piden calentamiento', async () => {
    const { context, page } = await studentAt([...Array(19).keys()]);
    await page.click('#btn-review');
    assert.match(await page.textContent('#intro-eyebrow'), /Repaso personalizado/);
    await context.close();
  });
});

describe('escribir de verdad', () => {
  const unlocked = { config: { UNLOCK_ALL: true } };

  test('modo real: un error no bloquea, se marca en rojo y se corrige con la tecla de borrar', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 29);
    assert.match(await page.textContent('#intro-goal'), /sin dejar ningún error sin corregir/);
    await page.keyboard.press('Space');
    await page.evaluate(() => { const t = __text(); __type(t[0] === 'x' ? 'y' : 'x'); });
    assert.equal(await page.$$eval('#text .ch.bad', x => x.length), 1, 'el error queda marcado');
    assert.match(await page.textContent('#hint'), /sin corregir.*⟵.*meñique derecho/);
    assert.ok(await page.$('#kb [data-code="Backspace"].next'), 'se ilumina la tecla de borrar');
    await page.keyboard.press('Backspace');
    assert.equal(await page.$$eval('#text .ch.bad', x => x.length), 0);
    await page.evaluate(() => __typeAll());
    await page.waitForSelector('#screen-results:not([hidden])');
    assert.match(await page.textContent('#res-err'), /1 error · 1 borrados/);
    assert.match(await page.textContent('#res-title'), /Aprobada|Muy bien|Perfecto/);
    await context.close();
  });

  test('modo real: no se termina mientras quede un error sin borrar', async () => {
    const { context, page } = await newStudent(unlocked);
    await lessonOpen(page, 29);
    await page.keyboard.press('Space');
    const len = await page.evaluate(() => {
      const t = __text();
      __type(t[0]); __type(t[1] === 'x' ? 'y' : 'x'); // error en la segunda letra
      for (const ch of t.slice(2)) __type(ch);
      return t.length;
    });
    assert.equal(await page.isVisible('#screen-lesson'), true, 'sigue en la lección');
    assert.match(await page.textContent('#hint'), /un error sin corregir/);
    for (let i = 0; i < len - 1; i++) await page.keyboard.press('Backspace');
    assert.equal(await page.$$eval('#text .ch.bad', x => x.length), 0);
    await page.evaluate(() => { const t = __text(); for (const ch of t.slice(1)) __type(ch); });
    await page.waitForSelector('#screen-results:not([hidden])');
    assert.match(await page.textContent('#res-err'), new RegExp(`${len - 1} borrados`));
    await context.close();
  });

  const GOOD = 'El sábado por la mañana fui al mercado con mi abuela. Compramos fruta fresca, pan y queso. ' +
    'Por la tarde quedé con mis amigos en el parque y jugamos al fútbol hasta que se hizo de noche. ' +
    'El domingo vimos una película en casa y cenamos pizza.';

  async function writeFor3Min(page, text) {
    await page.click('.tile[data-lesson="30"]');
    assert.match(await page.textContent('#intro-goal'), /Tema:.*20 palabras distintas/s);
    await page.keyboard.press('Space');
    await page.evaluate(t => { for (const ch of t) __type(ch); }, text);
    await page.clock.runFor(181000);
    await page.waitForSelector('#screen-results:not([hidden])');
  }

  test('escritura libre: 3 minutos sobre un tema, sin texto que copiar; se puede borrar', async () => {
    const { context, page } = await H.openApp(browser, env, Object.assign({ clock: true }, unlocked));
    await H.createStudent(page, 'Ana Ruiz', '1º ESO A', '12345');
    await page.click('.tile[data-lesson="30"]');
    await page.keyboard.press('Space');
    assert.match(await page.textContent('#hint'), /Tema:.*0 palabras/);
    assert.equal(await page.$$eval('#text .ch', x => x.length), 0, 'no hay texto modelo');
    await page.evaluate(() => { for (const ch of 'Hola mundoo') __type(ch); });
    await page.keyboard.press('Backspace');
    assert.match(await page.textContent('#text'), /^Hola mundo$/);
    assert.match(await page.textContent('#hint'), /2 palabras/);
    assert.equal(await page.textContent('#live-acc'), '—');
    await context.close();
  });

  test('escritura libre: un texto de verdad aprueba y llega a la hoja del profesor/a', async () => {
    const { context, page } = await H.openApp(browser, env, Object.assign({ clock: true }, unlocked));
    await H.createStudent(page, 'Ana Ruiz', '1º ESO A', '12345');
    await writeFor3Min(page, GOOD);
    assert.match(await page.textContent('#res-title'), /Aprobada! 1 de 2/);
    assert.equal(await page.textContent('#res-acc + span'), 'palabras');
    assert.match(await page.textContent('#res-acc-goal'), /✓ \d+ distintas/);
    await page.click('.my-text summary');
    assert.match(await page.textContent('.my-text'), /mercado con mi abuela/);
    await page.waitForFunction(() => Sync.pending() === 0);
    const row = env.sheet('Resultados').find(r => r['Lección'] === 30);
    assert.equal(row['Texto (escritura libre)'], GOOD);
    assert.match(row['Título'], /^Escritura libre: /);
    const p = await stored(page);
    assert.equal(p.writings.length, 1);
    await context.close();
  });

  test('escritura libre: letras al azar o muy poco texto no aprueban y se explica por qué', async () => {
    const { context, page } = await H.openApp(browser, env, Object.assign({ clock: true, sync: false }, unlocked));
    await H.createStudent(page, 'Ana Ruiz', '1º ESO A', '12345');
    await writeFor3Min(page, 'asdf jklñ qwer tyui asdf jklñ '.repeat(8));
    assert.match(await page.textContent('#res-title'), /otra vez/);
    assert.match(await page.textContent('#res-msg'), /palabras distintas|letras al azar/);
    await page.click('#btn-map');
    await writeFor3Min(page, 'Hoy hace sol.');
    assert.match(await page.textContent('#res-msg'), /al menos 20 palabras distintas/);
    await context.close();
  });
});
