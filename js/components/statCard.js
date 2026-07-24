export function StatCard({ valor = "", etiqueta = "" }) {
    return `
        <div class="stat">
            <b>${valor}</b>
            <span>${etiqueta}</span>
        </div>
    `;
}
