/* ============================
   Lucciano's Academy
   data/gestionTareasSucursal.js — Fase 2 de Gestión semanal

   Separa el catálogo de tareas (data/gestionTareas.js — QUÉ tareas
   existen, solo lo edita Admin) de EN QUÉ DÍAS le aplica cada una a
   CADA sucursal — antes ese "dias" vivía en la propia fila del
   catálogo, compartido por toda la red (bug de diseño real: el
   Responsable de un local cambiaba el esquema de TODOS los locales
   sin darse cuenta). Ver apps-script/README.md para el esquema de la
   hoja "GestionTareasSucursal".
=============================*/

import { fetchSheet, invalidar } from "../services/dataSource.js";
import { actualizarDiasGestionSucursalReal } from "../services/google.js";
import { gestionTareasSucursalMock } from "./mock/gestionTareasSucursal.mock.js";
import { HOJAS, USE_MOCK_DATA } from "../config.js";

function aArray(valor) {
    return String(valor || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** { tareaId: [dias] } para UNA sucursal — filtrado en el cliente,
 *  mismo criterio que el resto de hojas no sensibles de la app (leer
 *  todo, filtrar acá). El nombre de sucursal tiene que matchear
 *  EXACTO (ver la trampa del apóstrofo tipográfico documentada en la
 *  memoria del proyecto). */
export async function getDiasPorSucursal(sucursal) {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_TAREAS_SUCURSAL, gestionTareasSucursalMock);
        const propia = filas.filter((f) => String(f.sucursal || "").trim() === String(sucursal || "").trim());
        const mapa = {};
        propia.forEach((f) => { mapa[String(f.tareaId)] = aArray(f.dias); });
        return mapa;
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.GESTION_TAREAS_SUCURSAL}':`, err.message);
        return {};
    }
}

/** Guarda los días de una tarea para MI sucursal (la del usuario en
 *  sesión — el backend la decide server-side, no viaja acá). Solo
 *  Responsable de local/turno pueden llamar esto con éxito. */
export async function guardarDiasSucursal(tareaId, dias, sucursal) {
    if (USE_MOCK_DATA) {
        // Modo demo: no hay backend que decida "mi sucursal" — se usa
        // la que pasa el caller (getUsuarioActual().sucursal), mismo
        // resultado que produciría el servidor.
        const existente = gestionTareasSucursalMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.sucursal) === String(sucursal));
        if (existente) {
            if (!dias.length) gestionTareasSucursalMock.splice(gestionTareasSucursalMock.indexOf(existente), 1);
            else existente.dias = dias.join(",");
        } else if (dias.length) {
            gestionTareasSucursalMock.push({ id: Date.now(), tareaId, sucursal, dias: dias.join(",") });
        }
        return { ok: true };
    }
    const r = await actualizarDiasGestionSucursalReal(tareaId, dias);
    if (r?.ok) invalidar(HOJAS.GESTION_TAREAS_SUCURSAL);
    return r;
}
