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

   Ciclo / candado / firma por ítem / Histórico (2026-08-31) — pedido
   explícito del usuario: el reset de ciclo, el "cerrada" que bloquea
   una tarea ya completa (con "Reabrir" solo para Admin), y quién marcó
   CADA sub-ítem puntual, no solo quién guardó por última vez. El
   servidor (apps-script/Code.gs, actualizarCheckGestion) decide ciclo/
   cerrada/firmas — acá solo se pasan a través y, en modo mock, se
   reproduce la MISMA lógica para poder probar sin backend real.
=============================*/

import { fetchSheet, invalidar } from "../services/dataSource.js";
import { actualizarCheckGestionReal, reabrirTareaGestionReal, obtenerHistoricoGestionReal, eliminarHistoricoGestionReal, obtenerHorarioRecordatorioGestionReal, guardarHorarioRecordatorioGestionReal } from "../services/google.js";
import { getUsuarioActual } from "../services/auth.js";
import { gestionChecksMock } from "./mock/gestionChecks.mock.js";
import { gestionTareasSucursalMock } from "./mock/gestionTareasSucursal.mock.js";
import { HOJAS, USE_MOCK_DATA } from "../config.js";
import { parsearMarcaSubitem, parsearFirmaSubitem, serializarFirmaSubitem } from "../services/subitems.js";
import { cicloActual } from "../services/gestionCiclo.js";

function horaAhoraMock() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function frecuenciaMock(tareaId, sucursal) {
    const fila = gestionTareasSucursalMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.sucursal) === String(sucursal));
    return fila?.frecuencia === "mensual" ? "mensual" : "semanal";
}

function indicesDeSubitems(csv) {
    return String(csv || "").split(",").filter(Boolean).map((e) => e.split(":")[0]);
}

/** { "tareaId|dia": {marcadoPor, hora, hecho, marcas: Map<indice, marca>,
 *  firmas: Map<indice, {nombre,hora}>, ciclo, cerrada, cerradaPor,
 *  cerradaHora} } para UNA sucursal, filtrado en el cliente (mismo
 *  criterio que gestionTareasSucursal.js). Entra CUALQUIER fila de la
 *  sucursal, completa o a medias, de CUALQUIER ciclo — filtrar al
 *  ciclo actual es responsabilidad de quien arma "Tareas asignadas"
 *  (gestion.js, cargarDatos: ahí es donde ya se conoce t.frecuencia
 *  por tarea, necesaria para saber CUÁL es "el ciclo actual" de cada
 *  fila puntual). El Histórico (ciclos viejos) usa
 *  obtenerHistoricoGestion en vez de esto. */
