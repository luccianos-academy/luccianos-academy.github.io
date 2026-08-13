/* ============================
   Lucciano's Academy
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

/** Tira TODO el cache en memoria de una. Lo usa el botón de refrescar
 *  (components/topbar.js): sin esto, invalidar hoja por hoja desde
 *  afuera obligaría a quien llame a conocer la lista de hojas. */
export function invalidarTodo() {
    Object.keys(cache).forEach((hoja) => delete cache[hoja]);
    // También la marca de frescura de IndexedDB: si no, el botón de
    // refrescar tiraba el cache de memoria y volvía a leer la MISMA
    // copia vieja de IndexedDB, sin tocar la red.
    Object.keys(localStorage)
        .filter((k) => k.startsWith(SELLO_IDB))
        .forEach((k) => localStorage.removeItem(k));
}

/* ── Frescura de IndexedDB ─────────────────────────────────────────
   IndexedDB se trataba como fresca PARA SIEMPRE: alcanzaba con que
   tuviera una fila para devolverla sin consultar nunca más la planilla.
   Refrescarla dependía del syncManager, que estaba apagado (miraba
   window.GAS_URL, que nunca se asigna). Resultado: un dispositivo que
   cacheó una vez quedaba congelado — se agregaron 24 sucursales, se
   renumeraron los ids y se marcaron los propios, y la app seguía
   mostrando la foto vieja aunque cerraras sesión, porque cerrar sesión
   no borra IndexedDB.

   Ahora la copia local vale por un rato y después se revalida. Si la
   red falla se devuelve igual la copia vieja: sin señal, un dato de
   hace horas es mucho mejor que una pantalla vacía. */
const SELLO_IDB = "faro_idb_ts_";
const IDB_TTL_MS = 5 * 60 * 1000;

function idbFresca(hoja) {
    const ts = Number(localStorage.getItem(SELLO_IDB + hoja) || 0);
    return ts > 0 && Date.now() - ts < IDB_TTL_MS;
}

function sellarIdb(hoja) {
    // El resto del archivo usa catch(err) con binding; se mantiene por
    // consistencia y porque el catch sin binding no existe en runtimes
    // viejos, que es justo donde puede fallar la cuota.
    try {
        localStorage.setItem(SELLO_IDB + hoja, String(Date.now()));
    } catch (err) {
        console.warn("[dataSource] no se pudo sellar la frescura:", err);
    }
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

    // Tier 2: IndexedDB (instantáneo, sin red) — sólo si sigue fresca
    let deIdb = null;
    if (storeName && idbManager && idbManager.db) {
        try {
            const idbDataCruda = await idbManager.getAllRecords(storeName);
            if (idbDataCruda && idbDataCruda.length > 0) {
                // deleteSheet() marca los borrados con deleted:true en vez
                // de sacarlos (así el sync en background puede propagar la
                // baja) — pero nada filtraba ese flag en la lectura, así
                // que un ítem "eliminado" seguía apareciendo en la app
                // para siempre en ese mismo dispositivo, aunque el borrado
                // real en el Sheet sí había funcionado. Bug reportado en
                // vivo: "¿Eliminar en News realmente elimina?".
                deIdb = idbDataCruda.filter((r) => !r.deleted);
            }
        } catch (err) {
            console.warn(`[dataSource] IndexedDB fetch failed for ${hoja}:`, err);
        }
    }

    if (deIdb && idbFresca(hoja)) {
        console.log(`[dataSource] IndexedDB hit: ${hoja} (${deIdb.length} records)`);
        cache[hoja] = { datos: deIdb, ts: Date.now() };
        return [...deIdb];
    }

    // Tier 3: la planilla, vía Apps Script
    if (!pedidosEnVuelo[hoja]) {
        console.log(`[dataSource] Fetching from Apps Script: ${hoja}`);
        pedidosEnVuelo[hoja] = obtenerDatosSheet(hoja)
            .then(filas => {
                if (storeName && idbManager && idbManager.db && filas && filas.length > 0) {
                    // Se VACÍA antes de escribir: saveRecords sólo pisa lo
                    // que coincide por id, así que una fila borrada en la
                    // planilla sobrevivía en la copia local para siempre.
                    idbManager.clearStore(storeName)
                        .then(() => idbManager.saveRecords(storeName, filas))
                        .catch(err => console.warn(`[dataSource] Failed to save ${hoja} to IndexedDB:`, err));
                }
                sellarIdb(hoja);
                return filas;
            })
            .finally(() => { delete pedidosEnVuelo[hoja]; });
    }

    let filas;
    try {
        filas = (await pedidosEnVuelo[hoja]) || [];
    } catch (err) {
        // Sin red: la copia vieja es mejor que una pantalla vacía.
        if (deIdb) {
            console.warn(`[dataSource] ${hoja}: sin red, se usa la copia local`, err);
            cache[hoja] = { datos: deIdb, ts: Date.now() };
            return [...deIdb];
        }
        throw err;
    }
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

    // La escritura real va directo al backend acá abajo (no hay cola de
    // subida en segundo plano: la que existía llamaba a una acción
    // "write" que no existe en el backend, así que siempre fallaba).
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

// Delete: saca el registro local y lo borra en el backend
export async function deleteSheet(hoja, id, mockRows) {
    if (USE_MOCK_DATA) {
        const index = mockRows.findIndex((f) => String(f.id) === String(id));
        if (index !== -1) mockRows.splice(index, 1);
        return { ok: index !== -1 };
    }

    const storeName = sheetToStoreMap[hoja];

    // Antes esto NO sacaba el registro: lo marcaba con deleted:true para
    // que una cola de subida (que nunca funcionó, ver syncManager) lo
    // propagara después. Como nada filtraba ese flag al leer, el ítem
    // "borrado" seguía apareciendo en la app para siempre. Ahora se
    // saca de una y el borrado real va directo al backend acá abajo.
    if (storeName && idbManager && idbManager.db) {
        try {
            await idbManager.deleteRecord(storeName, id);
            console.log(`[dataSource] Borrado local: ${hoja} (${id})`);
        } catch (err) {
            console.error(`[dataSource] Failed to delete locally:`, err);
        }
    }

    const resultado = await eliminarDatosSheet(hoja, id);
    invalidar(hoja);
    return resultado;
}
