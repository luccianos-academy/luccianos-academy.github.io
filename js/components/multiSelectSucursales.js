/* ============================
   Lucciano's Academy
   multiSelectSucursales.js

   Igual idea que autocompleteSucursal.js (buscador en vivo sobre
   ~95 locales) pero para elegir VARIOS a la vez, no uno solo — cada
   elegido queda como "chip" removible, y el valor final (para leer
   igual que cualquier otro campo del formulario) vive en un
   <input type="hidden"> con los nombres separados por coma. Usado
   por pages/manuales.js para acotar un manual a un grupo de locales
   sin tener que repetir el alta uno por uno.
=============================*/

import { getSucursales } from "../data/sucursales.js";

/** HTML del buscador + chips + input oculto con el valor real.
 *  inputId debe ser único en la página. */
export function MultiSelectSucursales(inputId, valoresIniciales = []) {
    return `
        <div class="autocomplete-wrap" id="${inputId}-wrap">
            <input
                id="${inputId}-buscar"
                type="text"
                autocomplete="off"
                placeholder="Escribí para buscar y agregar locales..."
            >
            <div id="${inputId}-list" class="autocomplete-list"></div>
            <div id="${inputId}-chips" class="multi-sucursal-chips"></div>
            <input type="hidden" id="${inputId}" value="${valoresIniciales.join(",")}">
        </div>
    `;
}

/** Conecta el buscador + chips. Llamar después de insertar el HTML en el DOM. */
export async function bindMultiSelectSucursales(inputId) {

    const wrap = document.getElementById(`${inputId}-wrap`);
    const buscar = document.getElementById(`${inputId}-buscar`);
    const list = document.getElementById(`${inputId}-list`);
    const chips = document.getElementById(`${inputId}-chips`);
    const hidden = document.getElementById(inputId);
    if (!wrap || !buscar || !list || !chips || !hidden) return;

    const sucursales = await getSucursales();
    const nombres = sucursales.filter((s) => s.estado === "Activa").map((s) => s.nombre);

    let elegidas = hidden.value ? hidden.value.split(",").map((n) => n.trim()).filter(Boolean) : [];

    function renderChips() {
        chips.innerHTML = elegidas.map((n) => `
            <span class="multi-sucursal-chip">${n.replace("Lucciano's ", "")}<button type="button" data-quitar-local="${n}" aria-label="Quitar">×</button></span>
        `).join("");
        hidden.value = elegidas.join(",");
        // Los formularios que ya usan esto (Manuales, Noticias) leen
        // el valor recién al guardar, nunca en vivo — así que este
        // evento no les cambiaba nada al agregarlo. pages/reportes.js
        // (filtro del Semáforo) sí necesita reaccionar al toque a
        // cada chip agregado/quitado, mismo patrón que un <select>
        // nativo disparando "change".
        hidden.dispatchEvent(new Event("change"));

        chips.querySelectorAll("[data-quitar-local]").forEach((btn) => {
            btn.addEventListener("click", () => {
                elegidas = elegidas.filter((n) => n !== btn.dataset.quitarLocal);
                renderChips();
            });
        });
    }

    function renderLista(valor) {
        const q = valor.toLowerCase().trim();
        const disponibles = nombres.filter((n) => !elegidas.includes(n));
        const filtradas = q ? disponibles.filter((n) => n.toLowerCase().includes(q)) : disponibles;

        list.innerHTML = filtradas.length
            ? filtradas.slice(0, 8).map((n) => `<div class="autocomplete-item">${n}</div>`).join("")
            : `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;
        list.classList.add("open");
    }

    buscar.addEventListener("input", () => renderLista(buscar.value));
    buscar.addEventListener("focus", () => renderLista(buscar.value));

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (!item || item.style.opacity === "0.6") return;
        elegidas.push(item.textContent);
        renderChips();
        buscar.value = "";
        list.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) list.classList.remove("open");
    });

    renderChips();
}
