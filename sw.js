/* ============================
   FARO v4
   sw.js — Service worker mínimo

   No cachea nada a propósito (los datos vienen de Google Sheets vía
   Apps Script — cachear rompería la app mostrando datos viejos). Su
   único trabajo es existir con un handler de "fetch": Chrome usa eso
   como criterio de instalabilidad para disparar beforeinstallprompt
   (ver services/installPrompt.js) — sin esto, en Android el banner
   de "Instalá la app" nunca tiene nada real para ofrecer.
=============================*/

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
    // Sin respondWith: deja pasar el request tal cual, sin cachear.
});

/* ----------------------------------------------------------------
   Push real (Firebase Cloud Messaging) — muestra la notificación
   cuando llega un push CON LA APP CERRADA/en segundo plano (con la
   app abierta y en foco, Firebase la entrega directo a la página, ver
   services/push.js → iniciarEscuchaForeground).

   A propósito NO usa el SDK de Firebase acá adentro (antes cargaba
   firebase-messaging-compat.js e inicializaba firebase.messaging(),
   todo envuelto en un try/catch que se tragaba cualquier error en
   silencio). getToken() del lado de la página ya deja todo lo que
   hace falta: una PushSubscription real asociada a ESTE service
   worker. De ahí en más, la entrega es 100% Web Push estándar del
   navegador — un evento "push" nativo — y no depende en nada de que
   el SDK de Firebase haya cargado bien acá adentro. Con el SDK, un
   fallo silencioso de importScripts()/initializeApp() (red, CSP,
   versión del SDK, lo que sea) significaba CERO manejador de push
   registrado y CERO notificaciones, en cualquier dispositivo, sin
   ningún error visible — exactamente el bug que costó horas de
   diagnóstico encontrar. Este handler nativo no tiene ese punto único
   de falla.
------------------------------------------------------------------ */
self.addEventListener("push", (evento) => {
    if (!evento.data) return;

    let payload;
    try {
        payload = evento.data.json();
    } catch (err) {
        return;
    }

    const datosNotif = payload.notification || {};
    evento.waitUntil(
        self.registration.showNotification(datosNotif.title || "Lucciano's Academy", {
            body: datosNotif.body || "",
            icon: datosNotif.icon || "assets/icons/icon-192.png",
            badge: "assets/icons/icon-192.png",
            data: payload.data || {},
        })
    );
});

/** Click en la notificación → enfoca una pestaña ya abierta de la app
 *  si existe, o abre una nueva. `data.url` lo arma el backend al
 *  mandar el push (ver apps-script/Code.gs, enviarPush) — normalmente
 *  el link directo a la publicación/noticia que lo disparó. */
self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const url = evento.notification.data?.url || "/";
    evento.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
            for (const c of clientes) {
                if ("focus" in c) return c.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});
