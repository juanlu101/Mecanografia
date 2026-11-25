# Teclea · Mecanografía paso a paso

**Creado por Juan Luis Torralbo Muñoz.**

Programa web para aprender mecanografía **desde cero** con teclado español:
cada tecla con su dedo, 31 lecciones de menos a más (más 3 avanzadas opcionales) y progreso guardado.

- Sin instalaciones ni dependencias: HTML, CSS y JavaScript puro.
- Se publica gratis en **GitHub Pages**.
- Funciona en cualquier navegador moderno (Chrome, Edge, Firefox, Safari) con teclado físico.

---

## Cómo funciona

| Etapa | Lecciones | Qué se aprende |
|---|---|---|
| 1 · Fila guía | 0–6 | **0: Antes de empezar** · F J · D K · S L · A Ñ · G H · repaso |
| 2 · Fila superior | 7–12 | E I · R U · T Y · O W · Q P · repaso |
| 3 · Fila inferior | 13–18 | N M · C , · V B · X . · Z - · repaso |
| 4 · Mayúsculas, tildes y signos | 19–21 | Mayús (con la mano contraria) · á é í ó ú · ¿? ¡! : ; |
| 5 · Números | 22–23 | 1–5 · 6–0 |
| 6 · Textos | 24–28 | Frases (14 ppm) · textos (16) · textos largos (17) · ritmo constante (18) · reto de velocidad (20) |
| 7 · Escribir de verdad | 29–30 | **Corregir errores**: los errores no bloquean y hay que borrarlos con ⟵ (meñique derecho) antes de terminar · **Escritura libre**: 3 minutos escribiendo sobre un tema, sin texto que copiar |
| 8 · Avanzado *(opcional)* | 31–33 | Textos largos a 25, 30 y 35 ppm. No hace falta para el diploma; si se supera, aparece en él. |

**Lección 0 · Antes de empezar**: cómo sentarse, la fila guía y los colores de cada dedo, una comprobación de que el teclado está en español (pulsar la Ñ), un ejercicio para colocar los dedos y las reglas de oro.

En cada lección:

1. **Explicación**: qué teclas son nuevas y con qué dedo se pulsan.
2. **Ejercicio**: el texto se genera al azar (cada intento es distinto) usando solo las teclas ya aprendidas. El teclado en pantalla y las manos indican en todo momento la tecla y el dedo. Cada dedo tiene su color.
3. **Resultados**: palabras por minuto (ppm), precisión, tiempo, teclas más falladas y minutos practicados hoy.

### Requisitos para superar una lección

Para asegurar que de verdad se aprende cada tecla:

- **Precisión mínima del 95 %** (93 % en las lecciones 24 a 28, que tienen mayúsculas, tildes y signos).
- **Hay que aprobarla 2 veces** (no hace falta que sean seguidas). El mapa muestra «Aprobada 1 de 2».
- **Al menos un 90 % de acierto en las teclas nuevas**: no basta con aprobar gracias a las teclas que ya se dominan.
- **Velocidad mínima** que sube poco a poco: 5 ppm al principio, 20 ppm en el reto final.
- **Exámenes de etapa sin ayudas**: las lecciones 6, 12, 18 y 28 se hacen sin el teclado ni las manos en pantalla. Consejo: tapad el teclado con una caja abierta por delante o con un paño.

Superar una lección desbloquea la siguiente. Las estrellas (1 a 3) premian ir más allá del mínimo. Duración aproximada del curso: **14 a 19 horas de práctica** (la etapa avanzada, aparte).

- **Mayús con la mano contraria**: si el alumno usa la Mayús de la misma mano que la letra (o Bloq Mayús para escribir mayúsculas), cuenta como error y se le avisa.

La app no puede saber si el alumno mira el teclado físico o si usa el dedo correcto: eso solo se puede observar en clase.

**Tiempo de práctica**: solo cuenta el tiempo que el alumno está escribiendo. Si se queda parado, como mucho se cuentan 5 segundos entre dos pulsaciones, así que dejar una lección abierta sin escribir no suma minutos, puntos ni objetivo diario.

Además:

