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

// Varias pantallas piden la MISMA hoja casi al mismo tiempo (ej. al
// marcar una noticia como leída: el contador de la campana y la propia
// página de News piden "Noticias" con milisegundos de diferencia) —
// sin esto, eso son dos round-trips completos a Apps Script (lento,
// 1-3s cada uno) por una sola interacción. Mientras un pedido de una
// hoja está en vuelo, cualquier otro pedido de esa MISMA hoja espera
// esa misma promesa en vez de disparar uno nuevo. No cachea nada más
// allá de eso — apenas resuelve (o falla), el siguiente pedido vuelve
// a ir a la red, así que no hay riesgo de datos viejos.
const pedidosEnVuelo = {};

export async function fetchSheet(hoja, mockRows) {
    if (USE_MOCK_DATA) return structuredClone(mockRows);
    if (!pedidosEnVuelo[hoja]) {
        pedidosEnVuelo[hoja] = obtenerDatosSheet(hoja).finally(() => { delete pedidosEnVuelo[hoja]; });
    }
    const filas = await pedidosEnVuelo[hoja];
    return filas || [];
}

export async function writeSheet(hoja, fila, mockRows) {
    if (USE_MOCK_DATA) {
        const nuevaFila = { id: Date.now(), ...fila };
        mockRows.push(nuevaFila);
        return { ok: true, fila: nuevaFila };
    }
    return guardarDatosSheet(hoja, fila);
}

export async function updateSheet(hoja, id, cambios, mockRows) {
    if (USE_MOCK_DATA) {
        const fila = mockRows.find((f) => String(f.id) === String(id));
        if (fila) Object.assign(fila, cambios);
        return { ok: !!fila };
    }
    return actualizarDatosSheet(hoja, id, cambios);
}

export async function deleteSheet(hoja, id, mockRows) {
    if (USE_MOCK_DATA) {
        const index = mockRows.findIndex((f) => String(f.id) === String(id));
        if (index !== -1) mockRows.splice(index, 1);
        return { ok: index !== -1 };
    }
    return eliminarDatosSheet(hoja, id);
}
