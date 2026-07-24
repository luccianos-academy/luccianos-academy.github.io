/* ============================
   FARO v4
   activityFeed.js — lista compacta de actividad reciente

   Distinto de Timeline: sin puntos/línea, pensado para ir dentro
   de un Inicio donde un Timeline completo pesaría demasiado.
   eventos: [{ fecha, texto }]
=============================*/

import { EmptyState } from "./emptyState.js";

export function ActivityFeed(eventos, { vacio = "Sin actividad reciente" } = {}) {

    if (!eventos.length) {
        return EmptyState({ titulo: vacio });
    }

    const items = eventos.map((e) => `
        <div class="activity-item">
            <span>${e.texto}</span>
            <span class="activity-time">${formatearFecha(e.fecha)}</span>
        </div>
    `).join("");

    return `<div class="activity-feed">${items}</div>`;
}

function formatearFecha(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return fecha;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
