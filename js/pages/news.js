/* ============================
   FARO v4
   pages/news.js — Centro de avisos (campana)

   Reemplaza a la vieja "Noticias" (lista plana, sin destinatarios ni
   estado de lectura): ahora es la bandeja única a la que apunta la
   campana (components/topbar.js) — noticias, cursos nuevos, manuales,
   evaluaciones, recordatorios y avisos de cuenta, todo en un mismo
   lugar, con leído/no leído por persona (ver data/noticias.js).

   Mantiene el mismo criterio dual que Manuales/la vieja Noticias:
   Colaborador/Supervisor ven y marcan como leído; Admin suma el panel
   de gestión (crear/editar/eliminar) sobre la misma pantalla, sin
   ruta de administración aparte. Se registra bajo la ruta "news"
   (router.js).
=============================*/

import { Header } from "../components/header.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { renderProcedimiento } from "../components/procedimiento.js";
import { Icon } from "../components/icons.js";
import {
    getNoticias, getNoticiasVisibles, crearNoticia, actualizarNoticia, eliminarNoticia,
    marcarNotificacionLeida, estaLeida, puedeVerNoticia, TIPOS_NOTIFICACION, PRIORIDADES,
} from "../data/noticias.js";
import { getCursos } from "../data/cursos.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { actualizarContadorCampana } from "../components/topbar.js";

// "capacitador" no es un rol real (ver data/usuarios.js), mismo
// criterio que ya usa Manuales para poder dirigir contenido solo a
// capacitadores sin que lo vea cualquier Supervisor.
const ROLES_COMPARTIR = [
    { id: "colaborador", label: "Colaborador" },
    { id: "supervisor",  label: "Supervisor" },
    { id: "capacitador", label: "Capacitador" },
    { id: "admin",       label: "Admin" },
];

function tipoInfo(tipoId) {
    return TIPOS_NOTIFICACION.find((t) => t.id === tipoId) || TIPOS_NOTIFICACION[0];
}

function prioridadInfo(prioridadId) {
    return PRIORIDADES.find((p) => p.id === prioridadId) || PRIORIDADES[2];
}

// "YYYY-MM-DD" es una fecha sin hora — leerla con new Date(str) y
// toLocaleDateString() la corre un día en zonas detrás de UTC (ej.
// Argentina). Armar la fecha en hora local evita ese desfasaje.
function fechaLocal(fecha) {
    const [y, m, d] = String(fecha).split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
}

function formatearFecha(fecha) {
    const d = fechaLocal(fecha);
    return d ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : fecha;
}

function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoy" / "Ayer" / la fecha larga — mismo criterio de agrupado del mockup. */
function etiquetaGrupo(fecha) {
    const d = fechaLocal(fecha);
    if (!d) return fecha;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diffDias = Math.round((hoy - d) / 86400000);
    if (diffDias === 0) return "Hoy";
    if (diffDias === 1) return "Ayer";
    return formatearFecha(fecha);
}

