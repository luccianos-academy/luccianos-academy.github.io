/* ============================
   Lucciano's Academy
   pages/dashboardEjecutivo.js — Dashboard Ejecutivo (Admin)

   La analítica profunda: KPIs completos, rankings, evolución
   mensual. Distinto de inicioAdmin.js (que es un resumen liviano
   de uso diario) — acá es donde un Administrador viene a mirar
   números a fondo.

   Los helpers de acá abajo (promedio por local, ranking de
   supervisores) se duplican en pages/reportes.js y
   pages/supervisores.js a propósito: son funciones puras chicas,
   y crear un módulo util compartido nuevo quedaría fuera de la
   lista de archivos aprobada para este incremento.
=============================*/

import { Header } from "../components/header.js";
import { KpiCard } from "../components/kpiCard.js";
import { RankingCard } from "../components/rankingCard.js";
import { ActivityFeed } from "../components/activityFeed.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales, getMisLocales } from "../data/sucursales.js";
import { getCursos } from "../data/cursos.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getAuditoria } from "../data/auditoria.js";

const UMBRAL_CRITICO = 50;
const UMBRAL_DESTACADO = 90;

/**
 * "YYYY-MM-DD" (fechaVencimiento/fechaFinalizacion) es una fecha
 * SIN hora — el motor de JS la interpreta como medianoche UTC, así
 * que leerla con getFullYear()/getMonth() en una zona horaria
 * detrás de UTC (como Argentina) la corre un día para atrás. Por
 * eso estas comparaciones se hacen sobre el string, nunca con
 * new Date(fechaString).getMonth()/getFullYear().
 */
function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function claveMes(fechaStr) {
    return fechaStr ? fechaStr.slice(0, 7) : "";
}

/** % real del camino completo de UNA persona — sobre el total de
 *  cursos que le corresponden (mismo filtro de "Gestión" que usa
 *  cursos.js), no solo los que ya arrancó. Una asignación recién se
 *  crea cuando la persona ve su primera lección de ese curso — pro-
 *  mediar solo esas filas infla el número (1 curso terminado de 8
 *  daba "100%" en vez de ~13%). Mismo criterio que pages/colaboradores.js. */
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
    // el ranking se limita a los locales con datos reales — listar
    // los ~90 restantes como "Sin datos" no aportaría nada útil acá.
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

function clavesUltimosMeses(cantidad) {
    const hoy = new Date();
    const claves = [];
    for (let i = cantidad - 1; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        claves.push({ anio: d.getFullYear(), mes: d.getMonth(), label: d.toLocaleDateString("es-AR", { month: "short" }) });
    }
    return claves;
}

function tendenciaMensual(resultados, cantidadMeses) {
    const claves = clavesUltimosMeses(cantidadMeses);
    return claves.map(({ anio, mes, label }) => {
        const clave = `${anio}-${String(mes + 1).padStart(2, "0")}`;
        const cantidad = resultados.filter((r) => claveMes(r.fechaFinalizacion) === clave).length;
        return { label, cantidad };
    });
}

function renderTrendChart(puntos) {
    const max = Math.max(1, ...puntos.map((p) => p.cantidad));
    const barras = puntos.map((p) => `
        <div class="trend-bar">
            <div class="bar-fill" style="height:${Math.round((p.cantidad / max) * 100)}%" title="${p.cantidad} evaluaciones"></div>
            <span class="bar-label">${p.label}</span>
        </div>
    `).join("");
    return `<div class="trend-chart">${barras}</div>`;
}

