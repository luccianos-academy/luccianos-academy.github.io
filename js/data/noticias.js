/* ============================
   FARO v4
   data/noticias.js — Tabla "Noticias"
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { noticiasMock } from "./mock/noticias.mock.js";
import { HOJAS } from "../config.js";

function normalizarNoticia(f) {
    return {
        id: f.id,
        titulo: String(f.titulo || "").trim(),
        fecha: String(f.fecha || "").trim().slice(0, 10),
        resumen: String(f.resumen || "").trim(),
        // Todos opcionales — se completan solo si la noticia lo amerita
        // (ver pages/noticias.js): "detalle" es texto largo que se
        // muestra plegado, "enlace" es el id de un Curso para el botón
        // "Ir al curso", "adjuntoUrl" es un archivo (PDF, etc.) para el
        // botón "Ver adjunto" — ruta local (assets/docs/...) o link
        // externo, igual criterio que las fotos de Chocolatería. Si
        // están vacíos, la tarjeta se ve como antes.
        detalle: String(f.detalle || "").trim(),
        enlace: String(f.enlace || "").trim(),
        adjuntoUrl: String(f.adjuntoUrl || "").trim(),
        adjuntoLabel: String(f.adjuntoLabel || "").trim(),
    };
}

export async function getNoticias() {
    try {
        const filas = await fetchSheet(HOJAS.NOTICIAS, noticiasMock);
        return filas.map(normalizarNoticia).sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.NOTICIAS}':`, err.message);
        return [];
    }
}

export async function crearNoticia({ titulo, fecha, resumen, detalle, enlace, adjuntoUrl, adjuntoLabel }) {
    return writeSheet(HOJAS.NOTICIAS, { titulo, fecha, resumen, detalle: detalle || "", enlace: enlace || "", adjuntoUrl: adjuntoUrl || "", adjuntoLabel: adjuntoLabel || "" }, noticiasMock);
}

export async function actualizarNoticia(id, cambios) {
    return updateSheet(HOJAS.NOTICIAS, id, cambios, noticiasMock);
}

export async function eliminarNoticia(id) {
    return deleteSheet(HOJAS.NOTICIAS, id, noticiasMock);
}
