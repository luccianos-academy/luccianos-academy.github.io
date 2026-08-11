/* ============================
   Lucciano's Academy
   components/avatar.js — Avatar del usuario (foto o iniciales)
============================*/

import { escaparHtml, urlSegura } from "../services/html.js";

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
    // nombre y foto salen de la planilla: van escapados SIEMPRE. Sin
    // esto, un valor con comillas en "foto" cierra el atributo src y
    // deja inyectar un onerror que corre en la sesión de quien mire la
    // pantalla — y la lista de Colaboradores la mira un admin.
    const nombreSeguro = escaparHtml(nombre);
    const fotoSegura = urlSegura(foto);

    if (fotoSegura) {
        return `<img class="${clases} avatar-foto" src="${fotoSegura}" alt="${nombreSeguro}" title="${nombreSeguro}" style="object-fit:cover">`;
    }

    return `<span class="${clases}" title="${nombreSeguro}">${inicial}</span>`;
}
