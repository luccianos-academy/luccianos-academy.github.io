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

// El sitio de PRUEBAS de la versión con Firebase (Firebase Hosting del proyecto luccianos-academy-pruebas): usa Firestore de verdad y
// se trata como entorno de prueba (insignia "PRUEBA" en Mi perfil, idiomas sin restricción de vista previa).
const HOSTING_FIREBASE_PRUEBAS = ["luccianos-academy-pruebas.web.app", "luccianos-academy-pruebas.firebaseapp.com"];
export const ES_HOSTING_FIREBASE = typeof location !== "undefined" && HOSTING_FIREBASE_PRUEBAS.includes(location.hostname);

// El entorno REPO de la versión Firebase: esta app publicada en GitHub Pages en la cuenta de REPO (la ruta vieja de REPO,
// /luccianos-academy/, y el ensayo /luccianos-academy-ensayo/), con Firebase solo como backend de datos y el Firebase de PRUEBAS.
// Producción (luccianos-academy.github.io) se suma el día del corte con su propio Firebase (ver DISENO_FIREBASE §24 y §25).
export const ES_PAGES_FIREBASE = typeof location !== "undefined" && location.hostname === REPO_HOSTNAME;

export const ES_STAGING = typeof location !== "undefined" && (location.hostname === REPO_HOSTNAME || ES_HOSTING_FIREBASE);

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

/**
 * Idiomas nuevos en VISTA PREVIA. En producción, los idiomas de esta lista (hoy
 * inglés y dariya marroquí) solo los ven las personas habilitadas: las fijas de
 * REVISORES_FIJOS más las que el Admin tilde en Configuración → Idiomas — vista
 * previa. Para el resto la app sigue exactamente igual, solo en español.
 * Para abrir un idioma a todos: sacarlo de esta lista (el dariya, además, solo
 * existe para locales de Marruecos). En REPO/local no hay vista previa: todo
 * está abierto para poder probarlo.
 */
export const IDIOMAS_EN_VISTA_PREVIA = ES_ENTORNO_PRUEBA ? [] : ["en", "ar-MA"];

/**
 * Personas que siempre ven los idiomas en vista previa. Son huellas SHA-256 del
 * email en minúsculas (el sitio es público: así no queda ningún email escrito en
 * el código). Calcular una huella:
 *   node -e 'console.log(require("crypto").createHash("sha256").update("email@dominio.com").digest("hex"))'
 */
export const REVISORES_FIJOS = [
    "bb6df1d947098942074659a6ac082a093c1fc22c4db2bb55deeae53647571f18", // Gabriel Busquets
];

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

// APP NUEVA (migración a Firebase) — desconectada A PROPÓSITO del backend
// de Apps Script de la app que hoy opera: GAS_URL queda vacío, así que corre
// siempre con datos de muestra y NO puede leer ni escribir datos reales,
// sin importar desde qué dirección se abra. Cuando exista el backend de
// Firebase de esta app, se conecta acá (ver MIGRACION_FIREBASE.md).
export const GAS_URL = "";
void STAGING_GAS_URL; void PROD_GAS_URL;

// El Client ID de Google Sign-In real está autorizado para el dominio
// de producción (y localhost) en Google Cloud Console — usarlo desde
// github.io fallaría (origen no autorizado) hasta agregar ese dominio
// ahí también. Mientras STAGING_GOOGLE_CLIENT_ID esté vacío, REPO sigue
// con el selector de roles de muestra aunque el backend ya esté
// conectado — son dos interruptores independientes (ver login.js).
export const GOOGLE_CLIENT_ID = ""; // sin login real hasta tener Firebase Auth propio
void STAGING_GOOGLE_CLIENT_ID; void PROD_GOOGLE_CLIENT_ID;

/**
 * Con GAS_URL vacío (todavía no hay backend conectado en este
 * entorno), la app corre contra los datos de muestra en memoria
 * (js/data/mock/*). Con GAS_URL seteado (staging o producción), lee/
 * escribe en la Sheet real vía el backend, sin tocar páginas ni
 * componentes.
 */
/**
 * Interruptor de la capa de datos: false = como hasta ahora (datos de muestra en modo demo);
 * true = TODA la app lee y escribe en Firestore (services/firestoreSource.js).
 * Requiere el inicio de sesión de Firebase Auth (services/firebaseAuth.js): sin sesión, las
 * reglas de seguridad deniegan todo y cada pantalla fallaría.
 */
export const USAR_FIRESTORE = false
    // Prueba local: http://localhost:PUERTO/?firestore=1 enciende el interruptor SOLO en localhost.
    || (ES_LOCAL_DEV && /[?&]firestore=1(&|$)/.test(location.search))
    // El sitio de pruebas en Firebase Hosting y el ensayo en GitHub Pages siempre usan Firestore.
    || ES_HOSTING_FIREBASE
    || ES_PAGES_FIREBASE
    || (typeof location !== "undefined" && location.hostname === "luccianos-academy.github.io");

// Con Firestore activo NO es modo demo: muchas pantallas escriben en memoria cuando esto es true (Gestión de tareas, mail, push).
export const USE_MOCK_DATA = !GAS_URL && !USAR_FIRESTORE;



