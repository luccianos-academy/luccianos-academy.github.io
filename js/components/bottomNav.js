/* ============================
   FARO v4
   bottomNav.js — Tabs inferiores (mobile)

   Directo del mockup: 4 accesos fijos abajo para no tener que abrir
   el sidebar/drawer para lo que se usa todo el tiempo. Admin queda
   afuera (muchas más secciones de las que entran en 4 tabs, ya
   navega bien por el sidebar) — Colaborador y Supervisor sí tienen
   un set corto y estable de pantallas frecuentes, uno por rol.
=============================*/

import { Icon } from "./icons.js";
import { getUsuarioActual } from "../services/auth.js";

const TABS_POR_ROL = {
    colaborador: [
        { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
        { id: "cursos", label: "Aprender", icono: "academia", href: "#/cursos" },
        { id: "misevaluaciones", label: "Evaluaciones", icono: "evaluaciones", href: "#/misevaluaciones" },
        { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
    ],
    supervisor: [
        { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
        { id: "colaboradores", label: "Equipo", icono: "usuarios", href: "#/colaboradores" },
        { id: "coordinacionoperativa", label: "Canales", icono: "comentario", href: "#/coordinacionoperativa" },
        { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
    ],
};

export function BottomNav(rutaActiva) {
    const usuario = getUsuarioActual();
    const tabs = usuario && TABS_POR_ROL[usuario.rol];
    if (!tabs) return "";

    // "examen" (#/examen/:cursoId, rendir un examen puntual) no tiene
    // tab propio — cae dentro de "Evaluaciones", que es de donde sale.
    const rutaEfectiva = rutaActiva === "examen" ? "misevaluaciones" : rutaActiva;

    return `
        <nav class="bottom-nav">
            ${tabs.map((t) => `
                <a class="bottom-nav-item${t.id === rutaEfectiva ? " active" : ""}" href="${t.href}">
                    ${Icon(t.icono, { size: 22 })}
                    <span>${t.label}</span>
                </a>
            `).join("")}
        </nav>
    `;
}
