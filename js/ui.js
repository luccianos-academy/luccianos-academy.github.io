/* ============================
   FARO v4
   ui.js — Helpers de interfaz
=============================*/

import { Sidebar } from "./components/sidebar.js";
import { TopBar, AvatarHeaderBoton } from "./components/topbar.js";
import { BottomNav } from "./components/bottomNav.js";
import { EmptyState } from "./components/emptyState.js";
import { Icon } from "./components/icons.js";
import { estaViendoComo, getUsuarioActual } from "./services/auth.js";
import { getItem, setItem } from "./services/storage.js";
import { soportaPush, estadoPermisoPush, activarPush } from "./services/push.js";

const CLAVE_PUSH_CERRADO = "banner_push_cerrado";

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
        ${BannerPush(usuario)}
        ${TopBar()}
        <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
        <div class="layout">
            ${Sidebar(rutaActiva)}
            <main class="content" id="content"></main>
            <div class="avatar-header-desktop">${AvatarHeaderBoton()}</div>
        </div>
        ${BottomNav(rutaActiva)}
    `;

    bindBannerPush(usuario);

    return document.querySelector("#content");
}

/**
 * Aviso de que existen notificaciones push, para cualquier rol —
 * pedido explícito del usuario: "nadie sabe que debe darle push para
 * recibir notificaciones", hoy esa opción vivía escondida en Mi
 * Perfil sin ningún aviso en ningún otro lado. El botón "Activar"
 * dispara el permiso nativo ahí mismo, sin tener que ir a buscarlo.
 * Solo aparece con el permiso en estado "default" (nunca preguntado)
 * — "denied"/"granted" son decisiones ya tomadas, no hay nada que
 * este banner pueda ofrecer ahí (mismo criterio que pages/perfil.js).
 * Se puede cerrar, pero solo por hoy — reaparece mañana si sigue sin
 * activarse.
 */
function BannerPush(usuario) {
    if (!usuario) return "";
    if (!soportaPush()) return "";
    if (estadoPermisoPush() !== "default") return "";
    if (getItem(CLAVE_PUSH_CERRADO, "") === new Date().toISOString().slice(0, 10)) return "";

    return `
        <div class="banner-push" data-push-banner>
            <span>Activá las <strong>notificaciones push</strong> para enterarte al toque de avisos importantes, aunque no tengas la app abierta.</span>
            <button class="btn btn-primary banner-push-activar" data-push-activar>Activar</button>
            <button class="banner-push-cerrar" data-push-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 14 })}</button>
        </div>
    `;
}

function bindBannerPush(usuario) {
    const banner = document.querySelector("[data-push-banner]");
    if (!banner) return;

    banner.querySelector("[data-push-cerrar]")?.addEventListener("click", () => {
        setItem(CLAVE_PUSH_CERRADO, new Date().toISOString().slice(0, 10));
        banner.remove();
    });

    banner.querySelector("[data-push-activar]")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Activando...";
        const resultado = await activarPush(usuario);
        // Tanto si funcionó como si la persona lo rechazó, no tiene
        // sentido seguir mostrando el banner en esta sesión — "denied"
        // no se puede volver a preguntar (decisión del navegador) y
        // "ok" ya no hace falta.
        setItem(CLAVE_PUSH_CERRADO, new Date().toISOString().slice(0, 10));
        banner.remove();
        if (!resultado.ok) {
            if (resultado.motivo === "denegado") {
                alert("No diste el permiso de notificaciones — podés activarlo más tarde desde la configuración del navegador.");
            } else {
                alert("No se pudo activar. Podés reintentarlo desde Mi perfil en un momento.");
            }
        }
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
