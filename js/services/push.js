/* ============================
   Lucciano's Academy
   services/push.js — Suscripción a notificaciones push (Firebase)

   Tres pasos, en orden: (1) el navegador tiene que soportar
   Notification/Service Worker, (2) la persona tiene que aceptar el
   permiso nativo, (3) recién ahí Firebase entrega un "token" que se
   guarda en la hoja "Tokens" (data/tokens.js) — el backend usa esos
   tokens para mandar el push de verdad (ver apps-script/Code.gs,
   enviarPush).

   Mientras PUSH_DISPONIBLE sea false (config.js — no hay proyecto
   Firebase real todavía) o USE_MOCK_DATA sea true (modo demo), todo
   acá es un no-op silencioso: no tiene sentido pedir permiso de
   notificaciones para un push que después nadie puede mandar.
=============================*/

import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, PUSH_DISPONIBLE, USE_MOCK_DATA } from "../config.js";
import { registrarToken } from "../data/tokens.js";
import { enviarPushReal, enviarPushGestionReal } from "./google.js";

let appInicializada = false;

function inicializarFirebase() {
    if (appInicializada) return;
    if (typeof firebase === "undefined") throw new Error("SDK de Firebase no cargó (ver index.html).");
    firebase.initializeApp(FIREBASE_CONFIG);
    appInicializada = true;
}

/** true si el navegador puede recibir push en absoluto — antes de
 *  mostrar cualquier botón/toggle en la UI, chequear esto primero. */
export function soportaPush() {
    return PUSH_DISPONIBLE && !USE_MOCK_DATA && "Notification" in window && "serviceWorker" in navigator;
}

/** Estado actual del permiso, sin pedir nada — "default" (nunca se
 *  preguntó), "granted" o "denied" (el usuario ya decidió, un botón
 *  no puede volver a preguntarle: eso lo maneja el navegador). */
export function estadoPermisoPush() {
    if (!("Notification" in window)) return "no-soportado";
    return Notification.permission;
}

/** Re-registra el token en segundo plano, SIN pedir el permiso de
 *  nuevo — pensado para correr solo en cada carga de la app (ver
 *  app.js), no desde ningún botón. Pedido explícito (2026-09-02,
 *  reportado en vivo por un Responsable de local vía WhatsApp): "el
 *  push no me llega, tuve que volver a entrar a la app". Causa real:
 *  el token se registra UNA sola vez (al activar el permiso) y nunca
 *  más — si el navegador lo revoca, el service worker se reinstala, o
 *  el celular limpió datos del sitio por inactividad, el permiso
 *  nativo sigue en "granted" pero el token real quedó viejo/inválido,
 *  y nadie se entera hasta entrar a Mi Perfil y notar "Reintentar".
 *  Mientras tanto, los push simplemente no llegan.
 *
 *  Nunca pide permiso (si está en "default"/"denied" no hace nada —
 *  eso sigue siendo decisión explícita de la persona, vía el banner o
 *  Mi Perfil) y nunca interrumpe nada si falla: registrarToken() ya es
 *  idempotente (no duplica si el token no cambió), así que llamar esto
 *  en cada carga es seguro y barato. */
export async function revalidarPushSiYaEstaConcedido(usuario) {
    if (!usuario || !soportaPush() || estadoPermisoPush() !== "granted") return;
    try {
        inicializarFirebase();
        const registro = await navigator.serviceWorker.ready;
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registro });
        if (token) await registrarToken(usuario.id, token, usuario.nombre);
    } catch (err) {
        // Silencioso a propósito — corre en segundo plano en CADA carga
        // de la app, sin botón ni feedback visual. Si el token sigue
        // sin registrarse, Mi Perfil ya lo detecta (chequea la hoja
        // Tokens real, no el permiso) y ofrece "Reintentar".
        console.warn("No se pudo revalidar el token de push:", err.message);
    }
}

/** Pide el permiso nativo y, si lo acepta, registra el token para
 *  este usuario. Devuelve {ok, motivo} en vez de tirar — la UI que
 *  llama a esto decide qué mostrar según el motivo (denegado por el
 *  usuario vs no soportado vs error real). */
export async function activarPush(usuario) {
    if (!soportaPush()) return { ok: false, motivo: "no-soportado" };

    try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") return { ok: false, motivo: "denegado" };

        inicializarFirebase();
        // app.js ya registró sw.js al arrancar la app — reusar ESE
        // registro (en vez de llamar a register() de nuevo acá) evita
        // una segunda entrada de service worker para el mismo scope.
        const registro = await navigator.serviceWorker.ready;
        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: registro });
        if (!token) return { ok: false, motivo: "sin-token" };

        await registrarToken(usuario.id, token, usuario.nombre);
        return { ok: true };
    } catch (err) {
        console.warn("No se pudo activar push:", err.message);
        return { ok: false, motivo: "error", detalle: err.message };
    }
}

/** Mandar push a una lista de usuarios — lo llama quien publica un
 *  aviso (ej. Coordinación Operativa, News), no es un botón suelto en
 *  ningún lado todavía. No-op silencioso en modo demo (mismo criterio
 *  que services/mail.js: no tiene sentido simular un push falso). */
export async function mandarPush(usuarioIds, titulo, cuerpo, url) {
    if (USE_MOCK_DATA || !usuarioIds.length) return { ok: false, error: "No disponible en modo demo." };
    return enviarPushReal(usuarioIds, titulo, cuerpo, url);
}

/** "Enviar push" desde Gestión semanal (#/gestion) — a diferencia de
 *  mandarPush, no recibe destinatarios: el backend los decide solo
 *  (ver enviarPushGestion en Code.gs). Así lo puede llamar cualquier
 *  Responsable de local/turno sin poder abusarlo para avisarle a
 *  gente ajena a su local. */
export async function mandarPushGestion(titulo, cuerpo, url) {
    if (USE_MOCK_DATA) return { ok: false, error: "No disponible en modo demo." };
    return enviarPushGestionReal(titulo, cuerpo, url);
}

