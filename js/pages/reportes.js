/* ============================
   Lucciano's Academy
   pages/reportes.js — Centro de Reportes (Admin)

   Selector de tipo de reporte + vista previa con datos reales.
   El botón "Exportar" queda visible pero deshabilitado: generar
   el archivo (PDF/Excel) es explícitamente una etapa posterior,
   no de este incremento ("preparados para exportar posteriormente").

   Los helpers de agregación (ranking de locales/supervisores) se
   duplican acá desde pages/dashboardEjecutivo.js a propósito — ver
   nota en ese archivo.

   `tablaMatrizSemaforo`/`resumenSemaforo` (el reporte "Semáforo": una
   fila por colaborador, una columna por curso, coloreada) se
   EXPORTAN porque pages/colaboradores.js también los usa — Supervisor/
   Capacitador/Encargado ven ese mismo desglose arriba de su tabla de
   gestión de siempre, en vez de un ítem de menú aparte (decisión
   explícita del usuario: no quería una pantalla de "Reportes" extra
   para estos roles, sino que "Mi equipo"/"Mi local" ya la incluyera).
=============================*/

import { Header } from "../components/header.js";
import { ReportCard } from "../components/reportCard.js";
import { RankingCard } from "../components/rankingCard.js";
import { Table } from "../components/table.js";
import { Avatar } from "../components/avatar.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { exportarAPdf, membreteHtml } from "../services/exportarPdf.js";
import { getUsuarios, etiquetaColaborador } from "../data/usuarios.js";
import { getSucursales, getMisLocales } from "../data/sucursales.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";
import { getLecciones } from "../data/lecciones.js";
import { getEvaluaciones } from "../data/evaluaciones.js";
import { cursosDeLaPersona, cursoAplicaAPersona, leccionesDeLaPersona } from "../services/alcance.js";

const TIPOS = [
    { id: "semaforo",     titulo: "Semáforo",       descripcion: "Quién está bien y quién necesita refuerzo, con ranking.", icono: "alertas" },
    { id: "local",       titulo: "Por local",       descripcion: "Avance y desempeño de cada sucursal.", icono: "locales" },
    { id: "colaborador",  titulo: "Por colaborador", descripcion: "Progreso individual de cada colaborador.", icono: "usuarios" },
    { id: "supervisor",   titulo: "Por supervisor",  descripcion: "Desempeño del equipo de cada supervisor.", icono: "supervisores" },
    { id: "mensual",      titulo: "Mensual",         descripcion: "Evolución de los últimos 6 meses.", icono: "dashboard" },
    { id: "semanal",      titulo: "Semanal",         descripcion: "Evaluaciones rendidas en los últimos 7 días.", icono: "reportes" },
    { id: "anual",        titulo: "Anual",           descripcion: "Evolución de los últimos 12 meses.", icono: "reportes" },
];

// Mismos cortes que ya usa el resto de la app para "avance" (ver
// css/variables.css --success/--warning/--danger) — 85%+ es un
// desempeño sólido, por debajo de 60% ya amerita atención directa.
// Ajustables acá nomás si el criterio real de negocio es otro.
const UMBRAL_VERDE = 85;
const UMBRAL_AMARILLO = 60;

export function nivelDe(promedio) {
    if (promedio >= UMBRAL_VERDE) return "VERDE";
    if (promedio >= UMBRAL_AMARILLO) return "AMARILLO";
    return "ROJO";
}

export function badgeNivel(nivel) {
    const clase = nivel === "VERDE" ? "badge-success" : nivel === "AMARILLO" ? "badge-warning" : "badge-danger";
    return `<span class="badge ${clase}">${nivel}</span>`;
}

/** % real del camino completo de UNA persona — sobre el total de
 *  cursos que le corresponden (mismo filtro de "Gestión" que usa
 *  cursos.js), no solo los que ya arrancó. Una asignación recién se
 *  crea cuando la persona ve su primera lección de ese curso (ver
 *  cursos.js) — promediar solo esas filas infla el número (1 curso
 *  terminado de 8 daba "100%" en vez de ~13%). Mismo criterio que
 *  pages/colaboradores.js/inicioSupervisor.js. */
