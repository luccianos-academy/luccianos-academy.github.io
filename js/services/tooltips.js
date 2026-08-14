/* ============================
   Lucciano's Academy
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

/** Calcula dónde va el tooltip EN COORDENADAS DE PANTALLA (position:fixed
 *  en CSS, ver .mod-tooltip::before/::after) — ya no relativas al
 *  propio ícono, así que hay que darle las tres: el centro horizontal
 *  (--tooltip-x) y, según entre o no abajo, la posición vertical de la
 *  flechita y el cuadro (--tooltip-arrow-y / --tooltip-box-y).
 *
 *  Bug real que motivó el cambio a fixed: un .mod-tooltip adentro de
 *  .table-wrapper (necesita overflow-x:auto para tablas anchas, y esa
 *  sola propiedad ya le saca "visible" a overflow-y también — no hay
 *  forma de evitarlo solo con CSS) quedaba CORTADO por ese contenedor
 *  cuando no había lugar abajo, típicamente con una tabla de pocas
 *  filas (ej. filtrada a un solo resultado). position:fixed no lo
 *  arregla solo: hay que decidir en JS si entra abajo o hay que
 *  abrirlo hacia arriba, y decírselo en píxeles reales.
 *
 *  Se estima el alto del cuadro (no se mide el real: en el momento en
 *  que esto corre casi siempre está con opacity:0 pero ya maquetado,
 *  así que SÍ se podría medir con getBoundingClientRect — pero como
 *  también depende de --tooltip-x, que se fija ACÁ MISMO, medir antes
 *  de fijarlo daría el ancho por defecto (centrado en el viewport) en
 *  vez del real; más simple y confiable estimar por alto de línea. */
function corregirPosicionTooltip(el) {
    // 220 es el max-width del CSS (.mod-tooltip::after), pero box-sizing
    // ahí es content-box (default) — el padding (8px 12px) y el borde
    // (1px) se SUMAN a esos 220px en vez de recortarse de adentro. Sin
    // contar ese margen extra (~26px), un tooltip pegado al borde de la
    // pantalla (ej. la columna "Acceso", la última de la tabla) se
    // pasaba igual pese al cálculo de --tooltip-x.
    const ANCHO_MAX = 246;
    const PADDING = 10;
    const GAP = 8; // separación entre el ícono y la flechita
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = rect.left + rect.width / 2;
    const mitad = ANCHO_MAX / 2;
    if (x - mitad < PADDING) x = mitad + PADDING;
    else if (x + mitad > vw - PADDING) x = vw - PADDING - mitad;

    // Alto estimado del cuadro: una línea de texto entra en las ~24
    // líneas de un badge/M1, pero el detalle de restricciones de
    // Locales puede traer hasta 9 líneas (8 ítems + "y N más") — se
    // estima con margen de sobra en vez de medir el DOM, más simple.
    const lineas = String(el.dataset.tooltipTexto || "").split("\n").length;
    const altoEstimado = 20 + lineas * 17;

    const entraAbajo = rect.bottom + GAP + altoEstimado <= vh - PADDING;
    el.classList.toggle("arriba", !entraAbajo);
    el.style.setProperty("--tooltip-x", `${x}px`);
    el.style.setProperty("--tooltip-arrow-y", `${entraAbajo ? rect.bottom : rect.top}px`);
    el.style.setProperty("--tooltip-box-y", `${entraAbajo ? rect.bottom + GAP : rect.top - GAP}px`);
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
