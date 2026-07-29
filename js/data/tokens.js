/* ============================
   FARO v4
   data/tokens.js — Tabla "Tokens" (push real, Firebase Cloud Messaging)

   Un dispositivo/navegador que aceptó notificaciones se identifica
   con un "token" que entrega Firebase (services/push.js lo pide y lo
   guarda acá). Una misma persona puede tener más de un token (celular
   + PC) — por eso es una fila por token, no una columna en Usuarios.

   El backend (Code.gs) es quien manda el push de verdad: lee los
   tokens de los destinatarios de acá y le pega a la API de FCM. Este
   archivo solo administra el registro/borrado de tokens, no envía
   nada.
=============================*/

import { fetchSheet, writeSheet, deleteSheet } from "../services/dataSource.js";
import { tokensMock } from "./mock/tokens.mock.js";
import { HOJAS } from "../config.js";

function normalizarToken(f) {
    return {
        id: f.id,
        usuarioId: f.usuarioId,
        usuarioNombre: String(f.usuarioNombre || "").trim(),
        token: String(f.token || "").trim(),
        creadoEn: String(f.creadoEn || "").trim(),
    };
}

export async function getTokens() {
    try {
        const filas = await fetchSheet(HOJAS.TOKENS, tokensMock);
        return filas.map(normalizarToken);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.TOKENS}':`, err.message);
        return [];
    }
}

export async function getTokensDeUsuario(usuarioId) {
    const todos = await getTokens();
    return todos.filter((t) => String(t.usuarioId) === String(usuarioId));
}

/** Para mandar un push a varias personas de una — un solo fetch en
 *  vez de N llamadas a getTokensDeUsuario. */
export async function getTokensDeUsuarios(usuarioIds) {
    const ids = usuarioIds.map(String);
    const todos = await getTokens();
    return todos.filter((t) => ids.includes(String(t.usuarioId)));
}

/** No duplica: si ese mismo token ya está registrado (puede pasar si
 *  el navegador lo re-emite sin haber cambiado nada), no crea fila
 *  nueva. "usuarioNombre" es solo para que la Sheet se lea a simple
 *  vista (quién es cada fila) — el envío real sigue usando usuarioId,
 *  el nombre no se usa para nada funcional. */
export async function registrarToken(usuarioId, token, usuarioNombre) {
    const existentes = await getTokens();
    if (existentes.some((t) => t.token === token)) return;
    const resultado = await writeSheet(HOJAS.TOKENS, {
        usuarioId, usuarioNombre: usuarioNombre || "", token, creadoEn: new Date().toISOString(),
    }, tokensMock);
    // writeSheet no tira sola ante un rechazo del backend (ej. permiso
    // faltante en PERMISOS_ESCRITURA) — sin este chequeo, activarPush()
    // reportaba "ok:true" aunque el token nunca se haya guardado de
    // verdad. Tirar acá deja que el try/catch de activarPush() lo
    // detecte como falla real.
    if (resultado && resultado.ok === false) {
        throw new Error(resultado.error || "No se pudo registrar el token de push.");
    }
}

/** El backend llama esto (vía acción propia, no desde el cliente)
 *  cuando FCM devuelve "unregistered"/"invalid" para un token —
 *  limpiarlo evita seguir intentando mandarle push para siempre. */
export async function eliminarToken(id) {
    return deleteSheet(HOJAS.TOKENS, id, tokensMock);
}
