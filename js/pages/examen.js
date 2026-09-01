/* ============================
   Lucciano's Academy
   pages/examen.js — Rendir examen (Colaborador)

   No hay un "examen fijo" en el esquema (Evaluaciones es un banco
   de preguntas por curso, sin agrupación en exámenes) — así que
   cada intento arma uno al azar con 10 preguntas del banco real del
   curso. Nota = correctas/10 en escala 0-10, aprobado desde 6. El
   intento se guarda como una fila nueva en Resultados; el esquema
   no tiene detalle por pregunta, así que la revisión post-examen
   solo vive en memoria de esta pantalla, no se persiste.

   Modo "sin salida": una vez que arranca el examen (botón "Comenzar
   examen", requiere un gesto real del usuario para poder pedir
   pantalla completa), se pide fullscreen sobre #content — eso oculta
   el sidebar entero mientras dura el intento. No hay forma 100%
   confiable de impedir que alguien cambie de pestaña o mire el
   celular desde un navegador (eso lo sabe cualquier plataforma web,
   no solo esta) — lo que sí se puede hacer, y se hace acá, es
   detectar cuando pasa (visibilitychange / salir de fullscreen),
   avisar, contarlo como violación, dejarlo registrado en Auditoría,
   y entregar el examen automáticamente si pasa demasiadas veces o si
   se acaba el tiempo. El botón de "volver" desaparece apenas arranca.
=============================*/

import { Header } from "../components/header.js";
import { EmptyState } from "../components/emptyState.js";
import { Icon } from "../components/icons.js";
import { MaestroBurbuja } from "../components/maestro.js";
import { getCursos } from "../data/cursos.js";
import { getPreguntasPorCurso } from "../data/evaluaciones.js";
import { crearResultado } from "../data/resultados.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";

const CANTIDAD_PREGUNTAS = 30;
const MINIMO_CORRECTAS_APROBACION = 25; // sobre CANTIDAD_PREGUNTAS (25/30)
const SEGUNDOS_POR_PREGUNTA = 20;
const MAX_VIOLACIONES = 3;

/** Mínimo de respuestas correctas para aprobar, escalado si algún
 *  curso tuviera un banco más chico que CANTIDAD_PREGUNTAS (hoy
 *  ninguno lo tiene, pero así no queda hardcodeado a "30"). */
function calcularMinimoCorrectas(totalPreguntas) {
    return Math.round((MINIMO_CORRECTAS_APROBACION / CANTIDAD_PREGUNTAS) * totalPreguntas);
}

// Estado del intento en curso — vive en el módulo (no en el DOM) porque
// el temporizador y los listeners tienen que sobrevivir aunque el
// usuario intente navegar; se resetea cada vez que se entra a la
// pantalla (ver resetearEstado() en Examen()).
let temporizadorId = null;
let segundosRestantes = 0;
let violaciones = 0;
let examenActivo = false;
let entregado = false;
let cursoIdActivo = null;

function elegirAlAzar(lista, cantidad) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, cantidad);
}

function resetearEstado() {
    if (temporizadorId) clearInterval(temporizadorId);
    temporizadorId = null;
    segundosRestantes = 0;
    violaciones = 0;
    examenActivo = false;
    entregado = false;
    cursoIdActivo = null;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    window.removeEventListener("hashchange", onHashChangeDurante);
    window.removeEventListener("beforeunload", onBeforeUnload);
}

