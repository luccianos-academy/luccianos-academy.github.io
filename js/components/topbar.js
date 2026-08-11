/* ============================
   Lucciano's Academy
   topbar.js — Barra superior (mobile) + botón de campana compartido

   La barra reemplaza al botón hamburguesa suelto: agrupa hamburguesa
   (izq), logo (centro) y campana (der), y solo se muestra en mobile
   (ver responsive.css) — en desktop el sidebar siempre visible ya
   trae logo + menú. Por eso CampanaBoton() se exporta aparte: el
   sidebar (siempre visible en desktop, drawer en mobile) también la
   renderiza junto al logo, así la campana — y el centro de
   notificaciones al que lleva — tiene una entrada real en CUALQUIER
   tamaño de pantalla, no solo mobile.

   El conteo de no leídas es real (ver data/noticias.js: estaLeida),
   no una heurística de "reciente". Como puede haber más de una
   campana dibujada a la vez (topbar + sidebar), actualizarContadorCampana()
   parcha TODAS las instancias en el DOM (querySelectorAll), no una sola.
=============================*/

import { EMPRESA } from "../config.js";
import { Icon } from "./icons.js";
import { Avatar } from "./avatar.js";
import { getNoticiasVisibles, estaLeida } from "../data/noticias.js";
import { getUsuarioActual } from "../services/auth.js";
import { invalidarTodo } from "../services/dataSource.js";
// navigate se importa dinámicamente dentro de refrescarDatos(): el
// router importa ui.js, que importa este archivo — un import estático
// acá cerraría el ciclo router → ui → topbar → router. Funcionaría por
// el hoisting de las declaraciones de función, pero es exactamente el
// tipo de dependencia que se rompe sola al reordenar un import.

let contadorCache = 0;

async function recalcularContador() {
    const usuario = getUsuarioActual();
    if (!usuario) return;
    try {
        const visibles = await getNoticiasVisibles(usuario);
        contadorCache = visibles.filter((n) => !estaLeida(n, usuario.id)).length;
    } catch {
        contadorCache = 0;
    }
    pintarContador();
}

/** Se expone para que otras pantallas (notificaciones.js) fuercen un
 *  recálculo después de crear / eliminar (casos donde no sabemos de
 *  antemano si el número sube, baja o queda igual). */
export function actualizarContadorCampana() {
    recalcularContador();
}

/** Para "marcar como leída": ya sabemos que el número baja en "n" —
 *  ajustar el número en memoria y repintar es instantáneo, evita un
 *  round-trip a Apps Script (lento) solo para confirmar algo que ya
 *  sabemos del lado del cliente. */
export function decrementarContadorCampana(n = 1) {
    contadorCache = Math.max(0, contadorCache - n);
    pintarContador();
}

function pintarContador() {
    document.querySelectorAll(".campana-btn").forEach((campana) => {
        campana.classList.toggle("tiene", contadorCache > 0);
        let badge = campana.querySelector(".campana-num");
        if (contadorCache > 0) {
            const texto = contadorCache > 9 ? "9+" : String(contadorCache);
            if (!badge) {
                campana.insertAdjacentHTML("beforeend", `<span class="campana-num">${texto}</span>`);
            } else {
                badge.textContent = texto;
            }
        } else if (badge) {
            badge.remove();
        }
    });
}

/** Botón de campana reutilizable. "variant" solo cambia la clase CSS
 *  externa (redondo/circular en la topbar vs. inline junto al logo
 *  del sidebar) — el contador y el link son siempre los mismos. */
export function CampanaBoton(variant = "topbar") {
    return `<a class="campana-btn campana-btn-${variant}" href="#/news" aria-label="News">${Icon("campana", { size: variant === "topbar" ? 22 : 19 })}</a>`;
}

/** Avatar de 48px junto a la campana (topbar mobile / sidebar
 *  desktop) — pedido explícito del usuario, "arriba a la derecha, le
 *  da valor". Lleva a Mi perfil, mismo criterio que la campana lleva
 *  a News. */
export function AvatarHeaderBoton() {
    const usuario = getUsuarioActual();
    if (!usuario) return "";
    return `<a class="avatar-header-btn" href="#/perfil" aria-label="Mi perfil">${Avatar({ nombre: usuario.nombre, foto: usuario.foto, size: "xl" })}</a>`;
}

/**
 * Traer datos frescos y volver a dibujar la pantalla actual.
 *
 * Instalada como PWA la app no tiene barra de direcciones, así que no
 * hay forma de recargar: quedabas viendo la copia local hasta que el
 * sync de fondo corriera (cada 5 minutos) Y encima navegaras a otra
 * pantalla, porque un sync no vuelve a dibujar lo que ya está en
 * pantalla. Reportado en vivo: "hay que actualizar la página, si está
 * instalada no hay una opción de refresh".
 *
 * Los tres pasos son necesarios y en este orden: tirar el cache en
 * memoria, bajar del servidor y reemplazar la copia local, y recién
 * entonces re-renderizar. Salteando el primero se re-dibujaría con lo
 * viejo; salteando el tercero los datos nuevos quedarían en IndexedDB
 * sin que se vean.
 */
async function refrescarDatos(boton) {
    if (boton.dataset.cargando) return; // doble toque = un solo refresh
    boton.dataset.cargando = "1";
    boton.classList.add("girando");

    try {
        invalidarTodo();
        if (window.syncManager) await window.syncManager.forceSyncNow();
    } catch (err) {
        console.warn("[TOPBAR] No se pudo refrescar:", err);
    } finally {
        boton.classList.remove("girando");
        delete boton.dataset.cargando;
    }

    // Re-render de la ruta actual. replace:true para no ensuciar el
    // historial: refrescar cinco veces no debería dejar cinco entradas
    // que después hay que atravesar con "atrás".
    const { navigate } = await import("../router.js");
    const rutaActual = (location.hash || "").replace(/^#\/?/, "").split("/")[0] || "inicio";
    navigate(rutaActual, { replace: true });
}

export function bindRefrescar() {
    document.querySelectorAll("[data-refrescar]").forEach((btn) => {
        btn.addEventListener("click", () => refrescarDatos(btn));
    });
}

export function TopBar() {
    const logo = EMPRESA.logoUrl
        ? `<img src="${EMPRESA.logoUrl}" alt="${EMPRESA.nombre}">`
        : `<span class="topbar-logo-texto">${EMPRESA.logo}</span>`;

    // El contador recién se conoce después de un fetch async — se
    // dispara acá (después de cada render de layout) y parcha el DOM
    // en cuanto resuelve, mismo patrón que el badge "NEW" del sidebar.
    recalcularContador();

    return `
        <header class="topbar">
            <button class="topbar-btn" id="btn-hamburger" aria-label="Abrir menú">${Icon("menu", { size: 22 })}</button>
            <a class="topbar-logo" href="#/inicio" aria-label="Inicio">${logo}</a>
            <button class="topbar-btn topbar-refrescar" data-refrescar type="button" aria-label="Actualizar datos" title="Actualizar datos">${Icon("refrescar", { size: 20 })}</button>
            ${CampanaBoton("topbar")}
            ${AvatarHeaderBoton()}
        </header>
    `;
}
