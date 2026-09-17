/* ============================
   Lucciano's Academy
   pages/entrenamiento.js — Entrenamiento libre (Colaborador)

   Se habilita SOLO después de aprobar el examen real de un curso —
   practicar antes no tiene sentido (el objetivo es reforzar algo que
   ya se sabe, no adelantar el examen real por otra puerta). A
   diferencia de pages/examen.js:
     - Sin límite de tiempo, sin pantalla completa, sin detección de
       "cambió de pestaña" — no hay nada que "hacer trampa" acá.
     - Feedback inmediato por pregunta (correcta/incorrecta al toque),
       no recién al final — es para aprender, no para evaluar.
     - NUNCA escribe en Resultados. Se puede repetir las veces que se
       quiera; nada de esto se guarda ni afecta la nota real.
=============================*/

import { Header } from "../components/header.js";
import { EmptyState } from "../components/emptyState.js";
import { Icon } from "../components/icons.js";
import { getCursos } from "../data/cursos.js";
import { getPreguntasPorCurso } from "../data/evaluaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";
import { getUsuarioActual } from "../services/auth.js";

let preguntasActivas = [];
let idxActual = 0;
let correctasActuales = 0;
let cursoIdActivo = null;

function mezclar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function Entrenamiento(params = []) {
    const cursoId = params && params[0];
    cursoIdActivo = null; // se re-habilita más abajo solo si pasa el gate

    const usuario = getUsuarioActual();
    const [cursos, resultados, preguntas] = await Promise.all([
        getCursos(),
        getResultadosPorColaborador(usuario.id),
        getPreguntasPorCurso(cursoId),
    ]);

    const curso = cursos.find((c) => String(c.id) === String(cursoId));
    if (!curso) {
        return EmptyState({ titulo: "Curso no encontrado", accionLabel: "Volver a Mis cursos", accionHref: "#/cursos" });
    }

    const aprobo = resultados.some((r) => String(r.cursoId) === String(cursoId) && r.aprobado);
    if (!aprobo) {
        return `
            <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver a ${curso.nombre}</a>
            ${Header("Entrenamiento libre", curso.nombre)}
            ${EmptyState({
                titulo: "Todavía no se habilitó",
                detalle: `El entrenamiento libre se habilita después de aprobar el examen real de ${curso.nombre}.`,
                accionLabel: `Ir a ${curso.nombre}`,
                accionHref: `#/cursos/${cursoId}`,
            })}
        `;
    }

    if (!preguntas.length) {
        return `
            <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver a ${curso.nombre}</a>
            ${Header("Entrenamiento libre", curso.nombre)}
            ${EmptyState({ titulo: "Todavía no hay preguntas cargadas", detalle: "Este curso no tiene banco de evaluación por ahora." })}
        `;
    }

    cursoIdActivo = cursoId;
    preguntasActivas = mezclar(preguntas.slice());
    idxActual = 0;
    correctasActuales = 0;

    return `
        <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver a ${curso.nombre}</a>
        ${Header(`Entrenamiento libre · ${curso.nombre}`, `${preguntas.length} preguntas del banco, sin límite de tiempo — practicá las veces que quieras.`)}
        <div id="entrenamiento-contenido"></div>
    `;
}

function renderPreguntaActual() {
    const cont = document.getElementById("entrenamiento-contenido");
    if (!cont) return;

    if (idxActual >= preguntasActivas.length) {
        cont.innerHTML = renderResumen();
        bindResumen();
        return;
    }

    const p = preguntasActivas[idxActual];
    cont.innerHTML = `
        <p class="text-sm text-muted" style="margin-bottom:10px">Pregunta ${idxActual + 1} de ${preguntasActivas.length}</p>
        <div class="examen-pregunta">
            <p class="examen-pregunta-titulo">${p.pregunta}</p>
            <div class="examen-opciones" id="entrenamiento-opciones">
                ${p.opciones.map((op, idx) => `
                    <label class="examen-opcion" data-idx="${idx}">
                        <input type="radio" name="entrenamiento-pregunta" value="${idx}">
                        <span>${op}</span>
                    </label>
                `).join("")}
            </div>
        </div>
    `;
    evitarHoverFantasma("entrenamiento-opciones");
    bindOpciones(p);
}

/** Evita el "hover fantasma": si el mouse queda quieto en el mismo
 *  punto de pantalla entre una pregunta y la siguiente, el navegador
 *  aplica :hover a la opción nueva que cayó justo ahí debajo, aunque
 *  el usuario no la haya tocado — se ve como si ya viniera marcada
 *  en dorado. Apagar pointer-events un instante fuerza al navegador
 *  a re-evaluar el hover recién cuando el mouse se mueva de verdad. */
function evitarHoverFantasma(idContenedor) {
    const el = document.getElementById(idContenedor);
    if (!el) return;
    el.style.pointerEvents = "none";
    requestAnimationFrame(() => { el.style.pointerEvents = ""; });
}

function bindOpciones(pregunta) {
    const opciones = document.querySelectorAll("#entrenamiento-opciones .examen-opcion");
    opciones.forEach((label) => {
        label.addEventListener("click", (e) => {
            e.preventDefault();
            if (label.classList.contains("disabled")) return;

            const elegida = Number(label.dataset.idx);
            opciones.forEach((el) => {
                el.classList.add("disabled");
                const i = Number(el.dataset.idx);
                if (i === pregunta.respuestaCorrecta) el.classList.add("correcta");
                else if (i === elegida) el.classList.add("incorrecta");
            });
            if (elegida === pregunta.respuestaCorrecta) correctasActuales++;

            setTimeout(() => {
                idxActual++;
                renderPreguntaActual();
            }, 900);
        });
    });
}

function renderResumen() {
    const pct = Math.round((correctasActuales / preguntasActivas.length) * 100);
    return `
        <div class="examen-resultado aprobado" style="margin-top:20px">
            <div class="examen-resultado-icono">${Icon("trofeo", { size: 28 })}</div>
            <div>
                <h3>Entrenamiento terminado</h3>
                <p class="text-sm text-muted">${correctasActuales}/${preguntasActivas.length} correctas (${pct}%) — esto no se guarda ni afecta tu nota real.</p>
            </div>
        </div>
        <button class="btn btn-primary" id="btn-entrenar-de-nuevo" style="margin-top:16px">Practicar de nuevo</button>
    `;
}

function bindResumen() {
    document.getElementById("btn-entrenar-de-nuevo")?.addEventListener("click", () => {
        preguntasActivas = mezclar(preguntasActivas.slice());
        idxActual = 0;
        correctasActuales = 0;
        renderPreguntaActual();
    });
}

export function bindEntrenamiento() {
    if (!cursoIdActivo) return; // el gate falló arriba — no hay nada que arrancar
    renderPreguntaActual();
}
