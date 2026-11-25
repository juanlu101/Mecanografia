/* =========================================================
   PANEL DEL PROFESOR/A
   - Con Google Sheets: lee la hoja "Progreso" (clave de Code.gs).
   - Sin Google Sheets: muestra los alumnos de este ordenador
     y los códigos de progreso que se peguen o se suban.
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = KB.esc;
  const DAY = 86400000;

  let key = null;          // clave del profesor/a (solo en memoria)
  let students = [];       // perfiles completos
  let extra = {};          // perfiles añadidos con códigos
  let sort = { col: 'name', dir: 1 };

  function askKey() {
    return new Promise(resolve => {
      let done = false;
      App.openDialog('Acceso profesor/a', `
        <p>${Sync.enabled()
          ? 'Escribe la clave que pusiste en el script de Google (<code>CLAVE_PROFESOR</code>).'
          : 'Escribe la clave del profesor/a (<code>TEACHER_KEY</code> en <code>js/config.js</code>).'}</p>
        <form class="pin-form" id="key-form" autocomplete="off">
          <input type="password" class="key-input" required aria-label="Clave">
          <button class="btn primary" type="submit">Entrar</button>
        </form>
        <p class="form-msg ko" id="key-msg" aria-live="polite"></p>`);
      const f = $('#key-form'), inp = f.querySelector('input');
      setTimeout(() => inp.focus(), 30);
      f.onsubmit = async e => {
        e.preventDefault();
        const v = inp.value;
        const msg = $('#key-msg');
        if (Sync.enabled()) {
          msg.className = 'form-msg'; msg.textContent = 'Comprobando…';
          try { await load(v); } catch (err) { msg.className = 'form-msg ko'; msg.textContent = err.message; return; }
        } else if (v !== CONFIG.TEACHER_KEY) { msg.textContent = 'La clave no es correcta.'; return; }
        done = true; dlg.removeEventListener('close', onClose); App.closeDialog(); resolve(v);
      };
      const dlg = $('#dlg');
      const onClose = () => {
        if (dlg.open || done) return;
        done = true; dlg.removeEventListener('close', onClose); resolve(null);
      };
      dlg.addEventListener('close', onClose);
    });
  }

  async function open() {
    const v = await askKey();
    if (!v) { if (location.hash === '#profe') history.replaceState(null, '', location.pathname); return; }
    key = v;
    if (!Sync.enabled()) await load(key);
    render();
    App.show('screen-teacher');
  }

  async function load(k) {
    let list = [];
    if (Sync.enabled()) {
      const rows = await Sync.panel(k);
      list = rows.map(r => {
        try { const p = Store.importCode(r.codigo); p.remote = true; p.hasPin = r.tienePin; p.pinTxt = r.tienePin ? String(r.pinTxt || '') : ''; return p; } catch (e) { return null; }
      }).filter(Boolean);
    } else {
      list = Object.values(App.reload().profiles).map(p => Object.assign({}, p, { local: true, hasPin: !!p.pin }));
    }
    const byId = {};
    list.forEach(p => { byId[p.id] = p; });
    Object.values(extra).forEach(p => {
      byId[p.id] = byId[p.id] ? Object.assign(Store.merge(byId[p.id], p), { remote: byId[p.id].remote, local: byId[p.id].local, hasPin: byId[p.id].hasPin, pinTxt: byId[p.id].pinTxt }) : p;
    });
    students = Object.values(byId);
  }

  /* ---------- cálculos por alumno ---------- */
  function lastPractice(p) {
    const days = Object.keys(p.days || {}).sort();
    if (days.length) { const [y, m, d] = days[days.length - 1].split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
    return Object.keys(p.lessons || {}).length ? p.lastSeen || 0 : 0;
  }
  function weekMin(p) {
    let s = 0;
    for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); s += (p.days || {})[Store.dayKey(d)] || 0; }
    return Math.round(s / 60);
  }
  function row(p) {
    const next = App.nextLesson(p);
    const last = lastPractice(p);
    const ago = last ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(last).setHours(0, 0, 0, 0)) / DAY) : null;
    const lastTest = (p.tests || [])[p.tests ? p.tests.length - 1 : 0];
    return {
      p, name: p.name, group: p.group || '',
      next: next ? next.id : 99, nextTxt: next ? (next.id === 0 ? '0 · Antes de empezar' : `${next.id} · ${next.title}`)
        : '🏆 Terminado' + (App.advPassed(p) ? ` · avanzado ${App.advPassed(p)}/${LESSONS.length - CORE_LESSONS.length}` : ''),
      passed: App.passedCount(p), wpm: App.bestWpm(p), min: Math.round((p.totalSec || 0) / 60),
      week: weekMin(p), streak: Store.streak(p), last: ago === null ? 9999 : ago,
      lastTxt: ago === null ? 'nunca' : ago === 0 ? 'hoy' : ago === 1 ? 'ayer' : `hace ${ago} días`,
      weak: App.weakKeys(p.keys || {}, ALL_LETTERS, 3), test: lastTest,
      pts: Store.weekPoints(p), ptsTotal: Store.totalPoints(p)
    };
  }

  /* ---------- pintar ---------- */
  function render() {
    $('#t-source').textContent = Sync.enabled() ? 'Datos de la hoja de Google' : 'Alumnos de este ordenador' + (Object.keys(extra).length ? ' + códigos añadidos' : '');
    const groups = [...new Set(students.map(s => s.group || ''))].sort((a, b) => a.localeCompare(b, 'es'));
    const sel = $('#t-group'), prev = sel.value;
    sel.innerHTML = '<option value="*">Todos</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g || 'Sin grupo')}</option>`).join('');
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    renderTable();
  }

  function visible() {
    const g = $('#t-group').value, q = $('#t-search').value.trim().toLowerCase();
    return students.map(row)
      .filter(r => (g === '*' || r.group === g) && (!q || r.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        return (typeof x === 'string' ? x.localeCompare(y, 'es') : x - y) * sort.dir;
      });
  }

  function renderTable() {
    const rows = visible();
    $('#t-count').textContent = `${rows.length} alumno${rows.length === 1 ? '' : 's'}`;
    $$('#t-table th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.dataset.sort === sort.col);
      th.dataset.dir = sort.dir > 0 ? '▲' : '▼';
    });
    $('#t-table tbody').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><b>${esc(r.name)}</b></td>
        <td>${esc(r.group)}</td>
        <td>${esc(r.nextTxt)}</td>
        <td><div class="minibar" title="${r.passed} de ${CORE_LESSONS.length}"><span style="width:${Math.round(100 * r.passed / CORE_LESSONS.length)}%"></span></div>${r.passed}</td>
        <td>${r.wpm}${r.test ? `<small title="Última prueba">prueba: ${r.test.wpm}</small>` : ''}</td>
        <td>${r.min}</td>
        <td class="${r.week >= (CONFIG.DAILY_GOAL_MIN || 10) * 3 ? 'ok' : ''}">${r.week} min</td>
        <td>${r.streak ? '🔥 ' + r.streak : '–'}</td>
        <td><b>${r.pts}</b><small>total: ${r.ptsTotal}</small></td>
        <td class="${r.last > 7 ? 'ko' : ''}">${r.lastTxt}</td>
        <td>${r.p.pinTxt && r.p.hasPin !== false
          ? `<button class="pin-reveal" type="button" data-pin="${esc(r.p.pinTxt)}" title="Pulsa para ver u ocultar">•••••</button>`
          : r.p.hasPin ? `<span class="muted" title="${Sync.enabled() ? 'Se verá cuando el alumno vuelva a entrar con su PIN' : 'Solo se puede ver con Google Sheets conectado'}">—</span>` : '<span class="muted">sin PIN</span>'}</td>
        <td class="weak-cell">${r.weak.map(c => `<kbd>${esc(c)}</kbd>`).join(' ') || '–'}</td>
        <td>${r.p.hasPin && (r.p.remote || r.p.local) ? `<button class="link small" data-unpin="${esc(r.p.id)}" type="button">Quitar PIN</button>` : ''}</td>
      </tr>`).join('')
      : `<tr><td colspan="13" class="empty">${students.length ? 'Ningún alumno coincide con el filtro.'
        : Sync.enabled() ? 'Todavía no hay alumnos en la hoja.' : 'No hay alumnos en este ordenador. Usa «Añadir códigos» para cargar los códigos de progreso de tus alumnos.'}</td></tr>`;

    const n = rows.length || 1;
    const inactive = rows.filter(r => r.last > 7).length;
    $('#t-summary').innerHTML = `
      <div class="sum"><b>${rows.length}</b><span>alumnos</span></div>
      <div class="sum"><b>${(rows.reduce((a, r) => a + r.passed, 0) / n).toFixed(1)}</b><span>lecciones de media</span></div>
      <div class="sum"><b>${Math.round(rows.reduce((a, r) => a + r.wpm, 0) / n)}</b><span>ppm de media</span></div>
      <div class="sum"><b>${Math.round(rows.reduce((a, r) => a + r.week, 0) / n)}</b><span>min/semana de media</span></div>
      <div class="sum ${inactive ? 'warn' : ''}"><b>${inactive}</b><span>sin practicar +7 días</span></div>`;

    const agg = {};
    rows.forEach(r => Object.entries(r.p.keys || {}).forEach(([c, s]) => {
      const a = agg[c] = agg[c] || { h: 0, e: 0 }; a.h += s.h || 0; a.e += s.e || 0;
    }));
    App.renderHeat($('#t-heat'), agg);
    renderClassRanking();
  }

  // Ranking de clases: media de puntos de la semana por alumno (cuentan todos los alumnos)
  function renderClassRanking() {
    const groups = {};
    students.forEach(p => {
      const g = p.group || '';
      const x = groups[g] = groups[g] || { grupo: g, alumnos: 0, puntos: 0, activos: 0, top: null };
      const pts = Store.weekPoints(p);
      x.alumnos++; x.puntos += pts; if (pts > 0) x.activos++;
      if (!x.top || pts > x.top.pts) x.top = { name: p.name, pts };
    });
    const list = Object.values(groups).map(x => Object.assign(x, { media: Math.round(x.puntos / x.alumnos) }))
      .sort((a, b) => b.media - a.media);
    const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + 'º';
    $('#t-rank').hidden = CONFIG.RANKING === false;
    $('#t-rank-body').innerHTML = list.length ? `<table class="t-table"><thead><tr><th></th><th>Grupo</th><th>Media de puntos</th><th>Alumnos que han practicado</th><th>Más puntos</th></tr></thead><tbody>` +
      list.map((x, i) => `<tr><td>${medal(i)}</td><td><b>${esc(x.grupo || 'Sin grupo')}</b></td><td><b>${x.media}</b></td><td>${x.activos} de ${x.alumnos}</td><td>${x.top && x.top.pts ? esc(x.top.name) + ' (' + x.top.pts + ')' : '–'}</td></tr>`).join('') +
      '</tbody></table>' : '<p class="rank-empty">Todavía no hay datos.</p>';
  }

  /* ---------- acciones ---------- */
  $('#t-table thead').addEventListener('click', e => {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    sort = { col: th.dataset.sort, dir: sort.col === th.dataset.sort ? -sort.dir : 1 };
    renderTable();
  });
  $('#t-group').addEventListener('change', renderTable);
  $('#t-search').addEventListener('input', renderTable);
  function exit(msg) {
    key = null; students = [];
    if (location.hash === '#profe') history.replaceState(null, '', location.pathname);
    App.closeDialog();
    App.renderProfiles(!!msg);
    if (msg) { const m = document.getElementById('idle-msg'); m.textContent = msg; m.hidden = false; }
  }
  $('#t-exit').addEventListener('click', () => exit());
  $('#t-reload').addEventListener('click', async () => {
    const b = $('#t-reload'); b.disabled = true; b.textContent = 'Actualizando…';
    try { await load(key); render(); } catch (e) { alert(e.message); }
    b.disabled = false; b.textContent = 'Actualizar';
  });

  $('#t-table tbody').addEventListener('click', async e => {
    const pr = e.target.closest('.pin-reveal');
    if (pr) { pr.textContent = pr.textContent === pr.dataset.pin ? '•••••' : pr.dataset.pin; pr.classList.toggle('shown'); return; }
    const b = e.target.closest('[data-unpin]');
    if (!b) return;
    const p = students.find(s => s.id === b.dataset.unpin);
    if (!p || !confirm(`¿Quitar el PIN de ${p.name}? La próxima vez que entre podrá elegir uno nuevo.`)) return;
    try {
      if (p.remote) await Sync.resetPin(key, p.id);
      const db = App.db();
      if (db.profiles[p.id]) { db.profiles[p.id].pin = ''; App.save(); }
      p.hasPin = false; p.pin = ''; p.pinTxt = '';
      renderTable();
    } catch (err) { alert(err.message); }
  });

  /* ---------- grupos del desplegable ---------- */
  $('#t-groups').addEventListener('click', () => {
    let list = Groups.get().slice();
    App.openDialog('Grupos', `
      <p>Estos son los grupos que los alumnos pueden elegir al entrar por primera vez.
      ${Sync.enabled() ? 'Se guardan en tu hoja de Google, así que valen para todos los ordenadores.' : 'Se guardan en este ordenador.'}</p>
      <ul class="group-list" id="g-list"></ul>
      <form class="pin-form" id="g-form" autocomplete="off">
        <input class="key-input" id="g-new" maxlength="30" placeholder="Nuevo grupo, p. ej. 3º ESO D">
        <button class="btn" type="submit">Añadir</button>
      </form>
      <p class="small">Quitar un grupo de la lista no borra a sus alumnos ni su progreso.</p>
      <p class="form-msg" id="g-msg"></p>
      <div class="dlg-actions"><button class="btn primary" type="button" id="g-save">Guardar grupos</button></div>`);
    const draw = () => {
      $('#g-list').innerHTML = list.map((g, i) => `<li><span>${esc(g)}</span>
        <button type="button" class="icon-btn" data-up="${i}" title="Subir" ${i ? '' : 'disabled'}>↑</button>
        <button type="button" class="icon-btn" data-rm="${i}" title="Quitar">✕</button></li>`).join('') || '<li class="muted">No hay grupos.</li>';
    };
    draw();
    $('#g-list').onclick = e => {
      const rm = e.target.closest('[data-rm]'), up = e.target.closest('[data-up]');
      if (rm) list.splice(+rm.dataset.rm, 1);
      if (up) { const i = +up.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; }
      draw();
    };
    $('#g-form').onsubmit = e => {
      e.preventDefault();
      const v = $('#g-new').value.trim().replace(/\s+/g, ' ');
      if (!v) return;
      if (list.some(g => g.toLowerCase() === v.toLowerCase())) { $('#g-msg').textContent = 'Ese grupo ya está en la lista.'; return; }
      list.push(v); $('#g-new').value = ''; $('#g-msg').textContent = ''; draw();
    };
    $('#g-save').onclick = async () => {
      if (!list.length) { $('#g-msg').textContent = 'Tiene que haber al menos un grupo.'; return; }
      const b = $('#g-save'); b.disabled = true; $('#g-msg').className = 'form-msg'; $('#g-msg').textContent = 'Guardando…';
      try { await Groups.save(list, key); App.closeDialog(); }
      catch (err) { $('#g-msg').className = 'form-msg ko'; $('#g-msg').textContent = err.message; b.disabled = false; }
    };
  });

  $('#t-codes').addEventListener('click', () => {
    App.openDialog('Añadir códigos de progreso', `
      <p>Pega los códigos de tus alumnos (uno por línea) o sube los archivos <code>.txt</code> que descargaron. Solo se usan para verlos aquí: no se guardan en este ordenador.</p>
      <textarea class="code" rows="7" id="tc-text" placeholder="TECLEA1.…&#10;TECLEA1.…"></textarea>
      <input type="file" accept=".txt,text/plain" multiple id="tc-files">
      <p class="form-msg" id="tc-msg"></p>
      <div class="dlg-actions"><button class="btn primary" type="button" id="tc-go">Añadir</button></div>`);
    $('#tc-files').onchange = async e => {
      const texts = await Promise.all([...e.target.files].map(f => f.text()));
      $('#tc-text').value += (($('#tc-text').value ? '\n' : '') + texts.map(t => t.trim()).join('\n'));
    };
    $('#tc-go').onclick = async () => {
      const codes = $('#tc-text').value.split(/\s+/).filter(c => c.startsWith('TECLEA1.'));
      let ok = 0, bad = 0;
      codes.forEach(c => { try { const p = Store.importCode(c); extra[p.id] = extra[p.id] ? Store.merge(extra[p.id], p) : p; ok++; } catch (e) { bad++; } });
      if (!ok) { $('#tc-msg').textContent = 'No se ha encontrado ningún código válido.'; return; }
      await load(key); render(); App.closeDialog();
      if (bad) alert(`${bad} código(s) no se han podido leer.`);
    };
  });

  $('#t-csv').addEventListener('click', () => {
    const rows = visible();
    const head = ['Alumno', 'Grupo', 'Va por', 'Lecciones superadas', 'Mejor ppm', 'Minutos totales', 'Minutos esta semana', 'Racha (días)', 'Puntos semana', 'Puntos total', 'Última vez', 'Teclas débiles', 'Última prueba ppm', 'Última prueba precisión'];
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(';')].concat(rows.map(r => [r.name, r.group, r.nextTxt, r.passed, r.wpm, r.min, r.week, r.streak, r.pts, r.ptsTotal,
      r.lastTxt, r.weak.join(' '), r.test ? r.test.wpm : '', r.test ? String(r.test.acc).replace('.', ',') : ''].map(q).join(';')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `teclea-clase-${Store.dayKey()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#btn-teacher').addEventListener('click', open);

  window.Teacher = { open, exit };
})();