// --- Dos proyectos de Firebase, elegidos por la dirección desde la que se abre la app (igual que antes con las planillas) ---
// PRUEBAS (REPO, sitio de Firebase Hosting y localhost): proyecto luccianos-academy-pruebas.
// PRODUCCIÓN (luccianos-academy.github.io): proyecto luccianos-academy-prod, con los datos reales. Los dos son distintos a propósito:
// lo que se pruebe en REPO nunca puede tocar los datos reales.
const FIREBASE_PRUEBAS = {
    config: {
        apiKey: "AIzaSyBTCCqbCtg1Nc2Y8Cv24GTcfYJrphnz5Rc",
        authDomain: "luccianos-academy-pruebas.firebaseapp.com",
        projectId: "luccianos-academy-pruebas",
        storageBucket: "luccianos-academy-pruebas.firebasestorage.app",
        messagingSenderId: "193637663905",
        appId: "1:193637663905:web:0d2a1f340ef7b644c79ce0",
    },
    // Clave pública para notificaciones push web (consola → Configuración → Cloud Messaging → Certificados push web).
    vapid: "BMpBa7Ye51ppsEzr2hEbk3ps_6rCaGQIYBlITLXNoOi71XRduw1vLPUVJmG3oWvwi2pIs-G6rCDoegQJ8zADh1c",
    // Servicio de avisos (Apps Script aparte, ver servicio-avisos/README.md): después de dejar un pedido de push en la cola,
    // la app le "toca el timbre" a esta dirección para que salga al instante. Vacío = no hay timbre: el servicio igual
    // revisa la cola cada 5 minutos. Es la URL de la aplicación web ("/exec"); no es secreta.
    avisosUrl: "https://script.google.com/macros/s/AKfycbxWrmsxKk6ShSFAZZLKKNHlcO3V38jwScUJnd-XtkKjVH058iyNi9OPXDUgiAxb0OzA/exec",
};
const FIREBASE_PRODUCCION = {
    config: {
        apiKey: "AIzaSyB8vPE7JbvSaYN6YgOGOFeXFqJh039vf6c",
        authDomain: "luccianos-academy-prod.firebaseapp.com",
        projectId: "luccianos-academy-prod",
        storageBucket: "luccianos-academy-prod.firebasestorage.app",
        messagingSenderId: "724581094401",
        appId: "1:724581094401:web:baa805f9c8e0a01fd01c00",
    },
    vapid: "BBnufoQfWTSHhtjRQogf9UNeTWUAnEumZ8u7FadIlbGTZgyUrUhSJgmnUl8fB7n_QlW76cPWqjeyMTgI2dKMix8",
    avisosUrl: "https://script.google.com/macros/s/AKfycbzHHVpikJyWIWi9m64gKv75hPztxHSGgMgb1_jzVKgaCoUPzGR3llLn2qTMxyAuOmJFQA/exec",   // servicio de avisos de PRODUCCIÓN (cuenta luccianos.academy; DISENO_FIREBASE §26)
};
// Producción en GitHub Pages (cuenta luccianos-academy). Solo ese dominio usa el Firebase de producción; para cargar los datos reales
// desde la computadora se puede abrir localhost con ?proyecto=prod (ver js/dev/migrar.js).
const HOST_PRODUCCION = "luccianos-academy.github.io";
export const ES_FIREBASE_PRODUCCION = typeof location !== "undefined"
    && (location.hostname === HOST_PRODUCCION || (ES_LOCAL_DEV && /[?&]proyecto=prod(&|$)/.test(location.search)));
const FIREBASE_ELEGIDO = ES_FIREBASE_PRODUCCION ? FIREBASE_PRODUCCION : FIREBASE_PRUEBAS;

export const FIREBASE_CONFIG = FIREBASE_ELEGIDO.config;
export const AVISOS_URL = FIREBASE_ELEGIDO.avisosUrl;
export const FIREBASE_VAPID_KEY = FIREBASE_ELEGIDO.vapid;

/** true recién cuando se cargaron los valores reales de arriba —
 *  services/push.js usa esto para no intentar nada (ni tirar errores
 *  en consola) mientras el proyecto Firebase no exista todavía. */
export const PUSH_DISPONIBLE = !!FIREBASE_CONFIG.apiKey && !!FIREBASE_VAPID_KEY;

/** Se muestra en Mi perfil (junto con un "PRUEBA" si ES_STAGING) para
 *  saber de un vistazo qué versión corre en cada entorno y no
 *  confundir REPO con producción. Se sube a mano cada vez que se
 *  pushea un cambio — no hay build step que lo automatice. */
export const VERSION = "0.9.5";

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
    RECURSOS: "Recursos",
    TOKENS: "Tokens",
    // Dónde se vende cada producto del catálogo. Solo excepciones: un
    // producto sin fila está disponible en toda la red — ver
    // data/disponibilidad.js.
    DISPONIBILIDAD: "Disponibilidad",
    // Traducciones escritas desde Configuración → Traducciones (idioma | es |
    // traduccion). Se suman a los diccionarios de la app — ver data/traducciones.js.
    TRADUCCIONES: "Traducciones",
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
    // Desafío diario (#/desafio) — una fila por cada vez que alguien
    // juega, ver apps-script/README.md. El ranking del mes en curso se
    // calcula sumando estas filas; DESAFIO_HISTORIAL guarda la foto
    // congelada de un mes ya cerrado.
    DESAFIO_RESULTADOS: "DesafioResultados",
    DESAFIO_HISTORIAL: "DesafioHistorial",
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
    { id: "ranking",        nombre: "Ranking",              icono: "trofeo" },
    { id: "recursos",       nombre: "Recursos",             icono: "integraciones" },
    { id: "manuales",       nombre: "Manuales",             icono: "reportes" },
    { id: "perfil",         nombre: "Mi perfil",            icono: "perfil" },
];
