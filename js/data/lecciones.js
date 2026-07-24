/* ============================
   FARO v4
   data/lecciones.js — Tabla "Lecciones"

   Esquema ampliado (vs. la v1, que tenía un solo campo "contenido"):
   separa procedimiento, errores comunes, buenas prácticas y consejo
   en columnas propias — así se puede editar cada parte por separado
   en Sheets, y la UI puede mostrar cada una con su propio estilo
   (ej. errores en rojo, consejo como tip) en vez de un bloque de
   texto plano.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { leccionesMock } from "./mock/lecciones.mock.js";
import { HOJAS } from "../config.js";

function normalizarLeccion(f) {
    return {
        id: f.id,
        cursoId: f.cursoId,
        orden: Number(f.orden) || 0,
        titulo: f.titulo,
        objetivo: f.objetivo || "",
        duracionMinutos: Number(f.duracionMinutos) || 0,
        video: f.video || "",
        manual: f.manual || "",
        // Opcional — mismo criterio que Noticias.adjuntoLabel: si está
        // vacío, el botón muestra "Ver manual" (genérico); solo se
        // completa cuando el link es algo más específico (ej. "Ver
        // menú kosher" para un PDF de certificación) — ver
        // renderCuerpoLeccion en pages/cursos.js.
        manualLabel: f.manualLabel || "",
        imagen: f.imagen || "",
        procedimiento: f.procedimiento || "",
        errores: f.errores || "",
        buenasPracticas: f.buenasPracticas || "",
        consejo: f.consejo || "",
        resumen: f.resumen || "",
        estado: f.estado || "Activo",
    };
}

export async function getLecciones() {
    try {
        const filas = await fetchSheet(HOJAS.LECCIONES, leccionesMock);
        return filas.map(normalizarLeccion).sort((a, b) => a.orden - b.orden);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.LECCIONES}':`, err.message);
        return [];
    }
}

export async function getLeccionesPorCurso(cursoId) {
    const lecciones = await getLecciones();
    return lecciones.filter((l) => String(l.cursoId) === String(cursoId));
}

export async function crearLeccion({
    cursoId, orden = 0, titulo, objetivo = "", duracionMinutos = 0,
    video = "", manual = "", manualLabel = "", imagen = "", procedimiento = "",
    errores = "", buenasPracticas = "", consejo = "", resumen = "", estado = "Activo",
}) {
    return writeSheet(HOJAS.LECCIONES, {
        cursoId, orden, titulo, objetivo, duracionMinutos,
        video, manual, manualLabel, imagen, procedimiento, errores,
        buenasPracticas, consejo, resumen, estado,
    }, leccionesMock);
}

export async function actualizarLeccion(id, cambios) {
    return updateSheet(HOJAS.LECCIONES, id, cambios, leccionesMock);
}

export async function eliminarLeccion(id) {
    return deleteSheet(HOJAS.LECCIONES, id, leccionesMock);
}
