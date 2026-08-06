/* ============================
   FARO v4
   kpiCard.js

   Firma de 2 argumentos original intacta (KpiCard(titulo, valor)) —
   los llamados existentes siguen andando sin tocarlos. El tercer
   argumento es opcional y nuevo: ícono + tono + línea de tendencia.
=============================*/

import { Icon } from "./icons.js";

export function KpiCard(titulo, valor, { tendencia = null, icono = null, tono = "neutral", href = null, ayuda = null } = {}) {
    const tag = href ? "a" : "div";
    const hrefAttr = href ? ` href="${href}"` : "";
    // Sin ícono (pedido del usuario: tarjetas más compactas, "como las
    // de Mi equipo") el color de tono pasa al VALOR en vez de
    // perderse — sigue siendo la misma señal (ej. "Sin acceso" en
    // rojo si hay alguno), solo que sin el badge que ocupaba espacio.
    const valorClase = !icono && tono !== "neutral" ? ` class="tono-${tono}"` : "";
    return `
        <${tag} class="card kpi-card${href ? " kpi-card-link" : ""}"${hrefAttr}>
            ${icono ? `<div class="kpi-icon tono-${tono}">${Icon(icono, { size: 18 })}</div>` : ""}
            <h3>${titulo}${ayuda ? `<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="${ayuda}">ⓘ</span>` : ""}</h3>
            <span${valorClase}>${valor}</span>
            ${tendencia ? `
                <div class="kpi-trend ${tendencia.direccion}">
                    ${Icon(tendencia.direccion === "up" ? "trendUp" : "trendDown", { size: 14 })}
                    ${tendencia.texto}
                </div>
            ` : ""}
        </${tag}>
    `;
}
