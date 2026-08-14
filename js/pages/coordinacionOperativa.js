/* ============================
   Lucciano's Academy
   pages/coordinacionOperativa.js — Coordinación Operativa (Admin ↔ Supervisores)

   Espacio de conversación por canales — distinto del centro de avisos
   (pages/news.js, la campana): acá hay comentarios, likes y
   reciprocidad, no solo avisos de arriba hacia abajo. Colaborador no
   lo ve (ver services/auth.js). Capacitador participa como cualquier
   Supervisor: puede publicar y comentar acá — la regla de "solo
   lectura" de Capacitador es específica de la gestión de equipos
   (Colaboradores), no de esta conversación.

   Los canales (data/canales.js) son una hoja editable, no una lista
   fija: Admin y Supervisor pueden crear/renombrar canales nuevos
   desde acá mismo cuando surge un tema nuevo, sin depender de un
   cambio de código. Eliminar un canal queda solo para Admin.

   Dos vistas en un mismo archivo, sin ruta aparte: lista de canales
   (#/coordinacionoperativa) y feed de un canal
   (#/coordinacionoperativa/:canal) — mismo patrón que cursos.js con
   el id de curso.
=============================*/

import { abrirModal, cerrarModal } from "../components/modal.js";
import { Icon } from "../components/icons.js";
import { EmptyState } from "../components/emptyState.js";
import { Avatar } from "../components/avatar.js";
import {
    getPublicaciones, getPublicacionesDeCanal, crearPublicacion, actualizarPublicacion,
    eliminarPublicacion, toggleLikePublicacion, marcarPublicacionLeida,
    estaLikeada, estaLeidaPublicacion,
} from "../data/publicaciones.js";
import {
    getComentariosDePublicacion, crearComentario, toggleLikeComentario, estaLikeadoComentario,
} from "../data/comentarios.js";
import { getCanalesVisibles, canalInfo, puedeVerCanal, crearCanal, actualizarCanal, eliminarCanal, esCanalPrivado, ICONOS_CANAL, VISIBILIDAD_CANAL } from "../data/canales.js";
import { MultiSelectUsuarios, bindMultiSelectUsuarios } from "../components/multiSelectUsuarios.js";
import { getUsuarios } from "../data/usuarios.js";
import { getUsuarioActual } from "../services/auth.js";
import { registrarEvento } from "../data/auditoria.js";
import { navigate } from "../router.js";
import { mandarPush } from "../services/push.js";
import { gasRequest } from "../services/google.js";

/** Etiqueta por defecto del adjunto cuando no se escribe una a mano —
 *  mismo criterio que news.js (etiquetaAdjuntoPorDefecto): fecha y
 *  hora, sin quién lo subió (eso es referencia propia al buscar en
 *  Drive, no algo para mostrarle a quien lee la publicación). */
function etiquetaAdjuntoPorDefecto() {
    // Formateo manual (no toLocaleDateString) — en algunos navegadores
    // "es-AR" con day/month "2-digit" no rellena con cero (ej. "6/8" en
    // vez de "06/08"); esto es consistente en cualquier dispositivo.
    const ahora = new Date();
    const dd = String(ahora.getDate()).padStart(2, "0");
    const mm = String(ahora.getMonth() + 1).padStart(2, "0");
    const hh = String(ahora.getHours()).padStart(2, "0");
    const min = String(ahora.getMinutes()).padStart(2, "0");
    return `Adjunto ${dd}/${mm} · ${hh}:${min}`;
}

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

/** Etiqueta de rol para la lista de "Miembros con acceso" — Comunicaciones
 *  es exclusivamente Admin/Supervisor, nunca Colaborador. */
function rolLegibleCanal(u) {
    if (u.rol === "admin") return "Administración";
    return u.capacitador ? "Capacitador" : "Supervisor";
}

/** Quién puede publicar en un canal — pedido explícito del usuario:
 *  "supervisores solo pueden subir una publicación, capacitador solo
 *  ver y comentar". Capacitador es un Supervisor con capacitador:true
 *  (ver data/usuarios.js) — por eso se excluye a mano acá, no alcanza
 *  con chequear el rol solo. */
function puedeCrearPublicacion(usuario) {
    return usuario.rol === "admin" || (usuario.rol === "supervisor" && !usuario.capacitador);
}

export async function CoordinacionOperativa(params = []) {
    const [canalId] = params;
    return canalId ? vistaCanal(canalId) : vistaListaCanales();
}

