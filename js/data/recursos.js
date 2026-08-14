/* ============================
   Lucciano's Academy
   data/recursos.js — Tabla "Recursos" (accesos operativos externos)

   Directorio de links a herramientas que hoy viven fuera de la app
   (Sheets de Auditorías, Claims, Ponderados de Google, Relevamientos,
   etc. — antes reunidos a mano en un Google Sites aparte). Cada fila
   es un acceso: nombre, url externa, ícono y a quién se lo mostramos.

   "visiblePara" es una lista de roles separada por comas (mismo
   patrón que Noticias.visiblePara) — a propósito NO está atada a un
   solo rol: hoy todos los recursos cargados son para Supervisión,
   pero el campo ya admite sumar "colaborador" u otro rol el día que
   haga falta, sin cambiar código. Vacío = solo Supervisor (el uso
   actual), no "para todos" — a diferencia de Noticias, estos son
   accesos operativos, no conviene que un recurso quede expuesto por
   olvido de completar el campo.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { recursosMock } from "./mock/recursos.mock.js";
import { HOJAS } from "../config.js";

export const ICONOS_RECURSO = [
    { id: "evaluaciones", nombre: "Checklist" },
    { id: "alertas", nombre: "Alerta" },
    { id: "dashboard", nombre: "Métricas" },
    { id: "reportes", nombre: "Reporte" },
    { id: "integraciones", nombre: "Enlace" },
    { id: "configuracion", nombre: "Config" },
];

// Presets de combinaciones comunes para el selector — el campo real
// (visiblePara) queda como texto libre separado por comas, así que
// una fila cargada a mano en la Sheet puede usar cualquier combinación
// de roles aunque no esté en esta lista.
export const VISIBILIDAD_RECURSO_PRESETS = [
    { id: "supervisor", nombre: "Supervisores" },
    { id: "supervisor,capacitador", nombre: "Supervisores y Capacitadores" },
    { id: "capacitador", nombre: "Solo Capacitadores" },
    { id: "colaborador", nombre: "Colaboradores" },
    { id: "admin,supervisor,capacitador,colaborador", nombre: "Todos los roles" },
];

function normalizarRecurso(f) {
    return {
        id: f.id,
        nombre: String(f.nombre || "").trim(),
        url: String(f.url || "").trim(),
        icono: ICONOS_RECURSO.some((i) => i.id === f.icono) ? f.icono : "integraciones",
        visiblePara: String(f.visiblePara || "").trim(),
        creadoPor: String(f.creadoPor || "").trim(),
    };
}

export function puedeVerRecurso(recurso, usuario) {
    if (usuario.rol === "admin") return true;

    // Un Capacitador tiene rol "supervisor" en los datos, pero acá NO
    // cuenta como uno. Los presets de arriba ofrecen "Supervisores" y
    // "Supervisores y Capacitadores" como opciones separadas: si la
    // primera los incluyera, la segunda no tendría sentido.
    //
    // Antes entraba por roles.includes(usuario.rol), que da true con
    // "supervisor" — así que un recurso marcado sólo para supervisores
    // le aparecía igual. El default de abajo sí lo excluía desde
    // siempre; la inconsistencia estaba en el camino explícito, que es
    // justamente el que se usa cuando alguien quiere restringir algo.
    const esCapacitador = usuario.rol === "supervisor" && !!usuario.capacitador;

    const visiblePara = String(recurso.visiblePara || "").trim();
    if (!visiblePara) return usuario.rol === "supervisor" && !esCapacitador;

    const roles = visiblePara.split(",").map((r) => r.trim()).filter(Boolean);
    if (esCapacitador) return roles.includes("capacitador");
    return roles.includes(usuario.rol);
}

export async function getRecursos() {
    try {
        const filas = await fetchSheet(HOJAS.RECURSOS, recursosMock);
        return filas.map(normalizarRecurso).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.RECURSOS}':`, err.message);
        return [];
    }
}

/** Recursos visibles para un usuario — Admin ve todos (para poder
 *  gestionarlos), el resto queda filtrado por puedeVerRecurso. */
export async function getRecursosVisibles(usuario) {
    const todos = await getRecursos();
    if (usuario.rol === "admin") return todos;
    return todos.filter((r) => puedeVerRecurso(r, usuario));
}

export async function crearRecurso({ nombre, url, icono, creadoPor, visiblePara }) {
    return writeSheet(HOJAS.RECURSOS, {
        nombre, url, icono: icono || "integraciones",
        creadoPor: creadoPor || "", visiblePara: visiblePara || "",
    }, recursosMock);
}

export async function actualizarRecurso(id, cambios) {
    return updateSheet(HOJAS.RECURSOS, id, cambios, recursosMock);
}

export async function eliminarRecurso(id) {
    return deleteSheet(HOJAS.RECURSOS, id, recursosMock);
}
