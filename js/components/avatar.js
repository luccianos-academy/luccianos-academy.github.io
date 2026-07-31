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

    if (foto) {
        return `<img class="${clases} avatar-foto" src="${foto}" alt="${nombre}" title="${nombre}" style="width:100%;height:100%;object-fit:cover">`;
    }

    return `<span class="${clases}" title="${nombre}">${inicial}</span>`;
}
