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
import { getEvaluaciones, crearPregunta, eliminarPregunta } from "../data/evaluaciones.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";

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
                <span>${p.pregunta} <span class="text-muted text-xs">(${p.puntaje} pts)</span></span>
                <button class="btn btn-secondary" data-eliminar-pregunta="${p.id}">Eliminar</button>
            </div>
        `).join("")
        : `<p class="text-muted text-sm">Este curso todavía no tiene preguntas.</p>`;

    const contenidoHtml = `
        <div class="list">${listaHtml}</div>
        <label for="input-pregunta" style="margin-top:20px">Nueva pregunta</label>
        <input type="text" id="input-pregunta" placeholder="¿Cuál es la pregunta?">
        <label for="input-opciones">Opciones (separadas por coma)</label>
        <input type="text" id="input-opciones" placeholder="Opción A, Opción B, Opción C">
        <label for="input-correcta">Índice de la opción correcta (0, 1, 2...)</label>
        <input type="text" id="input-correcta" placeholder="0">
        <label for="input-puntaje">Puntaje</label>
        <input type="text" id="input-puntaje" placeholder="10">
    `;

    abrirModal(Modal({ id: modalId, titulo: "Preguntas del curso", contenidoHtml, textoConfirmar: "Agregar pregunta" }), modalId, async () => {

        const pregunta = document.getElementById("input-pregunta").value.trim();
        const opciones = document.getElementById("input-opciones").value.split(",").map((o) => o.trim()).filter(Boolean);
        const respuestaCorrecta = Number(document.getElementById("input-correcta").value) || 0;
        const puntaje = Number(document.getElementById("input-puntaje").value) || 10;

        if (!pregunta || !opciones.length) {
            alert("Completá la pregunta y sus opciones antes de agregar.");
            return;
        }
        if (opciones.length < 2) {
            alert("Cargá al menos 2 opciones (separadas por coma) — con una sola no hay nada que elegir.");
            return;
        }
        // Sin este chequeo, un índice fuera de rango (ej: "5" con 3
        // opciones) crea una pregunta imposible de acertar en el examen.
        if (respuestaCorrecta < 0 || respuestaCorrecta >= opciones.length) {
            alert(`El índice de la opción correcta debe estar entre 0 y ${opciones.length - 1} (cargaste ${opciones.length} opciones).`);
            return;
        }

        await crearPregunta({ cursoId, pregunta, opciones, respuestaCorrecta, puntaje });
        registrarEvento(getUsuarioActual().id, "crear_pregunta", `Pregunta agregada al curso ${cursoId}`);

        cerrarModal(modalId);
        navigate("evaluaciones");
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
