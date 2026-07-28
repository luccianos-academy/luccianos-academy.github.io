/* ============================
   FARO v4
   pages/comunicaciones.js — Comunicaciones (Admin ↔ Supervisores)

   Espacio de conversación por canales — distinto del centro de
   notificaciones (pages/notificaciones.js, la campana): acá hay
   comentarios, likes y reciprocidad, no solo avisos de arriba hacia
   abajo. Colaborador no lo ve (ver services/auth.js). Capacitador
   participa como cualquier Supervisor: puede publicar y comentar acá
   — la regla de "solo lectura" de Capacitador es específica de la
   gestión de equipos (Colaboradores), no de esta conversación.

   Dos vistas en un mismo archivo, sin ruta aparte: lista de canales
   (#/comunicaciones) y feed de un canal (#/comunicaciones/:canal) —
   mismo patrón que cursos.js con el id de curso.
=============================*/

import { Header } from "../components/header.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { Icon } from "../components/icons.js";
import { EmptyState } from "../components/emptyState.js";
import {
    CANALES, canalInfo, getPublicaciones, getPublicacionesDeCanal, crearPublicacion,
    eliminarPublicacion, toggleLikePublicacion, marcarPublicacionLeida,
    estaLikeada, estaLeidaPublicacion,
} from "../data/publicaciones.js";
import {
    getComentariosDePublicacion, crearComentario, toggleLikeComentario, estaLikeadoComentario,
} from "../data/comentarios.js";
import { getUsuarios } from "../data/usuarios.js";
import { getUsuarioActual } from "../services/auth.js";
import { registrarEvento } from "../data/auditoria.js";
import { navigate } from "../router.js";

function formatearFechaHora(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const hoy = new Date();
    const esHoy = d.toDateString() === hoy.toDateString();
    const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return esHoy ? `Hoy a las ${hora}` : `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} · ${hora}`;
}

function iniciales(nombre) {
    return String(nombre || "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export async function Comunicaciones(params = []) {
    const [canalId] = params;
    return canalId ? vistaCanal(canalId) : vistaListaCanales();
}

async function vistaListaCanales() {
    const publicaciones = await getPublicaciones();

    const filasHtml = CANALES.map((c) => {
        const delCanal = publicaciones.filter((p) => p.canal === c.id);
        const ultima = delCanal[0];
        return `
            <a class="canal-item" href="#/comunicaciones/${c.id}">
                <span class="canal-item-icono">${Icon(c.icono, { size: 20 })}</span>
                <span class="canal-item-body">
                    <span class="canal-item-nombre">${c.nombre}</span>
                    <span class="canal-item-detalle">${delCanal.length ? `${delCanal.length} publicación(es) · última ${formatearFechaHora(ultima.fecha)}` : "Sin publicaciones todavía"}</span>
                </span>
            </a>
        `;
    }).join("");

    return `
        ${Header("Comunicaciones", "Canales para Admin y Supervisores")}
        <div class="section canal-lista">${filasHtml}</div>
    `;
}

async function vistaCanal(canalId) {
    const info = canalInfo(canalId);
    const usuario = getUsuarioActual();
    const publicaciones = await getPublicacionesDeCanal(canalId);

    const itemsHtml = publicaciones.length
        ? publicaciones.map((p) => filaPublicacion(p, usuario)).join("")
        : EmptyState({ titulo: "Todavía no hay publicaciones", detalle: "Sé el primero en escribir algo en este canal.", icono: info.icono });

    return `
        <div class="canal-header-nav">
            <a href="#/comunicaciones" class="btn btn-secondary" style="width:auto">← Canales</a>
        </div>
        ${Header(info.nombre, `${publicaciones.length} publicación(es)`)}

        <div class="table-toolbar">
            <div></div>
            <button class="btn btn-primary" id="btn-nueva-publicacion" data-canal="${canalId}">+ Nueva publicación</button>
        </div>

        <div class="section" style="display:flex;flex-direction:column;gap:14px" id="lista-publicaciones">${itemsHtml}</div>
    `;
}

function filaPublicacion(p, usuario) {
    const likeada = estaLikeada(p, usuario.id);
    return `
        <div class="card publicacion-card">
            ${p.destacado ? `<span class="publicacion-destacado">${Icon("trofeo", { size: 13 })} Destacado</span>` : ""}
            <div class="publicacion-autor">
                <span class="publicacion-avatar">${iniciales(p.autorNombre)}</span>
                <div>
                    <strong>${p.autorNombre}</strong>
                    <div class="text-xs text-muted">${p.autorRol === "admin" ? "Administración" : "Supervisor"} · ${formatearFechaHora(p.fecha)}</div>
                </div>
            </div>
            <h3 style="margin-top:10px">${p.titulo}</h3>
            <p class="text-sm" style="margin-top:6px;color:var(--text)">${p.mensaje}</p>
            ${p.adjuntoLabel ? `
                <div class="publicacion-adjunto">
                    ${Icon("reportes", { size: 16 })}
                    <span>${p.adjuntoLabel}</span>
                </div>
            ` : ""}
            <div class="publicacion-acciones">
                <button class="publicacion-accion${likeada ? " activa" : ""}" data-like-publicacion="${p.id}">${Icon("corazon", { size: 15 })} <span data-like-count>${estaLikeCount(p)}</span></button>
                <button class="publicacion-accion" data-ver-publicacion="${p.id}">${Icon("comentario", { size: 15 })} Ver / comentar</button>
            </div>
        </div>
    `;
}

function estaLikeCount(p) {
    return String(p.likesDe || "").split(",").map((s) => s.trim()).filter(Boolean).length;
}

export function bindComunicaciones(params = []) {
    const usuario = getUsuarioActual();

    document.getElementById("btn-nueva-publicacion")?.addEventListener("click", (e) => {
        abrirModalNuevaPublicacion(e.target.dataset.canal);
    });

    document.querySelectorAll("[data-like-publicacion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const publicaciones = await getPublicaciones();
            const p = publicaciones.find((x) => String(x.id) === String(btn.dataset.likePublicacion));
            if (!p) return;
            await toggleLikePublicacion(p, usuario.id);
            navigate(`comunicaciones/${p.canal}`);
        });
    });

    document.querySelectorAll("[data-ver-publicacion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const publicaciones = await getPublicaciones();
            const p = publicaciones.find((x) => String(x.id) === String(btn.dataset.verPublicacion));
            if (p) abrirDetallePublicacion(p);
        });
    });
}

