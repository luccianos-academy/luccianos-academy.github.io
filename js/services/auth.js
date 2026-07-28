/* ============================
   FARO v4
   services/auth.js

   Sesión y permisos según el organigrama del blueprint:

   Administrador > Supervisor > Colaborador

   "Encargado" NO es un rol aparte — es un atributo (booleano)
   que puede tener un Colaborador, según el póster del proyecto.

   login() recibe los datos ya verificados (Google + "Usuarios"
   en Sheets, o el picker de roles mientras no hay backend real
   — ver pages/login.js) — acá solo se persiste la sesión.
=============================*/

import { setItem, getItem, removeItem, existe } from "./storage.js";

const SESSION_KEY = "sesion";
const VISTA_COMO_KEY = "vista_como";
// Token de sesión firmado que emite el backend en el login (ver
// apps-script/Code.gs). Viaja en cada request a Sheets como prueba de
// identidad — el backend lo verifica y resuelve el rol server-side, en
// vez de confiar en el rol que guarda la sesión (que es falsificable).
// En modo demo (USE_MOCK_DATA) no existe backend, así que queda vacío
// y nunca se usa.
const SESSION_TOKEN_KEY = "session_token";

export const JERARQUIA_ROLES = {
    colaborador: 0,
    supervisor: 1,
    admin: 2,
};

export const ROLES = [
    { id: "admin",       nombre: "Administrador", descripcion: "Acceso completo a la plataforma" },
    { id: "supervisor",  nombre: "Supervisor",     descripcion: "Gestiona los colaboradores de su sucursal" },
    { id: "colaborador", nombre: "Colaborador",    descripcion: "Accede a su formación" },
];

export function login(usuario, sessionToken) {
    setItem(SESSION_KEY, usuario);
    // En login real (Google), el backend devuelve un token; en el
    // picker de roles de muestra no hay backend, así que llega
    // undefined y no se guarda nada (modo demo no lo necesita).
    if (sessionToken) setItem(SESSION_TOKEN_KEY, sessionToken);
    removeItem(VISTA_COMO_KEY);
    return usuario;
}

export function logout() {
    removeItem(SESSION_KEY);
    removeItem(SESSION_TOKEN_KEY);
    removeItem(VISTA_COMO_KEY);
}

/** Token firmado del login real, para adjuntar a cada request al
 *  backend (ver services/google.js). El token siempre es del usuario
 *  REAL, incluso durante "Ver como" — la identidad verificada no
 *  cambia por impersonar a otro en la UI. */
export function getSessionToken() {
    return getItem(SESSION_TOKEN_KEY, null);
}

export function haySesion() {
    return existe(SESSION_KEY);
}

/**
 * El usuario que efectivamente ve la pantalla: si un admin activó
 * "Ver como" (verComo), devuelve ese usuario en vez del admin real
 * — así el resto de la app (sidebar, permisos, datos) no necesita
 * saber que existe esta función, simplemente ve "otro usuario
 * logueado". getUsuarioReal() sigue disponible para el banner de
 * "Viendo como" y para volver.
 */
export function getUsuarioActual() {
    const real = getItem(SESSION_KEY, null);
    if (real && real.rol === "admin") {
        const vistaComo = getItem(VISTA_COMO_KEY, null);
        if (vistaComo) return vistaComo;
    }
    return real;
}

export function getUsuarioReal() {
    return getItem(SESSION_KEY, null);
}

/** Admin activa una vista temporal como otro usuario, sin cerrar su propia sesión. */
export function verComo(usuario) {
    setItem(VISTA_COMO_KEY, usuario);
}

/** Usuario que se está "viendo" actualmente (o null si no hay ninguno activo). */
export function estaViendoComo() {
    const real = getItem(SESSION_KEY, null);
    if (!real || real.rol !== "admin") return null;
    return getItem(VISTA_COMO_KEY, null);
}

export function volverAAdmin() {
    removeItem(VISTA_COMO_KEY);
}

/**
 * true si el usuario en sesión tiene un rol igual o superior
 * al rol requerido, según JERARQUIA_ROLES.
 */
export function tienePermiso(rolRequerido) {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    const nivelUsuario = JERARQUIA_ROLES[usuario.rol] ?? -1;
    const nivelRequerido = JERARQUIA_ROLES[rolRequerido] ?? 0;
    return nivelUsuario >= nivelRequerido;
}

/**
 * Qué aparece en el menú lateral para cada rol. Encargado (un
 * colaborador con encargado=true) no tiene una entrada propia acá
 * — services/../components/sidebar.js le suma "colaboradores"
 * ("Mi local") por encima de esta lista, sin agregar un 4to rol.
 */
export const MENU_POR_ROL = {
    // "historia"/"evaluaciones"/"reportes"/"alertas"/"integraciones" NO
    // están acá — dejaron de ser accesos directos del sidebar y ahora
    // se llega a ellos desde el hub de "configuracion" (ver
    // pages/configuracion.js), para no tener 15 ítems sueltos en el
    // menú. Siguen siendo rutas reales con el mismo PERMISOS_PAGINA de
    // siempre, solo cambia desde dónde se linkean.
    // "news" tampoco está acá a propósito: ese contenido se ve desde
    // la campana (components/topbar.js → #/news), no como ítem de
    // menú — un solo lugar en vez de dos. La ruta sigue abierta para
    // cualquier autenticado (no tiene entrada en PERMISOS_PAGINA).
    admin: [
        "inicio", "dashboard", "colaboradores", "supervisores", "locales",
        "academia", "coordinacionoperativa", "manuales", "configuracion", "perfil",
    ],
    supervisor:  ["inicio", "colaboradores", "coordinacionoperativa", "historia", "cursos", "manuales", "perfil"],
    colaborador: ["inicio", "historia", "cursos", "manuales", "perfil"],
};

/**
 * Gating real de acceso a cada página — distinto de MENU_POR_ROL
 * (que solo decide qué se VE en el menú). Evita que alguien llegue
 * a una pantalla que no le corresponde tipeando el hash directo.
 * Las páginas que no aparecen acá (inicio, perfil) quedan abiertas
 * a cualquier usuario autenticado.
 */
const PERMISOS_PAGINA = {
    dashboard:      ["admin"],
    supervisores:   ["admin"],
    locales:        ["admin"],
    academia:       ["admin"],
    evaluaciones:   ["admin"],
    reportes:       ["admin"],
    alertas:        ["admin"],
    configuracion:  ["admin"],
    integraciones:  ["admin"],
    colaboradores:  ["admin", "supervisor"],
    // "Coordinación Operativa" es Admin ↔ Supervisor (incluye
    // Capacitador, que es rol "supervisor") — Colaborador no
    // participa. A diferencia de "news", esto SÍ necesita entrada
    // acá: sin ella, cualquier autenticado (incluido Colaborador)
    // podría entrar tipeando el hash.
    coordinacionoperativa: ["admin", "supervisor"],
    cursos:         ["admin", "colaborador", "supervisor"],
    examen:         ["admin", "colaborador"],
};

export function puedeAccederA(pagina) {
    const usuario = getUsuarioActual();
    if (!usuario) return false;
    // Encargado (colaborador con encargado=true) suma acceso a la
    // pantalla de equipo, acotada a su sucursal — ver pages/colaboradores.js.
    if (pagina === "colaboradores" && usuario.rol === "colaborador" && usuario.encargado) return true;
    const rolesPermitidos = PERMISOS_PAGINA[pagina];
    if (!rolesPermitidos) return true;
    return rolesPermitidos.includes(usuario.rol);
}
