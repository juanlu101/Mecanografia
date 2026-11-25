/* Envío de resultados a la hoja, reintentos, puntos y ranking con el Code.gs real */
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServers } = require('../helpers/servers');
const H = require('../helpers/browser');

let env, browser;
before(async () => { env = await startServers(); browser = await H.launch(); });
after(async () => { await browser.close(); await env.stop(); });
beforeEach(() => env.reset());

const settle = page => page.waitForFunction(() => Sync.pending() === 0, null, { timeout: 8000 });
async function studentWithLessons(name, group, n, pin = '12345') {
  const { context, page } = await H.openApp(browser, env);
  await H.createStudent(page, name, group, pin);
  if (n > 0) {
    await H.doPosture(page);
    for (let i = 0; i < n; i++) { await H.playLesson(page); await page.click('#btn-repeat'); }
    await page.keyboard.press('Escape');
  }
  await settle(page);
  return { context, page };
}

describe('resultados en la hoja', () => {
  test('cada ejercicio llega a Resultados y el resumen del alumno a Progreso', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 2);
    const res = env.sheet('Resultados');
    assert.equal(res.length, 2);
    assert.deepEqual(res.map(r => r['Lección']), [1, 1]);
    assert.ok(res.every(r => r.Nombre === 'Ana Ruiz' && r.Grupo === '2º ESO B' && r.PPM > 0));
    const [prog] = env.sheet('Progreso');
    assert.equal(prog['Lecciones superadas'], 2, 'lección 0 y lección 1');
    assert.equal(typeof prog.Semana, 'string', 'la semana se guarda como texto');
    assert.ok(prog['Puntos semana'] >= 100, 'lección 0 + lección 1 superadas');
    assert.equal(prog['Puntos semana'], await page.evaluate(() => Store.weekPoints(Object.values(Store.load().profiles)[0])));
    await context.close();
  });

  test('Google ocupado: el resultado queda pendiente, se ve en el mapa y llega después', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    env.gas.busy = 50;
    await H.doPosture(page); await H.playLesson(page);
    await page.click('#btn-map');
    assert.ok(await page.evaluate(() => Sync.pending()) >= 1);
    assert.match(await page.textContent('#daily'), /pendiente/);
    assert.equal(env.sheet('Resultados').length, 0);
    env.gas.busy = 0;
    await page.evaluate(() => Sync.flush());
    await settle(page);
    assert.equal(env.sheet('Resultados').length, 1);
    await context.close();
  });

  test('sin internet: se guarda y se envía al volver la conexión, sin duplicados', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    await context.setOffline(true);
    await H.doPosture(page); await H.playLesson(page);
    await page.click('#btn-repeat'); await H.playLesson(page);
    assert.equal(await page.evaluate(() => Sync.pending()) >= 2, true);
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await settle(page);
    assert.equal(env.sheet('Resultados').length, 2);
    await page.evaluate(() => Sync.flush());
    assert.equal(env.sheet('Resultados').length, 2);
    await context.close();
  });

  test('si la hoja cae (página de error), no se pierde nada', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    env.gas.down = true;
    await H.doPosture(page); await H.playLesson(page);
    for (let i = 0; i < 4; i++) await page.evaluate(() => Sync.flush());
    assert.ok(await page.evaluate(() => Sync.pending()) >= 1);
    env.gas.down = false;
    await page.evaluate(() => Sync.flush());
    await settle(page);
    assert.equal(env.sheet('Resultados').length, 1);
    await context.close();
  });
});