- **Ranking semanal** (con Google Sheets): ver la sección *Ranking*.
- **Objetivo diario y racha**: minutos practicados hoy frente al objetivo (10 por defecto), días seguidos practicando y los últimos 7 días.
- **Mapa de calor «Tus teclas»**: el teclado coloreado de verde a rojo según los errores de cada tecla.
- **Calentamiento diario**: a partir de la lección 6, la primera lección de cada día empieza con 1 minuto de calentamiento centrado en las teclas que más falla el alumno. Así lo aprendido al principio no se olvida. No cuenta para aprobar, pero sí suma puntos.
- **Escritura libre**: hay 20 temas (el fin de semana, un viaje soñado, tu comida favorita…). Para aprobar hacen falta 12 palabras por minuto y al menos 20 palabras distintas; la app detecta las letras al azar y las palabras repetidas sin parar. Lo que escribe cada alumno llega a tu hoja (columna *Texto*).
- **Repaso personalizado**: un ejercicio con las teclas en las que más falla ese alumno.
- **Práctica libre y pruebas cronometradas** (al terminar la lección 18): un texto al azar, uno de los textos del profesor/a o uno pegado por el alumno, sin límite o en 1, 2, 3 o 5 minutos. Sirve para poner nota o para medir el progreso. Se guarda el historial de pruebas.
- **Diploma** imprimible (o en PDF) al completar el curso.
- **Avisos automáticos**: Bloq Mayús activado, teclado que no está en español y tableta o móvil sin teclado.
- **Ajustes**: ocultar el teclado en pantalla o las manos (para dejar de mirar), sonido de error y cambiar el PIN.
- `Esc` pausa la lección; `Intro` pasa a la siguiente desde los resultados.

> ⚠️ Los ordenadores deben tener configurada la **distribución de teclado Español (España)**. Si no, la app lo detecta y avisa.

---

## Ranking

Solo funciona con **Google Sheets conectado** (cada alumno necesita ver los puntos de sus compañeros). Se puede ocultar con `RANKING: false` en `js/config.js`.

- **Semanal**: se reinicia cada lunes, así todos tienen una nueva oportunidad.
- **Mi clase**: cada alumno ve los 5 primeros de su grupo y su propia posición. Los nombres aparecen abreviados («Lucía P.»).
- **Clases**: media de puntos por alumno de cada grupo. Cuentan todos los alumnos, también los que no practican, así que a la clase le interesa que todos participen.
- **Panel del profesor/a**: columna *Puntos semana* (ordenable, con el ranking completo) y ranking de clases con cuántos alumnos han practicado.

Cómo se ganan puntos (premia la constancia y la técnica, no solo la velocidad):

| Acción | Puntos |
|---|---|
| Cada minuto de práctica | 10 (máximo 300 al día) |
| Cada estrella nueva | +10 |
| Cada lección superada | +50 |
| Cumplir el objetivo del día | +20, y +5 por cada día de racha (hasta +50) |

Solo puntúan los ejercicios con **al menos un 90 % de precisión**. Repetir una lección que ya tiene 3 estrellas solo da los puntos por minutos.

---

## Alumnos, PIN y nombres repetidos