async function vistaListaCanales() {
    const usuario = getUsuarioActual();
    const [canales, publicaciones] = await Promise.all([getCanalesVisibles(usuario), getPublicaciones()]);

    // Mismo patrón visual que .notif-item (campana/News) — ícono +
    // título + preview truncado a una línea + fecha a la derecha —
    // en vez de un ítem de lista genérico aparte. El "preview" es el
    // título de la última publicación real del canal, como en
    // cualquier lista de chats.
    const filasHtml = canales.map((c) => {
        const delCanal = publicaciones.filter((p) => String(p.canal) === String(c.id));
        const ultima = delCanal[0];
        return `
            <a class="notif-item" href="#/coordinacionoperativa/${c.id}">
                <span class="notif-item-icono canal-item-icono">${Icon(c.icono, { size: 20 })}</span>
                <span class="notif-item-body">
                    <span class="notif-item-titulo">
                        ${c.nombre}
                        ${esCanalPrivado(c) ? `<span class="badge badge-muted" title="Solo lo ven las personas elegidas">Privado</span>` : ""}
                        ${ultima?.destacado ? `<span class="canal-item-destacado">${Icon("trofeo", { size: 13 })}</span>` : ""}
                    </span>
                    <span class="notif-item-resumen">${ultima ? ultima.titulo : "Sin publicaciones todavía"}</span>
                </span>
                <span class="notif-item-fecha">${ultima ? formatearFechaHora(ultima.fecha) : ""}</span>
            </a>
        `;
    }).join("");

    return `
        <div class="compose-page-header">
            <span class="compose-ico">${Icon("comentario", { size: 24 })}</span>
            <div>
                <h1>Comunicaciones</h1>
                <p>El espacio de Supervisión y Capacitación.</p>
            </div>
            <button type="button" class="compose-ayuda" id="btn-ayuda-comunicaciones">${Icon("alertas", { size: 16 })} ¿Cómo funciona?</button>
        </div>

        <div class="table-toolbar">
            <div></div>
            ${usuario.rol === "admin" ? `<button class="btn btn-secondary" id="btn-gestionar-canales">Gestionar canales</button>` : ""}
        </div>

        <div class="section notif-lista">${filasHtml || `<p class="text-sm text-muted">Todavía no hay canales — creá el primero.</p>`}</div>
    `;
}

async function vistaCanal(canalId) {
    const info = await canalInfo(canalId);
    const usuario = getUsuarioActual();

    // Blindaje contra acceso directo por URL a un canal restringido
    // (ej. un Supervisor tipeando #/coordinacionoperativa/5 de
    // Capacitación) — el link ni siquiera aparece en la lista, pero
    // esto lo cierra también si alguien conoce/adivina el id.
    if (!puedeVerCanal(info, usuario)) {
        return `
            <div class="canal-header-nav">
                <a href="#/coordinacionoperativa" class="btn btn-secondary" style="width:auto">← Canales</a>
            </div>
            ${EmptyState({ titulo: "No tenés acceso a este canal", detalle: "Este canal está restringido a otro grupo.", icono: "candado" })}
        `;
    }

    const [publicaciones, usuarios] = await Promise.all([getPublicacionesDeCanal(canalId), getUsuarios()]);
    // "Miembros" = quiénes de gestión (admin/supervisor) pueden ver
    // ESTE canal puntual — mismo filtro que ya usa "Leído por" más
    // abajo, no una lista guardada aparte.
    const miembros = usuarios.filter((u) => (u.rol === "admin" || u.rol === "supervisor") && puedeVerCanal(info, u));

    const itemsHtml = publicaciones.length
        ? publicaciones.map((p) => filaPublicacion(p, usuario)).join("")
        : EmptyState({ titulo: "Todavía no hay publicaciones", detalle: "Sé el primero en escribir algo en este canal.", icono: info.icono });

    const infoHtml = `
        <div class="section">
            <h4>Miembros con acceso (${miembros.length})</h4>
            <div class="leido-por-lista" style="margin-top:10px">
                ${miembros.map((m) => `
                    <div class="leido-por-item">
                        <span style="display:flex;align-items:center;gap:8px">
                            <span class="publicacion-avatar publicacion-avatar-sm" style="width:28px;height:28px;border-radius:4px;overflow:hidden">
                                ${Avatar({ nombre: m.nombre, foto: m.foto, size: "sm" })}
                            </span>
                            ${m.nombre}
                        </span>
                        <span class="text-xs text-muted">${rolLegibleCanal(m)}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    return `
        <div class="canal-header-nav">
            <a href="#/coordinacionoperativa" class="btn btn-secondary" style="width:auto">← Canales</a>
        </div>

        <div class="canal-header-chat">
            <span class="notif-item-icono canal-item-icono canal-header-avatar">${Icon(info.icono, { size: 26 })}</span>
            <div>
                <h2>${info.nombre}</h2>
                <p class="text-sm text-muted">${miembros.length} miembro(s)</p>
            </div>
        </div>

        <div class="notif-tabs" style="margin-bottom:16px">
            <button class="notif-tab active" data-canal-tab="publicaciones">Publicaciones</button>
            <button class="notif-tab" data-canal-tab="informacion">Información</button>
        </div>

        <div data-canal-panel="publicaciones">
            <div class="table-toolbar">
                <div></div>
                ${puedeCrearPublicacion(usuario) ? `<button class="btn btn-primary" id="btn-nueva-publicacion" data-canal="${canalId}">+ Nueva publicación</button>` : ""}
            </div>
            <div class="section" style="display:flex;flex-direction:column;gap:14px" id="lista-publicaciones">${itemsHtml}</div>
        </div>
        <div data-canal-panel="informacion" hidden>${infoHtml}</div>
    `;
}

/** Tarjeta de adjunto tipo archivo — ícono + nombre + botón
 *  descargar, reusada en la tarjeta de la publicación y en su
 *  detalle. Sigue siendo un link (subida real de archivo queda
 *  fuera de alcance, ver plan) — solo cambia cómo se ve. */
