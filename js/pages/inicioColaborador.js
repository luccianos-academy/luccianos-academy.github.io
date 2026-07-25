/* ============================
   FARO v4
   pages/inicioColaborador.js — Home del Colaborador

   Rediseño orientado a "seguí formándote": la tarjeta más grande de
   la pantalla es siempre "dónde quedaste", no un resumen frío de
   números. Nivel, antigüedad e insignias son capas de presentación
   derivadas de datos reales (asignaciones/resultados) — no hay
   tablas nuevas ni datos inventados; donde no hay información real
   (una foto, un objetivo explícito) se usa un estado honesto en vez
   de simularlo.

   Si el colaborador es Encargado, se suma al final el panel
   "Mi local" acotado a su sucursal (sin agregar un 4to rol — ver
   services/auth.js).
=============================*/

import { EmptyState } from "../components/emptyState.js";
import { BadgeChip } from "../components/badgeChip.js";
import { CourseCard, temaDeCurso } from "../components/courseCard.js";
import { MaestroBurbuja } from "../components/maestro.js";
import { Icon } from "../components/icons.js";
import { getAsignacionesPorColaborador, getAsignaciones } from "../data/asignaciones.js";
import { getResultadosPorColaborador } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";
import { getLeccionesPorCurso } from "../data/lecciones.js";
import { getColaboradoresPorSucursal } from "../data/usuarios.js";
import { getUsuarioActual } from "../services/auth.js";

// Por cantidad de cursos completados, no por promedio de progreso —
// completar un curso es de un solo sentido (nunca "se descompleta"),
// así que el nivel nunca baja. Si fuera por promedio, asignar un
// curso nuevo (0% de avance) diluye el promedio y el nivel retrocede,
// como si el colaborador hubiera perdido conocimiento por el solo
// hecho de tener más capacitación pendiente.
function nivelPorCursosCompletados(cantidad) {
    if (cantidad >= 5) return "Experto";
    if (cantidad >= 3) return "Avanzado";
    if (cantidad >= 1) return "Intermedio";
    return "Principiante";
}

