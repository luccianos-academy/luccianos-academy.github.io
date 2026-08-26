/* ============================
   Lucciano's Academy
   autocompleteSucursal.js

   Con ~95 locales reales, un <select> deja de ser usable — este
   combo (input de texto + lista filtrada en vivo) reemplaza al
   <select id="input-sucursal"> en los modales que piden elegir
   una sucursal. Reutiliza data/sucursales.js, no agrega funciones
   nuevas a la capa de datos.
=============================*/

import { getSucursales } from "../data/sucursales.js";

/** HTML del input + la lista de sugerencias. inputId debe ser único en la página. */
export function AutocompleteSucursal(inputId, valorInicial = "") {
    return `
        <div class="autocomplete-wrap">
            <input
                id="${inputId}"
                type="text"
                autocomplete="off"
                placeholder="Escribí para buscar el local..."
                value="${valorInicial}"
            >
            <div id="${inputId}-list" class="autocomplete-list"></div>
        </div>
    `;
}

/** Conecta el filtrado en vivo. Llamar después de insertar el HTML en el DOM.
 *  `onSeleccionar(nombre)` es opcional — además de dejar el nombre en
 *  el input (como siempre), avisa a quien llamó que se eligió un
 *  local. Sin esto, quien lo usa tendría que releer el input en algún
 *  otro momento (ej. al enviar un form) — pantallas que reaccionan AL
 *  elegir (ej. Gestión semanal, que trae los datos de ese local al
 *  toque) necesitan el aviso inmediato. */
export async function bindAutocompleteSucursal(inputId, onSeleccionar) {

    const input = document.getElementById(inputId);
    const list = document.getElementById(`${inputId}-list`);
    if (!input || !list) return;

    const sucursales = await getSucursales();
    const nombres = sucursales.filter((s) => s.estado === "Activa").map((s) => s.nombre);

    const render = (valor) => {
        const q = valor.toLowerCase().trim();
        const filtradas = q ? nombres.filter((n) => n.toLowerCase().includes(q)) : nombres;

        list.innerHTML = filtradas.length
            ? filtradas.slice(0, 8).map((n) => `<div class="autocomplete-item">${n}</div>`).join("")
            : `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;

        list.classList.add("open");
    };

    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (!item || item.style.opacity === "0.6") return;
        input.value = item.textContent;
        list.classList.remove("open");
        onSeleccionar?.(item.textContent);
    });

    // "pointerdown" y no "click" — mismo fix que multiSelectAlcance.js:
    // dentro de un contenedor que también scrollea, un intento de tocar
    // afuera para cerrar la lista puede interpretarse como un gesto de
    // scroll y nunca disparar "click", dejando la lista abierta sin
    // forma de cerrarla. "pointerdown" dispara apenas el dedo toca.
    document.addEventListener("pointerdown", (e) => {
        if (!e.target.closest(`#${inputId}, #${inputId}-list`)) {
            list.classList.remove("open");
        }
    });
}
