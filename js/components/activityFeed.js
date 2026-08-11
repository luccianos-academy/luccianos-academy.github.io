/* ============================
   Lucciano's Academy
   activityFeed.js — lista compacta de actividad reciente

   Distinto de Timeline: sin puntos/línea, pensado para ir dentro
   de un Inicio donde un Timeline completo pesaría demasiado.
   eventos: [{ fecha, texto }]
=============================*/

import { EmptyState } from "./emptyState.js";
import { escaparHtml } from "../services/html.js";

export function ActivityFeed(eventos, { vacio = "Sin actividad reciente" } = {}) {

    if (!eventos.length) {
        return EmptyState({ titulo: vacio });
    }

    // e.texto sale del campo "detalle" de la hoja Auditoria, y la matriz
    // de permisos deja que un COLABORADOR cree filas ahí (PERMISOS_ESCRITURA
    // en apps-script/Code.gs). Este feed lo pinta el Inicio de Admin, el de
    // Supervisor y el Dashboard — o sea que sin escapar, alguien de bajo
    // privilegio podía guardar HTML en "detalle" y hacerlo ejecutar en la
    // sesión de un admin, con su token a mano. Es el mismo problema que
    // avatar.js, por otro camino.
    const items = eventos.map((e) => `
        <div class="activity-item">
            <span>${escaparHtml(e.texto)}</span>
            <span class="activity-time">${escaparHtml(formatearFecha(e.fecha))}</span>
        </div>
    `).join("");

    return `<div class="activity-feed">${items}</div>`;
}

function formatearFecha(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return fecha;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