function adjuntoCardHtml(p) {
    if (!p.adjuntoLabel || !p.adjuntoUrl) return "";
    // Sin target="_blank" a propósito — en la PWA instalada (iPhone)
    // eso abre el PDF/documento atrapado dentro de la misma app, sin
    // botón atrás para volver (mismo bug ya encontrado y sacado de
    // Manuales/Noticias/lecciones, reintroducido acá sin querer).
    return `
        <a class="publicacion-adjunto" href="${p.adjuntoUrl}" rel="noopener">
            <span class="publicacion-adjunto-icono">${Icon("documento", { size: 17 })}</span>
            <span class="publicacion-adjunto-nombre">${p.adjuntoLabel}</span>
            <span class="publicacion-adjunto-descargar">${Icon("descargar", { size: 16 })}</span>
        </a>
    `;
}

function filaPublicacion(p, usuario) {
    const likeada = estaLikeada(p, usuario.id);
    return `
        <div class="card publicacion-card">
            ${p.destacado ? `<span class="publicacion-destacado">${Icon("trofeo", { size: 13 })} Destacado</span>` : ""}
            <div class="publicacion-autor">
                ${Avatar({ nombre: p.autorNombre, foto: p.autorFoto, size: "" })}
                <div>
                    <strong>${p.autorNombre}</strong>
                    <div class="text-xs text-muted">${p.autorRol === "admin" ? "Administración" : "Supervisor"} · ${formatearFechaHora(p.fecha)}</div>
                </div>
            </div>
            <h3 style="margin-top:10px">${p.titulo}</h3>
            <p class="text-sm" style="margin-top:6px;color:var(--text)">${p.mensaje}</p>
            ${adjuntoCardHtml(p)}
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

export function bindCoordinacionOperativa(params = []) {
    const usuario = getUsuarioActual();

    document.getElementById("btn-gestionar-canales")?.addEventListener("click", () => abrirModalGestionarCanales());

    document.getElementById("btn-ayuda-comunicaciones")?.addEventListener("click", () => {
        alert(
            "Comunicaciones\n" +
            "El espacio de Supervisión y Capacitación.\n\n" +
            "• Cada canal tiene un destino y un tema propio.\n" +
            "• La creación y organización de los canales está a cargo de Administración.\n" +
            "• Supervisión publica dentro de cada canal.\n" +
            "• Capacitación acompaña comentando en las publicaciones.\n\n" +
            "Cada publicación puede incluir un adjunto: PDF, imagen, video o un enlace."
        );
    });

    // Tabs Publicaciones/Información del header del canal — mismo
    // patrón simple que ya usa News (mostrar/ocultar paneles ya
    // renderizados, sin re-pedir datos al servidor).
    document.querySelectorAll("[data-canal-tab]").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("[data-canal-tab]").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll("[data-canal-panel]").forEach((p) => {
                p.hidden = p.dataset.canalPanel !== tab.dataset.canalTab;
            });
        });
    });

    document.getElementById("btn-nueva-publicacion")?.addEventListener("click", (e) => {
        abrirModalNuevaPublicacion(e.target.dataset.canal);
    });

    document.querySelectorAll("[data-like-publicacion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const publicaciones = await getPublicaciones();
            const p = publicaciones.find((x) => String(x.id) === String(btn.dataset.likePublicacion));
            if (!p) return;
            await toggleLikePublicacion(p, usuario.id);
            navigate(`coordinacionoperativa/${p.canal}`);
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

function abrirDetallePublicacion(p) {
    const usuario = getUsuarioActual();
    const modalId = "modal-publicacion";

    if (p.requiereConfirmacion && !estaLeidaPublicacion(p, usuario.id)) {
        // Sin "await" a propósito — antes esto se esperaba ANTES de
        // siquiera abrir el modal, así que "Ver/comentar" se sentía
        // colgado unos segundos con la pantalla en blanco (reportado
        // en vivo: "me caliento la pava y me tomo dos mates"). Marcar
        // como leída no tiene por qué bloquear ver el contenido.
        marcarPublicacionLeida(p, usuario.id).catch((err) => console.warn("No se pudo marcar como leída:", err.message));
        // Parche local optimista — "p" acá es una copia normalizada
        // (getPublicaciones mapea cada fila a un objeto nuevo), así
        // que sin esto el "Leído por" de esta apertura se ve
        // desactualizado hasta la próxima vez que se pida la lista.
        const actuales = String(p.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);
        actuales.push(String(usuario.id));
        p.leidoPor = actuales.join(",");
    }

    async function contenidoActual() {
        const [comentarios, usuarios, canalDeLaPublicacion] = await Promise.all([
            getComentariosDePublicacion(p.id),
            getUsuarios(),
            canalInfo(p.canal),
        ]);
        // Bug real reportado por el usuario: esto antes era TODO
        // admin+supervisor sin importar el canal ("Solo Capacitadores"
        // mostraba supervisores igual, y viceversa) — el header del
        // canal (vistaCanal, más arriba) ya filtraba bien con
        // puedeVerCanal, pero acá abajo el "Leído por" usaba una
        // lista aparte que nunca miraba la restricción del canal.
        const supervisoresYAdmin = usuarios.filter((u) => puedeVerCanal(canalDeLaPublicacion, u) && (u.rol === "admin" || u.rol === "supervisor"));
        const leidoIds = String(p.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);

        return `
            <div class="publicacion-autor">
                ${Avatar({ nombre: p.autorNombre, foto: p.autorFoto, size: "" })}
                <div>
                    <strong>${p.autorNombre}</strong>
                    <div class="text-xs text-muted">${p.autorRol === "admin" ? "Administración" : "Supervisor"} · ${formatearFechaHora(p.fecha)}</div>
                </div>
            </div>
            <p class="text-sm" style="margin-top:10px">${p.mensaje}</p>
            ${adjuntoCardHtml(p)}

            ${p.requiereConfirmacion ? `
                <div style="margin-top:14px">
                    <div class="leido-avatares">
                        <span class="leido-avatares-pila">
                            ${supervisoresYAdmin.slice(0, 5).map((u) => `<span class="publicacion-avatar publicacion-avatar-sm" title="${u.nombre}" style="width:28px;height:28px;border-radius:4px;overflow:hidden;display:inline-block">${Avatar({ nombre: u.nombre, foto: u.foto, size: "sm" })}</span>`).join("")}
                        </span>
                        <span class="leido-avatares-texto">${leidoIds.length}/${supervisoresYAdmin.length} leyeron</span>
                    </div>
                    <details class="noticia-detalle" style="margin-top:8px">
                        <summary>Ver todos (${supervisoresYAdmin.length})</summary>
                        <div class="leido-por-lista">
                            ${supervisoresYAdmin.map((u) => `
                                <div class="leido-por-item">
                                    <span>${u.nombre}</span>
                                    <span class="badge ${leidoIds.includes(String(u.id)) ? "badge-success" : "badge-muted"}">${leidoIds.includes(String(u.id)) ? "Leído" : "Pendiente"}</span>
                                </div>
                            `).join("")}
                        </div>
                    </details>
                </div>
            ` : ""}

            <h4 style="margin-top:16px">Comentarios (${comentarios.length})</h4>
            <div class="comentarios-lista">
                ${comentarios.length ? comentarios.map((c) => `
                    <div class="comentario-item">
                        ${Avatar({ nombre: c.autorNombre, foto: c.autorFoto, size: "sm" })}
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

    // El modal se abre YA, con un placeholder — antes esperaba a que
    // termine de bajar comentarios+usuarios+canal (varios segundos de
    // red real) antes de mostrar NADA, mismo reclamo de fluidez que
    // el resto de esta sesión. contenidoActual() se resuelve aparte y
    // parcha #publicacion-detalle-body apenas está lista (reusa
    // reRenderDetalle, la misma función que ya repinta el detalle
    // después de comentar/likear).
    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2>${p.titulo}</h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body" id="publicacion-detalle-body">
                    <p class="text-sm text-muted">Cargando...</p>
                </div>
                <div class="modal-footer" style="flex-direction:column;align-items:stretch;gap:8px">
                    <textarea id="input-nuevo-comentario" rows="2" placeholder="Escribí un comentario..." style="width:100%"></textarea>
                    <span style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                        ${puedeEliminar ? `
                            <span style="display:flex;gap:2px">
                                <button class="publicacion-accion-icono" id="btn-editar-publicacion" title="Editar" aria-label="Editar publicación">${Icon("lapiz", { size: 17 })}</button>
                                <button class="publicacion-accion-icono publicacion-accion-icono-danger" id="btn-eliminar-publicacion" title="Eliminar" aria-label="Eliminar publicación">${Icon("tacho", { size: 17 })}</button>
                            </span>
                        ` : "<span></span>"}
                        <span style="display:flex;align-items:center;gap:10px">
                            <button class="publicacion-accion-texto" data-close="${modalId}">Cerrar</button>
                            <button class="btn btn-primary" id="btn-comentar" style="width:auto;height:38px;padding:0 22px;border-radius:19px;display:flex;align-items:center">Comentar</button>
                        </span>
                    </span>
                </div>
            </div>
        </div>
    `, modalId);

    reRenderDetalle();

    document.getElementById("btn-editar-publicacion")?.addEventListener("click", () => {
        cerrarModal(modalId);
        abrirModalEditarPublicacion(p);
    });

    document.getElementById("btn-eliminar-publicacion")?.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta publicación? Esta acción no se puede deshacer.")) return;
        await eliminarPublicacion(p.id);
        registrarEvento(usuario.id, "eliminar_publicacion", `Publicación "${p.titulo}" eliminada`);
        cerrarModal(modalId);
        navigate(`coordinacionoperativa/${p.canal}`);
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
    // No hace falta llamar bindLikesComentario() acá — reRenderDetalle()
    // (ya disparado más arriba para pintar el contenido real) lo hace
    // apenas el HTML con los botones de like existe de verdad.

    document.getElementById("btn-comentar")?.addEventListener("click", async () => {
        const input = document.getElementById("input-nuevo-comentario");
        const texto = input.value.trim();
        if (!texto) return;
        await crearComentario({ publicacionId: p.id, autorId: usuario.id, autorNombre: usuario.nombre, autorFoto: usuario.foto, texto });
        registrarEvento(usuario.id, "comentario_publicacion", `Comentario en "${p.titulo}"`);
        input.value = "";
        await reRenderDetalle();
    });
}

/** Push automático al publicar en un canal — pedido explícito del
 *  usuario tras probarlo y notar que solo funcionaba en News ("Fase
 *  C" original era solo para News, esto lo suma acá con el mismo
 *  criterio: mandar a quien puede VER el canal, mismo filtro que ya
 *  usa la lista de canales — admin/supervisor según la visibilidad
 *  configurada). No bloquea la publicación si el push falla. */
async function mandarPushDePublicacion(canalObj, titulo, mensaje) {
    try {
        const usuarios = await getUsuarios();
        const destinatarios = usuarios.filter((u) => puedeVerCanal(canalObj, u)).map((u) => u.id);
        if (destinatarios.length) await mandarPush(destinatarios, titulo, mensaje, `#/coordinacionoperativa/${canalObj.id}`);
    } catch (err) {
        console.warn("No se pudo mandar el push de la publicación:", err.message);
    }
}

/** No usa el Modal() genérico a propósito — el header "Cancelar /
 *  título / Publicar" tipo compose (pedido del usuario, ver mockup)
 *  no entra en el molde de título-arriba + Cancelar/Confirmar-abajo.
 *  Mismo mecanismo de siempre para el auto-cierre y el guard de
 *  doble-envío: data-close/data-confirm con ese id, ver modal.js. */
async function abrirModalNuevaPublicacion(canalId) {
    const modalId = "modal-nueva-publicacion";
    const usuario = getUsuarioActual();
    const canales = await getCanalesVisibles(usuario);

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="compose-header">
                    <button class="compose-header-btn compose-header-cancelar" data-close="${modalId}">Cancelar</button>
                    <h2>Nueva publicación</h2>
                    <button class="compose-header-btn compose-header-publicar" data-confirm="${modalId}">Publicar</button>
                </div>
                <div class="modal-body">
                    <label for="input-canal-pub">Canal</label>
                    <select id="input-canal-pub">
                        ${canales.map((c) => `<option value="${c.id}"${String(c.id) === String(canalId) ? " selected" : ""}>${c.nombre}</option>`).join("")}
                    </select>

                    <label for="input-titulo-pub">Título</label>
                    <input type="text" id="input-titulo-pub" placeholder="Ej: Cambio de uniforme">

                    <label for="input-mensaje-pub">Mensaje</label>
                    <textarea id="input-mensaje-pub" rows="4" maxlength="1000" placeholder="Escribí tu mensaje..."></textarea>
                    <div class="compose-contador"><span id="contador-mensaje-pub">0</span>/1000</div>

                    <label>Adjunto (opcional) <span class="mod-tooltip" data-tooltip-texto="Sube un archivo (PDF, Excel, Word) o pega un link de Drive. Si dejás la Etiqueta vacía, se guarda con fecha y hora — el archivo en Drive también queda ordenado por fecha, fácil de ubicar después.">ⓘ</span></label>
                    <div class="adjunto-tipos" style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
                        <button type="button" class="adjunto-tipo-btn" data-tipo="documento">📄<span>PDF</span></button>
                        <button type="button" class="adjunto-tipo-btn" data-tipo="imagen">🖼️<span>Imagen</span></button>
                        <button type="button" class="adjunto-tipo-btn" data-tipo="video">🎬<span>Video</span></button>
                        <button type="button" class="adjunto-tipo-btn" data-tipo="enlace" style="border:2px solid var(--accent);color:var(--accent)">🔗<span>Link</span></button>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:flex-start;margin-bottom:12px">
                        <div>
                            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">URL/Enlace</label>
                            <input type="text" id="input-adjunto-url-pub" placeholder="https://drive.google.com/..." style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:16px">
                        </div>
                        <div>
                            <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Etiqueta <span class="mod-tooltip" data-tooltip-texto="Así se va a ver el botón para quien reciba la publicación. Ej: 'Descargar Manual de Uniforme'. Si lo dejás vacío, se arma solo con fecha y hora.">ⓘ</span></label>
                            <input type="text" id="input-adjunto-pub" placeholder="Ej: Manual de Uniforme" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:16px">
                        </div>
                    </div>
                    <input type="file" id="input-archivo-comun" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.csv,.txt,.zip,.jpg,.jpeg,.png,.gif,.mp4,.webm" style="display:none">
                    <button type="button" id="btn-subir-archivo-comun" class="btn btn-secondary" style="width:100%;padding:12px;font-weight:600">📤 Subir archivo</button>

                    <label class="toggle-switch" style="margin-top:16px">
                        Marcar como destacado
                        <input type="checkbox" id="input-destacado-pub">
                    </label>
                    ${usuario.rol === "admin" ? `
                    <label class="toggle-switch">
                        Requiere confirmación de lectura
                        <input type="checkbox" id="input-confirmacion-pub">
                    </label>
                    ` : ""}
                </div>
            </div>
        </div>
    `, modalId, async () => {
        const titulo = document.getElementById("input-titulo-pub").value.trim();
        const mensaje = document.getElementById("input-mensaje-pub").value.trim();
        if (!titulo || !mensaje) return;

        const canal = document.getElementById("input-canal-pub").value;
        const adjuntoUrl = document.getElementById("input-adjunto-url-pub").value.trim();
        const adjuntoLabel = document.getElementById("input-adjunto-pub").value.trim() || (adjuntoUrl ? etiquetaAdjuntoPorDefecto() : "");
        const destacado = document.getElementById("input-destacado-pub").checked;
        const requiereConfirmacion = document.getElementById("input-confirmacion-pub")?.checked || false;

        await crearPublicacion({
            canal, autorId: usuario.id, autorNombre: usuario.nombre, autorFoto: usuario.foto, autorRol: usuario.rol,
            titulo, mensaje, adjuntoUrl, adjuntoLabel, destacado, requiereConfirmacion,
        });
        registrarEvento(usuario.id, "crear_publicacion", `Publicación creada en #${canal}: ${titulo}`);
        const canalObj = canales.find((c) => String(c.id) === String(canal));
        // Sin "await" — mismo criterio que news.js: la publicación ya
        // quedó guardada, no hay razón para dejar el modal en
        // "Guardando..." mientras el push (varios segundos con
        // destinatarios reales) todavía viaja. mandarPushDePublicacion
        // ya atrapa sus propios errores.
        if (canalObj) mandarPushDePublicacion(canalObj, titulo, mensaje);
        cerrarModal(modalId);
        navigate(`coordinacionoperativa/${canal}`);
    });

    const mensajeInput = document.getElementById("input-mensaje-pub");
    const contador = document.getElementById("contador-mensaje-pub");
    mensajeInput.addEventListener("input", () => { contador.textContent = mensajeInput.value.length; });
    bindAdjuntoTipos("icono-adjunto-pub");

    // Botones de tipo de adjunto para Comunicaciones
    document.querySelectorAll(".adjunto-tipo-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".adjunto-tipo-btn").forEach((b) => b.style.borderColor = "var(--line)");
            btn.style.borderColor = "var(--accent)";
        });
    });

    // File upload para Comunicaciones
    const inputArchivoCom = document.getElementById("input-archivo-comun");
    const btnSubirArchivoCom = document.getElementById("btn-subir-archivo-comun");
    if (btnSubirArchivoCom) {
        btnSubirArchivoCom.addEventListener("click", () => inputArchivoCom?.click());
        inputArchivoCom?.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const textoOriginal = btnSubirArchivoCom.textContent;
            btnSubirArchivoCom.disabled = true;
            btnSubirArchivoCom.textContent = `Subiendo...`;
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
                    reader.readAsDataURL(file);
                });
                const resultado = await gasRequest("subirArchivo", {
                    nombreArchivo: file.name,
                    extension: file.name.split(".").pop() || "bin",
                    archivoBase64: base64,
                });
                if (!resultado || !resultado.ok) {
                    throw new Error(resultado?.error || "No se pudo subir el archivo.");
                }
                document.getElementById("input-adjunto-url-pub").value = resultado.url;
                document.getElementById("input-adjunto-pub").value = file.name;
            } catch (err) {
                alert(err.message || "No se pudo subir el archivo.");
            } finally {
                inputArchivoCom.value = "";
                btnSubirArchivoCom.disabled = false;
                btnSubirArchivoCom.textContent = textoOriginal;
            }
        });
    }
}

