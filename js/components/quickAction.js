/* ============================
   Lucciano's Academy
   quickAction.js — tile de acceso rápido (mismo criterio que
   Sidebar: un <a> real, no un botón + JS)
=============================*/

import { Icon } from "./icons.js";

export function QuickAction({ titulo, icono, href }) {
    return `
        <a class="quick-action" href="${href}">
            ${Icon(icono, { size: 22 })}
            <span>${titulo}</span>
        </a>
    `;
}
