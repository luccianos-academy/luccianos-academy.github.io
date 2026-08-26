/* ============================
   Lucciano's Academy
   services/google.js

   Capa de integración con Google Apps Script + Sheets.
   GAS_URL vive en config.js. Mientras esté vacío, USE_MOCK_DATA
   (config.js) queda en true y nada de acá se llama en la práctica
   — services/dataSource.js es quien decide si pasar por acá o
   por los datos de muestra en memoria.

   Toda request (salvo el login, que lo emite) adjunta el token de
   sesión firmado — el backend lo verifica y resuelve el rol del que
   llama server-side. Si el backend responde que la sesión venció o no
   es válida, se cierra sesión y se vuelve al login desde acá mismo
   (único punto por el que pasan todas las llamadas, así no hay que
   tocar los 24 archivos de datos).
=============================*/

import { GAS_URL } from "../config.js";
import { getSessionToken, logout } from "./auth.js";

// Evita que varias requests concurrentes que fallan por sesión
// inválida disparen el redirect/reload más de una vez.
let redirigiendoPorSesion = false;

function manejarSesionInvalida() {
    if (redirigiendoPorSesion) return;
    redirigiendoPorSesion = true;
    logout();
    // Reload completo: garantiza estado limpio. El router, al no
    // encontrar sesión, manda solo a la pantalla de login.
    location.reload();
}

// Sin esto, un fetch que nunca resuelve (celular con señal
// intermitente, cambio de wifi a datos a mitad de request) dejaba el
// await colgado PARA SIEMPRE — nunca resuelve, nunca rechaza — así
// que el botón de "Guardando..."/"Marcar como leída" quedaba trabado
// sin remedio (reportado en vivo por el usuario probando en un
// celular real: "se le tildaba y no podía darle marcado"). Con esto,
// después de 20s el fetch se cancela solo y el error fluye por el
// mismo camino de siempre (el try/finally de modal.js reactiva el
// botón), en vez de colgar indefinidamente.
const TIMEOUT_REQUEST_MS = 20000;

export async function gasRequest(accion, payload = {}) {

    if (!GAS_URL) {
        console.warn(`[services/google] GAS_URL no configurada. Acción solicitada: ${accion}`);
        return null;
    }

    const controlador = new AbortController();
    const timeoutId = setTimeout(() => controlador.abort(), TIMEOUT_REQUEST_MS);

    let res;
    try {
        res = await fetch(GAS_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ accion, token: getSessionToken(), ...payload }),
            signal: controlador.signal,
        });
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error(`Se cortó la conexión mandando "${accion}" — probá de nuevo (revisá tu señal/wifi).`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        throw new Error(`Error en GAS request (${accion}): ${res.status}`);
    }

    const data = await res.json();

    // El backend marca así una sesión vencida/inválida (token faltante,
    // expirado, o usuario desactivado). Cortamos acá para todas las
    // acciones por igual.
    if (data && data.sesionInvalida) {
        manejarSesionInvalida();
        throw new Error("Sesión inválida");
    }

    return data;
}

// Hacer gasRequest y GAS_URL globales para que SyncManager pueda usarlos
window.gasRequest = gasRequest;
window.GAS_URL = GAS_URL;

export function obtenerDatosSheet(hoja) {
    return gasRequest("leer", { hoja });
}

export function guardarDatosSheet(hoja, fila) {
    return gasRequest("escribir", { hoja, fila });
}

export function actualizarDatosSheet(hoja, id, cambios) {
    return gasRequest("actualizar", { hoja, id, cambios });
}

export function eliminarDatosSheet(hoja, id) {
    return gasRequest("eliminar", { hoja, id });
}

/**
 * Manda el ID token CRUDO de Google Sign-In al backend (no el email —
 * antes se mandaba el email en texto plano, lo que permitía suplantar
 * a cualquiera sin siquiera tener una cuenta de Google). El backend
 * valida la firma del token contra Google, saca el email verificado y,
 * si el usuario existe y está activo, devuelve { ok, usuario, sessionToken }.
 */
export function verificarLoginGoogle(idToken) {
    return gasRequest("verificarLogin", { idToken });
}

/** Envío masivo de mail (ver components/mail.js) — mismo asunto/cuerpo
 *  para toda la lista de destinatarios. */
export function enviarMailReal(destinatarios, asunto, cuerpo) {
    return gasRequest("enviarMail", { destinatarios, asunto, cuerpo });
}

/** Push real (Firebase) a una lista de usuarios — el backend busca
 *  sus tokens en la hoja "Tokens" y les manda a todos sus
 *  dispositivos registrados (ver apps-script/Code.gs, enviarPush).
 *  Solo Admin/Supervisor — ver enviarPushGestionReal para el caso de
 *  Responsable de local/turno. */
export function enviarPushReal(usuarioIds, titulo, cuerpo, url) {
    return gasRequest("enviarPush", { usuarioIds, titulo, cuerpo, url });
}

/** Push real acotado a "Gestión semanal" — a diferencia de
 *  enviarPushReal, NO manda una lista de destinatarios: el backend la
 *  decide solo (los demás Responsables de la MISMA sucursal del que
 *  llama + Admin) — ver apps-script/Code.gs, enviarPushGestion. */
export function enviarPushGestionReal(titulo, cuerpo, url) {
    return gasRequest("enviarPushGestion", { titulo, cuerpo, url });
}

/** Guarda los días de UNA tarea para la sucursal de quien llama (Fase
 *  2 de Gestión semanal) — el backend decide de qué sucursal es la
 *  fila (usuarioActual.sucursal), nunca un valor que mande el
 *  cliente. Solo Responsable de local/turno pueden llamarla — ver
 *  apps-script/Code.gs, actualizarDiasGestionSucursal. */
export function actualizarDiasGestionSucursalReal(tareaId, dias, frecuencia) {
    return gasRequest("actualizarDiasGestionSucursal", { tareaId, dias, frecuencia });
}

/** Guarda (o borra, si hecho=false y sin sub-ítems) el check "hecho"
 *  de una tarea para MI sucursal y un día puntual — el backend decide
 *  de qué sucursal es la fila, mismo criterio que
 *  actualizarDiasGestionSucursalReal. Ver apps-script/Code.gs,
 *  actualizarCheckGestion.
 *
 *  subitemsMarcados (2026-08-26, opcional): string "0,2,4" con los
 *  índices tildados de una tarea con checklist — se guarda SIEMPRE,
 *  esté completa o no, para que el progreso a medio camino no se
 *  pierda al recargar la app. undefined para tareas simples (no
 *  toca esa columna). */
export function actualizarCheckGestionReal(tareaId, dia, hecho, subitemsMarcados) {
    return gasRequest("actualizarCheckGestion", { tareaId, dia, hecho, subitemsMarcados });
}
