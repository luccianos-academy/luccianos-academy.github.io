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

export async function fetchSheet(hoja, mockRows) {
    if (USE_MOCK_DATA) return structuredClone(mockRows);
    const filas = await obtenerDatosSheet(hoja);
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
