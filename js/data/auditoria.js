/* ============================
   Lucciano's Academy
   data/auditoria.js — Tabla "Auditoria"
   Registro de acciones (login, altas, cambios de acceso).
=============================*/

import { fetchSheet, writeSheet } from "../services/dataSource.js";
import { auditoriaMock } from "./mock/auditoria.mock.js";
import { HOJAS } from "../config.js";

export async function getAuditoria() {
    try {
        const filas = await fetchSheet(HOJAS.AUDITORIA, auditoriaMock);
        return filas.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.AUDITORIA}':`, err.message);
        return [];
    }
}

/**
 * Cambia los ids que quedaron escritos en el detalle por el nombre de
 * la persona.
 *
 * Los eventos se guardan con textos como "Acceso renovado (usuario
 * 1786486477496)", así que la pantalla de actividad mostraba números
 * que no le dicen nada a nadie. Reportado en vivo: "no puedo saber a
 * quién envié si me sale el id, debe decir nombre de usuario".
 *
 * Se resuelve al DIBUJAR y no al guardar, así también quedan legibles
 * los eventos que ya están escritos en la planilla.
 */
export function detalleConNombres(detalle, usuarios) {
    let texto = String(detalle || "");
    if (!texto || !usuarios?.length) return texto;

    // Los ids son Date.now(): 13 dígitos, a veces con cola decimal que
    // le agrega la planilla (ver services/ids.js).
    return texto.replace(/\b(\d{9,})(?:\.\d+)?\b/g, (match, entero) => {
        const u = usuarios.find((x) => String(x.id).split(".")[0] === entero);
        return u ? u.nombre : match;
    });
}

export async function registrarEvento(usuarioId, accion, detalle = "") {
    const fecha = new Date().toISOString();
    return writeSheet(HOJAS.AUDITORIA, { usuarioId, accion, detalle, fecha }, auditoriaMock).catch((err) => {
        console.warn("No se pudo registrar el evento de auditoría:", err.message);
    });
}