- Cada alumno entra con **nombre y apellidos, su grupo (elegido de una lista) y un PIN de 5 números**. En un ordenador compartido, nadie puede entrar en el perfil de otro ni borrarlo sin su PIN.
- Si alguien intenta crear un perfil con un nombre y grupo que ya existen (en ese ordenador o en la hoja de Google) y el PIN no coincide, la app le avisa: *si eres tú, el PIN no es correcto; si no, añade tu segundo apellido o una inicial*. Así no se mezcla el progreso de dos alumnos que se llaman igual.
- Las mayúsculas, las tildes y los espacios de más no importan: «Lucía Pérez» y «lucia perez» son el mismo nombre.
- **Entrar desde cualquier ordenador** (con Google Sheets): en el formulario «Entrar con mi nombre», el alumno escribe su nombre, elige su grupo y pone su PIN, y recupera su progreso. Tiene que escribir el nombre igual que la primera vez (dan igual mayúsculas, tildes y espacios) y elegir el mismo grupo. Si en ese momento no hay conexión con la hoja, la app avisa y no crea nada, para no duplicar al alumno; solo deja entrar a quien ya estaba guardado en ese ordenador.
- **Sesión que se cierra sola**: tras 10 minutos sin tocar el teclado ni el ratón, la sesión del alumno se cierra (y también el panel del profesor/a). Así, si alguien se va sin pulsar *Salir*, el siguiente no entra con su perfil.
- **Lista por grupo**: si en un ordenador hay más de 8 alumnos de varios grupos, la pantalla de inicio muestra solo los del grupo elegido en «Mi grupo» (el ordenador recuerda la última elección).
- **PIN olvidado**: en el panel del profesor/a, la columna *PIN* muestra el PIN de cada alumno (pulsa sobre los puntos para verlo y otra vez para ocultarlo; así no se ve si proyectas la pantalla). También puedes pulsar *Quitar PIN*: el alumno entra con el formulario «¿No estás en la lista?» (su nombre, su grupo y un PIN nuevo) y conserva su progreso, también en los ordenadores donde ya había entrado.
- El PIN en texto **solo se guarda en tu hoja de Google** (columna *PIN (texto)*), nunca en los ordenadores de clase, y solo se envía al panel con tu clave. Por eso, para verlo hace falta tener Google Sheets conectado. En el ordenador solo queda una versión cifrada del PIN, que sirve para comprobarlo al entrar.
- No compartas la hoja de Google con nadie: contiene los PIN de los alumnos.
- Los alumnos que crearon su perfil con un PIN de 4 números pueden seguir entrando con él. Si el PIN de un alumno aparece como «—», se verá en cuanto vuelva a entrar.

### Grupos

Los alumnos eligen su grupo en un desplegable, así no hay errores al escribirlo. Por defecto: de **1º ESO A** a **2º Bach C** (A, B y C de cada curso).

Para añadir, quitar u ordenar grupos: panel del profesor/a → **Grupos** → *Guardar grupos*. Con Google Sheets la lista se guarda en la hoja *Grupos* y vale para todos los ordenadores. Quitar un grupo de la lista no borra a sus alumnos.

---

## Panel del profesor/a

Enlace **Acceso profesor/a** en la pantalla de inicio (o añade `#profe` al final de la dirección).

- Tabla de alumnos con lección por la que va, lecciones superadas, mejor velocidad y última prueba, minutos totales y de esta semana, racha, última vez que practicó (en rojo si hace más de 7 días) y teclas débiles. Se puede ordenar por cualquier columna, filtrar por grupo y buscar por nombre.
- Resumen del grupo (medias e inactivos) y **mapa de calor del grupo** para saber qué teclas repasar en clase.
- **Descargar CSV** para abrirlo en Excel o Google Sheets.
- **Quitar PIN** a un alumno que lo ha olvidado.
- **Añadir códigos**: pega los códigos de progreso de tus alumnos (o sube sus archivos `.txt`) para verlos en la tabla. Útil si no usas Google Sheets y te los entregan, por ejemplo, por Classroom.

De dónde salen los datos:

- **Con Google Sheets**: de la hoja, con todos los alumnos de todos los ordenadores. La clave es la de `CLAVE_PROFESOR` en `Code.gs`.
- **Sin Google Sheets**: de los alumnos guardados en el ordenador donde abras el panel, más los códigos que añadas. La clave es `TEACHER_KEY` en `js/config.js` (por defecto `profe`: cámbiala). Ojo: esta clave está en el código de la página, así que un alumno que sepa mirarlo podría verla.

---

## Cómo se guarda el progreso

Hay tres niveles. El 1 y el 2 funcionan siempre; el 3 es opcional.

### 1. En el navegador (automático)

El progreso se guarda en el `localStorage` del navegador, en **ese ordenador**. Varios alumnos pueden usar el mismo ordenador: cada uno elige su nombre y escribe su PIN.

Limitación: si el alumno cambia de ordenador, usa el modo incógnito o el centro borra los datos del navegador, el progreso no estará allí.

### 2. Código de progreso (manual, sin configurar nada)

