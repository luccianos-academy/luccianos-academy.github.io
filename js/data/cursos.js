/* ============================
   Lucciano's Academy
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
        // Lista separada por comas que mezcla países y locales — ver
        // services/alcance.js. VACÍO = le aplica a todos, que es lo
        // normal; la excepción se declara. Ojo que es la semántica
        // OPUESTA a Manuales.visiblePara, donde vacío = no lo ve nadie.
        aplicaA: String(f.aplicaA || "").trim(),
        // El complemento de aplicaA: países o locales que NO tienen este
        // curso. Existe porque el caso frecuente es la excepción de UN
        // local ("Devoto no tiene cafetería") y expresarla con aplicaA
        // obligaría a enumerar los otros 122. La exclusión gana sobre la
        // inclusión — ver services/alcance.js.
        noAplicaA: String(f.noAplicaA || "").trim(),
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
