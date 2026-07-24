/* ============================
   FARO v4
   pages/configuracion.js — Configuración (Admin)

   Hub de accesos secundarios: Integraciones, Nuestra Historia,
   Evaluaciones, Reportes y Alertas dejaron de tener entrada propia en
   el sidebar (quedaba con 15 ítems sueltos, "un lío" según feedback
   real) — siguen siendo las mismas rutas de siempre (mismo
   PERMISOS_PAGINA, sin cambios ahí), solo que ahora se llega a ellas
   desde acá en vez de un link directo en el menú.
=============================*/

import { Header } from "../components/header.js";
import { QuickAction } from "../components/quickAction.js";

const ACCESOS = [
    { titulo: "Integraciones", icono: "integraciones", href: "#/integraciones" },
    { titulo: "Nuestra Historia", icono: "historia", href: "#/historia" },
    { titulo: "Evaluaciones", icono: "evaluaciones", href: "#/evaluaciones" },
    { titulo: "Reportes", icono: "reportes", href: "#/reportes" },
    { titulo: "Alertas", icono: "alertas", href: "#/alertas" },
];

export async function Configuracion() {
    return `
        ${Header("Configuración", "Accesos e integraciones de la plataforma")}
        <div class="quick-actions">
            ${ACCESOS.map((a) => QuickAction(a)).join("")}
        </div>
    `;
}
