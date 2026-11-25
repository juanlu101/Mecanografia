/* Cuentas: varios ordenadores, PIN, nombres repetidos, sin conexión, cierre de sesión, lista por grupo */
const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServers } = require('../helpers/servers');
const H = require('../helpers/browser');

let env, browser;
before(async () => { env = await startServers(); browser = await H.launch(); });
after(async () => { await browser.close(); await env.stop(); });
beforeEach(() => env.reset());

const pc = (opts) => H.openApp(browser, env, opts);
const inMap = page => page.isVisible('#screen-map');
const profiles = page => page.evaluate(() => Object.values(Store.load().profiles));
const settle = page => page.waitForFunction(() => Sync.pending() === 0, null, { timeout: 5000 });

describe('entrar desde cualquier ordenador', () => {
  test('el progreso se recupera en otro ordenador con nombre, grupo y PIN', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Lucía Pérez', '1º ESO A', '24680');
    await H.doPosture(a.page);
    await H.playLesson(a.page);
    await settle(a.page);
    const b = await pc();
    await H.createStudent(b.page, '  lucia   PEREZ ', '1º ESO A', '24680');
    assert.ok(await inMap(b.page));
    const [p] = await profiles(b.page);
    assert.equal(p.name, 'Lucía Pérez', 'conserva el nombre original');
    assert.equal(p.lessons[0].passed, true);
    assert.equal(p.lessons[1].passes, 1);
    assert.equal(env.sheet('Progreso').length, 1, 'no se duplica en la hoja');
    await a.context.close(); await b.context.close();
  });

  test('mismo nombre y grupo con otro PIN: no entra y se le explica qué hacer', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await settle(a.page);
    const b = await pc();
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO B', '22222');
    assert.equal(await inMap(b.page), false);
    assert.match(await b.page.textContent('#new-msg'), /Si eres tú, el PIN no es correcto.*segundo apellido/);
    assert.equal((await profiles(b.page)).length, 0);
    await H.createStudent(b.page, 'Ana Ruiz G', '2º ESO B', '22222');
    assert.ok(await inMap(b.page), 'con el segundo apellido sí');
    await settle(b.page);
    assert.equal(env.sheet('Progreso').length, 2);
    await a.context.close(); await b.context.close();
  });

  test('mismo nombre en otro grupo es otra persona', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await settle(a.page);
    const b = await pc();
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO C', '22222');
    assert.ok(await inMap(b.page));
    assert.equal((await profiles(b.page))[0].lessons[0], undefined);
    await a.context.close(); await b.context.close();
  });

  test('sin conexión con la hoja no se crea un perfil (evita duplicados)', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.click('#btn-switch');
    env.gas.down = true;
    await H.createStudent(a.page, 'Pablo Gil', '2º ESO B', '33333');
    assert.match(await a.page.textContent('#new-msg'), /No se ha podido conectar/);
    assert.equal((await profiles(a.page)).length, 1);
    // quien ya estaba en este ordenador sí entra sin conexión
    await H.createStudent(a.page, 'ana ruiz', '2º ESO B', '11111');
    assert.ok(await inMap(a.page));
    // y también sin internet en el navegador
    await a.page.click('#btn-switch');
    await a.context.setOffline(true);
    await H.createStudent(a.page, 'Nuevo Alumno', '2º ESO B', '44444');
    assert.match(await a.page.textContent('#new-msg'), /No se ha podido conectar/);
    await a.context.close();
  });
});

