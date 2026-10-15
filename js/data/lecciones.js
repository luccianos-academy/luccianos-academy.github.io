/* ============================
   Lucciano's Academy
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
import { tc, esTraduccion } from "../i18n/i18n.js";

/** `traducir: false` devuelve los textos TAL COMO ESTÁN EN LA PLANILLA (en español):
 *  es lo que tiene que leer el editor de la Academia. Si el editor leyera el texto
 *  ya traducido, al guardar escribiría el inglés/dariya encima del español. */
function normalizarLeccion(f, traducir = true) {
    const tx = traducir ? tc : (x) => x;
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
        procedimiento: tx(f.procedimiento || ""),
        errores: tx(f.errores || ""),
        buenasPracticas: tx(f.buenasPracticas || ""),
        consejo: tx(f.consejo || ""),
        resumen: f.resumen || "",
        estado: f.estado || "Activo",
        // "NO" = no cuenta para el % de progreso ni para el examen, sin
        // botón de "Marcar como vista", siempre visible como contenido
        // de referencia (ver renderDetalleCurso, pages/cursos.js).
        // Pedido explícito: lecciones específicas de una máquina que no
        // todos los locales tienen (ej. una cafetera puntual) — la
        // alternativa de acotar por local con aplicaA/noAplicaA se
        // descartó ("hay que modificar cada local según máquina y es
        // una locura"). Vacío/cualquier otra cosa = obligatoria (default,
        // así las lecciones ya cargadas antes de este campo no cambian).
        obligatoria: String(f.obligatoria || "").trim().toUpperCase() === "NO" ? "NO" : "SI",
        // Alcance por país/local — ver services/alcance.js. Existe a
        // nivel LECCIÓN y no solo de curso porque el caso real es ese:
        // Cafetería le aplica a toda la red, pero la lección de batidos
        // no en Uruguay, que usa otra carta. VACÍO = le aplica a todos.
        aplicaA: String(f.aplicaA || "").trim(),
        // Ver la nota en data/cursos.js — mismo campo, misma semántica.
        noAplicaA: String(f.noAplicaA || "").trim(),
        // YYYY-MM-DD. Solo la completan las lecciones cargadas con
        // "Avisar como contenido nuevo" — es lo que dispara la etiqueta
        // "Nuevo" para quien ya tenía el curso (ver
        // services/contenidoNuevo.js). Vacío = nunca avisa.
        fechaPublicacion: String(f.fechaPublicacion || "").slice(0, 10),
    };
}

export async function getLecciones({ original = false } = {}) {
    try {
        const filas = await fetchSheet(HOJAS.LECCIONES, leccionesMock);
        return filas.map((f) => normalizarLeccion(f, !original)).sort((a, b) => a.orden - b.orden);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.LECCIONES}':`, err.message);
        return [];
    }
}

export async function getLeccionesPorCurso(cursoId, opciones) {
    const lecciones = await getLecciones(opciones);
    return lecciones.filter((l) => String(l.cursoId) === String(cursoId));
}

const CAMPOS_CON_TRADUCCION = ["procedimiento", "errores", "buenasPracticas", "consejo"];
/** Red de seguridad: un texto que es una TRADUCCIÓN conocida nunca se guarda como
 *  contenido de la planilla (la fuente es siempre el español). */
function hayTraduccion(campos) {
    return CAMPOS_CON_TRADUCCION.some((c) => typeof campos[c] === "string" && esTraduccion(campos[c]));
}
const ERROR_TRADUCCION = { ok: false, error: "Ese texto es una traducción: la lección se edita siempre en español. Cambiá el idioma a Español en Mi perfil y volvé a abrirla." };

export async function crearLeccion({
    cursoId, orden = 0, titulo, objetivo = "", duracionMinutos = 0,
    video = "", manual = "", manualLabel = "", imagen = "", procedimiento = "",
    errores = "", buenasPracticas = "", consejo = "", resumen = "", estado = "Activo",
    // Sin estos dos, "Duplicar para…" creaba la copia SIN alcance: la
    // variante de Chile le aparecía a todo el mundo, incluida España,
    // que además veía las dos versiones. El destructuring descarta en
    // silencio lo que no está nombrado acá.
    aplicaA = "", noAplicaA = "",
    obligatoria = "SI",
    fechaPublicacion = "",
}) {
    if (hayTraduccion({ procedimiento, errores, buenasPracticas, consejo })) return ERROR_TRADUCCION;
    return writeSheet(HOJAS.LECCIONES, {
        cursoId, orden, titulo, objetivo, duracionMinutos,
        video, manual, manualLabel, imagen, procedimiento, errores,
        buenasPracticas, consejo, resumen, estado, aplicaA, noAplicaA, obligatoria, fechaPublicacion,
    }, leccionesMock);
}

export async function actualizarLeccion(id, cambios) {
    if (hayTraduccion(cambios)) return ERROR_TRADUCCION;
    return updateSheet(HOJAS.LECCIONES, id, cambios, leccionesMock);
}

export async function eliminarLeccion(id) {
    return deleteSheet(HOJAS.LECCIONES, id, leccionesMock);
}
