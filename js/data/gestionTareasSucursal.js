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

/** { tareaId: { dias: [...], frecuencia } } para UNA sucursal —
 *  filtrado en el cliente, mismo criterio que el resto de hojas no
 *  sensibles de la app (leer todo, filtrar acá). El nombre de
 *  sucursal tiene que matchear EXACTO (ver la trampa del apóstrofo
 *  tipográfico documentada en la memoria del proyecto).
 *
 *  "frecuencia" (2026-08-26): "semanal" o "mensual", decidida por
 *  CADA LOCAL al asignar — no vive en el catálogo (data/gestionTareas.js),
 *  a propósito: "yo cargo la tarea, ellos deciden si es mensual o
 *  semanal" (pedido explícito del usuario, Admin). Sin fila para esa
 *  tarea en este local, cae a "semanal" (el comportamiento de
 *  siempre) — mismo criterio que "dias" vacío = "sin usar". */
export async function getDiasPorSucursal(sucursal) {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_TAREAS_SUCURSAL, gestionTareasSucursalMock);
        const propia = filas.filter((f) => String(f.sucursal || "").trim() === String(sucursal || "").trim());
        const mapa = {};
        propia.forEach((f) => {
            mapa[String(f.tareaId)] = { dias: aArray(f.dias), frecuencia: f.frecuencia === "mensual" ? "mensual" : "semanal" };
        });
        return mapa;
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.GESTION_TAREAS_SUCURSAL}':`, err.message);
        return {};
    }
}

/** Guarda los días Y la frecuencia de una tarea para MI sucursal (la
 *  del usuario en sesión — el backend la decide server-side, no viaja
 *  acá). Solo Responsable de local/turno pueden llamar esto con
 *  éxito. Los dos viajan juntos porque viven en la MISMA fila —
 *  cambiar solo los días (el caso normal, tocar una pill) preserva la
 *  frecuencia actual porque gestion.js siempre manda las dos, nunca
 *  solo una. */
export async function guardarDiasSucursal(tareaId, dias, sucursal, frecuencia = "semanal") {
    if (USE_MOCK_DATA) {
        // Modo demo: no hay backend que decida "mi sucursal" — se usa
        // la que pasa el caller (getUsuarioActual().sucursal), mismo
        // resultado que produciría el servidor.
        const existente = gestionTareasSucursalMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.sucursal) === String(sucursal));
        // Sin días Y "semanal" (el default implícito) no necesita
        // fila — pero "mensual" sin días todavía (recién elegida esa
        // frecuencia, sin tocar ningún día del mes aún) sí hay que
        // guardarlo, si no el próximo refresco la lee de nuevo como
        // "semanal" y pisa la elección real (bug real, reportado en
        // vivo con video, 2026-09-02).
        const nadaQueGuardar = !dias.length && frecuencia !== "mensual";
        if (existente) {
            if (nadaQueGuardar) gestionTareasSucursalMock.splice(gestionTareasSucursalMock.indexOf(existente), 1);
            else { existente.dias = dias.join(","); existente.frecuencia = frecuencia; }
        } else if (!nadaQueGuardar) {
            gestionTareasSucursalMock.push({ id: Date.now(), tareaId, sucursal, dias: dias.join(","), frecuencia });
        }
        return { ok: true };
    }
    const r = await actualizarDiasGestionSucursalReal(tareaId, dias, frecuencia);
    if (r?.ok) invalidar(HOJAS.GESTION_TAREAS_SUCURSAL);
    return r;
}
