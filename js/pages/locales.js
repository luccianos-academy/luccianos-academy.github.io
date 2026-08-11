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
import { escaparHtml } from "../services/html.js";
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
        { key: "seleccion", label: "" },
        { key: "nombre", label: "Local" },
        { key: "supervisor", label: "Supervisor" },
        { key: "tipoBadge", label: "Tipo" },
        { key: "estadoBadge", label: "Estado" },
        { key: "acciones", label: "" },
    ];

    const armarFila = (l) => ({
        ...l,
        seleccion: `<input type="checkbox" class="local-check" style="width:auto" data-local-id="${l.id}" data-local-nombre="${escaparHtml(l.nombre)}">`,
        supervisor: l.supervisor || "—",
        tipoBadge: badgeTipo(l),
        estadoBadge: badgeEstado(l),
        acciones: filaAcciones(l),
    });

    // Propios y franquicias se operan distinto, así que la pregunta más
    // frecuente frente a esta pantalla es "¿cuáles son los propios?".
    // Mezclados en una sola tabla había que leer la columna Tipo fila
    // por fila; agrupados se responde de un vistazo. Mismo patrón de
    // secciones que ya usa "Mi equipo" al agrupar por sucursal.
    const propios = locales.filter((l) => l.esPropio);
    const franquicias = locales.filter((l) => !l.esPropio);

    const seccion = (titulo, lista, ayuda) => `
        <div class="section" data-tipo-seccion="${titulo}">
            <h3>${titulo} <span class="text-sm text-muted">(${lista.length})</span></h3>
            ${lista.length
                ? Table(columnas, lista.map(armarFila))
                : `<p class="text-sm text-muted">${ayuda}</p>`}
        </div>
    `;

    return `
        ${Header("Locales", "Sucursales de Lucciano's")}

        <div class="table-toolbar">
            <input type="search" id="buscador-locales" placeholder="Buscar local...">
            <button class="btn btn-primary" id="btn-nuevo-local">+ Nuevo local</button>
        </div>

        <div class="barra-enviar-mail">
            <label class="text-sm"><input type="checkbox" id="chk-locales-todos" style="width:auto">Seleccionar todos los visibles</label>
            <button class="btn btn-secondary" id="btn-lote-propio">Marcar como propios</button>
            <button class="btn btn-secondary" id="btn-lote-franquicia">Marcar como franquicias</button>
        </div>

        <div id="tabla-locales">
            ${seccion("Locales propios", propios, "Ninguno marcado como propio todavía — usá el menú ⋮ de cada local para marcarlo.")}
            ${seccion("Franquicias", franquicias, "Todos los locales están marcados como propios.")}
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
            // Ahora que hay dos secciones, una búsqueda que no matchea
            // nada de un grupo dejaba su título colgado sobre una tabla
            // vacía, como si el local buscado no existiera en ningún
            // lado. Se esconde la sección entera.
            document.querySelectorAll("#tabla-locales .section").forEach((seccion) => {
                const visibles = [...seccion.querySelectorAll("tbody tr")]
                    .some((f) => f.style.display !== "none");
                seccion.style.display = visibles ? "" : "none";
            });
        });
    }

    // ---- Marcar propio / franquicia en bloque ----
    //
    // Marcarlos de a uno con el menú ⋮ era el trabajo que el usuario
    // terminó haciendo a mano ("si hay 10 propias las elijo todas juntas
    // y las marco de una vez, no una por una"). Se combina con el
    // buscador: filtrás, tildás todos los visibles, y aplicás.

    function checksVisibles() {
        return [...document.querySelectorAll("#tabla-locales .local-check")].filter((chk) => {
            const fila = chk.closest("tr");
            if (fila && fila.style.display === "none") return false;
            // El buscador también esconde la SECCIÓN entera cuando ningún
            // local suyo matchea. Sin mirar eso, las filas de una sección
            // oculta seguían contando como visibles y "seleccionar todos"
            // agarraba locales que no se estaban viendo.
            const seccion = chk.closest(".section");
            return !seccion || seccion.style.display !== "none";
        });
    }

    document.getElementById("chk-locales-todos")?.addEventListener("change", (e) => {
        checksVisibles().forEach((chk) => { chk.checked = e.target.checked; });
    });

    async function marcarEnLote(esPropio, boton) {
        const marcados = checksVisibles().filter((chk) => chk.checked);
        if (!marcados.length) {
            alert("Primero tildá los locales que querés marcar.");
            return;
        }

        const etiqueta = esPropio ? "Marcar como PROPIOS" : "Marcar como FRANQUICIAS";
        const nombres = marcados.map((chk) => chk.dataset.localNombre);
        const muestra = nombres.slice(0, 10).join("\n· ");
        const resto = nombres.length > 10 ? `\n…y ${nombres.length - 10} más` : "";
        if (!confirm(`${etiqueta} a ${nombres.length} local(es):\n\n· ${muestra}${resto}\n\n¿Confirmás?`)) return;

        const textoOriginal = boton.textContent;
        boton.disabled = true;

        // Secuencial y con progreso, mismo criterio que el lote de
        // accesos en Mi equipo: cada guardado es una llamada a Apps
        // Script, y un Promise.all abortaría todo al primer fallo sin
        // dejar saber cuáles quedaron hechos.
        const fallaron = [];
        for (let i = 0; i < marcados.length; i++) {
            boton.textContent = `Procesando ${i + 1}/${marcados.length}...`;
            try {
                const r = await actualizarSucursal(marcados[i].dataset.localId, { esPropio: esPropio ? "SI" : "NO" });
                if (r && r.ok === false) fallaron.push(nombres[i]);
            } catch (err) {
                fallaron.push(nombres[i]);
            }
        }

        boton.textContent = textoOriginal;
        boton.disabled = false;

        const hechos = marcados.length - fallaron.length;
        registrarEvento(getUsuarioActual().id, "editar_local", `${etiqueta} en bloque: ${hechos} de ${marcados.length}`);

        if (fallaron.length) {
            alert(`Se aplicó a ${hechos} de ${marcados.length}.\n\nNo se pudo con:\n· ${fallaron.join("\n· ")}`);
        }
        navigate("locales");
    }

    document.getElementById("btn-lote-propio")?.addEventListener("click", (e) => marcarEnLote(true, e.currentTarget));
    document.getElementById("btn-lote-franquicia")?.addEventListener("click", (e) => marcarEnLote(false, e.currentTarget));

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
