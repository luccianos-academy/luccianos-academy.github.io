/* ============================
   FARO v4
   services/tooltips.js — Tooltip propio (no el "title" nativo del
   navegador) para textos abreviados (ej. "M1" en vez del nombre real
   del curso, ver pages/colaboradores.js) o para explicar brevemente
   qué significa una tarjeta/sección (ícono "ⓘ", ver components/
   kpiCard.js) — pedido explícito del usuario: "seamos claros y
   profesionales, no demos nada por hecho".

   El look (fondo + borde dorado + flechita) es 100% CSS (.mod-tooltip,
   css/components.css) y ya funciona solo con :hover en desktop. Esto
   es SOLO para celular: no hay hover en touch, así que tocar el
   elemento agrega la clase que lo muestra, y a los 2s se saca sola —
   sin esto quedaría abierto para siempre tapando lo de al lado.

   Se registra UNA sola vez para toda la app (bootstrap, ver app.js),
   no por página — así funciona en cualquier pantalla que use
   .mod-tooltip, sin importar el orden en que el usuario navegue.
=============================*/

/** El cuadro de texto del tooltip se arma centrado sobre el ícono
 *  (::after, ver css/components.css) con hasta 220px de ancho — si el
 *  ícono está cerca de un borde de la pantalla, ese centrado lo saca
 *  del viewport y queda cortado. Esto calcula cuánto hay que correrlo
 *  (--tooltip-nudge) para que el CUADRO quede siempre adentro,
 *  mientras la flechita (que no se corre) se mantiene apuntando al
 *  ícono. Se basa en el max-width fijo (220px) en vez de medir el
 *  ::after ya renderizado — no hace falta exactitud pixel-perfect,
 *  solo garantizar que nunca se pase del borde. */
function corregirPosicionTooltip(el) {
    const ANCHO_MAX = 220;
    const PADDING = 10;
    const rect = el.getBoundingClientRect();
    const centroX = rect.left + rect.width / 2;
    const mitad = ANCHO_MAX / 2;
    const vw = window.innerWidth;
    let nudge = 0;
    if (centroX - mitad < PADDING) {
        nudge = PADDING - (centroX - mitad);
    } else if (centroX + mitad > vw - PADDING) {
        nudge = (vw - PADDING) - (centroX + mitad);
    }
    el.style.setProperty("--tooltip-nudge", `${nudge}px`);
}

export function bindTooltips() {
    if (document._tooltipsListos) return;
    document._tooltipsListos = true;

    document.addEventListener("click", (e) => {
        const tocado = e.target.closest(".mod-tooltip");
        document.querySelectorAll(".mod-tooltip.mostrar-tooltip").forEach((el) => {
            if (el !== tocado) el.classList.remove("mostrar-tooltip");
        });
        if (!tocado) return;
        corregirPosicionTooltip(tocado);
        tocado.classList.add("mostrar-tooltip");
        clearTimeout(tocado._tooltipTimeout);
        tocado._tooltipTimeout = setTimeout(() => tocado.classList.remove("mostrar-tooltip"), 2000);
    });

    // Desktop usa :hover puro en CSS (sin pasar por acá) — sin este
    // listener, el cálculo de --tooltip-nudge nunca correría para ese
    // caso y el tooltip seguiría cortándose contra el borde con mouse.
    document.addEventListener("mouseover", (e) => {
        const tocado = e.target.closest(".mod-tooltip");
        if (tocado) corregirPosicionTooltip(tocado);
    });
}
