/* ============================
   Lucciano's Academy
   header.js — Header con saludo opcional
=============================*/

export function Header(titulo, subtitulo = "", { saludo = false, accion = "" } = {}) {

    const contenido = saludo
        ? `
            <div>
                <div class="header-greeting">${subtitulo || "Bienvenido/a"}</div>
                <h2>${titulo}</h2>
            </div>
        `
        : `
            <div>
                <h1>${titulo}</h1>
                ${subtitulo ? `<p class="subtitulo">${subtitulo}</p>` : ""}
            </div>
        `;

    // "accion" (opcional) — un botón tipo "¿Cómo funciona?" a la
    // derecha del título, mismo lugar que ".header" ya le da al hueco
    // libre (display:flex; justify-content:space-between). Nadie más
    // lo usa todavía, así que por default no cambia nada.
    return `<header class="header">${contenido}${accion}</header>`;
}
