/* ============================
   Lucciano's Academy
   table.js — Componente Tabla

   columnas: [{ key:"nombre", label:"Nombre" }, ...]
   filas: [{ nombre:"...", ... }, ...]
=============================*/

export function Table(columnas, filas) {

    const thead = columnas.map((c) => `<th>${c.label}</th>`).join("");

    const tbody = filas
        .map((fila) => {
            const celdas = columnas.map((c) => {
                const valor = fila[c.key] ?? "";
                // La columna "acciones" junta varios botones — envolverlos
                // en un contenedor flex-wrap evita que la tabla prefiera
                // scroll horizontal (con botones cortados fuera de vista)
                // en vez de acomodarlos en más de una fila.
                if (c.key === "acciones") return `<td><div class="fila-acciones">${valor}</div></td>`;
                // "email" suele ser la celda más ancha (direcciones largas)
                // y es la principal responsable de que la columna de
                // acciones no entre en pantallas de laptop — se trunca
                // con "…" y el valor completo queda en el title (tooltip).
                // "sucursal" queda afuera a propósito: son pocas palabras
                // que ya envuelven bien en 2-3 líneas angostas — truncarla
                // a una sola línea con "…" terminaba pidiendo MÁS ancho de
                // columna, no menos.
                if (c.key === "email" && valor) return `<td><span class="celda-truncada" title="${valor}">${valor}</span></td>`;
                return `<td>${valor}</td>`;
            }).join("");
            return `<tr>${celdas}</tr>`;
        })
        .join("");

    return `
        <div class="table-wrapper">
            <table class="data-table">
                <thead><tr>${thead}</tr></thead>
                <tbody>${tbody || `<tr><td colspan="${columnas.length}">Sin datos</td></tr>`}</tbody>
            </table>
        </div>
    `;
}