export async function Examen(params = []) {

    resetearEstado();

    const cursoId = params && params[0];
    const [cursos, todasLasPreguntas] = await Promise.all([
        getCursos(),
        getPreguntasPorCurso(cursoId),
    ]);

    const curso = cursos.find((c) => String(c.id) === String(cursoId));
    if (!curso) {
        return EmptyState({ titulo: "Curso no encontrado", accionLabel: "Volver a Mis cursos", accionHref: "#/cursos" });
    }

    if (!todasLasPreguntas.length) {
        return `
            <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver a ${curso.nombre}</a>
            ${Header("Examen", curso.nombre)}
            ${EmptyState({ titulo: "Todavía no hay preguntas cargadas", detalle: "Este curso no tiene banco de evaluación por ahora." })}
        `;
    }

    const preguntas = elegirAlAzar(todasLasPreguntas, Math.min(CANTIDAD_PREGUNTAS, todasLasPreguntas.length));
    const idsSeleccionados = preguntas.map((p) => p.id).join(",");
    const minutos = Math.round((preguntas.length * SEGUNDOS_POR_PREGUNTA) / 60);
    const minimoCorrectas = calcularMinimoCorrectas(preguntas.length);
    const textoAprobacion = `${preguntas.length} preguntas · necesitás ${minimoCorrectas}/${preguntas.length} correctas para aprobar`;

    const preguntasHtml = preguntas.map((p, i) => `
        <div class="examen-pregunta">
            <p class="examen-pregunta-titulo">${i + 1}. ${p.pregunta}</p>
            <div class="examen-opciones">
                ${p.opciones.map((op, idx) => `
                    <label class="examen-opcion">
                        <input type="radio" name="pregunta-${p.id}" value="${idx}">
                        <span>${op}</span>
                    </label>
                `).join("")}
            </div>
        </div>
    `).join("");

    return `
        <div id="examen-portada" data-curso-id="${cursoId}">
            <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver a ${curso.nombre}</a>
            ${Header(`Examen · ${curso.nombre}`, textoAprobacion)}
            <div class="examen-reglas">
                <h3>Antes de empezar</h3>
                <ul>
                    <li>Tenés <strong>${minutos} minutos</strong> para las ${preguntas.length} preguntas (se entrega solo al acabarse el tiempo).</li>
                    <li>Una vez que arrancás, no podés salir de esta pantalla ni cambiar de pestaña — el examen se toma en pantalla completa.</li>
                    <li>Si salís o cambiás de pantalla ${MAX_VIOLACIONES} veces, el examen se entrega automáticamente con lo que hayas respondido.</li>
                </ul>
                <button class="btn btn-primary" id="btn-comenzar-examen">Comenzar examen</button>
            </div>
        </div>
        <div id="examen-contenedor" class="oculto">
            <div class="examen-barra-superior">
                <span class="examen-timer" id="examen-timer">--:--</span>
                <span class="text-sm text-muted">${textoAprobacion}</span>
            </div>
            <div id="examen-aviso" class="examen-aviso oculto"></div>
            <form id="form-examen" data-curso-id="${cursoId}" data-pregunta-ids="${idsSeleccionados}">
                ${preguntasHtml}
                <button type="submit" class="btn btn-primary" style="margin-top:6px">Entregar examen</button>
            </form>
        </div>
    `;
}

