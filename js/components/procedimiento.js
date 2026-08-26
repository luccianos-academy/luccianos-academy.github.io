/* ============================
   Lucciano's Academy
   components/procedimiento.js

   Formateador de texto plano tipo "1) ... 2) ... 3) ..." o
   "Nombre: detalle. Nombre: detalle." en una lista prolija — antes
   vivía solo en pages/cursos.js (procedimiento de lección); se
   extrajo acá para que pages/noticias.js (detalle de noticia) use el
   mismo lenguaje visual sin duplicar la lógica de parseo.
=============================*/

import { tieneFormato, formatearTexto } from "../services/formato.js";
import { escaparHtml } from "../services/html.js";

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

/**
 * Pasos numerados explícitos ("1) ... 2) ... 3) ...") — círculo
 * numerado, mismo lenguaje visual que la maqueta aprobada para
 * procesos secuenciales. Lo produce pages/academia.js (editor de
 * lecciones, sección Procedimiento).
 *
 * Admite sub-puntos: una línea indentada con "- " (o "* ") justo
 * debajo de un paso se anida como lista dentro de ESE paso, en vez de
 * ser otro paso. Sin saltos de línea (formato viejo, guardado como una
 * sola línea "1) ... 2) ...") no hay forma de distinguir sub-puntos —
 * se parte como siempre, sin anidar nada.
 */
function renderPasosNumerados(texto) {
    if (!/\n/.test(texto)) {
        const pasos = texto
            .split(/\s*\d+\)\s*/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s));
        return renderListaPasos(pasos.map((p) => ({ texto: p, subpuntos: [] })));
    }

    const pasos = [];
    texto.split(/\r?\n/).forEach((cruda) => {
        if (!cruda.trim()) return;
        const indentada = /^[ \t]/.test(cruda);
        const linea = cruda.trim();
        const mPaso = !indentada && linea.match(/^\d+\)\s*(.*)$/);
        const mSub = indentada && linea.match(/^[-*]\s+(.*)$/);
        if (mPaso) {
            let t = mPaso[1].trim();
            if (t.endsWith(".")) t = t.slice(0, -1);
            pasos.push({ texto: t, subpuntos: [] });
        } else if (mSub && pasos.length) {
            pasos[pasos.length - 1].subpuntos.push(mSub[1].trim());
        }
    });

    return renderListaPasos(pasos);
}

function renderListaPasos(pasos) {
    return `
        <ol class="leccion-pasos">
            ${pasos.map((p) => `
                <li>
                    <span class="leccion-paso-num"></span>
                    <div class="leccion-paso-cuerpo">
                        <span>${escaparHtml(p.texto)}</span>
                        ${p.subpuntos.length ? `<ul class="leccion-subpuntos">${p.subpuntos.map((s) => `<li>${escaparHtml(s)}</li>`).join("")}</ul>` : ""}
                    </div>
                </li>
            `).join("")}
        </ol>
    `;
}

/** Texto plano con 3+ ítems tipo "Nombre: detalle" queda como pared
 *  de texto en un único párrafo — si los detecta, los separa en una
 *  lista prolija; si no, lo deja como párrafo normal. Detecta bullets (•),
 *  saltos de línea, o puntos separadores. */
export function renderProcedimiento(texto) {
    if (!texto) return "";

    // "1) paso ... 2) paso ..." (con o sin sub-puntos "- " indentados
    // debajo de cada uno) es el formato reservado del editor de pasos
    // de Academia — se chequea ANTES que tieneFormato a propósito: un
    // sub-punto indentado matchea el mismo patrón "- item" que
    // tieneFormato() usa para detectar viñetas sueltas, así que sin
    // este orden un paso con sub-puntos caía en formatearTexto() y
    // perdía la asociación paso→sub-puntos (todos los "N)" se
    // aplanaban en un solo párrafo, los sub-puntos quedaban como una
    // lista genérica sin saber de qué paso eran).
    if (/^1\)\s/.test(texto.trim())) return renderPasosNumerados(texto);

    // Si el texto trae marcas explícitas (**negrita**, "- item", "1.
    // item") se respeta al pie de la letra. Todo lo de abajo es
    // adivinanza sobre texto sin formato, y adivinar encima de algo que
    // el autor ya declaró sería pisarlo: escribir dos oraciones seguidas
    // terminaba dando una lista de dos ítems que nadie pidió.
    if (tieneFormato(texto)) return `<div class="leccion-texto">${formatearTexto(texto)}</div>`;

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
        // Sin "color" inline a propósito (antes tenía var(--text)
        // fijo) — reportado en vivo: dentro de un callout de módulo
        // con tema propio (Heladería/Cafetería/Chocolatería/Icepops,
        // fondo pastel CLARO) ese color fijo pisaba cualquier ajuste
        // de contraste que el CSS del callout quisiera aplicar —
        // texto claro sobre fondo claro, casi invisible. Sin el
        // inline, hereda el color correcto del contexto que lo
        // rodea en cada caso (ver .leccion-callout en components.css).
        return `<p class="text-sm" style="margin-top:10px;white-space:pre-wrap">${texto}</p>`;
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
