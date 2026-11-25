/* =========================================================
   LECCIONES — de la fila guía a los textos completos
   ========================================================= */
(function () {
  /* ---------- Vocabulario (todas las palabras se escriben sin tilde) ---------- */
  const WORDS = `
de la que el en y a los se del las un por con no una su para es al lo como pero sus le me sin sobre
este ya entre cuando todo esta ser son dos fue era muy hasta desde mi porque solo han yo hay vez puede
todos nos ni parte tiene uno donde bien tiempo mismo ese ahora cada vida otro te otros aunque esa eso
hace otra siempre tanto ella tres dijo sido gran menos mundo antes estado contra sino forma caso nada
hacer general estaba poco estos mayor ante unos les algo hacia casa ellos ayer hecho primera mucho
mientras quien momento esto hombre pues hoy lugar trabajo otras mejor nuevo decir algunos entonces
todas debe casi toda tal luego pasado primer medio va estas sea nunca poder ver veces partido personas
grupo cuenta pueden tienen misma nueva cual fueron mujer frente tras cosas fin ciudad he social manera
tener sistema historia muchos tipo cuatro dentro nuestro punto dice ello noche agua parece haber fuera
bajo grandes nuestra ejemplo acuerdo usted hizo nadie horas posible tarde ley importante desarrollo
realidad sentido lado cambio mano eran estar sociedad unas centro padre gente final cuerpo obra
incluso madre mis modo problema cinco hombres ojos nombre algunas mujeres siglo meses esos nosotros
hora muchas pueblo alguna dar don da derecho verdad junto cabeza aquel cuanto tierra equipo segundo
dicho cierto casos manos nivel familia largo partir falta llegar propio cosa primero hemos mal tuvo
semana varios real tema amor perro gato sol mar luna libro mesa silla escuela clase amigo amiga juego
feliz rojo azul verde flor cielo fuego aire leche pan fruta pera uva queso sopa coche calle playa
campo tren barco nube lluvia nieve viento verano invierno hola gracias dedo dedos tecla teclas letra
letras palabra frase texto lento bueno buena malo grande joven viejo alto blanco negro gris rosa
naranja amarillo morado dulce salado fresco caliente zumo comida cena desayuno hermano hermana abuelo
abuela prima primo maestra maestro profesor profesora alumno alumna papel goma regla mochila patio
recreo examen nota deberes dibujo pintar jugar saltar correr leer escribir hablar cantar bailar comer
beber dormir mirar pensar aprender estudiar ala alas sala salas salsa falda faldas hada hadas haga
gala galas llaga las sal gas saga dada halla hallas asa asas dale
año años niño niña niños niñas sueño mañana montaña pequeño pequeña señor señora otoño baño caña
araña uña dueño compañero compañera enseñar diseño cumpleaños
`.trim().split(/\s+/);

  const ACCENT_WORDS = `más también después día días país está están aquí allí así qué cómo cuándo
dónde música lápiz árbol fácil difícil rápido número último teléfono cámara página sábado miércoles
película canción camión jardín ratón corazón razón sofá café mamá papá bebé jamás además según aún
tú él sí mí río tío frío había tenía sabía lección acción atención mitad océano plátano matemáticas
fútbol inglés francés autobús ordenador`.trim().split(/\s+/).filter(w => /[áéíóú]/.test(w));

  const NAMES = ['Ana', 'Luis', 'Sara', 'Hugo', 'Elena', 'Diego', 'Laura', 'Pablo', 'Marta', 'Carlos',
    'Paula', 'Mario', 'Irene', 'Sevilla', 'Madrid', 'Granada', 'Huelva', 'Valencia', 'Bilbao', 'Toledo',
    'Europa', 'Lunes', 'Martes', 'Jueves', 'Enero', 'Mayo', 'Julio'];

  const PUNCT_PHRASES = ['¿Cómo te llamas?', '¡Qué bien!', '¿Vienes mañana?', '¡Hola, Marta!',
    'Ojo: no mires el teclado.', 'Trae esto: goma, regla y papel.', 'Hoy no; mañana sí.',
    '¿Dónde está mi mochila?', '¡Feliz cumpleaños!', 'Nota: practica cada día.', '¿Qué hora es?',
    '¡Cuidado con el charco!', '¿Jugamos en el recreo?', 'Hay dos opciones: leer o dibujar.'];

  const PHRASES = [
    'El gato duerme en el sofá.', 'Mi hermana lee un libro cada semana.', 'Hoy hace sol y vamos al parque.',
    'La clase empieza a las nueve.', 'Me gusta escribir sin mirar el teclado.',
    'Los dedos vuelven siempre a la fila guía.', 'El perro de Laura corre por la playa.',
    'Mañana tenemos examen de matemáticas.', '¿Quieres jugar al fútbol en el recreo?',
    '¡Qué bien escribes con todos los dedos!', 'Practicar un poco cada día es la clave.',
    'El tren sale a las cinco de la tarde.', 'Las montañas tienen nieve en invierno.',
    'Diego y Paula preparan un mural para la clase.', 'La biblioteca abre de lunes a viernes.',
    'Mi abuela hace la mejor tortilla del barrio.', 'En verano nadamos en el río con mis primos.',
    'Escribe despacio y sin errores; la velocidad llegará sola.',
    'Los lunes tenemos educación física a primera hora.', 'Mi tío trabaja en un hospital de Valencia.',
    '¿Has visto qué luna tan grande hay esta noche?', 'Las ballenas cantan para comunicarse en el océano.',
    'Carlos ha ganado la carrera del colegio.', 'Hemos plantado tomates y lechugas en el huerto.',
    'El autobús escolar pasa a las ocho y cuarto.', '¡No olvides tu mochila en el patio!',
    'Irene dibuja un dragón verde con alas enormes.', 'Mañana iremos de excursión al museo de ciencias.',
    'Mi hermano pequeño ya sabe contar hasta cien.', 'En el mercado venden fruta fresca todos los días.',
    '¿Cuántas patas tiene una araña? Tiene ocho.', 'El volcán de La Palma entró en erupción en 2021.',
    'Leer antes de dormir ayuda a descansar mejor.', 'Las jirafas duermen muy poco, apenas dos horas al día.',
    'Pablo toca la guitarra en el grupo de música.', 'Hace frío: ponte el abrigo, la bufanda y los guantes.',
    'La Tierra tarda 365 días en dar una vuelta al Sol.', 'Marta y Elena han escrito un cuento de misterio.',
    '¡Qué rico huele el pan recién hecho!', 'El agua hierve a cien grados centígrados.'
  ];

  const TEXTS = [
    'Escribir con todos los dedos es como aprender a tocar un instrumento. Al principio cada tecla cuesta, pero con práctica los dedos encuentran el camino solos. No mires el teclado: confía en tu memoria.',
    'En otoño las hojas de los árboles cambian de color. Los parques se llenan de tonos rojos, naranjas y amarillos. Es una buena época para pasear, leer y tomar algo caliente.',
    'Sevilla tiene un río, el Guadalquivir, que cruza la ciudad. Hace siglos, muchos barcos salían desde su puerto hacia otros continentes cargados de mercancías.',
    'Para cuidar el planeta podemos hacer cosas sencillas: apagar la luz al salir, cerrar el grifo, reciclar el papel y usar la bicicleta para ir a clase.',
    'La velocidad llega sola. Primero busca la precisión: cada tecla con su dedo, la espalda recta y las muñecas relajadas. Después, poco a poco, irás más rápido.',
    'Un buen día de clase empieza con un desayuno completo. La fruta, el pan y la leche dan energía para pensar, jugar y aprender durante toda la mañana.',
    'Las abejas visitan miles de flores cada día. Gracias a ellas, muchas plantas pueden dar frutos. Sin abejas tendríamos menos manzanas, peras y almendras.',
    'El ordenador es una herramienta muy útil, pero también hay que saber descansar. Cada media hora conviene levantar la vista, estirar los brazos y mirar a lo lejos.',
    'El agua de los mares se evapora con el calor del sol y forma las nubes. Cuando las nubes se enfrían, el agua cae en forma de lluvia o nieve y vuelve a los ríos y al mar.',
    'Los pulpos tienen tres corazones y la sangre azul. Además, son muy listos: pueden abrir frascos, esconderse en conchas y cambiar de color en un segundo.',
    'La primera persona que pisó la Luna fue Neil Armstrong, en 1969. Millones de personas lo vieron por televisión. Hoy varias agencias espaciales quieren volver allí.',
    'Para hacer una tortilla de patatas se necesitan huevos, patatas, aceite y sal. Algunas personas le añaden cebolla. Ese es un debate que nunca termina.',
    'El Camino de Santiago atraviesa pueblos, montañas y bosques. Cada año miles de peregrinos lo recorren a pie o en bicicleta hasta llegar a la catedral.',
    'Los guepardos son los animales terrestres más rápidos. Pueden correr a más de cien kilómetros por hora, pero solo durante unos pocos segundos.',
    'Un buen equipo no es el que tiene a los mejores jugadores, sino el que juega unido. Escuchar, ayudar y animar a los demás también es parte del juego.',
    'Las plantas fabrican su propio alimento gracias a la luz del sol. Este proceso se llama fotosíntesis y, además, produce el oxígeno que respiramos.',
    'Don Quijote de la Mancha es una de las novelas más famosas del mundo. La escribió Miguel de Cervantes y cuenta las aventuras de un caballero y su escudero, Sancho Panza.',
    'Antes de enviar un mensaje, piensa si te gustaría recibirlo a ti. En internet también hay que ser amable, respetar a los demás y proteger nuestros datos.',
    'El Sistema Solar tiene ocho planetas. Mercurio es el más cercano al Sol y Neptuno, el más lejano. Júpiter es tan grande que dentro cabrían más de mil Tierras.',
    'En la Alhambra de Granada hay patios, fuentes y jardines llenos de flores. Sus paredes están decoradas con dibujos geométricos que parecen no tener fin.',
    'Dormir bien es tan importante como comer bien. Mientras dormimos, el cerebro ordena lo que hemos aprendido durante el día y el cuerpo recupera energía.',
    'Los delfines viven en grupos y se ayudan entre ellos. Se comunican con silbidos y chasquidos, y cada uno tiene un sonido propio, como si fuera su nombre.',
    'Reciclar es fácil: el papel va al contenedor azul, los envases al amarillo y el vidrio al verde. Lo orgánico, como las cáscaras de fruta, va al marrón.',
    'El ajedrez se juega sobre un tablero de 64 casillas. Cada jugador tiene dieciséis piezas y gana quien consigue dar jaque mate al rey del contrario.',
    'Cuando aprendemos algo nuevo, al principio parece difícil. Con práctica, el cerebro crea caminos nuevos y lo que antes costaba se vuelve automático.',
    'Las tortugas marinas ponen sus huevos en la arena de la playa. Cuando nacen, las crías corren hacia el mar guiadas por la luz de la luna.',
    'El Teide, en Tenerife, es la montaña más alta de España. Mide más de tres mil setecientos metros y en invierno a veces tiene nieve en la cima.',
    'Una biblioteca es como una puerta a mil mundos. En sus estanterías hay cuentos, cómics, enciclopedias y novelas esperando a que alguien los abra.',
    'Las hormigas pueden levantar objetos que pesan muchas veces más que ellas. Trabajan en equipo y cada una tiene una tarea dentro del hormiguero.',
    'El arcoíris aparece cuando la luz del sol atraviesa las gotas de lluvia. La luz se separa en siete colores: rojo, naranja, amarillo, verde, azul, añil y violeta.',
    'Para escribir rápido no hace falta correr. Lo importante es mantener un ritmo constante, como el tictac de un reloj, sin parar ni acelerar de golpe.',
    'Los camellos pueden pasar varios días sin beber agua. Sus jorobas no guardan agua, sino grasa, que les da energía cuando no encuentran comida.'
  ];

  const NUM_WORDS = ['casas', 'libros', 'gatos', 'perros', 'sillas', 'mesas', 'dedos', 'teclas', 'alumnos', 'clases', 'euros', 'metros', 'minutos', 'días'];

  /* ---------- Utilidades ---------- */
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);

  function fill(gen, len) {
    const out = []; let n = 0, guard = 0, last = '';
    while (n < len && guard++ < 600) {
      let w = gen();
      if (w === last) w = gen();
      out.push(w); n += w.length + 1; last = w;
    }
    return out.join(' ');
  }

  const PUNCT = ',.-';

  function drill(newKeys) {
    const ks = [...newKeys];
    const parts = [];
    ks.forEach(c => parts.push(c.repeat(3), c.repeat(3)));
    if (ks.length > 1) for (let i = 0; i < 4; i++) parts.push(shuffle(ks).join('') + pick(ks));
    return parts.join(' ');
  }

  function group(letters, focus) {
    const L = 2 + rnd(3), fp = rnd(L);
    let s = '';
    for (let i = 0; i < L; i++) s += i === fp ? pick(focus) : pick(letters);
    return s;
  }

  // Texto para lecciones de teclas: repetición, combinaciones y palabras reales
  function keysText(l) {
    const all = [...l.allowed];
    const punct = all.filter(c => PUNCT.includes(c));
    const letters = all.filter(c => !PUNCT.includes(c));
    const newAll = [...(l.newKeys || '')];
    const newLetters = newAll.filter(c => !PUNCT.includes(c));
    const newPunct = newAll.filter(c => PUNCT.includes(c));
    const focus = newLetters.length ? newLetters : letters;

    const ok = WORDS.filter(w => [...w].every(c => letters.includes(c)));
    const withF = ok.filter(w => [...w].some(c => focus.includes(c)));
    const useWords = ok.length >= 6;

    const genWord = () => {
      if (useWords && Math.random() < (l.newKeys ? 0.55 : 0.8))
        return withF.length >= 3 && Math.random() < 0.65 ? pick(withF) : pick(ok);
      return group(letters, focus);
    };
    const gen = () => {
      let w = genWord();
      if (punct.length) {
        const p = newPunct.length && Math.random() < 0.6 ? pick(newPunct) : pick(punct);
        if (Math.random() < (newPunct.length ? 0.45 : 0.2)) w = p === '-' ? w + '-' + genWord() : w + p;
      }
      return w;
    };
    const start = l.newKeys ? drill(newLetters.length ? newLetters.join('') : '') : '';
    const pStart = newPunct.length ? newPunct.map(p => (p === '-' ? 'la-la' : 'la' + p + ' ' + 'las' + p)).join(' ') : '';
    const head = [start, pStart].filter(Boolean).join(' ');
    return [head, fill(gen, l.len - head.length)].filter(Boolean).join(' ');
  }

  const GEN = {
    keys: keysText,
    caps: l => 'Ff Jj Dd Kk Ss Ll Aa Ññ ' + fill(() => (Math.random() < 0.45 ? pick(NAMES) : cap(pick(WORDS.filter(w => w.length > 2))))
      , l.len),
    accents: l => 'á é í ó ú á é í ó ú ' + fill(() => (Math.random() < 0.7 ? pick(ACCENT_WORDS) : pick(WORDS)), l.len),
    punct: l => '¿? ¿? ¡! ¡! :: ;; ' + shuffle(PUNCT_PHRASES).reduce((acc, p) => (acc.join(' ').length < l.len ? acc.concat(p) : acc), []).join(' '),
    numbers: l => {
      const digits = [...l.digits];
      const focus = [...(l.focusDigits || l.digits)];
      const head = focus.map(d => d + d + d).join(' ');
      const num = () => { const n = 1 + rnd(3); let s = pick(focus); for (let i = 1; i < n; i++) s += pick(digits); return s.replace(/^0+(?=\d)/, ''); };
      return head + ' ' + fill(() => (Math.random() < 0.5 ? num() : num() + ' ' + pick(NUM_WORDS)), l.len);
    },
    phrases: l => shuffle(PHRASES).reduce((acc, p) => (acc.join(' ').length < l.len ? acc.concat(p) : acc), []).join(' '),
    text: () => takeText(),
    speed: () => takeText() + ' ' + takeText(),
    long: l => Array.from({ length: l.texts || 2 }, takeText).join(' '),
    real: l => Array.from({ length: l.texts || 2 }, takeText).join(' '),
    write: () => ''
  };

  // Elige un texto que no haya salido hace poco en este navegador
  function takeText() {
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem('teclea:recent')) || []; } catch (e) { /* sin almacenamiento */ }
    const keep = Math.min(20, TEXTS.length - 2);
    let free = TEXTS.map((_, i) => i).filter(i => !recent.includes(i));
    if (!free.length) free = TEXTS.map((_, i) => i);
    const i = pick(free);
    recent = recent.concat(i).slice(-keep);
    try { localStorage.setItem('teclea:recent', JSON.stringify(recent)); } catch (e) { /* sin almacenamiento */ }
    return TEXTS[i];
  }

  /* ---------- Temas para la escritura libre ---------- */
  const TOPICS = [
    'Describe lo que hiciste el último fin de semana.', 'Cuenta cuál es tu comida favorita y por qué.',
    'Explica cómo es un día normal para ti, desde que te levantas.', 'Describe tu lugar favorito de tu ciudad o pueblo.',
    'Si pudieras viajar a cualquier país, ¿a cuál irías y qué harías allí?', 'Habla de una película, serie o libro que te haya gustado.',
    'Explica a alguien que no lo conoce cómo se juega a tu deporte o juego favorito.', 'Describe a tu mejor amigo o amiga sin decir su nombre.',
    '¿Qué cambiarías de tu instituto si pudieras? Explica por qué.', 'Cuenta una anécdota divertida que te haya pasado.',
    '¿Qué te gustaría estudiar o en qué te gustaría trabajar en el futuro?', 'Describe tu habitación con todo detalle.',
    'Escribe una receta sencilla que sepas preparar.', '¿Prefieres el verano o el invierno? Defiende tu elección.',
    'Explica qué harías si un día te despertaras con un superpoder.', 'Describe un animal que te guste y cuenta qué sabes de él.',
    'Cuenta cómo sería tu día perfecto.', 'Escribe un mensaje a tu yo de dentro de diez años.',
    '¿Qué música escuchas y en qué momentos?', 'Explica qué es lo que más te gusta hacer con tu familia.'
  ];
  const topic = () => pick(TOPICS);

  // Calidad mínima de un texto libre: que sean palabras de verdad y no letras al azar
  function writingQuality(text) {
    const words = String(text || '').toLowerCase().split(/[^a-záéíóúüñ]+/).filter(Boolean);
    const distinct = new Set(words).size;
    const counts = {};
    words.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    const top = words.length ? Math.max(...Object.values(counts)) / words.length : 1;
    const realish = words.filter(w => /[aeiouáéíóúü]/.test(w) && w.length <= 15 && !/(.)\1\1/.test(w)).length;
    return {
      words: words.length, distinct,
      checks: {
        enough: distinct >= 20,                                  // al menos 20 palabras distintas
        varied: top <= 0.25,                                     // sin repetir una palabra sin parar
        real: words.length > 0 && realish / words.length >= 0.8  // palabras que parecen palabras
      }
    };
  }

  /* ---------- Etapas y lecciones ---------- */
  const STAGES = [
    { n: 1, name: 'Fila guía', desc: 'Los dedos descansan aquí. Todo empieza y termina en esta fila.' },
    { n: 2, name: 'Fila superior', desc: 'Los dedos suben y vuelven enseguida a su sitio.' },
    { n: 3, name: 'Fila inferior', desc: 'Ahora bajamos. Las muñecas quietas, solo se mueven los dedos.' },
    { n: 4, name: 'Mayúsculas, tildes y signos', desc: 'Para escribir como en un texto de verdad.' },
    { n: 5, name: 'Números', desc: 'La fila más lejana: estira sin mirar.' },
    { n: 6, name: 'Textos', desc: 'Frases y textos completos. ¡A ganar velocidad!' },
    { n: 7, name: 'Escribir de verdad', desc: 'Como fuera de la app: corrige tus propios errores y escribe tus ideas sin texto que copiar.' },
    { n: 8, name: 'Avanzado', optional: true, desc: 'Opcional, para quien ha terminado el curso: textos largos a 25, 30 y 35 palabras por minuto.' }
  ];

  const TIP = {
    home: 'Coloca los índices sobre F y J: tienen un pequeño relieve para encontrarlas sin mirar. El resto de dedos descansan en A S D (izquierda) y K L Ñ (derecha). Los pulgares, sobre la barra espaciadora.',
    stretch: 'Estira el índice hacia el centro, pulsa y vuelve enseguida a F o a J.',
    up: 'Sube el dedo a la fila de arriba sin mover la mano y vuelve a la fila guía.',
    down: 'Baja el dedo a la fila de abajo. La muñeca no se apoya ni se mueve.',
    review: 'Repaso: no hay teclas nuevas. Intenta no mirar el teclado y mantener un ritmo constante.'
  };

  const RAW = [
    // n, etapa, título, teclas nuevas, longitud, ppm mínimas, consejo
    [1, 1, 'F y J', 'fj', 120, 5, TIP.home + ' El espacio se pulsa con el pulgar.'],
    [2, 1, 'D y K', 'dk', 120, 5, 'Los dedos corazón pulsan D y K. Los índices no se mueven de F y J.'],
    [3, 1, 'S y L', 'sl', 130, 5, 'Los anulares pulsan S y L. Mantén los dedos curvados, como si sujetaras una pelota.'],
    [4, 1, 'A y Ñ', 'añ', 130, 6, 'Los meñiques pulsan A y Ñ. Son los dedos más débiles: pulsa con calma.'],
    [5, 1, 'G y H', 'gh', 140, 6, TIP.stretch],
    [6, 1, 'Repaso fila guía', '', 160, 7, TIP.review],
    [7, 2, 'E e I', 'ei', 120, 7, 'E con el corazón izquierdo (sube desde D). I con el corazón derecho (sube desde K).'],
    [8, 2, 'R y U', 'ru', 130, 8, 'R con el índice izquierdo y U con el índice derecho. ' + TIP.up],
    [9, 2, 'T e Y', 'ty', 130, 8, 'T e Y están en el centro: los índices se estiran en diagonal.'],
    [10, 2, 'O y W', 'ow', 140, 9, 'O con el anular derecho (desde L) y W con el anular izquierdo (desde S).'],
    [11, 2, 'Q y P', 'qp', 140, 9, 'Q y P con los meñiques. ' + TIP.up],
    [12, 2, 'Repaso fila superior', '', 170, 10, TIP.review],
    [13, 3, 'N y M', 'nm', 150, 10, 'N y M con el índice derecho. ' + TIP.down],
    [14, 3, 'C y coma', 'c,', 150, 10, 'C con el corazón izquierdo y la coma con el corazón derecho. Después de la coma va un espacio.'],
    [15, 3, 'V y B', 'vb', 160, 11, 'V y B con el índice izquierdo. B está lejos: estira bien y vuelve a F.'],
    [16, 3, 'X y punto', 'x.', 160, 11, 'X con el anular izquierdo y el punto con el anular derecho.'],
    [17, 3, 'Z y guion', 'z-', 160, 11, 'Z con el meñique izquierdo y el guion (-) con el meñique derecho.'],
    [18, 3, 'Repaso de todas las letras', '', 200, 12, TIP.review]
  ];

  const LESSONS = [
    { id: 0, stage: 1, title: 'Antes de empezar', type: 'posture', minWpm: 0, showKeys: '', badge: 'Postura',
      tip: 'Cómo sentarse, dónde van los dedos y las reglas de oro.' }
  ];
  let acc = '';
  RAW.forEach(([id, stage, title, newKeys, len, minWpm, tip]) => {
    acc += newKeys;
    LESSONS.push({ id, stage, title, type: 'keys', newKeys, allowed: acc, len, minWpm, tip, showKeys: newKeys, badge: newKeys ? [...newKeys].join(' ').toUpperCase() : 'Repaso' });
  });
  const ALL_LETTERS = acc;

  LESSONS.push(
    { id: 19, stage: 4, title: 'Mayúsculas', type: 'caps', len: 170, minWpm: 11, showKeys: '', shiftDemo: true, badge: 'Mayús',
      tip: 'Mantén pulsada la tecla Mayús con el meñique de la mano CONTRARIA a la letra. Para la F (mano izquierda) usa la Mayús derecha; para la J, la izquierda.' },
    { id: 20, stage: 4, title: 'Tildes', type: 'accents', len: 160, minWpm: 10, showKeys: '´', badge: 'á é í ó ú',
      tip: 'Primero pulsa la tecla de la tilde ´ (a la derecha de la Ñ) con el meñique derecho: no aparece nada. Después pulsa la vocal y aparecerá con tilde.' },
    { id: 21, stage: 4, title: 'Signos ¿? ¡! : ;', type: 'punct', len: 160, minWpm: 9, showKeys: '¿?¡!:;', badge: '¿ ? ¡ !',
      tip: '¡ está a la derecha del apóstrofo; con Mayús se convierte en ¿. El signo ? es Mayús + apóstrofo, y ! es Mayús + 1. Los dos puntos y el punto y coma usan Mayús con el punto y la coma.' },
    { id: 22, stage: 5, title: 'Números 1 al 5', type: 'numbers', digits: '12345', len: 120, minWpm: 8, showKeys: '12345', badge: '1 2 3 4 5',
      tip: 'Los números están en la fila de arriba del todo. 1 con el meñique, 2 con el anular, 3 con el corazón, 4 y 5 con el índice izquierdo.' },
    { id: 23, stage: 5, title: 'Números 6 al 0', type: 'numbers', digits: '1234567890', focusDigits: '67890', len: 140, minWpm: 9, showKeys: '67890', badge: '6 7 8 9 0',
      tip: '6 y 7 con el índice derecho, 8 con el corazón, 9 con el anular y 0 con el meñique derecho.' },
    { id: 24, stage: 6, title: 'Frases', type: 'phrases', len: 200, minWpm: 14, showKeys: '', badge: 'Frases',
      tip: 'Frases completas con mayúsculas, tildes y signos. Escribe a un ritmo constante, sin prisa.' },
    { id: 25, stage: 6, title: 'Textos', type: 'text', minWpm: 16, showKeys: '', badge: 'Texto',
      tip: 'Un texto entero. Si te equivocas, no pasa nada: busca la tecla correcta y sigue.' },
    { id: 26, stage: 6, title: 'Textos largos', type: 'long', texts: 2, minWpm: 17, showKeys: '', badge: 'Texto ×2',
      tip: 'Dos textos seguidos. Lo difícil ahora es aguantar: mantén la espalda recta, los hombros relajados y vuelve siempre a la fila guía.' },
    { id: 27, stage: 6, title: 'Ritmo constante', type: 'long', texts: 2, minWpm: 18, showKeys: '', badge: 'Ritmo',
      tip: 'Intenta pulsar las teclas a un ritmo regular, como el tictac de un reloj: sin acelerones ni parones. Las palabras difíciles, más despacio; las fáciles, sin correr.' },
    { id: 28, stage: 6, title: 'Reto de velocidad', type: 'speed', minWpm: 20, showKeys: '', badge: 'Reto',
      tip: 'El reto final: dos textos seguidos. Para superarlo hacen falta 20 palabras por minuto. ¡Tú puedes!' },
    { id: 29, stage: 7, title: 'Corregir errores', type: 'real', texts: 2, minWpm: 18, showKeys: '', badge: 'Modo real',
      tip: 'Ahora los errores no te frenan, como cuando escribes de verdad: si te equivocas, bórralo con la tecla de borrar (⟵, con el meñique derecho) y sigue. El texto solo se termina cuando no queda ningún error.' },
    { id: 30, stage: 7, title: 'Escritura libre', type: 'write', seconds: 180, minWpm: 12, showKeys: '', badge: 'Libre',
      tip: 'Sin texto que copiar: escribe durante 3 minutos sobre el tema que aparece arriba. Piensa en frases sencillas y no mires el teclado. Puedes borrar con ⟵.' },
    { id: 31, stage: 8, optional: true, title: 'Avanzado 25', type: 'long', texts: 2, minWpm: 25, showKeys: '', badge: '25 ppm',
      tip: 'Nivel avanzado: dos textos a 25 palabras por minuto. Ya escribes más rápido que a mano.' },
    { id: 32, stage: 8, optional: true, title: 'Avanzado 30', type: 'long', texts: 3, minWpm: 30, showKeys: '', badge: '30 ppm',
      tip: 'Tres textos seguidos a 30 palabras por minuto. La clave es no mirar nunca el teclado.' },
    { id: 33, stage: 8, optional: true, title: 'Avanzado 35', type: 'long', texts: 3, minWpm: 35, showKeys: '', badge: '35 ppm',
      tip: 'El último reto: 35 palabras por minuto, la velocidad de alguien que escribe con soltura en su trabajo. ¡A por ello!' }
  );

  /* ---------- Requisitos para superar cada lección ----------
     - Precisión mínima: 95 % (93 % en los textos de la etapa 6).
     - Hay que aprobarla 2 veces (no hace falta que sean seguidas).
     - Las teclas nuevas, al menos un 90 % de acierto.
     - Los exámenes de etapa (6, 12, 18 y 28) se hacen sin teclado ni manos en pantalla. */
  const PASSES_NEEDED = 2;
  const FOCUS_MIN_ACC = 90;
  const EXAMS = [6, 12, 18, 28];
  const UPPER = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  const FOCUS = { caps: UPPER, accents: 'áéíóúÁÉÍÓÚ', punct: '¿?¡!:;' };

  LESSONS.forEach(l => {
    l.minAcc = l.stage === 6 || l.stage === 7 ? 93 : 95;
    l.passes = l.type === 'posture' ? 1 : PASSES_NEEDED;
    l.exam = EXAMS.includes(l.id);
    l.focusChars = l.type === 'keys' ? (l.newKeys || '') : l.type === 'numbers' ? (l.focusDigits || l.digits) : (FOCUS[l.type] || '');
    if (l.type !== 'keys') l.allowed = ALL_LETTERS;
    if (GEN[l.type]) l.make = () => GEN[l.type](l);
  });

  /* ---------- Práctica libre y pruebas cronometradas ---------- */
  const REPLACE = { '‘': "'", '’': "'", '´': "'", '`': "'", '“': '"', '”': '"', '«': '"', '»': '"',
    '–': '-', '—': '-', '…': '...', '\u00a0': ' ' };

  // Deja solo los caracteres que se enseñan en el curso
  function sanitize(text, canType) {
    let removed = 0;
    let out = '';
    for (const ch of String(text || '').normalize('NFC')) {
      const c = REPLACE[ch] !== undefined ? REPLACE[ch] : /\s/.test(ch) ? ' ' : ch;
      for (const x of c) {
        if (x === ' ' || canType(x)) out += x; else removed++;
      }
    }
    return { text: out.replace(/ +/g, ' ').trim(), removed };
  }

  function freeLesson(title, text, seconds) {
    const l = {
      id: seconds ? 'prueba' : 'libre', custom: true, free: true, stage: 0, title, type: 'free', minWpm: 0,
      timeLimit: seconds || 0, showKeys: '', badge: '',
      tip: seconds
        ? `Escribe todo lo que puedas durante ${seconds / 60} minuto${seconds > 60 ? 's' : ''}. El tiempo empieza con la primera tecla.`
        : 'Escribe el texto completo. No cuenta para desbloquear lecciones.'
    };
    l.make = () => {
      if (!seconds) return text;
      let t = text;
      while (t.length < seconds * 8) t += ' ' + text; // de sobra para el tiempo
      return t;
    };
    return l;
  }

  // Repaso personalizado con las teclas que más fallan
  function customLesson(focusChars, learned, minWpm) {
    const letters = [...learned].filter(c => !PUNCT.includes(c));
    const focus = focusChars.length ? focusChars : letters.slice(0, 4);
    const l = {
      id: 'repaso', custom: true, stage: 0, title: 'Repaso personalizado', type: 'keys', minAcc: 95,
      newKeys: '', allowed: learned, len: 160, minWpm, showKeys: focus.join(''), badge: focus.join(' ').toUpperCase(),
      tip: 'Este repaso se centra en las teclas en las que más te equivocas. No cuenta para desbloquear lecciones.'
    };
    l.make = () => {
      const ok = WORDS.filter(w => [...w].every(c => letters.includes(c)) && [...w].some(c => focus.includes(c)));
      const head = focus.map(c => c.repeat(3)).join(' ');
      return head + ' ' + fill(() => (ok.length >= 4 && Math.random() < 0.6 ? pick(ok) : group(letters, focus)), l.len);
    };
    return l;
  }

  window.LESSONS = LESSONS;
  window.CORE_LESSONS = LESSONS.filter(l => !l.optional); // las que cuentan para terminar el curso
  window.writingTopic = topic;
  window.writingQuality = writingQuality;
  window.TOPICS = TOPICS;

  // Calentamiento diario: 1 minuto con las teclas que más fallas (o, si no hay datos, al azar)
  window.warmupLesson = function (focus, learned) {
    const base = customLesson(focus, learned, 0);
    const once = base.make; // se guarda antes de sustituirla para no llamarse a sí misma
    return Object.assign(base, {
      id: 'calentamiento', warmup: true, title: 'Calentamiento', timeLimit: 60, minAcc: 90,
      tip: 'Un minuto para que los dedos se acuerden de su sitio, centrado en las teclas que más te cuestan. Escribe tranquilo: no cuenta para aprobar, pero sí para tus puntos.',
      make: () => { let t = once(); while (t.length < 700) t += ' ' + once(); return t; }
    });
  };
  window.STAGES = STAGES;
  window.customLesson = customLesson;
  window.ALL_LETTERS = ALL_LETTERS;
  window.TEXTS = TEXTS;
  window.takeText = takeText;
  window.sanitizeText = sanitize;
  window.freeLesson = freeLesson;
  window.FOCUS_MIN_ACC = FOCUS_MIN_ACC;
})();
