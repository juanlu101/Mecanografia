/* =========================================================
   Teclado español (distribución ISO) y asignación de dedos
   ========================================================= */
(function () {
  const FINGERS = {
    lp: { name: 'meñique izquierdo', hand: 'L', type: 'pinky' },
    lr: { name: 'anular izquierdo',  hand: 'L', type: 'ring' },
    lm: { name: 'corazón izquierdo', hand: 'L', type: 'middle' },
    li: { name: 'índice izquierdo',  hand: 'L', type: 'indexL' },
    th: { name: 'pulgar',            hand: 'B', type: 'thumb' },
    ri: { name: 'índice derecho',    hand: 'R', type: 'indexR' },
    rm: { name: 'corazón derecho',   hand: 'R', type: 'middle' },
    rr: { name: 'anular derecho',    hand: 'R', type: 'ring' },
    rp: { name: 'meñique derecho',   hand: 'R', type: 'pinky' }
  };

  const k = (code, base, shift, finger, w, label) => ({ code, base, shift, finger, w: w || 1, label });
  const letters = (str, fingers) =>
    [...str].map((c, i) => k('Key' + c.toUpperCase(), c, c.toUpperCase(), fingers[i]));

  const ROWS = [
    [
      k('Backquote', 'º', 'ª', 'lp'), k('Digit1', '1', '!', 'lp'), k('Digit2', '2', '"', 'lr'),
      k('Digit3', '3', '·', 'lm'), k('Digit4', '4', '$', 'li'), k('Digit5', '5', '%', 'li'),
      k('Digit6', '6', '&', 'ri'), k('Digit7', '7', '/', 'ri'), k('Digit8', '8', '(', 'rm'),
      k('Digit9', '9', ')', 'rr'), k('Digit0', '0', '=', 'rp'), k('Minus', "'", '?', 'rp'),
      k('Equal', '¡', '¿', 'rp'), k('Backspace', '', '', 'rp', 2, '⟵')
    ],
    [
      k('Tab', '', '', 'lp', 1.5, 'Tab'),
      ...letters('qwertyuiop', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr', 'rp']),
      k('BracketLeft', '`', '^', 'rp'), k('BracketRight', '+', '*', 'rp'),
      k('Enter', '', '', 'rp', 1.5, 'Intro')
    ],
    [
      k('CapsLock', '', '', 'lp', 1.75, 'Bloq Mayús'),
      ...letters('asdfghjkl', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri', 'rm', 'rr']),
      k('Semicolon', 'ñ', 'Ñ', 'rp'), k('Quote', '´', '¨', 'rp'), k('Backslash', 'ç', 'Ç', 'rp'),
      k('Enter2', '', '', 'mod', 1.25, '')
    ],
    [
      k('ShiftLeft', '', '', 'lp', 1.25, 'Mayús'), k('IntlBackslash', '<', '>', 'lp'),
      ...letters('zxcvbnm', ['lp', 'lr', 'lm', 'li', 'li', 'ri', 'ri']),
      k('Comma', ',', ';', 'rm'), k('Period', '.', ':', 'rr'), k('Slash', '-', '_', 'rp'),
      k('ShiftRight', '', '', 'rp', 2.75, 'Mayús')
    ],
    [
      k('ControlLeft', '', '', 'mod', 1.25, 'Ctrl'), k('MetaLeft', '', '', 'mod', 1.25, ''),
      k('AltLeft', '', '', 'mod', 1.25, 'Alt'), k('Space', ' ', '', 'th', 6.25, ''),
      k('AltRight', '', '', 'mod', 1.25, 'Alt Gr'), k('MetaRight', '', '', 'mod', 1.25, ''),
      k('ContextMenu', '', '', 'mod', 1.25, ''), k('ControlRight', '', '', 'mod', 1.25, 'Ctrl')
    ]
  ];

  const KEY_BY_CODE = {};
  const CHAR_MAP = {}; // carácter -> lista de pasos [{code, shift}]
  ROWS.flat().forEach(key => {
    KEY_BY_CODE[key.code] = key;
    if (key.base && !CHAR_MAP[key.base]) CHAR_MAP[key.base] = [{ code: key.code, shift: false }];
    if (key.shift && !CHAR_MAP[key.shift]) CHAR_MAP[key.shift] = [{ code: key.code, shift: true }];
  });
  // Teclas muertas: no escriben nada por sí solas
  ['´', '¨', '`', '^'].forEach(c => delete CHAR_MAP[c]);
  // Vocales con tilde: primero ´ y después la vocal
  const ACC = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
  Object.entries(ACC).forEach(([v, acc]) => {
    CHAR_MAP[acc] = [{ code: 'Quote', shift: false, dead: true }, { code: 'Key' + v.toUpperCase(), shift: false }];
    CHAR_MAP[acc.toUpperCase()] = [{ code: 'Quote', shift: false, dead: true }, { code: 'Key' + v.toUpperCase(), shift: true }];
  });
  CHAR_MAP['ü'] = [{ code: 'Quote', shift: true, dead: true }, { code: 'KeyU', shift: false }];

  const getSteps = ch => CHAR_MAP[ch] || null;

  // Busca la tecla de un símbolo (incluidas las teclas muertas), para las explicaciones
  function findKey(ch) {
    if (ch === ' ') return KEY_BY_CODE.Space;
    for (const key of ROWS.flat()) if (key.base === ch || key.shift === ch) return key;
    const steps = CHAR_MAP[ch];
    return steps ? KEY_BY_CODE[steps[steps.length - 1].code] : null;
  }

  const oppositeShift = code => (FINGERS[KEY_BY_CODE[code].finger].hand === 'L' ? 'ShiftRight' : 'ShiftLeft');

  // Qué teclas y dedos intervienen en un paso
  function stepInfo(step) {
    const key = KEY_BY_CODE[step.code];
    const codes = [step.code];
    const fingers = [key.finger];
    if (step.shift) {
      const sc = oppositeShift(step.code);
      codes.push(sc);
      fingers.push(KEY_BY_CODE[sc].finger);
    }
    return { key, codes, fingers };
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function keyLabel(key) {
    if (key.code === 'Space') return 'Espacio';
    if (key.label !== undefined && key.label !== '') return key.label;
    return key.shift && /^(Key|Semicolon|Backslash)/.test(key.code) ? key.shift : key.base;
  }

  function buildKeyboard(el) {
    el.classList.add('kb');
    el.innerHTML = ROWS.map(row => '<div class="kb-row">' + row.map(key => {
      const f = FINGERS[key.finger];
      const cls = ['key', f ? 'f-' + f.type : 'mod'];
      if (key.code === 'Space') cls.push('space');
      let inner;
      if (key.label !== undefined) inner = `<span class="lbl">${esc(key.label)}</span>`;
      else if (/^(Key|Semicolon|Backslash)/.test(key.code)) inner = `<span class="main">${esc(key.shift)}</span>`;
      else inner = `<span class="top">${esc(key.shift || '')}</span><span class="main">${esc(key.base)}</span>`;
      const bump = key.code === 'KeyF' || key.code === 'KeyJ' ? '<span class="bump"></span>' : '';
      return `<div class="${cls.join(' ')}" data-code="${key.code}" style="--w:${key.w}">${inner}${bump}</div>`;
    }).join('') + '</div>').join('');
  }

  function highlightKeys(el, codes, cls = 'next') {
    el.querySelectorAll('.key.' + cls).forEach(n => n.classList.remove(cls));
    (codes || []).forEach(c => {
      const n = el.querySelector(`[data-code="${c}"]`);
      if (n) n.classList.add(cls);
    });
  }

  function flashKey(el, code, cls = 'wrong') {
    const n = el.querySelector(`[data-code="${code}"]`);
    if (!n) return;
    n.classList.remove(cls);
    void n.offsetWidth;
    n.classList.add(cls);
    setTimeout(() => n.classList.remove(cls), 450);
  }

  /* ---------- Manos (SVG) ---------- */
  function buildHands(el) {
    // Mano izquierda vista desde arriba, con los dedos sobre la fila guía (la derecha es su reflejo).
    // Cada dedo: [tipo, x de la base, y de la base, ángulo, largo, ancho]
    const FING = [
      ['pinky', 84, 142, -12, 74, 25],
      ['ring', 115, 125, -5, 96, 28],
      ['middle', 150, 119, 1, 106, 29],
      ['index', 185, 126, 7, 96, 29]
    ];
    const fingerShape = (len, w) => `
      <rect class="fshape" x="${-w / 2}" y="${-len}" width="${w}" height="${len + 30}" rx="${w / 2}"/>
      <path class="crease" d="M ${-w * 0.24} ${-len * 0.43} q ${w * 0.24} 3.5 ${w * 0.48} 0"/>
      <path class="crease" d="M ${-w * 0.2} ${-len * 0.13} q ${w * 0.2} 3 ${w * 0.4} 0"/>
      <rect class="nail" x="${-w * 0.29}" y="${-len + 5}" width="${w * 0.58}" height="${w * 0.62}" rx="${w * 0.27}"/>`;
    const hand = (ids, idxType, mirror) => `
      <g ${mirror ? 'transform="translate(600,0) scale(-1,1)"' : ''}>
        <path class="arm" d="M 116 222 C 114 240 110 258 106 276 L 192 276 C 188 258 184 240 182 222 Z"/>
        ${FING.map(([type, x, y, a, len, w], i) => `
          <g transform="translate(${x} ${y}) rotate(${a})">
            <g class="finger f-${i === 3 ? idxType : type}" data-finger="${ids[i]}">${fingerShape(len, w)}</g>
          </g>`).join('')}
        <g transform="translate(204 190) rotate(40)">
          <g class="finger f-thumb" data-finger="th">${fingerShape(72, 31)}</g>
        </g>
        <path class="palm" d="M 70 150 C 72 128 106 117 150 116 C 189 115 209 122 212 138
          C 215 154 219 168 215 188 C 211 208 196 222 182 230 L 116 232 C 95 226 75 207 70 186 C 67 172 67 160 70 150 Z"/>
        <path class="palm-line" d="M 92 160 C 120 152 168 150 200 158"/>
      </g>`;
    el.innerHTML = `<svg viewBox="0 0 600 296" role="img" aria-label="Manos sobre el teclado: se ilumina el dedo que debe pulsar">
        <defs><linearGradient id="armfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f1e5d5"/><stop offset="1" stop-color="#f1e5d5" stop-opacity="0"/>
        </linearGradient></defs>
        ${hand(['lp', 'lr', 'lm', 'li'], 'indexL', false)}
        ${hand(['rp', 'rr', 'rm', 'ri'], 'indexR', true)}
        <text x="149" y="290" class="hand-lbl">mano izquierda</text>
        <text x="451" y="290" class="hand-lbl">mano derecha</text>
      </svg>`;
  }

  function highlightFingers(el, fingers) {
    el.querySelectorAll('.finger.active').forEach(n => n.classList.remove('active'));
    (fingers || []).forEach(f => el.querySelectorAll(`[data-finger="${f}"]`).forEach(n => n.classList.add('active')));
  }

  window.KB = {
    FINGERS, ROWS, KEY_BY_CODE, getSteps, findKey, stepInfo, keyLabel,
    buildKeyboard, highlightKeys, flashKey, buildHands, highlightFingers, esc
  };
})();
