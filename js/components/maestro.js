/* ============================
   FARO v4
   components/maestro.js

   El Maestro (foto real del Maestro Heladero, ver assets/img/login/
   maestro.png — es el mismo personaje del video de bienvenida en
   login.js) pasa de aparecer una sola vez a tener presencia
   constante, estilo mascota de Duolingo: un ícono fijo en toda la
   app (MaestroFlotante, con mensaje contextual real, no inventado)
   más burbujas puntuales en Inicio y al terminar un examen
   (MaestroBurbuja, ver inicioColaborador.js/examen.js).
=============================*/

import { Icon } from "./icons.js";
import { getUsuarioActual } from "../services/auth.js";
import { getCursos } from "../data/cursos.js";
import { getAsignacionesPorColaborador } from "../data/asignaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";

const FOTO_MAESTRO = "assets/img/login/maestro.png";

/** Burbuja de mensaje para insertar dentro de una tarjeta ya armada
 *  (logro-spotlight en Inicio, resultado de examen) — solo cara +
 *  texto, sin botón ni popover propio. */
export function MaestroBurbuja(mensaje) {
    return `
        <div class="maestro-burbuja">
            <img class="maestro-avatar" src="${FOTO_MAESTRO}" alt="El Maestro">
            <p>${mensaje}</p>
        </div>
    `;
}

// Mensaje del ícono flotante: se calcula una sola vez por sesión (no
// en cada click ni en cada navegación) y se cachea a nivel módulo —
// mismo criterio que noticiasCache en sidebar.js. Con datos reales
// (asignaciones/resultados), nunca un texto inventado.
let mensajeCache = null;

async function calcularMensaje(usuario) {
    if (usuario.rol === "admin") {
        return "Desde Academia podés armar y revisar todo el contenido de la plataforma.";
    }
    if (usuario.rol === "supervisor") {
        return "Repasá el contenido de la Academia cuando quieras — estoy para ayudarte.";
    }

    const [cursos, asignaciones, resultados] = await Promise.all([
        getCursos(),
        getAsignacionesPorColaborador(usuario.id),
        getResultadosPorColaborador(usuario.id),
    ]);
    const cursoPorId = Object.fromEntries(cursos.map((c) => [String(c.id), c]));

    const sinEvaluacion = asignaciones.find((a) =>
        a.estado === "completado" && !resultados.some((r) => String(r.cursoId) === String(a.cursoId))
    );
    if (sinEvaluacion) {
        return `Te falta rendir el examen de ${cursoPorId[sinEvaluacion.cursoId]?.nombre || "un curso"} — ¡ya casi lo tenés!`;
    }

    const enProgreso = asignaciones.find((a) => a.estado !== "completado");
    if (enProgreso) {
        return `Vas ${enProgreso.progreso}% en ${cursoPorId[enProgreso.cursoId]?.nombre || "tu curso"} — ¡seguí así!`;
    }

    if (!asignaciones.length) {
        return "¿Arrancamos con tu primer curso? Te espero en Academia.";
    }

    return "¡Completaste toda la Academia! Sos un capo.";
}

/** Ícono fijo, presente en cualquier pantalla (se inyecta en
 *  ui.js/renderLayout, junto al resto del chrome global — hamburguesa,
 *  backdrop). Al tocarlo despliega un popover con el mensaje. */
export function MaestroFlotante() {
    return `
        <button class="maestro-flotante" id="btn-maestro" type="button" aria-label="Abrir mensaje del Maestro">
            <img src="${FOTO_MAESTRO}" alt="El Maestro">
        </button>
        <div class="maestro-popover" id="maestro-popover" hidden>
            <button class="maestro-popover-cerrar" id="btn-maestro-cerrar" type="button" aria-label="Cerrar">${Icon("cerrar", { size: 12 })}</button>
            <p id="maestro-popover-texto">Un momento...</p>
        </div>
    `;
}

export function bindMaestro() {
    const btn = document.getElementById("btn-maestro");
    const popover = document.getElementById("maestro-popover");
    const btnCerrar = document.getElementById("btn-maestro-cerrar");
    const texto = document.getElementById("maestro-popover-texto");
    if (!btn || !popover || !texto) return;

    btn.addEventListener("click", async () => {
        const abrir = popover.hidden;
        popover.hidden = !abrir;
        if (!abrir) return;

        if (!mensajeCache) mensajeCache = await calcularMensaje(getUsuarioActual());
        texto.textContent = mensajeCache;
    });

    btnCerrar?.addEventListener("click", () => { popover.hidden = true; });
}
