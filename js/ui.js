/* ============================
   FARO v4
   ui.js — Helpers de interfaz
=============================*/

import { Sidebar } from "./components/sidebar.js";
import { EmptyState } from "./components/emptyState.js";
import { Icon } from "./components/icons.js";
import { MaestroFlotante } from "./components/maestro.js";
import { estaViendoComo, getUsuarioActual } from "./services/auth.js";
import { getItem, setItem } from "./services/storage.js";

const CLAVE_BETA_CERRADO = "banner_beta_cerrado";

/**
 * Renderiza el layout base (sidebar + contenido) dentro de #app
 * y devuelve el nodo .content para que el router inyecte la página.
 * Si un admin activó "Ver como", suma una franja fija arriba con el
 * usuario que está viendo y un botón para volver — así nunca queda
 * "atrapado" viendo la app como otra persona sin darse cuenta.
 *
 * El botón "hamburguesa" y el fondo oscuro solo se ven en celular
 * (CSS, responsive.css) — en desktop quedan ocultos y el sidebar se
 * muestra siempre expandido, como antes.
 */
export function renderLayout(rutaActiva) {
    const app = document.querySelector("#app");
    const vistaComo = estaViendoComo();
    const usuario = getUsuarioActual();

    app.innerHTML = `
        ${vistaComo ? `
            <div class="banner-vista-como">
                Viendo como <strong>${vistaComo.nombre}</strong> (${vistaComo.rol}${vistaComo.encargado ? " · Encargado" : ""}${vistaComo.capacitador ? " · Capacitador" : ""})
                <button class="btn btn-secondary" id="btn-volver-admin">Volver a mi cuenta</button>
            </div>
        ` : ""}
        ${BannerBeta(usuario)}
        <button class="hamburger-btn" id="btn-hamburger" aria-label="Abrir menú">${Icon("menu", { size: 22 })}</button>
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
        <div class="layout">
            ${Sidebar(rutaActiva)}
            <main class="content" id="content"></main>
        </div>
        ${MaestroFlotante()}
    `;

    bindBannerBeta();

    return document.querySelector("#content");
}

/**
 * Aviso de acceso beta (hasta 31/7 23:59) para Colaboradores —
 * incluye Encargados, no Supervisores/Admins (así lo pidió el
 * cliente). Se puede cerrar, pero solo por el día de hoy: vuelve a
 * aparecer al otro día para que nadie se olvide del vencimiento.
 */
function BannerBeta(usuario) {
    if (!usuario || usuario.rol !== "colaborador") return "";
    if (getItem(CLAVE_BETA_CERRADO, "") === new Date().toISOString().slice(0, 10)) return "";

    return `
        <div class="banner-beta" data-beta-banner>
            <span>Estás en la <strong>versión beta</strong> de Lucciano's Academy — tu acceso vence el <strong>31/7 a las 23:59</strong>. Aprovechá para completar tus cursos antes de esa fecha.</span>
            <button class="banner-beta-cerrar" data-beta-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 14 })}</button>
        </div>
    `;
}

function bindBannerBeta() {
    const banner = document.querySelector("[data-beta-banner]");
    banner?.querySelector("[data-beta-cerrar]")?.addEventListener("click", () => {
        setItem(CLAVE_BETA_CERRADO, new Date().toISOString().slice(0, 10));
        banner.remove();
    });
}

/**
 * Renderiza una pantalla a pantalla completa, sin sidebar.
 * Usado por Login (todavía no hay sesión) y notFound.
 */
export function renderFullScreen() {
    const app = document.querySelector("#app");
    app.innerHTML = `<main class="fullscreen" id="content"></main>`;
    return document.querySelector("#content");
}

/** Placeholder estándar para módulos todavía no implementados. */
export function Placeholder(nombreModulo) {
    return EmptyState({ titulo: nombreModulo, detalle: "Este módulo está en construcción. Próximo sprint." });
}
