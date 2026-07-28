/* ============================
   FARO v4
   data/publicaciones.js — Tabla "Publicaciones" (Comunicaciones)

   Espacio de conversación entre Admin y Supervisores (incluye
   Capacitadores) — separado del centro de notificaciones
   (data/noticias.js), que es de solo avisos sin respuesta. Acá hay
   canales, comentarios (data/comentarios.js) y likes. Colaborador no
   participa (ver services/auth.js: MENU_POR_ROL/PERMISOS_PAGINA).

   "likesDe"/"leidoPor" son listas separadas por comas en la misma
   fila — mismo patrón que ya usa data/noticias.js, sin tabla nueva
   para eso.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { publicacionesMock } from "./mock/publicaciones.mock.js";
import { HOJAS } from "../config.js";

// Fijos (institucionales) + uno por cada categoría real de curso — así
// "Operaciones"/"Incidencias"/"Ideas"/"Anuncios" conviven con canales
// temáticos que ya existen en Academia, sin inventar una taxonomía
// paralela. Se puede ampliar la lista sin migrar nada (el canal de una
// publicación es solo un string).
export const CANALES = [
    { id: "anuncios", nombre: "Anuncios", icono: "noticias" },
    { id: "operaciones", nombre: "Operaciones", icono: "configuracion" },
    { id: "incidencias", nombre: "Incidencias", icono: "warning" },
    { id: "ideas", nombre: "Ideas", icono: "idea" },
    { id: "heladeria", nombre: "Heladería", icono: "helado" },
    { id: "cafeteria", nombre: "Cafetería", icono: "cafe" },
    { id: "chocolateria", nombre: "Chocolatería", icono: "chocolate" },
    { id: "pasteleria", nombre: "Pastelería", icono: "pastel" },
    { id: "icepops", nombre: "Icepops", icono: "icepop" },
    { id: "atencion-cliente", nombre: "Atención al Cliente", icono: "corazon" },
    { id: "sistema-caja", nombre: "Sistema y Caja", icono: "caja" },
];

export function canalInfo(canalId) {
    return CANALES.find((c) => c.id === canalId) || CANALES[0];
}

function normalizarPublicacion(f) {
    return {
        id: f.id,
        canal: String(f.canal || "anuncios").trim(),
        autorId: f.autorId,
        autorNombre: String(f.autorNombre || "").trim(),
        autorRol: String(f.autorRol || "").trim(),
        titulo: String(f.titulo || "").trim(),
        mensaje: String(f.mensaje || "").trim(),
        adjuntoUrl: String(f.adjuntoUrl || "").trim(),
        adjuntoLabel: String(f.adjuntoLabel || "").trim(),
        destacado: String(f.destacado || "").trim().toUpperCase() === "SI",
        requiereConfirmacion: String(f.requiereConfirmacion || "").trim().toUpperCase() === "SI",
        fecha: String(f.fecha || "").trim(),
        likesDe: String(f.likesDe || "").trim(),
        leidoPor: String(f.leidoPor || "").trim(),
    };
}

function listaIds(campo) {
    return String(campo || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function estaLikeada(publicacion, usuarioId) {
    return listaIds(publicacion.likesDe).includes(String(usuarioId));
}

export function estaLeidaPublicacion(publicacion, usuarioId) {
    return listaIds(publicacion.leidoPor).includes(String(usuarioId));
}

export async function getPublicaciones() {
    try {
        const filas = await fetchSheet(HOJAS.PUBLICACIONES, publicacionesMock);
        return filas.map(normalizarPublicacion).sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.PUBLICACIONES}':`, err.message);
        return [];
    }
}

export async function getPublicacionesDeCanal(canalId) {
    const todas = await getPublicaciones();
    return todas.filter((p) => p.canal === canalId);
}

export async function crearPublicacion({ canal, autorId, autorNombre, autorRol, titulo, mensaje, adjuntoUrl, adjuntoLabel, destacado, requiereConfirmacion }) {
    return writeSheet(HOJAS.PUBLICACIONES, {
        canal, autorId, autorNombre, autorRol, titulo, mensaje,
        adjuntoUrl: adjuntoUrl || "", adjuntoLabel: adjuntoLabel || "",
        destacado: destacado ? "SI" : "NO",
        requiereConfirmacion: requiereConfirmacion ? "SI" : "NO",
        fecha: new Date().toISOString(),
        likesDe: "", leidoPor: "",
    }, publicacionesMock);
}

export async function actualizarPublicacion(id, cambios) {
    return updateSheet(HOJAS.PUBLICACIONES, id, cambios, publicacionesMock);
}

export async function eliminarPublicacion(id) {
    return deleteSheet(HOJAS.PUBLICACIONES, id, publicacionesMock);
}

/** Toggle de like — agrega o saca al usuario de la lista, según si ya estaba. */
export async function toggleLikePublicacion(publicacion, usuarioId) {
    const actuales = listaIds(publicacion.likesDe);
    const idx = actuales.indexOf(String(usuarioId));
    if (idx === -1) actuales.push(String(usuarioId)); else actuales.splice(idx, 1);
    await actualizarPublicacion(publicacion.id, { likesDe: actuales.join(",") });
}

export async function marcarPublicacionLeida(publicacion, usuarioId) {
    if (estaLeidaPublicacion(publicacion, usuarioId)) return;
    const actuales = listaIds(publicacion.leidoPor);
    actuales.push(String(usuarioId));
    await actualizarPublicacion(publicacion.id, { leidoPor: actuales.join(",") });
}
