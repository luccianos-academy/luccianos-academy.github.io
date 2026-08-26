/* ============================
   Lucciano's Academy
   multiSelectAlcance.js — Elegir a quién le aplica un curso o lección

   Mismo mecanismo que multiSelectSucursales.js (buscador + chips +
   input oculto con los valores separados por coma), pero la lista
   ofrece PAÍSES y LOCALES juntos, que es lo que entiende el campo
   "aplicaA" — ver services/alcance.js.

   Los países van primero y no ordenados alfabéticamente: en la
   práctica se acota por país ("esto no va en Chile") mucho más seguido
   que local por local, y son 7 contra 123.

   VACÍO significa que le aplica a TODOS. Por eso el componente muestra
   ese estado con todas las letras en vez de dejar un campo en blanco
   que se puede leer como "no se cargó todavía".

   Existe como componente aparte y no como una variante de
   multiSelectSucursales porque ese ya lo usan Manuales, Noticias y el
   filtro de Reportes: meterle un modo nuevo lo volvía condicional en
   tres pantallas para las que los países no significan nada.
=============================*/

import { getSucursales } from "../data/sucursales.js";
import { escaparHtml } from "../services/html.js";

/** HTML del buscador + chips + input oculto con el valor real.
 *  inputId debe ser único en la página. */
export function MultiSelectAlcance(inputId, valorInicial = "") {
    return `
        <div class="autocomplete-wrap" id="${inputId}-wrap">
            <input
                id="${inputId}-buscar"
                type="text"
                autocomplete="off"
                placeholder="Escribí un país o un local para agregarlo..."
            >
            <div id="${inputId}-list" class="autocomplete-list"></div>
            <div id="${inputId}-chips" class="multi-sucursal-chips"></div>
            <p id="${inputId}-estado" class="text-xs text-muted" style="margin-top:6px"></p>
            <input type="hidden" id="${inputId}" value="${escaparHtml(valorInicial)}">
        </div>
    `;
}

/** Conecta el buscador + chips. Llamar después de insertar el HTML. */
export async function bindMultiSelectAlcance(inputId) {

    const wrap = document.getElementById(`${inputId}-wrap`);
    const buscar = document.getElementById(`${inputId}-buscar`);
    const list = document.getElementById(`${inputId}-list`);
    const chips = document.getElementById(`${inputId}-chips`);
    const estado = document.getElementById(`${inputId}-estado`);
    const hidden = document.getElementById(inputId);
    if (!wrap || !buscar || !list || !chips || !hidden) return;

    const sucursales = await getSucursales();
    const activas = sucursales.filter((s) => s.estado === "Activa");

    // Los países salen de los locales cargados, no de una lista fija:
    // el día que abra el primero de un país nuevo aparece solo.
    const paises = [...new Set(activas.map((s) => s.pais).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"));
    const locales = activas.map((s) => s.nombre);

    const cuantosEn = (pais) => activas.filter((s) => s.pais === pais).length;

    // "Propios"/"Franquicias" — pedido explícito para Gestión semanal
    // (services/alcance.js → aplicaASucursal), mismo campo esPropio que
    // ya usa Canales. Fijos (no salen de los datos como los países)
    // porque son solo dos y siempre existen los dos, y van primero: es
    // la elección más común en Gestión semanal, más que país o local
    // puntual.
    const tipos = ["Propios", "Franquicias"];
    const cuantosDeTipo = (tipo) => activas.filter((s) => s.esPropio === (tipo === "Propios")).length;

    let elegidas = hidden.value.split(",").map((n) => n.trim()).filter(Boolean);

    function renderChips() {
        chips.innerHTML = elegidas.map((n) => `
            <span class="multi-sucursal-chip">${escaparHtml(n.replace("Lucciano's ", ""))}<button type="button" data-quitar-alcance="${escaparHtml(n)}" aria-label="Quitar">×</button></span>
        `).join("");
        hidden.value = elegidas.join(",");
        hidden.dispatchEvent(new Event("change"));

        // Un campo vacío se lee como "falta cargarlo". Acá vacío es una
        // decisión —le aplica a todos— y conviene decirlo.
        estado.textContent = elegidas.length
            ? "Solo le aparece a quien trabaje en lo de arriba."
            : "Sin nada cargado le aplica a TODOS los locales de la red.";

        chips.querySelectorAll("[data-quitar-alcance]").forEach((btn) => {
            btn.addEventListener("click", () => {
                elegidas = elegidas.filter((n) => n !== btn.dataset.quitarAlcance);
                renderChips();
            });
        });
    }

    function renderLista(valor) {
        const q = valor.toLowerCase().trim();
        const libre = (n) => !elegidas.includes(n);
        const coincide = (n) => !q || n.toLowerCase().includes(q);

        const tiposOk = tipos.filter((t) => libre(t) && coincide(t));
        const paisesOk = paises.filter((p) => libre(p) && coincide(p));
        const localesOk = locales.filter((n) => libre(n) && coincide(n));

        const html = [];
        if (tiposOk.length) {
            html.push(`<div class="autocomplete-grupo">Tipo de local</div>`);
            tiposOk.forEach((t) => {
                const n = cuantosDeTipo(t);
                html.push(`<div class="autocomplete-item" data-valor="${escaparHtml(t)}">${escaparHtml(t)} <span class="text-xs text-muted">(${n} ${n === 1 ? "local" : "locales"})</span></div>`);
            });
        }
        if (paisesOk.length) {
            html.push(`<div class="autocomplete-grupo">Países</div>`);
            paisesOk.forEach((p) => {
                const n = cuantosEn(p);
                html.push(`<div class="autocomplete-item" data-valor="${escaparHtml(p)}">${escaparHtml(p)} <span class="text-xs text-muted">(${n} ${n === 1 ? "local" : "locales"})</span></div>`);
            });
        }
        if (localesOk.length) {
            html.push(`<div class="autocomplete-grupo">Locales</div>`);
            // Tope de 8 como el resto de los autocompletes: con 123
            // locales la lista sin cortar tapa el formulario entero.
            localesOk.slice(0, 8).forEach((n) => {
                html.push(`<div class="autocomplete-item" data-valor="${escaparHtml(n)}">${escaparHtml(n)}</div>`);
            });
            if (localesOk.length > 8) {
                html.push(`<div class="autocomplete-grupo">…y ${localesOk.length - 8} más — seguí escribiendo</div>`);
            }
        }

        list.innerHTML = html.length
            ? html.join("")
            : `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;
        list.classList.add("open");
    }

    buscar.addEventListener("input", () => renderLista(buscar.value));
    buscar.addEventListener("focus", () => renderLista(buscar.value));

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".autocomplete-item[data-valor]");
        if (!item) return;
        elegidas.push(item.dataset.valor);
        renderChips();
        buscar.value = "";
        list.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) list.classList.remove("open");
    });

    renderChips();
}
