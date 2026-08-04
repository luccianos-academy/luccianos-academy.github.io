/* ============================
   FARO v4
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";
import { bindTooltips } from "./services/tooltips.js";
import { idbManager } from "./services/indexeddb.js";  // IndexedDB manager (auto-init)
import { syncManager } from "./services/syncManager.js"; // Sync manager (auto-init)

document.addEventListener("DOMContentLoaded", () => {
    initRouter();
    bindTooltips();
});

// Registra el service worker mínimo (ver sw.js) — necesario en Android/
// Chrome para que dispare beforeinstallprompt (ver services/
// installPrompt.js), y es quien maneja push (fetch/install/activate/
// push todos viven ahí — ver sw.js). Si falla (http sin TLS, navegador
// sin soporte), no rompe nada — el banner de instalar simplemente no
// aparece, y push queda no disponible.
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Expose debug utilities globally
window.lucciano = window.lucciano || {};
window.lucciano.debug = {
    getIndexedDBSize: () => idbManager?.getDBSize(),
    forceSyncNow: () => syncManager?.forceSyncNow(),
    clearLocalDB: () => idbManager?.clearAll(),
    getSyncStatus: () => syncManager?.getStatus(),
    exportDB: () => idbManager?.exportDB()
};

console.log('[APP] Debug tools available at window.lucciano.debug');
