/* ============================
   Lucciano's Academy
   multiSelectUsuarios.js — Multiselect de usuarios para News (Admin only)

   Similar a multiSelectSucursales pero para seleccionar usuarios específicos
   como destinatarios de una News. Cada usuario elegido queda como chip removible.
============================*/

import { getUsuarios, etiquetaColaborador } from "../data/usuarios.js";
import { escaparHtml } from "../services/html.js";

/** Cuántas opciones se listan de una. El resto se alcanza escribiendo:
 *  con la nómina entera (no solo supervisores) una lista sin límite es
 *  inmanejable, pero cortar en silencio hacía parecer que faltaba
 *  gente — por eso abajo se avisa cuántas quedaron afuera. */
const MAX_SUGERENCIAS = 12;

function etiquetaRol(u) {
    if (u.rol === "admin") return "Admin";
    if (u.rol === "supervisor") return u.capacitador ? "Capacitador" : "Supervisor";
    return etiquetaColaborador(u);
}

export function MultiSelectUsuarios(inputId, valoresIniciales = []) {
    return `
        <div class="autocomplete-wrap" id="${inputId}-wrap">
            <input
                id="${inputId}-buscar"
                type="text"
                autocomplete="off"
                placeholder="Escribí nombre o email para buscar usuarios..."
            >
            <div id="${inputId}-list" class="autocomplete-list"></div>
            <div id="${inputId}-chips" class="multi-usuario-chips"></div>
            <input type="hidden" id="${inputId}" value="${valoresIniciales.join(",")}">
        </div>
    `;
}

export async function bindMultiSelectUsuarios(inputId) {
    const wrap = document.getElementById(`${inputId}-wrap`);
    const buscar = document.getElementById(`${inputId}-buscar`);
    const list = document.getElementById(`${inputId}-list`);
    const chips = document.getElementById(`${inputId}-chips`);
    const hidden = document.getElementById(inputId);
    if (!wrap || !buscar || !list || !chips || !hidden) return;

    // ANTES acá se filtraba por rol supervisor/admin, dejando afuera a
    // TODOS los colaboradores — con lo cual "usuarios específicos" no
    // podía dirigirse justamente a la gente para la que existe News.
    // Parecía una restricción de permisos ("no lee toda la nómina"),
    // pero era un filtro de más: puedeVerNoticia() (data/noticias.js)
    // resuelve por id, sin mirar el rol, así que cualquier usuario
    // siempre pudo ser destinatario.
    const usuarios = await getUsuarios();

    // Para ELEGIR se ofrecen solo los activos: mandarle una News a
    // alguien sin acceso no le llega a nadie. Para MOSTRAR los chips ya
    // guardados se usa la lista completa, si no una News vieja dirigida
    // a alguien que después se dio de baja mostraría un id pelado en
    // lugar de su nombre.
    const seleccionables = usuarios.filter((u) => u.activo === "SI");

    let elegidos = hidden.value ? hidden.value.split(",").map((id) => id.trim()).filter(Boolean) : [];

    function renderChips() {
        chips.innerHTML = elegidos.map((id) => {
            const u = usuarios.find((usr) => String(usr.id) === String(id));
            const nombre = u ? `${u.nombre} (${u.email})` : id;
            const baja = u && u.activo !== "SI" ? " — sin acceso" : "";
            return `
                <span class="multi-usuario-chip">${escaparHtml(nombre + baja)}<button type="button" data-quitar-usuario="${escaparHtml(id)}" aria-label="Quitar">×</button></span>
            `;
        }).join("");
        hidden.value = elegidos.join(",");
        hidden.dispatchEvent(new Event("change"));

        chips.querySelectorAll("[data-quitar-usuario]").forEach((btn) => {
            btn.addEventListener("click", () => {
                elegidos = elegidos.filter((id) => id !== btn.dataset.quitarUsuario);
                renderChips();
            });
        });
    }

    function renderLista(valor) {
        const q = valor.toLowerCase().trim();
        const disponibles = seleccionables.filter((u) => !elegidos.includes(String(u.id)));
        const filtradas = q
            ? disponibles.filter((u) =>
                u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
              )
            : disponibles;

        if (!filtradas.length) {
            list.innerHTML = `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;
            list.classList.add("open");
            return;
        }

        // El rol va al lado del nombre: con la nómina entera hay
        // homónimos y hace falta saber a quién se le está mandando.
        const items = filtradas.slice(0, MAX_SUGERENCIAS).map((u) => `
            <div class="autocomplete-item" data-usuario-id="${escaparHtml(u.id)}">
                <strong>${escaparHtml(u.nombre)}</strong> <small class="text-muted">· ${escaparHtml(etiquetaRol(u))}</small><br><small>${escaparHtml(u.email)}</small>
            </div>
        `).join("");

        const restantes = filtradas.length - MAX_SUGERENCIAS;
        const aviso = restantes > 0
            ? `<div class="autocomplete-item" style="opacity:.6;cursor:default">…y ${restantes} más — escribí para filtrar</div>`
            : "";

        list.innerHTML = items + aviso;
        list.classList.add("open");
    }

    buscar.addEventListener("input", () => renderLista(buscar.value));
    buscar.addEventListener("focus", () => renderLista(buscar.value));

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (!item || item.style.opacity === "0.6") return;
        const usuarioId = item.dataset.usuarioId;
        if (usuarioId && !elegidos.includes(usuarioId)) {
            elegidos.push(usuarioId);
            renderChips();
            buscar.value = "";
            list.classList.remove("open");
        }
    });

    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) list.classList.remove("open");
    });

    renderChips();
}
