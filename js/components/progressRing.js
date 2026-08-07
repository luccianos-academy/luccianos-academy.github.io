/* ============================
   Lucciano's Academy
   progressRing.js — Anillo de progreso (home del Colaborador)

   Conic-gradient puro, sin librería ni SVG externo.
=============================*/

export function ProgressRing(porcentaje = 0) {
    const pct = Math.max(0, Math.min(100, Math.round(porcentaje)));
    return `
        <div class="progress-ring" style="background:conic-gradient(var(--gold) ${pct * 3.6}deg, #ececec 0deg)">
            <div class="valor">${pct}%</div>
        </div>
    `;
}
