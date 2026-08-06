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
import { abrirModal, cerrarModal } from "../components/modal.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { MultiSelectUsuarios, bindMultiSelectUsuarios } from "../components/multiSelectUsuarios.js";
import { renderProcedimiento } from "../components/procedimiento.js";
import { Icon } from "../components/icons.js";
import {
    getNoticias, getNoticiasVisibles, crearNoticia, actualizarNoticia, eliminarNoticia,
    marcarNotificacionLeida, marcarNotificacionNoLeida, estaLeida, puedeVerNoticia,
    estaFijadaPersonal, toggleFijadaPersonal,
    TIPOS_NOTIFICACION, PRIORIDADES, DIRIGIDO_A,
} from "../data/noticias.js";
import { getCursos } from "../data/cursos.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales } from "../data/sucursales.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { getItem, setItem } from "../services/storage.js";
import { invalidar } from "../services/dataSource.js";
import { gasRequest } from "../services/google.js";
import { navigate } from "../router.js";
import { actualizarContadorCampana, decrementarContadorCampana } from "../components/topbar.js";
import { mandarPush } from "../services/push.js";

// Categorías de noticia — texto libre, pero se recuerdan como pills
// para reusar (pedido del usuario: "poner a gusto y que aparezca como
// ya usado"). Es UNA lista editable en localStorage: se siembra con
// las base la primera vez, se suma cada categoría nueva, y se puede
// BORRAR cualquier pill (pedido: "dejá que borre las etiquetas ya
// cargadas por si lo deseo"). Al borrarlas todas, no se re-siembran.
const CLAVE_CATEGORIAS = "categorias_noticia";
const CATEGORIAS_BASE = ["Curso", "Procedimiento", "Producto", "Capacitación", "Certificados", "Novedad", "Beneficios", "Campaña"];

function categoriasRecordadas() {
    const guardadas = getItem(CLAVE_CATEGORIAS, null);
    // null = nunca se tocó la lista → sembrar con las base. Un array
    // vacío guardado = el usuario las borró todas a propósito, se
    // respeta (no se re-siembra).
    if (!Array.isArray(guardadas)) return [...CATEGORIAS_BASE];
    return guardadas.map((c) => String(c).trim()).filter(Boolean);
}

function recordarCategoria(categoria) {
    const c = String(categoria || "").trim();
    // "noticia" es el tipo por defecto cuando no se elige categoría —
    // no es una etiqueta real, no debe quedar guardada como pill.
    if (!c || c.toLowerCase() === "noticia") return;
    const lista = categoriasRecordadas();
    if (!lista.some((x) => x.toLowerCase() === c.toLowerCase())) {
        setItem(CLAVE_CATEGORIAS, [...lista, c]);
    }
}

function olvidarCategoria(categoria) {
    const c = String(categoria || "").trim().toLowerCase();
    setItem(CLAVE_CATEGORIAS, categoriasRecordadas().filter((x) => x.toLowerCase() !== c));
}

/** Quién puede crear una News — pedido del usuario: "el apartado de
 *  News es el que solo supervisor puede crear". Admin también (gestiona
 *  todo). Capacitador queda afuera (es Supervisor con flag, pero su
 *  regla es solo ver/comentar). Editar/eliminar una News ya publicada
 *  queda solo para Admin (moderación) — News no guarda autor. */
function puedeCrearNoticia(usuario) {
    return usuario.rol === "admin" || (usuario.rol === "supervisor" && !usuario.capacitador);
}

function tipoInfo(tipoId) {
    const conocido = TIPOS_NOTIFICACION.find((t) => t.id === tipoId);
    if (conocido) return conocido;
    // Categoría de texto libre (ej. "Novedad", "Producto") — se
    // muestra tal cual la escribió el usuario, con el ícono genérico
    // de noticia. "noticia"/"" caen al primer tipo base.
    const texto = String(tipoId || "").trim();
    if (!texto || texto === "noticia") return TIPOS_NOTIFICACION[0];
    return { icono: "noticias", nombre: texto };
}

function prioridadInfo(prioridadId) {
    return PRIORIDADES.find((p) => p.id === prioridadId) || PRIORIDADES[2];
}

function escaparHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

/** Etiqueta por defecto de un adjunto cuando no se escribe una a mano
 *  — pedido explícito del usuario: en vez de un genérico "Ver enlace",
 *  mejor fecha y hora, así es más fácil de ubicar después. SIN quién
 *  lo subió — ese dato es una referencia para el propio usuario al
 *  buscar en Drive (privado), no algo para mostrarle a quien lee la
 *  News. */
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