function progresoPersona(persona, asignaciones, cursos) {
    const cursosAplicables = cursosDeLaPersona(cursos, persona);
    if (!cursosAplicables.length) return null;
    const propias = asignaciones.filter((a) => String(a.colaboradorId) === String(persona.id));
    const suma = cursosAplicables.reduce((s, cur) => {
        const a = propias.find((x) => String(x.cursoId) === String(cur.id));
        return s + (a ? a.progreso : 0);
    }, 0);
    return Math.round(suma / cursosAplicables.length);
}

function promedioDeGrupo(equipo, asignaciones, cursos) {
    if (!equipo.length) return null;
    const valores = equipo.map((p) => progresoPersona(p, asignaciones, cursos)).filter((v) => v !== null);
    if (!valores.length) return null;
    return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
}

function promedioSucursal(nombreSucursal, usuarios, asignaciones, cursos) {
    const equipo = usuarios.filter((u) => u.rol === "colaborador" && u.sucursal === nombreSucursal);
    return promedioDeGrupo(equipo, asignaciones, cursos);
}

function rankingLocales(usuarios, sucursales, asignaciones, cursos) {
    // Con 99 locales reales pero personal cargado solo en un puñado,
    // el ranking se limita a los locales con datos reales.
    return sucursales
        .map((s) => ({ nombre: s.nombre, promedio: promedioSucursal(s.nombre, usuarios, asignaciones, cursos) }))
        .filter((s) => s.promedio !== null)
        .sort((a, b) => b.promedio - a.promedio)
        .map((s, i) => ({ posicion: i + 1, nombre: s.nombre, valor: `${s.promedio}%` }));
}

async function rankingSupervisores(usuarios, sucursales, asignaciones, cursos) {
    const supervisores = usuarios.filter((u) => u.rol === "supervisor");
    const conPromedio = await Promise.all(supervisores.map(async (sup) => {
        const nombresLocales = await getMisLocales(sup, sucursales);
        const equipo = usuarios.filter((u) => u.rol === "colaborador" && nombresLocales.includes(u.sucursal));
        const promedio = promedioDeGrupo(equipo, asignaciones, cursos) ?? 0;
        return { nombre: sup.nombre, promedio };
    }));
    return conPromedio
        .sort((a, b) => b.promedio - a.promedio)
        .map((s, i) => ({ posicion: i + 1, nombre: s.nombre, valor: `${s.promedio}%` }));
}

/** % de UN curso puntual para UNA persona — 0 si todavía no lo
 *  arrancó. Mismo criterio que progresoPersona, pero curso por curso
 *  en vez de promediado, para poder mostrar dónde está floja cada
 *  persona (no solo el promedio general). */
export function progresoCursoDePersona(persona, curso, asignaciones) {
    const a = asignaciones.find((x) => String(x.colaboradorId) === String(persona.id) && String(x.cursoId) === String(curso.id));
    return a ? a.progreso : 0;
}

export function resumenSemaforo(colaboradores, asignaciones, cursos) {
    const promedios = colaboradores.map((c) => progresoPersona(c, asignaciones, cursos) ?? 0);
    const total = promedios.length;
    const promedioGeneral = total ? Math.round(promedios.reduce((s, v) => s + v, 0) / total) : 0;
    const porNivel = { VERDE: 0, AMARILLO: 0, ROJO: 0 };
    promedios.forEach((p) => porNivel[nivelDe(p)]++);
    return { total, promedioGeneral, ...porNivel };
}

/** Celda coloreada para un % puntual de curso — mismo criterio de
 *  cortes que nivelDe, pero pensado para una tabla densa (matriz
 *  colaborador × curso) en vez de un badge grande. */
export function celdaPct(pct) {
    const tono = pct >= UMBRAL_VERDE ? "success" : pct >= UMBRAL_AMARILLO ? "warning" : "danger";
    return `<span class="badge badge-${tono}">${pct}%</span>`;
}

/** Barra de progreso genérica (% + "x/y") — mismo lenguaje visual que
 *  badgeProgreso (colaboradores.js). La usan tanto "Módulos vistos"
 *  (cursos completos sobre el total que le corresponden) como
 *  "Lecciones vistas" (lecciones individuales sobre el total real de
 *  todos sus cursos) — dos señales de "cuánto vio", separadas de la
 *  nota real de evaluación (ver estadoEvaluacion, debajo de cada
 *  módulo puntual). */
