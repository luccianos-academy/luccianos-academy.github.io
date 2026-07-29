/* ============================
   FARO v4
   services/dataSource.js

   La única costura entre "datos de muestra en memoria" y
   "Google Sheets real". Cada función de js/data/*.js llama a
   estas cuatro funciones en vez de a services/google.js
   directamente — así, cuando exista un GAS_URL real, alcanza con
   que USE_MOCK_DATA pase a false (config.js) para que TODA la
   app empiece a leer/escribir en Sheets sin tocar una sola página
   ni componente.

   Los mockRows que recibe cada función son los arrays vivos de
   js/data/mock/*.mock.js: se mutan en memoria para que un alta o
   una edición se vea reflejada al instante en la pantalla (se
   pierde al recargar — esperable mientras no hay backend).
=============================*/

import { USE_MOCK_DATA } from "../config.js";
import {
    obtenerDatosSheet,
    guardarDatosSheet,
    actualizarDatosSheet,
    eliminarDatosSheet,
} from "./google.js";

// La app pedía CADA hoja de cero en CADA navegación — cada pedido a
// Apps Script tarda 1-3s posta (red + ejecución), así que 2-4 hojas
// por pantalla (Promise.all típico) se sentían como 5-10s reales de
// espera por cada clic, incluso para datos que no cambiaron nada
// (Cursos, Sucursales, Usuarios rara vez cambian de un minuto a otro).
// Cache corto en memoria: mientras una hoja tenga un pedido reciente
// (menos de CACHE_TTL_MS), se reusa esa respuesta en vez de ir a la
// red de nuevo — y se invalida SOLA apenas alguien escribe en esa
// misma hoja (ver invalidar()), así que nunca ves desactualizado algo
// que vos mismo acabás de guardar. El único costo real es no ver al
// toque un cambio que hizo OTRA persona en simultáneo — aceptable acá
// (~20-30 usuarios, sin tiempo real ya de entrada).
const CACHE_TTL_MS = 20000;
const cache = {}; // { [hoja]: { datos, ts } }
const pedidosEnVuelo = {}; // dedupe de pedidos concurrentes de la misma hoja

function invalidar(hoja) {
    delete cache[hoja];
}

export async function fetchSheet(hoja, mockRows) {
    if (USE_MOCK_DATA) return structuredClone(mockRows);

    const cacheado = cache[hoja];
    if (cacheado && Date.now() - cacheado.ts < CACHE_TTL_MS) {
        return [...cacheado.datos];
    }

    if (!pedidosEnVuelo[hoja]) {
        pedidosEnVuelo[hoja] = obtenerDatosSheet(hoja).finally(() => { delete pedidosEnVuelo[hoja]; });
    }
    const filas = (await pedidosEnVuelo[hoja]) || [];
    cache[hoja] = { datos: filas, ts: Date.now() };
    return [...filas];
}

export async function writeSheet(hoja, fila, mockRows) {
    if (USE_MOCK_DATA) {
        const nuevaFila = { id: Date.now(), ...fila };
        mockRows.push(nuevaFila);
        return { ok: true, fila: nuevaFila };
    }
    const resultado = await guardarDatosSheet(hoja, fila);
    invalidar(hoja);
    return resultado;
}

export async function updateSheet(hoja, id, cambios, mockRows) {
    if (USE_MOCK_DATA) {
        const fila = mockRows.find((f) => String(f.id) === String(id));
        if (fila) Object.assign(fila, cambios);
        return { ok: !!fila };
    }
    const resultado = await actualizarDatosSheet(hoja, id, cambios);
    invalidar(hoja);
    return resultado;
}

export async function deleteSheet(hoja, id, mockRows) {
    if (USE_MOCK_DATA) {
        const index = mockRows.findIndex((f) => String(f.id) === String(id));
        if (index !== -1) mockRows.splice(index, 1);
        return { ok: index !== -1 };
    }
    const resultado = await eliminarDatosSheet(hoja, id);
    invalidar(hoja);
    return resultado;
}
