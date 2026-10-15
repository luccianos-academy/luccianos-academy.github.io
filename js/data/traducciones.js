/* ============================
   Lucciano's Academy
   data/traducciones.js — Tabla "Traducciones"

   Las traducciones que el Admin escribe desde Configuración → Traducciones.
   Una fila por texto y por idioma: idioma ("en", "ar-MA"), es (el texto
   EXACTO en español, tal como está en la planilla) y traduccion.

   Se SUMAN a los diccionarios que vienen con la app (i18n/en.js,
   en.contenido.js…) y tienen prioridad sobre ellos: así se puede agregar o
   corregir una traducción sin subir una versión nueva. Si la hoja todavía no
   existe, no pasa nada: la app usa solo los diccionarios de siempre.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet, invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";

const traduccionesMock = [];

/** Sheets guarda con un apóstrofo delante los textos que empiezan con = + - @
 *  (defensa contra fórmulas, ver Code.gs). Es solo un escape: se saca al leer. */
function sinEscape(texto) {
    return String(texto ?? "").replace(/^'(?=[=+\-@])/, "");
}

function normalizar(f) {
    return {
        id: f.id,
        idioma: String(f.idioma || "").trim(),
        es: sinEscape(f.es),
        traduccion: sinEscape(f.traduccion),
    };
}

export async function getTraducciones() {
    try {
        const filas = await fetchSheet(HOJAS.TRADUCCIONES, traduccionesMock);
        return filas.map(normalizar).filter((f) => f.idioma && f.es.trim() && f.traduccion.trim());
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.TRADUCCIONES}':`, err.message);
        return [];
    }
}

/** Crea o actualiza la traducción de un texto en un idioma. */
export async function guardarTraduccion(idioma, es, traduccion, existentes) {
    const clave = es.trim();
    const yaEsta = (existentes || []).find((f) => f.idioma === idioma && f.es.trim() === clave);
    const r = yaEsta
        ? await updateSheet(HOJAS.TRADUCCIONES, yaEsta.id, { traduccion }, traduccionesMock)
        : await writeSheet(HOJAS.TRADUCCIONES, { idioma, es: clave, traduccion }, traduccionesMock);
    invalidar(HOJAS.TRADUCCIONES);
    return r;
}

export async function eliminarTraduccion(id) {
    const r = await deleteSheet(HOJAS.TRADUCCIONES, id, traduccionesMock);
    invalidar(HOJAS.TRADUCCIONES);
    return r;
}
