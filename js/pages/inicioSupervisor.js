/* ============================
   FARO v4
   pages/inicioSupervisor.js — Home del Supervisor

   Todo acotado a los locales del supervisor en sesión — nunca ve
   datos de otras sucursales ni accesos globales (Configuración,
   Integraciones, Reportes no existen en su menú).

   Excepción: un Capacitador (Supervisor con capacitador:true) es de
   solo lectura en toda la app y ve la red completa acá también — así
   puede seguir el desarrollo de la capacitación en todos los locales,
   no solo el suyo (ver data/sucursales.js: getLocalesVisibles).
=============================*/

import { Header } from "../components/header.js";
import { KpiCard } from "../components/kpiCard.js";
import { RankingCard } from "../components/rankingCard.js";
import { AlertCard } from "../components/alertCard.js";
import { ActivityFeed } from "../components/activityFeed.js";
import { QuickAction } from "../components/quickAction.js";
import { getUsuarios } from "../data/usuarios.js";
import { getLocalesVisibles } from "../data/sucursales.js";
import { getLocalesElegidos } from "../services/preferenciasLocales.js";
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

/** % real del camino completo de UNA persona — sobre el total de
 *  cursos que le corresponden (mismo filtro de "Gestión" que usa
 *  cursos.js), no solo los que ya arrancó. Una asignación recién se
 *  crea cuando la persona ve su primera lección de ese curso (ver
 *  cursos.js) — promediar solo esas filas infla el número (1 curso
 *  terminado de 8 daba "100%" en vez de ~13%). Mismo criterio que
 *  pages/colaboradores.js/reportes.js. */
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

/** Promedio del equipo = promedio de los % individuales (no de las
 *  filas de asignación sueltas) — así cada persona pesa lo mismo sin
 *  importar cuántos cursos arrancó. */
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

