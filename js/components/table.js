/* ============================
   Lucciano's Academy
   table.js — Componente Tabla

   columnas: [{ key:"nombre", label:"Nombre" }, ...]
   filas: [{ nombre:"...", ... }, ...]

   Una fila puede traer `_datos: { pais: "Uruguay" }` y eso sale como
   data-pais en el <tr>. Sirve para filtrar por un dato que no vale la
   pena mostrar como columna —repetir "Argentina" en 102 filas gasta
   ancho sin decir nada— sin tener que reconstruir la tabla entera cada
   vez que cambia el filtro.
=============================*/

import { escaparHtml } from "../services/html.js";

export function Table(columnas, filas) {

    const thead = columnas.map((c) => `<th>${c.label}</th>`).join("");

    const tbody = filas
        .map((fila) => {
            const celdas = columnas.map((c) => {
                const valor = fila[c.key] ?? "";
                // data-col identifica cada celda por su columna. Sin esto
                // los buscadores de página tienen que ubicarla por
                // posición, y agregar una columna al principio los rompe
                // en silencio: eso ya pasó en Locales cuando la columna de
                // checkboxes corrió el nombre al segundo lugar y el
                // buscador pasó a leer una celda vacía.
                const col = ` data-col="${c.key}"`;
                // La columna "acciones" junta varios botones — envolverlos
                // en un contenedor flex-wrap evita que la tabla prefiera
                // scroll horizontal (con botones cortados fuera de vista)
                // en vez de acomodarlos en más de una fila.
                if (c.key === "acciones") return `<td${col}><div class="fila-acciones">${valor}</div></td>`;
                // "email" suele ser la celda más ancha (direcciones largas)
                // y es la principal responsable de que la columna de
                // acciones no entre en pantallas de laptop — se trunca
                // con "…" y el valor completo queda en el title (tooltip).
                // "sucursal" queda afuera a propósito: son pocas palabras
                // que ya envuelven bien en 2-3 líneas angostas — truncarla
                // a una sola línea con "…" terminaba pidiendo MÁS ancho de
                // columna, no menos.
                if (c.key === "email" && valor) return `<td${col}><span class="celda-truncada" title="${valor}">${valor}</span></td>`;
                return `<td${col}>${valor}</td>`;
            }).join("");
            const datos = Object.entries(fila._datos || {})
                .map(([k, v]) => ` data-${k}="${escaparHtml(v)}"`)
                .join("");
            return `<tr${datos}>${celdas}</tr>`;
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