function formatearTiempo(seg) {
    const m = Math.floor(seg / 60).toString().padStart(2, "0");
    const s = (seg % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function mostrarAviso(texto) {
    const aviso = document.getElementById("examen-aviso");
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.classList.remove("oculto");
}

async function onVisibilityChange() {
    if (!examenActivo || entregado) return;
    if (document.hidden) registrarViolacion("Cambió de pestaña o minimizó la ventana durante el examen.");
}

async function onFullscreenChange() {
    if (!examenActivo || entregado) return;
    if (!document.fullscreenElement) registrarViolacion("Salió de pantalla completa durante el examen.");
}

function onHashChangeDurante() {
    if (!examenActivo || entregado || !cursoIdActivo) return;
    // No se puede cancelar un hashchange ya disparado — lo que sí se
    // puede hacer es "pegar" al usuario de vuelta al examen en curso.
    navigate(`examen/${cursoIdActivo}`);
}

function onBeforeUnload(e) {
    if (!examenActivo || entregado) return;
    e.preventDefault();
    e.returnValue = "";
}

function registrarViolacion(motivo) {
    violaciones++;
    const usuario = getUsuarioActual();
    registrarEvento(usuario.id, "violacion_examen", `${usuario.nombre}: ${motivo} (violación ${violaciones}/${MAX_VIOLACIONES}, curso ${cursoIdActivo})`);

    if (violaciones >= MAX_VIOLACIONES) {
        mostrarAviso(`Entregado automáticamente: ${motivo.toLowerCase()} demasiadas veces.`);
        entregarExamen({ forzado: true, motivoForzado: "abandono repetido de la pantalla del examen" });
        return;
    }
    mostrarAviso(`⚠️ ${motivo} Te quedan ${MAX_VIOLACIONES - violaciones} avisos antes de que se entregue solo.`);
}

export function bindExamen(params = []) {

    const cursoId = params && params[0];
    const btnComenzar = document.getElementById("btn-comenzar-examen");
    if (!btnComenzar) return;

    btnComenzar.addEventListener("click", async () => {
        cursoIdActivo = cursoId;
        examenActivo = true;
        entregado = false;
        violaciones = 0;

        document.getElementById("examen-portada")?.remove();
        const contenedor = document.getElementById("examen-contenedor");
        contenedor?.classList.remove("oculto");

        const totalPreguntas = document.querySelectorAll(".examen-pregunta").length;
        segundosRestantes = totalPreguntas * SEGUNDOS_POR_PREGUNTA;
        actualizarTimer();
        temporizadorId = setInterval(() => {
            segundosRestantes--;
            actualizarTimer();
            if (segundosRestantes <= 0) {
                clearInterval(temporizadorId);
                mostrarAviso("Se acabó el tiempo — entregando el examen con lo que hayas respondido.");
                entregarExamen({ forzado: true, motivoForzado: "se acabó el tiempo" });
            }
        }, 1000);

        try {
            // Fullscreen sobre <html> (no sobre #content): al pedirlo
            // sobre un div interno, el navegador lo aísla del scroll
            // normal del documento y hay que reconstruir el overflow a
            // mano — probado y falla en varios navegadores reales
            // (queda todo el contenido debajo del viewport inalcanzable).
            // Sobre el documento entero el scroll de la página sigue
            // funcionando exactamente igual que fuera de pantalla
            // completa, solo se oculta la barra del navegador.
            await document.documentElement.requestFullscreen?.();
        } catch {
            // Si el navegador bloquea el fullscreen (por ejemplo, en un
            // iframe sandboxeado) seguimos igual con timer + detección
            // de pestaña — no es motivo para trabar el examen.
        }

        document.addEventListener("visibilitychange", onVisibilityChange);
        document.addEventListener("fullscreenchange", onFullscreenChange);
        window.addEventListener("hashchange", onHashChangeDurante);
        window.addEventListener("beforeunload", onBeforeUnload);
    });

    const form = document.getElementById("form-examen");
    if (!form) return;

    form.addEventListener("contextmenu", (e) => e.preventDefault());
    form.addEventListener("copy", (e) => e.preventDefault());

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        entregarExamen({ forzado: false });
    });
}

function actualizarTimer() {
    const el = document.getElementById("examen-timer");
    if (!el) return;
    el.textContent = formatearTiempo(Math.max(0, segundosRestantes));
    el.classList.toggle("examen-timer-urgente", segundosRestantes <= 60);
}