describe('PIN', () => {
  test('entrar desde la lista pide el PIN; uno equivocado no deja pasar', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.click('#btn-switch');
    await H.loginFromList(a.page, 'Ana', '99999');
    assert.match(await a.page.textContent('#pin-msg'), /incorrecto/);
    assert.equal(await inMap(a.page), false);
    await a.page.fill('#pin-form input', '123');
    await a.page.click('#pin-form button');
    assert.match(await a.page.textContent('#pin-msg'), /5 números/);
    await a.page.fill('#pin-form input', '11111');
    await a.page.click('#pin-form button');
    assert.ok(await inMap(a.page));
    await a.context.close();
  });

  test('cancelar el diálogo del PIN no entra', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.click('#btn-switch');
    await a.page.locator('.profile-btn').first().click();
    await a.page.click('[data-close]');
    assert.equal(await inMap(a.page), false);
    await a.context.close();
  });

  test('un alumno con PIN antiguo de 4 cifras puede seguir entrando', async () => {
    const a = await pc({ sync: false });
    await H.seedProfile(a.page, { name: 'Luis Gómez', group: '1º ESO A' }, '4321');
    await a.page.reload();
    await H.loginFromList(a.page, 'Luis', '4321');
    assert.ok(await inMap(a.page));
    await a.context.close();
  });

  test('un perfil sin PIN (versiones antiguas) obliga a crear uno de 5 cifras', async () => {
    const a = await pc({ sync: false });
    await H.seedProfile(a.page, { name: 'Sin Pin', group: '1º ESO A' }, '');
    await a.page.reload();
    await a.page.locator('.profile-btn').first().click();
    assert.match(await a.page.textContent('#dlg-title'), /Crea tu PIN/);
    await a.page.fill('#pin-form input', '1234');
    await a.page.click('#pin-form button');
    assert.match(await a.page.textContent('#pin-msg'), /5 números/);
    await a.page.fill('#pin-form input', '54321');
    await a.page.click('#pin-form button');
    assert.ok(await inMap(a.page));
    const [p] = await profiles(a.page);
    assert.equal(p.pin, await a.page.evaluate(() => Store.hashPin('54321')));
    await a.context.close();
  });

  test('cambiar el PIN: el nuevo vale en otros ordenadores y el antiguo ya no', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.click('#settings summary');
    await a.page.click('#btn-change-pin');
    await a.page.fill('#pin-form input', '00000'); await a.page.click('#pin-form button');
    assert.match(await a.page.textContent('#pin-msg'), /incorrecto/);
    await a.page.fill('#pin-form input', '11111'); await a.page.click('#pin-form button');
    await a.page.fill('#pin-form input', '77777'); await a.page.click('#pin-form button');
    assert.match(await a.page.textContent('#dlg-title'), /PIN cambiado/);
    await settle(a.page);
    const b = await pc();
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO B', '11111');
    assert.equal(await inMap(b.page), false, 'el PIN antiguo ya no vale');
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO B', '77777');
    assert.ok(await inMap(b.page));
    // y en el primer ordenador tampoco vale el antiguo
    await a.page.click('[data-close]').catch(() => {});
    await a.page.click('#btn-switch');
    await H.loginFromList(a.page, 'Ana', '11111');
    assert.match(await a.page.textContent('#pin-msg'), /incorrecto/);
    await a.context.close(); await b.context.close();
  });

  test('un PIN cambiado en otro ordenador sirve también en el ordenador donde ya estaba guardado', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await settle(a.page);
    const b = await pc();
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO B', '11111');
    await b.page.click('#settings summary'); await b.page.click('#btn-change-pin');
    await b.page.fill('#pin-form input', '11111'); await b.page.click('#pin-form button');
    await b.page.fill('#pin-form input', '88888'); await b.page.click('#pin-form button');
    await settle(b.page);
    await a.page.click('#btn-switch');
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '88888');
    assert.ok(await inMap(a.page));
    assert.equal((await profiles(a.page)).length, 1, 'no se duplica');
    await a.context.close(); await b.context.close();
  });

  test('el PIN en texto nunca se guarda en el ordenador, pero sí llega a la hoja', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '24680');
    await H.doPosture(a.page); await H.playLesson(a.page);
    await a.page.click('#btn-map'); await a.page.click('#btn-switch');
    await H.loginFromList(a.page, 'Ana', '24680');
    await settle(a.page);
    const all = await a.page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    assert.ok(!all.includes('24680'));
    await a.page.waitForTimeout(300);
    assert.equal(env.sheet('Progreso')[0]['PIN (texto)'], '24680');
    await a.context.close();
  });

  test('borrar un perfil del ordenador pide su PIN', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.click('#btn-switch');
    await a.page.click('[data-del]');
    await a.page.fill('#pin-form input', '22222'); await a.page.click('#pin-form button');
    assert.match(await a.page.textContent('#pin-msg'), /incorrecto/);
    await a.page.fill('#pin-form input', '11111'); await a.page.click('#pin-form button');
    await a.page.waitForTimeout(200);
    assert.equal((await profiles(a.page)).length, 0);
    await a.context.close();
  });
});

