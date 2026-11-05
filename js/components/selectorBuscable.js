/* ============================
   Lucciano's Academy
   components/selectorBuscable.js — Lista para elegir UNA opción, con buscador

   Regla del proyecto (skill "listas-con-buscador"): toda lista donde se elige entre muchas opciones (personas, locales, productos...)
   lleva un buscador. Un <select> con 130 locales o 350 personas no se puede usar. Este componente filtra mientras se escribe, sin
   importar mayúsculas, acentos ni espacios, y busca en el nombre Y en el detalle (ej. persona + local).

   SelectorBuscable({ id, opciones:[{ valor, etiqueta, detalle }], placeholder })  → HTML
   bindSelectorBuscable(id)                                                          → engancha el filtro y la selección
   El valor elegido se lee con valorSelectorBuscable(id) ("" si no eligió nada).
=============================*/

import { escaparHtml } from "../services/html.js";
import { normalizar } from "../services/alcance.js";

export function SelectorBuscable({ id, opciones, placeholder = "Buscar..." }) {
    return `
        <div class="selector-buscable" id="${id}-caja">
            <input type="search" id="${id}-buscar" placeholder="${escaparHtml(placeholder)}" autocomplete="off">
            <div class="selector-lista" id="${id}-lista" role="listbox" aria-label="${escaparHtml(placeholder)}">
                ${opciones.map((o) => `
                    <button type="button" class="selector-op" role="option" aria-selected="false" data-valor="${escaparHtml(o.valor)}"
                            data-texto="${escaparHtml(normalizar(`${o.etiqueta} ${o.detalle || ""} ${o.extra || ""}`))}">
                        <span class="selector-op-nombre">${escaparHtml(o.etiqueta)}</span>
                        ${o.detalle ? `<span class="selector-op-detalle">${escaparHtml(o.detalle)}</span>` : ""}
                    </button>`).join("")}
                <p class="selector-vacio" id="${id}-vacio" hidden>No hay resultados. Probá con otra parte del nombre o del local.</p>
            </div>
            <p class="text-xs text-muted selector-cuenta" id="${id}-cuenta"></p>
            <input type="hidden" id="${id}" value="">
        </div>`;
}

export function valorSelectorBuscable(id) {
    return document.getElementById(id)?.value || "";
}

export function bindSelectorBuscable(id) {
    const buscar = document.getElementById(`${id}-buscar`);
    const lista = document.getElementById(`${id}-lista`);
    const vacio = document.getElementById(`${id}-vacio`);
    const cuenta = document.getElementById(`${id}-cuenta`);
    const oculto = document.getElementById(id);
    if (!buscar || !lista || !oculto) return;
    const ops = [...lista.querySelectorAll(".selector-op")];

    const filtrar = () => {
        const palabras = normalizar(buscar.value).split(" ").filter(Boolean);       // "ana dot" encuentra a Ana de Dot
        let visibles = 0;
        ops.forEach((op) => {
            const coincide = palabras.every((p) => op.dataset.texto.includes(p));
            op.hidden = !coincide;
            if (coincide) visibles++;
        });
        vacio.hidden = visibles > 0;
        cuenta.textContent = palabras.length ? `${visibles} de ${ops.length}` : `${ops.length} en total`;
    };
    buscar.addEventListener("input", filtrar);
    lista.addEventListener("click", (e) => {
        const op = e.target.closest(".selector-op");
        if (!op) return;
        ops.forEach((o) => { const sel = o === op; o.classList.toggle("activa", sel); o.setAttribute("aria-selected", String(sel)); });
        oculto.value = op.dataset.valor;
    });
    filtrar();
}