export async function getChecksPorSucursal(sucursal) {
    try {
        const filas = await fetchSheet(HOJAS.GESTION_CHECKS, gestionChecksMock);
        const propios = filas.filter((f) => String(f.sucursal || "").trim() === String(sucursal || "").trim());
        const mapa = {};
        propios.forEach((f) => {
            // Puede haber MÁS de una fila para el mismo tareaId+dia —
            // una por ciclo, a propósito (ver Histórico). Si dos
            // colisionan acá, se queda la del ciclo MÁS RECIENTE
            // ("AAAA-MM-DD"/"AAAA-MM" ordenan bien como texto) — es la
            // única candidata a ser "el ciclo actual"; cargarDatos()
            // (gestion.js) decide después si esa fila corresponde de
            // verdad al ciclo de hoy o si ya quedó vieja.
            const clave = `${f.tareaId}|${f.dia}`;
            if (mapa[clave] && String(mapa[clave].ciclo || "") >= String(f.ciclo || "")) return;
            const marcas = new Map();
            String(f.subitemsMarcados || "").split(",").filter(Boolean).forEach((entrada) => {
                const marca = parsearMarcaSubitem(entrada);
                marcas.set(marca.indice, marca);
            });
            const firmas = new Map();
            String(f.subitemsFirmas || "").split(",").filter(Boolean).forEach((entrada) => {
                const firma = parsearFirmaSubitem(entrada);
                firmas.set(firma.indice, firma);
            });
            mapa[clave] = {
                marcadoPor: f.marcadoPor || "",
                hora: f.hora || "",
                hecho: String(f.hecho).toUpperCase() === "SI",
                marcas,
                firmas,
                ciclo: f.ciclo || "",
                cerrada: String(f.cerrada).toUpperCase() === "SI",
                cerradaPor: f.cerradaPor || "",
                cerradaHora: f.cerradaHora || "",
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
 *  sub-ítems, esté completa o no; para tareas simples se omite.
 *
 *  Rechaza el guardado ({ok:false, error}) si la tarea ya está
 *  "cerrada" (candado, ver reabrirTareaGestion) — mismo chequeo que
 *  hace el servidor, replicado acá para el modo mock. */
export async function guardarCheckSucursal(tareaId, dia, hecho, sucursal, subitemsMarcados) {
    if (USE_MOCK_DATA) {
        // El ciclo se calcula ANTES de buscar "existente": la fila a
        // tocar es la de ESTE ciclo — sin esto, el primer guardado de
        // una semana/mes nuevo pisaba la fila del ciclo anterior en vez
        // de crear una nueva, y esa fila vieja (que tiene que quedar
        // disponible para "Histórico") se perdía sin dejar rastro.
        const ciclo = cicloActual(frecuenciaMock(tareaId, sucursal));
        const existente = gestionChecksMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.dia) === String(dia) && String(f.sucursal) === String(sucursal) && String(f.ciclo) === String(ciclo));
        if (existente && String(existente.cerrada).toUpperCase() === "SI") {
            return { ok: false, error: "Esta tarea ya está cerrada. Pedile a un Admin que la reabra si hace falta corregir algo." };
        }

        const listaSubitems = subitemsMarcados !== undefined ? subitemsMarcados.join(",") : undefined;
        if (!hecho && !listaSubitems) {
            if (existente) gestionChecksMock.splice(gestionChecksMock.indexOf(existente), 1);
            return { ok: true };
        }

        // Mismo criterio que el backend real (Code.gs, actualizarCheckGestion):
        // marcadoPor/hora se pisan en CADA guardado, no solo al crear —
        // así el mock refleja quién guardó por última vez, no siempre
        // "Vos" con hora vacía.
        const nombre = getUsuarioActual()?.nombre || getUsuarioActual()?.email || "Vos";
        const hora = horaAhoraMock();

        const datos = { hecho: hecho ? "SI" : "NO", marcadoPor: nombre, hora, ciclo };

        if (listaSubitems !== undefined) {
            datos.subitemsMarcados = listaSubitems;
            // Firma por ítem — un índice ya marcado antes conserva su
            // firma original; solo los NUEVOS en este guardado se
            // firman con quien guarda ahora (ver Code.gs para el
            // mismo diff del lado real).
            const indicesAntes = new Set(indicesDeSubitems(existente?.subitemsMarcados));
            const firmasAntes = new Map();
            String(existente?.subitemsFirmas || "").split(",").filter(Boolean).forEach((entrada) => {
                const f = parsearFirmaSubitem(entrada);
                firmasAntes.set(f.indice, f);
            });
            datos.subitemsFirmas = indicesDeSubitems(listaSubitems).map((indice) => {
                const previa = firmasAntes.get(indice);
                if (indicesAntes.has(indice) && previa) return serializarFirmaSubitem(indice, previa.nombre, previa.hora);
                return serializarFirmaSubitem(indice, nombre, hora);
            }).join(",");
        }

        if (hecho) {
            datos.cerrada = "SI";
            datos.cerradaPor = nombre;
            datos.cerradaHora = hora;
        }

        if (existente) Object.assign(existente, datos);
        else gestionChecksMock.push({ id: Date.now(), tareaId, sucursal, dia, ...datos });
        return { ok: true };
    }
    const r = await actualizarCheckGestionReal(tareaId, dia, hecho, subitemsMarcados !== undefined ? subitemsMarcados.join(",") : undefined);
    if (r?.ok) invalidar(HOJAS.GESTION_CHECKS);
    return r;
}

/** Reabre una tarea cerrada — solo Admin. No toca hecho/subitems ya
 *  guardados, solo el candado. */
export async function reabrirTareaGestion(tareaId, dia, sucursal) {
    if (USE_MOCK_DATA) {
        // Mismo criterio que guardarCheckSucursal: la fila a destrabar
        // es la del CICLO ACTUAL, no una vieja del mismo tareaId+dia.
        const ciclo = cicloActual(frecuenciaMock(tareaId, sucursal));
        const existente = gestionChecksMock.find((f) => String(f.tareaId) === String(tareaId) && String(f.dia) === String(dia) && String(f.sucursal) === String(sucursal) && String(f.ciclo) === String(ciclo));
        if (!existente) return { ok: false, error: "No se encontró esa tarea guardada." };
        existente.cerrada = "NO";
        return { ok: true };
    }
    const r = await reabrirTareaGestionReal(tareaId, dia, sucursal);
    if (r?.ok) invalidar(HOJAS.GESTION_CHECKS);
    return r;
}

/** Ciclos YA CERRADOS ("Histórico") de una sucursal — Responsable de
 *  local no manda "sucursal" (usa la propia, undefined acá); Admin/
 *  Supervisor sí, la que eligieron en el selector. Devuelve el array
 *  crudo de filas (o [] si algo falla) — el agrupado por ciclo se arma
 *  en gestion.js, con etiquetaCiclo (services/gestionCiclo.js). */
export async function getHistoricoGestion(sucursal) {
    if (USE_MOCK_DATA) {
        const suc = sucursal || getUsuarioActual()?.sucursal || "";
        const propios = gestionChecksMock.filter((f) => String(f.sucursal || "").trim() === String(suc).trim());
        return propios.filter((f) => {
            if (!f.ciclo) return false;
            const actual = cicloActual(frecuenciaMock(f.tareaId, suc));
            return f.ciclo !== actual;
        });
    }
    try {
        const r = await obtenerHistoricoGestionReal(sucursal);
        return Array.isArray(r) ? r : [];
    } catch (err) {
        console.warn("No se pudo leer el histórico de Gestión:", err.message);
        return [];
    }
}

/** Borra TODAS las filas de un ciclo del Histórico, de MI sucursal. */
export async function eliminarHistoricoGestion(ciclo, sucursal) {
    if (USE_MOCK_DATA) {
        const suc = sucursal || getUsuarioActual()?.sucursal || "";
        const aBorrar = gestionChecksMock.filter((f) => String(f.sucursal || "").trim() === String(suc).trim() && String(f.ciclo) === String(ciclo));
        aBorrar.forEach((f) => gestionChecksMock.splice(gestionChecksMock.indexOf(f), 1));
        return { ok: true, borradas: aBorrar.length };
    }
    const r = await eliminarHistoricoGestionReal(ciclo);
    if (r?.ok) invalidar(HOJAS.GESTION_CHECKS);
    return r;
}

/** Horario del recordatorio automático (10am por default) — solo
 *  Admin. En modo mock vive en memoria (se resetea al recargar la
 *  página), no persiste de verdad: alcanza para probar el control en
 *  la app sin backend real. */
let horaRecordatorioMock = 10;

export async function getHorarioRecordatorioGestion() {
    if (USE_MOCK_DATA) return { ok: true, hora: horaRecordatorioMock };
    return obtenerHorarioRecordatorioGestionReal();
}

export async function guardarHorarioRecordatorioGestion(hora) {
    if (USE_MOCK_DATA) {
        horaRecordatorioMock = Number(hora);
        return { ok: true, hora: horaRecordatorioMock };
    }
    return guardarHorarioRecordatorioGestionReal(hora);
}