export function barraProgreso(hechos, total) {
    if (!total) return `<span class="text-xs text-muted">Sin datos</span>`;
    const pct = Math.round((hechos / total) * 100);
    const tono = pct < UMBRAL_AMARILLO ? "danger" : pct < UMBRAL_VERDE ? "warning" : "success";
    return `
        <div class="progreso-mini">
            <div class="progreso-mini-barra"><i class="progreso-mini-${tono}" style="width:${pct}%"></i></div>
            <span class="progreso-mini-valor progreso-mini-texto-${tono}">${pct}%</span>
            <span class="text-xs text-muted">(${hechos}/${total})</span>
        </div>
    `;
}

/** Lecciones vistas de una persona, sumadas entre todos sus cursos
 *  aplicables — el progreso por curso (progresoCursoDePersona, %) ya
 *  representa lecciones vistas/total DE ESE curso; acá se traduce ese
 *  % a una cantidad real y se suma contra el total de lecciones de
 *  Academy, no solo un promedio de porcentajes. */
export function leccionesDePersona(persona, cursosAplicables, asignaciones, lecciones) {
    // El mapa se arma POR PERSONA y no una sola vez para todos: una
    // lección puede no aplicarle a alguien (ej. batidos en Uruguay), y
    // contarla en su total le dejaría el progreso incompleto para
    // siempre — vería 18/20 con todo lo suyo terminado. Es O(personas ×
    // lecciones), irrelevante con la escala real de la app.
    const mias = leccionesDeLaPersona(lecciones || [], persona);
    const mapa = new Map();
    mias.forEach((l) => mapa.set(String(l.cursoId), (mapa.get(String(l.cursoId)) || 0) + 1));

    let vistas = 0;
    let total = 0;
    cursosAplicables.forEach((cur) => {
        const totalCurso = mapa.get(String(cur.id)) || 0;
        if (!totalCurso) return;
        vistas += Math.round((progresoCursoDePersona(persona, cur, asignaciones) / 100) * totalCurso);
        total += totalCurso;
    });
    return { vistas, total };
}

/** Debajo del % de progreso (que solo mide si vio las lecciones), el
 *  resultado REAL de la evaluación de ESE módulo puntual — pedido
 *  explícito del usuario: un promedio global ("7.5/10") no dice CUÁL
 *  módulo rindió, así que la nota va junto a su módulo, no aparte.
 *  "Sin rendir" queda atenuado pero visible junto al 100% — es
 *  exactamente el caso a detectar (vio todo, nunca demostró que
 *  aprendió). Cursos sin evaluación cargada todavía (ver
 *  cursosConEvaluacion) no muestran nada acá, no hay nada que
 *  rindiera. */
export function estadoEvaluacion(colaborador, curso, resultados, cursosConEvaluacion) {
    if (!cursosConEvaluacion.has(String(curso.id))) return "";
    const r = resultados.find((x) => String(x.colaboradorId) === String(colaborador.id) && String(x.cursoId) === String(curso.id));
    if (!r) return `<span class="text-xs text-muted">Sin rendir</span>`;
    const tono = r.aprobado ? "success" : "danger";
    const icono = r.aprobado ? "✓" : "✗";
    return `<span class="text-xs progreso-mini-texto-${tono}">${icono} ${r.nota}</span>`;
}

/** La tabla principal del Semáforo: una fila por colaborador, con
 *  Sucursal (para identificar el local de un vistazo, pedido del
 *  usuario), quién es Encargado, Total/Resultado/Nivel, y DESPUÉS una
 *  columna por cada curso real de la app con su % puntual — mismo
 *  espíritu que el informe de referencia (S1..S8), pero con los
 *  módulos reales de Academy en vez de checklist semanal.
 *  "Cumple/No cumple" del original no se trasladó: ahí contaba ítems
 *  de un checklist fijo, acá no hay un equivalente real (el % por
 *  curso ya cuenta esa historia, columna por columna). "No aplica"
 *  (cursos de Gestión para quien no es encargado) se muestra en gris,
 *  sin contar en Total. */
