/* =========================================================
   APLICACIÓN — pantallas, ejercicio de escritura y resultados
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = KB.esc;
  const norm = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

  let db = Store.load();
  let profile = null;
  let S = null; // sesión de escritura en curso
  let current = 'screen-profiles';
  let layoutBad = 0; // pulsaciones que no cuadran con el teclado español

  /* ---------- utilidades ---------- */
  function show(id) {
    current = id;
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
  }
  function persist() {
    if (profile) { profile.lastSeen = Date.now(); db.profiles[profile.id] = profile; db.current = profile.id; }
    Store.save(db);
  }
  const isPassed = (p, id) => !!(p.lessons[id] && p.lessons[id].passed);
  const lessonPasses = l => (profile.lessons[l.id] && profile.lessons[l.id].passes) || 0;
  const passedCount = p => CORE_LESSONS.filter(l => isPassed(p, l.id)).length; // solo el curso obligatorio
  const advPassed = p => LESSONS.filter(l => l.optional && isPassed(p, l.id)).length;
  const starsOf = (p, id) => (p.lessons[id] && p.lessons[id].best ? p.lessons[id].best.stars : 0);
  const bestWpm = p => Math.max(0, ...Object.values(p.lessons).map(r => (r.best ? r.best.wpm : 0)));
  const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const initials = n => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const isUnlocked = id => CONFIG.UNLOCK_ALL || id === 0 || isPassed(profile, id - 1) || !!profile.lessons[id];
  const nextLesson = p => CORE_LESSONS.find(l => !isPassed(p, l.id)) || null;      // siguiente del curso
  const nextAny = p => LESSONS.find(l => !isPassed(p, l.id)) || null;             // incluye la etapa avanzada
  const minWpmOf = l => Math.round(l.minWpm * (CONFIG.WPM_FACTOR || 1));
  const fmtTime = s => (s >= 60 ? Math.floor(s / 60) + ' min ' : '') + Math.round(s % 60) + ' s';
  const goalSec = () => (CONFIG.DAILY_GOAL_MIN || 10) * 60;
  const canType = ch => !!KB.getSteps(ch);

  function syncProfile(type, extra) {
    Sync.send(Object.assign({
      type, id: profile.id, nombre: profile.name, grupo: profile.group, pin: profile.pin,
      superadas: passedCount(profile), mejorPpm: bestWpm(profile), minutos: Math.round(profile.totalSec / 60),
      semana: Store.weekKey(), puntosSemana: Store.weekPoints(profile), puntosTotal: Store.totalPoints(profile),
      codigo: Store.exportCode(profile)
    }, extra || {}));
  }

  /* ---------- sonido ---------- */
  let audio = null;
  function tone(freq, dur, type = 'triangle', vol = 0.12) {
    if (!profile || !profile.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + dur + 0.01);
    } catch (e) { /* sin audio */ }
  }
  const beep = () => tone(180, 0.12);

  /* =========================================================
     DIÁLOGOS
     ========================================================= */
  const dlg = $('#dlg');
  function openDialog(title, html) {
    if (dlg.open) dlg.close();
    $('#dlg-title').textContent = title;
    $('#dlg-body').innerHTML = html;
    dlg.showModal();
  }
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });

  // Pide un PIN de 5 cifras. check(pin) devuelve un mensaje de error o null.
  // Al entrar (allowOld) se aceptan también los PIN antiguos de 4 cifras.
  function askPin({ title, text, check, forgot = true, allowOld = false }) {
    return new Promise(resolve => {
      let done = false;
      openDialog(title, `
        <p>${text}</p>
        <form class="pin-form" id="pin-form" autocomplete="off">
          <input class="pin-input big" inputmode="numeric" maxlength="5" required placeholder="•••••" aria-label="PIN">
          <button class="btn primary" type="submit">Aceptar</button>
        </form>
        <p class="form-msg ko" id="pin-msg" aria-live="polite"></p>
        ${forgot ? `<p class="small">¿Has olvidado tu PIN? Pide a tu profesor/a que lo quite desde su panel${Sync.enabled() ? ' y después entra con el formulario «¿No estás en la lista?» eligiendo un PIN nuevo' : ''}.</p>` : ''}`);
      const f = $('#pin-form'), inp = f.querySelector('input');
      setTimeout(() => inp.focus(), 30);
      inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 5); });
      // El aviso de cierre de un diálogo anterior puede llegar tarde, cuando este ya está abierto: se ignora.
      const onClose = () => {
        if (dlg.open || done) return;
        done = true; dlg.removeEventListener('close', onClose); resolve(null);
      };
      dlg.addEventListener('close', onClose);
      f.onsubmit = e => {
        e.preventDefault();
        const v = inp.value;
        if (!(allowOld ? /^\d{4,5}$/ : /^\d{5}$/).test(v)) { $('#pin-msg').textContent = 'Tienen que ser 5 números.'; return; }
        const err = check ? check(v) : null;
        if (err) { $('#pin-msg').textContent = err; inp.value = ''; inp.focus(); return; }
        done = true; dlg.removeEventListener('close', onClose); dlg.close(); resolve(v);
      };
    });
  }

  /* =========================================================
     1. PERFILES
     ========================================================= */
  function fillGroups() {
    const sel = $('#new-profile select[name=group]'), prev = sel.value;
    sel.innerHTML = '<option value="">Elige tu grupo…</option>' + Groups.get().map(g => `<option>${esc(g)}</option>`).join('');
    if (Groups.get().includes(prev)) sel.value = prev;
  }

  function renderProfiles(keepMsg) {
    profile = null;
    if (!keepMsg) $('#idle-msg').hidden = true;
    fillGroups();
    Groups.refresh().then(changed => { if (changed) fillGroups(); });
    const all = Object.values(db.profiles).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    // Con muchos alumnos en el mismo ordenador, la lista se filtra por grupo
    const groupsHere = [...new Set(all.map(p => p.group || ''))].sort((a, b) => Groups.get().indexOf(a) - Groups.get().indexOf(b));
    const useFilter = all.length > 8 && groupsHere.length > 1;
    let filter = '*';
    try { filter = localStorage.getItem('teclea:filtro') || ''; } catch (e) { /* nada */ }
    if (!groupsHere.includes(filter) && filter !== '*') filter = all.length ? (all[0].group || '') : '*';
    if (!useFilter) filter = '*';
    $('#list-filter').hidden = !useFilter;
    $('#pf-group').innerHTML = groupsHere.map(g => `<option value="${esc(g)}">${esc(g || 'Sin grupo')}</option>`).join('') + '<option value="*">Todos los grupos</option>';
    $('#pf-group').value = filter;
    const list = filter === '*' ? all : all.filter(p => (p.group || '') === filter);
    $('#profile-list').innerHTML = list.map(p => `
      <li>
        <button class="profile-btn" data-id="${p.id}" type="button">
          <span class="avatar" style="--h:${hue(p.name)}">${esc(initials(p.name))}</span>
          <span class="pinfo"><b>${esc(p.name)}</b><small>${esc(p.group || 'Sin grupo')} · ${passedCount(p)} de ${CORE_LESSONS.length} lecciones</small></span>
          ${p.pin ? '<span class="lock" title="Protegido con PIN">🔒</span>' : ''}
        </button>
        <button class="icon-btn" data-del="${p.id}" type="button" title="Borrar este perfil de este ordenador">✕</button>
      </li>`).join('');
    $('#profile-list').hidden = !list.length;
    $('#new-title').textContent = all.length ? '¿No estás en la lista? Entra con tu nombre' : 'Entrar con mi nombre';
    $('#new-sub').textContent = Sync.enabled()
      ? 'Si es tu primera vez, inventa un PIN de 5 números. Si ya has practicado en otro ordenador, pon tu PIN de siempre y recuperarás tu progreso.'
      : 'Escribe tu nombre siempre igual y elige tu grupo en la lista.';
    $('#storage-note').textContent = !Store.available()
      ? '⚠️ Este navegador no permite guardar datos (¿modo incógnito?). Usa el código de progreso para no perder tu avance.'
      : Sync.enabled()
        ? 'Tu progreso se guarda en este ordenador y en la hoja del profesor/a.'
        : 'Tu progreso se guarda en este ordenador. Para usarlo en otro, copia tu código de progreso.';
    show('screen-profiles');
  }

  async function enterProfile(p) {
    if (p.pin) {
      const ok = await askPin({ title: `Hola, ${p.name.split(' ')[0]}`, text: 'Escribe tu PIN para entrar.', allowOld: true,
        check: v => (Store.checkPin(p, v) ? null : 'PIN incorrecto. Prueba otra vez.') });
      if (!ok) return;
      selectProfile(p);
      syncProfile('perfil');
      Sync.sendPin(p, ok); // el PIN en texto va solo a la hoja del profesor/a
      return;
    } else {
      const pin = await askPin({ title: 'Crea tu PIN', forgot: false,
        text: 'Tu perfil aún no tiene PIN. Elige 5 números para que nadie más pueda usarlo.' });
      if (!pin) return;
      p.pin = Store.hashPin(pin);
      selectProfile(p);
      syncProfile('perfil');
      Sync.sendPin(p, pin);
      return;
    }
    selectProfile(p);
  }

  function selectProfile(p) {
    profile = Store.normalize(p);
    persist();
    renderMap();
  }

  $('#profile-list').addEventListener('click', async e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const p = db.profiles[del.dataset.del];
      if (!p) return;
      if (p.pin) {
        const ok = await askPin({ title: `Borrar a ${p.name}`, text: 'Para borrar este perfil de este ordenador, escribe su PIN.', allowOld: true,
          check: v => (Store.checkPin(p, v) ? null : 'PIN incorrecto.') });
        if (!ok) return;
      }
      if (confirm(`¿Borrar el progreso de ${p.name} en este ordenador? No se puede deshacer.`)) {
        delete db.profiles[p.id];
        if (db.current === p.id) db.current = null;
        Store.save(db); renderProfiles();
      }
      return;
    }
    const b = e.target.closest('[data-id]');
    if (b) enterProfile(db.profiles[b.dataset.id]);
  });

  $('#pf-group').addEventListener('change', e => {
    try { localStorage.setItem('teclea:filtro', e.target.value); } catch (err) { /* nada */ }
    renderProfiles();
  });

  const pinField = $('#new-profile input[name=pin]');
  pinField.addEventListener('input', () => { pinField.value = pinField.value.replace(/\D/g, '').slice(0, 5); });

  const SAME_NAME = (name, group) =>
    `Ya hay alguien llamado «${name}»${group ? ' en ' + group : ''}. Si eres tú, el PIN no es correcto. ` +
    'Si no eres tú, añade tu segundo apellido o una inicial para diferenciaros.';

  $('#new-profile').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, name = f.name.value.trim().replace(/\s+/g, ' '), group = f.group.value.trim(), pin = f.pin.value;
    const msg = $('#new-msg');
    msg.className = 'form-msg';
    if (!name) return;
    if (!group) { msg.className = 'form-msg ko'; msg.textContent = 'Elige tu grupo en la lista.'; return; }
    // se aceptan PIN antiguos de 4 cifras para recuperar perfiles; los nuevos deben tener 5
    if (!/^\d{4,5}$/.test(pin)) { msg.className = 'form-msg ko'; msg.textContent = 'El PIN tiene que tener 5 números.'; return; }
    const btn = f.querySelector('button');

    // 1) ¿Ya existe en este ordenador con ese PIN?
    const locals = Object.values(db.profiles).filter(x => norm(x.name) === norm(name) && norm(x.group) === norm(group));
    let p = locals.find(x => x.pin === Store.hashPin(pin)) || locals.find(x => !x.pin) || null;

    // 2) ¿Qué dice la hoja del profesor/a? Va antes de rechazar, porque allí puede estar
    //    un PIN nuevo (cambiado en otro ordenador) o el PIN quitado por el profesor/a.
    let remote = null, existe = false;
    if (Sync.enabled()) {
      msg.textContent = 'Buscando tu progreso…'; btn.disabled = true;
      const r = await Sync.find(name, group, pin);
      btn.disabled = false; msg.textContent = '';
      existe = !!(r && r.existe);
      // Sin poder consultar la hoja no se crea nada: podría duplicar a un alumno que ya existe.
      // Solo se deja entrar si su perfil ya estaba en este ordenador con ese PIN.
      if (r && r.error && !p) {
        msg.className = 'form-msg ko';
        msg.textContent = 'No se ha podido conectar con la hoja del profesor/a, así que no se puede comprobar si ya tienes progreso. Revisa la conexión a internet e inténtalo de nuevo en un momento.';
        return;
      }
      if (r && r.codigo) { try { remote = Store.importCode(r.codigo); } catch (err) { /* código dañado */ } }
    }
    if (remote) {
      const same = locals.find(x => x.id === remote.id) || (p && p.id === remote.id ? p : null);
      if (same) p = Store.merge(same, remote);
      else if (!p) p = remote;
    }
    if (!p && (locals.length || existe)) { msg.className = 'form-msg ko'; msg.textContent = SAME_NAME(name, group); return; }

    const isNew = !p;
    if (!p && pin.length !== 5) { msg.className = 'form-msg ko'; msg.textContent = 'El PIN tiene que tener 5 números.'; return; }
    if (!p) p = Store.newProfile(name, group, pin);
    const pinChanged = p.pin !== Store.hashPin(pin);
    p.pin = Store.hashPin(pin); // también si el profesor/a había quitado el PIN
    f.reset(); msg.textContent = '';
    selectProfile(p);
    if (isNew || pinChanged) syncProfile('perfil');
    Sync.sendPin(p, pin);
  });

  $('#btn-import-start').addEventListener('click', () => openImport());

  /* ---------- aviso para tabletas y móviles ---------- */
  const touchOnly = window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  let touchDismissed = false;
  try { touchDismissed = localStorage.getItem('teclea:teclado') === '1'; } catch (e) { /* nada */ }
  $('#touch-warning').hidden = !touchOnly || touchDismissed;
  const dismissTouch = () => {
    $('#touch-warning').hidden = true;
    try { localStorage.setItem('teclea:teclado', '1'); } catch (e) { /* nada */ }
  };
  $('#touch-dismiss').addEventListener('click', dismissTouch);

  /* =========================================================
     2. MAPA
     ========================================================= */
  function renderMap() {
    const passed = passedCount(profile);
    const stars = CORE_LESSONS.reduce((a, l) => a + starsOf(profile, l.id), 0);
    const done = !nextLesson(profile);
    const next = nextAny(profile);
    const adv = advPassed(profile), advTotal = LESSONS.length - CORE_LESSONS.length;

    $('#who').innerHTML = `<span class="avatar" style="--h:${hue(profile.name)}">${esc(initials(profile.name))}</span><span><b>${esc(profile.name)}</b><small>${esc(profile.group || '')}</small></span>`;
    $('#summary').innerHTML = `
      <div class="sum"><b>${passed}<small>/${CORE_LESSONS.length}</small></b><span>lecciones superadas</span></div>
      <div class="sum"><b>${stars}<small>/${CORE_LESSONS.length * 3}</small></b><span>estrellas</span></div>
      ${done ? `<div class="sum"><b>${adv}<small>/${advTotal}</small></b><span>nivel avanzado</span></div>` : ''}
      <div class="sum"><b>${bestWpm(profile)}</b><span>mejor velocidad (ppm)</span></div>
      <div class="sum"><b>${Math.round(profile.totalSec / 60)}</b><span>minutos practicados</span></div>
      ${done
        ? `<div class="continue done-btns">
            <button class="btn ${next ? '' : 'primary'} big" id="btn-diploma" type="button">🏆 Mi diploma</button>
            ${next ? `<button class="btn primary big" data-lesson="${next.id}" type="button">Nivel avanzado: ${next.minWpm} ppm →</button>` : ''}
          </div>`
        : `<button class="btn primary big continue" data-lesson="${next.id}" type="button">${next.id === 0 ? 'Empezar: antes de nada →' : `Continuar: lección ${next.id} →`}</button>`}`;
    if (done) $('#btn-diploma').onclick = printDiploma;

    renderDaily();
    renderRanking();

    $('#stages').innerHTML = STAGES.map(st => `
      <section class="stage">
        <header><span class="stage-n ${st.optional ? 'opt' : ''}">${st.n}</span><div><h3>${esc(st.name)}${st.optional ? ' <span class="opt-tag">Opcional</span>' : ''}</h3><p>${esc(st.desc)}</p></div></header>
        <div class="tiles">${LESSONS.filter(l => l.stage === st.n).map(l => {
          const r = profile.lessons[l.id], open = isUnlocked(l.id);
          return `<button class="tile ${r && r.passed ? 'done' : ''} ${next && l.id === next.id ? 'next' : ''}" data-lesson="${l.id}" type="button" ${open ? '' : 'disabled'}>
              <span class="tile-n">${l.id === 0 ? 'Lección 0' : l.id}</span>
              <span class="tile-keys">${esc(l.badge)}</span>
              <span class="tile-title">${esc(l.title)}</span>
              <span class="tile-stars">${!open ? '🔒' : l.type === 'posture' ? (r && r.passed ? '✓ Hecha' : '') : starStr(starsOf(profile, l.id))}</span>
              ${open && r && !r.passed && r.passes ? `<span class="tile-passes">Aprobada ${r.passes} de ${l.passes}</span>` : ''}
              ${l.exam ? '<span class="tile-exam">Examen</span>' : ''}
            </button>`;
        }).join('')}</div>
      </section>`).join('');

    $$('#settings [data-setting]').forEach(cb => { cb.checked = !!profile.settings[cb.dataset.setting]; });
    $('#btn-review').disabled = learnedLetters().length < 6;
    $('#btn-review').title = $('#btn-review').disabled ? 'Disponible al superar las primeras lecciones' : 'Practica las teclas en las que más fallas';
    $('#btn-free').disabled = !isPassed(profile, 18) && !CONFIG.UNLOCK_ALL;
    $('#btn-free').title = $('#btn-free').disabled ? 'Disponible al aprender todas las letras (lección 18)' : 'Escribe un texto propio o haz una prueba cronometrada';

    const hasData = Object.values(profile.keys).some(s => s.h + s.e >= 8);
    $('#heat-section').hidden = !hasData;
    if (hasData) renderHeat($('#heat'), profile.keys);
    show('screen-map');
  }

  function renderDaily() {
    const today = Store.todaySec(profile), goal = goalSec();
    const pct = Math.min(100, Math.round(100 * today / goal));
    const st = Store.streak(profile);
    const days = [];
    const dn = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const s = profile.days[Store.dayKey(d)] || 0;
      days.push(`<span class="day ${s >= goal ? 'full' : s > 0 ? 'some' : ''} ${i === 0 ? 'today' : ''}" title="${Math.round(s / 60)} min">${dn[d.getDay()]}</span>`);
    }
    const pend = Sync.enabled() ? Sync.pending() : 0;
    $('#daily').innerHTML = `
      <div class="goal-box">
        <div class="goal-txt"><b>Objetivo de hoy</b><span>${Math.floor(today / 60)} de ${CONFIG.DAILY_GOAL_MIN || 10} min ${pct >= 100 ? '· ¡cumplido! 🎉' : ''}</span></div>
        <div class="bar"><span style="width:${pct}%"></span></div>
      </div>
      <div class="streak ${st ? 'on' : ''}"><span class="flame">🔥</span><b>${st}</b><span>${st === 1 ? 'día seguido' : 'días seguidos'}</span></div>
      <div class="week" title="Últimos 7 días">${days.join('')}</div>
      ${pend ? `<div class="pending" title="Se enviarán solos cuando haya conexión">⏳ ${pend} resultado${pend > 1 ? 's' : ''} pendiente${pend > 1 ? 's' : ''} de enviar</div>` : ''}`;
  }

  /* ---------- ranking semanal ---------- */
  const rankingOn = () => Sync.enabled() && CONFIG.RANKING !== false;
  let rankTab = 'clase', rankData = null, rankFor = null, rankAt = 0;

  async function renderRanking() {
    const box = $('#ranking');
    box.hidden = !rankingOn();
    if (box.hidden) return;
    $('#rank-mine').innerHTML = `<b>${Store.weekPoints(profile)}</b> puntos esta semana`;
    drawRanking();
    const me = profile.id;
    if (rankFor !== me) { rankData = null; rankAt = 0; drawRanking(); }
    rankFor = me;
    // Para no saturar Google, el ranking se pide como mucho cada 3 minutos
    if (rankData && Date.now() - rankAt < 3 * 60000) return;
    rankAt = Date.now();
    try {
      await Sync.flush();
      const d = await Sync.ranking(me, profile.group);
      if (profile && profile.id === me && d && d.ok) { rankData = d; drawRanking(); }
    } catch (e) {
      if (!rankData) $('#rank-body').innerHTML = '<p class="rank-empty">No se ha podido cargar el ranking. Comprueba la conexión.</p>';
    }
  }

  function drawRanking() {
    $$('#ranking [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === rankTab));
    const body = $('#rank-body');
    if (!rankData) { body.innerHTML = '<p class="rank-empty">Cargando ranking…</p>'; return; }
    const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + 'º';
    if (rankTab === 'clase') {
      // los puntos propios se muestran al día aunque el ranking venga de hace unos minutos
      const mine = Store.weekPoints(profile);
      const list = (rankData.clase || []).map(x => (x.yo ? Object.assign({}, x, { puntos: Math.max(x.puntos, mine) }) : x))
        .sort((a, b) => b.puntos - a.puntos);
      list.forEach((x, i) => { x.posicion = i && x.puntos === list[i - 1].puntos ? list[i - 1].posicion : i + 1; });
      const yo = rankData.yo;
      if (!list.length || !list.some(x => x.puntos > 0)) {
        body.innerHTML = '<p class="rank-empty">Nadie de tu clase tiene puntos todavía esta semana. ¡Sé el primero!</p>'; return;
      }
      let html = '<ol class="rank-list">' + list.map(x =>
        `<li class="${x.yo ? 'me' : ''}"><span class="pos">${medal(x.posicion - 1)}</span><span class="nm">${esc(x.nombre)}${x.yo ? ' (tú)' : ''}</span><b>${x.puntos}</b></li>`).join('') + '</ol>';
      if (yo && !list.some(x => x.yo)) html += `<p class="rank-me">Tú vas en la posición <b>${yo.posicion}º</b> de ${rankData.total} con <b>${yo.puntos}</b> puntos.</p>`;
      body.innerHTML = html;
    } else {
      const list = rankData.clases || [];
      if (!list.length) { body.innerHTML = '<p class="rank-empty">Todavía no hay clases en el ranking.</p>'; return; }
      body.innerHTML = '<ol class="rank-list">' + list.map((x, i) =>
        `<li class="${x.mia ? 'me' : ''}"><span class="pos">${medal(i)}</span><span class="nm">${esc(x.grupo || 'Sin grupo')}${x.mia ? ' (tu clase)' : ''}<small>${x.alumnos} alumnos</small></span><b>${x.media}</b></li>`).join('') +
        '</ol><p class="rank-note">Media de puntos por alumno: cuentan todos, así que ayudar a tus compañeros también suma.</p>';
    }
  }
  $('#ranking').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { rankTab = t.dataset.tab; drawRanking(); }
  });

  $('#screen-map').addEventListener('click', e => {
    const t = e.target.closest('[data-lesson]');
    if (t && !t.disabled) startLesson(LESSONS.find(l => l.id === +t.dataset.lesson));
  });
  $('#settings').addEventListener('change', e => {
    const cb = e.target.closest('[data-setting]');
    if (!cb) return;
    profile.settings[cb.dataset.setting] = cb.checked;
    persist();
  });
  $('#btn-switch').addEventListener('click', () => { db.current = null; Store.save(db); renderProfiles(); });
  $('#btn-export').addEventListener('click', openExport);
  $('#btn-review').addEventListener('click', () => startLesson(reviewLesson()));
  $('#btn-free').addEventListener('click', openFree);
  $('#btn-change-pin').addEventListener('click', async () => {
    const p = profile;
    if (p.pin) {
      const ok = await askPin({ title: 'Cambiar mi PIN', text: 'Primero, escribe tu PIN actual.', allowOld: true,
        check: v => (Store.checkPin(p, v) ? null : 'PIN incorrecto.') });
      if (!ok) return;
    }
    const pin = await askPin({ title: 'Nuevo PIN', text: 'Elige tus 5 números nuevos.', forgot: false });
    if (!pin) return;
    p.pin = Store.hashPin(pin); persist(); syncProfile('perfil'); Sync.sendPin(p, pin);
    openDialog('PIN cambiado', '<p>Listo. A partir de ahora entra con tu PIN nuevo.</p>');
  });

  function learnedLetters() {
    let set = '';
    LESSONS.forEach(l => { if (l.type === 'keys' && isPassed(profile, l.id) && l.allowed.length > set.length) set = l.allowed; });
    if (isPassed(profile, 18)) set = ALL_LETTERS;
    return set;
  }
  function weakKeys(stats, learned, n = 4) {
    return [...learned].filter(c => /[a-zñ]/.test(c))
      .map(c => { const s = stats[c] || { h: 0, e: 0 }; return { c, rate: s.e / Math.max(1, s.h + s.e), tot: s.h + s.e, e: s.e }; })
      .filter(x => x.tot >= 4 && x.e > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, n).map(x => x.c);
  }
  function reviewLesson() {
    const learned = learnedLetters();
    let focus = weakKeys(profile.keys, learned);
    if (!focus.length) focus = [...learned].filter(c => /[a-zñ]/.test(c)).sort(() => Math.random() - 0.5).slice(0, 4);
    const lastPassed = [...LESSONS].reverse().find(l => isPassed(profile, l.id) && l.minWpm);
    return customLesson(focus, learned, lastPassed ? lastPassed.minWpm : 6);
  }

  /* ---------- mapa de calor del teclado ---------- */
  function renderHeat(el, stats) {
    KB.buildKeyboard(el);
    el.classList.add('heat');
    const agg = {};
    Object.entries(stats || {}).forEach(([c, s]) => {
      const key = KB.findKey(c);
      if (!key) return;
      const a = agg[key.code] = agg[key.code] || { h: 0, e: 0 };
      a.h += s.h || 0; a.e += s.e || 0;
    });
    $$('.key', el).forEach(n => {
      const a = agg[n.dataset.code];
      if (!a) return;
      const tot = a.h + a.e;
      const rate = a.e / Math.max(1, tot);
      if (tot < 8) { n.title = 'Todavía pocas pulsaciones'; return; }
      const t = Math.min(1, rate / 0.12);
      n.style.background = `hsl(${Math.round(120 * (1 - t))} 70% ${Math.round(82 - t * 14)}%)`;
      n.title = `${a.e} errores en ${tot} pulsaciones (${Math.round(rate * 100)} %)`;
    });
  }

  /* =========================================================
     3. LECCIÓN
     ========================================================= */
  const kbEl = $('#kb'), handsEl = $('#hands'), textEl = $('#text'), boxEl = $('#text-box');
  KB.buildKeyboard(kbEl);
  KB.buildHands(handsEl);

  // Calentamiento diario: antes de la primera lección del día, una vez terminada la fila guía
  let afterWarmup = null;
  const warmupDue = () => isPassed(profile, 6) && profile.warm !== Store.dayKey();
  function makeWarmup() {
    const learned = learnedLetters();
    let focus = weakKeys(profile.keys, learned);
    if (!focus.length) focus = [...learned].filter(c => /[a-zñ]/.test(c)).sort(() => Math.random() - 0.5).slice(0, 4);
    return warmupLesson(focus, learned);
  }

  function startLesson(lesson) {
    if (lesson.type === 'posture') return startPosture();
    if (!lesson.custom && warmupDue()) { afterWarmup = lesson; return startLesson(makeWarmup()); }
    if (!lesson.warmup) afterWarmup = afterWarmup && lesson === afterWarmup ? null : afterWarmup;
    // normal: no se avanza hasta acertar · real: los errores se borran con ⟵ · write: escritura libre sin texto
    const mode = lesson.type === 'real' ? 'real' : lesson.type === 'write' ? 'write' : 'normal';
    const text = mode === 'write' ? '' : lesson.make().replace(/\s+/g, ' ').trim();
    S = { lesson, text, mode, idx: 0, strokes: 0, errors: 0, start: 0, pausedAt: 0, running: false, active: 0, lastKey: 0, notice: '',
      marks: [], errBy: {}, hitBy: {}, dead: false, timeLimit: lesson.timeLimit || lesson.seconds || 0,
      typed: [], wrong: 0, corrections: 0, out: '', topic: mode === 'write' ? writingTopic() : '' };

    const ls = $('#screen-lesson');
    ls.classList.toggle('no-kb', !profile.settings.kb || !!lesson.exam);
    ls.classList.toggle('no-hands', !profile.settings.hands || !profile.settings.kb || !!lesson.exam);
    ls.classList.toggle('exam', !!lesson.exam);
    $('#lesson-title').innerHTML = lesson.custom
      ? `<span>${lesson.warmup ? 'Calentamiento diario' : lesson.free ? (lesson.timeLimit ? 'Prueba cronometrada' : 'Práctica libre') : 'Repaso'}</span>${esc(lesson.title)}`
      : `<span>Lección ${lesson.id}${lesson.exam ? ' · Examen' : ''}</span>${esc(lesson.title)}`;
    $('#live-timer-box').hidden = !S.timeLimit;
    $('#progress-bar').parentNode.hidden = !!S.timeLimit;
    renderText();
    updateLive();
    showIntro(false);
    show('screen-lesson');
  }

  function renderText() {
    textEl.classList.toggle('free', S.mode === 'write');
    if (S.mode === 'write') { renderWrite(); return; }
    let html = '', word = '';
    [...S.text].forEach((ch, i) => {
      const cls = ch === ' ' ? 'ch sp' : 'ch';
      word += `<span class="${cls}" data-i="${i}">${ch === ' ' ? ' ' : esc(ch)}</span>`;
      if (ch === ' ') { html += `<span class="w">${word}</span>`; word = ''; }
    });
    if (word) html += `<span class="w">${word}</span>`;
    textEl.innerHTML = html;
    S.spans = $$('.ch', textEl);
    boxEl.scrollTop = 0;
    setCursor();
  }

  function showIntro(paused) {
    const l = S.lesson;
    const stage = STAGES.find(s => s.n === l.stage);
    $('#intro-eyebrow').textContent = paused ? 'Pausa'
      : l.free ? (l.timeLimit ? 'Prueba cronometrada' : 'Práctica libre')
        : l.warmup ? 'Calentamiento diario · 1 minuto'
          : l.custom ? 'Repaso personalizado' : `${l.exam ? 'Examen de etapa' : 'Lección ' + l.id} · ${stage.name}`;
    $('#intro-title').textContent = paused ? 'Respira y coloca los dedos en la fila guía' : l.title;
    const keys = [...(l.showKeys || '')];
    $('#intro-keys').innerHTML = keys.map(ch => {
      const key = KB.findKey(ch); if (!key) return '';
      const f = KB.FINGERS[key.finger];
      const label = /[a-zñ]/.test(ch) ? ch.toUpperCase() : ch;
      return `<div class="newkey f-${f.type}"><kbd>${esc(label)}</kbd><span>${f.name}</span></div>`;
    }).join('');
    $('#intro-keys').hidden = paused || !keys.length;
    $('#intro-tip').textContent = paused ? 'Cuando quieras, sigue donde lo dejaste.' : l.tip + (l.note ? ' ' + l.note : '');
    $('#intro-goal').innerHTML = paused || l.free ? '' : l.warmup
      ? 'No cuenta para aprobar: es solo para empezar con buen pie. Se hace una vez al día.'
      : l.type === 'write'
      ? `<span class="topic">Tema: <b>${esc(S.topic)}</b></span>Para superarla, apruébala <b>${l.passes} veces</b>: escribe a <b>${minWpmOf(l)} palabras por minuto</b> durante 3 minutos, con al menos <b>20 palabras distintas</b>.`
      : l.custom
      ? `Objetivo: <b>${l.minAcc}% de precisión</b>.`
      : `Para superarla, apruébala <b>${l.passes} veces</b> con <b>${l.minAcc}% de precisión</b> y <b>${minWpmOf(l)} palabras por minuto</b>` +
        (l.focusChars ? `, y acierta al menos el <b>${FOCUS_MIN_ACC}% de las teclas nuevas</b>` : '') +
        (l.type === 'real' ? ', <b>sin dejar ningún error sin corregir</b>' : '') + '.' +
        (l.exam ? '<span class="exam-note">📝 <b>Examen sin ayudas:</b> no verás el teclado ni las manos en pantalla. Si puedes, tapa el teclado con una caja o un paño.</span>' : '') +
        (lessonPasses(l) && !isPassed(profile, l.id) ? `<span class="exam-note">Ya la has aprobado ${lessonPasses(l)} vez. ¡Te falta una!</span>` : '');
    $('#btn-start').textContent = paused ? 'Continuar' : 'Empezar';
    $('#intro').hidden = false;
    const codes = keys.map(ch => { const k = KB.findKey(ch); return k && k.code; }).filter(Boolean);
    KB.highlightKeys(kbEl, [], 'next');
    KB.highlightKeys(kbEl, paused ? [] : codes, 'new');
  }

  function begin() {
    $('#intro').hidden = true;
    KB.highlightKeys(kbEl, [], 'new');
    if (S.pausedAt && S.start) S.start += performance.now() - S.pausedAt;
    S.pausedAt = 0;
    S.running = true;
    setCursor();
  }

  function pause() {
    if (!S.running) return;
    S.running = false;
    S.lastKey = 0;
    if (S.start) S.pausedAt = performance.now();
    showIntro(true);
  }

  $('#btn-start').addEventListener('click', begin);
  $('#btn-back').addEventListener('click', () => { S = null; afterWarmup = null; renderMap(); });

  function currentStep() {
    const steps = KB.getSteps(S.text[S.idx]);
    if (!steps) return null;
    return steps.length === 2 ? steps[S.dead ? 1 : 0] : steps[0];
  }

  // Escritura libre: se muestra lo que escribe el alumno
  function renderWrite() {
    textEl.innerHTML = (S.out ? esc(S.out) : '<span class="placeholder">Empieza a escribir sobre el tema…</span>') + '<span class="caret"></span>';
    S.spans = [];
    boxEl.scrollTop = boxEl.scrollHeight;
    updateHint();
  }

  function setCursor() {
    if (S.mode === 'write') return renderWrite();
    S.spans.forEach(s => s.classList.remove('cur'));
    const cur = S.spans[S.idx];
    if (!cur) return;
    cur.classList.add('cur');
    const lineH = cur.offsetHeight || 40;
    const target = cur.offsetTop - lineH * 0.4;
    if (Math.abs(boxEl.scrollTop - target) > lineH * 0.5) boxEl.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    updateHint();
  }

  function updateHint() {
    updateHintInner();
    if (S.notice) $('#hint').innerHTML = `<span class="shift-warn">${S.notice}</span> ` + $('#hint').innerHTML;
  }
  function updateHintInner() {
    if (S.mode === 'write') {
      const words = (S.out.match(/[a-záéíóúüñ]+/gi) || []).length;
      $('#hint').innerHTML = `<b>Tema:</b> ${esc(S.topic)} <span class="word-count">· ${words} palabra${words === 1 ? '' : 's'}</span>`;
      KB.highlightKeys(kbEl, []); KB.highlightFingers(handsEl, []);
      return;
    }
    if (S.mode === 'real' && S.wrong > 0) {
      $('#hint').innerHTML = `Hay ${S.wrong === 1 ? 'un error' : S.wrong + ' errores'} sin corregir: bórra${S.wrong === 1 ? 'lo' : 'los'} con la tecla <kbd>⟵</kbd> usando el <b class="fname f-pinky">meñique derecho</b>`;
      KB.highlightKeys(kbEl, ['Backspace']);
      KB.highlightFingers(handsEl, ['rp']);
      return;
    }
    const ch = S.text[S.idx];
    if (S.lesson.exam) {
      $('#hint').innerHTML = S.dead ? '…y ahora la vocal' : 'Examen sin ayudas: confía en tu memoria y en la fila guía.';
      return;
    }
    const step = currentStep();
    if (!step) { $('#hint').innerHTML = ''; KB.highlightKeys(kbEl, []); KB.highlightFingers(handsEl, []); return; }
    const info = KB.stepInfo(step);
    KB.highlightKeys(kbEl, info.codes);
    KB.highlightFingers(handsEl, ch === ' ' ? ['th'] : info.fingers);
    const f = KB.FINGERS[info.key.finger];
    const keyTxt = esc(KB.keyLabel(info.key));
    let html;
    if (ch === ' ') html = 'Pulsa la <kbd>barra espaciadora</kbd> con el <b>pulgar</b>';
    else if (step.dead) html = `Para <b class="big-ch">${esc(ch)}</b>: primero la tilde <kbd>${keyTxt}</kbd> con el <b>${f.name}</b> (no verás nada)…`;
    else html = `Pulsa <kbd>${keyTxt}</kbd> con el <b class="fname f-${f.type}">${f.name}</b>`;
    if (step.shift) {
      const sk = KB.KEY_BY_CODE[info.codes[1]];
      html += ` mientras mantienes <kbd>Mayús</kbd> con el <b>${KB.FINGERS[sk.finger].name}</b>`;
    }
    if (S.dead) html = `…y ahora la vocal: ${html}`;
    $('#hint').innerHTML = html;
  }

  const elapsed = () => (S.start ? ((S.pausedAt || performance.now()) - S.start) / 1000 : 0);

  function updateLive() {
    const secs = elapsed();
    const mins = secs ? Math.max(secs / 60, 1 / 60) : 0;
    const done = S.mode === 'write' ? S.out.length : S.idx - S.wrong;
    $('#live-wpm').textContent = mins ? Math.round(done / 5 / mins) : 0;
    $('#live-acc').textContent = S.mode === 'write' ? '—' : S.strokes ? Math.round(100 * (S.strokes - S.errors) / S.strokes) : 100;
    $('#progress-bar').style.width = S.text.length ? (100 * S.idx / S.text.length) + '%' : '0';
    if (S.timeLimit) {
      const left = Math.max(0, Math.ceil(S.timeLimit - secs));
      $('#live-timer').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      $('#live-timer-box').classList.toggle('ending', left <= 10);
    }
  }
  setInterval(() => {
    if (!S || !S.running || current !== 'screen-lesson') return;
    updateLive();
    if (S.timeLimit && S.start && elapsed() >= S.timeLimit) finish();
  }, 250);

  // Tiempo activo: solo cuenta el tiempo escribiendo. Entre dos pulsaciones, como mucho 5 s.
  function activity() {
    const now = performance.now();
    if (S.lastKey) S.active += Math.min(now - S.lastKey, 5000);
    S.lastKey = now;
  }

  // Teclas Mayús pulsadas ahora mismo (para comprobar que se usa la de la mano contraria)
  const shiftHeld = { ShiftLeft: false, ShiftRight: false };
  window.addEventListener('blur', () => { shiftHeld.ShiftLeft = shiftHeld.ShiftRight = false; });

  function shiftProblem(e) {
    const step = currentStep();
    if (!step || !step.shift) return null;
    if (!e.shiftKey) return 'Usa la tecla <b>Mayús</b>, no Bloq Mayús.';
    const need = KB.stepInfo(step).codes[1];
    if ((shiftHeld.ShiftLeft || shiftHeld.ShiftRight) && !shiftHeld[need])
      return `<b>Mayús con la otra mano:</b> para esta tecla, la Mayús ${need === 'ShiftLeft' ? 'izquierda' : 'derecha'}.`;
    return null;
  }

  function wrong(expected, code) {
    S.errors++;
    S.strokes++;
    S.errBy[expected] = (S.errBy[expected] || 0) + 1;
    S.marks[S.idx] = 'fix';
    S.dead = false;
    const sp = S.spans[S.idx];
    sp.classList.remove('err'); void sp.offsetWidth; sp.classList.add('err');
    if (code) KB.flashKey(kbEl, code);
    beep();
    updateHint();
    updateLive();
  }

  function typed(key, code, e) {
    const exp = S.text[S.idx];
    if (!S.start) S.start = performance.now();
    activity();
    if (key !== exp) return wrong(exp, code);
    const sp = e && shiftProblem(e);
    if (sp) { S.notice = sp; return wrong(exp, code); }
    S.notice = '';
    S.strokes++;
    S.hitBy[exp] = (S.hitBy[exp] || 0) + 1;
    S.spans[S.idx].classList.add(S.marks[S.idx] === 'fix' ? 'fixed' : 'ok');
    S.idx++;
    S.dead = false;
    updateLive();
    if (S.idx >= S.text.length) return finish();
    setCursor();
  }

  function onDead(e) {
    const steps = KB.getSteps(S.text[S.idx]);
    if (!S.start) S.start = performance.now();
    activity();
    if (steps && steps.length === 2 && e.code === steps[0].code && e.shiftKey === !!steps[0].shift) {
      S.dead = true; updateHint();
    } else wrong(S.text[S.idx], e.code);
  }

  // Modo real: los errores no bloquean; hay que borrarlos con ⟵ antes de terminar
  function realKey(e) {
    if (!S.start) S.start = performance.now();
    activity();
    if (S.idx >= S.text.length) { updateHint(); beep(); return; } // al final, con errores pendientes
    const exp = S.text[S.idx];
    const good = e.key === exp;
    const sp = good && shiftProblem(e);
    S.strokes++;
    if (good && !sp) { S.hitBy[exp] = (S.hitBy[exp] || 0) + 1; S.notice = ''; }
    else { S.errors++; S.errBy[exp] = (S.errBy[exp] || 0) + 1; beep(); if (sp) S.notice = sp; }
    if (!good) S.wrong++;
    S.typed.push(good);
    const span = S.spans[S.idx];
    span.classList.add(good ? 'ok' : 'bad');
    if (!good) span.dataset.typed = e.key;
    S.idx++;
    updateLive();
    if (S.idx >= S.text.length && S.wrong === 0) return finish();
    setCursor();
  }

  function writeKey(e) {
    if (!S.start) S.start = performance.now();
    activity();
    S.strokes++;
    S.out += e.key;
    updateLive();
    renderWrite();
  }

  function backspace() {
    if (!S.start) return;
    activity();
    if (S.mode === 'write') {
      if (!S.out) return;
      S.out = [...S.out].slice(0, -1).join(''); S.corrections++;
      updateLive(); return renderWrite();
    }
    if (!S.idx) return;
    S.idx--;
    const was = S.typed.pop();
    if (!was) S.wrong--;
    S.corrections++;
    const span = S.spans[S.idx];
    span.classList.remove('ok', 'bad');
    delete span.dataset.typed;
    updateLive();
    setCursor();
  }

  /* ---------- ¿el teclado está en español? ---------- */
  function checkLayout(e) {
    if (!/^(Key[A-Z]|Semicolon)$/.test(e.code) || e.key.length !== 1 || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = KB.KEY_BY_CODE[e.code];
    if (e.key.toLowerCase() === k.base) layoutBad = Math.max(0, layoutBad - 1);
    else layoutBad = Math.min(6, layoutBad + 1);
    const w = $('#layout-warning');
    if (layoutBad >= 3) {
      w.innerHTML = `Parece que este ordenador <b>no tiene el teclado en español</b>: la tecla <kbd>${esc(KB.keyLabel(k))}</kbd> ha escrito «${esc(e.key)}». ` +
        'Pide ayuda para cambiar la distribución del teclado a <b>Español (España)</b>.';
      w.hidden = false;
    } else if (layoutBad === 0) w.hidden = true;
  }

  /* =========================================================
     4. RESULTADOS
     ========================================================= */
  function finish() {
    S.running = false;
    const l = S.lesson;
    let secs = Math.max(elapsed(), 1);
    if (S.timeLimit) secs = Math.min(secs, S.timeLimit);
    const write = S.mode === 'write';
    const chars = write ? S.out.trim().length : S.idx;
    if (!chars) { renderMap(); return; }
    const wpm = Math.round(chars / 5 / (secs / 60));
    const acc = write ? null : S.strokes ? Math.round(1000 * (S.strokes - S.errors) / S.strokes) / 10 : 100;
    const min = minWpmOf(l);
    const minAcc = l.minAcc || 90;

    // acierto en las teclas nuevas de la lección
    let fh = 0, fe = 0;
    [...new Set(l.focusChars || '')].forEach(c => { fh += S.hitBy[c] || 0; fe += S.errBy[c] || 0; });
    const focusAcc = fh + fe >= 5 ? Math.round(1000 * fh / (fh + fe)) / 10 : null;

    let checks, quality = null;
    if (write) {
      quality = writingQuality(S.out);
      checks = Object.assign({ wpm: wpm >= min }, quality.checks);
    } else {
      checks = { acc: acc >= minAcc, wpm: wpm >= min, focus: focusAcc === null || focusAcc >= FOCUS_MIN_ACC };
    }
    const ok = l.free ? true : Object.values(checks).every(Boolean);
    let stars = 0;
    if (ok && !l.free && !l.warmup) {
      stars = write ? (wpm >= min * 2 ? 3 : wpm >= min * 1.5 ? 2 : 1)
        : acc >= 98 && wpm >= min * 1.5 ? 3 : acc >= 96.5 && wpm >= min * 1.25 ? 2 : 1;
    }
    activity();
    const activeSecs = Math.max(1, Math.round(S.active / 1000));
    const res = { wpm, acc, stars, focusAcc, secs: Math.round(secs), active: activeSecs, date: Date.now(),
      corrections: S.corrections, quality, text: write ? S.out.trim() : '', topic: S.topic };
    if (l.warmup) profile.warm = Store.dayKey();
    if (write) {
      profile.writings.push({ topic: S.topic, text: res.text, wpm, words: quality.words, ok, date: Date.now() });
      profile.writings = profile.writings.slice(-10);
    }

    // estadísticas por tecla (repaso personalizado, mapa de calor y panel del profesor/a)
    Object.entries(S.hitBy).forEach(([c, n]) => { const k = c.toLowerCase(); (profile.keys[k] = profile.keys[k] || { h: 0, e: 0 }).h += n; });
    Object.entries(S.errBy).forEach(([c, n]) => { const k = c.toLowerCase(); (profile.keys[k] = profile.keys[k] || { h: 0, e: 0 }).e += n; });
    const goalBefore = Store.todaySec(profile) >= goalSec();
    Store.addPractice(profile, res.active); // solo el tiempo escribiendo
    const goalNow = !goalBefore && Store.todaySec(profile) >= goalSec();

    const wasPassed = !l.custom && isPassed(profile, l.id);
    let prevStars = 0;
    if (!l.custom) {
      const r = profile.lessons[l.id] = profile.lessons[l.id] || { attempts: 0, passed: false, best: null };
      prevStars = r.best ? r.best.stars : 0;
      r.attempts++;
      if (ok) r.passes = (r.passes || 0) + 1;
      r.passed = r.passed || (r.passes || 0) >= l.passes;
      r.last = res;
      if (!r.best || stars > r.best.stars || (stars === r.best.stars && wpm > r.best.wpm)) r.best = { wpm, acc, stars };
    }
    const nowPassed = !l.custom && isPassed(profile, l.id);
    if (l.free) {
      profile.tests.push({ title: l.title, mins: l.timeLimit ? l.timeLimit / 60 : 0, wpm, acc, date: Date.now() });
      profile.tests = profile.tests.slice(-30);
    }

    // puntos del ranking: solo cuentan los ejercicios con al menos un 90 % de precisión
    const pts = { min: 0, stars: 0, lesson: 0, goal: 0 };
    if (write ? ok : acc >= 90) pts.min = Math.round(res.active / 6);
    if (!l.custom) pts.stars = Math.max(0, stars - prevStars) * 10;
    if (nowPassed && !wasPassed) pts.lesson = 50;
    if (goalNow) pts.goal = 20 + Math.min(30, 5 * Store.streak(profile));
    const bonus = pts.stars + pts.lesson + pts.goal;
    pts.total = Store.addPoints(profile, pts.min, bonus);
    pts.min = pts.total - bonus; // por si se llegó al tope diario
    persist();

    syncProfile('result', {
      leccion: l.warmup ? 'calentamiento' : l.free ? (l.timeLimit ? `prueba ${l.timeLimit / 60} min` : 'libre') : l.custom ? 'repaso' : l.id,
      titulo: write ? `${l.title}: ${S.topic}` : l.title, ppm: wpm, precision: write ? '' : acc, estrellas: stars, superada: ok, segundos: res.active,
      texto: res.text,
      fecha: new Date().toISOString()
    });

    renderResults(l, res, { ok, checks, min, minAcc, wasPassed, nowPassed, goalNow, pts });
  }

  function renderResults(l, res, o) {
    const { ok, checks, min, minAcc, wasPassed, nowPassed, goalNow, pts } = o;
    $('#res-stars').hidden = !!l.free || !!l.warmup;
    $('#res-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= res.stars ? 'on' : ''}" style="--d:${i * 0.15}s">★</span>`).join('');
    const r = !l.custom && profile.lessons[l.id];
    const need = l.passes || 1;
    let title, msg;
    if (l.free) {
      title = l.timeLimit ? `Prueba de ${l.timeLimit / 60} min terminada` : '¡Texto completado!';
      const prev = profile.tests.filter(t => t.mins === (l.timeLimit ? l.timeLimit / 60 : 0)).slice(0, -1);
      const best = prev.length ? Math.max(...prev.map(t => t.wpm)) : 0;
      msg = !prev.length ? 'Repítela otro día para comparar tu progreso.'
        : res.wpm > best ? `¡Nuevo récord! Tu mejor marca anterior era ${best} ppm.` : `Tu mejor marca en esta prueba: ${best} ppm.`;
    } else if (l.warmup) {
      title = '¡Calentamiento hecho!';
      msg = afterWarmup ? `Los dedos ya están listos. Ahora sí: a por la lección ${afterWarmup.id}.` : 'Los dedos ya están listos para hoy.';
    } else if (ok && l.custom) {
      title = '¡Repaso completado!';
      msg = 'Las teclas que repasas hoy te costarán menos mañana.';
    } else if (ok && nowPassed && !wasPassed) {
      title = l.exam ? '¡Examen superado!' : '¡Lección superada!';
      msg = !nextLesson(profile) && !l.optional ? '¡Has terminado el curso! Ya puedes imprimir tu diploma desde el mapa. Si quieres más, prueba el nivel avanzado.'
        : l.optional && !nextAny(profile) ? '¡Has completado el nivel avanzado! Escribes como un profesional.'
        : `Has desbloqueado la lección ${l.id + 1}.` + (res.stars < 3 ? ' Puedes repetirla para conseguir más estrellas.' : '');
      tone(660, 0.1, 'sine', 0.08); setTimeout(() => tone(880, 0.15, 'sine', 0.08), 110);
    } else if (ok && !nowPassed) {
      title = `¡Aprobada! ${r.passes} de ${need}`;
      msg = `Apruébala ${need - r.passes === 1 ? 'una vez más' : (need - r.passes) + ' veces más'} para superarla y desbloquear la siguiente. Así nos aseguramos de que la dominas.`;
      tone(660, 0.1, 'sine', 0.08);
    } else if (ok) {
      title = res.stars === 3 ? '¡Perfecto!' : '¡Muy bien!';
      msg = res.stars < 3 ? 'Puedes repetirla para conseguir más estrellas, o seguir adelante.' : 'Precisión y velocidad de campeón/a.';
    } else {
      title = 'Casi… ¡otra vez!';
      msg = res.quality ? (!checks.enough ? 'Escribe un poco más: hacen falta al menos 20 palabras distintas.'
          : !checks.real ? 'Parece que hay letras al azar. Escribe frases de verdad sobre el tema.'
            : !checks.varied ? 'Repites mucho la misma palabra. Intenta decir más cosas sobre el tema.'
              : 'Intenta escribir con más fluidez, sin pararte tanto entre palabras.')
        : !checks.acc ? 'Ve un poco más despacio: primero, acertar; la velocidad llega después.'
        : !checks.focus ? 'Te cuestan las teclas nuevas. Fíjate en qué dedo las pulsa y vuelve a intentarlo con calma.'
          : 'Tu precisión es muy buena. Ahora intenta ir algo más rápido, con ritmo constante.';
    }
    $('#res-title').textContent = title;
    $('#res-msg').textContent = msg;
    $('#res-wpm').textContent = res.wpm;
    $('#res-acc').textContent = res.quality ? res.quality.words : res.acc + '%';
    $('#res-acc').nextElementSibling.textContent = res.quality ? 'palabras' : 'precisión';
    $('#res-time').textContent = fmtTime(res.secs);
    const showGoals = !l.free;
    $('#res-wpm-goal').innerHTML = showGoals && !l.custom ? `${checks.wpm ? '✓' : '✗'} objetivo: ${min}` : '';
    $('#res-wpm-goal').className = checks.wpm ? 'ok' : 'ko';
    $('#res-acc-goal').innerHTML = !showGoals ? '' : res.quality
      ? `<span class="${checks.enough ? 'ok' : 'ko'}">${checks.enough ? '✓' : '✗'} ${res.quality.distinct} distintas (mín. 20)</span>`
      : `<span class="${checks.acc ? 'ok' : 'ko'}">${checks.acc ? '✓' : '✗'} objetivo: ${minAcc}%</span>` +
      (res.focusAcc !== null && !l.custom ? `<span class="${checks.focus ? 'ok' : 'ko'}">${checks.focus ? '✓' : '✗'} teclas nuevas: ${res.focusAcc}% (mín. ${FOCUS_MIN_ACC}%)</span>` : '');
    $('#res-acc-goal').className = 'goals';
    $('#res-err').textContent = res.quality ? (S.corrections ? `${S.corrections} borrados` : '')
      : (S.errors === 1 ? '1 error' : `${S.errors} errores`) + (S.mode === 'real' && S.corrections ? ` · ${S.corrections} borrados` : '');
    const parts = [];
    if (pts.min) parts.push(`${pts.min} por practicar`);
    if (pts.stars) parts.push(`${pts.stars} por estrellas nuevas`);
    if (pts.lesson) parts.push(`${pts.lesson} por superar la lección`);
    if (pts.goal) parts.push(`${pts.goal} por el objetivo diario`);
    $('#res-points').innerHTML = pts.total
      ? `<b>+${pts.total} puntos</b><span>${parts.join(' · ')}</span>`
      : '<b>+0 puntos</b><span>Solo suman los ejercicios con al menos un 90 % de precisión.</span>';
    $('#res-points').hidden = !rankingOn();

    const today = Math.floor(Store.todaySec(profile) / 60), st = Store.streak(profile);
    $('#res-daily').innerHTML = goalNow
      ? `<b>🎉 ¡Objetivo de hoy cumplido!</b> ${today} minutos · 🔥 ${st} ${st === 1 ? 'día seguido' : 'días seguidos'}`
      : `Hoy llevas <b>${today} de ${CONFIG.DAILY_GOAL_MIN || 10} min</b> · 🔥 ${st} ${st === 1 ? 'día seguido' : 'días seguidos'}`;
    $('#res-daily').classList.toggle('done', goalNow);

    const weak = Object.entries(S.errBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('#res-weak').innerHTML = res.quality
      ? `<details class="my-text"><summary>Ver lo que has escrito</summary><p><b>${esc(res.topic)}</b></p><p>${esc(res.text)}</p></details>`
      : weak.length
      ? `<span>Teclas a practicar:</span>${weak.map(([c, n]) => {
          const key = KB.findKey(c) || KB.KEY_BY_CODE.Space;
          const f = KB.FINGERS[key.finger] || KB.FINGERS.th;
          return `<span class="wk f-${f.type}" title="${f.name}"><kbd>${c === ' ' ? 'espacio' : esc(c)}</kbd>×${n}</span>`;
        }).join('')}`
      : '<span>¡Sin ningún error! 👏</span>';

    const next = l.warmup ? afterWarmup : !l.custom && LESSONS.find(x => x.id === l.id + 1);
    $('#btn-next').hidden = !(l.warmup ? next : nowPassed && next);
    $('#btn-next').textContent = l.warmup && next ? `Seguir: lección ${next.id} →` : 'Siguiente lección →';
    $('#btn-next').onclick = () => startLesson(next);
    $('#btn-repeat').onclick = () => startLesson(l);
    $('#btn-repeat').classList.toggle('primary', $('#btn-next').hidden);
    show('screen-results');
  }
  $('#btn-map').addEventListener('click', () => renderMap());

  /* =========================================================
     LECCIÓN 0 · ANTES DE EMPEZAR
     ========================================================= */
  const HOME_SEQ = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Space'];
  const ALL_FINGERS = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp', 'th'];
  let P = null;

  const POSTURE_STEPS = [
    {
      title: 'Siéntate bien',
      html: () => `
        <p class="p-lead">Antes de tocar una tecla, prepara tu cuerpo. Escribir bien empieza por estar cómodo.</p>
        <ul class="rules">
          <li><span>🪑</span><div><b>Espalda recta</b>, apoyada en el respaldo de la silla.</div></li>
          <li><span>🦶</span><div><b>Pies planos</b> en el suelo (o en un reposapiés).</div></li>
          <li><span>💪</span><div><b>Codos junto al cuerpo</b>, doblados como una letra L.</div></li>
          <li><span>✋</span><div><b>Muñecas rectas</b> y en el aire mientras escribes. No las apoyes en la mesa.</div></li>
          <li><span>👀</span><div><b>Pantalla</b> a la altura de los ojos, a un brazo de distancia.</div></li>
          <li><span>⏸️</span><div><b>Descansa</b> cada 20 o 30 minutos: mira a lo lejos y estira los brazos.</div></li>
        </ul>`
    },
    {
      title: 'La fila guía',
      html: () => `
        <p class="p-lead">Cada dedo tiene su <b>casa</b> en la fila del medio. Desde ahí sale a pulsar sus teclas y <b>siempre vuelve</b>.</p>
        <div class="p-kb" id="p-kb"></div>
        <div class="p-hands" id="p-hands"></div>
        <p>Mano izquierda: <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> · Mano derecha: <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>Ñ</kbd> · Pulgares: <kbd>espacio</kbd>.<br>
        Las teclas <b>F</b> y <b>J</b> tienen una rayita en relieve: tócala con los índices para encontrar tu sitio sin mirar.
        Cada color del teclado es un dedo: ese dedo es el único que pulsa esas teclas.</p>`,
      after: () => {
        KB.buildKeyboard($('#p-kb')); KB.buildHands($('#p-hands'));
        KB.highlightKeys($('#p-kb'), HOME_SEQ, 'new');
        KB.highlightFingers($('#p-hands'), ALL_FINGERS);
      }
    },
    {
      title: 'Comprueba tu teclado',
      html: () => `
        <p class="p-lead">Este curso está hecho para el <b>teclado español</b>. Vamos a comprobarlo.</p>
        <p class="p-task">Pulsa la tecla <kbd class="big">Ñ</kbd> (con el meñique derecho).</p>
        <div class="p-status" id="p-status">Esperando…</div>`,
      wait: () => P.layout !== null,
      key: e => {
        if (e.key.length !== 1 && e.key !== 'Dead') return;
        const ok = e.key.toLowerCase() === 'ñ';
        P.layout = ok;
        const st = $('#p-status');
        st.className = 'p-status ' + (ok ? 'ok' : 'ko');
        st.innerHTML = ok
          ? '✓ ¡Perfecto! Tu teclado está en español.'
          : `Has pulsado una tecla que escribe «${esc(e.key === 'Dead' ? 'tilde' : e.key)}». ` +
            (e.code === 'Semicolon'
              ? 'Esa es la tecla correcta, pero el ordenador no tiene el teclado en <b>Español (España)</b>. Pide ayuda para cambiarlo.'
              : 'Prueba otra vez: es la tecla a la derecha de la L.');
        if (!ok && e.code !== 'Semicolon') P.layout = null;
        updatePostureNav();
      }
    },
    {
      title: 'Coloca los dedos',
      html: () => `
        <p class="p-lead">Pon los dedos en la fila guía y pulsa, <b>una a una</b>, las teclas que se iluminen, con el dedo que se ilumina en la mano.</p>
        <div class="p-seq" id="p-seq">${HOME_SEQ.map((c, i) => `<kbd data-i="${i}">${c === 'Space' ? 'espacio' : esc(KB.keyLabel(KB.KEY_BY_CODE[c]))}</kbd>`).join('')}</div>
        <div class="p-kb" id="p-kb"></div>
        <div class="p-hands" id="p-hands"></div>
        <p class="p-status" id="p-status">Intenta hacerlo sin mirar el teclado.</p>`,
      after: () => { KB.buildKeyboard($('#p-kb')); KB.buildHands($('#p-hands')); P.seq = 0; seqShow(); },
      wait: () => P.seq >= HOME_SEQ.length,
      key: e => {
        if (P.seq >= HOME_SEQ.length) return;
        if (e.code === HOME_SEQ[P.seq]) { P.seq++; tone(520 + P.seq * 40, 0.06, 'sine', 0.06); seqShow(); }
        else { KB.flashKey($('#p-kb'), e.code); beep(); }
      }
    },
    {
      title: 'Las reglas de oro',
      html: () => `
        <ol class="gold">
          <li><b>No mires el teclado.</b> Al principio irás despacio, pero así es como se aprende de verdad.</li>
          <li><b>Primero, acertar; luego, correr.</b> La velocidad llega sola si no te equivocas.</li>
          <li><b>Cada tecla con su dedo</b>, aunque otro dedo te parezca más cómodo.</li>
          <li><b>Vuelve siempre a la fila guía</b> después de cada tecla.</li>
          <li><b>Un poco cada día</b> es mejor que mucho un solo día. Tu objetivo: ${CONFIG.DAILY_GOAL_MIN || 10} minutos al día.</li>
        </ol>
        <p class="p-lead">¡Ya estás preparado/a para la lección 1!</p>`
    }
  ];

  function seqShow() {
    const kb = $('#p-kb'), hands = $('#p-hands');
    $$('#p-seq kbd').forEach((k, i) => { k.className = i < P.seq ? 'done' : i === P.seq ? 'cur' : ''; });
    if (P.seq < HOME_SEQ.length) {
      const code = HOME_SEQ[P.seq];
      KB.highlightKeys(kb, [code]);
      KB.highlightFingers(hands, [KB.KEY_BY_CODE[code].finger]);
    } else {
      KB.highlightKeys(kb, []); KB.highlightKeys(kb, HOME_SEQ, 'new'); KB.highlightFingers(hands, ALL_FINGERS);
      $('#p-status').className = 'p-status ok';
      $('#p-status').textContent = '✓ ¡Muy bien! Así empezarás cada lección.';
    }
    updatePostureNav();
  }

  function startPosture() {
    P = { step: 0, layout: null, seq: 0 };
    renderPosture();
    show('screen-posture');
  }
  function renderPosture() {
    const st = POSTURE_STEPS[P.step];
    $('#posture-body').innerHTML = `<p class="eyebrow">Paso ${P.step + 1} de ${POSTURE_STEPS.length}</p><h2>${st.title}</h2>${st.html()}`;
    $('#posture-dots').innerHTML = POSTURE_STEPS.map((_, i) => `<span class="${i <= P.step ? 'on' : ''}"></span>`).join('');
    if (st.after) st.after();
    updatePostureNav();
  }
  function updatePostureNav() {
    const st = POSTURE_STEPS[P.step], last = P.step === POSTURE_STEPS.length - 1;
    $('#posture-prev').disabled = P.step === 0;
    $('#posture-next').disabled = !!(st.wait && !st.wait());
    $('#posture-next').textContent = last ? '¡Terminado! Ir a la lección 1 →' : 'Siguiente →';
  }
  function postureNext() {
    if ($('#posture-next').disabled) return;
    if (P.step < POSTURE_STEPS.length - 1) { P.step++; renderPosture(); return; }
    const r = profile.lessons[0] = profile.lessons[0] || { attempts: 0 };
    r.attempts = (r.attempts || 0) + 1;
    const first = !r.passed;
    r.passed = true;
    r.passes = 1;
    r.best = { wpm: 0, acc: 100, stars: 3 };
    if (first) Store.addPoints(profile, 0, 50);
    persist();
    syncProfile('perfil');
    startLesson(LESSONS.find(l => l.id === 1));
  }
  $('#posture-next').addEventListener('click', postureNext);
  $('#posture-prev').addEventListener('click', () => { if (P.step > 0) { P.step--; renderPosture(); } });
  $('#btn-posture-back').addEventListener('click', () => renderMap());

  /* =========================================================
     PRÁCTICA LIBRE Y PRUEBAS CRONOMETRADAS
     ========================================================= */
  function openFree() {
    const custom = CONFIG.CUSTOM_TEXTS || [];
    openDialog('Práctica libre y pruebas', `
      <form id="free-form" class="free-form">
        <label>Texto
          <select name="src">
            <option value="random">Un texto al azar de Teclea</option>
            ${custom.map((t, i) => `<option value="c${i}">${esc(t.titulo || 'Texto ' + (i + 1))}</option>`).join('')}
            <option value="paste">Pegar o escribir mi propio texto</option>
          </select>
        </label>
        <label id="free-paste" hidden>Tu texto
          <textarea name="text" rows="5" placeholder="Pega aquí el texto que quieras practicar…"></textarea>
          <small>Se quitarán los caracteres que no se enseñan en el curso (como @ o €).</small>
        </label>
        <fieldset class="seg">
          <legend>Duración</legend>
          <label><input type="radio" name="t" value="0" checked><span>Sin límite</span></label>
          <label><input type="radio" name="t" value="60"><span>1 min</span></label>
          <label><input type="radio" name="t" value="120"><span>2 min</span></label>
          <label><input type="radio" name="t" value="180"><span>3 min</span></label>
          <label><input type="radio" name="t" value="300"><span>5 min</span></label>
        </fieldset>
        <p class="form-msg ko" id="free-msg"></p>
        <div class="dlg-actions"><button class="btn primary" type="submit">Empezar</button></div>
      </form>
      ${profile.tests.length ? `<div class="tests"><b>Tus últimas pruebas</b>${profile.tests.slice(-5).reverse().map(t =>
        `<span>${new Date(t.date).toLocaleDateString('es-ES')} · ${t.mins ? t.mins + ' min' : 'libre'} · <b>${t.wpm} ppm</b> · ${t.acc}%</span>`).join('')}</div>` : ''}`);
    const f = $('#free-form');
    f.src.onchange = () => { $('#free-paste').hidden = f.src.value !== 'paste'; };
    f.onsubmit = e => {
      e.preventDefault();
      const secs = +f.t.value;
      let title, raw, lesson;
      if (f.src.value === 'random') {
        title = secs ? `Prueba de ${secs / 60} min` : 'Texto al azar';
        lesson = freeLesson(title, '', secs);
        lesson.make = () => { let t = takeText(); while (secs && t.length < secs * 8) t += ' ' + takeText(); return t; };
        dlg.close(); startLesson(lesson); return;
      }
      if (f.src.value === 'paste') { raw = f.text.value; title = 'Mi texto'; }
      else { const c = custom[+f.src.value.slice(1)]; raw = c.texto; title = c.titulo || 'Texto del profesor/a'; }
      const clean = sanitizeText(raw, canType);
      if (clean.text.length < 10) { $('#free-msg').textContent = 'El texto es demasiado corto.'; return; }
      lesson = freeLesson(secs ? `${title} · ${secs / 60} min` : title, clean.text, secs);
      if (clean.removed) lesson.note = `(Se ${clean.removed === 1 ? 'ha quitado 1 carácter que no se enseña' : `han quitado ${clean.removed} caracteres que no se enseñan`} en el curso.)`;
      dlg.close(); startLesson(lesson);
    };
  }

  /* =========================================================
     DIPLOMA
     ========================================================= */
  function printDiploma() {
    $('#dip-name').textContent = profile.name;
    $('#dip-group').textContent = profile.group ? 'Grupo ' + profile.group : '';
    const stars = CORE_LESSONS.reduce((a, l) => a + starsOf(profile, l.id), 0);
    const advBest = [...LESSONS].reverse().find(l => l.optional && isPassed(profile, l.id));
    $('#dip-adv').textContent = advBest ? `Nivel avanzado superado: ${advBest.minWpm} palabras por minuto.` : '';
    $('#dip-stats').innerHTML = `
      <div><b>${bestWpm(profile)}</b><span>palabras por minuto</span></div>
      <div><b>${stars}</b><span>estrellas</span></div>
      <div><b>${Math.round(profile.totalSec / 60)}</b><span>minutos de práctica</span></div>`;
    $('#dip-date').textContent = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    $('#dip-school').textContent = CONFIG.SCHOOL_NAME || ' ';
    $('#dip-teacher').textContent = CONFIG.TEACHER_NAME ? 'Profesor/a: ' + CONFIG.TEACHER_NAME : (CONFIG.SCHOOL_NAME ? 'Centro' : '');
    window.print();
  }

  /* =========================================================
     TECLADO FÍSICO
     ========================================================= */
  document.addEventListener('keydown', e => {
    if (e.code in shiftHeld) shiftHeld[e.code] = true;
    if (e.key && e.key.length === 1 && !$('#touch-warning').hidden) dismissTouch();
    if (dlg.open || (e.target.closest && e.target.closest('input, textarea, select'))) return;

    if (current === 'screen-posture' && P) {
      const st = POSTURE_STEPS[P.step];
      if (e.key === 'Enter') { e.preventDefault(); postureNext(); return; }
      if (e.key === 'Escape') { renderMap(); return; }
      if (st.key && !e.repeat) { e.preventDefault(); st.key(e); }
      return;
    }

    if (current === 'screen-lesson' && S) {
      $('#caps-warning').hidden = !(e.getModifierState && e.getModifierState('CapsLock'));
      if (!$('#intro').hidden) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
        else if (e.key === 'Escape') { S = null; renderMap(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); pause(); return; }
      if ((e.ctrlKey && !e.altKey) || e.metaKey) return;
      checkLayout(e);
      if (S.mode !== 'normal') {
        if (e.key === 'Backspace') { e.preventDefault(); if (S.running) backspace(); return; }
        if (e.key === 'Dead') return; // la tilde se une a la vocal siguiente
        if (e.key.length !== 1) { if (e.key === 'Tab') e.preventDefault(); return; }
        e.preventDefault();
        if (S.running) (S.mode === 'real' ? realKey : writeKey)(e);
        return;
      }
      if (e.key === 'Dead') { e.preventDefault(); if (S.running) onDead(e); return; }
      if (e.key.length !== 1) { if (e.key === 'Backspace' || e.key === 'Tab') e.preventDefault(); return; }
      e.preventDefault();
      if (S.running) typed(e.key, e.code, e);
      return;
    }

    if (current === 'screen-results') {
      if (e.key === 'Enter') { e.preventDefault(); ($('#btn-next').hidden ? $('#btn-repeat') : $('#btn-next')).click(); }
      else if (e.key === 'Escape') renderMap();
    }
  });

  document.addEventListener('keyup', e => {
    if (e.code in shiftHeld) shiftHeld[e.code] = false;
    if (current === 'screen-lesson') $('#caps-warning').hidden = !(e.getModifierState && e.getModifierState('CapsLock'));
  });

  /* =========================================================
     EXPORTAR E IMPORTAR PROGRESO
     ========================================================= */
  function openExport() {
    const code = Store.exportCode(profile);
    const pend = Sync.enabled() ? Sync.pending() : 0;
    openDialog('Guardar o llevar tu progreso', `
      <p>Tu progreso ya se guarda solo en <b>este ordenador</b>. Si vas a usar otro, o el navegador se borra, guarda este código o descarga el archivo.</p>
      <textarea class="code" readonly rows="5">${esc(code)}</textarea>
      <div class="dlg-actions">
        <button class="btn" type="button" id="copy-code">Copiar código</button>
        <button class="btn primary" type="button" id="dl-code">Descargar archivo</button>
      </div>
      <p class="small">En el otro ordenador: <i>Salir → Tengo un código de progreso</i>.</p>
      ${Sync.enabled() ? `<p class="small ok">✓ Tu progreso también se envía a la hoja del profesor/a: en otro ordenador basta con escribir tu nombre, grupo y PIN.</p>
        ${pend ? `<p class="small">⏳ Hay ${pend} resultado(s) esperando conexión para enviarse. No borres los datos del navegador hasta que se envíen.</p>` : ''}` : ''}`);
    $('#copy-code').onclick = async () => {
      const ta = $('#dlg-body textarea');
      try { await navigator.clipboard.writeText(code); } catch (e) { ta.select(); document.execCommand('copy'); }
      $('#copy-code').textContent = '¡Copiado!';
    };
    $('#dl-code').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      a.download = `teclea-${norm(profile.name).replace(/[^a-z0-9]+/g, '-')}.txt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
  }

  function openImport() {
    openDialog('Cargar un código de progreso', `
      <p>Pega tu código o elige el archivo que descargaste.</p>
      <textarea class="code" rows="5" placeholder="TECLEA1.…" id="imp-text"></textarea>
      <input type="file" accept=".txt,text/plain" id="imp-file">
      <p class="form-msg ko" id="imp-msg"></p>
      <div class="dlg-actions"><button class="btn primary" type="button" id="imp-go">Cargar progreso</button></div>`);
    $('#imp-file').onchange = async e => { const f = e.target.files[0]; if (f) $('#imp-text').value = (await f.text()).trim(); };
    $('#imp-go').onclick = () => {
      try {
        const p = Store.importCode($('#imp-text').value);
        const local = db.profiles[p.id];
        const merged = local ? Store.merge(local, p) : p;
        db.profiles[merged.id] = merged; Store.save(db);
        enterProfile(merged);
      } catch (err) { $('#imp-msg').textContent = err.message; }
    };
  }

  /* ---------- para el panel del profesor/a ---------- */
  window.App = {
    db: () => db,
    reload: () => { db = Store.load(); return db; },
    save: () => Store.save(db),
    show, renderProfiles, renderHeat, openDialog, closeDialog: () => dlg.close(),
    isPassed, passedCount, advPassed, nextLesson, bestWpm, weakKeys
  };

  /* ---------- cierre de sesión automático ---------- */
  const IDLE_MIN = 10;
  let lastAct = Date.now();
  ['keydown', 'pointerdown', 'wheel'].forEach(ev => document.addEventListener(ev, () => { lastAct = Date.now(); }, true));
  setInterval(() => {
    if (Date.now() - lastAct < IDLE_MIN * 60000) return;
    if (current === 'screen-teacher' && window.Teacher) { lastAct = Date.now(); Teacher.exit('Se ha cerrado el panel del profesor/a por inactividad.'); return; }
    if (!profile) return;
    const name = profile.name;
    S = null; P = null;
    if (dlg.open) dlg.close();
    db.current = null; Store.save(db);
    renderProfiles();
    $('#idle-msg').textContent = `Se ha cerrado la sesión de ${name} tras ${IDLE_MIN} minutos sin actividad.`;
    $('#idle-msg').hidden = false;
    lastAct = Date.now();
  }, 15000);
  document.addEventListener('pointerdown', () => { if (current !== 'screen-profiles') $('#idle-msg').hidden = true; });

  /* ---------- arranque ---------- */
  Sync.flush();
  if (location.hash === '#profe') setTimeout(() => window.Teacher && Teacher.open(), 0);
  window.addEventListener('hashchange', () => { if (location.hash === '#profe' && current !== 'screen-teacher' && !dlg.open) Teacher.open(); });
  renderProfiles();
})();
