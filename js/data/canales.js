/* ============================
   FARO v4
   data/canales.js — Tabla "Canales" (Comunicaciones)

   Antes eran una lista fija en el código; ahora es una hoja más, que
   Admin y Supervisor pueden crear/editar desde la propia app (ver
   pages/comunicaciones.js) — así un canal nuevo no depende de pedir
   un cambio de código. Eliminar queda solo para Admin (un canal con
   publicaciones reales adentro es más delicado de borrar que
   crearlo/renombrarlo).
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { canalesMock } from "./mock/canales.mock.js";
import { HOJAS } from "../config.js";

// Set acotado para el selector de ícono al crear/editar un canal —
// mismos íconos ya usados por los canales de ejemplo, no hace falta
// más variedad por ahora (se puede sumar sin migrar nada).
export const ICONOS_CANAL = [
    "noticias", "configuracion", "warning", "idea", "comentario", "corazon",
    "helado", "cafe", "chocolate", "pastel", "icepop", "caja", "usuarios", "academia",
];

function normalizarCanal(f) {
    return {
        id: f.id,
        nombre: String(f.nombre || "").trim(),
        icono: ICONOS_CANAL.includes(f.icono) ? f.icono : "comentario",
        creadoPor: String(f.creadoPor || "").trim(),
    };
}

export async function getCanales() {
    try {
        const filas = await fetchSheet(HOJAS.CANALES, canalesMock);
        return filas.map(normalizarCanal).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.CANALES}':`, err.message);
        return [];
    }
}

export async function canalInfo(canalId) {
    const canales = await getCanales();
    return canales.find((c) => String(c.id) === String(canalId)) || canales[0] || { id: "", nombre: "Sin canal", icono: "comentario" };
}

export async function crearCanal({ nombre, icono, creadoPor }) {
    return writeSheet(HOJAS.CANALES, { nombre, icono: icono || "comentario", creadoPor: creadoPor || "" }, canalesMock);
}

export async function actualizarCanal(id, cambios) {
    return updateSheet(HOJAS.CANALES, id, cambios, canalesMock);
}

export async function eliminarCanal(id) {
    return deleteSheet(HOJAS.CANALES, id, canalesMock);
}
