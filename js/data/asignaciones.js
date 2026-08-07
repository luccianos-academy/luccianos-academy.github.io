/* ============================
   Lucciano's Academy
   data/asignaciones.js — Tabla "Asignaciones"
   (acceso de un colaborador a un curso: alta, vencimiento, progreso)
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { asignacionesMock } from "./mock/asignaciones.mock.js";
import { HOJAS } from "../config.js";

function normalizarAsignacion(f) {
    return {
        id: f.id,
        colaboradorId: f.colaboradorId,
        cursoId: f.cursoId,
        fechaAlta: f.fechaAlta || "",
        fechaVencimiento: f.fechaVencimiento || "",
        estado: f.estado || "en_progreso",
        progreso: Number(f.progreso) || 0,
    };
}

export async function getAsignaciones() {
    try {
        const filas = await fetchSheet(HOJAS.ASIGNACIONES, asignacionesMock);
        return filas.map(normalizarAsignacion);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.ASIGNACIONES}':`, err.message);
        return [];
    }
}

export async function getAsignacionesPorColaborador(colaboradorId) {
    const asignaciones = await getAsignaciones();
    return asignaciones.filter((a) => String(a.colaboradorId) === String(colaboradorId));
}

export async function crearAsignacion({ colaboradorId, cursoId, fechaVencimiento = "", estado = "en_progreso", progreso = 0 }) {
    const fechaAlta = new Date().toISOString().slice(0, 10);
    return writeSheet(HOJAS.ASIGNACIONES, { colaboradorId, cursoId, fechaAlta, fechaVencimiento, estado, progreso }, asignacionesMock);
}

export async function actualizarAsignacion(id, cambios) {
    return updateSheet(HOJAS.ASIGNACIONES, id, cambios, asignacionesMock);
}

export async function eliminarAsignacion(id) {
    return deleteSheet(HOJAS.ASIGNACIONES, id, asignacionesMock);
}
