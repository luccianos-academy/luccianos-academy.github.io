/* ============================
   Lucciano's Academy
   bottomNav.js — Tabs inferiores (mobile)

   Directo del mockup: 4 accesos fijos abajo para no tener que abrir
   el sidebar/drawer para lo que se usa todo el tiempo. Cada rol
   arranca con un set corto y estable de pantallas frecuentes
   (TABS_POR_ROL) — pero desde "Accesos rápidos" en Mi Perfil,
   CUALQUIER rol puede reemplazarlo por sus propios 4 (pedido
   explícito del usuario 2026-08-19 para Admin, extendido 2026-08-25 a
   Colaborador/Supervisor: "que se pongan lo que ellos quieran").
   Preferencia liviana del dispositivo (localStorage), no un permiso
   nuevo — el universo de opciones SÍ respeta lo que cada quien puede
   ver (ver seccionesDisponibles).
=============================*/

import { Icon } from "./icons.js";
import { getUsuarioActual } from "../services/auth.js";
import { getAccesosRapidos } from "../services/preferenciasAccesos.js";
import { asegurarNoLeidas, suscribirseANoLeidas } from "../services/badgeComunicaciones.js";

// Cache COMPARTIDA con sidebar.js (ver badgeComunicaciones.js) — antes
// cada uno tenía la suya propia, así que marcar como leída desde
// cualquier lado no tenía forma de avisarle al otro y el badge quedaba
// pegado en el primer número calculado, para siempre (bug real
// reportado en vivo).
let noLeidasCache = 0;
suscribirseANoLeidas((n) => {
    noLeidasCache = n;
    const item = document.querySelector('.bottom-nav-item[href="#/coordinacionoperativa"]');
    if (!item) return;
    const existente = item.querySelector(".bottom-nav-badge");
    if (n > 0 && !existente) {
        item.insertAdjacentHTML("beforeend", `<span class="bottom-nav-badge">${n}</span>`);
    } else if (n > 0 && existente) {
        existente.textContent = String(n);
    } else if (n === 0 && existente) {
        existente.remove();
    }
});

// Universo de secciones que un Admin puede elegir como acceso rápido
// propio (ver "Accesos rápidos" en Mi Perfil) — no todo el sidebar,
// solo lo que tiene sentido tocar seguido desde el celular (se deja
// afuera, ej., Configuración/Integraciones).
export const SECCIONES_DISPONIBLES_ADMIN = [
    { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
    { id: "colaboradores", label: "Equipo", icono: "usuarios", href: "#/colaboradores" },
    { id: "locales", label: "Locales", icono: "locales", href: "#/locales" },
    { id: "academia", label: "Academia", icono: "academia", href: "#/academia" },
    { id: "gestion", label: "Gestión semanal", icono: "calendario", href: "#/gestion" },
    { id: "coordinacionoperativa", label: "Canales", icono: "comentario", href: "#/coordinacionoperativa" },
    { id: "recursos", label: "Recursos", icono: "integraciones", href: "#/recursos" },
    { id: "manuales", label: "Manuales", icono: "reportes", href: "#/manuales" },
    { id: "dashboard", label: "Dashboard", icono: "dashboard", href: "#/dashboard" },
    { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
];

export const SECCIONES_DISPONIBLES_SUPERVISOR = [
    { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
    { id: "colaboradores", label: "Equipo", icono: "usuarios", href: "#/colaboradores" },
    { id: "locales", label: "Locales", icono: "locales", href: "#/locales" },
    { id: "cursos", label: "Academia", icono: "academia", href: "#/cursos" },
    { id: "gestion", label: "Gestión semanal", icono: "calendario", href: "#/gestion" },
    { id: "coordinacionoperativa", label: "Canales", icono: "comentario", href: "#/coordinacionoperativa" },
    { id: "recursos", label: "Recursos", icono: "integraciones", href: "#/recursos" },
    { id: "manuales", label: "Manuales", icono: "reportes", href: "#/manuales" },
    { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
];

const SECCIONES_DISPONIBLES_COLABORADOR_BASE = [
    { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
    { id: "cursos", label: "Academia", icono: "academia", href: "#/cursos" },
    { id: "misevaluaciones", label: "Evaluaciones", icono: "evaluaciones", href: "#/misevaluaciones" },
    { id: "manuales", label: "Manuales", icono: "reportes", href: "#/manuales" },
    { id: "historia", label: "Nuestra Historia", icono: "historia", href: "#/historia" },
    { id: "perfil", label: "Perfil", icono: "perfil", href: "#/perfil" },
];

/** Universo de opciones para "Accesos rápidos", según rol Y atributos
 *  del usuario puntual — a diferencia de Admin/Supervisor (fijo por
 *  rol), un Colaborador raso no ve "Mi local" ni "Gestión semanal":
 *  solo aparecen si el usuario es encargado/responsableTurno, mismo
 *  criterio que ya usan sidebar.js/auth.js para esas dos secciones. */
export function seccionesDisponibles(usuario) {
    if (!usuario) return [];
    if (usuario.rol === "admin") return SECCIONES_DISPONIBLES_ADMIN;
    if (usuario.rol === "supervisor") return SECCIONES_DISPONIBLES_SUPERVISOR;

    const lista = [...SECCIONES_DISPONIBLES_COLABORADOR_BASE];
    if (usuario.encargado) lista.splice(1, 0, { id: "colaboradores", label: "Mi local", icono: "usuarios", href: "#/colaboradores" });
    if (usuario.encargado || usuario.responsableTurno) lista.splice(1, 0, { id: "gestion", label: "Gestión semanal", icono: "calendario", href: "#/gestion" });
    return lista;
}

// Exportado — perfil.js lo usa para pre-tildar las opciones que
// coinciden con el default real de cada rol cuando todavía no hay
// nada guardado (ver bloqueAccesosRapidos).
export const TABS_POR_ROL = {
    colaborador: [
        { id: "inicio", label: "Inicio", icono: "inicio", href: "#/inicio" },
        { id: "cursos", label: "Academia", icono: "academia", href: "#/cursos" },
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

    asegurarNoLeidas(usuario);

    // Cualquier rol puede reemplazar el set fijo por sus propios 4
    // accesos (ver "Accesos rápidos" en Mi Perfil) — preferencia
    // liviana del dispositivo, no un permiso nuevo. El universo de
    // opciones válidas es el mismo que ve en Mi Perfil (seccionesDisponibles),
    // así que lo que haya guardado siempre matchea contra algo que
    // ese usuario puede ver. Si guardó menos/más de 4 o algo que ya
    // no existe (ej. dejó de ser encargado), se ignora y sigue con el
    // default: mejor mostrar algo consistente que un tab roto.
    const elegidos = getAccesosRapidos(usuario);
    if (elegidos.length === 4) {
        const disponibles = seccionesDisponibles(usuario);
        const propios = elegidos.map((id) => disponibles.find((s) => s.id === id)).filter(Boolean);
        if (propios.length === 4) tabs = propios;
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
                    ${t.id === "coordinacionoperativa" && noLeidasCache > 0 ? `<span class="bottom-nav-badge">${noLeidasCache}</span>` : ""}
                </a>
            `).join("")}
        </nav>
    `;
}
