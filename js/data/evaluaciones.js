/* ============================
   FARO v4
   data/evaluaciones.js — Tabla "Evaluaciones"

   La hoja guarda las opciones en 3 columnas planas (opcion1/2/3 +
   correcta 1-2-3) en vez de un array — así se puede cargar y editar
   preguntas directo en Google Sheets, sin tocar JSON a mano. El
   resto de la app sigue usando la forma interna de siempre
   (opciones: array, respuestaCorrecta: índice 0-based) — esta capa
   es la única que sabe traducir entre las dos.

   Motor de examen completo (rendir, corregir, puntaje final) es
   Sprint 6 — acá solo se expone lectura/CRUD básico del banco.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { evaluacionesMock } from "./mock/evaluaciones.mock.js";
import { HOJAS } from "../config.js";

/**
 * Acepta tanto una fila plana de Sheets (opcion1/opcion2/opcion3 +
 * correcta 1-based) como la forma interna vieja (opciones: array +
 * respuestaCorrecta 0-based, todavía usada por algunas filas de
 * datos de muestra) — así no hace falta reescribir los mocks.
 */
function normalizarPregunta(f) {
    const opciones = Array.isArray(f.opciones) && f.opciones.length
        ? f.opciones
        : [f.opcion1, f.opcion2, f.opcion3].filter((o) => o !== undefined && o !== "" && o !== null);

    const respuestaCorrecta = f.opciones !== undefined
        ? Number(f.respuestaCorrecta) || 0
        : Math.max(0, (Number(f.correcta) || 1) - 1);

    return {
        id: f.id,
        cursoId: f.cursoId,
        pregunta: f.pregunta,
        opciones,
        respuestaCorrecta,
        puntaje: Number(f.puntaje) || 0,
    };
}

/** Traduce la forma interna (array + índice 0-based) a las columnas planas de la hoja. */
function aFilaPlana({ cursoId, pregunta, opciones = [], respuestaCorrecta = 0, puntaje = 10 }) {
    return {
        cursoId,
        pregunta,
        opcion1: opciones[0] || "",
        opcion2: opciones[1] || "",
        opcion3: opciones[2] || "",
        correcta: respuestaCorrecta + 1,
        puntaje,
    };
}

export async function getEvaluaciones() {
    try {
        const filas = await fetchSheet(HOJAS.EVALUACIONES, evaluacionesMock);
        return filas.map(normalizarPregunta);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.EVALUACIONES}':`, err.message);
        return [];
    }
}

export async function getPreguntasPorCurso(cursoId) {
    const preguntas = await getEvaluaciones();
    return preguntas.filter((p) => String(p.cursoId) === String(cursoId));
}

export async function crearPregunta(datos) {
    return writeSheet(HOJAS.EVALUACIONES, aFilaPlana(datos), evaluacionesMock);
}

export async function actualizarPregunta(id, cambios) {
    const cambiosPlanos = cambios.opciones || cambios.respuestaCorrecta !== undefined
        ? aFilaPlana({ cursoId: cambios.cursoId, pregunta: cambios.pregunta, opciones: cambios.opciones, respuestaCorrecta: cambios.respuestaCorrecta, puntaje: cambios.puntaje })
        : cambios;
    return updateSheet(HOJAS.EVALUACIONES, id, cambiosPlanos, evaluacionesMock);
}

export async function eliminarPregunta(id) {
    return deleteSheet(HOJAS.EVALUACIONES, id, evaluacionesMock);
}
