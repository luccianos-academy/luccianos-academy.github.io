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
    marcarNotificacionLeida, estaLeida, puedeVerNoticia, estaProgramada,
    TIPOS_NOTIFICACION, PRIORIDADES, DIRIGIDO_A,
} from "../data/noticias.js";
import { getCursos } from "../data/cursos.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales } from "../data/sucursales.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { getItem, setItem } from "../services/storage.js";
import { navigate } from "../router.js";
import { actualizarContadorCampana, decrementarContadorCampana } from "../components/topbar.js";
import { mandarPush } from "../services/push.js";

// Categorías de noticia usadas antes — texto libre, pero se recuerdan
// para autocompletar la próxima vez (pedido del usuario: "danos la
// posibilidad de poner a gusto y una vez puesto que aparezca como ya
// usado"). Semilla con las categorías base; se suma cada nueva.
const CLAVE_CATEGORIAS = "categorias_noticia_usadas";
const CATEGORIAS_BASE = ["Curso", "Procedimiento", "Producto", "Capacitación", "Certificados", "Novedad", "Beneficios", "Campaña"];

function categoriasRecordadas() {
    const guardadas = getItem(CLAVE_CATEGORIAS, []);
    const todas = [...CATEGORIAS_BASE, ...(Array.isArray(guardadas) ? guardadas : [])];
    return [...new Set(todas.map((c) => String(c).trim()).filter(Boolean))];
}

