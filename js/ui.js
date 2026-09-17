/* ============================
   Lucciano's Academy
   ui.js — Helpers de interfaz
=============================*/

import { Sidebar } from "./components/sidebar.js";
import { TopBar, AvatarHeaderBoton } from "./components/topbar.js";
import { BottomNav } from "./components/bottomNav.js";
import { EmptyState } from "./components/emptyState.js";
import { Icon } from "./components/icons.js";
import { estaViendoComo, getUsuarioActual } from "./services/auth.js";
import { soportaPush, estadoPermisoPush, activarPush } from "./services/push.js";
import { esIOS, yaInstalada } from "./services/installPrompt.js";
import { abrirInstructivoPushIOS } from "./components/instructivoPushIOS.js";
import { PUSH_DISPONIBLE, USE_MOCK_DATA } from "./config.js";

/** Los avisos de push viven SOLO en Inicio, arriba de todo: ahí se
 *  ven sin buscarlos, y no acompañan a la persona por el resto de la
 *  app mientras trabaja.
 *
 *  Cerrarlos dura lo que dure la app abierta — no se guarda en el
 *  teléfono a propósito. La próxima vez que entre vuelve a estar, sin
 *  llegar a ser molesto: alcanza con tocar la X para sacárselo de
 *  encima ahora. Y cuando la persona activa los avisos de verdad,
 *  deja de aparecer para siempre solo, porque la condición que lo
 *  muestra deja de cumplirse. */
let bannerPushCerrado = false;
let bannerPushIOSCerrado = false;

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
                Viendo como <strong>${vistaComo.nombre}</strong> (${vistaComo.rol}${vistaComo.encargado ? " · Responsable de local" : ""}${vistaComo.capacitador ? " · Capacitador" : ""})
                <button class="btn btn-secondary" id="btn-volver-admin">Volver a mi cuenta</button>
            </div>
        ` : ""}
        ${rutaActiva === "inicio" ? BannerPush(usuario) : ""}
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
 */
function BannerPush(usuario) {
    if (!usuario) return "";
    if (!soportaPush()) return BannerPushIOS(usuario);
    if (estadoPermisoPush() !== "default") return "";
    if (bannerPushCerrado) return "";

    return `
        <div class="banner-push" data-push-banner>
            <span>Activá las <strong>notificaciones push</strong> para enterarte al toque de avisos importantes, aunque no tengas la app abierta.</span>
            <button class="btn btn-primary banner-push-activar" data-push-activar>Activar</button>
            <button class="banner-push-cerrar" data-push-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 14 })}</button>
        </div>
    `;
}

/**
 * Mismo banner, para el iPhone que todavía no tiene la app instalada.
 *
 * En iOS el push web NO existe en Safari-pestaña: window.Notification
 * recién aparece cuando la app corre agregada a la pantalla de inicio.
 * Por eso soportaPush() da false y, hasta ahora, esa persona no veía
 * NINGÚN aviso: no es que dijera que no, es que nunca se le ofreció
 * (29 de 261 con push activado, septiembre 2026 — la mayoría del resto
 * son estos). El InstallBanner del sidebar sí invita a instalar, pero
 * vive detrás del menú hamburguesa y habla de "instalar la app", sin
 * mencionar los avisos, que es lo único que a esta persona le importa
 * acá.
 *
 * No lleva botón que instale porque en iOS no existe tal cosa
 * (beforeinstallprompt es de Chrome): lo único honesto es explicar los
 * pasos, y para eso está el instructivo.
 */
function BannerPushIOS(usuario) {
    if (!usuario) return "";
    if (!PUSH_DISPONIBLE || USE_MOCK_DATA) return "";
    if (!esIOS() || yaInstalada()) return "";
    if (bannerPushIOSCerrado) return "";

    return `
        <div class="banner-push" data-push-banner-ios>
            <span class="banner-push-ios-texto">
                ${Icon("compartir", { size: 16 })}
                <span><strong>Activá los avisos en tu iPhone.</strong> Hace falta agregar la app a tu pantalla de inicio.</span>
            </span>
            <button class="btn btn-primary banner-push-activar" data-push-ios-como>Cómo se hace</button>
            <button class="banner-push-cerrar" data-push-ios-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 14 })}</button>
        </div>
    `;
}

function bindBannerPush(usuario) {
    bindBannerPushIOS();

    const banner = document.querySelector("[data-push-banner]");
    if (!banner) return;

    banner.querySelector("[data-push-cerrar]")?.addEventListener("click", () => {
        bannerPushCerrado = true;
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
        bannerPushCerrado = true;
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

function bindBannerPushIOS() {
    const banner = document.querySelector("[data-push-banner-ios]");
    if (!banner) return;

    const ocultar = () => {
        bannerPushIOSCerrado = true;
        banner.remove();
    };

    banner.querySelector("[data-push-ios-cerrar]")?.addEventListener("click", ocultar);

    banner.querySelector("[data-push-ios-como]")?.addEventListener("click", () => {
        abrirInstructivoPushIOS();
        // Ya leyó los pasos: dejarle el banner puesto no agrega nada.
        // Si no instaló, vuelve la próxima vez que abra la app.
        ocultar();
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
