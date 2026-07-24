/* ============================
   FARO v4
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

export async function registrarEvento(usuarioId, accion, detalle = "") {
    const fecha = new Date().toISOString();
    return writeSheet(HOJAS.AUDITORIA, { usuarioId, accion, detalle, fecha }, auditoriaMock).catch((err) => {
        console.warn("No se pudo registrar el evento de auditoría:", err.message);
    });
}
