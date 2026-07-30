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

export function bindTooltips() {
    if (document._tooltipsListos) return;
    document._tooltipsListos = true;

    document.addEventListener("click", (e) => {
        const tocado = e.target.closest(".mod-tooltip");
        document.querySelectorAll(".mod-tooltip.mostrar-tooltip").forEach((el) => {
            if (el !== tocado) el.classList.remove("mostrar-tooltip");
        });
        if (!tocado) return;
        tocado.classList.add("mostrar-tooltip");
        clearTimeout(tocado._tooltipTimeout);
        tocado._tooltipTimeout = setTimeout(() => tocado.classList.remove("mostrar-tooltip"), 2000);
    });
}
