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
import { getItem, setItem } from "./services/storage.js";
import { soportaPush, estadoPermisoPush, activarPush } from "./services/push.js";
import { esIOS, yaInstalada } from "./services/installPrompt.js";
import { Modal, abrirModal } from "./components/modal.js";
import { PUSH_DISPONIBLE, USE_MOCK_DATA } from "./config.js";

const CLAVE_PUSH_CERRADO = "banner_push_cerrado";
const CLAVE_PUSH_IOS_CERRADO = "banner_push_ios_cerrado";

/** Una semana, no un día como el banner de Android: en iPhone lo que
 *  se pide no es un permiso de un toque sino instalar la app, y no
 *  hay forma de saber si la persona ya lo hizo y decidió que no —
 *  preguntar todos los días sería hostigar. */
const DIAS_REAPARECE_IOS = 7;

function diasDesde(fechaISO) {
    if (!fechaISO) return Infinity;
    const ms = Date.now() - new Date(fechaISO + "T00:00:00").getTime();
    return ms / 86400000;
}

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
    if (!soportaPush()) return BannerPushIOS(usuario);
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
    if (diasDesde(getItem(CLAVE_PUSH_IOS_CERRADO, "")) < DIAS_REAPARECE_IOS) return "";

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

const INSTRUCTIVO_IOS_ID = "modal-push-ios";

function instructivoIOSHtml() {
    const pasos = [
        `Abajo en Safari, tocá ${Icon("compartir", { size: 15 })} <strong>Compartir</strong>`,
        `Deslizá y elegí <strong>Agregar a inicio</strong>`,
        `Confirmá con <strong>Agregar</strong>`,
        `Entrá por el ícono nuevo y tocá <strong>Activar</strong> cuando aparezca el aviso`,
    ];

    // El texto va envuelto en un <span>: el <li> es flex (para alinear
    // el número con el texto) y sin envoltura cada <strong> y cada
    // ícono se vuelve un flex item suelto — los pasos se partían en
    // columnas en vez de leerse como una frase.
    return `
        <ol class="pasos-ios">
            ${pasos.map((p) => `<li><span>${p}</span></li>`).join("")}
        </ol>
        <p class="pasos-ios-nota">El último paso es el que activa los avisos — agregar la app sola no alcanza.</p>
    `;
}

function bindBannerPush(usuario) {
    bindBannerPushIOS();

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

function bindBannerPushIOS() {
    const banner = document.querySelector("[data-push-banner-ios]");
    if (!banner) return;

    const ocultarPorUnaSemana = () => {
        setItem(CLAVE_PUSH_IOS_CERRADO, new Date().toISOString().slice(0, 10));
        banner.remove();
    };

    banner.querySelector("[data-push-ios-cerrar]")?.addEventListener("click", ocultarPorUnaSemana);

    banner.querySelector("[data-push-ios-como]")?.addEventListener("click", () => {
        abrirModal(
            Modal({
                id: INSTRUCTIVO_IOS_ID,
                titulo: "Recibir avisos en iPhone",
                contenidoHtml: instructivoIOSHtml(),
                textoConfirmar: "",
            }),
            INSTRUCTIVO_IOS_ID
        );
        // Ya leyó los pasos: seguir mostrándole el banner en cada
        // pantalla no agrega nada. Si no instaló, vuelve en una semana.
        ocultarPorUnaSemana();
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