function camposNotificacionHtml(n = {}, cursos = [], usuario = {}) {
    const opcionesCursos = cursos.map((c) => `<option value="${c.id}"${String(n.enlace) === String(c.id) ? " selected" : ""}>${c.nombre}</option>`).join("");
    const opcionesPrioridad = PRIORIDADES.map((p) => `<option value="${p.id}"${(n.prioridad || "info") === p.id ? " selected" : ""}>${p.nombre}</option>`).join("");
    const dirigidoActual = n.dirigidoA || "";
    const tipoActual = n.tipo && n.tipo !== "noticia" ? n.tipo : "";
    const opcionesCategoria = categoriasRecordadas().map((c) => `<option value="${c}"></option>`).join("");
    const esAdmin = usuario.rol === "admin";

    // Pills de categoría ya usadas — click rellena el input; cada una
    // tiene un × para borrarla de la lista (pedido del usuario).
    const pillsCategoria = categoriasRecordadas().map((c) => `
        <span class="pill-categoria-wrap">
            <button type="button" class="pill-categoria${tipoActual.toLowerCase() === c.toLowerCase() ? " activa" : ""}" data-pill-categoria="${c}">${c}</button>
            <button type="button" class="pill-cat-borrar" data-borrar-categoria="${c}" aria-label="Borrar ${c}" title="Borrar etiqueta">×</button>
        </span>
    `).join("");

    // Descripción de cada público objetivo, para la radio-card (ver
    // DIRIGIDO_A en data/noticias.js). News es solo para colaboradores;
    // Supervisión + Admin siempre reciben copia (no son opción).
    const DESC_DIRIGIDO = {
        "": "A todos los colaboradores de la red.",
        "encargados-propios": "Solo encargados de locales propios.",
        "encargados-franquicias": "Solo encargados de franquicias.",
        "colaboradores-local": "Elegí a qué locales enviarla.",
        "usuarios-especificos": "Solo a usuarios específicos que selecciones (Admin only).",
        "solo-admin": "No le llega a nadie: solo la ves vos, para probar.",
    };
    const radiosDirigido = DIRIGIDO_A.map((d) => {
        // "usuarios-especificos" y "solo-admin" (prueba personal) solo
        // visibles para Admin — pedido explícito del usuario: Supervisor
        // solo debe ver Colaboradores/Encargados propios/Encargados
        // franquicias/Locales específicos.
        if ((d.id === "usuarios-especificos" || d.id === "solo-admin") && !esAdmin) return "";
        return `
            <label class="radio-card">
                <input type="radio" name="dirigido-a" class="input-dirigido-a" value="${d.id}" ${dirigidoActual === d.id ? "checked" : ""}>
                <span class="radio-card-titulo">${d.nombre}</span>
                <span class="radio-card-desc">${DESC_DIRIGIDO[d.id] || ""}</span>
            </label>
        `;
    }).join("");

    return `
        <div class="form-secciones">

            <div class="form-seccion">
                <div class="form-seccion-head">
                    <span class="form-seccion-ico">${Icon("reportes", { size: 18 })}</span>
                    <h3>1. Información</h3>
                </div>

                <div class="form-cols-2">
                    <div class="form-col">
                        <label for="input-titulo">Título</label>
                        <input type="text" id="input-titulo" placeholder="Ej: Nuevo curso disponible" value="${n.titulo || ""}">

                        <label for="input-mensaje">Descripción</label>
                        <textarea id="input-mensaje" rows="6" placeholder="Contá de qué se trata esta novedad...">${n.resumen || ""}</textarea>
                    </div>

                    <div class="form-col">
                        <label for="input-tipo">Categoría</label>
                        <input type="text" id="input-tipo" list="lista-categorias" placeholder="Escribí una categoría (ej: Novedad)" value="${tipoActual}">
                        <datalist id="lista-categorias">${opcionesCategoria}</datalist>
                        <p class="text-xs text-muted" style="margin-top:6px;margin-bottom:0">Elegí una etiqueta o escribí una nueva. Las nuevas quedan guardadas para reusar.</p>
                        <div class="galeria-pills" style="margin-top:8px;margin-bottom:0">${pillsCategoria}</div>

                        <label for="input-prioridad">Prioridad</label>
                        <select id="input-prioridad">${opcionesPrioridad}</select>
                    </div>
                </div>
            </div>

            <div class="form-seccion">
                <div class="form-seccion-head">
                    <span class="form-seccion-ico">${Icon("compartir", { size: 18 })}</span>
                    <h3>2. ¿A quién va dirigida?</h3>
                </div>
                <p class="form-seccion-sub">La noticia se enviará al público seleccionado. Supervisión siempre recibe copia.</p>

                <div class="radio-cards">${radiosDirigido}</div>

                <div id="wrap-sucursal-notif" class="form-section-collapsible hidden" style="margin-top:14px">
                    <label for="input-sucursal-notif" style="margin-top:0">Seleccionar locales</label>
                    ${MultiSelectSucursales("input-sucursal-notif", n.sucursal ? n.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}
                </div>

                <div id="wrap-usuarios-notif" class="form-section-collapsible hidden" style="margin-top:14px">
                    <label for="input-usuarios-notif" style="margin-top:0">Seleccionar usuarios</label>
                    ${MultiSelectUsuarios("input-usuarios-notif", n.usuariosEspecificos ? n.usuariosEspecificos.split(",").map((id) => id.trim()).filter(Boolean) : [])}
                </div>

                <div class="form-info-box">
                    ${Icon("check", { size: 16 })}
                    <p>Supervisión siempre recibe copia automática de todas las News.</p>
                </div>
            </div>

            <div class="form-seccion">
                <div class="form-seccion-head">
                    <span class="form-seccion-ico">${Icon("calendario", { size: 18 })}</span>
                    <h3>3. Publicación</h3>
                </div>

                <div class="form-info-box">
                    ${Icon("check", { size: 16 })}
                    <p>Se publica de inmediato al guardar.</p>
                </div>
            </div>

            <div class="form-seccion">
                <details open>
                    <summary>
                        <div class="form-seccion-head" style="margin-bottom:0">
                            <span class="form-seccion-ico">${Icon("configuracion", { size: 18 })}</span>
                            <h3>4. Opciones avanzadas <span class="text-xs text-muted" style="font-weight:400">(opcional)</span></h3>
                            <span class="chevron">${Icon("flecha-der", { size: 16 })}</span>
                        </div>
                    </summary>
                    <div style="margin-top:16px">
                        <div class="form-avanzadas-3">
                            <div>
                                <label for="input-enlace" style="margin-top:0">Curso relacionado</label>
                                <select id="input-enlace">
                                    <option value="">Ninguno</option>
                                    ${opcionesCursos}
                                </select>

                                <label class="toggle-switch" style="margin-top:16px">
                                    Fijar como importante
                                    <input type="checkbox" id="input-destacado-news" ${n.destacado ? "checked" : ""}>
                                </label>
                                <p class="text-xs text-muted" style="margin-top:6px;margin-bottom:0">Queda arriba de todo, antes de las demás News, hasta que la desfijes.</p>
                            </div>
                            <div id="container-adjuntos">
                                <label style="display:block;margin-bottom:16px;font-weight:600;color:var(--text)">Enlaces <span class="mod-tooltip" data-tooltip-texto="Si dejás la Etiqueta vacía, se guarda con fecha y hora. El archivo en Drive (privado, solo accede la cuenta del proyecto) también queda ordenado por fecha, así es fácil de ubicar después.">ⓘ</span></label>
                                <div id="lista-adjuntos" style="display:flex;flex-direction:column;gap:14px;margin-bottom:14px">
                                    ${(n.adjuntos && n.adjuntos.length > 0)
                                        ? n.adjuntos.map((a, i) => `
                                            <div class="adjunto-item" style="display:grid;grid-template-columns:2fr 1fr auto;gap:12px;align-items:flex-end;padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--line)">
                                                <div>
                                                    <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">URL</label>
                                                    <input type="text" class="input-adjunto-url" placeholder="https://drive.google.com/..." value="${a.url}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
                                                </div>
                                                <div>
                                                    <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Etiqueta <span class="mod-tooltip" data-tooltip-texto="Así se va a ver el botón para quien reciba la News. Ej: 'Descargar Caballete', 'Table Tents'. Si lo dejás vacío, se arma solo con fecha y hora.">ⓘ</span></label>
                                                    <input type="text" class="input-adjunto-label" placeholder="Ej: Caballetes" value="${a.label}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
                                                </div>
                                                <button type="button" class="btn-eliminar-adjunto" data-index="${i}" style="padding:10px 12px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:16px;font-weight:bold;transition:all .15s">×</button>
                                            </div>
                                        `).join("")
                                        : (n.adjuntoUrl ? `
                                            <div class="adjunto-item" style="display:grid;grid-template-columns:2fr 1fr auto;gap:12px;align-items:flex-end;padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--line)">
                                                <div>
                                                    <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">URL</label>
                                                    <input type="text" class="input-adjunto-url" placeholder="https://drive.google.com/..." value="${n.adjuntoUrl}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
                                                </div>
                                                <div>
                                                    <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Etiqueta <span class="mod-tooltip" data-tooltip-texto="Así se va a ver el botón para quien reciba la News. Ej: 'Descargar Caballete', 'Table Tents'. Si lo dejás vacío, se arma solo con fecha y hora.">ⓘ</span></label>
                                                    <input type="text" class="input-adjunto-label" placeholder="Ej: Caballetes" value="${n.adjuntoLabel || "Ver adjunto"}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
                                                </div>
                                                <button type="button" class="btn-eliminar-adjunto" data-index="0" style="padding:10px 12px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:16px;font-weight:bold;transition:all .15s">×</button>
                                            </div>
                                        ` : "")
                                    }
                                </div>
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                                    <button type="button" id="btn-agregar-adjunto" class="btn btn-secondary" style="padding:12px;font-weight:600">+ Agregar otro enlace</button>
                                    <input type="file" id="input-archivo-adjunto" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.csv,.txt,.zip,.jpg,.jpeg,.png,.gif,.mp4,.webm" style="display:none">
                                    <button type="button" id="btn-subir-archivo" class="btn btn-secondary" style="padding:12px;font-weight:600">📤 Subir archivo</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </details>
            </div>

        </div>
    `;
}

