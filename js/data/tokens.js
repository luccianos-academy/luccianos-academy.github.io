/* ============================
   Lucciano's Academy
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
import { actualizarUsuario } from "./usuarios.js";
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

/** Los dispositivos con push de la persona que tiene la sesión abierta. NO sirve para saber quién más tiene push: eso lo dice
 *  `tienePush` en cada fila de Usuarios (leer los tokens de todos costaba un documento por dispositivo en cada apertura). */
export async function getMisTokens() {
    try {
        const filas = await fetchSheet(HOJAS.TOKENS, tokensMock);
        return filas.map(normalizarToken);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.TOKENS}':`, err.message);
        return [];
    }
}

/** No duplica: si ese mismo token ya está registrado (puede pasar si
 *  el navegador lo re-emite sin haber cambiado nada), no crea fila
 *  nueva. "usuarioNombre" es solo para que la Sheet se lea a simple
 *  vista (quién es cada fila) — el envío real sigue usando usuarioId,
 *  el nombre no se usa para nada funcional.
 *
 *  `yaMarcado`: la sesión ya sabe que la persona figura con push (`usuario.tienePush`); si no, se deja la marca en su
 *  fila de Usuarios (una escritura, una sola vez) para que Admin/Supervisor la vean sin leer los tokens. */
export async function registrarToken(usuarioId, token, usuarioNombre, yaMarcado = false) {
    const existentes = await getMisTokens();
    if (!existentes.some((t) => t.token === token)) {
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
    if (!yaMarcado) {
        try { await actualizarUsuario(usuarioId, { tienePush: "SI" }); }
        catch (err) { console.warn("No se pudo dejar la marca de push en el usuario:", err.message); }     // el token ya quedó: la marca se reintenta en la próxima apertura
    }
}

/** El backend llama esto (vía acción propia, no desde el cliente)
 *  cuando FCM devuelve "unregistered"/"invalid" para un token —
 *  limpiarlo evita seguir intentando mandarle push para siempre. */
export async function eliminarToken(id) {
    return deleteSheet(HOJAS.TOKENS, id, tokensMock);
}
