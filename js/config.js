/* ============================
   Lucciano's Academy
   config.js — Configuración centralizada

   Todo lo que cambia entre entornos vive acá. Ningún otro
   archivo debería tener URLs o IDs hardcodeados.
=============================*/

/**
 * Entorno de STAGING (REPO) vs PRODUCCIÓN, decidido por el dominio
 * EXACTO de REPO (no por sufijo *.github.io) — porque producción
 * también pasó a vivir en GitHub Pages, bajo una cuenta distinta
 * (luccianos.academy@gmail.com), y ambos dominios terminan en
 * ".github.io". Si detectáramos por sufijo, producción caería en
 * modo STAGING por error.
 *   - REPO_HOSTNAME (siscap-luccianos.github.io) → REPO: usa el
 *     backend de STAGING de abajo (Sheet + Apps Script propios,
 *     separados de producción) — así se puede probar push/upload/
 *     sync de verdad sin tocar datos reales. Mientras STAGING_GAS_URL
 *     esté vacío (todavía no se creó ese backend), cae solo a modo
 *     demo con datos de muestra.
 *   - Cualquier otro dominio (producción en GitHub Pages, o
 *     localhost) → backend real de PRODUCCIÓN.
 * Así el MISMO código se comporta distinto según dónde esté servido,
 * sin mantener dos versiones.
 */
const REPO_HOSTNAME = "siscap-luccianos.github.io";

export const ES_STAGING = typeof location !== "undefined" && location.hostname === REPO_HOSTNAME;

// localhost/127.0.0.1 → modo demo puro (mock, sin backend), para poder
// desarrollar la UI local sin pegarle a ningún backend real por
// accidente. Ni STAGING ni PRODUCCIÓN.
export const ES_LOCAL_DEV = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// Para decisiones de UX que deben ser iguales en CUALQUIER entorno de
// prueba (local o REPO) y solo distintas en producción — ej. saltar el
// video institucional del login, que tiene sentido en la portada real
// pero solo agrega pasos muertos mientras se prueba algo. ES_STAGING y
// ES_LOCAL_DEV siguen existiendo por separado para lo que sí debe
// diferenciarse entre ellos (backend real de staging vs. mock puro).
export const ES_ENTORNO_PRUEBA = ES_STAGING || ES_LOCAL_DEV;

// Backend de staging — Sheet + Apps Script separados de producción
// (ver apps-script/README.md, sección "Backend de staging para REPO").
// Pegar acá la URL del deploy una vez creado. Vacío = REPO cae a modo
// demo (mock) automáticamente, sin romper nada mientras tanto.
const STAGING_GAS_URL = "https://script.google.com/macros/s/AKfycbyNZfjy9jR-SQ6F1iW02ePvv6otWBZs7rkf7GKnuZiM_XqcQvEDMVlAyfVLPGldEMg/exec";

const PROD_GAS_URL = "https://script.google.com/macros/s/AKfycbzffwKoe6Jgpc5wABvrRBei2gpnUfqTHN4kr5AMP5ghNpHw7kJWVZCfobr8B1261Vjm/exec";
const PROD_GOOGLE_CLIENT_ID = "801785311174-1kkcf884hdac9s1a6og2kum1joogme4t.apps.googleusercontent.com";

// Mismo Client ID que producción — el origen de GitHub Pages
// (https://siscap-luccianos.github.io) ya está agregado como "Origen
// autorizado de JavaScript" en ese mismo Client ID de Google Cloud, así
// que no hace falta uno separado para staging.
const STAGING_GOOGLE_CLIENT_ID = PROD_GOOGLE_CLIENT_ID;

export const GAS_URL = ES_LOCAL_DEV ? "" : ES_STAGING ? STAGING_GAS_URL : PROD_GAS_URL;

// El Client ID de Google Sign-In real está autorizado para el dominio
// de producción (y localhost) en Google Cloud Console — usarlo desde
// github.io fallaría (origen no autorizado) hasta agregar ese dominio
// ahí también. Mientras STAGING_GOOGLE_CLIENT_ID esté vacío, REPO sigue
// con el selector de roles de muestra aunque el backend ya esté
// conectado — son dos interruptores independientes (ver login.js).
export const GOOGLE_CLIENT_ID = ES_LOCAL_DEV ? "" : ES_STAGING ? STAGING_GOOGLE_CLIENT_ID : PROD_GOOGLE_CLIENT_ID;

/**
 * Con GAS_URL vacío (todavía no hay backend conectado en este
 * entorno), la app corre contra los datos de muestra en memoria
 * (js/data/mock/*). Con GAS_URL seteado (staging o producción), lee/
 * escribe en la Sheet real vía el backend, sin tocar páginas ni
 * componentes.
 */
export const USE_MOCK_DATA = !GAS_URL;

/**
 * Firebase Cloud Messaging (push real, "Fase B" de Coordinación
 * Operativa) — proyecto "Lucciano's Academy Web"
 * (lucciano-s-academy-web) en console.firebase.google.com, cuenta
 * gabrielbusquets86. Estos valores NO son secretos (viajan al
 * cliente igual que GOOGLE_CLIENT_ID) — está bien commitearlos al
 * repo público. El secreto real (clave de cuenta de servicio, para
 * ENVIAR pushes) vive solo en Propiedades del script de Apps Script,
 * nunca acá — ver PENDIENTE en apps-script/Code.gs (_propFCM).
 */
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB6YJZebu7r_Nuk_daHElYUy5zBP1B-Rpk",
    authDomain: "lucciano-s-academy-web.firebaseapp.com",
    projectId: "lucciano-s-academy-web",
    storageBucket: "lucciano-s-academy-web.firebasestorage.app",
    messagingSenderId: "1008760177490",
    appId: "1:1008760177490:web:62f272f1ff8af4cf68708b",
};

