/* ============================
   FARO v4
   pages/inicioAdmin.js — Home del Administrador

   Resumen liviano de uso diario — NO es una copia de Dashboard
   Ejecutivo (#/dashboard), que es donde vive el análisis a fondo.
   Acá: unos pocos KPIs, accesos rápidos, las alertas más urgentes
   y la actividad reciente.
=============================*/

import { Header } from "../components/header.js";
import { KpiCard } from "../components/kpiCard.js";
import { QuickAction } from "../components/quickAction.js";
import { AlertCard } from "../components/alertCard.js";
import { ActivityFeed } from "../components/activityFeed.js";
import { getUsuarios } from "../data/usuarios.js";
import { getCursos } from "../data/cursos.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getAuditoria } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";

// "YYYY-MM-DD" es una fecha sin hora — leerla con new Date(str) y
// getMonth()/getFullYear() la corre un día en zonas detrás de UTC
// (ej. Argentina). Comparar sobre el string evita ese problema.
function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function InicioAdmin() {

    const usuario = getUsuarioActual();
    const [usuarios, cursos, asignaciones, resultados, auditoria] = await Promise.all([
        getUsuarios(), getCursos(), getAsignaciones(), getResultados(), getAuditoria(),
    ]);

    const hoyISO = fechaHoyISO();
    const usuariosPorId = Object.fromEntries(usuarios.map((u) => [String(u.id), u]));
    const cursosPorId = Object.fromEntries(cursos.map((c) => [String(c.id), c]));

    const personalActivo = usuarios.filter((u) => u.activo === "SI").length;
    const cursosPendientes = asignaciones.filter((a) => a.estado !== "completado").length;
    const evaluacionesDelMes = resultados.filter((r) => r.fechaFinalizacion && r.fechaFinalizacion.slice(0, 7) === hoyISO.slice(0, 7)).length;

    const cursosVencidos = asignaciones.filter((a) => a.fechaVencimiento && a.fechaVencimiento < hoyISO && a.estado !== "completado");
    const usuariosInactivos = usuarios.filter((u) => u.activo === "NO");
    // Misma fórmula que Dashboard Ejecutivo (#/dashboard) — el KPI
    // "Alertas activas" tiene que decir el mismo número en las dos
    // pantallas, no un subconjunto acá.
    const evaluacionesPendientes = asignaciones.filter((a) =>
        !resultados.some((r) => String(r.colaboradorId) === String(a.colaboradorId) && String(r.cursoId) === String(a.cursoId))
    );
    const totalAlertas = cursosVencidos.length + evaluacionesPendientes.length + usuariosInactivos.length;

    const topAlertas = [
        ...cursosVencidos.slice(0, 2).map((a) => AlertCard({
            titulo: `Curso vencido: ${cursosPorId[a.cursoId]?.nombre || "—"}`,
            detalle: usuariosPorId[a.colaboradorId]?.nombre || "Colaborador",
            severidad: "danger",
            icono: "warning",
        })),
        ...usuariosInactivos.slice(0, 1).map((u) => AlertCard({
            titulo: `Usuario inactivo: ${u.nombre}`,
            detalle: u.sucursal || "Sin sucursal",
            severidad: "muted",
            icono: "usuarios",
        })),
    ].slice(0, 3);

    const actividad = auditoria.slice(0, 5).map((a) => ({ fecha: a.fecha, texto: a.detalle }));

    return `
        ${Header(`Bienvenido/a, ${usuario.nombre}`, "Centro de Control", { saludo: true })}

        <div class="cards">
            ${KpiCard("Personal activo", personalActivo, { icono: "usuarios", href: "#/colaboradores" })}
            ${KpiCard("Cursos pendientes", cursosPendientes, { icono: "academia" })}
            ${KpiCard("Evaluaciones del mes", evaluacionesDelMes, { icono: "evaluaciones" })}
            ${KpiCard("Alertas activas", totalAlertas, { icono: "alertas", tono: totalAlertas > 0 ? "warning" : "success" })}
        </div>

        <div class="section">
            <h2>Accesos rápidos</h2>
            <div class="quick-actions">
                ${QuickAction({ titulo: "Colaboradores", icono: "usuarios", href: "#/colaboradores" })}
                ${QuickAction({ titulo: "Locales", icono: "locales", href: "#/locales" })}
                ${QuickAction({ titulo: "Reportes", icono: "reportes", href: "#/reportes" })}
                ${QuickAction({ titulo: "Alertas", icono: "alertas", href: "#/alertas" })}
            </div>
        </div>

        <div class="section grid-2-1">
            <div>
                <h2>Alertas urgentes</h2>
                <div class="cards">${topAlertas.join("") || `<p class="text-muted text-sm">Sin alertas urgentes por ahora.</p>`}</div>
            </div>
            <div>
                <h2>Actividad reciente</h2>
                ${ActivityFeed(actividad)}
            </div>
        </div>
    `;
}
