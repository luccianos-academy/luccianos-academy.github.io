/* ============================
   FARO v4
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

function filaAcciones(local) {
    return local.estado === "Activa"
        ? `<button class="btn btn-secondary" data-desactivar="${local.id}">Desactivar</button>`
        : `<button class="btn btn-primary" data-activar="${local.id}">Activar</button>`;
}

export async function Locales() {

    const locales = await getSucursales();

    const columnas = [
        { key: "nombre", label: "Local" },
        { key: "supervisor", label: "Supervisor" },
        { key: "estadoBadge", label: "Estado" },
        { key: "acciones", label: "" },
    ];

    const filas = locales.map((l) => ({
        ...l,
        supervisor: l.supervisor || "—",
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

        <label for="input-supervisor">Supervisor</label>
        <select id="input-supervisor">
            <option value="">Sin asignar</option>
            ${supervisores.map((s) => `<option value="${s.nombre}">${s.nombre}</option>`).join("")}
        </select>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo local", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const supervisor = document.getElementById("input-supervisor").value;

        if (!nombre) return;

        await crearSucursal({ nombre, supervisor, estado: "Activa" });
        registrarEvento(getUsuarioActual().id, "crear_local", `Alta de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}
