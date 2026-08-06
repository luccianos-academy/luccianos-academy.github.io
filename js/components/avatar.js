/* ============================
   FARO v4
   components/avatar.js — Avatar del usuario (foto o iniciales)
============================*/

function iniciales(nombre) {
    return String(nombre || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export function Avatar({ nombre, foto, size = "md" }) {
    const inicial = iniciales(nombre);
    const clases = `publicacion-avatar publicacion-avatar-${size}`;

    // El tamaño real (36px/28px/etc) sale de la clase .publicacion-avatar*
    // (css/components.css) — ANTES acá se pisaba con width/height:100%
    // inline, que solo funciona si el llamador envuelve el Avatar en un
    // contenedor con tamaño explícito (ver perfil.js). En cualquier otro
    // lugar (ej. la columna "Nombre" de las tablas de Colaboradores) no
    // hay ese contenedor, así que el 100% se resolvía contra el tamaño
    // natural de la FOTO — una imagen de varios cientos de px tapando
    // toda la fila. object-fit sigue haciendo falta para que una foto no
    // cuadrada no se deforme dentro del círculo.
    if (foto) {
        return `<img class="${clases} avatar-foto" src="${foto}" alt="${nombre}" title="${nombre}" style="object-fit:cover">`;
    }

    return `<span class="${clases}" title="${nombre}">${inicial}</span>`;
}
