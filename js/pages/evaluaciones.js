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

/**
 * Una fila por opción (A, B, C...) con su propio radio para marcar cuál
 * es la correcta — reemplaza el viejo "opciones separadas por coma" +
 * "índice de la correcta" como número suelto. Pedido explícito del
 * usuario tras un error real cargando contenido: "no separado por
 * comas, puedo cometer un error" — un campo de texto con comas y un
 * índice numérico aparte son dos lugares donde un error de tipeo arma
 * una pregunta con la respuesta correcta mal marcada, sin ningún aviso.
 * Ver skills/evaluaciones-sin-errores para la regla completa.
 */
function letraOpcion(i) {
    return String.fromCharCode(65 + i); // 0→A, 1→B, 2→C...
}

function opcionHtml(i, texto = "", correcta = false) {
    // textarea, no input — una opción larga ("Le hacés una seña y
    // esperás a que se acerque a pedir...") se cortaba invisible en un
    // input de una sola línea. Con textarea entra en el auto-expandir
    // global (services/autoExpandirTextareas.js): crece con lo que se
    // escribe, como cualquier otro cuadro de texto de la app.
    return `
        <div class="opcion-item" style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
            <span class="opcion-letra" style="flex:0 0 28px;height:28px;border-radius:50%;background:var(--gold-soft);color:var(--gold-deep);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;margin-top:2px">${letraOpcion(i)}</span>
            <textarea class="input-opcion-texto" rows="1" placeholder="Texto de la opción ${letraOpcion(i)}" style="flex:1;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;resize:vertical">${escaparHtml(texto)}</textarea>
            <label style="display:flex;align-items:center;gap:6px;flex:0 0 auto;font-size:12px;color:var(--muted);white-space:nowrap;margin:0;margin-top:6px">
                <input type="radio" name="opcion-correcta" class="input-opcion-correcta" style="width:auto" ${correcta ? "checked" : ""}>
                Correcta
            </label>
            <button type="button" class="btn-eliminar-opcion" aria-label="Eliminar esta opción" style="flex:0 0 auto;padding:8px 11px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:15px;font-weight:bold;margin-top:2px">×</button>
        </div>
    `;
}

/** Los mismos campos tanto para cargar una pregunta nueva como para
 *  editar una existente — antes solo existía "Ver preguntas" (listar +
 *  eliminar), sin forma de corregir una ya cargada sin borrarla y
 *  recrearla. Sin p.opciones (pregunta nueva) arranca con 3 filas
 *  vacías (A/B/C), que es el mínimo típico de una pregunta real. */
function camposPreguntaHtml(p = {}) {
    const opciones = p.opciones && p.opciones.length ? p.opciones : ["", "", ""];
    return `
        <label for="input-pregunta">Pregunta</label>
        <textarea id="input-pregunta" rows="1" placeholder="¿Cuál es la pregunta?">${escaparHtml(p.pregunta || "")}</textarea>

        <label style="margin-top:16px">Opciones — marcá cuál es la correcta</label>
        <div id="lista-opciones">${opciones.map((texto, i) => opcionHtml(i, texto, i === p.respuestaCorrecta)).join("")}</div>
        <button type="button" id="btn-agregar-opcion" class="btn btn-secondary">+ Agregar opción</button>

        <label for="input-puntaje" style="margin-top:16px">Puntaje</label>
        <input type="text" id="input-puntaje" placeholder="10" value="${p.puntaje || ""}">
    `;
}

/** Arma/renumera las letras y engancha agregar/eliminar fila — se
 *  llama después de insertar camposPreguntaHtml() en el DOM, tanto en
 *  "Nueva pregunta" como en "Editar". */
function bindCamposPregunta() {
    const lista = document.getElementById("lista-opciones");
    if (!lista) return;

    function reletrar() {
        lista.querySelectorAll(".opcion-item").forEach((item, i) => {
            const letra = item.querySelector(".opcion-letra");
            if (letra) letra.textContent = letraOpcion(i);
            const input = item.querySelector(".input-opcion-texto");
            if (input) input.placeholder = `Texto de la opción ${letraOpcion(i)}`;
        });
    }

    function eliminarOpcion(item) {
        // Nunca menos de 2 — con una sola opción no hay nada que elegir.
        if (lista.children.length > 2) item.remove();
        else {
            item.querySelector(".input-opcion-texto").value = "";
            item.querySelector(".input-opcion-correcta").checked = false;
        }
        reletrar();
    }

    function agregarOpcion() {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = opcionHtml(lista.children.length);
        const item = wrapper.firstElementChild;
        lista.appendChild(item);
        item.querySelector(".btn-eliminar-opcion").addEventListener("click", () => eliminarOpcion(item));
        item.querySelector(".input-opcion-texto").focus();
    }

    lista.querySelectorAll(".opcion-item").forEach((item) => {
        item.querySelector(".btn-eliminar-opcion")?.addEventListener("click", () => eliminarOpcion(item));
    });
    document.getElementById("btn-agregar-opcion")?.addEventListener("click", () => agregarOpcion());
}

function leerCamposPregunta() {
    const filas = Array.from(document.querySelectorAll("#lista-opciones .opcion-item")).map((item) => ({
        texto: item.querySelector(".input-opcion-texto").value.trim(),
        correcta: item.querySelector(".input-opcion-correcta").checked,
    })).filter((f) => f.texto);

    return {
        pregunta: document.getElementById("input-pregunta").value.trim(),
        opciones: filas.map((f) => f.texto),
        respuestaCorrecta: filas.findIndex((f) => f.correcta),
        puntaje: Number(document.getElementById("input-puntaje").value) || 10,
    };
}

/** null = está todo bien. respuestaCorrecta ya viene bien formada desde
 *  leerCamposPregunta (nunca fuera de rango) — la única forma de que
 *  esté mal es que no se haya marcado ningún radio "Correcta". */
function validarPregunta({ pregunta, opciones, respuestaCorrecta }) {
    if (!pregunta) return "Completá la pregunta antes de guardar.";
    if (opciones.length < 2) return "Cargá al menos 2 opciones — con una sola no hay nada que elegir.";
    if (respuestaCorrecta < 0) return "Marcá cuál opción es la correcta (el radio \"Correcta\" de esa fila).";
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

    bindCamposPregunta();

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

    bindCamposPregunta();
}
