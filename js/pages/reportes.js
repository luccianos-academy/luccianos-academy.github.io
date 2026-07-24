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
=============================*/

import { Header } from "../components/header.js";
import { ReportCard } from "../components/reportCard.js";
import { RankingCard } from "../components/rankingCard.js";
import { Table } from "../components/table.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales, getMisLocales } from "../data/sucursales.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";

const TIPOS = [
    { id: "local",       titulo: "Por local",       descripcion: "Avance y desempeño de cada sucursal.", icono: "locales" },
    { id: "colaborador",  titulo: "Por colaborador", descripcion: "Progreso individual de cada colaborador.", icono: "usuarios" },
    { id: "supervisor",   titulo: "Por supervisor",  descripcion: "Desempeño del equipo de cada supervisor.", icono: "supervisores" },
    { id: "mensual",      titulo: "Mensual",         descripcion: "Evolución de los últimos 6 meses.", icono: "dashboard" },
    { id: "semanal",      titulo: "Semanal",         descripcion: "Evaluaciones rendidas en los últimos 7 días.", icono: "reportes" },
    { id: "anual",        titulo: "Anual",           descripcion: "Evolución de los últimos 12 meses.", icono: "reportes" },
];

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
                <button class="btn btn-secondary" disabled title="Próximamente">Exportar (Próximamente)</button>
            </div>
            <div id="reporte-preview" style="margin-top:20px">${previewInicial}</div>
        </div>
    `;
}

export function bindReportes() {
    document.querySelectorAll("[data-report-id]").forEach((card) => {
        card.addEventListener("click", async () => {
            document.querySelectorAll("[data-report-id]").forEach((c) => c.classList.remove("selected"));
            card.classList.add("selected");
            document.getElementById("reporte-preview").innerHTML = await renderPreview(card.dataset.reportId);
        });
    });
}
