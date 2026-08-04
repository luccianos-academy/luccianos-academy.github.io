/* ============================
   FARO v4
   services/dataSource.js

   Data access layer with three-tier caching strategy:
   1. Mock data (development)
   2. IndexedDB (local cache, instant access)
   3. Apps Script → Google Sheets (backend sync)

   Cada función de js/data/*.js llama a estas cuatro funciones
   en vez de directamente a google.js. Esto permite cambiar entre
   datos mock, IndexedDB local, y backend remoto sin tocar las
   páginas.

   Strategy:
   - fetchSheet: Mock → IndexedDB → Apps Script (fallback)
   - writeSheet: IndexedDB (optimistic) → queue for sync
   - updateSheet: IndexedDB (optimistic) → queue for sync
   - deleteSheet: IndexedDB (optimistic) → queue for sync

   IndexedDB + syncManager handle background sync sin bloquear UI.
=============================*/

import { USE_MOCK_DATA } from "../config.js";
import {
    obtenerDatosSheet,
    guardarDatosSheet,
    actualizarDatosSheet,
    eliminarDatosSheet,
} from "./google.js";

// Map entre nombre de hoja y store IndexedDB
const sheetToStoreMap = {
    'Usuarios': 'usuarios',
    'Cursos': 'cursos',
    'Lecciones': 'lecciones',
    'Noticias': 'noticias',
    'Comunicaciones': 'comunicaciones',
    'Asignaciones': 'asignaciones',
    'Resultados': 'resultados',
    'Manuales': 'manuales',
    'Evaluaciones': 'evaluaciones',
    'Sucursales': 'sucursales',
    'Canales': 'canales',
    'Publicaciones': 'publicaciones',
    'Comentarios': 'comentarios',
    'Recursos': 'recursos',
    'Tokens': 'tokens',
    'Auditoria': 'auditoria'
};

// Cache en memoria corto (fallback si IndexedDB falla)
const CACHE_TTL_MS = 20000;
const cache = {}; // { [hoja]: { datos, ts } }
const pedidosEnVuelo = {}; // dedupe de pedidos concurrentes

export function invalidar(hoja) {
    delete cache[hoja];
}

// Fetch con IndexedDB como capa principal
export async function fetchSheet(hoja, mockRows) {
    if (USE_MOCK_DATA) return structuredClone(mockRows);

    const storeName = sheetToStoreMap[hoja];

    // Tier 1: Check in-memory cache
    const cacheado = cache[hoja];
    if (cacheado && Date.now() - cacheado.ts < CACHE_TTL_MS) {
        console.log(`[dataSource] Cache hit: ${hoja}`);
        return [...cacheado.datos];
    }

    // Tier 2: Check IndexedDB (instant, no network)
    if (storeName && idbManager && idbManager.db) {
        try {
            const idbData = await idbManager.getAllRecords(storeName);
            if (idbData && idbData.length > 0) {
                console.log(`[dataSource] IndexedDB hit: ${hoja} (${idbData.length} records)`);
                cache[hoja] = { datos: idbData, ts: Date.now() };
                return [...idbData];
            }
        } catch (err) {
            console.warn(`[dataSource] IndexedDB fetch failed for ${hoja}:`, err);
        }
    }

    // Tier 3: Fallback to Apps Script (network request)
    if (!pedidosEnVuelo[hoja]) {
        console.log(`[dataSource] Fetching from Apps Script: ${hoja}`);
        pedidosEnVuelo[hoja] = obtenerDatosSheet(hoja)
            .then(filas => {
                // Save to IndexedDB for future use
                if (storeName && idbManager && idbManager.db && filas && filas.length > 0) {
                    idbManager.saveRecords(storeName, filas).catch(err => {
                        console.warn(`[dataSource] Failed to save ${hoja} to IndexedDB:`, err);
                    });
                }
                return filas;
            })
            .finally(() => { delete pedidosEnVuelo[hoja]; });
    }

    const filas = (await pedidosEnVuelo[hoja]) || [];
    cache[hoja] = { datos: filas, ts: Date.now() };
    return [...filas];
}

