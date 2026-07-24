/* ============================
   FARO v4
   pages/alertas.js — Centro de Alertas

   Cada categoría se deriva de datos reales (data/*.js). Dos
   categorías del pedido original — certificados próximos a vencer
   y firmas pendientes — no tienen respaldo en el modelo de datos
   de 8 hojas (no existe un campo de vencimiento de certificado ni
   un concepto de "firma"): en vez de inventar campos nuevos, se
   muestran como un estado vacío honesto que explica por qué.
=============================*/

import { Header } from "../components/header.js";
import { AlertCard } from "../components/alertCard.js";
import { EmptyState } from "../components/emptyState.js";
import { getUsuarios } from "../data/usuarios.js";
import { getSucursales } from "../data/sucursales.js";
import { getCursos } from "../data/cursos.js";
import { getAsignaciones } from "../data/asignaciones.js";
import { getResultados } from "../data/resultados.js";
import { getAuditoria } from "../data/auditoria.js";

const DIAS_SIN_ACTIVIDAD = 30;

function formatearFecha(fecha) {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (isNaN(d)) return fecha;
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

// "YYYY-MM-DD" es una fecha sin hora — leerla con new Date(str) y
// getMonth()/getFullYear() la corre un día en zonas detrás de UTC
// (ej. Argentina). Comparar sobre el string evita ese problema.
// (auditoria.fecha SÍ trae hora, esa comparación con new Date() es correcta.)
function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function Alertas() {

    const [usuarios, sucursales, cursos, asignaciones, resultados, auditoria] = await Promise.all([
        getUsuarios(), getSucursales(), getCursos(), getAsignaciones(), getResultados(), getAuditoria(),
    ]);

    const hoy = new Date();
    const hoyISO = fechaHoyISO();
    const porId = (lista) => Object.fromEntries(lista.map((x) => [String(x.id), x]));
    const usuariosPorId = porId(usuarios);
    const cursosPorId = porId(cursos);

    // Cursos vencidos: asignación vencida y todavía no completada.
    const cursosVencidos = asignaciones.filter((a) => a.fechaVencimiento && a.fechaVencimiento < hoyISO && a.estado !== "completado");

    // Evaluaciones pendientes: asignación sin resultado cargado.
    const evaluacionesPendientes = asignaciones.filter((a) =>
        !resultados.some((r) => String(r.colaboradorId) === String(a.colaboradorId) && String(r.cursoId) === String(a.cursoId))
    );

    const usuariosInactivos = usuarios.filter((u) => u.activo === "NO");

    // Locales sin auditoría reciente (últimos DIAS_SIN_ACTIVIDAD días),
    // cruzando por la sucursal del usuario que generó cada evento.
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() - DIAS_SIN_ACTIVIDAD);
    const sucursalesConActividad = new Set(
        auditoria
            .filter((a) => new Date(a.fecha) >= limite)
            .map((a) => usuariosPorId[String(a.usuarioId)]?.sucursal)
            .filter(Boolean)
    );
    // Con 99 locales reales pero personal cargado solo en un puñado,
    // esta alerta se acota a los locales que SÍ tienen un supervisor
    // asignado — el resto simplemente todavía no fue dado de alta en
    // el sistema, y no es lo mismo que "sin actividad".
    const localesSinActividad = sucursales.filter((s) => s.supervisor && !sucursalesConActividad.has(s.nombre));

    const tarjetasCursosVencidos = cursosVencidos.map((a) => AlertCard({
        titulo: `Curso vencido: ${cursosPorId[a.cursoId]?.nombre || "—"}`,
        detalle: `${usuariosPorId[a.colaboradorId]?.nombre || "Colaborador"} · venció el ${formatearFecha(a.fechaVencimiento)}`,
        severidad: "danger",
        icono: "warning",
        accionLabel: "Ver colaboradores",
        accionHref: "#/colaboradores",
    })).join("") || vacioCategoria("No hay cursos vencidos.");

    const tarjetasEvaluaciones = evaluacionesPendientes.map((a) => AlertCard({
        titulo: `Evaluación pendiente: ${cursosPorId[a.cursoId]?.nombre || "—"}`,
        detalle: `${usuariosPorId[a.colaboradorId]?.nombre || "Colaborador"} todavía no rindió`,
        severidad: "warning",
        icono: "evaluaciones",
    })).join("") || vacioCategoria("No hay evaluaciones pendientes.");

    const tarjetasInactivos = usuariosInactivos.map((u) => AlertCard({
        titulo: `Usuario inactivo: ${u.nombre}`,
        detalle: u.sucursal || "Sin sucursal asignada",
        severidad: "muted",
        icono: "usuarios",
        accionLabel: "Ver usuarios",
        accionHref: "#/colaboradores",
    })).join("") || vacioCategoria("No hay usuarios inactivos.");

    const tarjetasLocales = localesSinActividad.map((s) => AlertCard({
        titulo: `Sin actividad: ${s.nombre}`,
        detalle: `Ningún evento registrado en los últimos ${DIAS_SIN_ACTIVIDAD} días`,
        severidad: "warning",
        icono: "locales",
        accionLabel: "Ver locales",
        accionHref: "#/locales",
    })).join("") || vacioCategoria("Todos los locales tuvieron actividad reciente.");

    return `
        ${Header("Centro de Alertas", "Todo lo que necesita atención, en un solo lugar")}

        <div class="section">
            <h2>Cursos vencidos</h2>
            <div class="cards">${tarjetasCursosVencidos}</div>
        </div>

        <div class="section">
            <h2>Evaluaciones pendientes</h2>
            <div class="cards">${tarjetasEvaluaciones}</div>
        </div>

        <div class="section">
            <h2>Usuarios inactivos</h2>
            <div class="cards">${tarjetasInactivos}</div>
        </div>

        <div class="section">
            <h2>Locales sin actividad</h2>
            <div class="cards">${tarjetasLocales}</div>
        </div>

        <div class="section">
            <h2>Certificados próximos a vencer</h2>
            ${EmptyState({
                titulo: "Módulo de certificados no disponible",
                detalle: "Esta categoría depende del módulo de Certificaciones, que todavía no existe en el modelo de datos de Lucciano's Academy.",
                icono: "academia",
            })}
        </div>

        <div class="section">
            <h2>Firmas pendientes</h2>
            ${EmptyState({
                titulo: "Módulo de firmas no disponible",
                detalle: "Todavía no existe en Lucciano's Academy un circuito de acuse de recibo / firma digital de políticas.",
                icono: "evaluaciones",
            })}
        </div>
    `;
}

function vacioCategoria(mensaje) {
    return `<p class="text-muted text-sm">${mensaje}</p>`;
}
