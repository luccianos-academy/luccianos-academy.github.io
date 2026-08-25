/* ============================
   Lucciano's Academy
   pages/misEvaluaciones.js — "Evaluaciones" del Colaborador

   No confundir con pages/evaluaciones.js (banco de preguntas, Admin,
   ruta "evaluaciones") — esta es la vista del propio Colaborador
   sobre sus exámenes: pendientes de rendir, aprobados, para repasar.
   Nace del tab inferior del mockup (Inicio/Aprender/Evaluaciones/
   Perfil) — antes esto vivía diluido dentro de cada curso, sin un
   lugar propio donde ver el panorama completo de un vistazo.

   Reusa el mismo bloque visual .examen-cta que ya usa pages/cursos.js
   dentro del detalle de un curso — mismo lenguaje, ahora agregado por
   colaborador en vez de por curso individual. Sin datos ni tablas
   nuevas: mismo asignaciones+resultados que ya alimentan el Inicio.
=============================*/

import { Header } from "../components/header.js";
import { EmptyState } from "../components/emptyState.js";
import { Icon } from "../components/icons.js";
import { getAsignacionesPorColaborador } from "../data/asignaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";
import { getUsuarioActual } from "../services/auth.js";
import { cursosDeLaPersona } from "../services/alcance.js";

function tarjetaExamen({ curso, estado, nota }) {
    if (estado === "pendiente") {
        return `
            <div class="examen-cta">
                <span class="examen-cta-icono">${Icon("evaluaciones", { size: 22 })}</span>
                <div><h3>${curso.nombre}</h3><p class="text-sm text-muted">Completaste las lecciones — ya podés rendir el examen.</p></div>
                <a class="btn btn-primary" href="#/examen/${curso.id}">Rendir examen</a>
            </div>
        `;
    }
    if (estado === "aprobado") {
        return `
            <div class="examen-cta examen-cta-aprobado">
                <span class="examen-cta-icono">${Icon("trofeo", { size: 22 })}</span>
                <div><h3>${curso.nombre}</h3><p class="text-sm text-muted">Aprobado — Nota: ${nota}/10</p></div>
            </div>
        `;
    }
    return `
        <div class="examen-cta examen-cta-pendiente">
            <span class="examen-cta-icono">${Icon("warning", { size: 22 })}</span>
            <div><h3>${curso.nombre}</h3><p class="text-sm text-muted">No aprobaste tu último intento — Nota: ${nota}/10</p></div>
            <a class="btn btn-primary" href="#/examen/${curso.id}">Volver a intentar</a>
        </div>
    `;
}

export async function MisEvaluaciones() {

    const usuario = getUsuarioActual();
    const [asignaciones, resultados, cursos] = await Promise.all([
        getAsignacionesPorColaborador(usuario.id),
        getResultadosPorColaborador(usuario.id),
        getCursos(),
    ]);

    // Mismo filtro que el resto de la app: "Gestión" (hoy solo
    // "Responsables de Local y Turno") es solo para colaboradores con
    // encargado:true (ver pages/cursos.js, pages/inicioColaborador.js).
    const cursosAplicables = cursosDeLaPersona(cursos, usuario);

    // Un examen solo existe para rendir/revisar una vez el curso está
    // completo (mismo gate que usa el propio curso para mostrar el CTA).
    const items = cursosAplicables
        .filter((c) => asignaciones.some((a) => String(a.cursoId) === String(c.id) && a.estado === "completado"))
        .map((curso) => {
            const resultadosCurso = resultados.filter((r) => String(r.cursoId) === String(curso.id));
            const aprobado = resultadosCurso.find((r) => r.aprobado);
            const ultimoIntento = resultadosCurso[resultadosCurso.length - 1];
            if (aprobado) return { curso, estado: "aprobado", nota: aprobado.nota };
            if (ultimoIntento) return { curso, estado: "no_aprobado", nota: ultimoIntento.nota };
            return { curso, estado: "pendiente" };
        });

    const pendientes = items.filter((i) => i.estado === "pendiente");
    const paraRepasar = items.filter((i) => i.estado === "no_aprobado");
    const aprobadas = items.filter((i) => i.estado === "aprobado");

    return `
        ${Header("Evaluaciones", "Tus exámenes — pendientes, para repasar y aprobados")}

        ${!items.length ? EmptyState({
            titulo: "Todavía no tenés exámenes disponibles",
            detalle: "Completá las lecciones de un curso en Academia para desbloquear su examen.",
            icono: "evaluaciones",
            accionLabel: "Ir a Academia",
            accionHref: "#/cursos",
        }) : ""}

        ${pendientes.length ? `
            <div class="section">
                <h2>Pendientes de rendir</h2>
                <div class="checklist" style="gap:12px">${pendientes.map(tarjetaExamen).join("")}</div>
            </div>
        ` : ""}

        ${paraRepasar.length ? `
            <div class="section">
                <h2>Para repasar</h2>
                <div class="checklist" style="gap:12px">${paraRepasar.map(tarjetaExamen).join("")}</div>
            </div>
        ` : ""}

        ${aprobadas.length ? `
            <div class="section">
                <h2>Aprobadas</h2>
                <div class="checklist" style="gap:12px">${aprobadas.map(tarjetaExamen).join("")}</div>
            </div>
        ` : ""}
    `;
}