function recordarCategoria(categoria) {
    const c = String(categoria || "").trim();
    if (!c) return;
    const guardadas = getItem(CLAVE_CATEGORIAS, []);
    const lista = Array.isArray(guardadas) ? guardadas : [];
    if (!lista.some((x) => x.toLowerCase() === c.toLowerCase()) && !CATEGORIAS_BASE.some((x) => x.toLowerCase() === c.toLowerCase())) {
        setItem(CLAVE_CATEGORIAS, [...lista, c]);
    }
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
    const opcionesPrioridad = PRIORIDADES.map((p) => `<option value="${p.id}"${(n.prioridad || "info") === p.id ? " selected" : ""}>${p.nombre}</option>`).join("");
    const dirigidoActual = n.dirigidoA || "";
    const opcionesCategoria = categoriasRecordadas().map((c) => `<option value="${c}"></option>`).join("");

    // Radios de "A quién va dirigida" — News es solo para
    // colaboradores; Supervisión + Admin siempre reciben copia (no son
    // opción). Ver DIRIGIDO_A en data/noticias.js.
    const radiosDirigido = DIRIGIDO_A.map((d) => `
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:0">
            <input type="radio" name="dirigido-a" class="input-dirigido-a" value="${d.id}" style="width:auto;flex-shrink:0" ${dirigidoActual === d.id ? "checked" : ""}>
            ${d.nombre}
        </label>
    `).join("");

    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Ej: Nuevo curso disponible" value="${n.titulo || ""}">

        <label for="input-mensaje">Descripción</label>
        <textarea id="input-mensaje" rows="3" placeholder="Un par de líneas, con qué encontrar y dónde revisarlo...">${n.resumen || ""}</textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
            <div>
                <label for="input-tipo">Tipo / Categoría</label>
                <input type="text" id="input-tipo" list="lista-categorias" placeholder="Ej: Novedad, Producto..." value="${n.tipo && n.tipo !== "noticia" ? n.tipo : ""}">
                <datalist id="lista-categorias">${opcionesCategoria}</datalist>
            </div>
            <div>
                <label for="input-prioridad">Prioridad</label>
                <select id="input-prioridad">${opcionesPrioridad}</select>
            </div>
        </div>

        <label>¿A quién va dirigida?</label>
        <p class="text-xs text-muted" style="margin-top:0;margin-bottom:6px">Supervisión y Administración siempre reciben copia — no hace falta elegirlos.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:2px">${radiosDirigido}</div>

        <div id="wrap-sucursal-notif" style="margin-top:12px">
            <label for="input-sucursal-notif">Locales específicos</label>
            ${MultiSelectSucursales("input-sucursal-notif", n.sucursal ? n.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}
        </div>

        <label style="margin-top:16px">Publicación</label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:4px">
            <input type="radio" name="cuando-publicar" class="input-cuando" value="ahora" style="width:auto;flex-shrink:0" ${estaProgramada(n) ? "" : "checked"}>
            Publicar ahora
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:4px">
            <input type="radio" name="cuando-publicar" class="input-cuando" value="programar" style="width:auto;flex-shrink:0" ${estaProgramada(n) ? "checked" : ""}>
            Programar para una fecha
        </label>
        <div id="wrap-fecha-notif" style="margin-top:8px${estaProgramada(n) ? "" : ";display:none"}">
            <input type="date" id="input-fecha" value="${n.fecha || fechaHoyISO()}" min="${fechaHoyISO()}">
            <p class="text-xs text-muted" style="margin-top:4px">Se publica sola ese día. Supervisión recibe un aviso cuando se envía.</p>
        </div>

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
    const dirigidoA = document.querySelector(".input-dirigido-a:checked")?.value || "";
    const publicarAhora = document.querySelector(".input-cuando:checked")?.value !== "programar";
    const tipo = document.getElementById("input-tipo").value.trim() || "noticia";
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        resumen: document.getElementById("input-mensaje").value.trim(),
        tipo,
        prioridad: document.getElementById("input-prioridad").value,
        // Publicar ahora = hoy; programar = la fecha elegida.
        fecha: publicarAhora ? fechaHoyISO() : document.getElementById("input-fecha").value,
        dirigidoA,
        // Los locales solo importan cuando se eligió ese modo.
        sucursal: dirigidoA === "colaboradores-local" ? document.getElementById("input-sucursal-notif").value.trim() : "",
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
                ${puedeCrear ? `<button class="btn btn-primary" id="btn-nueva-notif">+ Nueva News</button>` : ""}
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
        if (btnNueva) btnNueva.addEventListener("click", () => abrirModalNotificacion());
    }

    // Editar/eliminar una News ya publicada: solo Admin (moderación).
    if (usuario.rol !== "admin") return;

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

async function abrirModalNotificacion(noti = null) {

    const modalId = "modal-notif";
    const [cursos, usuarios, sucursales] = await Promise.all([getCursos(), getUsuarios(), getSucursales()]);
    const contenidoHtml = camposNotificacionHtml(noti || {}, cursos);

    abrirModal(Modal({ id: modalId, titulo: noti ? `Editar: ${noti.titulo}` : "Nueva News", contenidoHtml, textoConfirmar: noti ? "Guardar" : "Publicar" }), modalId, async () => {

        const cambios = leerCamposNotificacion();
        if (!cambios.titulo || !cambios.fecha) return;

        recordarCategoria(cambios.tipo);
        const programada = estaProgramada(cambios);

        const usuario = getUsuarioActual();
        if (noti) {
            await actualizarNoticia(noti.id, cambios);
            registrarEvento(usuario.id, "editar_noticia", `Notificación "${cambios.titulo}" editada`);
        } else {
            await crearNoticia(cambios);
            registrarEvento(usuario.id, "crear_noticia", `Notificación creada: ${cambios.titulo}`);
            // El push se manda solo si se publica AHORA. Si está
            // programada (fecha futura), el push/aviso a Supervisión
            // tiene que dispararse EN LA FECHA — eso necesita un
            // trigger de tiempo en el backend (Apps Script), todavía no
            // implementado (ver nota al pie del archivo). Sin "await":
            // no bloquea el cierre del modal, ya atrapa sus errores.
            if (!programada) mandarPushDeNoticia(cambios, usuarios, sucursales);
        }

        cerrarModal(modalId);
        actualizarContadorCampana();
        navigate("news");
    });

    bindMultiSelectSucursales("input-sucursal-notif");

    // Mostrar el selector de locales solo cuando el público es
    // "Locales específicos".
    const wrapSucursal = document.getElementById("wrap-sucursal-notif");
    function actualizarWrapSucursal() {
        const dirigido = document.querySelector(".input-dirigido-a:checked")?.value || "";
        if (wrapSucursal) wrapSucursal.style.display = dirigido === "colaboradores-local" ? "" : "none";
    }
    document.querySelectorAll(".input-dirigido-a").forEach((r) => r.addEventListener("change", actualizarWrapSucursal));
    actualizarWrapSucursal();

    // Mostrar el date-picker solo cuando se elige "Programar".
    const wrapFecha = document.getElementById("wrap-fecha-notif");
    function actualizarWrapFecha() {
        const cuando = document.querySelector(".input-cuando:checked")?.value;
        if (wrapFecha) wrapFecha.style.display = cuando === "programar" ? "" : "none";
    }
    document.querySelectorAll(".input-cuando").forEach((r) => r.addEventListener("change", actualizarWrapFecha));
    actualizarWrapFecha();
}

/* ============================================================
   PENDIENTE (backend): envío automático de noticias PROGRAMADAS.

   Hoy una noticia con fecha futura se OCULTA a los destinatarios hasta
   ese día (estaProgramada, data/noticias.js) y aparece sola cuando
   alguien abre la app en/después de la fecha — eso funciona 100% del
   lado cliente. Lo que FALTA y necesita un disparador de tiempo en
   Apps Script (ScriptApp time-driven trigger, corriendo 1x/día):
     1. Mandar el push de la noticia el día que le toca (no al crearla).
     2. Avisar a Supervisión "se envió la noticia programada X".
   Sin ese trigger, la noticia igual se ve en la app el día correcto,
   pero nadie recibe el push automático ni el recordatorio. Pedido
   explícito del usuario, queda anotado para hacerlo con el backend.
============================================================ */