export async function InicioSupervisor() {

    const usuario = getUsuarioActual();
    const [usuarios, cursos, asignaciones, resultados, auditoria] = await Promise.all([
        getUsuarios(), getCursos(), getAsignaciones(), getResultados(), getAuditoria(),
    ]);

    const hoyISO = fechaHoyISO();
    // Array de nombres (no de filas) — mismo criterio que "Mi equipo"
    // en pages/colaboradores.js, incluido el fallback a Usuarios.sucursal.
    // Un capacitador ve TODA la red acá (getLocalesVisibles), no solo
    // "su" local — es de solo lectura, no hay ninguna acción de
    // gestión en esta pantalla que haya que blindar aparte. Si eligió
    // locales puntuales (ver services/preferenciasLocales.js, mismo
    // picker que en "Mi equipo"), el panorama se acota a esos.
    let misLocales = await getLocalesVisibles(usuario);
    let cantidadLocalesElegidos = 0; // ver Header más abajo
    if (usuario.capacitador) {
        const elegidos = getLocalesElegidos(usuario);
        cantidadLocalesElegidos = elegidos.length;
        if (elegidos.length) misLocales = misLocales.filter((n) => elegidos.includes(n));
    }
    const equipo = usuarios.filter((u) => u.rol === "colaborador" && misLocales.includes(u.sucursal));
    const equipoIds = equipo.map((c) => String(c.id));
    const cursosPorId = Object.fromEntries(cursos.map((c) => [String(c.id), c]));

    const sinAcceso = equipo.filter((c) => c.activo === "NO").length;
    const conAcceso = equipo.length - sinAcceso;

    const asignacionesEquipo = asignaciones.filter((a) => equipoIds.includes(String(a.colaboradorId)));

    // Promedio combinado de TODO el equipo (todos los locales juntos si
    // supervisa más de uno) — el desglose por local ya lo da el ranking
    // de más abajo, esto es solo el pulso general de un vistazo.
    const promedioEquipo = promedioDeGrupo(equipo, asignaciones, cursos);
    const evaluacionesPendientes = asignacionesEquipo.filter((a) => !resultados.some((r) => String(r.colaboradorId) === String(a.colaboradorId) && String(r.cursoId) === String(a.cursoId)));

    const cursosVencidos = asignacionesEquipo.filter((a) => a.fechaVencimiento && a.fechaVencimiento < hoyISO && a.estado !== "completado");
    const usuariosPorId = Object.fromEntries(equipo.map((u) => [String(u.id), u]));

    const alertas = [
        ...cursosVencidos.slice(0, 2).map((a) => AlertCard({
            titulo: `Curso vencido: ${cursosPorId[a.cursoId]?.nombre || "—"}`,
            detalle: usuariosPorId[a.colaboradorId]?.nombre || "Colaborador",
            severidad: "danger",
            icono: "warning",
        })),
        ...equipo.filter((c) => c.activo === "NO").slice(0, 1).map((c) => AlertCard({
            titulo: `Sin acceso: ${c.nombre}`,
            detalle: "Pendiente de renovar acceso",
            severidad: "muted",
            icono: "usuarios",
            accionLabel: "Ver equipo",
            accionHref: "#/colaboradores",
        })),
    ].slice(0, 3);

    // Para un capacitador, misLocales trae TODA la red (~95, la
    // mayoría sin nadie cargado) — el ranking solo tiene sentido con
    // los locales que de verdad tienen equipo, así no se llena de
    // filas "Sin datos".
    const localesConEquipo = usuario.capacitador
        ? [...new Set(equipo.map((c) => c.sucursal).filter(Boolean))]
        : misLocales;

    const rankingLocales = localesConEquipo.length > 1
        ? RankingCard({
            titulo: usuario.capacitador ? "Ranking de locales de la red" : "Ranking de mis locales",
            items: localesConEquipo
                .map((nombre) => ({ nombre, promedio: promedioSucursal(nombre, usuarios, asignaciones, cursos) }))
                .sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1))
                .map((l, i) => ({ posicion: i + 1, nombre: l.nombre, valor: l.promedio === null ? "Sin datos" : `${l.promedio}%` })),
        })
        : "";

    const actividad = auditoria
        .filter((a) => equipoIds.includes(String(a.usuarioId)) || String(a.usuarioId) === String(usuario.id))
        .slice(0, 5)
        .map((a) => ({ fecha: a.fecha, texto: a.detalle }));

    return `
        ${Header(`Bienvenido/a, ${usuario.nombre}`, usuario.capacitador ? (cantidadLocalesElegidos ? `${cantidadLocalesElegidos} local(es) elegido(s) · Solo lectura` : "Toda la red · Solo lectura") : (misLocales.join(", ") || "Sin local asignado"), { saludo: true })}

        <div class="cards">
            ${KpiCard("Mi equipo", equipo.length, { icono: "usuarios", ayuda: "Cantidad total de colaboradores en tus locales." })}
            ${KpiCard("Con acceso", conAcceso, { icono: "check", tono: "success", ayuda: "Colaboradores que hoy pueden entrar a la app — su acceso está activo y no venció." })}
            ${KpiCard("Sin acceso", sinAcceso, { icono: "warning", tono: sinAcceso > 0 ? "danger" : "neutral", ayuda: "Colaboradores cuyo acceso venció o fue desactivado — no pueden entrar hasta que se lo renueven." })}
            ${KpiCard("Promedio del equipo", promedioEquipo === null ? "Sin datos" : `${promedioEquipo}%`, { icono: "dashboard", tono: promedioEquipo === null ? "neutral" : promedioEquipo < 30 ? "danger" : promedioEquipo < 60 ? "warning" : "success", ayuda: "Promedio de lecciones vistas en los cursos asignados a todo tu equipo. Mide avance, no si aprobaron las evaluaciones — para eso, mirá el detalle en Mi equipo." })}
        </div>

        <div class="section">
            <div class="quick-actions">
                ${QuickAction({ titulo: "Ver mi equipo", icono: "usuarios", href: "#/colaboradores" })}
            </div>
        </div>

        <div class="section grid-2-1">
            <div>
                <h2>Alertas de mi equipo</h2>
                <div class="cards">${alertas.join("") || `<p class="text-muted text-sm">Sin alertas por ahora.</p>`}</div>

                ${evaluacionesPendientes.length ? `
                    <div class="section">
                        <h2>Evaluaciones por realizar</h2>
                        <p class="text-sm text-muted">${evaluacionesPendientes.length} asignación(es) todavía sin evaluación cargada.</p>
                    </div>
                ` : ""}

                ${rankingLocales ? `<div class="section">${rankingLocales}</div>` : ""}
            </div>
            <div>
                <h2>Últimas actividades</h2>
                ${ActivityFeed(actividad)}
            </div>
        </div>
    `;
}