function leerCamposNotificacion() {
    const dirigidoA = document.querySelector(".input-dirigido-a:checked")?.value || "";
    const tipo = document.getElementById("input-tipo").value.trim() || "noticia";
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        resumen: document.getElementById("input-mensaje").value.trim(),
        tipo,
        prioridad: document.getElementById("input-prioridad").value,
        // "Programar publicación" se sacó (pedido explícito del
        // usuario) — sin un trigger de backend que mande el push ni
        // avise cuando se publica sola, quedaba una fecha futura
        // "muda": la noticia aparecía igual ese día, pero nadie se
        // enteraba. Todo se publica al momento, siempre hoy.
        fecha: fechaHoyISO(),
        dirigidoA,
        // Los locales solo importan cuando se eligió ese modo.
        sucursal: dirigidoA === "colaboradores-local" ? document.getElementById("input-sucursal-notif").value.trim() : "",
        // Usuarios específicos: solo cuando se elige esa opción
        usuariosEspecificos: dirigidoA === "usuarios-especificos" ? (document.getElementById("input-usuarios-notif")?.value || "") : "",
        detalle: "", // Eliminado — solo se usa resumen
        enlace: document.getElementById("input-enlace").value,
        destacado: document.getElementById("input-destacado-news")?.checked || false,

        // adjuntos múltiples: lee campos dinámicos
        adjuntos: (() => {
            const adjuntos = [];
            document.querySelectorAll(".adjunto-item").forEach((item) => {
                const url = item.querySelector(".input-adjunto-url")?.value.trim() || "";
                const label = item.querySelector(".input-adjunto-label")?.value.trim() || etiquetaAdjuntoPorDefecto();
                if (url) adjuntos.push({ url, label });
            });
            return adjuntos;
        })(),
    };
}

