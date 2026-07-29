/* ============================
   FARO v4
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";

document.addEventListener("DOMContentLoaded", initRouter);

// Registra el service worker mínimo (ver sw.js) — necesario en Android/
// Chrome para que dispare beforeinstallprompt (ver services/
// installPrompt.js), y es quien maneja push (fetch/install/activate/
// push todos viven ahí — ver sw.js). Si falla (http sin TLS, navegador
// sin soporte), no rompe nada — el banner de instalar simplemente no
// aparece, y push queda no disponible.
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
