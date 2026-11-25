/* Casos varios: tabletas, versiones anteriores, repaso, pantallas */
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServers } = require('../helpers/servers');
const H = require('../helpers/browser');

let env, browser;
before(async () => { env = await startServers(); browser = await H.launch(); });
after(async () => { await browser.close(); await env.stop(); });
beforeEach(() => env.reset());

describe('dispositivos', () => {
  test('tableta sin teclado: aviso; se quita al pulsar «Tengo teclado» y no vuelve', async () => {
    const { context, page } = await H.openApp(browser, env, { context: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true } });
    assert.equal(await page.isVisible('#touch-warning'), true);
    await page.click('#touch-dismiss');
    assert.equal(await page.isVisible('#touch-warning'), false);
    await page.reload();
    assert.equal(await page.isVisible('#touch-warning'), false);
    await context.close();
  });

  test('ordenador con ratón: sin aviso de tableta', async () => {
    const { context, page } = await H.openApp(browser, env);
    assert.equal(await page.isVisible('#touch-warning'), false);
    await context.close();
  });

  for (const [w, h] of [[1280, 800], [1366, 680], [1024, 768]]) {
    test(`pantalla ${w}×${h}: nada se sale por los lados y el teclado cabe en la lección`, async () => {
      const { context, page } = await H.openApp(browser, env, { sync: false, context: { viewport: { width: w, height: h } } });
      await H.createStudent(page, 'Ana', '1º ESO A', '12345');
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(await overflow() <= 0, 'mapa');
      await H.doPosture(page);
      await page.keyboard.press('Space');
      assert.ok(await overflow() <= 0, 'lección');
      const kb = await page.$eval('#kb', el => el.getBoundingClientRect());
      assert.ok(kb.right <= w && kb.left >= 0, 'el teclado cabe a lo ancho');
      await context.close();
    });
  }
});

describe('alumnos de versiones anteriores', () => {
  test('perfil antiguo: el reto final pasa a la lección 28, se borra el PIN en texto y sigue donde iba', async () => {
    const lessons = Object.fromEntries([...Array(27).keys()].map(i => [i, { passed: true, attempts: 1, best: { wpm: 20, acc: 97, stars: 2 } }]));
    const old = { current: null, profiles: { pold: { id: 'pold', name: 'Hugo Sanz', group: '1º ESO A', pin: null, pinTxt: '4321', lessons } } };
    const { context, page } = await H.openApp(browser, env, { sync: false, storage: { 'teclea:v1': JSON.stringify(old) } });
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('teclea:v1')); d.profiles.pold.pin = Store.hashPin('4321'); localStorage.setItem('teclea:v1', JSON.stringify(d)); });
    await page.reload();
    assert.ok(!(await page.evaluate(() => localStorage.getItem('teclea:v1'))).includes('"pinTxt"'));
    await H.loginFromList(page, 'Hugo', '4321');
    assert.match(await page.textContent('#summary .continue'), /lección 26/);
    assert.match(await page.textContent('.tile[data-lesson="28"]'), /★/);
    assert.equal(await page.isDisabled('.tile[data-lesson="27"]'), true);
    assert.equal(await page.isDisabled('.tile[data-lesson="29"]'), false, 'con el reto superado, se abre la nueva etapa');
    assert.equal(await page.isDisabled('.tile[data-lesson="30"]'), true);
    await context.close();
  });
});

describe('repaso personalizado', () => {
  test('se activa tras aprender letras y se centra en las teclas más falladas', async () => {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.seedProfile(page, { name: 'Ana', group: '1º ESO A', lessons: H.allPassed([0, 1, 2, 3, 4, 5, 6]), keys: { a: { h: 100, e: 1 }, g: { h: 20, e: 15 }, h: { h: 30, e: 10 }, s: { h: 50, e: 0 } } }, '12345');
    await page.reload(); await H.loginFromList(page, 'Ana', '12345');
    assert.equal(await page.isDisabled('#btn-review'), false);
    await page.click('#btn-review');
    assert.match(await page.textContent('#intro-eyebrow'), /Repaso personalizado/);
    const text = await page.evaluate(() => __text());
    assert.ok(text.startsWith('ggg hhh'), text.slice(0, 20));
    await H.playLesson(page);
    assert.match(await page.textContent('#res-title'), /Repaso completado/);
    assert.equal(await page.isHidden('#btn-next'), true);
    await context.close();
  });
});

describe('sin errores en ninguna pantalla', () => {
  test('recorrer todas las pantallas no produce errores de JavaScript', async () => {
    const { context, page } = await H.openApp(browser, env, { config: { UNLOCK_ALL: true } });
    await H.createStudent(page, 'Ana Ruiz', '1º ESO A', '12345');
    await page.click('#settings summary');
    for (const s of ['kb', 'hands', 'sound']) await page.click(`[data-setting=${s}]`);
    await page.click('.tile[data-lesson="3"]');
    await page.keyboard.press('Space');
    assert.equal(await page.isVisible('#kb'), false, 'ajuste de ocultar teclado');
    await page.keyboard.press('Escape'); await page.click('#btn-back');
    await page.click('#btn-export'); await page.click('[data-close]');
    await page.click('#btn-free'); await page.click('[data-close]');
    await page.click('[data-tab=clases]');
    await page.click('#btn-switch');
    await page.click('#btn-import-start'); await page.click('[data-close]');
    await H.teacherLogin(page, env.gas.server.clave);
    await page.waitForSelector('#screen-teacher:not([hidden])');
    await page.click('#t-groups'); await page.click('[data-close]');
    await page.click('#t-codes'); await page.click('[data-close]');
    await page.click('#t-reload');
    await page.click('#t-exit');
    assert.deepEqual(page.errors, []);
    await context.close();
  });
});
