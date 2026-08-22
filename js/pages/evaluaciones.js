/* ============================
   Lucciano's Academy
   pages/evaluaciones.js — Banco de preguntas (Admin)

   CRUD sobre data/evaluaciones.js (ya existía la capa de datos,
   solo faltaba la pantalla). El motor de examen para que un
   colaborador lo rinda es Sprint 6 — acá solo se arma el banco.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { getCursos } from "../data/cursos.js";
import { getEvaluaciones, crearPregunta, actualizarPregunta, eliminarPregunta } from "../data/evaluaciones.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { escaparHtml } from "../services/html.js";

/** Los mismos 4 campos tanto para cargar una pregunta nueva como para
 *  editar una existente — antes solo existía "Ver preguntas" (listar +
 *  eliminar), sin forma de corregir una ya cargada sin borrarla y
 *  recrearla. */
function camposPreguntaHtml(p = {}) {
    return `
        <label for="input-pregunta">Pregunta</label>
        <input type="text" id="input-pregunta" placeholder="¿Cuál es la pregunta?" value="${escaparHtml(p.pregunta || "")}">
        <label for="input-opciones">Opciones (separadas por coma)</label>
        <input type="text" id="input-opciones" placeholder="Opción A, Opción B, Opción C" value="${escaparHtml((p.opciones || []).join(", "))}">
        <label for="input-correcta">Índice de la opción correcta (0, 1, 2...)</label>
        <input type="text" id="input-correcta" placeholder="0" value="${p.respuestaCorrecta ?? ""}">
        <label for="input-puntaje">Puntaje</label>
        <input type="text" id="input-puntaje" placeholder="10" value="${p.puntaje || ""}">
    `;
}

function leerCamposPregunta() {
    return {
        pregunta: document.getElementById("input-pregunta").value.trim(),
        opciones: document.getElementById("input-opciones").value.split(",").map((o) => o.trim()).filter(Boolean),
        respuestaCorrecta: Number(document.getElementById("input-correcta").value) || 0,
        puntaje: Number(document.getElementById("input-puntaje").value) || 10,
    };
}

/** null = está todo bien. Mismas 3 validaciones que ya existían para
 *  "Nueva pregunta", reutilizadas acá para que "Editar" no las pierda. */
function validarPregunta({ pregunta, opciones, respuestaCorrecta }) {
    if (!pregunta || !opciones.length) return "Completá la pregunta y sus opciones antes de guardar.";
    if (opciones.length < 2) return "Cargá al menos 2 opciones (separadas por coma) — con una sola no hay nada que elegir.";
    if (respuestaCorrecta < 0 || respuestaCorrecta >= opciones.length) return `El índice de la opción correcta debe estar entre 0 y ${opciones.length - 1} (cargaste ${opciones.length} opciones).`;
    return null;
}

export async function Evaluaciones() {

    const [cursos, preguntas] = await Promise.all([getCursos(), getEvaluaciones()]);

    const columnas = [
        { key: "nombre", label: "Curso" },
        { key: "categoria", label: "Categoría" },
        { key: "preguntasLabel", label: "Preguntas" },
        { key: "acciones", label: "" },
    ];

    const filas = cursos.map((c) => ({
        ...c,
        preguntasLabel: preguntas.filter((p) => String(p.cursoId) === String(c.id)).length,
        acciones: `<button class="btn btn-secondary" data-ver-preguntas="${c.id}">Ver preguntas</button>`,
    }));

    return `
        ${Header("Evaluaciones", "Banco de preguntas por curso")}
        ${Table(columnas, filas)}
    `;
}

export function bindEvaluaciones() {
    document.querySelectorAll("[data-ver-preguntas]").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalPreguntas(btn.dataset.verPreguntas));
    });
}

async function abrirModalPreguntas(cursoId) {

    const todas = await getEvaluaciones();
    const preguntas = todas.filter((p) => String(p.cursoId) === String(cursoId));

    const modalId = "modal-preguntas";

    const listaHtml = preguntas.length
        ? preguntas.map((p) => `
            <div class="list item">
                <span>${escaparHtml(p.pregunta)} <span class="text-muted text-xs">(${p.puntaje} pts)</span></span>
                <span>
                    <button class="btn btn-secondary" data-editar-pregunta="${p.id}">Editar</button>
                    <button class="btn btn-secondary" data-eliminar-pregunta="${p.id}">Eliminar</button>
                </span>
            </div>
        `).join("")
        : `<p class="text-muted text-sm">Este curso todavía no tiene preguntas.</p>`;

    const contenidoHtml = `
        <div class="list">${listaHtml}</div>
        <h3 style="margin-top:20px">Nueva pregunta</h3>
        ${camposPreguntaHtml()}
    `;

    abrirModal(Modal({ id: modalId, titulo: "Preguntas del curso", contenidoHtml, textoConfirmar: "Agregar pregunta" }), modalId, async () => {

        const datos = leerCamposPregunta();
        const error = validarPregunta(datos);
        if (error) { alert(error); return; }

        await crearPregunta({ cursoId, ...datos });
        registrarEvento(getUsuarioActual().id, "crear_pregunta", `Pregunta agregada al curso ${cursoId}`);

        cerrarModal(modalId);
        navigate("evaluaciones");
    });

    document.querySelectorAll("[data-editar-pregunta]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const pregunta = preguntas.find((p) => String(p.id) === String(btn.dataset.editarPregunta));
            if (!pregunta) return;
            // Cierra el modal de la lista antes de abrir el de edición —
            // los dos usan los mismos ids de campo (input-pregunta, etc.),
            // así que tenerlos abiertos a la vez hace que
            // document.getElementById() agarre el formulario equivocado
            // (mismo motivo documentado en academia.js para lecciones).
            cerrarModal(modalId);
            abrirModalEditarPregunta(pregunta, cursoId);
        });
    });

    document.querySelectorAll("[data-eliminar-pregunta]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await eliminarPregunta(btn.dataset.eliminarPregunta);
            registrarEvento(getUsuarioActual().id, "eliminar_pregunta", `Pregunta ${btn.dataset.eliminarPregunta} eliminada`);
            cerrarModal(modalId);
            navigate("evaluaciones");
        });
    });
}

async function abrirModalEditarPregunta(pregunta, cursoId) {
    const modalId = "modal-editar-pregunta";
    const contenidoHtml = camposPreguntaHtml(pregunta);

    abrirModal(Modal({ id: modalId, titulo: "Editar pregunta", contenidoHtml, textoConfirmar: "Guardar cambios" }), modalId, async () => {

        const datos = leerCamposPregunta();
        const error = validarPregunta(datos);
        if (error) { alert(error); return; }

        const r = await actualizarPregunta(pregunta.id, { cursoId, ...datos });
        if (!r || r.ok === false) {
            alert(r?.error || "No se pudo guardar. Probá de nuevo.");
            return;
        }
        registrarEvento(getUsuarioActual().id, "editar_pregunta", `Pregunta ${pregunta.id} editada`);

        cerrarModal(modalId);
        navigate("evaluaciones");
    });
}
