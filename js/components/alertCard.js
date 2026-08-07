/* ============================
   Lucciano's Academy
   alertCard.js
=============================*/

import { Icon } from "./icons.js";

export function AlertCard({ titulo, detalle = "", severidad = "warning", icono = "alertas", accionLabel = null, accionHref = null }) {
    return `
        <div class="alert-card severity-${severidad}">
            <div class="alert-icon">${Icon(icono, { size: 18 })}</div>
            <div class="alert-body">
                <strong>${titulo}</strong>
                ${detalle ? `<p>${detalle}</p>` : ""}
                ${accionLabel && accionHref ? `<a class="btn btn-secondary" href="${accionHref}">${accionLabel}</a>` : ""}
            </div>
        </div>
    `;
}
