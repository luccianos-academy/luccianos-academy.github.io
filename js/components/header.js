/* ============================
   Lucciano's Academy
   header.js — Header con saludo opcional
=============================*/

export function Header(titulo, subtitulo = "", { saludo = false } = {}) {

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

    return `<header class="header">${contenido}</header>`;
}