function filaNotificacion(n, usuario, leida) {
    const info = tipoInfo(n.tipo);
    const prio = prioridadInfo(n.prioridad);
    const esAdmin = usuario.rol === "admin";
    const fijadaPersonal = estaFijadaPersonal(n, usuario.id);
    // Swipe estilo Gmail, bidireccional — cada lado UNA acción, como en
    // la app real (no las dos juntas de un mismo lado):
    //   → deslizar a la DERECHA revela "Leída"/"No leída" (para
    //     cualquiera), panel celeste con ✓, queda pegado al borde
    //     izquierdo mientras se desliza.
    //   → deslizar a la IZQUIERDA revela "Eliminar" (solo Admin — nadie
    //     más puede borrar una News), panel rojo con 🗑, pegado al
    //     borde derecho.
    // Ver bindSwipeNotif() más abajo. .notif-swipe-content es la fila
    // real; los ".notif-swipe-actions-*" quedan ocultos detrás hasta
    // que se desliza en su dirección correspondiente.
    //
    // El pin personal (Icon "pin") es un toggle aparte, de un toque
    // directo — no hace falta deslizar para fijar/desfijar algo que se
    // usa seguido. Vive DENTRO de .notif-swipe-content pero es un
    // <button> real (no anidado dentro de otro <button> — por eso
    // .notif-swipe-content pasó de <button> a <div rol="button">).
    return `
        <div class="notif-swipe-row" data-swipe-id="${n.id}">
            <div class="notif-swipe-actions notif-swipe-actions-izq">
                <button type="button" class="notif-swipe-btn notif-swipe-toggle" data-swipe-toggle-leida="${n.id}">${Icon("check", { size: 18 })}<span>${leida ? "No leída" : "Leída"}</span></button>
            </div>
            ${esAdmin ? `
            <div class="notif-swipe-actions notif-swipe-actions-der">
                <button type="button" class="notif-swipe-btn notif-swipe-delete" data-swipe-eliminar="${n.id}">${Icon("tacho", { size: 18 })}<span>Eliminar</span></button>
            </div>
            ` : ""}
            <div class="notif-item notif-swipe-content${leida ? "" : " no-leida"}" role="button" tabindex="0" data-ver-notif="${n.id}">
                <span class="notif-item-icono" style="background:${prio.color}22;color:${prio.color}">${Icon(info.icono, { size: 18 })}</span>
                <span class="notif-item-body">
                    <span class="notif-item-titulo">${n.destacado ? `<span class="notif-item-fijada" title="Fijada por Administración">${Icon("trofeo", { size: 13 })}</span>` : ""}${n.titulo}${!leida ? '<i class="notif-dot"></i>' : ""}</span>
                </span>
                <button type="button" class="notif-item-pin-btn${fijadaPersonal ? " fijado" : ""}" data-toggle-pin="${n.id}" title="${fijadaPersonal ? "Desfijar" : "Fijar para mí"}" aria-label="${fijadaPersonal ? "Desfijar" : "Fijar para mí"}">${Icon("pin", { size: 16 })}</button>
                <span class="notif-item-fecha">${etiquetaGrupo(n.fecha) === "Hoy" || etiquetaGrupo(n.fecha) === "Ayer" ? etiquetaGrupo(n.fecha) : formatearFecha(n.fecha).split(" de ")[0] + " " + formatearFecha(n.fecha).split(" de ")[1].slice(0, 3)}</span>
            </div>
        </div>
    `;
}

/** Swipe estilo Gmail sobre cada fila de News, bidireccional — cada
 *  lado revela UNA sola acción (no las dos juntas de un mismo lado):
 *  deslizar a la DERECHA revela "Leída"/"No leída" (para cualquiera,
 *  panel a la izquierda); deslizar a la IZQUIERDA revela "Eliminar"
 *  (solo Admin, panel a la derecha — si no hay panel de ese lado,
 *  directamente no se puede arrastrar hacia ahí). Ver .notif-swipe-*
 *  en css/components.css y la estructura armada en filaNotificacion().
 *  Sin librería — seguimiento de touch con transform, para una sola
 *  fila a la vez (nunca hace falta animar más de una).
 *
 *  Los flags _arrastrando/_swipeAbierta viven directo en el elemento
 *  (no en una variable del módulo) para que el handler de
 *  "[data-ver-notif]" — ya registrado antes, en bindNews() — pueda
 *  chequearlos y saber si el click que le llegó fue en realidad el
 *  final de un gesto de swipe, sin competir por el mismo evento con
 *  un segundo listener aparte. */