export function tablaMatrizSemaforo(colaboradores, cursos, asignaciones, resultados = [], lecciones = [], cursosConEvaluacion = new Set()) {
    const filas = colaboradores
        .map((c) => {
            const cursosAplicables = cursosDeLaPersona(cursos, c);
            const total = cursosAplicables.length;
            const hechos = cursosAplicables.filter((cur) => progresoCursoDePersona(c, cur, asignaciones) === 100).length;
            const promedio = total
                ? Math.round(cursosAplicables.reduce((s, cur) => s + progresoCursoDePersona(c, cur, asignaciones), 0) / total)
                : 0;
            const { vistas: leccionesVistas, total: leccionesTotal } = leccionesDePersona(c, cursosAplicables, asignaciones, lecciones);

            const fila = {
                _promedio: promedio,
                colaborador: `
                    <div class="fila-avatar-nombre">
                        ${Avatar({ nombre: c.nombre, foto: c.foto, size: "" })}
                        <div>
                            <div class="fila-avatar-nombre-txt">${c.nombre}</div>
                            <div class="fila-avatar-nombre-sub">${etiquetaColaborador(c)}</div>
                        </div>
                    </div>
                `,
                sucursal: c.sucursal || "—",
                modulosVistos: barraProgreso(hechos, total),
                leccionesVistas: barraProgreso(leccionesVistas, leccionesTotal),
            };
            cursos.forEach((cur) => {
                const aplica = cursoAplicaAPersona(cur, c);
                fila[`curso_${cur.id}`] = aplica
                    ? `<div class="celda-curso">${celdaPct(progresoCursoDePersona(c, cur, asignaciones))}${estadoEvaluacion(c, cur, resultados, cursosConEvaluacion)}</div>`
                    : `<span class="text-xs text-muted">No aplica</span>`;
            });
            return fila;
        })
        .sort((a, b) => b._promedio - a._promedio);

    const columnas = [
        { key: "colaborador", label: "Colaborador" },
        { key: "sucursal", label: "Sucursal" },
        { key: "modulosVistos", label: "Módulos vistos" },
        { key: "leccionesVistas", label: "Lecciones vistas" },
        ...cursos.map((cur) => ({ key: `curso_${cur.id}`, label: cur.nombre })),
    ];
    return Table(columnas, filas);
}

/** Pedido explícito del usuario: sin filtros, ver a TODA la red junta
 *  en una sola pantalla "es un desmadre" para poder gestionar bien.
 *  Sucursal (multi-selección con chips, mismo componente que ya usan
 *  Manuales/Noticias — pedido explícito: "si quiero ver varios elijo
 *  los que quiero y los veo de una vez, sino es entrar y salir") +
 *  Nivel (pills, mismo patrón que Colaboradores) — recorta la lista
 *  ANTES de calcular resumen/matriz/áreas a reforzar (no es un
 *  show/hide de filas: esos tres bloques dependen del conjunto
 *  filtrado). Ver bindSemaforo() más abajo. */
function filtrosSemaforoHtml() {
    return `
        <div class="galeria-pills" style="margin-bottom:14px">
            <button class="pill-categoria activa" data-semaforo-nivel="todos">Todos</button>
            <button class="pill-categoria" data-semaforo-nivel="VERDE">Verde</button>
            <button class="pill-categoria" data-semaforo-nivel="AMARILLO">Amarillo</button>
            <button class="pill-categoria" data-semaforo-nivel="ROJO">Rojo</button>
        </div>
        <div style="margin-bottom:20px;max-width:420px">
            ${MultiSelectSucursales("semaforo-filtro-sucursal")}
        </div>
    `;
}

/** Recalcula el contenido (resumen + matriz) con los filtros
 *  actuales, sin tocar los controles de filtro — así los chips/pill
 *  elegidos no se resetean en cada cambio. */
