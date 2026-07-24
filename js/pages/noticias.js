/* ============================
   FARO v4
   pages/noticias.js — Noticias

   Colaborador/Supervisor/Encargado ven el feed de noticias, sin
   edición. Admin ve, además, un panel de gestión (crear/editar/
   eliminar) sobre la misma pantalla — mismo criterio dual que
   pages/colaboradores.js, no una ruta de administración aparte.
   Abierta a cualquier usuario autenticado (no tiene entrada en
   PERMISOS_PAGINA), la edición queda gateada acá adentro por rol.
=============================*/

import { Header } from "../components/header.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { renderProcedimiento } from "../components/procedimiento.js";
import { getNoticias, crearNoticia, actualizarNoticia, eliminarNoticia } from "../data/noticias.js";
import { getCursos } from "../data/cursos.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";

// "YYYY-MM-DD" es una fecha sin hora — leerla con new Date(str) y
// toLocaleDateString() la corre un día en zonas detrás de UTC (ej.
// Argentina). Armar la fecha en hora local evita ese desfasaje
// (mismo criterio que ya usan alertas.js/colaboradores.js).
function formatearFecha(fecha) {
    const [y, m, d] = String(fecha).split("-").map(Number);
    if (!y || !m || !d) return fecha;
    return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function camposNoticiaHtml(n = {}, cursos = []) {
    const opcionesCursos = cursos.map((c) => `<option value="${c.id}"${String(n.enlace) === String(c.id) ? " selected" : ""}>${c.nombre}</option>`).join("");
    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Ej: Lanzamiento: Tableta Dubai Pistacchio" value="${n.titulo || ""}">

        <label for="input-fecha">Fecha</label>
        <input type="date" id="input-fecha" value="${n.fecha || fechaHoyISO()}">

        <label for="input-resumen">Resumen</label>
        <textarea id="input-resumen" rows="3" placeholder="Un par de líneas, con qué encontrar y dónde revisarlo...">${n.resumen || ""}</textarea>

        <label for="input-detalle">Detalle (opcional)</label>
        <textarea id="input-detalle" rows="4" placeholder="Solo si hay información extensa para desplegar — ej. qué productos cambian. Si se deja vacío, no se muestra nada extra.">${n.detalle || ""}</textarea>

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

function leerCamposNoticia() {
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        fecha: document.getElementById("input-fecha").value,
        resumen: document.getElementById("input-resumen").value.trim(),
        detalle: document.getElementById("input-detalle").value.trim(),
        enlace: document.getElementById("input-enlace").value,
        adjuntoUrl: document.getElementById("input-adjunto-url").value.trim(),
        adjuntoLabel: document.getElementById("input-adjunto-label").value.trim(),
    };
}

export async function Noticias() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    const [items, cursos] = await Promise.all([getNoticias(), getCursos()]);
    const cursoPorId = Object.fromEntries(cursos.map((c) => [String(c.id), c]));

    const itemsHtml = items.map((n) => {
        const curso = n.enlace && cursoPorId[String(n.enlace)];
        return `
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                <div class="small text-muted">${formatearFecha(n.fecha)}</div>
                ${esAdmin ? `
                    <span style="display:flex;gap:8px;flex-shrink:0">
                        <button class="btn btn-secondary" data-editar-noticia="${n.id}">Editar</button>
                        <button class="btn btn-secondary" data-eliminar-noticia="${n.id}">Eliminar</button>
                    </span>
                ` : ""}
            </div>
            <h3 style="margin-top:4px">${n.titulo}</h3>
            <p class="text-sm" style="margin-top:8px;color:var(--text)">${n.resumen}</p>
            ${n.detalle ? `
                <details class="noticia-detalle">
                    <summary>Ver más</summary>
                    ${renderProcedimiento(n.detalle)}
                </details>
            ` : ""}
            <span style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
                ${curso ? `<a class="btn btn-secondary" href="#/cursos/${curso.id}">Ir a ${curso.nombre}</a>` : ""}
                ${n.adjuntoUrl ? `<a class="btn btn-secondary" href="${n.adjuntoUrl}">${n.adjuntoLabel || "Ver adjunto"}</a>` : ""}
            </span>
        </div>
    `;
    }).join("");

    return `
        ${Header("Noticias", "Lo último de Lucciano's y de la Academia")}

        ${esAdmin ? `
            <div class="table-toolbar">
                <div></div>
                <button class="btn btn-primary" id="btn-nueva-noticia">+ Nueva noticia</button>
            </div>
        ` : ""}

        <div class="section" style="display:flex;flex-direction:column;gap:14px">
            ${itemsHtml || `<p class="text-sm text-muted">Todavía no hay noticias cargadas.</p>`}
        </div>
    `;
}

export function bindNoticias() {

    const usuario = getUsuarioActual();
    if (usuario.rol !== "admin") return;

    const btnNueva = document.getElementById("btn-nueva-noticia");
    if (btnNueva) btnNueva.addEventListener("click", () => abrirModalNoticia());

    document.querySelectorAll("[data-editar-noticia]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const items = await getNoticias();
            const noticia = items.find((n) => String(n.id) === String(btn.dataset.editarNoticia));
            if (noticia) abrirModalNoticia(noticia);
        });
    });

    document.querySelectorAll("[data-eliminar-noticia]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta noticia?")) return;
            await eliminarNoticia(btn.dataset.eliminarNoticia);
            registrarEvento(usuario.id, "eliminar_noticia", `Noticia ${btn.dataset.eliminarNoticia} eliminada`);
            navigate("noticias");
        });
    });
}

async function abrirModalNoticia(noticia = null) {

    const modalId = "modal-noticia";
    const cursos = await getCursos();
    const contenidoHtml = camposNoticiaHtml(noticia || {}, cursos);

    abrirModal(Modal({ id: modalId, titulo: noticia ? `Editar: ${noticia.titulo}` : "Nueva noticia", contenidoHtml, textoConfirmar: noticia ? "Guardar" : "Crear" }), modalId, async () => {

        const cambios = leerCamposNoticia();
        if (!cambios.titulo || !cambios.fecha) return;

        const usuario = getUsuarioActual();
        if (noticia) {
            await actualizarNoticia(noticia.id, cambios);
            registrarEvento(usuario.id, "editar_noticia", `Noticia "${cambios.titulo}" editada`);
        } else {
            await crearNoticia(cambios);
            registrarEvento(usuario.id, "crear_noticia", `Noticia creada: ${cambios.titulo}`);
        }

        cerrarModal(modalId);
        navigate("noticias");
    });
}
