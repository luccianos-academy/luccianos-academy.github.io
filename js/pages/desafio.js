/* ============================
   Lucciano's Academy
   pages/desafio.js — Desafío Diario (Colaborador)

   Quiz de 15 preguntas MEZCLADAS de TODOS los módulos que le
   aplican a la persona (a diferencia de examen.js/entrenamiento.js,
   que trabajan sobre un solo curso) — se habilita recién cuando
   aprobó el examen real de cada uno de esos módulos, y se puede
   jugar una vez por día. El resultado (correctas, tiempo usado,
   puntos) se guarda como una fila nueva en DesafioResultados; el
   ranking mensual (Fase 3) se calcula sumando esas filas, acá no se
   persiste ningún total ni puesto.

   Puntaje: 10 puntos por respuesta correcta. El tiempo usado queda
   guardado como desempate para el ranking (a igual puntaje, gana
   quien lo resolvió más rápido) — decisión ya cerrada con el usuario
   en el prototipo, no una cuenta regresiva "en contra".

   Sin fullscreen ni detección de "cambió de pestaña" como examen.js:
   es un juego con ranking, no una evaluación formal — la fricción de
   examen.js no aplica acá.
=============================*/

import { Header } from "../components/header.js";
import { EmptyState } from "../components/emptyState.js";
import { Icon } from "../components/icons.js";
import { getCursos } from "../data/cursos.js";
import { getEvaluaciones } from "../data/evaluaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";
import { getDesafioResultadosPorColaborador, crearDesafioResultado, yaJugoHoy, hoyISO } from "../data/desafio.js";
import { getUsuarioActual } from "../services/auth.js";
import { cursosDeLaPersona } from "../services/alcance.js";

// Exportada para que pages/inicioColaborador.js pueda mostrar "X/15
// correctas" en la tarjeta de estado sin duplicar el número mágico.
export const CANTIDAD_PREGUNTAS = 15;
const DURACION_SEGUNDOS = 180; // 3 minutos
const PUNTOS_POR_CORRECTA = 10;

const SUBTITULO = "Preguntas mezcladas de todos los módulos, con ranking mensual.";

// Estado del intento en curso — vive en el módulo (no en el DOM),
// mismo criterio que examen.js/entrenamiento.js: el temporizador
// tiene que sobrevivir aunque se re-renderice #desafio-contenido.
let preguntasActivas = [];
let idxActual = 0;
let correctasActuales = 0;
let segundosRestantes = DURACION_SEGUNDOS;
let segundosUsados = 0;
let temporizadorId = null;
let quizActivo = false;
let terminado = false;