export const FIREBASE_VAPID_KEY = "BJetjOQPNUxWAkC9HwSbCtp9W15Ya3ebbj8VB41kng-j5OgjivPYFB5W-C3JgIlrjcflN4PejGD6NTsid7ez4ms";

/** true recién cuando se cargaron los valores reales de arriba —
 *  services/push.js usa esto para no intentar nada (ni tirar errores
 *  en consola) mientras el proyecto Firebase no exista todavía. */
export const PUSH_DISPONIBLE = !!FIREBASE_CONFIG.apiKey;

/** Se muestra en Mi perfil (junto con un "PRUEBA" si ES_STAGING) para
 *  saber de un vistazo qué versión corre en cada entorno y no
 *  confundir REPO con producción. Se sube a mano cada vez que se
 *  pushea un cambio — no hay build step que lo automatice. */
export const VERSION = "1.76.0";

export const EMPRESA = {
    nombre: "Lucciano's",
    logo: "LUCCIANO'S",
    logoUrl: "https://lh3.googleusercontent.com/d/1P6MTzhpyzNYecmRYGrhFKcyHyQIPY-pu",
};

/**
 * Hojas del modelo de datos (según el blueprint): 8 tablas.
 * Cada función de js/data/*.js lee/escribe contra uno de estos
 * nombres.
 */
export const HOJAS = {
    USUARIOS: "Usuarios",
    SUCURSALES: "Sucursales",
    CURSOS: "Cursos",
    LECCIONES: "Lecciones",
    EVALUACIONES: "Evaluaciones",
    ASIGNACIONES: "Asignaciones",
    RESULTADOS: "Resultados",
    AUDITORIA: "Auditoria",
    NOTICIAS: "Noticias",
    MANUALES: "Manuales",
    PUBLICACIONES: "Publicaciones",
    COMENTARIOS: "Comentarios",
    CANALES: "Canales",
    RECURSOS: "Recursos",
    TOKENS: "Tokens",
    // Dónde se vende cada producto del catálogo. Solo excepciones: un
    // producto sin fila está disponible en toda la red — ver
    // data/disponibilidad.js.
    DISPONIBILIDAD: "Disponibilidad",
    // Catálogo de tareas de "Gestión semanal" (Responsables de Local y
    // Turno, #/gestion) — ver apps-script/README.md para el esquema.
    GESTION_TAREAS: "GestionTareas",
    // Fase 2 (2026-08-25): en qué días le aplica cada tarea a CADA
    // sucursal — separado de GestionTareas (el catálogo, solo Admin).
    // Ver apps-script/README.md.
    GESTION_TAREAS_SUCURSAL: "GestionTareasSucursal",
    // Check "hecho" persistido, por sucursal y por día — ver
    // apps-script/README.md.
    GESTION_CHECKS: "GestionChecks",
};

/**
 * Menú lateral — qué módulos existen. Cuáles ve cada rol se
 * decide en MENU_POR_ROL (services/auth.js), no acá.
 *
 * "academia" (gestión, admin) y "cursos" (mi formación, colaborador)
 * comparten el mismo nombre visible "Academia" a propósito: son dos
 * rutas distintas para dos experiencias distintas del mismo tema,
 * y cada rol solo tiene una de las dos en su MENU_POR_ROL — así el
 * Sidebar no necesita ningún condicional para elegir cuál mostrar.
 */
export const MODULOS = [
    { id: "inicio",         nombre: "Inicio",              icono: "inicio" },
    { id: "dashboard",      nombre: "Dashboard Ejecutivo",  icono: "dashboard" },
    { id: "supervisores",   nombre: "Supervisores",         icono: "supervisores" },
    { id: "locales",        nombre: "Locales",              icono: "locales" },
    { id: "academia",       nombre: "Academia",             icono: "academia" },
    { id: "historia",       nombre: "Nuestra Historia",     icono: "historia" },
    { id: "cursos",         nombre: "Academia",             icono: "academia" },
    { id: "evaluaciones",   nombre: "Evaluaciones",         icono: "evaluaciones" },
    { id: "reportes",       nombre: "Reportes",             icono: "reportes" },
    { id: "alertas",        nombre: "Alertas",              icono: "alertas" },
    { id: "configuracion",  nombre: "Configuración",        icono: "configuracion" },
    { id: "integraciones",  nombre: "Integraciones",        icono: "integraciones" },
    { id: "colaboradores",  nombre: "Mi equipo",            icono: "usuarios" },
    { id: "gestion",        nombre: "Gestión de tareas",    icono: "calendario" },
    { id: "coordinacionoperativa", nombre: "Comunicaciones", icono: "comentario" },
    { id: "recursos",       nombre: "Recursos",             icono: "integraciones" },
    { id: "manuales",       nombre: "Manuales",             icono: "reportes" },
    { id: "perfil",         nombre: "Mi perfil",            icono: "perfil" },
];
