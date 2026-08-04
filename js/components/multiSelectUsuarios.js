/* ============================
   FARO v4
   multiSelectUsuarios.js — Multiselect de usuarios para News (Admin only)

   Similar a multiSelectSucursales pero para seleccionar usuarios específicos
   como destinatarios de una News. Cada usuario elegido queda como chip removible.
============================*/

import { getUsuarios } from "../data/usuarios.js";

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

    const usuarios = await getUsuarios();
    const usuariosPorRol = usuarios.filter((u) => u.rol === "supervisor" || u.rol === "admin");

    let elegidos = hidden.value ? hidden.value.split(",").map((id) => id.trim()).filter(Boolean) : [];

    function renderChips() {
        chips.innerHTML = elegidos.map((id) => {
            const u = usuariosPorRol.find((usr) => String(usr.id) === String(id));
            const nombre = u ? `${u.nombre} (${u.email})` : id;
            return `
                <span class="multi-usuario-chip">${nombre}<button type="button" data-quitar-usuario="${id}" aria-label="Quitar">×</button></span>
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
        const disponibles = usuariosPorRol.filter((u) => !elegidos.includes(String(u.id)));
        const filtradas = q
            ? disponibles.filter((u) =>
                u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
              )
            : disponibles;

        list.innerHTML = filtradas.length
            ? filtradas.slice(0, 8).map((u) => `
                <div class="autocomplete-item" data-usuario-id="${u.id}">
                    <strong>${u.nombre}</strong><br><small>${u.email}</small>
                </div>
            `).join("")
            : `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;
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