async function abrirDetallePublicacion(p) {
    const usuario = getUsuarioActual();
    const modalId = "modal-publicacion";

    if (p.requiereConfirmacion && !estaLeidaPublicacion(p, usuario.id)) {
        await marcarPublicacionLeida(p, usuario.id);
        // marcarPublicacionLeida escribe sobre la fila real (mock o
        // Sheet), pero "p" acá es una copia normalizada (getPublicaciones
        // mapea cada fila a un objeto nuevo) — sin este parche local, el
        // "Leído por" de la primera apertura del modal se ve desactualizado
        // hasta la próxima vez que se vuelva a pedir la lista.
        const actuales = String(p.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);
        actuales.push(String(usuario.id));
        p.leidoPor = actuales.join(",");
    }

    async function contenidoActual() {
        const comentarios = await getComentariosDePublicacion(p.id);
        const usuarios = await getUsuarios();
        const supervisoresYAdmin = usuarios.filter((u) => u.rol === "admin" || u.rol === "supervisor");
        const leidoIds = String(p.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);

        return `
            <div class="publicacion-autor">
                <span class="publicacion-avatar">${iniciales(p.autorNombre)}</span>
                <div>
                    <strong>${p.autorNombre}</strong>
                    <div class="text-xs text-muted">${p.autorRol === "admin" ? "Administración" : "Supervisor"} · ${formatearFechaHora(p.fecha)}</div>
                </div>
            </div>
            <p class="text-sm" style="margin-top:10px">${p.mensaje}</p>
            ${p.adjuntoLabel ? `<div class="publicacion-adjunto">${Icon("reportes", { size: 16 })}<span>${p.adjuntoLabel}</span></div>` : ""}

            ${p.requiereConfirmacion ? `
                <details class="noticia-detalle" style="margin-top:14px">
                    <summary>Leído por (${leidoIds.length}/${supervisoresYAdmin.length})</summary>
                    <div class="leido-por-lista">
                        ${supervisoresYAdmin.map((u) => `
                            <div class="leido-por-item">
                                <span>${u.nombre}</span>
                                <span class="badge ${leidoIds.includes(String(u.id)) ? "badge-success" : "badge-muted"}">${leidoIds.includes(String(u.id)) ? "Leído" : "Pendiente"}</span>
                            </div>
                        `).join("")}
                    </div>
                </details>
            ` : ""}

            <h4 style="margin-top:16px">Comentarios (${comentarios.length})</h4>
            <div class="comentarios-lista">
                ${comentarios.length ? comentarios.map((c) => `
                    <div class="comentario-item">
                        <span class="publicacion-avatar publicacion-avatar-sm">${iniciales(c.autorNombre)}</span>
                        <div>
                            <div><strong>${c.autorNombre}</strong> <span class="text-xs text-muted">${formatearFechaHora(c.fecha)}</span></div>
                            <p class="text-sm">${c.texto}</p>
                            <button class="publicacion-accion publicacion-accion-sm${estaLikeadoComentario(c, usuario.id) ? " activa" : ""}" data-like-comentario="${c.id}">${Icon("corazon", { size: 12 })} ${estaLikeCount(c)}</button>
                        </div>
                    </div>
                `).join("") : `<p class="text-sm text-muted">Sin comentarios todavía.</p>`}
            </div>
        `;
    }

    // Borrar la publicación: su propio autor, o cualquier Admin
    // (moderación) — un Supervisor no puede borrar la de otro.
    const puedeEliminar = usuario.rol === "admin" || String(p.autorId) === String(usuario.id);

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2>${p.titulo}</h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body" id="publicacion-detalle-body">${await contenidoActual()}</div>
                <div class="modal-footer" style="flex-direction:column;align-items:stretch;gap:8px">
                    <textarea id="input-nuevo-comentario" rows="2" placeholder="Escribí un comentario..." style="width:100%"></textarea>
                    <span style="display:flex;justify-content:space-between;gap:8px">
                        ${puedeEliminar ? `<button class="btn btn-secondary" id="btn-eliminar-publicacion">Eliminar publicación</button>` : "<span></span>"}
                        <span style="display:flex;gap:8px">
                            <button class="btn btn-secondary" data-close="${modalId}">Cerrar</button>
                            <button class="btn btn-primary" id="btn-comentar">Comentar</button>
                        </span>
                    </span>
                </div>
            </div>
        </div>
    `, modalId);

    document.getElementById("btn-eliminar-publicacion")?.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta publicación? Esta acción no se puede deshacer.")) return;
        await eliminarPublicacion(p.id);
        registrarEvento(usuario.id, "eliminar_publicacion", `Publicación "${p.titulo}" eliminada`);
        cerrarModal(modalId);
        navigate(`comunicaciones/${p.canal}`);
    });

    async function reRenderDetalle() {
        const body = document.getElementById("publicacion-detalle-body");
        if (body) body.innerHTML = await contenidoActual();
        bindLikesComentario();
    }

    function bindLikesComentario() {
        document.querySelectorAll("[data-like-comentario]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const comentarios = await getComentariosDePublicacion(p.id);
                const c = comentarios.find((x) => String(x.id) === String(btn.dataset.likeComentario));
                if (!c) return;
                await toggleLikeComentario(c, usuario.id);
                reRenderDetalle();
            });
        });
    }
    bindLikesComentario();

    document.getElementById("btn-comentar")?.addEventListener("click", async () => {
        const input = document.getElementById("input-nuevo-comentario");
        const texto = input.value.trim();
        if (!texto) return;
        await crearComentario({ publicacionId: p.id, autorId: usuario.id, autorNombre: usuario.nombre, texto });
        registrarEvento(usuario.id, "comentario_publicacion", `Comentario en "${p.titulo}"`);
        input.value = "";
        await reRenderDetalle();
    });
}

async function abrirModalNuevaPublicacion(canalId) {
    const modalId = "modal-nueva-publicacion";
    const usuario = getUsuarioActual();

    const contenidoHtml = `
        <label for="input-canal-pub">Canal</label>
        <select id="input-canal-pub">
            ${CANALES.map((c) => `<option value="${c.id}"${c.id === canalId ? " selected" : ""}>${c.nombre}</option>`).join("")}
        </select>

        <label for="input-titulo-pub">Título</label>
        <input type="text" id="input-titulo-pub" placeholder="Ej: Cambio de uniforme">

        <label for="input-mensaje-pub">Mensaje</label>
        <textarea id="input-mensaje-pub" rows="4" placeholder="Escribí tu mensaje..."></textarea>

        <label for="input-adjunto-pub">Adjunto (opcional) — nombre a mostrar</label>
        <input type="text" id="input-adjunto-pub" placeholder="Ej: Manual de Uniforme">

        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:10px">
            <input type="checkbox" id="input-destacado-pub" style="width:auto">
            Marcar como destacado
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400">
            <input type="checkbox" id="input-confirmacion-pub" style="width:auto">
            Requiere confirmación de lectura
        </label>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nueva publicación", contenidoHtml, textoConfirmar: "Publicar" }), modalId, async () => {
        const titulo = document.getElementById("input-titulo-pub").value.trim();
        const mensaje = document.getElementById("input-mensaje-pub").value.trim();
        if (!titulo || !mensaje) return;

        const canal = document.getElementById("input-canal-pub").value;
        const adjuntoLabel = document.getElementById("input-adjunto-pub").value.trim();
        const destacado = document.getElementById("input-destacado-pub").checked;
        const requiereConfirmacion = document.getElementById("input-confirmacion-pub").checked;

        await crearPublicacion({
            canal, autorId: usuario.id, autorNombre: usuario.nombre, autorRol: usuario.rol,
            titulo, mensaje, adjuntoLabel, destacado, requiereConfirmacion,
        });
        registrarEvento(usuario.id, "crear_publicacion", `Publicación creada en #${canal}: ${titulo}`);
        cerrarModal(modalId);
        navigate(`comunicaciones/${canal}`);
    });
}