async function actualizarSemaforo() {
    const contenedor = document.getElementById("semaforo-contenido");
    const filtros = document.getElementById("semaforo-filtros");
    if (!contenedor || !filtros) return;

    const [usuarios, asignaciones, cursos, resultados, lecciones, evaluaciones] = await Promise.all([getUsuarios(), getAsignaciones(), getCursos(), getResultados(), getLecciones(), getEvaluaciones()]);
    const cursosConEvaluacion = new Set(evaluaciones.map((p) => String(p.cursoId)));
    let colaboradores = usuarios.filter((u) => u.rol === "colaborador");

    // Vacío (sin chips elegidos) = todas las sucursales, mismo
    // criterio que "Todas las sucursales" tenía el select anterior.
    const sucursales = (document.getElementById("semaforo-filtro-sucursal")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (sucursales.length) colaboradores = colaboradores.filter((c) => sucursales.includes(c.sucursal));

    const nivel = filtros.querySelector("[data-semaforo-nivel].activa")?.dataset.semaforoNivel;
    if (nivel && nivel !== "todos") {
        colaboradores = colaboradores.filter((c) => nivelDe(progresoPersona(c, asignaciones, cursos) ?? 0) === nivel);
    }

    // El membrete del PDF se regenera acá también (no solo en el
    // primer render) — sin esto, cambiar un filtro pisaba el
    // innerHTML entero de #semaforo-contenido y se perdía la marca/
    // fecha que solo se había puesto una vez al montar la pantalla.
    const alcance = [
        sucursales.length === 1 ? sucursales[0] : sucursales.length ? `${sucursales.length} sucursales` : "Toda la red",
        nivel && nivel !== "todos" ? `Nivel ${nivel}` : null,
    ].filter(Boolean).join(" · ");

    contenedor.innerHTML = membreteHtml("Semáforo de desempeño", alcance) + vistaSemaforo(colaboradores, asignaciones, cursos, resultados, lecciones, cursosConEvaluacion);
    bindTabsSemaforo();
}

/** Conecta los filtros de la vista Semáforo — no-op si esa vista no
 *  está montada ahora mismo (el usuario cambió a otro tipo de
 *  reporte). Se llama tanto en bindReportes() (primer montaje) como
 *  cada vez que se vuelve a elegir la tarjeta "Semáforo" (el HTML se
 *  reinserta de cero, así que los listeners viejos ya no sirven). */
function bindSemaforo() {
    const filtros = document.getElementById("semaforo-filtros");
    if (!filtros) return;

    filtros.querySelectorAll("[data-semaforo-nivel]").forEach((btn) => {
        btn.addEventListener("click", () => {
            filtros.querySelectorAll("[data-semaforo-nivel]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            actualizarSemaforo();
        });
    });
    bindMultiSelectSucursales("semaforo-filtro-sucursal");
    document.getElementById("semaforo-filtro-sucursal")?.addEventListener("change", actualizarSemaforo);
    bindTabsSemaforo();
}

/** Alterna entre los dos paneles de vistaSemaforo (colaboradores/
 *  sucursal) — ambos ya están renderizados en el DOM (ver
 *  vistaSemaforo), así que alternar es solo mostrar/ocultar, sin
 *  recalcular nada. Se vuelve a llamar cada vez que se reinserta el
 *  contenido (actualizarSemaforo, cambio de filtro) porque ese innerHTML
 *  nuevo trae tabs sin listener todavía. */
function bindTabsSemaforo() {
    const tabs = document.getElementById("tabs-semaforo");
    if (!tabs) return;
    tabs.querySelectorAll("[data-vista-semaforo]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const vista = btn.dataset.vistaSemaforo;
            tabs.querySelectorAll("[data-vista-semaforo]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            document.querySelectorAll("[data-panel-semaforo]").forEach((panel) => {
                panel.style.display = panel.dataset.panelSemaforo === vista ? "" : "none";
            });
        });
    });
}

/** Tarjeta KPI "grande" con un valor principal + subtítulo chico —
 *  mismo componente base (.card) que KpiCard, pero con la jerarquía
 *  tipográfica de la referencia del cliente (número grande arriba,
 *  aclaración chica abajo, sin ícono de estado). */
function kpiGrande(titulo, valor, subtitulo) {
    return `
        <div class="card kpi-card">
            <h3>${titulo}</h3>
            <span>${valor}</span>
            ${subtitulo ? `<div class="kpi-trend">${subtitulo}</div>` : ""}
        </div>
    `;
}

/** Mejor/menor rendimiento — nombre + % coloreado, mismo criterio de
 *  "promedio real de la persona" que ya usa toda esta pantalla
 *  (progresoPersona). Sin datos (equipo vacío) no rompe: la tarjeta
 *  queda con un guion en vez de reventar. */
