/* ============================
   FARO v4
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

async function gasRequest(accion, payload = {}) {

    if (!GAS_URL) {
        console.warn(`[services/google] GAS_URL no configurada. Acción solicitada: ${accion}`);
        return null;
    }

    const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion, token: getSessionToken(), ...payload }),
    });

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
