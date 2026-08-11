/* ============================
   Lucciano's Academy
   components/leccionEditable.js — La lección como se ve, editable

   Antes, para cambiar el texto de una lección había que ir a Academia,
   abrir un formulario de once campos, guardar, y recién entonces ir a
   Cursos a ver cómo había quedado. Dos pantallas para una sola tarea, y
   editando a ciegas.

   Esto trae la vista real AL editor, que es como lo resuelven las
   herramientas de autoría de producto (el Course Editor de Duolingo, el
   editor de temas de Shopify, cualquier CMS con preview). El camino
   contrario —meter botones de edición en la pantalla del colaborador—
   se descartó a propósito: deja controles de gestión a la vista de
   cualquiera que mire por encima del hombro, y no es lo que hace
   ninguna app parecida.

   Se edita POR SECCIÓN, no la lección entera: el caso real es "veo un
   error en un párrafo y lo quiero corregir", y abrir once campos para
   eso es desproporcionado. Además cada guardado manda un solo campo,
   que con el backend de Apps Script (~1,5s por escritura) es tolerable
   justamente porque se toca una cosa por vez.

   Los campos de configuración (video, manual, imagen, orden, duración)
   NO están acá: siguen en el formulario completo de academia.js, que es
   donde tienen sentido. Acá va solo el contenido que se lee.
=============================*/

import { renderProcedimiento } from "./procedimiento.js";
import { escaparHtml } from "../services/html.js";
import { actualizarLeccion } from "../data/lecciones.js";

/**
 * Qué se puede editar en línea y cómo se dibuja cada cosa.
 *
 * "vacio" es el texto que se muestra cuando el campo está vacío — sin
 * eso, un campo sin cargar no se dibuja y por lo tanto no hay dónde
 * tocar para completarlo: quedaría solo editable desde el formulario
 * viejo, que es justo lo que se quiere evitar.
 */
const SECCIONES = [
    { campo: "titulo", etiqueta: "Título", vacio: "Sin título", multilinea: false },
    { campo: "objetivo", etiqueta: "Objetivo", vacio: "Agregar un objetivo", multilinea: false },
    { campo: "procedimiento", etiqueta: "Procedimiento", vacio: "Agregar el paso a paso", multilinea: true },
    { campo: "errores", etiqueta: "Errores frecuentes", vacio: "Agregar errores frecuentes", multilinea: true },
    { campo: "buenasPracticas", etiqueta: "Buenas prácticas", vacio: "Agregar buenas prácticas", multilinea: true },
    { campo: "consejo", etiqueta: "Consejo", vacio: "Agregar un consejo", multilinea: true },
    { campo: "resumen", etiqueta: "Resumen", vacio: "Agregar un resumen", multilinea: true },
];

/** El cuerpo de cada sección, dibujado igual que en la lección real
 *  (mismas clases que pages/cursos.js) para que lo que se ve editando
 *  sea lo que va a ver el colaborador. */
function cuerpoSeccion(seccion, valor) {
    if (!valor) {
        return `<p class="text-sm" style="color:var(--muted);font-style:italic">${escaparHtml(seccion.vacio)}</p>`;
    }

    if (seccion.campo === "titulo") {
        return `<p style="margin:0;font-size:16px;font-weight:500">${escaparHtml(valor)}</p>`;
    }
    if (seccion.campo === "objetivo") {
        return `<p class="text-sm text-muted" style="margin:0">${escaparHtml(valor)}</p>`;
    }
    if (seccion.campo === "procedimiento") {
        // renderProcedimiento arma su propio HTML (lista de pasos) — no
        // se escapa acá porque no es un dato crudo, es markup generado.
        return renderProcedimiento(valor);
    }
    if (seccion.campo === "resumen") {
        return `<p class="text-sm text-muted" style="margin:0">${escaparHtml(valor)}</p>`;
    }

    const clase = seccion.campo === "errores"
        ? "leccion-callout leccion-callout-errores"
        : seccion.campo === "consejo"
        ? "leccion-callout leccion-callout-tip"
        : "leccion-callout";

    return `<div class="${clase}" style="margin-top:0"><strong>${escaparHtml(seccion.etiqueta)}</strong><p>${escaparHtml(valor)}</p></div>`;
}