function kpiPersona(titulo, persona, tono) {
    return `
        <div class="card kpi-card">
            <h3>${titulo}</h3>
            ${persona ? `<div class="kpi-persona-nombre">${persona.c.nombre}</div><span class="tono-${tono}">${persona.pct}%</span>` : `<span>—</span>`}
        </div>
    `;
}

/** Fila de 5 tarjetas KPI pedida por el cliente (referencia visual) —
 *  reemplaza el resumen anterior (Promedio/Verde/Amarillo/Rojo): acá
 *  el color por nivel se ve fila por fila (columna "Nivel"/pills de
 *  cada módulo), así que arriba se prioriza otra cosa: cuánta gente
 *  activa hay, el promedio general, quién está mejor/peor, y cuántas
 *  evaluaciones reales se registraron. Todo sale de datos que la
 *  pantalla ya calculaba — no hay ningún número nuevo inventado. */
export function kpisSemaforo(colaboradores, asignaciones, cursos, resultados) {
    const activos = colaboradores.filter((c) => c.activo === "SI").length;
    const resumen = resumenSemaforo(colaboradores, asignaciones, cursos);
    const conProgreso = colaboradores
        .map((c) => ({ c, pct: progresoPersona(c, asignaciones, cursos) }))
        .filter((x) => x.pct !== null);
    const mejor = conProgreso.length ? conProgreso.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
    const menor = conProgreso.length ? conProgreso.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;
    const idsEquipo = new Set(colaboradores.map((c) => String(c.id)));
    const evaluacionesEquipo = resultados.filter((r) => idsEquipo.has(String(r.colaboradorId))).length;

    return `
        <div class="cards kpis-semaforo">
            ${kpiGrande("Colaboradores activos", activos, `de ${colaboradores.length} totales`)}
            ${kpiGrande("Promedio general", `${resumen.promedioGeneral}%`)}
            ${kpiPersona("Mejor rendimiento", mejor, "success")}
            ${kpiPersona("Menor rendimiento", menor, "danger")}
            ${kpiGrande("Evaluaciones registradas", evaluacionesEquipo, "en total")}
        </div>
    `;
}

/** Anillo de % (SVG) — mismo criterio de cortes/color que celdaPct,
 *  pensado para la "Vista por sucursal" (una fila por local en vez de
 *  por persona, referencia visual del cliente). */
function anilloPct(pct, size = 44) {
    const tono = pct >= UMBRAL_VERDE ? "success" : pct >= UMBRAL_AMARILLO ? "warning" : "danger";
    const r = (size - 6) / 2;
    const c = Math.round(2 * Math.PI * r * 10) / 10;
    const offset = Math.round((c - (pct / 100) * c) * 10) / 10;
    return `
        <div class="anillo" style="width:${size}px;height:${size}px">
            <svg width="${size}" height="${size}"><circle class="anillo-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--${tono})" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"/></svg>
            <span class="anillo-valor" style="color:var(--${tono})">${pct}%</span>
        </div>
    `;
}

/** "Vista por sucursal" — una fila por local en vez de por persona
 *  (pedido explícito del cliente, mismo espíritu que rankingLocales
 *  pero con el detalle por módulo en anillos, no solo un ranking).
 *  Mismo criterio de "aplica" (cursos de Gestión) que el resto de la
 *  pantalla: se promedia solo entre quienes ese curso les corresponde. */
