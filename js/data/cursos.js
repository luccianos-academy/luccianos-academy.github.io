/* ============================
   FARO v4
   data/cursos.js — Tabla "Cursos"
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { cursosMock } from "./mock/cursos.mock.js";
import { HOJAS } from "../config.js";

function normalizarCurso(f) {
    return {
        id: f.id,
        nombre: f.nombre,
        categoria: f.categoria || "General",
        obligatorio: String(f.obligatorio || "").toUpperCase() === "SI",
        orden: Number(f.orden) || 0,
    };
}

export async function getCursos() {
    try {
        const filas = await fetchSheet(HOJAS.CURSOS, cursosMock);
        return filas.map(normalizarCurso).sort((a, b) => a.orden - b.orden);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.CURSOS}':`, err.message);
        return [];
    }
}

export async function crearCurso({ nombre, categoria = "General", obligatorio = false, orden = 0 }) {
    return writeSheet(HOJAS.CURSOS, { nombre, categoria, obligatorio: obligatorio ? "SI" : "NO", orden }, cursosMock);
}

export async function actualizarCurso(id, cambios) {
    return updateSheet(HOJAS.CURSOS, id, cambios, cursosMock);
}

export async function eliminarCurso(id) {
    return deleteSheet(HOJAS.CURSOS, id, cursosMock);
}
