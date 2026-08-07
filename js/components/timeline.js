/* ============================
   Lucciano's Academy
   timeline.js — línea de tiempo vertical (actividad/historial)

   eventos ya vienen ordenados por quien llama.
   eventos: [{ fecha, titulo, detalle }]
=============================*/

import { EmptyState } from "./emptyState.js";

export function Timeline(eventos) {

    if (!eventos.length) {
        return EmptyState({ titulo: "Sin actividad todavía", detalle: "Acá vas a ver los últimos eventos apenas haya movimiento." });
    }

    const items = eventos.map((e) => `
        <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
                <div class="text-sm text-muted">${formatearFecha(e.fecha)}</div>
                <strong>${e.titulo}</strong>
                ${e.detalle ? `<div class="text-sm text-muted">${e.detalle}</div>` : ""}
            </div>
        </div>
    `).join("");

    return `<div class="timeline">${items}</div>`;
}

function formatearFecha(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return fecha;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}