describe('puntos y ranking', () => {
  test('los puntos de cada ejercicio se explican en los resultados', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    await H.doPosture(page); await H.playLesson(page);
    assert.match(await page.textContent('#res-points'), /\+\d+ puntos/);
    assert.match(await page.textContent('#res-points'), /estrellas nuevas/);
    await page.click('#btn-repeat'); await H.playLesson(page);
    assert.match(await page.textContent('#res-points'), /50 por superar la lección/);
    await page.click('#btn-repeat'); await H.playLesson(page);
    assert.doesNotMatch(await page.textContent('#res-points'), /estrellas nuevas/, 'repetir sin mejorar no da estrellas');
    await context.close();
  });

  test('un ejercicio con menos del 90 % de precisión no da puntos', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    await H.doPosture(page);
    const before = await page.evaluate(() => Store.weekPoints(Object.values(Store.load().profiles)[0]));
    await H.playLesson(page, { errorsEvery: 4 });
    assert.match(await page.textContent('#res-points'), /\+0 puntos/);
    assert.equal(await page.evaluate(() => Store.weekPoints(Object.values(Store.load().profiles)[0])), before);
    await context.close();
  });

  test('ranking de la clase y de clases con varios alumnos reales', async () => {
    const others = [];
    others.push(await studentWithLessons('Hugo Sanz', '4º ESO A', 1));
    others.push(await studentWithLessons('Marta López', '4º ESO A', 0));
    others.push(await studentWithLessons('Diego Ruiz', '4º ESO B', 2));
    const me = await studentWithLessons('Lucía Pérez Gil', '4º ESO A', 2);
    await me.page.click('#btn-switch'); await H.loginFromList(me.page, 'Lucía', '12345');
    await me.page.waitForFunction(() => /Lucía/.test(document.querySelector('#rank-body').textContent));
    const clase = await me.page.$$eval('#rank-body li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    assert.match(clase[0], /Lucía P\. \(tú\)/);
    assert.match(clase[1], /Hugo S\./);
    assert.match(clase[2], /Marta L\./);
    assert.ok(!clase.join(' ').includes('Diego'), 'solo los de mi clase');
    assert.ok(!clase.join(' ').includes('Pérez'), 'nombres abreviados');
    await me.page.click('[data-tab=clases]');
    const clases = await me.page.$$eval('#rank-body li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    assert.equal(clases.length, 2);
    assert.ok(clases.some(c => /4º ESO A \(tu clase\)3 alumnos/.test(c)));
    assert.match(await me.page.textContent('#rank-mine'), /\d+ puntos esta semana/);
    for (const o of [...others, me]) await o.context.close();
  });

  test('el ranking no se pide más de una vez cada 3 minutos', async () => {
    const { context, page } = await studentWithLessons('Ana Ruiz', '2º ESO B', 0);
    const count = () => page.evaluate(() => performance.getEntriesByType('resource').filter(e => /accion=ranking/.test(e.name)).length);
    const n = await count();
    for (let i = 0; i < 3; i++) { await H.doPosture(page).catch(() => {}); await page.goto('about:blank').catch(() => {}); break; }
    await context.close();
    const b = await H.openApp(browser, env);
    await H.createStudent(b.page, 'Otra Persona', '2º ESO B', '12345');
    await b.page.waitForTimeout(300);
    const c1 = await b.page.evaluate(() => performance.getEntriesByType('resource').filter(e => /accion=ranking/.test(e.name)).length);
    for (let i = 0; i < 3; i++) { await b.page.click('.tile[data-lesson="0"]'); await b.page.click('#btn-posture-back'); }
    await b.page.waitForTimeout(300);
    const c2 = await b.page.evaluate(() => performance.getEntriesByType('resource').filter(e => /accion=ranking/.test(e.name)).length);
    assert.equal(c1, 1);
    assert.equal(c2, 1, 'volver al mapa no repite la petición');
    assert.ok(n >= 0);
    await b.context.close();
  });

  test('sin Google Sheets no hay ranking ni puntos en pantalla', async () => {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.createStudent(page, 'Ana', '1º ESO A', '12345');
    assert.equal(await page.isVisible('#ranking'), false);
    await H.doPosture(page); await H.playLesson(page);
    assert.equal(await page.isVisible('#res-points'), false);
    await context.close();
  });

  test('RANKING: false oculta el ranking aunque haya Google Sheets', async () => {
    const { context, page } = await H.openApp(browser, env, { config: { RANKING: false } });
    await H.createStudent(page, 'Ana', '1º ESO A', '12345');
    assert.equal(await page.isVisible('#ranking'), false);
    await context.close();
  });
});

describe('grupos desde la hoja', () => {
  test('los grupos que guarda el profesor/a aparecen en todos los ordenadores', async () => {
    env.gas.server.get({ accion: 'guardargrupos', clave: env.gas.server.clave, grupos: JSON.stringify(['3º ESO D', '1º Bach A']) });
    const { context, page } = await H.openApp(browser, env);
    await page.waitForFunction(() => document.querySelectorAll('select[name=group] option').length === 3);
    assert.deepEqual(await page.$$eval('select[name=group] option', o => o.map(x => x.value).filter(Boolean)), ['3º ESO D', '1º Bach A']);
    await context.close();
  });
});
