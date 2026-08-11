/* ============================
   Lucciano's Academy
   components/avatar.js — Avatar del usuario (foto o iniciales)
============================*/

import { escaparHtml, urlSegura } from "../services/html.js";

function iniciales(nombre) {
    return String(nombre || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

/**
 * Pedirle a Drive una foto del tamaño que se va a DIBUJAR.
 *
 * subirFotoPerfil (apps-script/Code.gs) guarda la URL con "sz=w640", y
 * los avatares se muestran entre 28 y 48 px. Medido el 2026-08-09: esa
 * misma imagen pesa 71.591 bytes a w640 y 16.519 a w160 — o sea que
 * la lista de Colaboradores estaba bajando más de 3 MB de fotos para
 * mostrarlas del tamaño de una moneda. De ahí que "cuesta tanto en
 * cargar", y que algunas ni aparezcan: la que no llega a tiempo cae al
 * fallback de iniciales.
 *
 * 160 px cubre el avatar más grande (48 px) incluso en pantallas
 * retina, que piden el doble. Se reescribe al RENDERIZAR, no al
 * guardar, así también achica las fotos que ya están cargadas en la
 * planilla sin tener que tocarlas.
 */
const ANCHO_AVATAR = 160;

function fotoDelTamanoJusto(url) {
    return String(url || "")
        // https://drive.google.com/thumbnail?id=X&sz=w640
        .replace(/([?&]sz=w)\d+/, `$1${ANCHO_AVATAR}`)
        // https://lh3.googleusercontent.com/d/X=w640
        .replace(/=w\d+(-h\d+)?$/, `=w${ANCHO_AVATAR}`);
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
    const fotoSegura = urlSegura(fotoDelTamanoJusto(foto));

    if (fotoSegura) {
        // loading="lazy": en una lista de 45 personas el navegador
        // arrancaba las 45 descargas de una. decoding="async" evita que
        // decodificar la imagen frene el dibujado de la fila.
        return `<img class="${clases} avatar-foto" src="${fotoSegura}" alt="${nombreSeguro}" title="${nombreSeguro}" loading="lazy" decoding="async" style="object-fit:cover">`;
    }

    return `<span class="${clases}" title="${nombreSeguro}">${inicial}</span>`;
}

/**
 * Si la foto no carga, mostrar las iniciales en vez del ícono de imagen
 * rota del navegador.
 *
 * Pasa de verdad y es transitorio: Drive tarda un rato en servir el
 * thumbnail de un archivo recién subido, así que justo después de
 * cambiar la foto de perfil la URL ya está guardada pero todavía no
 * devuelve la imagen. Visto en vivo el 2026-08-09 — primero ícono roto,
 * después la foto vieja, y recién ahí la nueva. Un ícono roto parece un
 * error de la app; las iniciales son el estado que la app ya muestra
 * cuando alguien no tiene foto, así que no llama la atención.
 *
 * Se engancha UNA vez a nivel documento en fase de captura: los eventos
 * "error" de <img> no burbujean, pero sí se pueden capturar. Así funciona
 * para cualquier avatar, incluso los que se pintan después — no hace
 * falta que cada pantalla lo recuerde.
 *
 * A propósito NO se usa un onerror inline en el HTML: el nombre viene de
 * la planilla, y meterlo dentro de un atributo de evento reabriría
 * exactamente el agujero de inyección que services/html.js cerró.
 */
export function bindAvatarFallback() {
    document.addEventListener("error", (evento) => {
        const img = evento.target;
        if (!(img instanceof HTMLImageElement) || !img.classList.contains("avatar-foto")) return;

        // Un reintento antes de rendirse. Drive falla de forma pasajera
        // —sobre todo con una foto recién subida, o con muchas cargando
        // a la vez— y la primera versión de esto reemplazaba por las
        // iniciales al primer error, para siempre: la foto existía y
        // cargaba bien un segundo después, pero ya nadie la volvía a
        // pedir. Se ve como "no me aparece la foto".
        if (!img.dataset.reintento) {
            img.dataset.reintento = "1";
            const url = img.src;
            setTimeout(() => { img.src = url + (url.includes("?") ? "&" : "?") + "r=" + Date.now(); }, 1200);
            return;
        }

        const span = document.createElement("span");
        // Se conservan las clases de tamaño (publicacion-avatar-sm/lg/xl)
        // sacando solo la de la foto, así el círculo no cambia de tamaño
        // al caer al fallback.
        span.className = [...img.classList].filter((c) => c !== "avatar-foto").join(" ");
        span.title = img.alt || "";
        // textContent, no innerHTML: img.alt salió de la planilla.
        span.textContent = iniciales(img.alt);
        img.replaceWith(span);
    }, true);
}