function seccionHtml(seccion, leccion) {
    return `
        <div class="leccion-seccion" data-seccion="${seccion.campo}">
            <div class="leccion-seccion-cuerpo">${cuerpoSeccion(seccion, leccion[seccion.campo])}</div>
            <button class="leccion-seccion-editar" type="button" data-editar-seccion="${seccion.campo}" aria-label="Editar ${escaparHtml(seccion.etiqueta)}">✎</button>
        </div>
    `;
}

export function LeccionEditable(leccion) {
    return `
        <div class="leccion-editable">
            ${SECCIONES.map((s) => seccionHtml(s, leccion)).join("")}
        </div>
    `;
}

/**
 * Engancha los lápices. `leccion` se muta con lo que se va guardando,
 * así el llamador tiene el objeto al día sin volver a pedirlo al
 * backend.
 */
export function bindLeccionEditable(leccion, { alGuardar } = {}) {
    const raiz = document.querySelector(".leccion-editable");
    if (!raiz) return;

    raiz.querySelectorAll("[data-editar-seccion]").forEach((btn) => {
        btn.addEventListener("click", () => abrirEditor(btn.dataset.editarSeccion));
    });

    function abrirEditor(campo) {
        const seccion = SECCIONES.find((s) => s.campo === campo);
        const contenedor = raiz.querySelector(`[data-seccion="${campo}"]`);
        if (!seccion || !contenedor || contenedor.dataset.editando) return;
        contenedor.dataset.editando = "1";

        const valorOriginal = leccion[campo] || "";
        const control = seccion.multilinea
            ? `<textarea class="leccion-seccion-input" rows="4"></textarea>`
            : `<input type="text" class="leccion-seccion-input">`;

        contenedor.innerHTML = `
            <label class="text-xs text-muted" style="display:block;margin-bottom:6px">${escaparHtml(seccion.etiqueta)}</label>
            ${control}
            <div class="leccion-seccion-acciones">
                <button class="btn btn-sutil" type="button" data-cancelar>Cancelar</button>
                <button class="btn btn-primary" type="button" data-guardar>Guardar</button>
            </div>
        `;

        // El valor se asigna por propiedad, no interpolado en el HTML:
        // un texto con comillas rompería el atributo, y además así no
        // hace falta escapar nada para que se vea tal cual se guardó.
        const input = contenedor.querySelector(".leccion-seccion-input");
        input.value = valorOriginal;
        input.focus();

        contenedor.querySelector("[data-cancelar]").addEventListener("click", () => cerrarEditor(campo));

        contenedor.querySelector("[data-guardar]").addEventListener("click", async (e) => {
            const boton = e.currentTarget;
            const nuevo = input.value.trim();

            if (nuevo === valorOriginal) { cerrarEditor(campo); return; }
            if (campo === "titulo" && !nuevo) {
                alert("El título no puede quedar vacío.");
                return;
            }

            boton.disabled = true;
            boton.textContent = "Guardando...";

            const r = await actualizarLeccion(leccion.id, { [campo]: nuevo }).catch(() => null);
            if (!r || r.ok === false) {
                alert(r?.error || "No se pudo guardar. Probá de nuevo.");
                boton.disabled = false;
                boton.textContent = "Guardar";
                return;
            }

            leccion[campo] = nuevo;
            cerrarEditor(campo);
            if (alGuardar) alGuardar(campo, nuevo);
        });
    }

    function cerrarEditor(campo) {
        const seccion = SECCIONES.find((s) => s.campo === campo);
        const contenedor = raiz.querySelector(`[data-seccion="${campo}"]`);
        if (!seccion || !contenedor) return;

        contenedor.innerHTML = `
            <div class="leccion-seccion-cuerpo">${cuerpoSeccion(seccion, leccion[campo])}</div>
            <button class="leccion-seccion-editar" type="button" data-editar-seccion="${campo}" aria-label="Editar ${escaparHtml(seccion.etiqueta)}">✎</button>
        `;
        delete contenedor.dataset.editando;
        contenedor.querySelector("[data-editar-seccion]").addEventListener("click", () => abrirEditor(campo));
    }
}