function tablaPorSucursal(colaboradores, cursos, asignaciones) {
    const nombres = [...new Set(colaboradores.map((c) => c.sucursal).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const filas = nombres
        .map((nombreSucursal) => {
            const equipo = colaboradores.filter((c) => c.sucursal === nombreSucursal);
            const promedio = promedioDeGrupo(equipo, asignaciones, cursos) ?? 0;
            const cursosAplicables = cursos.filter((cur) => equipo.some((c) => cursoAplicaAPersona(cur, c)));
            const avatares = equipo.slice(0, 3).map((c) => Avatar({ nombre: c.nombre, foto: c.foto, size: "sm" })).join("");
            const extra = equipo.length > 3 ? `<span class="pila-mas">+${equipo.length - 3}</span>` : "";

            const fila = {
                _promedio: promedio,
                sucursal: `<div class="fila-avatar-nombre-txt">${nombreSucursal}</div>`,
                equipo: `<div class="pila-avatares">${avatares}${extra}</div>`,
                total: String(cursosAplicables.length),
                resultado: anilloPct(promedio, 46),
                nivel: badgeNivel(nivelDe(promedio)),
            };
            cursos.forEach((cur) => {
                const aplican = equipo.filter((c) => cursoAplicaAPersona(cur, c));
                const valores = aplican.map((c) => progresoCursoDePersona(c, cur, asignaciones));
                fila[`curso_${cur.id}`] = valores.length
                    ? anilloPct(Math.round(valores.reduce((s, v) => s + v, 0) / valores.length), 40)
                    : `<span class="text-xs text-muted">No aplica</span>`;
            });
            return fila;
        })
        .sort((a, b) => b._promedio - a._promedio);

    const columnas = [
        { key: "sucursal", label: "Sucursal" },
        { key: "equipo", label: "Equipo" },
        { key: "total", label: "Total módulos" },
        { key: "resultado", label: "Resultado general" },
        { key: "nivel", label: "Nivel" },
        ...cursos.map((cur) => ({ key: `curso_${cur.id}`, label: cur.nombre })),
    ];
    return Table(columnas, filas);
}

/** Tabs "Vista por colaboradores"/"Vista por sucursal" — pedido
 *  explícito del cliente (referencia visual). Los dos paneles se
 *  arman siempre (no bajo demanda): son tablas, no fetches nuevos,
 *  así que alternar es instantáneo, sin spinner. */
function vistaSemaforo(colaboradores, asignaciones, cursos, resultados, lecciones, cursosConEvaluacion) {
    return `
        ${kpisSemaforo(colaboradores, asignaciones, cursos, resultados)}
        <div class="card">
            <div class="tabs-semaforo" id="tabs-semaforo">
                <button class="tab-semaforo activa" data-vista-semaforo="colaboradores">Vista por colaboradores</button>
                <button class="tab-semaforo" data-vista-semaforo="sucursal">Vista por sucursal</button>
            </div>
            <div data-panel-semaforo="colaboradores">${tablaMatrizSemaforo(colaboradores, cursos, asignaciones, resultados, lecciones, cursosConEvaluacion)}</div>
            <div data-panel-semaforo="sucursal" style="display:none">${tablaPorSucursal(colaboradores, cursos, asignaciones)}</div>
        </div>
    `;
}

function tablaColaboradores(usuarios, asignaciones, cursos) {
    const colaboradores = usuarios.filter((u) => u.rol === "colaborador");
    const filas = colaboradores.map((c) => {
        const asigs = asignaciones.filter((a) => String(a.colaboradorId) === String(c.id));
        const promedio = progresoPersona(c, asignaciones, cursos) ?? 0;
        return { nombre: c.nombre, sucursal: c.sucursal || "—", cursos: asigs.length, promedio: `${promedio}%` };
    });
    return Table([
        { key: "nombre", label: "Colaborador" },
        { key: "sucursal", label: "Sucursal" },
        { key: "cursos", label: "Cursos asignados" },
        { key: "promedio", label: "Avance promedio" },
    ], filas);
}

function trendChart(puntos) {
    const max = Math.max(1, ...puntos.map((p) => p.cantidad));
    const barras = puntos.map((p) => `
        <div class="trend-bar">
            <div class="bar-fill" style="height:${Math.round((p.cantidad / max) * 100)}%"></div>
            <span class="bar-label">${p.label}</span>
        </div>
    `).join("");
    return `<div class="trend-chart">${barras}</div>`;
}

// "YYYY-MM-DD" es una fecha sin hora — leerla con new Date(str) y
// getMonth()/getFullYear()/toISOString() la puede correr un día en
// zonas detrás de UTC (ej. Argentina). Todo esto compara/arma
// strings directamente para evitar ese problema.
function fechaLocalISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tendenciaMensual(resultados, cantidadMeses) {
    const hoy = new Date();
    const claves = [];
    for (let i = cantidadMeses - 1; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        claves.push({ clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("es-AR", { month: "short" }) });
    }
    return claves.map(({ clave, label }) => ({
        label,
        cantidad: resultados.filter((r) => r.fechaFinalizacion && r.fechaFinalizacion.slice(0, 7) === clave).length,
    }));
}

function tendenciaSemanal(resultados) {
    const hoy = new Date();
    const dias = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        dias.push({ clave: fechaLocalISO(d), label: d.toLocaleDateString("es-AR", { weekday: "short" }) });
    }
    return dias.map(({ clave, label }) => ({
        label,
        cantidad: resultados.filter((r) => r.fechaFinalizacion === clave).length,
    }));
}

async function renderPreview(tipoId) {
    const [usuarios, sucursales, asignaciones, resultados, cursos, lecciones, evaluaciones] = await Promise.all([
        getUsuarios(), getSucursales(), getAsignaciones(), getResultados(), getCursos(), getLecciones(), getEvaluaciones(),
    ]);

    if (tipoId === "semaforo") {
        const colaboradores = usuarios.filter((u) => u.rol === "colaborador");
        const cursosConEvaluacion = new Set(evaluaciones.map((p) => String(p.cursoId)));
        return `
            <div id="semaforo-filtros">${filtrosSemaforoHtml()}</div>
            <div id="semaforo-contenido" class="imprimible">
                ${membreteHtml("Semáforo de desempeño", "Toda la red")}
                ${vistaSemaforo(colaboradores, asignaciones, cursos, resultados, lecciones, cursosConEvaluacion)}
            </div>
        `;
    }
    if (tipoId === "local") return RankingCard({ titulo: "Reporte por local", items: rankingLocales(usuarios, sucursales, asignaciones, cursos) });
    if (tipoId === "supervisor") return RankingCard({ titulo: "Reporte por supervisor", items: await rankingSupervisores(usuarios, sucursales, asignaciones, cursos) });
    if (tipoId === "colaborador") return tablaColaboradores(usuarios, asignaciones, cursos);
    if (tipoId === "mensual") return `<div class="card"><h3>Evolución — últimos 6 meses</h3>${trendChart(tendenciaMensual(resultados, 6))}</div>`;
    if (tipoId === "anual") return `<div class="card"><h3>Evolución — últimos 12 meses</h3>${trendChart(tendenciaMensual(resultados, 12))}</div>`;
    if (tipoId === "semanal") return `<div class="card"><h3>Evaluaciones — últimos 7 días</h3>${trendChart(tendenciaSemanal(resultados))}</div>`;
    return "";
}

export async function Reportes() {

    const tarjetas = TIPOS.map((t, i) => ReportCard({ ...t, seleccionado: i === 0 })).join("");
    const previewInicial = await renderPreview(TIPOS[0].id);

    return `
        ${Header("Centro de Reportes", "Elegí un tipo de reporte para ver la vista previa")}

        <div class="cards">${tarjetas}</div>

        <div class="section">
            <div class="header" style="margin-bottom:0">
                <h2>Vista previa</h2>
                <button class="btn btn-secondary" id="btn-exportar-reporte">🖨 Exportar PDF</button>
            </div>
            <div id="reporte-preview" style="margin-top:20px">${previewInicial}</div>
        </div>
    `;
}

export function bindReportes() {
    bindSemaforo(); // "Semáforo" es TIPOS[0] — ya está montado en el primer render.

    // "Exportar" solo tiene sentido con el Semáforo (único reporte con
    // clase ".imprimible" por ahora, ver renderPreview) — se
    // deshabilita solo para el resto de las tarjetas, en vez de
    // imprimir una pantalla vacía.
    const btnExportar = document.getElementById("btn-exportar-reporte");
    btnExportar?.addEventListener("click", () => exportarAPdf("semaforo-contenido", "Semáforo de desempeño - Lucciano's Academy"));

    document.querySelectorAll("[data-report-id]").forEach((card) => {
        card.addEventListener("click", async () => {
            document.querySelectorAll("[data-report-id]").forEach((c) => c.classList.remove("selected"));
            card.classList.add("selected");
            document.getElementById("reporte-preview").innerHTML = await renderPreview(card.dataset.reportId);
            bindSemaforo();
            if (btnExportar) {
                const esSemaforo = card.dataset.reportId === "semaforo";
                btnExportar.disabled = !esSemaforo;
                btnExportar.title = esSemaforo ? "" : "Disponible solo para el reporte Semáforo por ahora";
            }
        });
    });
}
