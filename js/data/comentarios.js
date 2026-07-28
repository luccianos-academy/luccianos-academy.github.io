/* ============================
   FARO v4
   data/comentarios.js — Tabla "Comentarios" (Comunicaciones)

   Hijos de una fila de Publicaciones (mismo criterio que Asignaciones/
   Resultados: fila propia por comentario, referenciando publicacionId
   — no una lista en una celda, porque el volumen de comentarios no
   tiene techo fijo).
=============================*/

import { fetchSheet, writeSheet, deleteSheet, updateSheet } from "../services/dataSource.js";
import { comentariosMock } from "./mock/comentarios.mock.js";
import { HOJAS } from "../config.js";

function normalizarComentario(f) {
    return {
        id: f.id,
        publicacionId: f.publicacionId,
        autorId: f.autorId,
        autorNombre: String(f.autorNombre || "").trim(),
        texto: String(f.texto || "").trim(),
        fecha: String(f.fecha || "").trim(),
        likesDe: String(f.likesDe || "").trim(),
    };
}

export function estaLikeadoComentario(comentario, usuarioId) {
    return String(comentario.likesDe || "").split(",").map((s) => s.trim()).filter(Boolean).includes(String(usuarioId));
}

export async function getComentarios() {
    try {
        const filas = await fetchSheet(HOJAS.COMENTARIOS, comentariosMock);
        return filas.map(normalizarComentario).sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.COMENTARIOS}':`, err.message);
        return [];
    }
}

export async function getComentariosDePublicacion(publicacionId) {
    const todos = await getComentarios();
    return todos.filter((c) => String(c.publicacionId) === String(publicacionId));
}

export async function crearComentario({ publicacionId, autorId, autorNombre, texto }) {
    return writeSheet(HOJAS.COMENTARIOS, {
        publicacionId, autorId, autorNombre, texto,
        fecha: new Date().toISOString(), likesDe: "",
    }, comentariosMock);
}

export async function eliminarComentario(id) {
    return deleteSheet(HOJAS.COMENTARIOS, id, comentariosMock);
}

export async function toggleLikeComentario(comentario, usuarioId) {
    const actuales = String(comentario.likesDe || "").split(",").map((s) => s.trim()).filter(Boolean);
    const idx = actuales.indexOf(String(usuarioId));
    if (idx === -1) actuales.push(String(usuarioId)); else actuales.splice(idx, 1);
    await updateSheet(HOJAS.COMENTARIOS, comentario.id, { likesDe: actuales.join(",") }, comentariosMock);
}
