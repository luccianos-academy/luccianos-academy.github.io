/* ============================
   Lucciano's Academy
   bottomNav.js — Tabs inferiores (mobile)

   Directo del mockup: 4 accesos fijos abajo para no tener que abrir
   el sidebar/drawer para lo que se usa todo el tiempo. Colaborador y
   Supervisor tienen un set corto y estable de pantallas frecuentes,
   uno por rol.

   Admin quedaba afuera a propósito (muchas más secciones de las que
   entran en 4 tabs) — pedido explícito del usuario (2026-08-19): lo
   quiere igual en su celular, para no abrir el sidebar cada vez. Se
   eligieron las 4 pantallas de uso diario real (Colaboradores y
   Academia, no Dashboard/Configuración) — si conviene cambiar algún
   acceso, es solo tocar este array.
=============================*/

import { Icon } from "./icons.js";
import { getUsuarioActual } from "../services/auth.js";
import { getAccesosRapidos } from "../services/preferenciasAccesos.js";

// Universo de secciones que un Admin puede elegir como acceso rápido
// propio (ver "Accesos rápidos" en Mi Perfil) — no todo el sidebar,
// solo lo que tiene sentido tocar seguido desde el celular (se deja
// afuera, ej., Configuración/Integraciones).
export const SECCIONES_DISPONIBLES_ADMIN = [
    { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
    { id: "colaboradores", label: "Equipo", icono: "usuarios", href: "#/colaboradores" },
    { id: "locales", label: "Locales", icono: "locales", href: "#/locales" },
    { id: "academia", label: "Academia", icono: "academia", href: "#/academia" },
    { id: "coordinacionoperativa", label: "Canales", icono: "comentario", href: "#/coordinacionoperativa" },
    { id: "recursos", label: "Recursos", icono: "integraciones", href: "#/recursos" },
    { id: "manuales", label: "Manuales", icono: "reportes", href: "#/manuales" },
    { id: "dashboard", label: "Dashboard", icono: "dashboard", href: "#/dashboard" },
    { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
];

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
    admin: [
        { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
        { id: "colaboradores", label: "Equipo", icono: "usuarios", href: "#/colaboradores" },
        { id: "academia", label: "Academia", icono: "academia", href: "#/academia" },
        { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
    ],
};

export function BottomNav(rutaActiva) {
    const usuario = getUsuarioActual();
    let tabs = usuario && TABS_POR_ROL[usuario.rol];
    if (!tabs) return "";

    // Admin puede reemplazar el set fijo por sus propios 4 accesos
    // (ver "Accesos rápidos" en Mi Perfil) — preferencia liviana del
    // dispositivo, no un permiso nuevo. Si guardó menos/más de 4 o
    // algo que ya no existe, se ignora y sigue con el default: mejor
    // mostrar algo consistente que un tab roto o una fila incompleta.
    if (usuario.rol === "admin") {
        const elegidos = getAccesosRapidos(usuario);
        if (elegidos.length === 4) {
            const propios = elegidos
                .map((id) => SECCIONES_DISPONIBLES_ADMIN.find((s) => s.id === id))
                .filter(Boolean);
            if (propios.length === 4) tabs = propios;
        }
    }

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