function bindSwipeNotif() {
    document.querySelectorAll(".notif-swipe-row").forEach((fila) => {
        const contenido = fila.querySelector(".notif-swipe-content");
        const accionesIzq = fila.querySelector(".notif-swipe-actions-izq"); // revelado deslizando a la derecha
        const accionesDer = fila.querySelector(".notif-swipe-actions-der"); // revelado deslizando a la izquierda
        if (!contenido) return;

        let startX = 0;
        let startY = 0;
        let esHorizontal = null;
        contenido._swipeAbierta = false;
        contenido._arrastrando = false;

        const maxDer = () => accionesIzq ? Math.min(accionesIzq.scrollWidth || 90, 160) : 0; // cuánto puede correrse hacia la derecha
        const maxIzq = () => accionesDer ? Math.min(accionesDer.scrollWidth || 90, 160) : 0; // cuánto puede correrse hacia la izquierda

        function cerrar() {
            contenido.style.transform = "";
            contenido._swipeAbierta = false;
        }

        function abrirDer() {
            contenido.style.transform = `translateX(${maxDer()}px)`;
            contenido._swipeAbierta = "der"; // el panel IZQUIERDO quedó a la vista
        }

        function abrirIzq() {
            contenido.style.transform = `translateX(-${maxIzq()}px)`;
            contenido._swipeAbierta = "izq"; // el panel DERECHO quedó a la vista
        }

        // Pointer Events (no Touch Events): una sola API cubre dedo,
        // mouse y trackpad — así el swipe se puede probar arrastrando
        // con el mouse en Mac/desktop, no solo en un celular real.
        let pointerId = null;

        contenido.addEventListener("pointerdown", (e) => {
            if (e.button !== undefined && e.button !== 0) return; // solo click izquierdo / touch / pen
            // Cerrar cualquier otra fila que haya quedado abierta antes
            // de empezar un gesto nuevo — solo una a la vez.
            document.querySelectorAll(".notif-swipe-content").forEach((c) => {
                if (c !== contenido && c._swipeAbierta) { c.style.transform = ""; c._swipeAbierta = false; }
            });
            pointerId = e.pointerId;
            contenido.setPointerCapture(pointerId);
            startX = e.clientX;
            startY = e.clientY;
            esHorizontal = null;
            contenido._arrastrando = false;
        });

        contenido.addEventListener("pointermove", (e) => {
            if (e.pointerId !== pointerId) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (esHorizontal === null) esHorizontal = Math.abs(dx) > Math.abs(dy) + 4;
            if (!esHorizontal) return;
            e.preventDefault(); // el gesto es horizontal — no dejar que la página scrollee vertical mientras tanto (touch) ni seleccionar texto (mouse)
            contenido._arrastrando = true;
            contenido.classList.add("notif-swipe-arrastrando");
            const base = contenido._swipeAbierta === "der" ? maxDer() : contenido._swipeAbierta === "izq" ? -maxIzq() : 0;
            const x = Math.max(-maxIzq(), Math.min(maxDer(), base + dx));
            contenido.style.transform = `translateX(${x}px)`;
        });

        const soltar = (e) => {
            if (e.pointerId !== pointerId) return;
            pointerId = null;
            contenido.classList.remove("notif-swipe-arrastrando");
            if (!esHorizontal) return;
            const actual = new DOMMatrix(getComputedStyle(contenido).transform).m41;
            if (actual > maxDer() / 3 && maxDer() > 0) abrirDer();
            else if (actual < -maxIzq() / 3 && maxIzq() > 0) abrirIzq();
            else cerrar();
            // El click sintético que dispara el navegador tras soltar
            // todavía ve _arrastrando en true en ese instante (el
            // handler de [data-ver-notif] lo chequea) — recién se
            // limpia después, para no reabrir el detalle por el mismo
            // gesto que acaba de abrir/cerrar las acciones.
            setTimeout(() => { contenido._arrastrando = false; }, 50);
        };
        contenido.addEventListener("pointerup", soltar);
        contenido.addEventListener("pointercancel", soltar);
    });

    document.querySelectorAll("[data-swipe-toggle-leida]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const usuario = getUsuarioActual();
            const items = await getNoticias();
            const noti = items.find((n) => String(n.id) === String(btn.dataset.swipeToggleLeida));
            if (!noti) return;
            if (estaLeida(noti, usuario.id)) {
                await marcarNotificacionNoLeida(noti, usuario.id);
            } else {
                await marcarNotificacionLeida(noti, usuario.id);
                decrementarContadorCampana(1);
            }
            navigate("news");
        });
    });

    document.querySelectorAll("[data-swipe-eliminar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta News? No se puede deshacer.")) return;
            await eliminarNoticia(btn.dataset.swipeEliminar);
            navigate("news");
        });
    });

    // Pin personal — toque directo, sin deslizar (a diferencia de las
    // acciones de arriba, esto se usa seguido y no ameritaba un gesto).
    document.querySelectorAll("[data-toggle-pin]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation(); // está dentro de .notif-swipe-content — no abrir el detalle al tocar el pin
            const usuario = getUsuarioActual();
            const items = await getNoticias();
            const noti = items.find((n) => String(n.id) === String(btn.dataset.togglePin));
            if (!noti) return;
            await toggleFijadaPersonal(noti, usuario.id);
            navigate("news");
        });
    });
}

