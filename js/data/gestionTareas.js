/* ============================
   Lucciano's Academy
   data/gestionTareas.js — Tabla "GestionTareas" (catálogo, solo
   Admin) de Gestión semanal, #/gestion

   Desde Fase 2 (2026-08-25) este archivo define SOLO el catálogo —
   qué tareas existen, con qué ícono/título/sub-ítems. EN QUÉ DÍAS le
   aplica cada una a cada local vive aparte, por sucursal, en
   data/gestionTareasSucursal.js — la columna "dias" que todavía
   pueda quedar en la Sheet de GestionTareas (esquema viejo) no se lee
   ni se escribe más desde acá, queda inerte a propósito (evitar tocar
   el esquema de la Sheet a mano sin necesidad).

   Mismo patrón que data/cursos.js. subitems viaja como STRING
   separado por coma en la Sheet (mismo criterio que aplicaA/noAplicaA
   de Cursos) — acá se normaliza a array para el resto de la app y se
   aplana de vuelta a string al escribir.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { gestionTareasMock } from "./mock/gestionTareas.mock.js";
import { HOJAS } from "../config.js";

function aArray(valor) {
    return String(valor || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function normalizarTarea(f) {
    const subitems = aArray(f.subitems);
    return {
        // String SIEMPRE — la Sheet puede devolver el id como number
        // (ej. el Date.now() con el que se creó) y el resto de la app
        // lo usa como string (data-tarea-id en el HTML, siempre string
        // al leerlo de vuelta) — un Map.get() con el tipo que no
        // coincide falla en silencio, no tira error. Mismo bug real
        // que ya se ve en otros lados con comparaciones de id.
        id: String(f.id),
        icono: f.icono || "documento",
        titulo: f.titulo || "",
        detalle: f.detalle || "",
        // Omitido (no array vacío) a propósito: tareaHtml() en gestion.js
        // decide "tiene sub-ítems" con `if (t.subitems)` — un [] vacío es
        // truthy en JS y renderizaría un desplegable sin nada adentro.
        ...(subitems.length ? { subitems } : {}),
        // A quién le aplica esta tarea — mismo campo/semántica que
        // Cursos/Lecciones (data/cursos.js): lista separada por coma
        // de países, locales puntuales, y ahora también "Propios"/
        // "Franquicias" (ver services/alcance.js → aplicaASucursal).
        // Vacío = aplica a TODOS. La exclusión (noAplicaA) gana.
        aplicaA: String(f.aplicaA || "").trim(),
        noAplicaA: String(f.noAplicaA || "").trim(),
        // NO se lee "frecuencia" acá — se probó un rato viviendo en el
        // catálogo (2026-08-26) pero se movió a data/gestionTareasSucursal.js:
        // pedido explícito del usuario, Admin: "yo cargo la tarea, ellos
        // deciden si es mensual o semanal, no tengo que estar
        // modificando nada". Una columna "frecuencia" puede haber
        // quedado en la Sheet de ese intento — queda inerte a propósito,
        // mismo criterio que la columna vieja "dias" (ver arriba).
    };
}

/** subitems de array a string separado por coma, para la Sheet. */
function aFilaSheet({ icono, titulo, detalle, subitems, aplicaA, noAplicaA }) {
    return {
        icono,
        titulo,
        detalle,
        subitems: (subitems || []).join(","),
        aplicaA: aplicaA || "",
        noAplicaA: noAplicaA || "",
    };
}

export async function getTareas() {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_TAREAS, gestionTareasMock);
        return filas.map(normalizarTarea);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.GESTION_TAREAS}':`, err.message);
        return [];
    }
}

/** Devuelve la tarea normalizada ya creada (con el id real que asignó
 *  el backend), o null si falló. */
export async function crearTarea(tarea) {
    const r = await writeSheet(HOJAS.GESTION_TAREAS, aFilaSheet(tarea), gestionTareasMock);
    return r?.ok ? normalizarTarea(r.fila) : null;
}

export async function actualizarTarea(id, cambios) {
    return updateSheet(HOJAS.GESTION_TAREAS, id, aFilaSheet(cambios), gestionTareasMock);
}

export async function eliminarTarea(id) {
    return deleteSheet(HOJAS.GESTION_TAREAS, id, gestionTareasMock);
}
