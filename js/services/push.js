/* ============================
   FARO v4
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
import { enviarPushReal } from "./google.js";

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

        await registrarToken(usuario.id, token);
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

/** Muestra un push que llega con la pestaña ABIERTA Y EN FOCO —
 *  distinto del caso "segundo plano" que ya maneja sw.js. Firebase
 *  entrega el mensaje por un camino totalmente separado en este caso
 *  (evento "onMessage" del SDK en la página, no pasa por el service
 *  worker) — sin este listener, un push llegaba "en silencio" mientras
 *  se estaba mirando la pestaña, que es exactamente cuando alguien lo
 *  nota menos. Se llama una vez al arrancar la app (app.js), y no hace
 *  nada si todavía no se activó el permiso — no tiene sentido
 *  inicializar Firebase para alguien que nunca lo aceptó. */
export function iniciarEscuchaForeground() {
    if (!soportaPush() || Notification.permission !== "granted") return;
    try {
        inicializarFirebase();
        firebase.messaging().onMessage((payload) => {
            const { title, body } = payload.notification || {};
            navigator.serviceWorker.ready.then((registro) => {
                registro.showNotification(title || "Lucciano's Academy", {
                    body: body || "",
                    icon: "assets/icons/icon-192.png",
                    badge: "assets/icons/icon-192.png",
                    data: payload.data || {},
                });
            });
        });
    } catch (err) {
        console.warn("No se pudo iniciar la escucha de push en primer plano:", err.message);
    }
}
