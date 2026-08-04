// Sync Manager for Lucciano's Academy
// Handles intelligent synchronization between IndexedDB (local) and Apps Script (backend)

import { gasRequest } from "./google.js";
import { idbManager } from "./indexeddb.js";

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.syncIntervalHandle = null;
    this.pendingChanges = [];
    this.offlineMode = !navigator.onLine;
    this.lastSyncError = null;
  }

  // Initialize sync manager
  async init() {
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
      const lastSync = await idbManager.getLastSyncTime();

      // Call Apps Script to get delta (changes since last sync)
      const delta = await this.fetchDelta(lastSync);

      if (delta && delta.data) {
        // Merge changes into IndexedDB
        await this.mergeDelta(delta.data);

        // Update last sync time
        await idbManager.setLastSyncTime(delta.timestamp || Date.now());

        const elapsed = Date.now() - startTime;
        const itemCount = Object.values(delta.data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
        console.log(`[SYNC] Completed in ${elapsed}ms - Downloaded ${itemCount} items`);
      } else {
        console.log('[SYNC] No changes since last sync');
      }

      this.lastSyncError = null;
    } catch (error) {
      this.lastSyncError = error;
      console.error('[SYNC] Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Fetch delta from Apps Script (only changes since lastSync)
  async fetchDelta(lastSyncTime) {
    try {
      const response = await gasRequest('sync', {
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

  // Merge delta into IndexedDB
  async mergeDelta(delta) {
    const updates = {
      usuarios: delta.usuarios || [],
      cursos: delta.cursos || [],
      lecciones: delta.lecciones || [],
      noticias: delta.noticias || [],
      comunicaciones: delta.comunicaciones || [],
      asignaciones: delta.asignaciones || [],
      resultados: delta.resultados || [],
      manuales: delta.manuales || []
    };

    for (const [storeName, records] of Object.entries(updates)) {
      if (records.length > 0) {
        await idbManager.saveRecords(storeName, records);
        console.log(`[SYNC] Updated ${records.length} records in ${storeName}`);
      }
    }
  }

  // Queue a change for upload — hoy solo actualiza el cache local
  // (IndexedDB). La escritura real al backend la hace dataSource.js de
  // forma síncrona por el camino legacy (guardarDatosSheet/actualizar/
  // eliminar), que sí distingue crear vs actualizar. Este endpoint
  // "write" genérico no existe en Apps Script (que separa escribir/
  // actualizar/eliminar) y "put" no alcanza para saber cuál de los dos
  // es — subir esto duplicaría filas si se implementara mal. Se deja
  // como no-op de upload hasta diseñar esa distinción correctamente.
  async queueChange(storeName, data, operation = 'put') {
    console.log(`[SYNC] Queued change: ${storeName} - ${operation}`);
    await idbManager.saveRecord(storeName, data);
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
      pendingChanges: this.pendingChanges.length,
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
export const syncManager = new SyncManager();

// Initialize when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
  });
} else {
  syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
}
