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
   Firebase Cloud Messaging (push real) — muestra la notificación
   cuando llega un push CON LA APP CERRADA/en segundo plano (con la
   app abierta y en foco, Firebase la entrega directo a la página en
   vez de pasar por acá, no hace falta manejar ese caso).

   Un service worker clásico (este, registrado sin {type:"module"})
   no puede usar `import` — por eso `importScripts()` y por eso
   FIREBASE_CONFIG está repetido acá en vez de importado de config.js.
   Mantenerlo sincronizado a mano con js/config.js cuando exista el
   proyecto real (son valores públicos, no secretos, está bien que
   vivan en dos lugares).

   PENDIENTE: reemplazar por los valores reales una vez creado el
   proyecto Firebase — mientras apiKey esté vacío, initializeApp()
   tira, así que todo este bloque queda en un try/catch que no rompe
   el resto del service worker (fetch/install/activate siguen andando
   igual aunque push todavía no esté configurado).
------------------------------------------------------------------ */
try {
    importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyB6YJZebu7r_Nuk_daHElYUy5zBP1B-Rpk",
        authDomain: "lucciano-s-academy-web.firebaseapp.com",
        projectId: "lucciano-s-academy-web",
        storageBucket: "lucciano-s-academy-web.firebasestorage.app",
        messagingSenderId: "1008760177490",
        appId: "1:1008760177490:web:62f272f1ff8af4cf68708b",
    };

    if (FIREBASE_CONFIG.apiKey) {
        firebase.initializeApp(FIREBASE_CONFIG);
        const messaging = firebase.messaging();

        messaging.onBackgroundMessage((payload) => {
            const { title, body, icon } = payload.notification || {};
            self.registration.showNotification(title || "Lucciano's Academy", {
                body: body || "",
                icon: icon || "assets/icons/icon-192.png",
                badge: "assets/icons/icon-192.png",
                data: payload.data || {},
            });
        });
    }
} catch (err) {
    // No hay proyecto Firebase configurado todavía, u otro error de
    // red al cargar el SDK — el resto del service worker sigue
    // funcionando normal (instalabilidad de la PWA no depende de esto).
}

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
