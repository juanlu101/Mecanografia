/* =========================================================
   CONFIGURACIÓN — el/la docente puede cambiar estos valores
   ========================================================= */
window.CONFIG = {
  // Multiplicador de la velocidad mínima de cada lección.
  // 1 = valores por defecto · 0.8 = más fácil · 1.2 = más exigente
  WPM_FACTOR: 1,

  // Grupos que aparecen en el desplegable al crear un alumno.
  // Con Google Sheets conectado, el profesor/a los cambia desde su panel (botón «Grupos»)
  // y esta lista solo se usa hasta que se guarda la primera vez.
  GROUPS: [
    "1º ESO A", "1º ESO B", "1º ESO C",
    "2º ESO A", "2º ESO B", "2º ESO C",
    "3º ESO A", "3º ESO B", "3º ESO C",
    "4º ESO A", "4º ESO B", "4º ESO C",
    "1º Bach A", "1º Bach B", "1º Bach C",
    "2º Bach A", "2º Bach B", "2º Bach C"
  ],

  // Ranking semanal por clases (necesita Google Sheets conectado). false = ocultarlo.
  RANKING: true,

  // Minutos de práctica diaria recomendados (objetivo diario).
  DAILY_GOAL_MIN: 10,

  // true = todas las lecciones abiertas desde el principio (útil para probar).
  UNLOCK_ALL: false,

  // Clave del panel del profesor/a cuando NO se usa Google Sheets.
  // (Si usas Google Sheets, la clave que vale es la de Code.gs.)
  // ¡Cámbiala! Ojo: un alumno que sepa mirar el código fuente podría verla.
  TEACHER_KEY: "profe",

  // Nombre del centro y del profesor/a (aparecen en el diploma). Opcional.
  SCHOOL_NAME: "",
  TEACHER_NAME: "",

  // Textos propios para la práctica libre y las pruebas cronometradas. Opcional.
  // Ejemplo: { titulo: "El ciclo del agua", texto: "El agua de los mares se evapora..." }
  CUSTOM_TEXTS: [
  ],

  // OPCIONAL: URL de la aplicación web de Google Apps Script (ver README).
  // Si está vacía, el progreso solo se guarda en el navegador del alumno.
  // Ejemplo: "https://script.google.com/macros/s/AKfycbx2D5D8ywNy427ElmfIHH19fs9aZ2oc7AjlZqdyq6pIQfSR-Nye5co8qstFPyvwiuCHcA/exec"
  SYNC_URL: ""
};