// Write: optimistic update in IndexedDB, queue for sync
export async function writeSheet(hoja, fila, mockRows) {
    if (USE_MOCK_DATA) {
        const nuevaFila = { id: Date.now(), ...fila };
        mockRows.push(nuevaFila);
        return { ok: true, fila: nuevaFila };
    }

    const storeName = sheetToStoreMap[hoja];
    const nuevaFila = { id: Date.now(), ...fila, fechaModificacion: Date.now() };

    // Optimistic update: save to IndexedDB immediately
    if (storeName && idbManager && idbManager.db) {
        try {
            await idbManager.saveRecord(storeName, nuevaFila);
            console.log(`[dataSource] Optimistic write to IndexedDB: ${hoja}`);
        } catch (err) {
            console.error(`[dataSource] Failed to save to IndexedDB:`, err);
        }
    }

    // Queue for sync (will be uploaded in background)
    if (syncManager) {
        syncManager.queueChange(storeName, nuevaFila, 'put')
            .catch(err => console.error(`[dataSource] Failed to queue change:`, err));
    }

    // Also save to Apps Script (legacy behavior for safety)
    const resultado = await guardarDatosSheet(hoja, nuevaFila);
    invalidar(hoja);
    return { ok: true, fila: nuevaFila, ...resultado };
}

// Update: optimistic update in IndexedDB, queue for sync
export async function updateSheet(hoja, id, cambios, mockRows) {
    if (USE_MOCK_DATA) {
        const fila = mockRows.find((f) => String(f.id) === String(id));
        if (fila) Object.assign(fila, cambios);
        return { ok: !!fila };
    }

    const storeName = sheetToStoreMap[hoja];
    const cambiosConTimestamp = { ...cambios, fechaModificacion: Date.now() };

    // Optimistic update: fetch current record, merge, save to IndexedDB
    if (storeName && idbManager && idbManager.db) {
        try {
            const current = await idbManager.getRecord(storeName, id);
            if (current) {
                const updated = { ...current, ...cambiosConTimestamp };
                await idbManager.saveRecord(storeName, updated);
                console.log(`[dataSource] Optimistic update to IndexedDB: ${hoja} (${id})`);

                // Queue for sync
                if (syncManager) {
                    syncManager.queueChange(storeName, updated, 'put')
                        .catch(err => console.error(`[dataSource] Failed to queue change:`, err));
                }
            }
        } catch (err) {
            console.error(`[dataSource] Failed to optimistically update:`, err);
        }
    }

    // Also update Apps Script
    const resultado = await actualizarDatosSheet(hoja, id, cambiosConTimestamp);
    invalidar(hoja);
    return resultado;
}

// Delete: optimistic delete in IndexedDB, queue for sync
export async function deleteSheet(hoja, id, mockRows) {
    if (USE_MOCK_DATA) {
        const index = mockRows.findIndex((f) => String(f.id) === String(id));
        if (index !== -1) mockRows.splice(index, 1);
        return { ok: index !== -1 };
    }

    const storeName = sheetToStoreMap[hoja];

    // Note: For delete, we mark as deleted rather than removing
    // This ensures sync can track the deletion
    if (storeName && idbManager && idbManager.db) {
        try {
            const record = await idbManager.getRecord(storeName, id);
            if (record) {
                const deleted = { ...record, deleted: true, fechaModificacion: Date.now() };
                await idbManager.saveRecord(storeName, deleted);
                console.log(`[dataSource] Optimistic delete in IndexedDB: ${hoja} (${id})`);

                if (syncManager) {
                    syncManager.queueChange(storeName, deleted, 'delete')
                        .catch(err => console.error(`[dataSource] Failed to queue delete:`, err));
                }
            }
        } catch (err) {
            console.error(`[dataSource] Failed to optimistically delete:`, err);
        }
    }

    // Also delete from Apps Script
    const resultado = await eliminarDatosSheet(hoja, id);
    invalidar(hoja);
    return resultado;
}