/** Botón de tipo de adjunto (PDF/Imagen/Video/Link) — puramente
 *  visual: solo cambia el ícono mostrado sobre el campo de link de
 *  siempre, no agrega un mecanismo de subida real (ver nota en
 *  components.css). */
function adjuntoTipoBtnHtml(tipo, etiqueta, activo = false) {
    return `<button type="button" class="adjunto-tipo-btn${activo ? " active" : ""}" data-tipo="${tipo}">${Icon(tipo, { size: 18 })}<span>${etiqueta}</span></button>`;
}

function bindAdjuntoTipos(iconoDestinoId) {
    const destino = document.getElementById(iconoDestinoId);
    document.querySelectorAll(".adjunto-tipo-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".adjunto-tipo-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            if (destino) destino.innerHTML = Icon(btn.dataset.tipo, { size: 16 });
        });
    });
}

/** Corregir una publicación ya creada (typo, link mal copiado, etc.)
 *  sin perder sus likes/comentarios/lecturas — antes la única forma
 *  era borrar y volver a cargarla entera. Mismo permiso que borrar:
 *  su propio autor, o cualquier Admin. */
async function abrirModalEditarPublicacion(p) {
    const modalId = "modal-editar-publicacion";
    const usuario = getUsuarioActual();

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="compose-header">
                    <button class="compose-header-btn compose-header-cancelar" data-close="${modalId}">Cancelar</button>
                    <h2>Editar publicación</h2>
                    <button class="compose-header-btn compose-header-publicar" data-confirm="${modalId}">Guardar</button>
                </div>
                <div class="modal-body">
                    <label for="input-titulo-editar-pub">Título</label>
                    <input type="text" id="input-titulo-editar-pub" value="${p.titulo}">

                    <label for="input-mensaje-editar-pub">Mensaje</label>
                    <textarea id="input-mensaje-editar-pub" rows="4" maxlength="1000">${p.mensaje}</textarea>

                    <label>Adjunto (opcional) <span class="mod-tooltip" data-tooltip-texto="Sube un archivo (PDF, Excel, Word) o pega un link de Drive. Si dejás la Etiqueta vacía, se guarda con fecha y hora — el archivo en Drive también queda ordenado por fecha, fácil de ubicar después.">ⓘ</span></label>
                    <div class="adjunto-tipos">
                        ${adjuntoTipoBtnHtml("documento", "PDF")}
                        ${adjuntoTipoBtnHtml("imagen", "Imagen")}
                        ${adjuntoTipoBtnHtml("video", "Video")}
                        ${adjuntoTipoBtnHtml("enlace", "Link", true)}
                    </div>
                    <div class="input-adjunto-chip">
                        <span id="icono-adjunto-editar-pub">${Icon("enlace", { size: 16 })}</span>
                        <input type="text" id="input-adjunto-url-editar-pub" value="${p.adjuntoUrl || ""}" placeholder="Pegar link de Drive u otro">
                    </div>
                    <input type="text" id="input-adjunto-editar-pub" value="${p.adjuntoLabel || ""}" placeholder="Texto del botón (ej: Manual de Uniforme)" style="margin-top:8px">

                    <label class="toggle-switch" style="margin-top:16px">
                        Marcar como destacado
                        <input type="checkbox" id="input-destacado-editar-pub"${p.destacado ? " checked" : ""}>
                    </label>
                    ${usuario.rol === "admin" ? `
                    <label class="toggle-switch">
                        Requiere confirmación de lectura
                        <input type="checkbox" id="input-confirmacion-editar-pub"${p.requiereConfirmacion ? " checked" : ""}>
                    </label>
                    ` : ""}
                </div>
            </div>
        </div>
    `, modalId, async () => {
        const titulo = document.getElementById("input-titulo-editar-pub").value.trim();
        const mensaje = document.getElementById("input-mensaje-editar-pub").value.trim();
        if (!titulo || !mensaje) return;

        const adjuntoUrl = document.getElementById("input-adjunto-url-editar-pub").value.trim();
        const adjuntoLabel = document.getElementById("input-adjunto-editar-pub").value.trim() || (adjuntoUrl ? etiquetaAdjuntoPorDefecto() : "");
        // destacado/requiereConfirmacion viajan como "SI"/"NO" en la
        // Sheet (mismo formato que escribe crearPublicacion) — mandar
        // el boolean crudo del checkbox rompe normalizarPublicacion,
        // que compara contra el string "SI". Si no es admin, el toggle
        // ni se renderiza — se conserva el valor que ya tenía la
        // publicación en vez de forzarlo a "NO".
        const destacado = document.getElementById("input-destacado-editar-pub").checked ? "SI" : "NO";
        const inputConfirmacion = document.getElementById("input-confirmacion-editar-pub");
        const requiereConfirmacion = inputConfirmacion ? (inputConfirmacion.checked ? "SI" : "NO") : (p.requiereConfirmacion ? "SI" : "NO");

        await actualizarPublicacion(p.id, { titulo, mensaje, adjuntoUrl, adjuntoLabel, destacado, requiereConfirmacion });
        registrarEvento(usuario.id, "editar_publicacion", `Publicación "${titulo}" editada`);
        cerrarModal(modalId);
        navigate(`coordinacionoperativa/${p.canal}`);
    });

    bindAdjuntoTipos("icono-adjunto-editar-pub");
}

/** Gestión de canales — exclusivamente Admin (pedido explícito del
 *  usuario: "yo solo puedo crear canales"; Supervisor solo publica,
 *  ver puedeCrearPublicacion). El botón que abre este modal ya está
 *  gateado a admin-only en vistaListaCanales, así que nadie más llega
 *  hasta acá — sin chequeo de rol duplicado adentro. Todo vive en la
 *  hoja "Canales" (data/canales.js), no en el código — un canal
 *  nuevo queda disponible al toque, sin deploy. */
/** Los ids elegidos en el picker, con el dueño del canal SIEMPRE
 *  adentro. Sin esto se puede armar un canal y olvidarse de incluirse:
 *  como la lista de miembros gana incluso sobre el pase de Admin, el
 *  canal quedaría creado y sin nadie que pueda entrar a arreglarlo. */
function leerMiembros(inputId, usuario) {
    const crudo = document.getElementById(inputId)?.value || "";
    const ids = crudo.split(",").map((x) => x.trim()).filter(Boolean);
    if (!ids.some((id) => String(id) === String(usuario.id))) ids.unshift(String(usuario.id));
    return ids;
}

async function abrirModalGestionarCanales() {
    const modalId = "modal-gestionar-canales";
    const usuario = getUsuarioActual();

    async function contenidoActual() {
        const canales = await getCanalesVisibles(usuario);
        return `
            <div class="canal-gestion-lista">
                ${canales.map((c) => `
                    <div class="canal-gestion-item">
                        <div class="canal-gestion-fila-nombre">
                            <span class="canal-item-icono">${Icon(c.icono, { size: 16 })}</span>
                            <input type="text" class="input-canal-nombre" data-canal-id="${c.id}" value="${c.nombre}">
                        </div>
                        <div class="canal-gestion-fila-acciones">
                            <select class="input-canal-visibilidad" data-canal-id="${c.id}">
                                ${VISIBILIDAD_CANAL.map((v) => `<option value="${v.id}"${v.id === (esCanalPrivado(c) ? "personas" : c.restringidoA) ? " selected" : ""}>${v.nombre}</option>`).join("")}
                            </select>
                            <button class="btn btn-secondary" data-guardar-canal="${c.id}">Guardar</button>
                            <button class="btn btn-secondary" data-eliminar-canal="${c.id}">Eliminar</button>
                        </div>
                        <div class="canal-gestion-miembros" data-miembros-de="${c.id}"${esCanalPrivado(c) ? "" : " hidden"}>
                            <label style="font-size:12px;font-weight:600;color:var(--muted);margin:8px 0 6px;display:block">Quiénes lo ven</label>
                            ${MultiSelectUsuarios(`canal-miembros-${c.id}`, c.miembros)}
                        </div>
                    </div>
                `).join("")}
            </div>

            <label for="input-nuevo-canal-nombre" style="margin-top:16px">Nuevo canal</label>
            <label style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;display:block">Ícono</label>
            <div class="canal-icono-picker" id="nuevo-canal-icono-picker">
                ${ICONOS_CANAL.map((i, idx) => `<button type="button" class="canal-icono-btn${idx === 0 ? " active" : ""}" data-icono="${i.id}" title="${i.nombre}" aria-label="${i.nombre}">${Icon(i.id, { size: 18 })}</button>`).join("")}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <input type="text" id="input-nuevo-canal-nombre" placeholder="Ej: Marketing" style="flex:1 1 140px">
                <select id="input-nuevo-canal-visibilidad" style="flex:0 0 160px">
                    ${VISIBILIDAD_CANAL.map((v) => `<option value="${v.id}">${v.nombre}</option>`).join("")}
                </select>
                <button class="btn btn-primary" id="btn-crear-canal" style="flex:0 0 auto">Crear</button>
            </div>

            <div id="nuevo-canal-miembros" hidden>
                <label style="font-size:12px;font-weight:600;color:var(--muted);margin:10px 0 6px;display:block">Quiénes lo ven</label>
                ${MultiSelectUsuarios("canal-miembros-nuevo", [])}
                <p class="text-xs text-muted" style="margin-top:6px">
                    Solo esta gente ve el canal — ningún otro Admin tampoco. Vos quedás adentro siempre, aunque no te elijas.
                </p>
            </div>
        `;
    }

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2>Gestionar canales</h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body" id="canales-gestion-body">${await contenidoActual()}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close="${modalId}">Cerrar</button>
                </div>
            </div>
        </div>
    `, modalId);

    async function reRender() {
        const body = document.getElementById("canales-gestion-body");
        if (body) body.innerHTML = await contenidoActual();
        await bindAcciones();
    }

    /* Comunicaciones es Admin ↔ Supervisor: un colaborador no tiene esta
       pantalla, así que ofrecerlo como miembro sería prometerle algo que
       nunca va a ver. */
    const elegibleParaCanal = (u) => u.rol === "admin" || u.rol === "supervisor";

    async function bindAcciones() {
        // El picker de personas solo tiene sentido con "Solo las personas
        // que elija" — aparece y desaparece con el selector, en vez de
        // estar siempre a la vista sin hacer nada.
        document.querySelectorAll(".input-canal-visibilidad").forEach((sel) => {
            sel.addEventListener("change", () => {
                const caja = document.querySelector(`[data-miembros-de="${sel.dataset.canalId}"]`);
                if (caja) caja.hidden = sel.value !== "personas";
            });
        });

        const selNuevo = document.getElementById("input-nuevo-canal-visibilidad");
        selNuevo?.addEventListener("change", () => {
            document.getElementById("nuevo-canal-miembros").hidden = selNuevo.value !== "personas";
        });

        await bindMultiSelectUsuarios("canal-miembros-nuevo", elegibleParaCanal);
        await Promise.all([...document.querySelectorAll("[data-miembros-de]")]
            .map((caja) => bindMultiSelectUsuarios(`canal-miembros-${caja.dataset.miembrosDe}`, elegibleParaCanal)));

        document.querySelectorAll("[data-guardar-canal]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.guardarCanal;
                const input = document.querySelector(`.input-canal-nombre[data-canal-id="${id}"]`);
                const selectVisibilidad = document.querySelector(`.input-canal-visibilidad[data-canal-id="${id}"]`);
                const nombre = input.value.trim();
                if (!nombre) return;
                const esPersonas = selectVisibilidad.value === "personas";
                const miembros = esPersonas ? leerMiembros(`canal-miembros-${id}`, usuario) : [];
                if (esPersonas && !miembros.length) {
                    alert("Elegí al menos una persona, o el canal no lo va a ver nadie — ni vos.");
                    return;
                }
                await actualizarCanal(id, {
                    nombre,
                    restringidoA: selectVisibilidad.value,
                    miembros: miembros.join(","),
                });
                registrarEvento(usuario.id, "editar_canal", `Canal "${nombre}" actualizado`);
                await reRender();
            });
        });

        document.querySelectorAll("[data-eliminar-canal]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!confirm("¿Eliminar este canal? Las publicaciones que tenga adentro dejan de ser accesibles desde la lista de canales.")) return;
                await eliminarCanal(btn.dataset.eliminarCanal);
                registrarEvento(usuario.id, "eliminar_canal", `Canal ${btn.dataset.eliminarCanal} eliminado`);
                await reRender();
            });
        });

        document.querySelectorAll("#nuevo-canal-icono-picker .canal-icono-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.querySelectorAll("#nuevo-canal-icono-picker .canal-icono-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
            });
        });

        document.getElementById("btn-crear-canal")?.addEventListener("click", async () => {
            const nombre = document.getElementById("input-nuevo-canal-nombre").value.trim();
            if (!nombre) return;
            const icono = document.querySelector("#nuevo-canal-icono-picker .canal-icono-btn.active")?.dataset.icono || ICONOS_CANAL[0].id;
            const restringidoA = document.getElementById("input-nuevo-canal-visibilidad").value;
            const esPersonas = restringidoA === "personas";
            const miembros = esPersonas ? leerMiembros("canal-miembros-nuevo", usuario) : [];
            if (esPersonas && miembros.length < 2) {
                alert("Elegí al menos una persona además de vos — un canal de una sola persona no es una conversación.");
                return;
            }
            await crearCanal({ nombre, icono, creadoPor: usuario.nombre, restringidoA, miembros });
            registrarEvento(usuario.id, "crear_canal", `Canal creado: ${nombre}`);
            await reRender();
        });
    }
    await bindAcciones();

    // Al cerrar este modal, la lista de canales de fondo puede haber
    // cambiado (uno nuevo, uno renombrado) — se refresca la pantalla.
    document.getElementById(modalId)?.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => navigate("coordinacionoperativa"));
    });
}
