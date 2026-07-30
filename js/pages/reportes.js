/* ============================
   FARO v4
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
import { KpiCard } from "../components/kpiCard.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { exportarAPdf, membreteHtml } from "../services/exportarPdf.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales, getMisLocales } from "../data/sucursales.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";

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
    const cursosAplicables = cursos.filter((cur) => cur.categoria !== "Gestión" || persona.encargado);
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
export function tablaMatrizSemaforo(colaboradores, cursos, asignaciones) {
    const filas = colaboradores
        .map((c) => {
            const cursosAplicables = cursos.filter((cur) => cur.categoria !== "Gestión" || c.encargado);
            const total = cursosAplicables.length;
            const promedio = total
                ? Math.round(cursosAplicables.reduce((s, cur) => s + progresoCursoDePersona(c, cur, asignaciones), 0) / total)
                : 0;

            const fila = {
                _promedio: promedio,
                colaborador: c.encargado ? `${c.nombre} <span class="badge badge-muted">Encargado</span>` : c.nombre,
                sucursal: c.sucursal || "—",
                total: String(total),
                resultado: `${promedio}%`,
                nivel: badgeNivel(nivelDe(promedio)),
            };
            cursos.forEach((cur) => {
                const aplica = cur.categoria !== "Gestión" || c.encargado;
                fila[`curso_${cur.id}`] = aplica
                    ? celdaPct(progresoCursoDePersona(c, cur, asignaciones))
                    : `<span class="text-xs text-muted">No aplica</span>`;
            });
            return fila;
        })
        .sort((a, b) => b._promedio - a._promedio);

    const columnas = [
        { key: "colaborador", label: "Colaborador" },
        { key: "sucursal", label: "Sucursal" },
        { key: "total", label: "Total módulos" },
        { key: "resultado", label: "Resultado" },
        { key: "nivel", label: "Nivel" },
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

    const [usuarios, asignaciones, cursos] = await Promise.all([getUsuarios(), getAsignaciones(), getCursos()]);
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

    contenedor.innerHTML = membreteHtml("Semáforo de desempeño", alcance) + vistaSemaforo(colaboradores, asignaciones, cursos);
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
}

function vistaSemaforo(colaboradores, asignaciones, cursos, tituloGrupo) {
    const resumen = resumenSemaforo(colaboradores, asignaciones, cursos);

    return `
        <div class="cards" style="margin-bottom:20px">
            ${KpiCard(tituloGrupo || "Colaboradores evaluados", resumen.total)}
            ${KpiCard("Promedio", `${resumen.promedioGeneral}%`)}
            ${KpiCard("Verde", resumen.VERDE, { icono: "check", tono: "success" })}
            ${KpiCard("Amarillo", resumen.AMARILLO, { icono: "warning", tono: "warning" })}
            ${KpiCard("Rojo", resumen.ROJO, { icono: "warning", tono: "danger" })}
        </div>
        <div class="card">
            <h3>Desempeño por colaborador y por módulo</h3>
            ${tablaMatrizSemaforo(colaboradores, cursos, asignaciones)}
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
    const [usuarios, sucursales, asignaciones, resultados, cursos] = await Promise.all([
        getUsuarios(), getSucursales(), getAsignaciones(), getResultados(), getCursos(),
    ]);

    if (tipoId === "semaforo") {
        const colaboradores = usuarios.filter((u) => u.rol === "colaborador");
        return `
            <div id="semaforo-filtros">${filtrosSemaforoHtml()}</div>
            <div id="semaforo-contenido" class="imprimible">
                ${membreteHtml("Semáforo de desempeño", "Toda la red")}
                ${vistaSemaforo(colaboradores, asignaciones, cursos)}
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
