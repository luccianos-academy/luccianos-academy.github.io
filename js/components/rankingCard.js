/* ============================
   Lucciano's Academy
   rankingCard.js

   items ya vienen ordenados/rankeados por quien llama — este
   componente solo presenta, no calcula (mismo criterio que Table).
=============================*/

export function RankingCard({ titulo, items }) {

    const filas = items.map((item, i) => `
        <div class="ranking-item">
            <span class="ranking-position${i === 0 ? " gold" : ""}">#${item.posicion ?? i + 1}</span>
            <span class="ranking-nombre">${item.nombre}</span>
            <span class="ranking-valor">${item.valor}</span>
        </div>
    `).join("");

    return `
        <div class="card ranking-card">
            <h3>${titulo}</h3>
            <div class="ranking-list">
                ${filas || `<p class="text-muted">Sin datos suficientes todavía.</p>`}
            </div>
        </div>
    `;
}
