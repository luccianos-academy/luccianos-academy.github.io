// Sync Manager for Lucciano's Academy
// Handles intelligent synchronization between IndexedDB (local) and Apps Script (backend)

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

      // Upload pending changes
      await this.uploadPendingChanges();

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
      manuales: delta.manuales || [],
      evaluaciones: delta.evaluaciones || [],
      sucursales: delta.sucursales || [],
      canales: delta.canales || [],
      publicaciones: delta.publicaciones || [],
      comentarios: delta.comentarios || [],
      recursos: delta.recursos || [],
      tokens: delta.tokens || [],
      auditoria: delta.auditoria || []
    };

    for (const [storeName, records] of Object.entries(updates)) {
      if (records.length > 0) {
        await idbManager.saveRecords(storeName, records);
        console.log(`[SYNC] Updated ${records.length} records in ${storeName}`);
      }
    }
  }

  // Queue a change for upload
  async queueChange(storeName, data, operation = 'put') {
    console.log(`[SYNC] Queued change: ${storeName} - ${operation}`);

    // Save to IndexedDB immediately (optimistic update)
    await idbManager.saveRecord(storeName, data);

    // Add to pending queue for upload
    this.pendingChanges.push({
      storeName,
      data,
      operation,
      timestamp: Date.now()
    });

    // Try to upload immediately if online
    if (!this.offlineMode) {
      this.uploadPendingChanges().catch(err => {
        console.error('[SYNC] Failed to upload pending changes:', err);
      });
    }
  }

  // Upload pending changes to backend
  async uploadPendingChanges() {
    if (this.pendingChanges.length === 0) return;

    console.log(`[SYNC] Uploading ${this.pendingChanges.length} pending changes...`);

    try {
      const changes = [...this.pendingChanges];

      for (const change of changes) {
        try {
          await window.gasRequest('write', {
            hoja: this.mapStoreToSheet(change.storeName),
            data: change.data,
            operation: change.operation
          });

          // Remove from pending if successful
          const index = this.pendingChanges.indexOf(change);
          if (index > -1) {
            this.pendingChanges.splice(index, 1);
          }

          console.log(`[SYNC] Uploaded: ${change.storeName} - ${change.operation}`);
        } catch (error) {
          console.error(`[SYNC] Failed to upload ${change.storeName}:`, error);
          // Keep in pending queue for retry
        }
      }

      if (this.pendingChanges.length > 0) {
        console.log(`[SYNC] ${this.pendingChanges.length} changes still pending (will retry)`);
      }
    } catch (error) {
      console.error('[SYNC] Upload batch failed:', error);
    }
  }

  // Map store name to Sheet name
  mapStoreToSheet(storeName) {
    const mapping = {
      usuarios: 'Usuarios',
      cursos: 'Cursos',
      lecciones: 'Lecciones',
      noticias: 'Noticias',
      comunicaciones: 'Comunicaciones',
      asignaciones: 'Asignaciones',
      resultados: 'Resultados',
      manuales: 'Manuales',
      evaluaciones: 'Evaluaciones',
      sucursales: 'Sucursales',
      canales: 'Canales',
      publicaciones: 'Publicaciones',
      comentarios: 'Comentarios',
      recursos: 'Recursos',
      tokens: 'Tokens',
      auditoria: 'Auditoria'
    };
    return mapping[storeName] || storeName;
  }

  // Handle coming online
  async handleOnline() {
    console.log('[SYNC] Device came online');
    this.offlineMode = false;

    // Immediate sync
    await this.syncWithBackend();

    // Upload pending changes
    await this.uploadPendingChanges();
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
window.syncManager = new SyncManager();

// Initialize when document is ready
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => {
//     syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
//   });
// } else {
//   syncManager.init().catch(err => console.error('[SYNC] Init failed:', err));
// }
