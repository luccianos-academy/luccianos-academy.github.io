/* ============================
   FARO v4
   pages/academia.js — Gestión de Academia (Admin)

   Gestión de cursos + lecciones. La experiencia de "Academia" para
   Colaborador/Encargado sigue siendo pages/cursos.js (grid de
   CourseCard con progreso) — esta pantalla es la contraparte de
   gestión, ruta separada (#/academia), sin tocar cursos.js.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { getCursos, crearCurso, eliminarCurso } from "../data/cursos.js";
import { getLecciones, getLeccionesPorCurso, crearLeccion, actualizarLeccion, eliminarLeccion } from "../data/lecciones.js";
import { getPreguntasPorCurso, eliminarPregunta } from "../data/evaluaciones.js";
import { getAsignaciones, eliminarAsignacion } from "../data/asignaciones.js";
import { getResultados, eliminarResultado } from "../data/resultados.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";

/** Los mismos campos que ya vive el esquema real de Lecciones (ver
 *  README de apps-script) — antes este formulario solo tenía título y
 *  objetivo, así que crear una lección desde acá dejaba todo el resto
 *  vacío. Reutilizado tanto para "nueva lección" como para "editar". */
function camposLeccionHtml(l = {}) {
    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Título de la lección" value="${l.titulo || ""}">

        <label for="input-objetivo">Objetivo</label>
        <input type="text" id="input-objetivo" placeholder="¿Qué va a aprender el colaborador?" value="${l.objetivo || ""}">

        <label for="input-duracion">Duración (minutos)</label>
        <input type="number" id="input-duracion" min="0" value="${l.duracionMinutos || ""}">

        <label for="input-video">Video (link de Drive)</label>
        <input type="text" id="input-video" placeholder="https://drive.google.com/..." value="${l.video || ""}">

        <label for="input-manual">Manual (link o texto)</label>
        <input type="text" id="input-manual" placeholder="https://... o una nota" value="${l.manual || ""}">

        <label for="input-manualLabel">Texto del botón del manual (opcional)</label>
        <input type="text" id="input-manualLabel" placeholder="Si se deja vacío, dice &quot;Ver manual&quot;" value="${l.manualLabel || ""}">

        <label for="input-imagen">Imagen (link)</label>
        <input type="text" id="input-imagen" placeholder="https://..." value="${l.imagen || ""}">

        <label for="input-procedimiento">Procedimiento</label>
        <textarea id="input-procedimiento" rows="3" placeholder="Paso a paso...">${l.procedimiento || ""}</textarea>

        <label for="input-errores">Errores frecuentes</label>
        <textarea id="input-errores" rows="2" placeholder="Qué se suele hacer mal...">${l.errores || ""}</textarea>

        <label for="input-buenasPracticas">Buenas prácticas</label>
        <textarea id="input-buenasPracticas" rows="2">${l.buenasPracticas || ""}</textarea>

        <label for="input-consejo">Consejo</label>
        <textarea id="input-consejo" rows="2">${l.consejo || ""}</textarea>

        <label for="input-resumen">Resumen</label>
        <textarea id="input-resumen" rows="2">${l.resumen || ""}</textarea>

        <label for="input-estado">Estado</label>
        <select id="input-estado">
            <option value="Activo" ${l.estado !== "Inactivo" ? "selected" : ""}>Activo</option>
            <option value="Inactivo" ${l.estado === "Inactivo" ? "selected" : ""}>Inactivo</option>
        </select>
    `;
}

function leerCamposLeccion() {
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        objetivo: document.getElementById("input-objetivo").value.trim(),
        duracionMinutos: Number(document.getElementById("input-duracion").value) || 0,
        video: document.getElementById("input-video").value.trim(),
        manual: document.getElementById("input-manual").value.trim(),
        manualLabel: document.getElementById("input-manualLabel").value.trim(),
        imagen: document.getElementById("input-imagen").value.trim(),
        procedimiento: document.getElementById("input-procedimiento").value.trim(),
        errores: document.getElementById("input-errores").value.trim(),
        buenasPracticas: document.getElementById("input-buenasPracticas").value.trim(),
        consejo: document.getElementById("input-consejo").value.trim(),
        resumen: document.getElementById("input-resumen").value.trim(),
        estado: document.getElementById("input-estado").value,
    };
}

export async function Academia() {

    const [cursos, lecciones] = await Promise.all([getCursos(), getLecciones()]);

    const columnas = [
        { key: "nombre", label: "Curso" },
        { key: "categoria", label: "Categoría" },
        { key: "obligatorioLabel", label: "Obligatorio" },
        { key: "leccionesLabel", label: "Lecciones" },
        { key: "acciones", label: "" },
    ];

    const filas = cursos.map((c) => ({
        ...c,
        obligatorioLabel: c.obligatorio ? "Sí" : "No",
        leccionesLabel: lecciones.filter((l) => String(l.cursoId) === String(c.id)).length,
        acciones: `
            <a class="btn btn-secondary" href="#/cursos/${c.id}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa</a>
            <button class="btn btn-secondary" data-ver-lecciones="${c.id}">Ver lecciones</button>
            <button class="btn btn-secondary" data-eliminar-curso="${c.id}">Eliminar</button>
        `,
    }));

    return `
        ${Header("Academia", "Cursos y lecciones de la plataforma")}

        <div class="table-toolbar">
            <div></div>
            <button class="btn btn-primary" id="btn-nuevo-curso">+ Nuevo curso</button>
        </div>

        <div id="tabla-cursos">
            ${Table(columnas, filas)}
        </div>
    `;
}

export function bindAcademia() {

    document.querySelectorAll("[data-ver-lecciones]").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalLecciones(btn.dataset.verLecciones));
    });

    document.querySelectorAll("[data-eliminar-curso]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const cursoId = btn.dataset.eliminarCurso;

            // Mismo cuidado que "Eliminar" de un usuario (colaboradores.js):
            // borrar solo la fila de Cursos deja lecciones, preguntas,
            // asignaciones y resultados huérfanos apuntando a un id que
            // ya no existe.
            const [lecciones, preguntas, asignaciones, resultados] = await Promise.all([
                getLeccionesPorCurso(cursoId),
                getPreguntasPorCurso(cursoId),
                getAsignaciones().then((as) => as.filter((a) => String(a.cursoId) === String(cursoId))),
                getResultados().then((rs) => rs.filter((r) => String(r.cursoId) === String(cursoId))),
            ]);

            const partes = [];
            if (lecciones.length) partes.push(`${lecciones.length} lección(es)`);
            if (preguntas.length) partes.push(`${preguntas.length} pregunta(s) de examen`);
            if (asignaciones.length) partes.push(`${asignaciones.length} asignación(es)`);
            if (resultados.length) partes.push(`${resultados.length} resultado(s) de examen de colaboradores`);
            const detalle = partes.length ? ` Se borra también, de forma PERMANENTE: ${partes.join(", ")}.` : "";

            if (!confirm(`¿Eliminar este curso?${detalle} Esta acción no se puede deshacer.`)) return;

            await Promise.all([
                ...lecciones.map((l) => eliminarLeccion(l.id)),
                ...preguntas.map((p) => eliminarPregunta(p.id)),
                ...asignaciones.map((a) => eliminarAsignacion(a.id)),
                ...resultados.map((r) => eliminarResultado(r.id)),
            ]);
            await eliminarCurso(cursoId);
            registrarEvento(getUsuarioActual().id, "eliminar_curso", `Curso ${cursoId} eliminado (con ${lecciones.length} lección(es), ${preguntas.length} pregunta(s), ${asignaciones.length} asignación(es) y ${resultados.length} resultado(s))`);
            navigate("academia");
        });
    });

    const btnNuevo = document.getElementById("btn-nuevo-curso");
    if (btnNuevo) btnNuevo.addEventListener("click", abrirModalNuevoCurso);
}

async function abrirModalNuevoCurso() {

    const modalId = "modal-nuevo-curso";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del curso</label>
        <input type="text" id="input-nombre" placeholder="Ej: Atención al Cliente">

        <label for="input-categoria">Categoría</label>
        <input type="text" id="input-categoria" placeholder="Ej: Servicio">

        <label for="input-obligatorio">
            <input type="checkbox" id="input-obligatorio" style="width:auto;display:inline-block;margin-right:8px">
            Curso obligatorio
        </label>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo curso", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const categoria = document.getElementById("input-categoria").value.trim() || "General";
        const obligatorio = document.getElementById("input-obligatorio").checked;

        if (!nombre) return;

        await crearCurso({ nombre, categoria, obligatorio, orden: 99 });
        registrarEvento(getUsuarioActual().id, "crear_curso", `Curso creado: ${nombre}`);

        cerrarModal(modalId);
        navigate("academia");
    });
}

async function abrirModalLecciones(cursoId) {

    const todasLasLecciones = await getLecciones();
    const lecciones = todasLasLecciones.filter((l) => String(l.cursoId) === String(cursoId));

    const modalId = "modal-lecciones";

    const listaHtml = lecciones.length
        ? lecciones.map((l) => `
            <div class="list item">
                <span>${l.orden}. ${l.titulo}</span>
                <span>
                    <button class="btn btn-secondary" data-editar-leccion="${l.id}">Editar</button>
                    <button class="btn btn-secondary" data-eliminar-leccion="${l.id}">Eliminar</button>
                </span>
            </div>
        `).join("")
        : `<p class="text-muted text-sm">Este curso todavía no tiene lecciones.</p>`;

    const contenidoHtml = `
        <a class="btn btn-secondary" href="#/cursos/${cursoId}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa del curso</a>
        <div class="list" style="margin-top:14px">${listaHtml}</div>
        <h3 style="margin-top:20px">Nueva lección</h3>
        ${camposLeccionHtml()}
    `;

    abrirModal(Modal({ id: modalId, titulo: "Lecciones del curso", contenidoHtml, textoConfirmar: "Agregar lección" }), modalId, async () => {

        const cambios = leerCamposLeccion();
        if (!cambios.titulo) return;

        await crearLeccion({ cursoId, orden: lecciones.length + 1, ...cambios });
        registrarEvento(getUsuarioActual().id, "crear_leccion", `Lección "${cambios.titulo}" agregada`);

        cerrarModal(modalId);
        navigate("academia");
    });

    document.querySelectorAll("[data-editar-leccion]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.editarLeccion));
            if (!leccion) return;
            // Cierra el modal de la lista antes de abrir el de edición —
            // los dos usan los mismos ids de campo (input-titulo, etc.),
            // así que tenerlos abiertos a la vez hace que
            // document.getElementById() agarre el formulario equivocado.
            cerrarModal(modalId);
            abrirModalEditarLeccion(leccion);
        });
    });

    document.querySelectorAll("[data-eliminar-leccion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta lección? Esta acción no se puede deshacer.")) return;
            await eliminarLeccion(btn.dataset.eliminarLeccion);
            registrarEvento(getUsuarioActual().id, "eliminar_leccion", `Lección ${btn.dataset.eliminarLeccion} eliminada`);
            cerrarModal(modalId);
            navigate("academia");
        });
    });
}

async function abrirModalEditarLeccion(leccion) {

    const modalId = "modal-editar-leccion";
    const contenidoHtml = camposLeccionHtml(leccion);

    abrirModal(Modal({ id: modalId, titulo: `Editar: ${leccion.titulo}`, contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {

        const cambios = leerCamposLeccion();
        if (!cambios.titulo) return;

        await actualizarLeccion(leccion.id, cambios);
        registrarEvento(getUsuarioActual().id, "editar_leccion", `Lección "${cambios.titulo}" editada`);

        cerrarModal(modalId);
        navigate("academia");
    });
}
