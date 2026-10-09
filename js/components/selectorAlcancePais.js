/* ============================
   Lucciano's Academy
   selectorAlcancePais.js — Elegir a quién le aplica algo, por PAÍS

   Reemplaza al buscador libre de multiSelectAlcance.js en Gestión de
   tareas. Decisión de producto: lo que se carga es, ante todo, para
   Argentina; cada otro país es independiente (puede tener sus propias
   variantes de cómo se trabaja) y se elige a propósito, no se hereda
   por estar "vacío". Dentro de los países elegidos se decide si es para
   todos los locales, solo propios o solo franquicias — UNA sola regla
   para todos los países que se marquen a la vez.

   Se guarda en el mismo campo de siempre (aplicaA), en el formato que
   entiende services/alcance.js:
       "Argentina"                → todos los locales de Argentina
       "Argentina:Propios"        → solo los propios de Argentina
       "Argentina, Chile"         → todos los locales de los dos países
       "Chile:Franquicias"        → solo las franquicias de Chile

   Lo que este selector no sabe representar (un local puntual, o un
   "Propios" suelto de antes que valía para cualquier país) se CONSERVA
   tal cual como un chip aparte: abrir y guardar una tarea vieja nunca
   cambia en silencio a quién le aplica.
=============================*/

import { getSucursales } from "../data/sucursales.js";
import { normalizar } from "../services/alcance.js";
import { escaparHtml } from "../services/html.js";

const TIPOS = [
    { valor: "todos", etiqueta: "Todos los locales" },
    { valor: "propios", etiqueta: "Solo propios" },
    { valor: "franquicias", etiqueta: "Solo franquicias" },
];

export const PAIS_BASE = "Argentina";

export function SelectorAlcancePais(inputId, valorInicial = "") {
    return `
        <div class="alcance-pais" id="${inputId}-wrap">
            <div class="alcance-pais-fila">
                <span class="alcance-pais-label">País</span>
                <div class="alcance-pais-pills" id="${inputId}-paises"></div>
            </div>
            <div class="alcance-pais-fila">
                <span class="alcance-pais-label">Tipo de local</span>
                <div class="alcance-pais-pills" id="${inputId}-tipos"></div>
            </div>
            <div id="${inputId}-extras" class="multi-sucursal-chips"></div>
            <p id="${inputId}-estado" class="text-xs text-muted" style="margin-top:6px"></p>
            <input type="hidden" id="${inputId}" value="${escaparHtml(valorInicial)}">
        </div>
    `;
}

export async function bindSelectorAlcancePais(inputId) {
    const hidden = document.getElementById(inputId);
    const paisesEl = document.getElementById(`${inputId}-paises`);
    const tiposEl = document.getElementById(`${inputId}-tipos`);
    const extrasEl = document.getElementById(`${inputId}-extras`);
    const estadoEl = document.getElementById(`${inputId}-estado`);
    if (!hidden || !paisesEl || !tiposEl || !extrasEl || !estadoEl) return;

    const sucursales = await getSucursales();
    const activos = [...new Set(sucursales.filter((s) => s.estado === "Activa").map((s) => s.pais).filter(Boolean))];

    // Valor inicial → países elegidos + un tipo + lo que no se sabe
    // representar. El primer tipo que aparezca gana; un país con otro
    // tipo distinto queda como extra, intacto.
    let paises = [];
    let tipo = "todos";
    let extras = [];
    let tipoFijado = false;
    hidden.value.split(",").map((t) => t.trim()).filter(Boolean).forEach((raw) => {
        const compuesto = raw.match(/^(.+):(propios|franquicias)$/i);
        if (compuesto) {
            const t = compuesto[2].toLowerCase();
            if (!tipoFijado) { tipo = t; tipoFijado = true; }
            if (t === tipo) { paises.push(compuesto[1].trim()); return; }
            extras.push(raw);
            return;
        }
        const conocido = activos.find((p) => normalizar(p) === normalizar(raw));
        if (conocido) {
            if (!tipoFijado) { tipo = "todos"; tipoFijado = true; }
            if (tipo === "todos") { paises.push(conocido); return; }
            extras.push(raw);
            return;
        }
        extras.push(raw);
    });

    // Los países que ya estaban elegidos aparecen aunque hoy no tengan
    // ningún local activo; Argentina siempre primero.
    const todosLosPaises = [...new Set([...activos, ...paises])]
        .sort((a, b) => (a === PAIS_BASE ? -1 : b === PAIS_BASE ? 1 : a.localeCompare(b, "es")));

    function serializar() {
        const tokens = paises.map((p) => (tipo === "todos" ? p : `${p}:${tipo === "propios" ? "Propios" : "Franquicias"}`));
        // Sin ningún país y un tipo elegido: el token suelto de siempre
        // ("Propios"/"Franquicias" = en cualquier país).
        if (!paises.length && tipo !== "todos") {
            const suelto = tipo === "propios" ? "Propios" : "Franquicias";
            if (!extras.some((e) => normalizar(e) === normalizar(suelto))) tokens.push(suelto);
        }
        return [...tokens, ...extras].join(",");
    }

    function describir() {
        const partes = [];
        if (paises.length) {
            const queTipo = tipo === "todos" ? "todos los locales" : tipo === "propios" ? "solo propios" : "solo franquicias";
            partes.push(`${paises.join(" y ")} (${queTipo})`);
        } else if (tipo !== "todos") {
            partes.push(`${tipo === "propios" ? "locales propios" : "franquicias"} de cualquier país`);
        }
        extras.forEach((e) => partes.push(e));
        return partes.length
            ? `Le aplica a: ${partes.join(" · ")}.`
            : "Sin nada elegido le aplica a todos los países.";
    }

    function pintar() {
        paisesEl.innerHTML = todosLosPaises.map((p) => `
            <button type="button" class="pill-categoria${paises.includes(p) ? " activa" : ""}" data-alcance-pais="${escaparHtml(p)}">${escaparHtml(p)}</button>
        `).join("");
        tiposEl.innerHTML = TIPOS.map((t) => `
            <button type="button" class="pill-categoria${tipo === t.valor ? " activa" : ""}" data-alcance-tipo="${t.valor}">${t.etiqueta}</button>
        `).join("");
        extrasEl.innerHTML = extras.map((e) => `
            <span class="multi-sucursal-chip">${escaparHtml(e.replace("Lucciano's ", ""))}<button type="button" data-quitar-extra="${escaparHtml(e)}" aria-label="Quitar">×</button></span>
        `).join("");
        estadoEl.textContent = describir();
        hidden.value = serializar();
        hidden.dispatchEvent(new Event("change"));
    }

    document.getElementById(`${inputId}-wrap`).addEventListener("click", (e) => {
        const bp = e.target.closest("[data-alcance-pais]");
        if (bp) {
            const p = bp.dataset.alcancePais;
            paises = paises.includes(p) ? paises.filter((x) => x !== p) : [...paises, p];
            pintar();
            return;
        }
        const bt = e.target.closest("[data-alcance-tipo]");
        if (bt) {
            tipo = bt.dataset.alcanceTipo;
            pintar();
            return;
        }
        const bq = e.target.closest("[data-quitar-extra]");
        if (bq) {
            extras = extras.filter((x) => x !== bq.dataset.quitarExtra);
            pintar();
        }
    });

    pintar();
}
