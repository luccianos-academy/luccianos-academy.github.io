/* ============================
   FARO v4
   config.js — Configuración centralizada

   Todo lo que cambia entre entornos vive acá. Ningún otro
   archivo debería tener URLs o IDs hardcodeados.
=============================*/

/**
 * Entorno de STAGING (REPO) vs PRODUCCIÓN, decidido por el dominio:
 *   - GitHub Pages (*.github.io) → REPO: usa el backend de STAGING de
 *     abajo (Sheet + Apps Script propios, separados de producción) —
 *     así se puede probar push/upload/sync de verdad sin tocar datos
 *     reales. Mientras STAGING_GAS_URL esté vacío (todavía no se creó
 *     ese backend), cae solo a modo demo con datos de muestra.
 *   - Cualquier otro dominio (Netlify de producción, o localhost) →
 *     backend real de PRODUCCIÓN.
 * Así el MISMO código se comporta distinto según dónde esté servido,
 * sin mantener dos versiones.
 */
const ES_STAGING = typeof location !== "undefined" && /\.github\.io$/.test(location.hostname);

// localhost/127.0.0.1 → modo demo puro (mock, sin backend), para poder
// desarrollar la UI local sin pegarle a ningún backend real por
// accidente. Ni STAGING ni PRODUCCIÓN.
const ES_LOCAL_DEV = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// Backend de staging — Sheet + Apps Script separados de producción
// (ver apps-script/README.md, sección "Backend de staging para REPO").
// Pegar acá la URL del deploy una vez creado. Vacío = REPO cae a modo
// demo (mock) automáticamente, sin romper nada mientras tanto.
const STAGING_GAS_URL = "";
const STAGING_GOOGLE_CLIENT_ID = "";

const PROD_GAS_URL = "https://script.google.com/macros/s/AKfycbwnod6RG4knjPpZRJn2Zl4M_AWpLKspKdX68emaE-2M0vwxAvuX1nISPW3WUVH0V1c7CA/exec";
const PROD_GOOGLE_CLIENT_ID = "801785311174-1kkcf884hdac9s1a6og2kum1joogme4t.apps.googleusercontent.com";

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

export const VERSION = "4.0.0-sprint2";

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
    { id: "coordinacionoperativa", nombre: "Comunicaciones", icono: "comentario" },
    { id: "recursos",       nombre: "Recursos",             icono: "integraciones" },
    { id: "manuales",       nombre: "Manuales",             icono: "reportes" },
    { id: "perfil",         nombre: "Mi perfil",            icono: "perfil" },
];
