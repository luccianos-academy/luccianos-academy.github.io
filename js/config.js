/* ============================
   FARO v4
   config.js — Configuración centralizada

   Todo lo que cambia entre entornos vive acá. Ningún otro
   archivo debería tener URLs o IDs hardcodeados.
=============================*/

/**
 * Entorno de EXPERIMENTACIÓN vs PRODUCCIÓN, decidido por el dominio:
 *   - GitHub Pages (*.github.io) → entorno de prueba: sin login real
 *     de Google ni backend, corre en modo demo con datos de muestra.
 *     Sirve para experimentar features/UI sin tocar datos reales.
 *   - Cualquier otro dominio (Netlify de producción, o localhost) →
 *     config real de abajo (login Google + backend Apps Script).
 * Así el MISMO código se comporta distinto según dónde esté servido,
 * sin mantener dos versiones.
 */
const ES_EXPERIMENTAL = typeof location !== "undefined" && /\.github\.io$/.test(location.hostname);

export const GOOGLE_CLIENT_ID = ES_EXPERIMENTAL ? "" : "801785311174-1kkcf884hdac9s1a6og2kum1joogme4t.apps.googleusercontent.com";

export const GAS_URL = ES_EXPERIMENTAL ? "" : "https://script.google.com/macros/s/AKfycbwnod6RG4knjPpZRJn2Zl4M_AWpLKspKdX68emaE-2M0vwxAvuX1nISPW3WUVH0V1c7CA/exec";

/**
 * Con GAS_URL vacío (entorno experimental), la app corre contra los
 * datos de muestra en memoria (js/data/mock/*). Con GAS_URL seteado
 * (producción), lee/escribe en Sheets vía el backend, sin tocar
 * páginas ni componentes.
 */
export const USE_MOCK_DATA = !GAS_URL;

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
    { id: "noticias",       nombre: "Noticias",             icono: "noticias" },
    { id: "manuales",       nombre: "Manuales",             icono: "reportes" },
    { id: "perfil",         nombre: "Mi perfil",            icono: "perfil" },
];