// "YYYY-MM-DD" (mock) o un ISO completo (Sheets real) — ambos formatos
// se muestran igual, en fecha corta legible.
function formatearFecha(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return String(fecha).slice(0, 10);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function statProgressCard(titulo, valor, pct) {
    const p = Math.max(0, Math.min(100, pct));
    return `
        <div class="card stat-progress-card">
            <h3>${titulo}</h3>
            <span>${valor}</span>
            <div class="stat-progress-bar"><i style="width:${p}%"></i></div>
        </div>
    `;
}

function checklistItem(texto, hecho) {
    return `
        <div class="checklist-item${hecho ? " done" : ""}">
            ${Icon(hecho ? "check" : "candado", { size: 15 })}
            <span>${texto}</span>
        </div>
    `;
}

export async function InicioColaborador() {

    const usuario = getUsuarioActual();
    const [asignaciones, resultados, cursos] = await Promise.all([
        getAsignacionesPorColaborador(usuario.id),
        getResultadosPorColaborador(usuario.id),
        getCursos(),
    ]);

    const cursosPorId = Object.fromEntries(cursos.map((c) => [String(c.id), c]));

    // Categoría "Gestión" (hoy solo "Encargados y Responsables") es
    // solo para colaboradores con encargado:true — mismo filtro que
    // ya usa pages/cursos.js para la lista/gateo. Sin este filtro acá,
    // un colaborador raso veía "8 módulos" en vez de 7 y una tarjeta
    // de un curso al que después no puede entrar.
    const cursosAplicables = cursos.filter((c) => c.categoria !== "Gestión" || usuario.encargado);

    // Mismo criterio que pages/colaboradores.js: % sobre el TOTAL de
    // cursos aplicables, no solo los ya empezados — si no, terminar 1
    // curso de 7 mostraba "100%" en la propia tarjeta "Ruta completada".
    const progresoPromedio = cursosAplicables.length
        ? Math.round(cursosAplicables.reduce((s, c) => {
            const a = asignaciones.find((x) => String(x.cursoId) === String(c.id));
            return s + (a ? a.progreso : 0);
        }, 0) / cursosAplicables.length)
        : 0;
    const cursosCompletados = asignaciones.filter((a) => a.estado === "completado").length;
    const nivel = nivelPorCursosCompletados(cursosCompletados);

    // Usuarios.fechaAlta se completa sola al crear el usuario (ver
    // data/usuarios.js) — es la fecha real de alta. Los usuarios
    // cargados antes de que existiera esa columna quedan con "" acá:
    // para esos (y solo esos) caemos a un proxy honesto, la fecha de
    // su primera asignación, en vez de no mostrar nada.
    const fechaMasVieja = usuario.fechaAlta || (asignaciones.length
        ? asignaciones.map((a) => a.fechaAlta).sort()[0]
        : null);

    const completadas = asignaciones.filter((a) => a.estado === "completado").length;
    const evaluacionesPct = resultados.length
        ? Math.round((resultados.filter((r) => r.aprobado).length / resultados.length) * 100)
        : null;

    // "Continúa donde quedaste": la asignación en curso más recientemente
    // iniciada (no hay tracking de "última visita" en el esquema).
    const enProgreso = asignaciones
        .filter((a) => a.estado !== "completado")
        .sort((a, b) => new Date(b.fechaAlta) - new Date(a.fechaAlta));
    const continuar = enProgreso[0] || null;

    let cursoContinuar = null;
    let leccionActual = null;
    if (continuar) {
        cursoContinuar = cursosPorId[continuar.cursoId];
        const lecciones = await getLeccionesPorCurso(continuar.cursoId);
        if (lecciones.length) {
            const idx = Math.min(lecciones.length - 1, Math.floor((continuar.progreso / 100) * lecciones.length));
            leccionActual = lecciones[idx];
        }
    }

    const completoCurso = (nombre) => {
        const curso = cursos.find((c) => c.nombre === nombre);
        if (!curso) return false;
        return asignaciones.some((a) => String(a.cursoId) === String(curso.id) && a.estado === "completado");
    };

    const logros = [
        { icono: "trofeo", titulo: "Primer examen aprobado", ok: resultados.some((r) => r.aprobado) },
        { icono: "cafe", titulo: "Especialista en Café", ok: completoCurso("Cafetería") },
        { icono: "helado", titulo: "Maestro Heladero", ok: completoCurso("Heladería") },
        { icono: "corazon", titulo: "Estrella en Atención al Cliente", ok: completoCurso("Atención al Cliente") },
    ];
    const insigniaPrincipal = logros.find((l) => l.ok) || null;
    const proximaInsignia = logros.find((l) => !l.ok) || null;

    const cursoSinEvaluacion = asignaciones.find((a) =>
        a.estado === "completado" && !resultados.some((r) => String(r.cursoId) === String(a.cursoId))
    );
    const cursoSinComenzar = cursosAplicables.find((c) => !asignaciones.some((a) => String(a.cursoId) === String(c.id)));

    const desafios = [];
    if (completadas > 0) {
        const ultimoCompletado = cursosPorId[asignaciones.find((a) => a.estado === "completado")?.cursoId];
        if (ultimoCompletado) desafios.push({ texto: `Completaste ${ultimoCompletado.nombre}`, hecho: true });
    }
    if (cursoContinuar) desafios.push({ texto: `Terminar ${cursoContinuar.nombre}`, hecho: false });
    if (cursoSinEvaluacion) desafios.push({ texto: `Rendir la evaluación de ${cursosPorId[cursoSinEvaluacion.cursoId]?.nombre}`, hecho: false });
    if (proximaInsignia) desafios.push({ texto: `Conseguir la insignia "${proximaInsignia.titulo}"`, hecho: false });
    if (cursoSinComenzar) desafios.push({ texto: `Empezar ${cursoSinComenzar.nombre}`, hecho: false });

    const resultadosOrdenados = resultados.slice().sort((a, b) => new Date(b.fechaFinalizacion) - new Date(a.fechaFinalizacion));
    const ultimaEval = resultadosOrdenados[0] || null;
    const promedioHistorico = resultados.length
        ? Math.round((resultados.reduce((s, r) => s + r.nota, 0) / resultados.length) * 10) / 10
        : null;

    // Misma tarjeta que "Mis cursos" (foto real del módulo + barra de
    // progreso) en vez de la mini-tarjeta de solo ícono que había acá
    // antes — así el home no se siente más simple que el resto de la
    // app justo después del login.
    const academiaGrid = cursosAplicables.map((c) => {
        const asignacion = asignaciones.find((a) => String(a.cursoId) === String(c.id));
        const pct = asignacion ? asignacion.progreso : null;
        return CourseCard({ nombre: c.nombre, progreso: pct, href: `#/cursos/${c.id}` });
    }).join("");

    let miLocal = "";
    if (usuario.encargado) {
        const equipo = await getColaboradoresPorSucursal(usuario.sucursal);
        const equipoIds = equipo.map((c) => String(c.id));
        const todasAsignaciones = await getAsignaciones();
        const asignacionesEquipo = todasAsignaciones.filter((a) => equipoIds.includes(String(a.colaboradorId)));
        const promedioEquipo = asignacionesEquipo.length
            ? Math.round(asignacionesEquipo.reduce((s, a) => s + a.progreso, 0) / asignacionesEquipo.length)
            : null;
        miLocal = `
            <div class="section card">
                <h3>Mi local</h3>
                <p class="text-sm text-muted" style="margin-top:6px">${usuario.sucursal}</p>
                <div class="stats">
                    <div class="stat"><b>${equipo.length}</b><span>Colaboradores en mi equipo</span></div>
                    <div class="stat"><b>${promedioEquipo === null ? "—" : promedioEquipo + "%"}</b><span>Promedio del equipo</span></div>
                </div>
                <a class="btn btn-primary" style="margin-top:16px" href="#/colaboradores">Ver mi local →</a>
            </div>
        `;
    }

    // Camino real: cuántos de los módulos totales ya completó — no
    // etapas con nombre inventadas (Bienvenida/Fundamentos/Experto...)
    // que no existen en el esquema, sólo la cuenta real.
    const caminoPips = cursosAplicables.map((_, i) =>
        `<div class="camino-pip${i < cursosCompletados ? " on" : ""}"></div>`
    ).join("");

    const temaProtagonista = cursoContinuar ? temaDeCurso(cursoContinuar.nombre) : null;
    const protagonistaImg = temaProtagonista?.foto
        ? `<div class="protagonista-img" style="background-image:url('${temaProtagonista.foto}')"></div>`
        : `<div class="protagonista-img protagonista-img-generico">${Icon(temaProtagonista?.icono || "academia", { size: 40 })}</div>`;

    return `
        <div class="colaborador-home">

        <div class="hero-lobby">
            <div class="hero-lobby-eyebrow">Lucciano's Academy</div>
            <h1>Bienvenido/a, ${usuario.nombre.split(" ")[0]}.</h1>
            <p class="hero-lobby-sub">${nivel} · ${usuario.sucursal || "Sin sucursal asignada"}${fechaMasVieja ? ` · En Lucciano's Academy desde ${formatearFecha(fechaMasVieja)}` : ""}</p>
            <a class="hero-lobby-cta" href="#/cursos${continuar ? "/" + continuar.cursoId : ""}">
                <div>
                    ${cursoContinuar ? `Retomar ${cursoContinuar.nombre}` : "Empezá tu formación"}
                    ${leccionActual ? `<small>${leccionActual.titulo}</small>` : ""}
                </div>
                <span class="hero-lobby-cta-arrow">→</span>
            </a>
            <div class="hero-lobby-camino">
                <span>Tu camino en la Academia — ${cursosCompletados} de ${cursosAplicables.length} módulos completados</span>
                <div class="camino-pips">${caminoPips}</div>
            </div>
        </div>

        <div class="section">
            <h2>Continuá donde quedaste</h2>
            ${continuar && cursoContinuar ? `
                <div class="protagonista">
                    ${protagonistaImg}
                    <div class="protagonista-body">
                        <div class="protagonista-tag">${cursoContinuar.nombre.toUpperCase()}</div>
                        <h3>${leccionActual ? leccionActual.titulo : "Seguí con este curso"}</h3>
                        <div class="stat-progress-bar wide"><i style="width:${continuar.progreso}%"></i></div>
                        <span class="text-sm text-muted">${continuar.progreso}% completado</span>
                        <a class="btn btn-primary btn-continue" href="#/cursos/${continuar.cursoId}">Continuar →</a>
                    </div>
                </div>
            ` : EmptyState({
                titulo: "¡Estás al día!",
                detalle: "No tenés cursos en progreso ahora mismo — mirá Academia para empezar uno nuevo.",
                icono: "academia",
                accionLabel: "Ver Academia",
                accionHref: "#/cursos",
            })}
        </div>

        <div class="section">
            <div class="logro-spotlight">
                <div class="logro-medalla">${Icon(insigniaPrincipal ? insigniaPrincipal.icono : (proximaInsignia?.icono || "trofeo"), { size: 26 })}</div>
                <div>
                    <span class="logro-spotlight-eyebrow">${insigniaPrincipal ? "Logro del día" : "Próximo objetivo"}</span>
                    <h3>${insigniaPrincipal ? insigniaPrincipal.titulo : (proximaInsignia?.titulo || "Seguí sumando insignias")}</h3>
                    <p>${insigniaPrincipal ? "¡Ya la conseguiste!" : "Todavía no la conseguiste — seguí capacitándote."}</p>
                </div>
            </div>
            ${MaestroBurbuja(insigniaPrincipal
                ? `¡Bien ahí, ${usuario.nombre.split(" ")[0]}! Con "${insigniaPrincipal.titulo}" ya sumaste una insignia.`
                : proximaInsignia
                    ? `Te falta "${proximaInsignia.titulo}" — seguí así y la conseguís pronto.`
                    : "Empezá un curso y vas a ir sumando insignias acá.")}
        </div>

        <div class="section">
            <h2>Tu progreso</h2>
            <div class="cards">
                ${statProgressCard("Capacitaciones", `${completadas}/${cursosAplicables.length}`, cursosAplicables.length ? (completadas / cursosAplicables.length) * 100 : 0)}
                ${statProgressCard("Evaluaciones aprobadas", evaluacionesPct !== null ? `${evaluacionesPct}%` : "—", evaluacionesPct ?? 0)}
                ${statProgressCard("Ruta completada", `${progresoPromedio}%`, progresoPromedio)}
            </div>
        </div>

        <div class="section grid-2-1">
            <div>
                <h2>Próximos desafíos</h2>
                <div class="checklist">
                    ${desafios.length ? desafios.map((d) => checklistItem(d.texto, d.hecho)).join("") : `<p class="text-muted text-sm">Sin desafíos pendientes por ahora.</p>`}
                </div>
            </div>
            <div>
                <h2>Tu evolución</h2>
                ${ultimaEval ? `
                    <div class="card rank-compare">
                        <div class="rank-compare-item"><span class="text-xs text-muted">Última evaluación</span><strong>${ultimaEval.nota}</strong></div>
                        <div class="rank-vs">vs</div>
                        <div class="rank-compare-item"><span class="text-xs text-muted">Tu promedio histórico</span><strong>${promedioHistorico}</strong></div>
                    </div>
                ` : EmptyState({ titulo: "Todavía no rendiste evaluaciones", detalle: "Cuando rindas tu primera, vas a poder comparar tu progreso acá." })}
            </div>
        </div>

        <div class="section">
            <h2>Academia</h2>
            <div class="cards">${academiaGrid}</div>
        </div>

        <div class="section">
            <h2>Todos tus logros</h2>
            <div class="badge-row">
                ${logros.map((l) => BadgeChip({ icono: l.icono, titulo: l.titulo, desbloqueado: l.ok })).join("")}
            </div>
        </div>

        <div class="frase-institucional">
            <span class="frase-institucional-script">La excelencia se aprende todos los días.</span>
            <small>Lucciano's Academy</small>
        </div>

        ${miLocal}
        </div>
    `;
}
