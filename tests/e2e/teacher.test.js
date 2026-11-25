/* Panel del profesor/a */
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { startServers } = require('../helpers/servers');
const H = require('../helpers/browser');

let env, browser;
before(async () => { env = await startServers(); browser = await H.launch(); });
after(async () => { await browser.close(); await env.stop(); });
beforeEach(() => env.reset());

const settle = page => page.waitForFunction(() => Sync.pending() === 0, null, { timeout: 8000 });
async function seedClass() {
  const pcs = [];
  for (const [n, g, pin, lessons] of [['Ana Ruiz', '1º ESO A', '11111', 1], ['Luis Gómez', '1º ESO A', '22222', 0], ['Sara Núñez', '1º ESO B', '33333', 2]]) {
    const { context, page } = await H.openApp(browser, env);
    await H.createStudent(page, n, g, pin);
    if (lessons) { await H.doPosture(page); for (let i = 0; i < lessons; i++) { await H.playLesson(page); await page.click('#btn-repeat'); } await page.keyboard.press('Escape'); }
    await settle(page); await page.waitForTimeout(200);
    pcs.push(context);
  }
  return pcs;
}
async function openPanel(opts = {}) {
  const { context, page } = await H.openApp(browser, env, opts);
  await H.teacherLogin(page, opts.clave || env.gas.server.clave);
  await page.waitForSelector('#screen-teacher:not([hidden])');
  return { context, page };
}
const rowsOf = page => page.$$eval('#t-table tbody tr', trs => trs.map(tr => [...tr.cells].map(td => td.textContent.replace(/\s+/g, ' ').trim())));

describe('acceso', () => {
  test('clave incorrecta no entra; la correcta sí; también con #profe', async () => {
    const { context, page } = await H.openApp(browser, env);
    await H.teacherLogin(page, 'mal');
    await page.waitForFunction(() => /no es correcta/.test(document.querySelector('#key-msg').textContent));
    assert.equal(await page.isVisible('#screen-teacher'), false);
    await page.fill('.key-input', env.gas.server.clave); await page.click('#key-form button');
    await page.waitForSelector('#screen-teacher:not([hidden])');
    await page.click('#t-exit');
    assert.equal(await page.isVisible('#screen-profiles'), true);
    await page.goto(env.appUrl + '#profe');
    await page.waitForSelector('#key-form');
    await context.close();
  });

  test('sin Google Sheets se usa TEACHER_KEY y se ven los alumnos de este ordenador', async () => {
    const { context, page } = await H.openApp(browser, env, { sync: false });
    await H.createStudent(page, 'Local Uno', '1º ESO A', '12345');
    await page.click('#btn-switch');
    await H.teacherLogin(page, 'mal');
    assert.match(await page.textContent('#key-msg'), /no es correcta/);
    await page.fill('.key-input', 'profe'); await page.click('#key-form button');
    await page.waitForSelector('#screen-teacher:not([hidden])');
    const rows = await rowsOf(page);
    assert.equal(rows.length, 1);
    assert.match(rows[0][0], /Local Uno/);
    assert.match(await page.textContent('#t-source'), /este ordenador/);
    await context.close();
  });

  test('el panel se cierra solo tras 10 minutos sin actividad', async () => {
    const { context, page } = await openPanel({ clock: true });
    await page.clock.runFor(11 * 60000);
    assert.equal(await page.isVisible('#screen-profiles'), true);
    assert.match(await page.textContent('#idle-msg'), /panel del profesor/);
    await context.close();
  });
});

