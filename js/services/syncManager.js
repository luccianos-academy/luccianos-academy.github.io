// Sync Manager for Lucciano's Academy
// Handles intelligent synchronization between IndexedDB (local) and Apps Script (backend)

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.syncIntervalHandle = null;
    this.offlineMode = !navigator.onLine;
    this.lastSyncError = null;
  }

  // Initialize sync manager
  async init() {
    // Desactivar sync si GAS_URL no está configurado (modo desarrollo)
    if (typeof window.GAS_URL === 'undefined' || !window.GAS_URL) {
      console.log('[SYNC] GAS_URL no configurada - sync desactivado');
      return;
    }

    if (!idbManager.db) {
      await idbManager.init();
    }

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Initial sync on app start
    await this.syncWithBackend();

    // Set up periodic sync
    this.syncIntervalHandle = setInterval(() => {
      this.syncWithBackend().catch(err => {
        console.error('[SYNC] Periodic sync failed:', err);
      });
    }, this.syncInterval);

    console.log('[SYNC] Manager initialized');
  }

  // Main sync function
  async syncWithBackend() {
    if (this.isSyncing) {
      console.log('[SYNC] Sync already in progress, skipping...');
      return;
    }

    if (this.offlineMode) {
      console.log('[SYNC] Offline mode - skipping server sync');
      return;
    }

    this.isSyncing = true;
    console.log('[SYNC] Starting sync...');
    const startTime = Date.now();

    try {
      // No hay cola de subida: toda escritura (crear/editar/borrar) ya
      // va directo al backend en el momento, desde services/
      // dataSource.js. Acá solo se baja y se reemplaza la copia local.
      const lastSync = await idbManager.getLastSyncTime();
      const delta = await this.fetchDelta(lastSync);

      if (delta && delta.data) {
        await this.mergeDelta(delta.data);
        await idbManager.setLastSyncTime(delta.timestamp || Date.now());

        const elapsed = Date.now() - startTime;
        const itemCount = Object.values(delta.data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
        console.log(`[SYNC] Completed in ${elapsed}ms - ${itemCount} registros`);
      } else {
        console.log('[SYNC] Sin respuesta del servidor — copia local intacta');
      }

      this.lastSyncError = null;
    } catch (error) {
      this.lastSyncError = error;
      console.error('[SYNC] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Esperar a que window.gasRequest esté disponible
  async waitForGasRequest() {
    return new Promise(resolve => {
      const check = () => {
        if (typeof window.gasRequest === 'function') {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // Fetch delta from Apps Script (only changes since lastSync)
  async fetchDelta(lastSyncTime) {
    try {
      // Esperar a que gasRequest esté disponible
      if (typeof window.gasRequest !== 'function') {
        await this.waitForGasRequest();
      }

      const response = await window.gasRequest('sync', {
        lastSync: lastSyncTime,
        action: 'syncDelta'
      });

      if (response && response.ok) {
        return {
          data: response.data,
          timestamp: response.timestamp
        };
      }
      return null;
    } catch (error) {
      console.error('[SYNC] Failed to fetch delta:', error);
      throw error;
    }
  }

  // Reemplaza la copia local con la del servidor, hoja por hoja.
  //
  // ANTES esto solo agregaba/pisaba los registros del delta, sin sacar
  // nunca nada — por eso un registro borrado en la hoja (o desde otro
  // dispositivo) seguía vivo para siempre en la copia local, y una
  // edición hecha a mano en el Sheet no llegaba nunca. Ahora el
  // servidor manda la hoja entera (ver sync() en apps-script/Code.gs) y
  // acá se reemplaza, así lo que ya no está en la hoja desaparece.
  //
  // Solo se tocan las hojas que el servidor realmente incluyó en la
  // respuesta: las que no sincroniza (sucursales, canales, recursos,
  // etc.) se dejan intactas en vez de vaciarlas por error.
  async mergeDelta(delta) {
    for (const [storeName, records] of Object.entries(delta)) {
      if (!Array.isArray(records)) continue;
      if (!idbManager.stores.includes(storeName)) continue;

      await idbManager.clearStore(storeName);
      if (records.length > 0) await idbManager.saveRecords(storeName, records);
      console.log(`[SYNC] ${storeName}: copia local reemplazada (${records.length} registros)`);
    }
  }

  // Handle coming online
  async handleOnline() {
    console.log('[SYNC] Device came online');
    this.offlineMode = false;
    await this.syncWithBackend();
  }

  // Handle going offline
  handleOffline() {
    console.log('[SYNC] Device went offline - operating in local mode');
    this.offlineMode = true;
  }

  // Force immediate sync (for debugging)
  async forceSyncNow() {
    console.log('[SYNC] Force sync requested');
    await this.syncWithBackend();
  }

  // Get sync status
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      offlineMode: this.offlineMode,
      lastSyncError: this.lastSyncError ? this.lastSyncError.message : null,
      lastSync: idbManager.getLastSyncTime()
    };
  }

  // Cleanup
  destroy() {
    if (this.syncIntervalHandle) {
      clearInterval(this.syncIntervalHandle);
    }
    window.removeEventListener('online', () => this.handleOnline());
    window.removeEventListener('offline', () => this.handleOffline());
  }
}

// Global instance
window.syncManager = new SyncManager();

// Initialize when document is ready
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => {
//     syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
//   });
// } else {
//   syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
// }
