/* ============================
   Lucciano's Academy
   data/gestionChecks.js — Check "hecho" persistido de Gestión semanal

   Antes el tilde de "hecho" era puramente visual — vivía en el
   navegador de quien lo tocaba, se perdía al recargar, y dos personas
   viendo el mismo local en dispositivos distintos no se veían entre sí
   (bug real reportado en vivo: "quien dio el marcado no le aparece al
   otro"). Guarda el estado GLOBAL de la tarea (completa o no), no el
   detalle de cada sub-ítem — ver apps-script/README.md.
=============================*/

import { fetchSheet, invalidar } from "../services/dataSource.js";
import { actualizarCheckGestionReal } from "../services/google.js";
import { gestionChecksMock } from "./mock/gestionChecks.mock.js";
import { HOJAS, USE_MOCK_DATA } from "../config.js";

/** { "tareaId|dia": {marcadoPor, hora} } para UNA sucursal — filtrado
 *  en el cliente, mismo criterio que gestionTareasSucursal.js. */
export async function getChecksPorSucursal(sucursal) {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_CHECKS, gestionChecksMock);
        const propios = filas.filter((f) => String(f.sucursal || "").trim() === String(sucursal || "").trim() && String(f.hecho).toUpperCase() === "SI");
        const mapa = {};
        propios.forEach((f) => { mapa[`${f.tareaId}|${f.dia}`] = { marcadoPor: f.marcadoPor || "", hora: f.hora || "" }; });
        return mapa;
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.GESTION_CHECKS}':`, err.message);
        return {};
    }
}

/** Guarda (hecho=true) o borra (hecho=false) el check de una tarea
 *  para un día, en MI sucursal (la decide el backend). */
export async function guardarCheckSucursal(tareaId, dia, hecho, sucursal) {
    if (USE_MOCK_DATA) {
        const existente = gestionChecksMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.dia) === String(dia) && String(f.sucursal) === String(sucursal));
        if (!hecho) {
            if (existente) gestionChecksMock.splice(gestionChecksMock.indexOf(existente), 1);
        } else if (existente) {
            existente.hecho = "SI";
        } else {
            gestionChecksMock.push({ id: Date.now(), tareaId, sucursal, dia, hecho: "SI", marcadoPor: "Vos", hora: "" });
        }
        return { ok: true };
    }
    const r = await actualizarCheckGestionReal(tareaId, dia, hecho);
    if (r?.ok) invalidar(HOJAS.GESTION_CHECKS);
    return r;
}
