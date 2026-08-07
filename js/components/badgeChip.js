/* ============================
   Lucciano's Academy
   badgeChip.js — Insignia de logro (home del Colaborador)

   Los logros se derivan de datos reales (cursos completados,
   evaluaciones aprobadas) — no hay una tabla "Insignias": esto es
   una capa de presentación sobre asignaciones/resultados, igual
   criterio que las alertas o los rankings.
=============================*/

import { Icon } from "./icons.js";

export function BadgeChip({ icono, titulo, desbloqueado = true }) {
    return `
        <div class="badge-chip${desbloqueado ? "" : " locked"}">
            <div class="badge-chip-icon">
                ${Icon(desbloqueado ? icono : "candado", { size: 24 })}
            </div>
            <span>${titulo}</span>
        </div>
    `;
}