export async function News() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    const puedeCrear = puedeCrearNoticia(usuario);
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

    // Las fijadas van en su propia sección arriba de todo, sin
    // agrupar por fecha (esa es justo la idea de fijar: no perderse
    // entre el resto por antigua que sea) — el resto sigue el
    // agrupado Hoy/Ayer/fecha de siempre.
    // Una News queda en "Fijadas" si Administración la marcó como
    // destacada (global, la ven todos ahí) O si el usuario la fijó
    // para sí mismo (personal, solo él la ve en esa sección).
    function separarFijadas(lista) {
        const esFijada = (n) => n.destacado || estaFijadaPersonal(n, usuario.id);
        return { fijadas: lista.filter(esFijada), resto: lista.filter((n) => !esFijada(n)) };
    }

    const { fijadas: fijadasTodas, resto: restoTodas } = separarFijadas(items);
    const { fijadas: fijadasNoLeidas, resto: restoNoLeidas } = separarFijadas(noLeidas);

    const gruposTodas = agrupar(restoTodas);
    const gruposNoLeidas = agrupar(restoNoLeidas);

    const fijadasHtml = (lista) => lista.length ? `
        <div class="notif-grupo">
            <h4>📌 Fijadas</h4>
            <div class="notif-lista">${lista.map((n) => filaNotificacion(n, usuario, estaLeida(n, usuario.id))).join("")}</div>
        </div>
    ` : "";

    const listaHtml = (grupos, fijadas) => (fijadas.length || grupos.length)
        ? fijadasHtml(fijadas) + grupos.map((g) => `
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
                ${puedeCrear ? `<button class="btn btn-primary" id="btn-nueva-notif">+ Nueva News</button>` : ""}
            </span>
        </div>

        <div class="form-info-box" style="margin-top:14px">
            ${Icon("idea", { size: 16 })}
            <p>Deslizá una noticia hacia un lado para marcarla leída${esAdmin ? " o eliminarla" : ""}. Tocá el pin <span class="notif-item-pin-btn fijado" style="display:inline-flex;width:20px;height:20px;vertical-align:middle;pointer-events:none">${Icon("pin", { size: 11 })}</span> para fijarla en tu lista personal, sin afectar lo que ven los demás.</p>
        </div>

        <div class="section" data-panel="todas">${listaHtml(gruposTodas, fijadasTodas)}</div>
        <div class="section" data-panel="no-leidas" hidden>${listaHtml(gruposNoLeidas, fijadasNoLeidas)}</div>
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
        const abrir = async () => {
            // Si el toque fue en realidad un gesto de deslizar (swipe,
            // ver bindSwipeNotif() más abajo) o la fila ya estaba abierta
            // mostrando sus acciones, ese mismo toque la cierra en vez de
            // abrir el detalle — evita que "cerrar el swipe" y "abrir la
            // notificación" compitan por el mismo click.
            if (btn._arrastrando || btn._swipeAbierta) return;
            const items = await getNoticias();
            const noti = items.find((n) => String(n.id) === String(btn.dataset.verNotif));
            if (noti) abrirDetalleNotificacion(noti, usuario);
        };
        btn.addEventListener("click", abrir);
        // .notif-swipe-content pasó de <button> a <div rol="button"> (un
        // <button> real no puede contener el <button> del pin adentro) —
        // sin esto, Enter/Espacio con teclado dejaban de abrir el detalle.
        btn.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
        });
    });

    bindSwipeNotif();

    const btnMarcarTodas = document.getElementById("btn-marcar-todas");
    if (btnMarcarTodas) {
        btnMarcarTodas.addEventListener("click", async () => {
            if (btnMarcarTodas.disabled) return;
            const textoOriginal = btnMarcarTodas.textContent;
            btnMarcarTodas.disabled = true;
            btnMarcarTodas.textContent = "Marcando...";

            try {
                const items = await getNoticiasVisibles(usuario);
                const noLeidas = items.filter((n) => !estaLeida(n, usuario.id));
                // allSettled, no all — reportado en vivo por el usuario
                // en Android real: "marcar todas no hace nada". Causa:
                // Promise.all aborta TODO apenas UNA de las N escrituras
                // en paralelo falla (timeout, conexión real inestable),
                // sin aviso ni forma de recuperarse. Con allSettled, las
                // que sí funcionaron quedan guardadas y se le avisa a la
                // persona si alguna falló, en vez de silencio total.
                const resultados = await Promise.allSettled(noLeidas.map((n) => marcarNotificacionLeida(n, usuario.id)));
                const fallidas = resultados.filter((r) => r.status === "rejected").length;
                const exitosas = resultados.length - fallidas;

                if (exitosas) decrementarContadorCampana(exitosas);
                if (fallidas) {
                    alert(`Se marcaron ${exitosas} de ${resultados.length} — ${fallidas} no se pudieron guardar. Probá de nuevo en un momento.`);
                }
                navigate("news");
            } catch (err) {
                alert(err.message || "No se pudo marcar todas como leídas. Probá de nuevo.");
                btnMarcarTodas.disabled = false;
                btnMarcarTodas.textContent = textoOriginal;
            }
        });
    }

    // Crear News: Admin + Supervisor (no capacitador). Ver puedeCrearNoticia.
    if (puedeCrearNoticia(usuario)) {
        const btnNueva = document.getElementById("btn-nueva-notif");
        if (btnNueva) btnNueva.addEventListener("click", () => navigate("newsnueva"));
    }

    // Editar/eliminar una News ya publicada: solo Admin (moderación).
    if (usuario.rol !== "admin") return;

    document.querySelectorAll("[data-editar-notif]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            navigate(`newsnueva/${btn.dataset.editarNotif}`);
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
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <span class="notif-item-icono" style="background:${prioridadInfo(noti.prioridad).color}22;color:${prioridadInfo(noti.prioridad).color}">${Icon(info.icono, { size: 18 })}</span>
            <div>
                <div class="text-xs text-muted">${info.nombre} · ${formatearFecha(noti.fecha)}</div>
            </div>
        </div>
        <p class="text-sm" style="margin-top:0;margin-bottom:16px;white-space:pre-wrap;line-height:1.6">${escaparHtml(noti.resumen)}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            ${noti.enlace ? `<a class="btn btn-primary" href="#/cursos/${noti.enlace}">Ir al curso</a>` : ""}
            ${noti.adjuntos?.map(a => `<a class="btn btn-secondary" href="${a.url}">${a.label}</a>`).join("") || (noti.adjuntoUrl ? `<a class="btn btn-secondary" href="${noti.adjuntoUrl}">${noti.adjuntoLabel || "Ver adjunto"}</a>` : "")}
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
        try {
            await marcarNotificacionLeida(noti, usuario.id);
        } catch (err) {
            // Antes esto quedaba en silencio — el try/finally de
            // modal.js reactivaba el botón pero la persona no tenía
            // forma de saber qué pasó (reportado en vivo: "se le
            // tildaba y no podía darle marcado", real network timeout
            // en un celular con señal intermitente, ver services/
            // google.js). Ahora se lo decimos explícito.
            alert(err.message || "No se pudo marcar como leída. Probá de nuevo.");
            return;
        }
        // Ya sabemos que baja en 1 — evita re-pedir "Noticias" solo para
        // confirmar el número (ver dataSource.js: el pedido que sigue,
        // el de la propia lista de News, ya alcanza para eso).
        invalidar("Noticias");
        decrementarContadorCampana();
        cerrarModal(modalId);
        navigate("news");
    });

    // Los botones Editar/Eliminar del detalle reusan el mismo binding
    // que la lista — se conectan acá porque este modal se abre fuera
    // del ciclo de render de la página.
    if (usuario.rol === "admin") {
        document.querySelector(`#${modalId} [data-editar-notif]`)?.addEventListener("click", () => {
            cerrarModal(modalId);
            navigate(`newsnueva/${noti.id}`);
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

/** Push real a quienes puedan ver esta noticia — mismo criterio que
 *  puedeVerNoticia (campana/centro de avisos), así el destinatario del
 *  push es exactamente el mismo público que después la ve en News. No
 *  bloquea la creación si el envío falla (modo demo, red, un token
 *  vencido) — la noticia ya quedó guardada de todas formas, un push
 *  fallido no debería perder el contenido. */
async function mandarPushDeNoticia(noticia, usuarios, sucursales) {
    try {
        const destinatarios = usuarios.filter((u) => puedeVerNoticia(noticia, u, sucursales)).map((u) => u.id);
        if (destinatarios.length) await mandarPush(destinatarios, noticia.titulo, noticia.resumen, "#/news");
    } catch (err) {
        console.warn("No se pudo mandar el push de la noticia:", err.message);
    }
}

/** Página completa "Nueva News" / "Editar News" (fiel a la captura del
 *  usuario) — reemplaza el modal anterior: header con ícono + título,
 *  las 4 secciones en tarjetas, y una barra de acciones abajo. Ruta
 *  #/newsnueva (crear) o #/newsnueva/:id (editar). Solo Admin+Supervisor
 *  (no capacitador) llegan acá — ver puedeCrearNoticia y el gate en el
 *  router/botones. */
export async function NuevaNews(params = []) {
    const usuario = getUsuarioActual();
    if (!puedeCrearNoticia(usuario)) return `<p class="text-sm text-muted" style="padding:24px">No tenés permiso para crear News.</p>`;

    const id = params[0];
    const [cursos, noticias] = await Promise.all([getCursos(), id ? getNoticias() : Promise.resolve([])]);
    const noti = id ? noticias.find((n) => String(n.id) === String(id)) : null;

    return `
        <div class="compose-page-header">
            <span class="compose-ico">${Icon("noticias", { size: 24 })}</span>
            <h1>${noti ? "Editar News" : "Nueva News"}</h1>
            <button type="button" class="compose-ayuda" id="btn-ayuda-news">${Icon("alertas", { size: 16 })} ¿Cómo funciona News?</button>
        </div>

        ${camposNotificacionHtml(noti || {}, cursos, usuario)}

        <div class="compose-footer">
            <button class="btn btn-secondary" id="btn-cancelar-news">Cancelar</button>
            <button class="btn btn-primary" id="btn-publicar-news">${noti ? "Guardar cambios" : "Publicar"}</button>
        </div>
    `;
}

export function bindNuevaNews(params = []) {
    const id = params && params[0];

    bindMultiSelectSucursales("input-sucursal-notif");

    // Pills de categoría — click rellena el input y resalta la elegida.
    const inputTipo = document.getElementById("input-tipo");
    document.querySelectorAll("[data-pill-categoria]").forEach((pill) => {
        pill.addEventListener("click", () => {
            inputTipo.value = pill.dataset.pillCategoria;
            document.querySelectorAll("[data-pill-categoria]").forEach((p) => p.classList.remove("activa"));
            pill.classList.add("activa");
        });
    });
    inputTipo?.addEventListener("input", () => {
        const v = inputTipo.value.trim().toLowerCase();
        document.querySelectorAll("[data-pill-categoria]").forEach((p) => {
            p.classList.toggle("activa", p.dataset.pillCategoria.toLowerCase() === v);
        });
    });
    inputTipo?.addEventListener("blur", () => {
        const v = inputTipo.value.trim();
        if (v && v.toLowerCase() !== "noticia") {
            recordarCategoria(v);
        }
    });
    document.querySelectorAll("[data-borrar-categoria]").forEach((btn) => {
        btn.addEventListener("click", () => {
            olvidarCategoria(btn.dataset.borrarCategoria);
            btn.closest(".pill-categoria-wrap")?.remove();
        });
    });

    // Locales visibles solo con "Locales específicos" — transición suave sin layout shift.
    const wrapSucursal = document.getElementById("wrap-sucursal-notif");
    const wrapUsuarios = document.getElementById("wrap-usuarios-notif");
    function actualizarWrapsSurcursalUsuarios() {
        const dirigido = document.querySelector(".input-dirigido-a:checked")?.value || "";
        if (wrapSucursal) {
            if (dirigido === "colaboradores-local") {
                wrapSucursal.classList.remove("hidden");
            } else {
                wrapSucursal.classList.add("hidden");
            }
        }
        if (wrapUsuarios) {
            if (dirigido === "usuarios-especificos") {
                wrapUsuarios.classList.remove("hidden");
            } else {
                wrapUsuarios.classList.add("hidden");
            }
        }
    }
    document.querySelectorAll(".input-dirigido-a").forEach((r) => r.addEventListener("change", actualizarWrapsSurcursalUsuarios));
    actualizarWrapsSurcursalUsuarios();

    // Bindear multiselect de usuarios
    bindMultiSelectUsuarios("input-usuarios-notif");

    // Adjuntos dinámicos — agregar/eliminar enlaces. Devuelve la fila
    // creada para que el upload de archivo también pueda usarla.
    function agregarFilaAdjunto({ url = "", label = "" } = {}) {
        const lista = document.getElementById("lista-adjuntos");
        const index = lista.querySelectorAll(".adjunto-item").length;
        const nuevoItem = document.createElement("div");
        nuevoItem.className = "adjunto-item";
        nuevoItem.style.cssText = "display:grid;grid-template-columns:2fr 1fr auto;gap:12px;align-items:flex-end;padding:12px;background:var(--card);border-radius:8px;border:1px solid var(--line)";
        nuevoItem.innerHTML = `
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">URL</label>
                <input type="text" class="input-adjunto-url" placeholder="https://drive.google.com/..." value="${escaparHtml(url)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </div>
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Etiqueta <span class="mod-tooltip" data-tooltip-texto="Así se va a ver el botón para quien reciba la News. Ej: 'Descargar Caballete', 'Table Tents'. Si lo dejás vacío, se arma solo con fecha y hora.">ⓘ</span></label>
                <input type="text" class="input-adjunto-label" placeholder="Ej: Caballetes" value="${escaparHtml(label)}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </div>
            <button type="button" class="btn-eliminar-adjunto" data-index="${index}" style="padding:10px 12px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:16px;font-weight:bold;transition:all .15s">×</button>
        `;
        lista.appendChild(nuevoItem);
        nuevoItem.querySelector(".btn-eliminar-adjunto").addEventListener("click", () => {
            nuevoItem.remove();
        });
        return nuevoItem;
    }

    document.getElementById("btn-agregar-adjunto")?.addEventListener("click", () => agregarFilaAdjunto());

    // Subir un archivo (PDF, Excel, Word, imagen…) directo a Drive: el
    // backend lo guarda en Recursos/Tipo/Año/Mes y devuelve el link
    // público, que se carga solo como un enlace más de la noticia. Así
    // no hace falta subirlo a mano a Drive y copiar la URL.
    const inputArchivo = document.getElementById("input-archivo-adjunto");
    const btnSubirArchivo = document.getElementById("btn-subir-archivo");

    btnSubirArchivo?.addEventListener("click", () => inputArchivo?.click());

    inputArchivo?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const textoOriginal = btnSubirArchivo.textContent;
        btnSubirArchivo.disabled = true;
        btnSubirArchivo.textContent = "Subiendo...";

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

            agregarFilaAdjunto({ url: resultado.url, label: file.name });
        } catch (err) {
            alert(err.message || "No se pudo subir el archivo.");
        } finally {
            inputArchivo.value = "";
            btnSubirArchivo.disabled = false;
            btnSubirArchivo.textContent = textoOriginal;
        }
    });

    document.querySelectorAll(".btn-eliminar-adjunto").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.currentTarget.closest(".adjunto-item")?.remove();
        });
    });

    document.getElementById("btn-ayuda-news")?.addEventListener("click", () => {
        alert("News son avisos para tu equipo. Elegí el público, escribí el mensaje y publicá ahora o programá una fecha. Supervisión siempre recibe copia.");
    });

    document.getElementById("btn-cancelar-news")?.addEventListener("click", () => navigate("news"));

    const btnPublicar = document.getElementById("btn-publicar-news");
    btnPublicar?.addEventListener("click", async () => {
        if (btnPublicar.disabled) return;
        const cambios = leerCamposNotificacion();
        if (!cambios.titulo || !cambios.resumen) {
            alert("Completá al menos el título y la descripción.");
            return;
        }
        if (!cambios.fecha) { alert("Elegí una fecha de publicación."); return; }

        const textoOriginal = btnPublicar.textContent;
        btnPublicar.disabled = true;
        btnPublicar.textContent = "Guardando...";

        try {
            recordarCategoria(cambios.tipo);
            const usuario = getUsuarioActual();

            // crearNoticia() se encarga de convertir adjuntos a JSON.
            // actualizarNoticia() no hace ninguna conversión propia (manda
            // "cambios" tal cual a la Sheet) — "destacado" viaja como
            // booleano crudo desde el checkbox, y la Sheet lo necesita
            // como "SI"/"NO" (mismo formato que escribe crearNoticia,
            // que normalizarNoticia espera al leer). Se convierte acá,
            // en un objeto aparte, para no tocar el "cambios" que
            // también usa la rama de creación de abajo (esa sí necesita
            // el booleano crudo — su propio ternario ya lo convierte).
            if (id) {
                await actualizarNoticia(id, { ...cambios, destacado: cambios.destacado ? "SI" : "NO" });
                registrarEvento(usuario.id, "editar_noticia", `Notificación "${cambios.titulo}" editada`);
            } else {
                await crearNoticia(cambios);
                registrarEvento(usuario.id, "crear_noticia", `Notificación creada: ${cambios.titulo}`);
                // Sin await: no bloquea la navegación.
                Promise.all([getUsuarios(), getSucursales()])
                    .then(([usuarios, sucursales]) => mandarPushDeNoticia(cambios, usuarios, sucursales))
                    .catch(() => {});
            }
            actualizarContadorCampana();
            navigate("news");
        } catch (err) {
            alert(err.message || "No se pudo guardar. Probá de nuevo.");
            btnPublicar.disabled = false;
            btnPublicar.textContent = textoOriginal;
        }
    });
}