export async function DashboardEjecutivo() {

    const [usuarios, sucursales, cursos, asignaciones, resultados, auditoria] = await Promise.all([
        getUsuarios(), getSucursales(), getCursos(), getAsignaciones(), getResultados(), getAuditoria(),
    ]);

    const hoyISO = fechaHoyISO();
    const colaboradores = usuarios.filter((u) => u.rol === "colaborador");

    const personalActivo = usuarios.filter((u) => u.activo === "SI").length;
    const personalSinCapacitacion = colaboradores.filter((c) => !asignaciones.some((a) => String(a.colaboradorId) === String(c.id))).length;
    const cursosFinalizados = asignaciones.filter((a) => a.estado === "completado").length;
    const cursosPendientes = asignaciones.filter((a) => a.estado !== "completado").length;
    const evaluacionesDelMes = resultados.filter((r) => claveMes(r.fechaFinalizacion) === claveMes(hoyISO)).length;
    const promedioGeneral = resultados.length
        ? Math.round((resultados.reduce((s, r) => s + r.nota, 0) / resultados.length) * 10) / 10
        : 0;

    const promediosLocales = sucursales.map((s) => promedioSucursal(s.nombre, usuarios, asignaciones, cursos));
    const localesCriticos = promediosLocales.filter((p) => p !== null && p < UMBRAL_CRITICO).length;
    const localesDestacados = promediosLocales.filter((p) => p !== null && p >= UMBRAL_DESTACADO).length;

    const cursosVencidos = asignaciones.filter((a) => a.fechaVencimiento && a.fechaVencimiento < hoyISO && a.estado !== "completado").length;
    const evaluacionesPendientes = asignaciones.filter((a) => !resultados.some((r) => String(r.colaboradorId) === String(a.colaboradorId) && String(r.cursoId) === String(a.cursoId))).length;
    const usuariosInactivos = usuarios.filter((u) => u.activo === "NO").length;
    const totalAlertas = cursosVencidos + evaluacionesPendientes + usuariosInactivos;

    const ultimosIngresos = auditoria.filter((a) => a.accion === "registrar_colaborador").slice(0, 5).map((a) => ({ fecha: a.fecha, texto: a.detalle }));
    const actividadReciente = auditoria.slice(0, 6).map((a) => ({ fecha: a.fecha, texto: a.detalle }));

    const itemsRankingSupervisores = await rankingSupervisores(usuarios, sucursales, asignaciones, cursos);

    return `
        ${Header("Dashboard Ejecutivo", "Números completos de toda la operación")}

        <div class="cards">
            ${KpiCard("Personal activo", personalActivo, { icono: "usuarios" })}
            ${KpiCard("Sin capacitación", personalSinCapacitacion, { icono: "alertas", tono: "warning" })}
            ${KpiCard("Cursos finalizados", cursosFinalizados, { icono: "check", tono: "success" })}
            ${KpiCard("Cursos pendientes", cursosPendientes, { icono: "academia" })}
            ${KpiCard("Evaluaciones del mes", evaluacionesDelMes, { icono: "evaluaciones" })}
            ${KpiCard("Promedio general", promedioGeneral, { icono: "dashboard" })}
            ${KpiCard("Locales críticos", localesCriticos, { icono: "warning", tono: "danger" })}
            ${KpiCard("Locales destacados", localesDestacados, { icono: "trendUp", tono: "success" })}
            ${KpiCard("Alertas activas", totalAlertas, { icono: "alertas", tono: totalAlertas > 0 ? "warning" : "success" })}
        </div>

        <div class="section grid-2-1">
            <div>${RankingCard({ titulo: "Ranking de locales", items: rankingLocales(usuarios, sucursales, asignaciones, cursos) })}</div>
            <div>${RankingCard({ titulo: "Ranking de supervisores", items: itemsRankingSupervisores })}</div>
        </div>

        <div class="section card">
            <div class="header" style="margin-bottom:0">
                <h2>Evolución mensual</h2>
                <select id="filtro-meses">
                    <option value="3">Últimos 3 meses</option>
                    <option value="6" selected>Últimos 6 meses</option>
                    <option value="12">Últimos 12 meses</option>
                </select>
            </div>
            <div id="tendencia-mensual">${renderTrendChart(tendenciaMensual(resultados, 6))}</div>
        </div>

        <div class="section grid-2-1">
            <div>
                <h2>Actividad reciente</h2>
                ${ActivityFeed(actividadReciente)}
            </div>
            <div>
                <h2>Últimos ingresos</h2>
                ${ActivityFeed(ultimosIngresos, { vacio: "Sin altas recientes" })}
            </div>
        </div>
    `;
}

export function bindDashboard() {
    const filtro = document.getElementById("filtro-meses");
    if (!filtro) return;
    filtro.addEventListener("change", async () => {
        const resultados = await getResultados();
        document.getElementById("tendencia-mensual").innerHTML = renderTrendChart(tendenciaMensual(resultados, Number(filtro.value)));
    });
}