function camposNotificacionHtml(n = {}, cursos = []) {
    const opcionesCursos = cursos.map((c) => `<option value="${c.id}"${String(n.enlace) === String(c.id) ? " selected" : ""}>${c.nombre}</option>`).join("");
    const opcionesTipo = TIPOS_NOTIFICACION.map((t) => `<option value="${t.id}"${(n.tipo || "noticia") === t.id ? " selected" : ""}>${t.nombre}</option>`).join("");
    const opcionesPrioridad = PRIORIDADES.map((p) => `<option value="${p.id}"${(n.prioridad || "info") === p.id ? " selected" : ""}>${p.nombre}</option>`).join("");
    const rolesActuales = n.visiblePara ? n.visiblePara.split(",").map((r) => r.trim()) : [];
    const checkboxesHtml = ROLES_COMPARTIR.map((r) => `
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:0">
            <input type="checkbox" class="input-compartir-rol" value="${r.id}" style="width:auto;flex-shrink:0" ${rolesActuales.includes(r.id) ? "checked" : ""}>
            ${r.label}
        </label>
    `).join("");

    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Ej: Nuevo curso disponible" value="${n.titulo || ""}">

        <label for="input-mensaje">Mensaje</label>
        <textarea id="input-mensaje" rows="3" placeholder="Un par de líneas, con qué encontrar y dónde revisarlo...">${n.resumen || ""}</textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
                <label for="input-tipo">Tipo / Categoría</label>
                <select id="input-tipo">${opcionesTipo}</select>
            </div>
            <div>
                <label for="input-prioridad">Prioridad</label>
                <select id="input-prioridad">${opcionesPrioridad}</select>
            </div>
        </div>

        <label for="input-fecha">Fecha</label>
        <input type="date" id="input-fecha" value="${n.fecha || fechaHoyISO()}">

        <label>Público</label>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">${checkboxesHtml}</div>
        <p class="text-xs text-muted" style="margin-top:4px">Sin marcar nada = todos los usuarios. Colaborador = toda la red. O elegí locales específicos abajo.</p>

        <label for="input-sucursal-notif">Locales específicos (opcional)</label>
        ${MultiSelectSucursales("input-sucursal-notif", n.sucursal ? n.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}

        <label for="input-detalle">Detalle (opcional)</label>
        <textarea id="input-detalle" rows="4" placeholder="Solo si hay información extensa para desplegar. Si se deja vacío, no se muestra nada extra.">${n.detalle || ""}</textarea>

        <label for="input-enlace">Curso relacionado (opcional)</label>
        <select id="input-enlace">
            <option value="">Ninguno</option>
            ${opcionesCursos}
        </select>

        <label for="input-adjunto-url">Adjunto — ruta o link (opcional)</label>
        <input type="text" id="input-adjunto-url" placeholder="Ej: assets/docs/certificado-kosher.pdf" value="${n.adjuntoUrl || ""}">

        <label for="input-adjunto-label">Texto del botón del adjunto</label>
        <input type="text" id="input-adjunto-label" placeholder="Ej: Ver certificado" value="${n.adjuntoLabel || ""}">
    `;
}

function leerCamposNotificacion() {
    const rolesElegidos = Array.from(document.querySelectorAll(".input-compartir-rol:checked")).map((c) => c.value);
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        resumen: document.getElementById("input-mensaje").value.trim(),
        tipo: document.getElementById("input-tipo").value,
        prioridad: document.getElementById("input-prioridad").value,
        fecha: document.getElementById("input-fecha").value,
        visiblePara: rolesElegidos.join(","),
        sucursal: document.getElementById("input-sucursal-notif").value.trim(),
        detalle: document.getElementById("input-detalle").value.trim(),
        enlace: document.getElementById("input-enlace").value,
        adjuntoUrl: document.getElementById("input-adjunto-url").value.trim(),
        adjuntoLabel: document.getElementById("input-adjunto-label").value.trim(),
    };
}

function filaNotificacion(n, usuario, leida) {
    const info = tipoInfo(n.tipo);
    const prio = prioridadInfo(n.prioridad);
    return `
        <button class="notif-item${leida ? "" : " no-leida"}" data-ver-notif="${n.id}">
            <span class="notif-item-icono" style="background:${prio.color}22;color:${prio.color}">${Icon(info.icono, { size: 18 })}</span>
            <span class="notif-item-body">
                <span class="notif-item-titulo">${n.titulo}${!leida ? '<i class="notif-dot"></i>' : ""}</span>
                <span class="notif-item-resumen">${n.resumen}</span>
            </span>
            <span class="notif-item-fecha">${etiquetaGrupo(n.fecha) === "Hoy" || etiquetaGrupo(n.fecha) === "Ayer" ? etiquetaGrupo(n.fecha) : formatearFecha(n.fecha).split(" de ")[0] + " " + formatearFecha(n.fecha).split(" de ")[1].slice(0, 3)}</span>
        </button>
    `;
}

export async function News() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    const [items, cursos] = await Promise.all([getNoticiasVisibles(usuario), getCursos()]);

    const noLeidas = items.filter((n) => !estaLeida(n, usuario.id));

    // Agrupado "Hoy / Ayer / fecha larga" preservando el orden ya
    // ordenado (más reciente primero) que devuelve getNoticias().
    function agrupar(lista) {
        const grupos = [];
        let grupoActual = null;
        lista.forEach((n) => {
            const etiqueta = etiquetaGrupo(n.fecha);
            if (!grupoActual || grupoActual.etiqueta !== etiqueta) {
                grupoActual = { etiqueta, items: [] };
                grupos.push(grupoActual);
            }
            grupoActual.items.push(n);
        });
        return grupos;
    }

    const gruposTodas = agrupar(items);
    const gruposNoLeidas = agrupar(noLeidas);

    const listaHtml = (grupos) => grupos.length
        ? grupos.map((g) => `
            <div class="notif-grupo">
                <h4>${g.etiqueta}</h4>
                <div class="notif-lista">${g.items.map((n) => filaNotificacion(n, usuario, estaLeida(n, usuario.id))).join("")}</div>
            </div>
        `).join("")
        : `<p class="text-sm text-muted" style="padding:24px 4px">No hay notificaciones acá.</p>`;

    return `
        ${Header("News", "Novedades, recordatorios y avisos de tu cuenta")}

        <div class="table-toolbar">
            <div class="notif-tabs">
                <button class="notif-tab active" data-tab="todas">Todas</button>
                <button class="notif-tab" data-tab="no-leidas">No leídas${noLeidas.length ? ` (${noLeidas.length})` : ""}</button>
            </div>
            <span style="display:flex;gap:10px;flex-wrap:wrap">
                ${noLeidas.length ? `<button class="btn btn-secondary" id="btn-marcar-todas">Marcar todas como leídas</button>` : ""}
                ${esAdmin ? `<button class="btn btn-primary" id="btn-nueva-notif">+ Nueva notificación</button>` : ""}
            </span>
        </div>

        <div class="section" data-panel="todas">${listaHtml(gruposTodas)}</div>
        <div class="section" data-panel="no-leidas" hidden>${listaHtml(gruposNoLeidas)}</div>
    `;
}

export function bindNews() {

    const usuario = getUsuarioActual();

    // Tabs Todas / No leídas — mismo patrón simple que otros toggles
    // de la app (mostrar/ocultar paneles ya renderizados, sin re-pedir
    // datos al servidor).
    document.querySelectorAll(".notif-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".notif-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll("[data-panel]").forEach((p) => {
                p.hidden = p.dataset.panel !== tab.dataset.tab;
            });
        });
    });

    document.querySelectorAll("[data-ver-notif]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const items = await getNoticias();
            const noti = items.find((n) => String(n.id) === String(btn.dataset.verNotif));
            if (noti) abrirDetalleNotificacion(noti, usuario);
        });
    });

    const btnMarcarTodas = document.getElementById("btn-marcar-todas");
    if (btnMarcarTodas) {
        btnMarcarTodas.addEventListener("click", async () => {
            const items = await getNoticiasVisibles(usuario);
            await Promise.all(items.filter((n) => !estaLeida(n, usuario.id)).map((n) => marcarNotificacionLeida(n, usuario.id)));
            actualizarContadorCampana();
            navigate("news");
        });
    }

    if (usuario.rol !== "admin") return;

    const btnNueva = document.getElementById("btn-nueva-notif");
    if (btnNueva) btnNueva.addEventListener("click", () => abrirModalNotificacion());

    document.querySelectorAll("[data-editar-notif]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const items = await getNoticias();
            const noti = items.find((n) => String(n.id) === String(btn.dataset.editarNotif));
            if (noti) abrirModalNotificacion(noti);
        });
    });

    document.querySelectorAll("[data-eliminar-notif]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("¿Eliminar esta notificación?")) return;
            await eliminarNoticia(btn.dataset.eliminarNotif);
            registrarEvento(usuario.id, "eliminar_noticia", `Notificación ${btn.dataset.eliminarNotif} eliminada`);
            actualizarContadorCampana();
            navigate("news");
        });
    });
}

/** Vista de detalle — mismo modal que "editar", en modo lectura, con
 *  las acciones del mockup (Ir al curso, Ver adjunto, Marcar leída). */
function abrirDetalleNotificacion(noti, usuario) {
    const modalId = "modal-detalle-notif";
    const esAdmin = usuario.rol === "admin";
    const leida = estaLeida(noti, usuario.id);
    const info = tipoInfo(noti.tipo);

    const contenidoHtml = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span class="notif-item-icono" style="background:${prioridadInfo(noti.prioridad).color}22;color:${prioridadInfo(noti.prioridad).color}">${Icon(info.icono, { size: 18 })}</span>
            <div>
                <div class="text-xs text-muted">${info.nombre} · ${formatearFecha(noti.fecha)}</div>
            </div>
        </div>
        <p class="text-sm" style="margin-top:8px">${noti.resumen}</p>
        ${noti.detalle ? `<div style="margin-top:12px">${renderProcedimiento(noti.detalle)}</div>` : ""}
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            ${noti.enlace ? `<a class="btn btn-primary" href="#/cursos/${noti.enlace}">Ir al curso</a>` : ""}
            ${noti.adjuntoUrl ? `<a class="btn btn-secondary" href="${noti.adjuntoUrl}">${noti.adjuntoLabel || "Ver adjunto"}</a>` : ""}
            ${esAdmin ? `
                <button class="btn btn-secondary" data-editar-notif="${noti.id}">Editar</button>
                <button class="btn btn-secondary" data-eliminar-notif="${noti.id}">Eliminar</button>
            ` : ""}
        </div>
    `;

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2>${noti.titulo}</h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body">${contenidoHtml}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close="${modalId}">Cerrar</button>
                    ${leida ? "" : `<button class="btn btn-primary" data-confirm="${modalId}">Marcar como leída</button>`}
                </div>
            </div>
        </div>
    `, modalId, leida ? null : async () => {
        await marcarNotificacionLeida(noti, usuario.id);
        actualizarContadorCampana();
        cerrarModal(modalId);
        navigate("news");
    });

    // Los botones Editar/Eliminar del detalle reusan el mismo binding
    // que la lista — se conectan acá porque este modal se abre fuera
    // del ciclo de render de la página.
    if (usuario.rol === "admin") {
        document.querySelector(`#${modalId} [data-editar-notif]`)?.addEventListener("click", () => {
            cerrarModal(modalId);
            abrirModalNotificacion(noti);
        });
        document.querySelector(`#${modalId} [data-eliminar-notif]`)?.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta notificación?")) return;
            await eliminarNoticia(noti.id);
            registrarEvento(usuario.id, "eliminar_noticia", `Notificación ${noti.id} eliminada`);
            cerrarModal(modalId);
            actualizarContadorCampana();
            navigate("news");
        });
    }
}

async function abrirModalNotificacion(noti = null) {

    const modalId = "modal-notif";
    const cursos = await getCursos();
    const contenidoHtml = camposNotificacionHtml(noti || {}, cursos);

    abrirModal(Modal({ id: modalId, titulo: noti ? `Editar: ${noti.titulo}` : "Nueva notificación", contenidoHtml, textoConfirmar: noti ? "Guardar" : "Enviar notificación" }), modalId, async () => {

        const cambios = leerCamposNotificacion();
        if (!cambios.titulo || !cambios.fecha) return;

        const usuario = getUsuarioActual();
        if (noti) {
            await actualizarNoticia(noti.id, cambios);
            registrarEvento(usuario.id, "editar_noticia", `Notificación "${cambios.titulo}" editada`);
        } else {
            await crearNoticia(cambios);
            registrarEvento(usuario.id, "crear_noticia", `Notificación creada: ${cambios.titulo}`);
        }

        cerrarModal(modalId);
        actualizarContadorCampana();
        navigate("news");
    });

    bindMultiSelectSucursales("input-sucursal-notif");
}
