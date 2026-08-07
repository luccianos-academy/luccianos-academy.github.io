/* ============================
   Lucciano's Academy
   components/procedimiento.js

   Formateador de texto plano tipo "1) ... 2) ... 3) ..." o
   "Nombre: detalle. Nombre: detalle." en una lista prolija — antes
   vivía solo en pages/cursos.js (procedimiento de lección); se
   extrajo acá para que pages/noticias.js (detalle de noticia) use el
   mismo lenguaje visual sin duplicar la lógica de parseo.
=============================*/

/** "Nombre: detalle." o "Nombre (detalle)." — separa nombre/detalle
 *  para la lista con bullet; si no matchea ningún patrón, todo el
 *  ítem pasa a "nombre" sin detalle. */
function formatearItem(item) {
    let m = item.match(/^([^:]+):\s*(.+)$/);
    if (m) return { nombre: m[1].trim(), detalle: m[2].trim() };
    m = item.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (m) return { nombre: m[1].trim(), detalle: m[2].trim() };
    return { nombre: item, detalle: "" };
}

/** Pasos numerados explícitos ("1) ... 2) ... 3) ...") — círculo
 *  numerado, mismo lenguaje visual que la maqueta aprobada para
 *  procesos secuenciales. */
function renderPasosNumerados(texto) {
    const pasos = texto
        .split(/\s*\d+\)\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s));

    return `
        <ol class="leccion-pasos">
            ${pasos.map((p) => `<li><span class="leccion-paso-num"></span><span>${p}</span></li>`).join("")}
        </ol>
    `;
}

/** Texto plano con 3+ ítems tipo "Nombre: detalle" queda como pared
 *  de texto en un único párrafo — si los detecta, los separa en una
 *  lista prolija; si no, lo deja como párrafo normal. Detecta bullets (•),
 *  saltos de línea, o puntos separadores. */
export function renderProcedimiento(texto) {
    if (!texto) return "";
    if (/^1\)\s/.test(texto.trim())) return renderPasosNumerados(texto);

    let items = [];

    // Intenta detectar bullet points (•) primero
    if (texto.includes("•")) {
        items = texto
            .split("•")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // Si no hay bullets, intenta saltos de línea
    else if (/\n/.test(texto)) {
        items = texto
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }
    // Si no hay saltos, intenta puntos como separador
    else {
        items = texto
            .split(/\.\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s));
    }

    if (items.length < 3) {
        return `<p class="text-sm" style="margin-top:10px;color:var(--text);white-space:pre-wrap">${texto}</p>`;
    }

    return `
        <ul class="leccion-procedimiento-lista">
            ${items.map((item) => {
                const { nombre, detalle } = formatearItem(item);
                return `<li><strong>${nombre}</strong>${detalle ? ` <span class="text-muted">— ${detalle}</span>` : ""}</li>`;
            }).join("")}
        </ul>
    `;
}
