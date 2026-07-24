/* ============================
   FARO v4
   kpiCard.js

   Firma de 2 argumentos original intacta (KpiCard(titulo, valor)) —
   los llamados existentes siguen andando sin tocarlos. El tercer
   argumento es opcional y nuevo: ícono + tono + línea de tendencia.
=============================*/

import { Icon } from "./icons.js";

export function KpiCard(titulo, valor, { tendencia = null, icono = null, tono = "neutral", href = null } = {}) {
    const tag = href ? "a" : "div";
    const hrefAttr = href ? ` href="${href}"` : "";
    return `
        <${tag} class="card kpi-card${href ? " kpi-card-link" : ""}"${hrefAttr}>
            ${icono ? `<div class="kpi-icon tono-${tono}">${Icon(icono, { size: 18 })}</div>` : ""}
            <h3>${titulo}</h3>
            <span>${valor}</span>
            ${tendencia ? `
                <div class="kpi-trend ${tendencia.direccion}">
                    ${Icon(tendencia.direccion === "up" ? "trendUp" : "trendDown", { size: 14 })}
                    ${tendencia.texto}
                </div>
            ` : ""}
        </${tag}>
    `;
}
