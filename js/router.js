/* ============================
   Lucciano's Academy
   router.js — Router basado en hash (#/ruta)

   window.location.hash es la única fuente de verdad: a diferencia
   de v3 (que navegaba con una función imperativa y perdía la ruta
   al refrescar), acá un F5 en "#/colaboradores" vuelve a esa misma
   pantalla en vez de rebotar siempre a "inicio".
=============================*/

import { renderLayout, renderFullScreen, Placeholder } from "./ui.js";
import { MascotaCarga } from "./components/mascotaCarga.js";
import { bindInstallBanner } from "./components/installBanner.js";
import { bindMaestro } from "./components/maestro.js";
import { haySesion, puedeAccederA, getUsuarioActual, logout, volverAAdmin } from "./services/auth.js";
import { obtenerMiUsuario } from "./data/usuarios.js";

import { Login } from "./pages/login.js";
import { InicioAdmin } from "./pages/inicioAdmin.js";
import { InicioSupervisor } from "./pages/inicioSupervisor.js";
import { InicioColaborador } from "./pages/inicioColaborador.js";
import { Colaboradores, bindColaboradores } from "./pages/colaboradores.js";
import { Cursos, bindCursos } from "./pages/cursos.js";
import { Examen, bindExamen } from "./pages/examen.js";
import { Perfil, bindPerfil } from "./pages/perfil.js";
import { NotFound } from "./pages/notFound.js";
import { Locales, bindLocales } from "./pages/locales.js";
import { Alertas } from "./pages/alertas.js";
import { Supervisores } from "./pages/supervisores.js";
import { Academia, bindAcademia } from "./pages/academia.js";
import { Evaluaciones, bindEvaluaciones } from "./pages/evaluaciones.js";
import { MisEvaluaciones } from "./pages/misEvaluaciones.js";
import { DashboardEjecutivo, bindDashboard } from "./pages/dashboardEjecutivo.js";
import { Reportes, bindReportes } from "./pages/reportes.js";
import { Historia, bindHistoria } from "./pages/historia.js";
import { News, bindNews, NuevaNews, bindNuevaNews } from "./pages/news.js";
import { CoordinacionOperativa, bindCoordinacionOperativa } from "./pages/coordinacionOperativa.js";
import { Recursos, bindRecursos } from "./pages/recursos.js";
import { Manuales, bindManuales } from "./pages/manuales.js";
import { Configuracion } from "./pages/configuracion.js";
import { Integraciones } from "./pages/integraciones.js";

/** "inicio" es polimórfico: cada rol ve un home distinto. */
async function Inicio() {
    const usuario = getUsuarioActual();
    if (usuario.rol === "admin") return InicioAdmin();
    if (usuario.rol === "supervisor") return InicioSupervisor();
    return InicioColaborador();
}

const RUTAS = {
    login:         { render: Login, fullscreen: true },
    inicio:        { render: Inicio },
    colaboradores: { render: Colaboradores, bind: bindColaboradores },
    cursos:        { render: Cursos, bind: bindCursos },
    examen:        { render: Examen, bind: bindExamen },
    perfil:        { render: Perfil, bind: bindPerfil },
    locales:       { render: Locales, bind: bindLocales },
    alertas:       { render: Alertas },
    supervisores:  { render: Supervisores },
    academia:      { render: Academia, bind: bindAcademia },
    evaluaciones:  { render: Evaluaciones, bind: bindEvaluaciones },
    misevaluaciones: { render: MisEvaluaciones },
    dashboard:     { render: DashboardEjecutivo, bind: bindDashboard },
    reportes:      { render: Reportes, bind: bindReportes },
    configuracion: { render: Configuracion },
    integraciones: { render: Integraciones },
    historia:      { render: Historia, bind: bindHistoria },
    news:      { render: News, bind: bindNews },
    newsnueva: { render: NuevaNews, bind: bindNuevaNews },
    coordinacionoperativa: { render: CoordinacionOperativa, bind: bindCoordinacionOperativa },
    recursos:      { render: Recursos, bind: bindRecursos },
    manuales:      { render: Manuales, bind: bindManuales },
};

