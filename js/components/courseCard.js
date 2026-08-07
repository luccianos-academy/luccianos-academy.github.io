/* ============================
   Lucciano's Academy
   courseCard.js

   Es un <a> real (mismo criterio que Sidebar/QuickAction) — si no
   se pasa href, cae a un <div> no clickeable (uso genérico).

   Cabecera visual por curso: foto real (recorte de los videos de
   portada ya usados en la página de detalle) para los módulos que
   tienen material propio, o un ícono de categoría sobre fondo de
   marca para el resto — no se inventa una foto que no existe.
=============================*/

import { Icon } from "./icons.js";

const TEMA_POR_CURSO = {
    // Las 3 fotos "panorámicas" (logo + texto pegados al borde
    // izquierdo, ver cursos.js) necesitan recortarse desde la
    // izquierda — si no, el "cover" centrado corta la L de Lucciano's.
    "Cafetería": { icono: "cafe", foto: "assets/img/cursos/cafeteria-hero.jpg", posicion: "left" },
    "Heladería": { icono: "helado", foto: "assets/img/vitrinas/vitrina-heladeria.png" },
    "Icepops": { icono: "icepop", foto: "assets/img/cursos/icepops.jpg" },
    "Pastelería": { icono: "pastel", foto: "assets/img/cursos/pasteleria-hero.jpg", posicion: "left" },
    "Chocolatería": { icono: "chocolate", foto: "assets/img/cursos/chocolateria.jpg" },
    "Sistema y Caja": { icono: "caja", foto: "assets/img/cursos/sistema-caja.jpg", posicion: "left" },
    "Atención al Cliente": { icono: "corazon", foto: "assets/img/cursos/atencion-cliente-hero.jpg", posicion: "left" },
    "Encargados y Responsables": { icono: "supervisores" },
};

/** Foto/ícono de un curso — expuesto para reusar el mismo mapeo fuera
 *  de la tarjeta chica (ej. la tarjeta protagonista del Home, que
 *  necesita la foto grande pero no el resto del markup de CourseCard). */
export function temaDeCurso(nombre) {
    return TEMA_POR_CURSO[nombre] || { icono: "academia" };
}

export function CourseCard({ nombre, detalle = "", progreso = null, href = null }) {
    const tag = href ? "a" : "div";
    const hrefAttr = href ? ` href="${href}"` : "";
    const tema = TEMA_POR_CURSO[nombre] || { icono: "academia" };

    const estiloFoto = tema.posicion ? ` style="object-position:${tema.posicion}"` : "";
    const media = tema.foto
        ? `<div class="course-media"><img src="${tema.foto}" alt=""${estiloFoto}></div>`
        : `<div class="course-media course-media-generico">${Icon(tema.icono, { size: 30 })}</div>`;

    return `
        <${tag} class="course"${hrefAttr}>
            ${media}
            <div class="course-body">
                <h3>${nombre}</h3>
                ${detalle ? `<div class="small">${detalle}</div>` : ""}
                ${progreso !== null ? `
                    <div class="bar"><span style="width:${progreso}%"></span></div>
                    <div class="small">${progreso}% completado</div>
                ` : ""}
            </div>
        </${tag}>
    `;
}
