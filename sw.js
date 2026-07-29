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
   cuando llega un push CON LA APP CERRADA/en segundo plano.

   A propósito NO usa el SDK de Firebase acá adentro — getToken() del
   lado de la página ya deja todo lo que hace falta: una
   PushSubscription real asociada a ESTE service worker. De ahí en
   más, la entrega es 100% Web Push estándar del navegador — un
   evento "push" nativo.

   A propósito el backend manda un "data message" (todo adentro de
   payload.data, ver apps-script/Code.gs → _enviarUnPush), NO un
   "notification message" (payload.notification). Un mensaje CON
   "notification" espera que el SDK de Firebase lo decodifique acá
   adentro con su formato interno propio — sin ese SDK cargado, podía
   llegar el push y quedar sin mostrarse, sin ningún error visible
   (probablemente la causa real de por qué no llegaba nada a ningún
   dispositivo). Un "data message" es JSON plano, sin ninguna magia
   de por medio — por eso acá se lee de payload.data, no de
   payload.notification.
------------------------------------------------------------------ */
self.addEventListener("push", (evento) => {
    if (!evento.data) return;

    let payload;
    try {
        payload = evento.data.json();
    } catch (err) {
        return;
    }

    const datos = payload.data || payload; // por las dudas llegue "plano"
    evento.waitUntil(
        self.registration.showNotification(datos.title || "Lucciano's Academy", {
            body: datos.body || "",
            icon: "assets/icons/icon-192.png",
            badge: "assets/icons/icon-192.png",
            data: { url: datos.url || "/" },
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
