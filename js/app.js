/* ============================
   FARO v4
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";
import { iniciarEscuchaForeground } from "./services/push.js";

document.addEventListener("DOMContentLoaded", initRouter);

// Registra el service worker mínimo (ver sw.js) — necesario en Android/
// Chrome para que dispare beforeinstallprompt (ver services/
// installPrompt.js). Si falla (http sin TLS, navegador sin soporte),
// no rompe nada — el banner de instalar simplemente no aparece.
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Push con la pestaña abierta y en foco (ver services/push.js) — no
// hace nada si el permiso todavía no fue otorgado.
iniciarEscuchaForeground();