async function entregarExamen({ forzado, motivoForzado }) {

    if (entregado) return;
    const form = document.getElementById("form-examen");
    if (!form) return;

    // "entregado" se marca ACÁ, antes de cualquier await — antes se
    // marcaba recién más abajo, dejando una ventana donde un segundo
    // llamado (doble click en Entregar, o la entrega forzada por
    // timer/visibilitychange disparándose justo en ese momento) pasaba
    // el mismo chequeo de arriba y terminaba creando DOS resultados
    // para el mismo examen. Bug real encontrado en producción: filas
    // de Resultados duplicadas con la misma nota y fecha.
    entregado = true;

    const cursoId = form.dataset.cursoId;
    const idsSeleccionados = form.dataset.preguntaIds.split(",").map(Number);
    const todasLasPreguntas = await getPreguntasPorCurso(cursoId);
    const preguntas = idsSeleccionados
        .map((id) => todasLasPreguntas.find((p) => Number(p.id) === id))
        .filter(Boolean);

    if (!forzado) {
        const faltantes = preguntas.some((p) => !form.querySelector(`input[name="pregunta-${p.id}"]:checked`));
        if (faltantes) {
            entregado = false;
            alert("Respondé todas las preguntas antes de entregar.");
            return;
        }
    }

    examenActivo = false;
    if (temporizadorId) clearInterval(temporizadorId);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    window.removeEventListener("hashchange", onHashChangeDurante);
    window.removeEventListener("beforeunload", onBeforeUnload);

    const usuario = getUsuarioActual();
    let correctas = 0;
    const revision = preguntas.map((p) => {
        const marcada = form.querySelector(`input[name="pregunta-${p.id}"]:checked`);
        const elegida = marcada ? Number(marcada.value) : -1;
        const esCorrecta = elegida === p.respuestaCorrecta;
        if (esCorrecta) correctas++;
        return { pregunta: p.pregunta, opciones: p.opciones, elegida, correcta: p.respuestaCorrecta, esCorrecta };
    });

    const nota = Math.round((correctas / preguntas.length) * 10 * 10) / 10;
    const aprobado = correctas >= calcularMinimoCorrectas(preguntas.length);

    try {
        await crearResultado({ colaboradorId: usuario.id, cursoId, nota, aprobado });
    } catch (err) {
        // Sin este catch, un fallo de red acá dejaba al colaborador
        // mirando la pantalla del examen sin ningún resultado y sin
        // forma de reintentar ("entregado" ya había quedado en true).
        entregado = false;
        alert("No se pudo guardar el resultado del examen. Probá entregarlo de nuevo.");
        return;
    }
    registrarEvento(usuario.id, "rendir_examen", `${usuario.nombre} rindió el examen del curso ${cursoId} (nota ${nota})${motivoForzado ? ` — entrega automática: ${motivoForzado}` : ""}`);

    mostrarResultado(cursoId, nota, aprobado, revision, motivoForzado, correctas, preguntas.length);
}

function mostrarResultado(cursoId, nota, aprobado, revision, motivoForzado, correctas, totalPreguntas) {

    const contenido = document.getElementById("content");
    if (!contenido) return;

    const revisionHtml = revision.map((r) => `
        <div class="examen-review-item${r.esCorrecta ? "" : " incorrecta"}">
            <div class="examen-review-icono">${Icon(r.esCorrecta ? "check" : "warning", { size: 16 })}</div>
            <div>
                <p class="examen-pregunta-titulo">${r.pregunta}</p>
                <p class="text-sm text-muted">Tu respuesta: ${r.elegida === -1 ? "(sin responder)" : r.opciones[r.elegida]}</p>
                ${!r.esCorrecta ? `<p class="text-sm" style="color:var(--success)">Correcta: ${r.opciones[r.correcta]}</p>` : ""}
            </div>
        </div>
    `).join("");

    contenido.innerHTML = `
        <a class="btn btn-secondary" href="#/cursos/${cursoId}">← Volver al curso</a>
        <div class="examen-resultado ${aprobado ? "aprobado" : "reprobado"}" style="margin-top:20px">
            <div class="examen-resultado-icono">${Icon(aprobado ? "trofeo" : "warning", { size: 28 })}</div>
            <div>
                <h2>${aprobado ? "¡Aprobaste el examen!" : "No alcanzaste el puntaje"}</h2>
                <p class="text-sm text-muted">Nota: ${nota}/10 · ${correctas}/${totalPreguntas} correctas ${aprobado ? "" : `(necesitás ${calcularMinimoCorrectas(totalPreguntas)}/${totalPreguntas})`}</p>
                ${motivoForzado ? `<p class="text-xs text-muted">Entrega automática — ${motivoForzado}.</p>` : ""}
            </div>
            ${!aprobado ? `<button class="btn btn-primary" id="btn-reintentar-examen">Volver a intentar</button>` : ""}
        </div>
        ${MaestroBurbuja(aprobado
            ? `¡Felicitaciones! Con ${nota}/10 ya podés sumar este curso a tus logros.`
            : `No pasa nada, ${correctas}/${totalPreguntas} está cerca — repasá las lecciones y volvé a intentar cuando quieras.`)}
        <div class="section examen-review">${revisionHtml}</div>
    `;

    const btnReintentar = document.getElementById("btn-reintentar-examen");
    if (btnReintentar) {
        btnReintentar.addEventListener("click", () => navigate(`examen/${cursoId}`));
    }
}