describe('tabla de alumnos', () => {
  test('muestra a todos, filtra por grupo, busca y ordena', async () => {
    const pcs = await seedClass();
    const { context, page } = await openPanel();
    let rows = await rowsOf(page);
    assert.equal(rows.length, 3);
    assert.match(await page.textContent('#t-count'), /3 alumnos/);
    await page.selectOption('#t-group', '1º ESO A');
    assert.equal((await rowsOf(page)).length, 2);
    await page.selectOption('#t-group', '*');
    await page.fill('#t-search', 'sara');
    rows = await rowsOf(page);
    assert.equal(rows.length, 1);
    assert.match(rows[0][2], /^2 · D y K$/, 'va por la lección 2');
    await page.fill('#t-search', '');
    await page.click('th[data-sort=passed]'); await page.click('th[data-sort=passed]');
    rows = await rowsOf(page);
    assert.match(rows[0][0], /Sara/, 'ordenado por lecciones superadas, de más a menos');
    for (const c of [...pcs, context]) await c.close();
  });

  test('PIN visible solo al pulsar, y se puede quitar', async () => {
    const pcs = await seedClass();
    const { context, page } = await openPanel();
    const btn = page.locator('tr', { hasText: 'Ana Ruiz' }).locator('.pin-reveal');
    assert.equal(await btn.textContent(), '•••••');
    await btn.click();
    assert.equal(await btn.textContent(), '11111');
    await btn.click();
    assert.equal(await btn.textContent(), '•••••');
    await page.locator('tr', { hasText: 'Ana Ruiz' }).locator('[data-unpin]').click();
    await page.waitForFunction(() => /sin PIN/.test([...document.querySelectorAll('#t-table tr')].find(t => /Ana Ruiz/.test(t.textContent)).textContent));
    assert.equal(env.sheet('Progreso').find(r => r.Nombre === 'Ana Ruiz').PIN, '');
    for (const c of [...pcs, context]) await c.close();
  });

  test('resumen, ranking de clases y mapa de calor del grupo', async () => {
    const pcs = await seedClass();
    const { context, page } = await openPanel();
    assert.match(await page.textContent('#t-summary'), /3alumnos/);
    const ranks = await page.$$eval('#t-rank-body tbody tr', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ')));
    assert.equal(ranks.length, 2);
    assert.match(ranks[0], /1º ESO B/, 'Sara sola en 1º B tiene más media');
    assert.match(ranks[1], /1 de 2/, 'en 1º A ha practicado 1 de 2');
    assert.ok(await page.$$eval('#t-heat .key[style*="background"]', k => k.length) > 0);
    for (const c of [...pcs, context]) await c.close();
  });

  test('descargar CSV con todos los datos y acentos correctos', async () => {
    const pcs = await seedClass();
    const { context, page } = await openPanel();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#t-csv')]);
    assert.match(dl.suggestedFilename(), /^teclea-clase-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    assert.ok(csv.startsWith('﻿'), 'con BOM para que Excel lea las tildes');
    const lines = csv.trim().split(/\r\n/);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /"Alumno";"Grupo";"Va por"/);
    assert.ok(lines.some(l => l.includes('"Sara Núñez"')));
    assert.ok(!csv.includes('11111'), 'el CSV no incluye PIN');
    for (const c of [...pcs, context]) await c.close();
  });

  test('añadir códigos de progreso (sin Google Sheets)', async () => {
    const a = await H.openApp(browser, env, { sync: false });
    await H.createStudent(a.page, 'Remoto Uno', '2º ESO A', '12345');
    await H.doPosture(a.page); await a.page.click('#btn-back');
    const code = await a.page.evaluate(() => Store.exportCode(Object.values(Store.load().profiles)[0]));
    const { context, page } = await openPanel({ sync: false, clave: 'profe' });
    assert.equal((await rowsOf(page))[0].length, 1, 'sin alumnos: mensaje vacío');
    await page.click('#t-codes');
    await page.fill('#tc-text', 'no es un código\n' + code);
    await page.click('#tc-go');
    await page.waitForFunction(() => document.querySelectorAll('#t-table tbody tr').length === 1 && /Remoto/.test(document.querySelector('#t-table').textContent));
    await page.click('#t-codes');
    await page.fill('#tc-text', 'nada');
    await page.click('#tc-go');
    assert.match(await page.textContent('#tc-msg'), /ningún código válido/);
    await a.context.close(); await context.close();
  });
});

describe('grupos', () => {
  test('añadir, quitar, reordenar y guardar; el alumno los ve en otro ordenador', async () => {
    const { context, page } = await openPanel();
    await page.click('#t-groups');
    assert.equal(await page.locator('#g-list li').count(), 18);
    await page.fill('#g-new', '3º ESO D'); await page.click('#g-form button');
    await page.fill('#g-new', '3º eso d'); await page.click('#g-form button');
    assert.match(await page.textContent('#g-msg'), /ya está/);
    await page.locator('#g-list li', { hasText: '2º Bach C' }).locator('[data-rm]').click();
    await page.locator('#g-list li', { hasText: '3º ESO D' }).locator('[data-up]').click();
    await page.click('#g-save');
    await page.waitForFunction(() => !document.querySelector('#dlg').open);
    const saved = env.gas.server.get({ accion: 'grupos' }).grupos;
    assert.equal(saved.length, 18);
    assert.deepEqual(saved.slice(-2), ['3º ESO D', '2º Bach B']);
    const b = await H.openApp(browser, env);
    await b.page.waitForFunction(() => [...document.querySelectorAll('select[name=group] option')].some(o => o.value === '3º ESO D'));
    assert.equal(await b.page.$('select[name=group] option[value="2º Bach C"]'), null);
    await context.close(); await b.context.close();
  });

  test('no se puede guardar una lista vacía', async () => {
    const { context, page } = await openPanel();
    await page.click('#t-groups');
    for (let i = 0; i < 18; i++) await page.locator('#g-list [data-rm]').first().click();
    await page.click('#g-save');
    assert.match(await page.textContent('#g-msg'), /al menos un grupo/);
    await context.close();
  });
});
