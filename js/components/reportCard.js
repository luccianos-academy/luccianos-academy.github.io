/* ============================
   FARO v4
   reportCard.js — tarjeta seleccionable del Centro de Reportes
=============================*/

import { Icon } from "./icons.js";

export function ReportCard({ id, titulo, descripcion, icono = "reportes", seleccionado = false }) {
    return `
        <div class="card report-card${seleccionado ? " selected" : ""}" data-report-id="${id}">
            ${Icon(icono, { size: 22 })}
            <h3>${titulo}</h3>
            <p class="text-sm text-muted">${descripcion}</p>
        </div>
    `;
}