const RUTAS_PUBLICAS = ["login"];

/** "#/cursos/12" → { path:"cursos", params:["12"] }. Un solo segmento de
 *  parámetro alcanza para este incremento; Sprint 5+ (detalle de curso/
 *  lección) puede sumar más sin tocar este parser. */
function parseHash() {
    const crudo = (location.hash || "").replace(/^#\/?/, "");
    const partes = crudo.split("/").filter(Boolean);
    return { path: partes[0] || "inicio", params: partes.slice(1) };
}

/**
 * Navega a una ruta. `replace: true` no agrega entrada al historial
 * (usado en redirects de auth/rol, para que el botón "atrás" no
 * quede rebotando entre la pantalla bloqueada y el login).
 */
export function navigate(path, { replace = false } = {}) {
    const destino = "#/" + path;
    if (replace) {
        history.replaceState(null, "", destino);
        handleRoute();
    } else if (location.hash === destino) {
        handleRoute();
    } else {
        location.hash = destino;
    }
}

async function handleRoute() {
    const { path, params } = parseHash();

    if (!haySesion() && !RUTAS_PUBLICAS.includes(path)) {
        return navigate("login", { replace: true });
    }

    if (haySesion() && path === "login") {
        return navigate("inicio", { replace: true });
    }

    const ruta = RUTAS[path];

    if (!ruta) {
        return renderRuta("notFound", { render: NotFound }, params);
    }

    if (haySesion() && !puedeAccederA(path)) {
        return navigate("inicio", { replace: true });
    }

    return renderRuta(path, ruta, params);
}

async function renderRuta(path, ruta, params) {

    // Un modal abierto vive fuera de #app (document.body) — si el
    // usuario navega sin cerrarlo, limpiarlo acá evita que quede
    // huérfano tapando la pantalla siguiente.
    document.querySelectorAll(".modal-overlay").forEach((el) => el.remove());

    if (ruta.fullscreen) {
        // La propia página maneja su DOM (sin sidebar) mediante renderFullScreen().
        await ruta.render(params);
        return;
    }

    const content = renderLayout(path);
    content.innerHTML = MascotaCarga();

    const html = await ruta.render(params);
    content.innerHTML = html || Placeholder(path);

    if (ruta.bind) ruta.bind(params);

    bindSidebar();
}

function bindSidebar() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            logout();
            navigate("login", { replace: true });
        });
    }

    const btnVolverAdmin = document.getElementById("btn-volver-admin");
    if (btnVolverAdmin) {
        btnVolverAdmin.addEventListener("click", () => {
            volverAAdmin();
            navigate("inicio", { replace: true });
        });
    }

    // Menú hamburguesa (solo visible en celular, ver responsive.css):
    // el sidebar vive siempre en el DOM, "abierto" es solo una clase
    // que lo desliza a la vista + oscurece el fondo.
    const btnHamburger = document.getElementById("btn-hamburger");
    const btnCerrarSidebar = document.getElementById("btn-cerrar-sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    const sidebar = document.querySelector(".sidebar");

    function abrirSidebar() {
        sidebar?.classList.add("abierto");
        backdrop?.classList.add("visible");
    }
    function cerrarSidebarMovil() {
        sidebar?.classList.remove("abierto");
        backdrop?.classList.remove("visible");
    }

    btnHamburger?.addEventListener("click", abrirSidebar);
    btnCerrarSidebar?.addEventListener("click", cerrarSidebarMovil);
    backdrop?.addEventListener("click", cerrarSidebarMovil);

    bindInstallBanner();
    bindMaestro();
}

export function initRouter() {
    window.addEventListener("hashchange", handleRoute);
    handleRoute();
}
