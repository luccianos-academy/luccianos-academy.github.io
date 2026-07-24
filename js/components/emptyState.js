/* ============================
   FARO v4
   emptyState.js — Estado vacío reutilizable

   Reemplaza los bloques ".placeholder" que antes se escribían a
   mano en cada página (ui.js, notFound.js, inicioColaborador.js).
   Reutiliza la clase .placeholder existente: no hace falta CSS
   nuevo, solo dos slots opcionales (ícono y acción).
=============================*/

import { Icon } from "./icons.js";

export function EmptyState({ titulo, detalle = "", icono = null, accionLabel = null, accionHref = null }) {
    return `
        <div class="placeholder">
            ${icono ? `<div class="empty-icon">${Icon(icono, { size: 32 })}</div>` : ""}
            <strong>${titulo}</strong>
            ${detalle}
            ${accionLabel && accionHref ? `<div class="empty-action"><a class="btn btn-primary" href="${accionHref}">${accionLabel}</a></div>` : ""}
        </div>
    `;
}
