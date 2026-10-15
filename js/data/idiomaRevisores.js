/* ============================
   Lucciano's Academy
   data/idiomaRevisores.js — Quién puede ver los idiomas nuevos mientras son vista previa

   Mientras un idioma está en vista previa (IDIOMAS_EN_VISTA_PREVIA, config.js)
   solo lo ven las personas fijas (REVISORES_FIJOS) más las que el Admin tilde en
   Configuración. Esa segunda lista se guarda en la hoja "Disponibilidad", en
   UNA fila reservada: curso "__app", producto "ingles-revisores", y en
   "aplicaA" los ids de usuario separados por coma.

   Se usa esa hoja a propósito: ya la puede escribir el Admin y leer cualquier
   persona con sesión, así que no hace falta tocar el backend ni agregar
   columnas. La fila no se parece a ningún producto del catálogo, así que
   ninguna pantalla de disponibilidad la muestra. Guarda ids (números), no
   emails ni nombres.
=============================*/

import { getDisponibilidad, guardarDisponibilidad } from "./disponibilidad.js";
import { invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";

const CURSO = "__app";
const PRODUCTO = "ingles-revisores";
const VIGENCIA_MS = 5 * 60 * 1000;

const CLAVE_CACHE = "faro_ingles_habilitados";

let ids = null;     // null = todavía no se leyó en esta sesión de la página
let leidoEn = 0;

/** Última lista conocida, guardada en el dispositivo: así la decisión de idioma
 *  al abrir la app es inmediata (sin esperar a la red) y se corrige apenas llega
 *  la lista fresca. */
function listaGuardada() {
    try { return aLista(JSON.parse(localStorage.getItem(CLAVE_CACHE) || "[]").join(",")); } catch { return []; }
}
function guardarLista(lista) {
    try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
}

function aLista(texto) {
    return String(texto || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Lo ya leído (síncrono): la lista de esta sesión o, si todavía no llegó, la
 *  última guardada en el dispositivo. */
export function revisoresInglesActuales() {
    return ids || listaGuardada();
}

/** Lee la lista (con una vigencia corta, para no pedirla en cada pantalla). */
export async function cargarRevisoresIngles(forzar = false) {
    if (!forzar && ids && Date.now() - leidoEn < VIGENCIA_MS) return ids;
    const filas = await getDisponibilidad();
    const fila = filas.find((f) => f.curso === CURSO && f.producto === PRODUCTO);
    ids = aLista(fila?.aplicaA);
    leidoEn = Date.now();
    guardarLista(ids);
    return ids;
}

/** Guarda la lista completa (reemplaza la anterior). Solo Admin. */
export async function guardarRevisoresIngles(lista) {
    const limpia = [...new Set(lista.map((x) => String(x).trim()).filter(Boolean))];
    invalidar(HOJAS.DISPONIBILIDAD);
    const existentes = await getDisponibilidad();
    const r = await guardarDisponibilidad(CURSO, PRODUCTO, { aplicaA: limpia.join(","), noAplicaA: "" }, existentes);
    if (r?.ok) { ids = limpia; leidoEn = Date.now(); guardarLista(limpia); }
    return r;
}
