/* ============================
   Lucciano's Academy
   data/gestionChecks.js — Check "hecho" persistido de Gestión semanal

   Antes el tilde de "hecho" era puramente visual — vivía en el
   navegador de quien lo tocaba, se perdía al recargar, y dos personas
   viendo el mismo local en dispositivos distintos no se veían entre sí
   (bug real reportado en vivo: "quien dio el marcado no le aparece al
   otro"). Guarda el estado GLOBAL de la tarea (completa o no) — ver
   apps-script/README.md.

   subitemsMarcados (2026-08-26): además del booleano global, ahora
   también guarda QUÉ sub-ítems están tildados (columna
   "subitemsMarcados", string "0,2,4") — antes una tarea con checklist
   a mitad de camino (nunca llegó a completa) no tenía ninguna fila
   guardada, y ese progreso se perdía con cualquier recarga de la app
   ("quedaba todo desmarcado", reportado en vivo). Ahora se guarda
   pase lo que pase, esté completa o no.

   Sub-ítems con estado/valor (2026-08-26, mismo día): cada entrada de
   subitemsMarcados puede traer más que el índice — "1:inc:Faltante"
   (3 estados) o "5:n:-320" (numérico), ver services/subitems.js. Acá
   solo se PARSEA cada entrada a un objeto; toda la lógica de qué
   significa cada tipo vive en ese servicio, no acá.
=============================*/

import { fetchSheet, invalidar } from "../services/dataSource.js";
import { actualizarCheckGestionReal } from "../services/google.js";
import { getUsuarioActual } from "../services/auth.js";
import { gestionChecksMock } from "./mock/gestionChecks.mock.js";
import { HOJAS, USE_MOCK_DATA } from "../config.js";
import { parsearMarcaSubitem } from "../services/subitems.js";

function horaAhoraMock() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** { "tareaId|dia": {marcadoPor, hora, hecho, marcas: Map<indice, marca>} }
 *  para UNA sucursal, filtrado en el cliente (mismo criterio que
 *  gestionTareasSucursal.js). Antes solo entraban las filas con
 *  hecho=SI (la tarea COMPLETA); ahora entra cualquier fila de la
 *  sucursal, completa o a medias — hecho/marcas quedan disponibles
 *  para que quien lea decida qué mostrar en cada caso. */
export async function getChecksPorSucursal(sucursal) {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_CHECKS, gestionChecksMock);
        const propios = filas.filter((f) => String(f.sucursal || "").trim() === String(sucursal || "").trim());
        const mapa = {};
        propios.forEach((f) => {
            const marcas = new Map();
            String(f.subitemsMarcados || "").split(",").filter(Boolean).forEach((entrada) => {
                const marca = parsearMarcaSubitem(entrada);
                marcas.set(marca.indice, marca);
            });
            mapa[`${f.tareaId}|${f.dia}`] = {
                marcadoPor: f.marcadoPor || "",
                hora: f.hora || "",
                hecho: String(f.hecho).toUpperCase() === "SI",
                marcas,
            };
        });
        return mapa;
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.GESTION_CHECKS}':`, err.message);
        return {};
    }
}

/** Guarda (o borra, si hecho=false y sin sub-ítems) el check de una
 *  tarea para un día, en MI sucursal (la decide el backend).
 *  subitemsMarcados (opcional): array de índices tildados de una
 *  tarea con checklist — se manda SIEMPRE que la tarea tenga
 *  sub-ítems, esté completa o no; para tareas simples se omite. */
export async function guardarCheckSucursal(tareaId, dia, hecho, sucursal, subitemsMarcados) {
    if (USE_MOCK_DATA) {
        const existente = gestionChecksMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.dia) === String(dia) && String(f.sucursal) === String(sucursal));
        const listaSubitems = subitemsMarcados !== undefined ? subitemsMarcados.join(",") : undefined;
        if (!hecho && !listaSubitems) {
            if (existente) gestionChecksMock.splice(gestionChecksMock.indexOf(existente), 1);
        } else {
            // Mismo criterio que el backend real (Code.gs, actualizarCheckGestion):
            // marcadoPor/hora se pisan en CADA guardado, no solo al crear —
            // así el mock refleja quién guardó por última vez, no siempre
            // "Vos" con hora vacía.
            const nombre = getUsuarioActual()?.nombre || getUsuarioActual()?.email || "Vos";
            const hora = horaAhoraMock();
            if (existente) {
                existente.hecho = hecho ? "SI" : "NO";
                existente.marcadoPor = nombre;
                existente.hora = hora;
                if (listaSubitems !== undefined) existente.subitemsMarcados = listaSubitems;
            } else {
                gestionChecksMock.push({ id: Date.now(), tareaId, sucursal, dia, hecho: hecho ? "SI" : "NO", marcadoPor: nombre, hora, subitemsMarcados: listaSubitems || "" });
            }
        }
        return { ok: true };
    }
    const r = await actualizarCheckGestionReal(tareaId, dia, hecho, subitemsMarcados !== undefined ? subitemsMarcados.join(",") : undefined);
    if (r?.ok) invalidar(HOJAS.GESTION_CHECKS);
    return r;
}
