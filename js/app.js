/* ============================
   FARO v4
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";
import { bindTooltips } from "./services/tooltips.js";
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
        
        console.log('[APP] Initializing IndexedDB...');
        await window.idbManager.init();
        
        console.log('[APP] Initializing Sync Manager...');
        await window.syncManager.init();
        
        console.log('[APP] Initializing Router...');
        initRouter();
        bindTooltips();
        
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
