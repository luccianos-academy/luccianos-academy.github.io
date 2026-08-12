/* ============================
   Lucciano's Academy
   services/formato.js — Formato del texto de las lecciones

   Marcas simples sobre TEXTO PLANO, no HTML:

       **negrita**
       - item de lista
       1. item numerado
       (línea en blanco = párrafo nuevo)

   Se guarda el texto tal cual se escribe y el HTML se arma acá, al
   mostrar. Guardar HTML directo sería más flexible pero convierte un
   campo que edita el Admin y leen todos en un vector de inyección: hoy
   el contenido se pinta con innerHTML, así que un <script> pegado en un
   procedimiento correría en la sesión de cada colaborador. Con marcas,
   el texto se escapa primero y las únicas etiquetas que salen son las
   que genera este archivo.

   ── Por qué existe ────────────────────────────────────────────────
   Antes el formato se ADIVINABA (ver renderProcedimiento): si el texto
   empezaba con "1)" se volvía pasos numerados, si tenía "•" una lista,
   y si no, se partía por los puntos. Escribir dos oraciones seguidas
   daba una lista de dos ítems sin haberlo pedido, y no había forma de
   escribir un párrafo largo ni de resaltar una palabra.

   La adivinanza NO se borró: las ~100 lecciones ya cargadas no tienen
   marcas y seguirían viéndose como una pared de texto. El texto con
   marcas se respeta al pie de la letra; el que no las tiene cae al
   comportamiento de siempre.
=============================*/

import { escaparHtml } from "./html.js";

/** ¿El texto usa marcas explícitas? Decide si se respeta al pie de la
 *  letra o si cae al formateo por adivinanza de siempre. */
export function tieneFormato(texto) {
    const t = String(texto || "");
    return /\*\*[^*]+\*\*/.test(t) || /^\s*[-*]\s+/m.test(t) || /^\s*\d+\.\s+/m.test(t);
}

/** Negrita dentro de una línea. Se aplica DESPUÉS de escapar, así el
 *  <strong> es la única etiqueta que sobrevive. */
function conNegrita(textoEscapado) {
    return textoEscapado.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/**
 * Texto con marcas → HTML.
 *
 * Se recorre línea por línea y no con expresiones sobre todo el texto:
 * hay que saber dónde empieza y termina cada lista para abrir y cerrar
 * el <ul>/<ol>, y eso no se resuelve reemplazando de a una línea.
 */
export function formatearTexto(texto) {
    const lineas = String(texto || "").split(/\r?\n/);
    const partes = [];
    let lista = null;     // "ul" | "ol" | null
    let parrafo = [];

    const cerrarParrafo = () => {
        if (!parrafo.length) return;
        partes.push(`<p>${conNegrita(escaparHtml(parrafo.join(" ")))}</p>`);
        parrafo = [];
    };
    const cerrarLista = () => {
        if (!lista) return;
        partes.push(`</${lista}>`);
        lista = null;
    };

    lineas.forEach((cruda) => {
        const linea = cruda.trim();

        if (!linea) { cerrarParrafo(); cerrarLista(); return; }

        const vinieta = linea.match(/^[-*]\s+(.*)$/);
        const numerada = linea.match(/^\d+\.\s+(.*)$/);

        if (vinieta || numerada) {
            cerrarParrafo();
            const tipo = vinieta ? "ul" : "ol";
            // Cambiar de viñetas a numerada sin línea en blanco en el
            // medio tiene que cerrar una lista y abrir la otra, no
            // mezclar los <li> dentro de la primera.
            if (lista !== tipo) { cerrarLista(); partes.push(`<${tipo} class="leccion-lista">`); lista = tipo; }
            partes.push(`<li>${conNegrita(escaparHtml((vinieta || numerada)[1]))}</li>`);
            return;
        }

        cerrarLista();
        // Las líneas seguidas se unen en un párrafo: en un textarea se
        // corta a mitad de una oración sin querer, y cada corte no
        // debería ser un párrafo aparte. El párrafo se separa con una
        // línea EN BLANCO, que es explícito.
        parrafo.push(linea);
    });

    cerrarParrafo();
    cerrarLista();
    return partes.join("");
}
