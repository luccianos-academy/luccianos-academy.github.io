/* ============================
   Lucciano's Academy
   pages/locales.js — Gestión de Locales (Sucursales)

   "Locales" es el término que usa la nueva navegación; internamente
   sigue siendo la hoja/tabla "Sucursales" (data/sucursales.js) — no
   se renombra nada del modelo de datos, solo la etiqueta en pantalla.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { getSucursales, crearSucursal, actualizarSucursal } from "../data/sucursales.js";
import { getUsuarios } from "../data/usuarios.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";

function badgeEstado(local) {
    return local.estado === "Activa"
        ? `<span class="badge badge-success">Activa</span>`
        : `<span class="badge badge-muted">Inactiva</span>`;
}

// Propio vs franquicia — usado por los canales de Comunicaciones
// "Encargados — Locales propios/Franquicias" (ver data/canales.js,
// puedeVerCanal). Por descarte: si no está marcado como propio, es
// franquicia — mismo criterio pedido explícito del usuario.
function badgeTipo(local) {
    return local.esPropio
        ? `<span class="badge badge-success">Propio</span>`
        : `<span class="badge badge-muted">Franquicia</span>`;
}

// Menú "⋮" en vez de 3 botones sólidos por fila (mismo patrón que
// pages/colaboradores.js, duplicado a propósito acá — ver la nota de
// supervisores.js sobre evitar un módulo util compartido fuera de la
// lista de archivos aprobada).
function menuAcciones(items) {
    return `
        <div class="menu-acciones-wrap">
            <button class="btn btn-secondary menu-acciones-toggle" type="button" data-menu-toggle aria-label="Acciones">⋮</button>
            <div class="menu-acciones-dropdown" hidden>${items.join("")}</div>
        </div>
    `;
}

function bindMenuAcciones() {
    if (document._menuAccionesListo) return;
    document._menuAccionesListo = true;

    document.addEventListener("click", (e) => {
        const toggle = e.target.closest("[data-menu-toggle]");
        document.querySelectorAll(".menu-acciones-dropdown").forEach((dropdown) => {
            if (toggle && dropdown === toggle.nextElementSibling) return;
            dropdown.hidden = true;
        });
        if (!toggle) return;

        const dropdown = toggle.nextElementSibling;
        const abrir = dropdown.hidden;
        dropdown.hidden = !abrir;
        if (!abrir) return;

        const r = toggle.getBoundingClientRect();
        const ancho = dropdown.offsetWidth || 190;
        const left = Math.min(r.left, window.innerWidth - ancho - 8);
        dropdown.style.left = `${Math.max(8, left)}px`;
        dropdown.style.top = `${r.bottom + 6}px`;

        const alturaEstimada = dropdown.offsetHeight || 140;
        if (r.bottom + 6 + alturaEstimada > window.innerHeight) {
            dropdown.style.top = `${r.top - alturaEstimada - 6}px`;
        }
    });
}

function filaAcciones(local) {
    const editarBtn = `<button class="menu-acciones-item" data-editar="${local.id}">Editar</button>`;
    const estadoBtn = local.estado === "Activa"
        ? `<button class="menu-acciones-item" data-desactivar="${local.id}">Desactivar</button>`
        : `<button class="menu-acciones-item" data-activar="${local.id}">Activar</button>`;
    const tipoBtn = local.esPropio
        ? `<button class="menu-acciones-item" data-marcar-franquicia="${local.id}">Marcar franquicia</button>`
        : `<button class="menu-acciones-item" data-marcar-propio="${local.id}">Marcar propio</button>`;
    return menuAcciones([editarBtn, estadoBtn, tipoBtn]);
}

export async function Locales() {

    const locales = await getSucursales();

    const columnas = [
        { key: "nombre", label: "Local" },
        { key: "supervisor", label: "Supervisor" },
        { key: "tipoBadge", label: "Tipo" },
        { key: "estadoBadge", label: "Estado" },
        { key: "acciones", label: "" },
    ];

    const filas = locales.map((l) => ({
        ...l,
        supervisor: l.supervisor || "—",
        tipoBadge: badgeTipo(l),
        estadoBadge: badgeEstado(l),
        acciones: filaAcciones(l),
    }));

    return `
        ${Header("Locales", "Sucursales de Lucciano's")}

        <div class="table-toolbar">
            <input type="search" id="buscador-locales" placeholder="Buscar local...">
            <button class="btn btn-primary" id="btn-nuevo-local">+ Nuevo local</button>
        </div>

        <div id="tabla-locales">
            ${Table(columnas, filas)}
        </div>
    `;
}

export function bindLocales() {

    bindMenuAcciones();

    const buscador = document.getElementById("buscador-locales");
    if (buscador) {
        buscador.addEventListener("input", () => {
            const filtro = buscador.value.trim().toLowerCase();
            document.querySelectorAll("#tabla-locales tbody tr").forEach((fila) => {
                const nombre = fila.firstElementChild?.textContent.toLowerCase() || "";
                fila.style.display = nombre.includes(filtro) ? "" : "none";
            });
        });
    }

    document.querySelectorAll("[data-desactivar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.desactivar, { estado: "Inactiva" });
            registrarEvento(getUsuarioActual().id, "desactivar_local", `Local desactivado (id ${btn.dataset.desactivar})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-activar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.activar, { estado: "Activa" });
            registrarEvento(getUsuarioActual().id, "activar_local", `Local activado (id ${btn.dataset.activar})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-marcar-propio]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.marcarPropio, { esPropio: "SI" });
            registrarEvento(getUsuarioActual().id, "editar_local", `Local marcado como propio (id ${btn.dataset.marcarPropio})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-marcar-franquicia]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.marcarFranquicia, { esPropio: "NO" });
            registrarEvento(getUsuarioActual().id, "editar_local", `Local marcado como franquicia (id ${btn.dataset.marcarFranquicia})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-editar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const locales = await getSucursales();
            const local = locales.find((l) => String(l.id) === String(btn.dataset.editar));
            if (local) abrirModalEditarLocal(local);
        });
    });

    const btnNuevo = document.getElementById("btn-nuevo-local");
    if (btnNuevo) btnNuevo.addEventListener("click", abrirModalNuevoLocal);
}

async function abrirModalNuevoLocal() {

    const usuarios = await getUsuarios();
    const supervisores = usuarios.filter((u) => u.rol === "supervisor");

    const modalId = "modal-nuevo-local";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del local</label>
        <input type="text" id="input-nombre" placeholder="Lucciano's ...">
        <p class="text-xs text-muted" style="margin-top:4px">Debe empezar con "Lucciano's"</p>

        <label for="input-supervisor">Supervisor</label>
        <select id="input-supervisor">
            <option value="">Sin asignar</option>
            ${supervisores.map((s) => `<option value="${s.nombre}">${s.nombre}</option>`).join("")}
        </select>

        <label style="margin-top:16px;display:block;margin-bottom:8px">Tipo de local</label>
        <div style="display:flex;gap:16px;margin-bottom:16px">
            <label style="display:flex;align-items:center;gap:8px">
                <input type="radio" name="tipo-local" value="propio" id="input-propio">
                <span>Propio</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px">
                <input type="radio" name="tipo-local" value="franquicia" id="input-franquicia" checked>
                <span>Franquicia</span>
            </label>
        </div>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo local", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const supervisor = document.getElementById("input-supervisor").value;
        const esPropio = document.getElementById("input-propio").checked;

        if (!nombre) {
            alert("El nombre es requerido.");
            return;
        }
        if (!nombre.startsWith("Lucciano")) {
            alert("El nombre debe empezar con \"Lucciano's\"");
            return;
        }

        await crearSucursal({ nombre, supervisor, estado: "Activa", esPropio });
        registrarEvento(getUsuarioActual().id, "crear_local", `Alta de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}

async function abrirModalEditarLocal(local) {

    const usuarios = await getUsuarios();
    const supervisores = usuarios.filter((u) => u.rol === "supervisor");

    const modalId = "modal-editar-local";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del local</label>
        <input type="text" id="input-nombre" placeholder="Lucciano's ..." value="${local.nombre || ""}">
        <p class="text-xs text-muted" style="margin-top:4px">Debe empezar con "Lucciano's"</p>

        <label for="input-supervisor">Supervisor</label>
        <select id="input-supervisor">
            <option value="">Sin asignar</option>
            ${supervisores.map((s) => `<option value="${s.nombre}" ${local.supervisor === s.nombre ? "selected" : ""}>${s.nombre}</option>`).join("")}
        </select>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Editar local: " + local.nombre, contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const supervisor = document.getElementById("input-supervisor").value;

        if (!nombre) {
            alert("El nombre es requerido.");
            return;
        }
        if (!nombre.startsWith("Lucciano")) {
            alert("El nombre debe empezar con \"Lucciano's\"");
            return;
        }

        await actualizarSucursal(local.id, { nombre, supervisor });
        registrarEvento(getUsuarioActual().id, "editar_local", `Edición de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}
