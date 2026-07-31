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

// Propio vs franquicia — usado por los canales de Comunicaciones
// "Encargados — Locales propios/Franquicias" (ver data/canales.js,
// puedeVerCanal). Por descarte: si no está marcado como propio, es
// franquicia — mismo criterio pedido explícito del usuario.
function badgeTipo(local) {
    return local.esPropio
        ? `<span class="badge badge-success">Propio</span>`
        : `<span class="badge badge-muted">Franquicia</span>`;
}

function filaAcciones(local) {
    const estadoBtn = local.estado === "Activa"
        ? `<button class="btn btn-secondary" data-desactivar="${local.id}">Desactivar</button>`
        : `<button class="btn btn-primary" data-activar="${local.id}">Activar</button>`;
    const tipoBtn = local.esPropio
        ? `<button class="btn btn-secondary" data-marcar-franquicia="${local.id}">Marcar franquicia</button>`
        : `<button class="btn btn-secondary" data-marcar-propio="${local.id}">Marcar propio</button>`;
    return `<span style="display:flex;gap:8px;flex-wrap:wrap">${estadoBtn}${tipoBtn}</span>`;
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

        <label class="toggle-switch" style="margin-top:16px">
            Local propio (no franquicia)
            <input type="checkbox" id="input-es-propio">
        </label>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo local", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const supervisor = document.getElementById("input-supervisor").value;
        const esPropio = document.getElementById("input-es-propio").checked;

        if (!nombre) return;

        await crearSucursal({ nombre, supervisor, estado: "Activa", esPropio });
        registrarEvento(getUsuarioActual().id, "crear_local", `Alta de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}