describe('quitar el PIN (alumno que lo ha olvidado)', () => {
  test('funciona en el mismo ordenador donde ya estaba guardado y conserva el progreso', async () => {
    const a = await pc();
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await H.doPosture(a.page);
    await a.page.click('#btn-back'); await settle(a.page);
    await a.page.click('#btn-switch');
    await H.teacherLogin(a.page, env.gas.server.clave);
    await a.page.waitForSelector('[data-unpin]');
    await a.page.click('[data-unpin]');
    await a.page.waitForFunction(() => !document.querySelector('[data-unpin]'));
    await a.page.click('#t-exit');
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '55555');
    assert.ok(await inMap(a.page));
    const ps = await profiles(a.page);
    assert.equal(ps.length, 1);
    assert.equal(ps[0].lessons[0].passed, true);
    await settle(a.page); await a.page.waitForTimeout(300);
    assert.equal(env.sheet('Progreso')[0]['PIN (texto)'], '55555');
    // y en otro ordenador también con el nuevo
    const b = await pc();
    await H.createStudent(b.page, 'Ana Ruiz', '2º ESO B', '55555');
    assert.ok(await inMap(b.page));
    await a.context.close(); await b.context.close();
  });
});

describe('ordenadores compartidos', () => {
  test('la sesión se cierra sola tras 10 minutos sin actividad (y no antes)', async () => {
    const a = await pc({ clock: true, sync: false });
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await a.page.clock.runFor(9 * 60000);
    assert.ok(await inMap(a.page));
    await a.page.keyboard.press('Shift'); // actividad: reinicia la cuenta
    await a.page.clock.runFor(9 * 60000);
    assert.ok(await inMap(a.page));
    await a.page.clock.runFor(2 * 60000);
    assert.ok(await a.page.isVisible('#screen-profiles'));
    assert.match(await a.page.textContent('#idle-msg'), /Ana Ruiz.*10 minutos/);
    await a.context.close();
  });

  test('una lección a medias también se cierra por inactividad', async () => {
    const a = await pc({ clock: true, sync: false });
    await H.createStudent(a.page, 'Ana Ruiz', '2º ESO B', '11111');
    await H.doPosture(a.page);
    await a.page.clock.runFor(11 * 60000);
    assert.ok(await a.page.isVisible('#screen-profiles'));
    await a.context.close();
  });

  test('con muchos alumnos, la lista se filtra por grupo y recuerda la elección', async () => {
    const a = await pc({ sync: false });
    await a.page.evaluate(() => {
      const d = { current: null, profiles: {} };
      ['1º ESO A', '1º ESO B', '2º ESO A'].forEach((g, gi) => { for (let i = 0; i < 4; i++) { const p = Store.newProfile(`Alumno ${gi}${i}`, g, '12345'); p.lastSeen = 1000 - gi * 10 - i; d.profiles[p.id] = p; } });
      Store.save(d);
    });
    await a.page.reload();
    assert.ok(await a.page.isVisible('#list-filter'));
    assert.equal(await a.page.inputValue('#pf-group'), '1º ESO A');
    assert.equal(await a.page.locator('.profile-btn').count(), 4);
    await a.page.selectOption('#pf-group', '2º ESO A');
    assert.equal(await a.page.locator('.profile-btn', { hasText: '2º ESO A' }).count(), 4);
    await a.page.reload();
    assert.equal(await a.page.inputValue('#pf-group'), '2º ESO A');
    await a.page.selectOption('#pf-group', '*');
    assert.equal(await a.page.locator('.profile-btn').count(), 12);
    await a.context.close();
  });

  test('con pocos alumnos no hay filtro', async () => {
    const a = await pc({ sync: false });
    await H.createStudent(a.page, 'Ana', '1º ESO A', '12345');
    await a.page.click('#btn-switch');
    assert.equal(await a.page.isVisible('#list-filter'), false);
    await a.context.close();
  });
});

describe('código de progreso', () => {
  test('exportar en un ordenador e importar en otro (con PIN)', async () => {
    const a = await pc({ sync: false });
    await H.createStudent(a.page, 'Iñaki Núñez', '1º ESO A', '13579');
    await H.doPosture(a.page); await a.page.click('#btn-back');
    await a.page.click('#btn-export');
    const code = await a.page.inputValue('#dlg-body textarea');
    assert.match(code, /^TECLEA1\./);
    const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#dl-code')]);
    assert.match(dl.suggestedFilename(), /^teclea-inaki-nunez\.txt$/);
    const b = await pc({ sync: false });
    await b.page.click('#btn-import-start');
    await b.page.fill('#imp-text', 'basura');
    await b.page.click('#imp-go');
    assert.match(await b.page.textContent('#imp-msg'), /no es válido/);
    await b.page.fill('#imp-text', '\n' + code + '  \n');
    await b.page.click('#imp-go');
    await b.page.fill('#pin-form input', '13579'); await b.page.click('#pin-form button');
    assert.ok(await inMap(b.page));
    assert.equal((await profiles(b.page))[0].lessons[0].passed, true);
    await a.context.close(); await b.context.close();
  });
});
