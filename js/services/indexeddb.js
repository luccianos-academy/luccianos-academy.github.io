// IndexedDB Manager for Lucciano's Academy
// Handles local caching of all application data for offline-first architecture

class IndexedDBManager {
  constructor() {
    this.dbName = 'luccianos-academy';
    this.dbVersion = 1;
    this.db = null;
    this.stores = [
      'usuarios',
      'cursos',
      'lecciones',
      'noticias',
      'comunicaciones',
      'asignaciones',
      'resultados',
      'manuales',
      'evaluaciones',
      'sucursales',
      'syncMetadata'
    ];
  }

  // Initialize the database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[IndexedDB] Upgrading database schema');

        // Usuarios store
        if (!db.objectStoreNames.contains('usuarios')) {
          const usuariosStore = db.createObjectStore('usuarios', { keyPath: 'id' });
          usuariosStore.createIndex('email', 'email', { unique: false });
          usuariosStore.createIndex('rol', 'rol', { unique: false });
        }

        // Cursos store
        if (!db.objectStoreNames.contains('cursos')) {
          const cursosStore = db.createObjectStore('cursos', { keyPath: 'id' });
          cursosStore.createIndex('estado', 'estado', { unique: false });
        }

        // Lecciones store
        if (!db.objectStoreNames.contains('lecciones')) {
          const leccionesStore = db.createObjectStore('lecciones', { keyPath: 'id' });
          leccionesStore.createIndex('cursoId', 'cursoId', { unique: false });
        }

        // Noticias store
        if (!db.objectStoreNames.contains('noticias')) {
          const noticiasStore = db.createObjectStore('noticias', { keyPath: 'id' });
          noticiasStore.createIndex('timestamp', 'timestamp', { unique: false });
          noticiasStore.createIndex('dirigidoA', 'dirigidoA', { unique: false });
        }

        // Comunicaciones store
        if (!db.objectStoreNames.contains('comunicaciones')) {
          const comunicacionesStore = db.createObjectStore('comunicaciones', { keyPath: 'id' });
          comunicacionesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Asignaciones store
        if (!db.objectStoreNames.contains('asignaciones')) {
          const asignacionesStore = db.createObjectStore('asignaciones', { keyPath: 'id' });
          asignacionesStore.createIndex('usuarioId', 'usuarioId', { unique: false });
          asignacionesStore.createIndex('leccionId', 'leccionId', { unique: false });
        }

        // Resultados store
        if (!db.objectStoreNames.contains('resultados')) {
          const resultadosStore = db.createObjectStore('resultados', { keyPath: 'id' });
          resultadosStore.createIndex('usuarioId', 'usuarioId', { unique: false });
          resultadosStore.createIndex('asignacionId', 'asignacionId', { unique: false });
        }

        // Manuales store
        if (!db.objectStoreNames.contains('manuales')) {
          const manualesStore = db.createObjectStore('manuales', { keyPath: 'id' });
          manualesStore.createIndex('rolesPermitidos', 'rolesPermitidos', { unique: false });
        }

        // Evaluaciones store
        if (!db.objectStoreNames.contains('evaluaciones')) {
          const evaluacionesStore = db.createObjectStore('evaluaciones', { keyPath: 'id' });
          evaluacionesStore.createIndex('usuarioId', 'usuarioId', { unique: false });
          evaluacionesStore.createIndex('estado', 'estado', { unique: false });
        }

        // Sucursales store
        if (!db.objectStoreNames.contains('sucursales')) {
          const sucursalesStore = db.createObjectStore('sucursales', { keyPath: 'id' });
          sucursalesStore.createIndex('estado', 'estado', { unique: false });
          sucursalesStore.createIndex('nombre', 'nombre', { unique: false });
        }

        // SyncMetadata store (stores last sync timestamp, etc)
        if (!db.objectStoreNames.contains('syncMetadata')) {
          db.createObjectStore('syncMetadata', { keyPath: 'key' });
        }

        console.log('[IndexedDB] Schema upgrade complete');
      };
    });
  }

  // Save single record
  async saveRecord(storeName, record) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(record);

      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  // Save multiple records (bulk)
  async saveRecords(storeName, records) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      records.forEach(record => {
        store.put(record);
      });

      transaction.oncomplete = () => {
        console.log(`[IndexedDB] Saved ${records.length} records to ${storeName}`);
        resolve(records);
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Get single record by ID
  async getRecord(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all records from a store
  async getAllRecords(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Get records by index
  async getRecordsByIndex(storeName, indexName, value) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear entire store
  async clearStore(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log(`[IndexedDB] Cleared store: ${storeName}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get last sync time
  async getLastSyncTime() {
    const metadata = await this.getRecord('syncMetadata', 'lastSync');
    return metadata ? metadata.timestamp : 0;
  }

  // Set last sync time
  async setLastSyncTime(timestamp) {
    return this.saveRecord('syncMetadata', {
      key: 'lastSync',
      timestamp: timestamp,
      date: new Date().toISOString()
    });
  }

  // Get database size in bytes (approximate)
  async getDBSize() {
    let totalSize = 0;
    for (const storeName of this.stores) {
      const records = await this.getAllRecords(storeName);
      records.forEach(record => {
        totalSize += JSON.stringify(record).length;
      });
    }
    return totalSize;
  }

  // Clear entire database (nuclear option, for testing)
  async clearAll() {
    if (!this.db) await this.init();
    for (const storeName of this.stores) {
      await this.clearStore(storeName);
    }
    console.log('[IndexedDB] All stores cleared');
  }

  // Export database for debugging
  async exportDB() {
    const dump = {};
    for (const storeName of this.stores) {
      dump[storeName] = await this.getAllRecords(storeName);
    }
    return dump;
  }

  // Check if database is available
  static isAvailable() {
    return typeof indexedDB !== 'undefined';
  }
}

// Global instance
// Manual init from app.js

// Global instance (must be created, but not auto-init)
window.idbManager = new IndexedDBManager();
