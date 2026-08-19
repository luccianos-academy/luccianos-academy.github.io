/* ============================
   Lucciano's Academy
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";
import { bindTooltips } from "./services/tooltips.js";
import { protegerMedia } from "./services/protegerMedia.js";
import { bindAvatarFallback } from "./components/avatar.js";
import { iniciarChequeoDeVersion } from "./services/actualizacion.js";
import "./services/google.js"; // Cargar antes de syncManager
import "./services/indexeddb.js";
import "./services/syncManager.js";

// Wait for idbManager and syncManager to be available in window
async function waitForServices() {
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            if (window.idbManager && window.syncManager) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 50);
    });
}

async function initApp() {
    try {
        // Wait for services to be globally available
        await waitForServices();
        
        // IndexedDB SÍ se espera: es la caché local desde la que
        // fetchSheet lee, y sin ella la primera pantalla iría a la red
        // aunque los datos ya estuvieran guardados del uso anterior.
        console.log('[APP] Initializing IndexedDB...');
        await window.idbManager.init();

        // El sync NO se espera. Antes sí, y eso bloqueaba el arranque
        // entero detrás de una llamada de red que lee las 8 hojas: la
        // app no dibujaba nada hasta que volviera. Es justo al revés de
        // lo que la arquitectura offline-first promete — la gracia de
        // tener copia local es pintar YA con lo que hay y actualizar
        // después.
        //
        // No esperar es seguro: fetchSheet cae a la red por su cuenta si
        // la copia local está vacía (primer uso), así que lo peor que
        // pasa es lo que pasaba siempre. Y en cualquier arranque
        // posterior la pantalla sale al toque desde IndexedDB mientras
        // el sync se pone al día en segundo plano.
        console.log('[APP] Initializing Sync Manager (en segundo plano)...');
        window.syncManager.init().catch((err) => {
            console.warn('[APP] Sync en segundo plano falló:', err);
        });

        console.log('[APP] Initializing Router...');
        initRouter();
        bindTooltips();
        protegerMedia();
        // Antes de que se pinte cualquier avatar: si una foto no carga,
        // caer a las iniciales en vez del ícono de imagen rota.
        bindAvatarFallback();
        // Avisa si se publicó una versión nueva mientras la app estaba
        // abierta — instalada como PWA no hay forma de darse cuenta.
        iniciarChequeoDeVersion();
        
        console.log('[APP] ✅ App fully initialized');
    } catch (err) {
        console.error('[APP] ❌ Initialization error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Registra el service worker
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Expose debug utilities globally
window.lucciano = window.lucciano || {};
window.lucciano.debug = {
    getIndexedDBSize: () => window.idbManager?.getDBSize(),
    forceSyncNow: () => window.syncManager?.forceSyncNow(),
    clearLocalDB: () => window.idbManager?.clearAll(),
    getSyncStatus: () => window.syncManager?.getStatus(),
    exportDB: () => window.idbManager?.exportDB()
};

console.log('[APP] Debug tools available at window.lucciano.debug');
