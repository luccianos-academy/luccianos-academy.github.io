/* ============================
   Lucciano's Academy
   sw.js — Service worker: app instalable + funciona sin conexión

   Dos trabajos:
   1) Que la app abra SIN INTERNET. Guarda la propia app (HTML, JS, CSS, imágenes, fuentes) y el SDK de
      Firebase. Los DATOS no los guarda este archivo: de eso se ocupa la caché persistente de Firestore
      (services/firestoreLoader.js).
   2) Mostrar los push (más abajo).

   Estrategia, pensada para que NUNCA se vea una versión vieja teniendo internet:
   - Código de la app (HTML, JS, CSS, JSON): "red primero", con un tope de espera. Con señal siempre se baja lo
     último (y se guarda); sin señal, o si la red tarda más del tope (señal mala), se usa lo último que se guardó.
   - Imágenes y fuentes propias: "guardada primero y se renueva de fondo". Se muestran al instante desde el
     teléfono y se actualizan para la próxima vez. Antes cada imagen esperaba a la red, y eso se notaba.
   - SDK de Firebase y fuentes (direcciones con versión, no cambian): "caché primero".
   - Todo lo demás (Firestore, Auth, APIs de Google, fotos de Drive, video, audio) NO se toca.
=============================*/

const CACHE = "faro-app-v3";
// Hosts de terceros cuyos archivos son inmutables (la versión va en la URL).
const HOSTS_ESTATICOS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
// Esto es demasiado pesado para guardarlo en el teléfono.
const NO_GUARDAR = /\.(mp4|webm|mov|mp3|wav|m4a)(\?|$)/i;
// Archivos que casi nunca cambian: se sirven desde lo guardado y se renuevan de fondo.
const RENOVABLES = /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf)(\?|$)/i;
// Cuánto se espera a la red para el código antes de usar lo guardado (si hay).
const TOPE_RED_MS = 4000;

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((nombres) => Promise.all(nombres.filter((n) => n.startsWith("faro-") && n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

async function guardar(request, respuesta) {
    if (!respuesta || respuesta.status !== 200 || NO_GUARDAR.test(request.url)) return;
    // Se clona ANTES de cualquier await: si no, la página ya pudo empezar a leer el cuerpo y el clon falla.
    const copia = respuesta.clone();
    const cache = await caches.open(CACHE);
    await cache.put(request, copia);
}

/** fetch con tope: si la red no responde a tiempo se rechaza (y quien llama usa lo guardado). */
function fetchConTope(request, ms) {
    return new Promise((resolver, rechazar) => {
        const t = setTimeout(() => rechazar(new Error("timeout")), ms);
        fetch(request).then((r) => { clearTimeout(t); resolver(r); }, (e) => { clearTimeout(t); rechazar(e); });
    });
}

async function redPrimero(request) {
    try {
        // El tope solo vale si hay algo guardado a lo que recurrir; si no, se espera a la red lo que haga falta.
        const hayGuardada = await caches.match(request, { ignoreSearch: true });
        const respuesta = hayGuardada ? await fetchConTope(request, TOPE_RED_MS) : await fetch(request);
        guardar(request, respuesta).catch(() => {});
        return respuesta;
    } catch (err) {
        const guardada = await caches.match(request, { ignoreSearch: true });
        if (guardada) return guardada;
        // Una pantalla de la app (ruta con # o con ?): se abre con el index.html guardado.
        if (request.mode === "navigate") {
            const indice = (await caches.match("index.html", { ignoreSearch: true })) || (await caches.match("./", { ignoreSearch: true }));
            if (indice) return indice;
        }
        return new Response("Sin conexión", { status: 503, statusText: "Sin conexión" });
    }
}

async function guardadaYRenovar(request) {
    const guardada = await caches.match(request);
    const delante = fetch(request).then((r) => { guardar(request, r).catch(() => {}); return r; });
    if (guardada) { delante.catch(() => {}); return guardada; }
    return delante.catch(() => new Response("Sin conexión", { status: 503, statusText: "Sin conexión" }));
}

async function cachePrimero(request) {
    const guardada = await caches.match(request);
    if (guardada) return guardada;
    const respuesta = await fetch(request);
    guardar(request, respuesta).catch(() => {});
    return respuesta;
}

self.addEventListener("fetch", (evento) => {
    const request = evento.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        if (NO_GUARDAR.test(url.pathname)) return;      // video y audio: directo a la red
        evento.respondWith(RENOVABLES.test(url.pathname) ? guardadaYRenovar(request) : redPrimero(request));
    } else if (HOSTS_ESTATICOS.includes(url.hostname)) {
        evento.respondWith(cachePrimero(request));
    }
    // Cualquier otra cosa (Firestore, Auth, Drive...): sin respondWith, pasa tal cual.
});

/** La primera visita: los archivos que la página ya pidió ANTES de que este service worker tomara el control no
 *  pasaron por acá. La página (app.js) manda la lista y se guardan, así la app abre sin internet desde la primera vez. */
self.addEventListener("message", (evento) => {
    if (!evento.data || evento.data.tipo !== "guardar-recursos") return;
    const urls = (evento.data.urls || []).filter((u) => {
        try {
            const x = new URL(u);
            return (x.origin === self.location.origin && !NO_GUARDAR.test(x.pathname)) || HOSTS_ESTATICOS.includes(x.hostname);
        } catch (err) { return false; }
    });
    evento.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await Promise.all(urls.map(async (u) => {
            try {
                if (await cache.match(u)) return;
                const r = await fetch(u);
                if (r.status === 200) await cache.put(u, r);
            } catch (err) { /* sin red o archivo faltante: se reintenta en la próxima visita */ }
        }));
    })());
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
