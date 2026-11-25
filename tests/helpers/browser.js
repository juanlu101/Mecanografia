/* Utilidades para las pruebas de navegador con Playwright */
const { chromium } = require('playwright');

// Escribe como lo haría un alumno: con la Mayús de la mano contraria y la tilde antes de la vocal
const TYPER = `
window.__fire = (type, o) => document.dispatchEvent(new KeyboardEvent(type, Object.assign({ bubbles: true }, o)));
window.__type = ch => {
  const steps = KB.getSteps(ch) || [{ code: 'Space', shift: false }];
  steps.forEach((st, i) => {
    const last = i === steps.length - 1;
    const sh = st.shift ? KB.stepInfo(st).codes[1] : null;
    if (sh) __fire('keydown', { key: 'Shift', code: sh, shiftKey: true });
    __fire('keydown', { key: last ? ch : 'Dead', code: st.code, shiftKey: !!st.shift });
    if (sh) __fire('keyup', { key: 'Shift', code: sh });
  });
};
window.__text = () => [...document.querySelectorAll('#text .ch')].map(s => s.textContent).join('');
window.__typeAll = (opts = {}) => {
  const t = window.__text();
  let i = 0;
  for (const ch of t) {
    if (opts.wrongOn && opts.wrongOn.includes(ch)) __fire('keydown', { key: '#', code: 'Backslash' });
    if (opts.errorsEvery && i % opts.errorsEvery === 0) __fire('keydown', { key: '#', code: 'Backslash' });
    __type(ch); i++;
    if (opts.stopAt && i >= opts.stopAt) break;
  }
};
`;

async function launch() {
  return chromium.launch();
}

/**
 * Abre la app en un contexto nuevo («otro ordenador»).
 * opts.sync: usar el Google Apps Script de pruebas · opts.config: valores extra de CONFIG · opts.clock: reloj simulado
 */
async function openApp(browser, env, opts = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }, opts.context || {}));
  const config = Object.assign({}, opts.sync === false ? {} : { SYNC_URL: env.syncUrl }, opts.config || {});
  await context.route('**/js/config.js', async route => {
    const res = await route.fetch();
    let body = await res.text();
    body += `\nObject.assign(window.CONFIG, ${JSON.stringify(config)});`;
    route.fulfill({ response: res, body });
  });
  // sin fuentes externas en las pruebas
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await context.addInitScript(TYPER);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('dialog', d => d.accept());
  if (opts.clock) await page.clock.install();
  if (opts.storage) await context.addInitScript(s => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, opts.storage);
  await page.goto(env.appUrl);
  await page.waitForFunction(() => window.Store && document.querySelector('#screen-profiles:not([hidden]), #screen-map:not([hidden])'));
  return { context, page };
}

async function createStudent(page, name, group, pin) {
  await page.fill('input[name=name]', name);
  if (group) await page.selectOption('select[name=group]', group);
  await page.fill('input[name=pin]', pin);
  await page.click('#new-profile button[type=submit]');
  await page.waitForTimeout(300);
  await page.waitForFunction(() => {
    const m = document.querySelector('#new-msg');
    return !document.querySelector('#screen-map').hidden || (m.textContent && !/Buscando/.test(m.textContent));
  }, null, { timeout: 5000 }).catch(() => {});
}

async function loginFromList(page, name, pin) {
  await page.locator('.profile-btn', { hasText: name }).first().click();
  await page.fill('#pin-form input', pin);
  await page.click('#pin-form button');
}

const key = (page, code, k, shift = false) => page.evaluate(([code, k, shift]) =>
  __fire('keydown', { key: k, code, shiftKey: shift }), [code, k, shift]);

async function doPosture(page) {
  await page.click('.tile[data-lesson="0"]');
  await page.click('#posture-next'); await page.click('#posture-next');
  await key(page, 'Semicolon', 'ñ');
  await page.click('#posture-next');
  for (const [c, k] of [['KeyA', 'a'], ['KeyS', 's'], ['KeyD', 'd'], ['KeyF', 'f'], ['KeyJ', 'j'], ['KeyK', 'k'], ['KeyL', 'l'], ['Semicolon', 'ñ'], ['Space', ' ']]) await key(page, c, k);
  await page.click('#posture-next'); await page.click('#posture-next');
  await page.waitForSelector('#screen-lesson:not([hidden])');
}

// Empieza una lección ya abierta y la escribe entera
async function playLesson(page, opts = {}) {
  await page.keyboard.press('Space');
  await page.evaluate(o => __typeAll(o), opts);
  await page.waitForSelector('#screen-results:not([hidden])');
}

async function teacherLogin(page, clave) {
  await page.click('#btn-teacher');
  await page.fill('.key-input', clave);
  await page.click('#key-form button');
}

// Escribe directamente en el almacenamiento del navegador un perfil con progreso
async function seedProfile(page, profile, pin) {
  return page.evaluate(([p, pin]) => {
    const d = Store.load();
    const np = Object.assign(Store.newProfile(p.name, p.group, pin), p);
    d.profiles[np.id] = Store.normalize(np);
    d.current = null;
    Store.save(d);
    return np.id;
  }, [profile, pin]);
}

const allPassed = (ids, extra = {}) => Object.fromEntries(ids.map(i => [i, Object.assign({ passed: true, passes: 2, attempts: 2, best: { wpm: 22, acc: 97, stars: 2 } }, extra)]));

module.exports = { launch, openApp, createStudent, loginFromList, doPosture, playLesson, teacherLogin, seedProfile, key, allPassed };
