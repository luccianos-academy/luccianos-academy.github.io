/* ============================
   Lucciano's Academy
   data/resultados.js — Tabla "Resultados"
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { resultadosMock } from "./mock/resultados.mock.js";
import { HOJAS } from "../config.js";

function normalizarResultado(f) {
    return {
        id: f.id,
        colaboradorId: f.colaboradorId,
        cursoId: f.cursoId,
        nota: Number(f.nota) || 0,
        aprobado: String(f.aprobado || "").toUpperCase() === "SI",
        fechaFinalizacion: f.fechaFinalizacion || "",
    };
}

export async function getResultados() {
    try {
        const filas = await fetchSheet(HOJAS.RESULTADOS, resultadosMock);
        return filas.map(normalizarResultado);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.RESULTADOS}':`, err.message);
        return [];
    }
}

export async function getResultadosPorColaborador(colaboradorId) {
    const resultados = await getResultados();
    return resultados.filter((r) => String(r.colaboradorId) === String(colaboradorId));
}

export async function crearResultado({ colaboradorId, cursoId, nota, aprobado }) {
    const fechaFinalizacion = new Date().toISOString().slice(0, 10);
    return writeSheet(HOJAS.RESULTADOS, { colaboradorId, cursoId, nota, aprobado: aprobado ? "SI" : "NO", fechaFinalizacion }, resultadosMock);
}

export async function eliminarResultado(id) {
    return deleteSheet(HOJAS.RESULTADOS, id, resultadosMock);
}
