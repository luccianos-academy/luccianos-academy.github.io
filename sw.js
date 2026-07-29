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
 *  el link directo a la publicación/noticia que lo disparó. Llega como
 *  ruta relativa tipo "#/news" (ver mandarPushDeNoticia en
 *  pages/news.js), NO como URL absoluta.
 *
 *  Bug real encontrado (2026-07-29, con captura de un usuario real): un
 *  string relativo como "#/news" pasado directo a self.clients.openWindow()
 *  se resuelve contra la ubicación del PROPIO service worker (sw.js),
 *  no contra la raíz de la app — terminaba abriendo ".../sw.js#/news",
 *  que el navegador sirve como texto plano (el código fuente crudo del
 *  archivo). Resolverlo explícitamente contra self.registration.scope
 *  (la raíz real de la app) lo arregla para cualquier ruta relativa que
 *  se mande, hoy o en el futuro. */
self.addEventListener("notificationclick", (evento) => {
    evento.notification.close();
    const url = new URL(evento.notification.data?.url || "/", self.registration.scope).href;
    evento.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
            const existente = clientes.find((c) => "focus" in c);
            if (existente) {
                return "navigate" in existente ? existente.navigate(url).then((c) => c.focus()) : existente.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});