Desde **Guardar / llevar progreso**, el alumno puede copiar un código (empieza por `TECLEA1.`) o descargarlo en un archivo `.txt`. En otro ordenador: **Tengo un código de progreso**. Si ya existía ese alumno, se combinan los dos progresos quedándose con lo mejor de cada uno.

### 3. Google Sheets (opcional, recomendado para el aula)


## Personalizar

Todo está en `js/config.js`:

| Opción | Para qué |
|---|---|
| `WPM_FACTOR` | Multiplica las velocidades mínimas: `0.8` más fácil, `1.2` más exigente. |
| `GROUPS` | Lista inicial de grupos (después se editan desde el panel). |
| `RANKING` | `false` oculta el ranking semanal. |
| `DAILY_GOAL_MIN` | Minutos de práctica diaria recomendados (10 por defecto). |
| `UNLOCK_ALL` | `true` abre todas las lecciones (para probar o para alumnos avanzados). |
| `TEACHER_KEY` | Clave del panel del profesor/a si no usas Google Sheets. |
| `SCHOOL_NAME`, `TEACHER_NAME` | Aparecen en el diploma. |
| `CUSTOM_TEXTS` | Tus textos para la práctica libre y las pruebas (ver abajo). |
| `SYNC_URL` | URL de Google Apps Script (opcional). |

Textos propios:

```js
CUSTOM_TEXTS: [
  { titulo: "El ciclo del agua", texto: "El agua de los mares se evapora con el calor del sol..." },
  { titulo: "Examen 2º trimestre", texto: "..." }
],
```

Los caracteres que no se enseñan en el curso (como `@`, `€` o `#`) se quitan automáticamente. Las comillas tipográficas y las rayas se convierten en comillas y guiones normales.

Lecciones y textos: en `js/lessons.js` puedes cambiar las listas `WORDS`, `PHRASES`, `TEXTS` (32 textos), los consejos de cada lección (`RAW`) y la velocidad mínima de cada una.

## Estructura

```
index.html                 Pantallas de la aplicación
css/styles.css             Estilos (incluye el diseño del diploma para imprimir)
js/config.js               Configuración del docente
js/keyboard.js             Teclado español y qué dedo pulsa cada tecla
js/lessons.js              Lecciones, textos y generador de ejercicios
js/storage.js              Guardado: navegador, código, PIN, racha y Google Sheets
js/app.js                  Lógica de la aplicación
js/teacher.js              Panel del profesor/a
google-apps-script/Code.gs Receptor opcional para Google Sheets
```

---

## Pruebas automáticas

El proyecto incluye **213 pruebas** que comprueban que todo funciona:

- **133 pruebas unitarias** (`tests/unit/`):
  - el teclado español y el dedo de cada tecla;
  - las 34 lecciones: cada texto generado solo usa teclas ya enseñadas y se puede escribir;
  - el guardado, el código de progreso, la unión de progresos, la racha, los puntos y la cola de envíos;
  - el script `Code.gs`, ejecutado sobre una hoja de Google simulada que, como la real, convierte en número o fecha los textos que lo parecen.
- **80 pruebas en navegador** (`tests/e2e/`), con Chromium y el `Code.gs` real:
  - crear perfiles, lección 0, aprobar dos veces, exámenes, Mayús y tildes;
  - completar todas las lecciones, el calentamiento, el modo real y la escritura libre;
  - entrar desde varios ordenadores, PIN, sin conexión, Google saturado;
  - ranking, panel del profesor/a, grupos, CSV, cierre de sesión, versiones anteriores…

Para ejecutarlas hace falta [Node.js](https://nodejs.org) 22 o superior:

```bash
npm install
npx playwright install chromium
npm test              # todas
npm run test:unit     # solo las unitarias (unos segundos)
npm run test:e2e      # solo las de navegador (unos 3 minutos)
```

Si subes también la carpeta `.github` al repositorio, GitHub ejecutará todas las pruebas automáticamente en cada cambio. Verás el resultado en la pestaña **Actions**. Las carpetas `tests/` y `.github/` y el archivo `package.json` no afectan a la web publicada.
