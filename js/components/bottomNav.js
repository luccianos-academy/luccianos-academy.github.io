/* ============================
   FARO v4
   bottomNav.js — Tabs inferiores (mobile, Colaborador)

   Directo del mockup: Inicio · Aprender · Evaluaciones · Perfil fijos
   abajo, para que el Colaborador salte directo a lo que busca en vez
   de scrollear todo el Inicio para encontrarlo. Solo Colaborador —
   Admin/Supervisor tienen muchas más secciones de las que entran en
   4 tabs y ya navegan bien por el sidebar (siempre visible en
   desktop, drawer en mobile).
=============================*/

import { Icon } from "./icons.js";
import { getUsuarioActual } from "../services/auth.js";

const TABS = [
    { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
    { id: "cursos", label: "Aprender", icono: "academia", href: "#/cursos" },
    { id: "misevaluaciones", label: "Evaluaciones", icono: "evaluaciones", href: "#/misevaluaciones" },
    { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
];

export function BottomNav(rutaActiva) {
    const usuario = getUsuarioActual();
    if (!usuario || usuario.rol !== "colaborador") return "";

    // "examen" (#/examen/:cursoId, rendir un examen puntual) no tiene
    // tab propio — cae dentro de "Evaluaciones", que es de donde sale.
    const rutaEfectiva = rutaActiva === "examen" ? "misevaluaciones" : rutaActiva;

    return `
        <nav class="bottom-nav">
            ${TABS.map((t) => `
                <a class="bottom-nav-item${t.id === rutaEfectiva ? " active" : ""}" href="${t.href}">
                    ${Icon(t.icono, { size: 22 })}
                    <span>${t.label}</span>
                </a>
            `).join("")}
        </nav>
    `;
}
