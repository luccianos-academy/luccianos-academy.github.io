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
 *  nueva. */
export async function registrarToken(usuarioId, token) {
    const existentes = await getTokens();
    if (existentes.some((t) => t.token === token)) return;
    return writeSheet(HOJAS.TOKENS, {
        usuarioId, token, creadoEn: new Date().toISOString(),
    }, tokensMock);
}

/** El backend llama esto (vía acción propia, no desde el cliente)
 *  cuando FCM devuelve "unregistered"/"invalid" para un token —
 *  limpiarlo evita seguir intentando mandarle push para siempre. */
export async function eliminarToken(id) {
    return deleteSheet(HOJAS.TOKENS, id, tokensMock);
}