function mezclar(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function resetearEstado() {
    if (temporizadorId) clearInterval(temporizadorId);
    temporizadorId = null;
    preguntasActivas = [];
    idxActual = 0;
    correctasActuales = 0;
    segundosRestantes = DURACION_SEGUNDOS;
    segundosUsados = 0;
    quizActivo = false;
    terminado = false;
}

export async function Desafio() {
    resetearEstado();

    const usuario = getUsuarioActual();
    const [todosLosCursos, resultados, todasLasPreguntas] = await Promise.all([
        getCursos(),
        getResultadosPorColaborador(usuario.id),
        getEvaluaciones(),
    ]);

    // Misma fuente de verdad que "Mis cursos" (services/alcance.js):
    // los módulos que le tocan a ESTA persona, ni uno más ni uno
    // menos (país/local, Gestión solo para encargados, etc.)
    const cursosQueAplican = cursosDeLaPersona(todosLosCursos, usuario);
    const faltantes = cursosQueAplican.filter((c) =>
        !resultados.some((r) => String(r.cursoId) === String(c.id) && r.aprobado));

    // Mensaje visible con el progreso faltante, no un bloqueo mudo —
    // pedido explícito: "que los empuja a completar todos los
    // módulos", no una pantalla en blanco sin explicar por qué.
    if (faltantes.length) {
        return `
            ${Header("Desafío diario", SUBTITULO)}
            ${EmptyState({
                titulo: "Todavía no se habilitó",
                detalle: `Para participar del Desafío Diario necesitás aprobar el examen de todos tus módulos. Te ${faltantes.length === 1 ? "falta" : "faltan"}: ${faltantes.map((c) => c.nombre).join(", ")}.`,
                accionLabel: "Ir a Mis cursos",
                accionHref: "#/cursos",
            })}
        `;
    }

    const banco = todasLasPreguntas.filter((p) =>
        cursosQueAplican.some((c) => String(c.id) === String(p.cursoId)));

    if (banco.length < CANTIDAD_PREGUNTAS) {
        return `
            ${Header("Desafío diario", SUBTITULO)}
            ${EmptyState({ titulo: "Todavía no hay preguntas suficientes", detalle: `El banco de evaluación de tus módulos no llega a las ${CANTIDAD_PREGUNTAS} preguntas necesarias por ahora.` })}
        `;
    }

    // Un desafío por día — mismo patrón de gate real que examen.js:
    // esto no es solo "ocultar el botón", la ruta lo vuelve a chequear.
    if (await yaJugoHoy(usuario.id)) {
        const resultadosHoy = await getDesafioResultadosPorColaborador(usuario.id);
        const deHoy = resultadosHoy.find((f) => f.fecha === hoyISO());
        return renderYaJugado(deHoy);
    }

    preguntasActivas = mezclar(banco.slice()).slice(0, CANTIDAD_PREGUNTAS);

    return `
        <div id="desafio-portada">
            ${Header("Desafío diario", SUBTITULO)}
            <div class="examen-reglas">
                <h3>Antes de empezar</h3>
                <ul>
                    <li>${CANTIDAD_PREGUNTAS} preguntas de todos tus módulos, mezcladas al azar.</li>
                    <li>Tenés <strong>3 minutos</strong> en total — se entrega solo al acabarse el tiempo.</li>
                    <li>${PUNTOS_POR_CORRECTA} puntos por cada respuesta correcta. A igual puntaje en el ranking, gana quien lo resolvió más rápido.</li>
                    <li>Un desafío por día — mañana podés volver a jugar.</li>
                </ul>
                <button class="btn btn-primary" id="btn-empezar-desafio">Empezar desafío</button>
            </div>
        </div>
        <div id="desafio-contenido"></div>
    `;
}

function renderYaJugado(resultadoHoy) {
    const correctas = resultadoHoy ? resultadoHoy.correctas : 0;
    const puntos = resultadoHoy ? resultadoHoy.puntos : 0;
    return `
        ${Header("Desafío diario", SUBTITULO)}
        <div class="examen-resultado aprobado" style="margin-top:20px">
            <div class="examen-resultado-icono">${Icon("trofeo", { size: 28 })}</div>
            <div>
                <h3>Ya jugaste hoy</h3>
                <p class="text-sm text-muted">${correctas}/${CANTIDAD_PREGUNTAS} correctas · ${puntos} puntos sumados al ranking del mes.</p>
            </div>
        </div>
        <p class="text-sm text-muted" style="margin-top:12px">Volvé mañana para seguir sumando.</p>
        <a class="btn btn-secondary" style="margin-top:12px" href="#/ranking">Ver ranking del mes</a>
    `;
}

export function bindDesafio() {
    document.getElementById("btn-empezar-desafio")?.addEventListener("click", empezarQuiz);
}

function empezarQuiz() {
    if (!preguntasActivas.length) return; // el gate falló arriba o ya se jugó — no hay nada que arrancar
    document.getElementById("desafio-portada")?.remove();

    quizActivo = true;
    terminado = false;
    idxActual = 0;
    correctasActuales = 0;
    segundosRestantes = DURACION_SEGUNDOS;
    segundosUsados = 0;

    renderPreguntaActual();

    temporizadorId = setInterval(() => {
        segundosRestantes--;
        segundosUsados++;
        actualizarTimer();
        if (segundosRestantes <= 0) {
            clearInterval(temporizadorId);
            terminarQuiz();
        }
    }, 1000);
}

function formatearTiempo(seg) {
    const m = Math.floor(seg / 60).toString().padStart(2, "0");
    const s = (seg % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function actualizarTimer() {
    const el = document.getElementById("desafio-timer");
    if (!el) return;
    el.textContent = formatearTiempo(Math.max(0, segundosRestantes));
    el.classList.toggle("examen-timer-urgente", segundosRestantes <= 15);
}

function renderPreguntaActual() {
    const cont = document.getElementById("desafio-contenido");
    if (!cont) return;

    const p = preguntasActivas[idxActual];
    cont.innerHTML = `
        <div class="examen-barra-superior">
            <span class="examen-timer" id="desafio-timer">${formatearTiempo(segundosRestantes)}</span>
            <span class="text-sm text-muted">Pregunta ${idxActual + 1} de ${preguntasActivas.length}</span>
        </div>
        <div class="examen-pregunta">
            <p class="examen-pregunta-titulo">${p.pregunta}</p>
            <div class="examen-opciones" id="desafio-opciones">
                ${p.opciones.map((op, idx) => `
                    <label class="examen-opcion" data-idx="${idx}">
                        <input type="radio" name="desafio-pregunta" value="${idx}">
                        <span>${op}</span>
                    </label>
                `).join("")}
            </div>
        </div>
    `;
    bindOpciones(p);
}

function bindOpciones(pregunta) {
    const opciones = document.querySelectorAll("#desafio-opciones .examen-opcion");
    opciones.forEach((label) => {
        label.addEventListener("click", (e) => {
            e.preventDefault();
            if (!quizActivo || label.classList.contains("disabled")) return;

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
                if (idxActual >= preguntasActivas.length) terminarQuiz();
                else renderPreguntaActual();
            }, 700);
        });
    });
}

async function terminarQuiz() {
    // Mismo motivo que "entregado" en examen.js: sin este guard, el
    // tick del timer y la respuesta de la última pregunta podrían
    // dispararse casi al mismo tiempo y crear DOS filas para el mismo
    // día.
    if (terminado) return;
    terminado = true;
    quizActivo = false;
    if (temporizadorId) clearInterval(temporizadorId);

    const usuario = getUsuarioActual();
    const puntos = correctasActuales * PUNTOS_POR_CORRECTA;

    try {
        await crearDesafioResultado({
            colaboradorId: usuario.id,
            correctas: correctasActuales,
            tiempoUsado: segundosUsados,
            puntos,
        });
    } catch (err) {
        // Sin este catch, un fallo de red dejaba al colaborador con el
        // quiz ya jugado pero sin resultado guardado y sin forma de
        // reintentar (mismo bug real que ya se corrigió en examen.js).
        terminado = false;
        mostrarErrorGuardado();
        return;
    }

    mostrarResumen(correctasActuales, puntos, segundosUsados);
}

function mostrarErrorGuardado() {
    const cont = document.getElementById("desafio-contenido");
    if (!cont) return;
    cont.innerHTML = `
        <div class="examen-resultado reprobado" style="margin-top:20px">
            <div class="examen-resultado-icono">${Icon("warning", { size: 28 })}</div>
            <div>
                <h3>No se pudo guardar tu resultado</h3>
                <p class="text-sm text-muted">Revisá tu conexión e intentá de nuevo.</p>
            </div>
            <button class="btn btn-primary" id="btn-reintentar-guardado">Reintentar</button>
        </div>
    `;
    document.getElementById("btn-reintentar-guardado")?.addEventListener("click", terminarQuiz);
}

function mostrarResumen(correctas, puntos, tiempoUsado) {
    const cont = document.getElementById("desafio-contenido");
    if (!cont) return;
    cont.innerHTML = `
        <div class="examen-resultado aprobado" style="margin-top:20px">
            <div class="examen-resultado-icono">${Icon("trofeo", { size: 28 })}</div>
            <div>
                <h3>¡Buen desafío!</h3>
                <p class="text-sm text-muted">${correctas}/${preguntasActivas.length} correctas · ${formatearTiempo(tiempoUsado)} · ${puntos} puntos sumados al ranking del mes.</p>
            </div>
        </div>
        <p class="text-sm text-muted" style="margin-top:12px">Volvé mañana para seguir sumando.</p>
        <a class="btn btn-secondary" style="margin-top:12px" href="#/ranking">Ver ranking del mes</a>
    `;
}
