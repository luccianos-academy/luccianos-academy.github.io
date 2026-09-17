/* ============================
   Lucciano's Academy
   pages/ranking.js — Ranking del Desafío Diario (Fase 3)

   El mes EN CURSO se calcula en vivo sumando DesafioResultados (no
   hay ninguna tabla de "totales" que se pueda desincronizar). Un mes
   ya CERRADO se lee de DesafioHistorial, la foto congelada que arma
   el cierre de mes (Fase 4, todavía no construida) — hasta que exista
   esa pieza, el selector solo va a mostrar el mes actual.

   Corte real: un Colaborador ve el Top 10 nomás — si no entra ahí, no
   aparece en ningún lado de esta pantalla, ni con un aviso de "quedaste
   13°" (decisión ya cerrada con el usuario). El Admin ve la lista
   completa, puede excluir a alguien del ranking EN CURSO (nunca del
   podio 1°-3°) y reincluirlo después — la exclusión persiste en
   Usuarios.excluidoDesafio hasta que el Admin la revierta.

   Puntaje = 10 por correcta (ya viene sumado en cada fila de
   DesafioResultados). Empate de puntos en el mes → desempata el
   tiempo TOTAL usado en el mes (menor tiempo gana), mismo criterio
   "tiempo como desempate" ya cerrado para un intento individual.
=============================*/

import { Header } from "../components/header.js";
import { EmptyState } from "../components/emptyState.js";
import { Avatar } from "../components/avatar.js";
import { getUsuarios, actualizarUsuario } from "../data/usuarios.js";
import { getDesafioResultados, getDesafioHistorial, mesActualISO } from "../data/desafio.js";
import { getUsuarioActual } from "../services/auth.js";

const TOP_VISIBLE = 10;
const MEDALLAS = ["🥇", "🥈", "🥉"];

// Estado cargado una sola vez en Ranking() — cambiar de mes en el
// <select> solo re-renderiza, no vuelve a pedir datos (mismo criterio
// que examen.js/desafio.js: estado en el módulo, no en el DOM).
let mesesDisponibles = [];
let datosPorMes = {};
let mesActivo = "";
let esAdminActivo = false;

function nombreMes(anioMes) {
    const [anio, mes] = anioMes.split("-").map(Number);
    const d = new Date(anio, mes - 1, 1);
    const nombre = d.toLocaleDateString("es-AR", { month: "long" });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function diasHastaFinDeMes() {
    const hoy = new Date();
    const finDeMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const msPorDia = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.ceil((finDeMes - hoy) / msPorDia));
}

/** Ranking del mes EN CURSO, sumando DesafioResultados en vivo.
 *  Separa "activos" de "excluidos" (en vez de filtrar de una) para
 *  que el panel de Admin pueda listar a quién reincluir sin tener
 *  que volver a pedir datos. */
function armarRankingEnVivo(resultados, usuarios, mes) {
    const totales = {};
    resultados.filter((r) => r.fecha.startsWith(mes)).forEach((r) => {
        if (!totales[r.colaboradorId]) totales[r.colaboradorId] = { puntos: 0, tiempo: 0 };
        totales[r.colaboradorId].puntos += r.puntos;
        totales[r.colaboradorId].tiempo += r.tiempoUsado;
    });

    const usuariosPorId = Object.fromEntries(usuarios.map((u) => [String(u.id), u]));

    const todos = Object.entries(totales).map(([colaboradorId, t]) => {
        const u = usuariosPorId[String(colaboradorId)];
        return {
            colaboradorId,
            nombre: u ? u.nombre : "Colaborador",
            sucursal: u ? u.sucursal : "",
            foto: u ? u.foto : "",
            puntos: t.puntos,
            tiempo: t.tiempo,
            excluido: u ? u.excluidoDesafio : false,
        };
    }).sort((a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo);

    return {
        activos: todos.filter((p) => !p.excluido),
        excluidos: todos.filter((p) => p.excluido),
    };
}

/** Un mes ya cerrado: la foto que dejó el cierre de mes, ordenada por
 *  el puesto que quedó congelado ahí (no se recalcula con datos de
 *  hoy — nombre/sucursal sí se toman de Usuarios actual). */
function armarRankingHistorico(historial, usuarios, mes) {
    const usuariosPorId = Object.fromEntries(usuarios.map((u) => [String(u.id), u]));
    const activos = historial
        .filter((f) => f.mes === mes)
        .map((f) => {
            const u = usuariosPorId[String(f.colaboradorId)];
            return {
                colaboradorId: f.colaboradorId,
                nombre: u ? u.nombre : "Colaborador",
                sucursal: u ? u.sucursal : "",
                foto: u ? u.foto : "",
                puntos: f.puntos,
                puesto: f.puesto,
                tiempo: 0,
            };
        })
        .sort((a, b) => a.puesto - b.puesto || b.puntos - a.puntos);
    return { activos, excluidos: [] };
}

export async function Ranking() {
    const usuario = getUsuarioActual();
    esAdminActivo = usuario.rol === "admin";

    const [usuarios, resultados, historial] = await Promise.all([
        getUsuarios(),
        getDesafioResultados(),
        getDesafioHistorial(),
    ]);

    const mesActual = mesActualISO();
    const mesesHistorial = [...new Set(historial.map((f) => f.mes))]
        .filter((m) => m !== mesActual)
        .sort((a, b) => b.localeCompare(a));

    mesesDisponibles = [
        { clave: mesActual, label: nombreMes(mesActual), enCurso: true },
        ...mesesHistorial.map((m) => ({ clave: m, label: nombreMes(m), enCurso: false })),
    ];

    datosPorMes = { [mesActual]: armarRankingEnVivo(resultados, usuarios, mesActual) };
    mesesHistorial.forEach((m) => {
        datosPorMes[m] = armarRankingHistorico(historial, usuarios, m);
    });

    mesActivo = mesActual;

    return `
        ${Header("Ranking del Desafío Diario", "El Top 3 de cada mes gana el premio.")}
        ${mesesDisponibles.length > 1 ? `
            <select class="selector-mes" id="ranking-selector-mes">
                ${mesesDisponibles.map((m) => `<option value="${m.clave}">${m.label}</option>`).join("")}
            </select>
        ` : ""}
        <div id="ranking-cuerpo"></div>
    `;
}

function filaHtml(persona, i, puedeExcluir) {
    const esTop3 = i < 3;
    return `
        <div class="fila-ranking${esTop3 ? " top3" : ""}${persona.soyYo ? " yo" : ""}">
            <span class="puesto${esTop3 ? " medalla" : ""}">${esTop3 ? MEDALLAS[i] : i + 1}</span>
            ${Avatar({ nombre: persona.nombre, foto: persona.foto, size: "sm" })}
            <span class="datos-ranking">
                <span class="nombre-ranking">${persona.nombre}</span>
                ${persona.sucursal ? `<span class="sucursal-ranking">${persona.sucursal}</span>` : ""}
            </span>
            <span class="puntos-ranking">${persona.puntos} pts</span>
            ${puedeExcluir && !esTop3 ? `<button class="boton-excluir" data-excluir="${persona.colaboradorId}">Excluir</button>` : ""}
        </div>
    `;
}

function renderCuerpoRanking() {
    const cont = document.getElementById("ranking-cuerpo");
    if (!cont) return;

    const infoMes = mesesDisponibles.find((m) => m.clave === mesActivo);
    const datos = datosPorMes[mesActivo] || { activos: [], excluidos: [] };
    const usuario = getUsuarioActual();

    if (!datos.activos.length) {
        cont.innerHTML = EmptyState({
            titulo: "Todavía nadie jugó este mes",
            detalle: infoMes?.enCurso ? "En cuanto alguien juegue el Desafío Diario, va a aparecer acá." : "Este mes se cerró sin participantes.",
        });
        return;
    }

    // Colaborador: marca su propia fila si está en el Top 10 — si no
    // entra, no aparece en ningún lado de esta lista (decisión ya
    // cerrada, no hay aviso de "quedaste 13°").
    const conYo = datos.activos.map((p) => ({ ...p, soyYo: !esAdminActivo && String(p.colaboradorId) === String(usuario.id) }));
    const lista = esAdminActivo ? conYo : conYo.slice(0, TOP_VISIBLE);

    const filasHtml = lista.map((p, i) => {
        // Solo en modo Admin, cuando hay más de 10: marca exactamente
        // dónde termina lo que ve un colaborador común.
        const separador = esAdminActivo && i === TOP_VISIBLE && lista.length > TOP_VISIBLE
            ? `<div class="separador-corte">Acá termina lo que ve un colaborador</div>` : "";
        return separador + filaHtml(p, i, esAdminActivo && infoMes?.enCurso);
    }).join("");

    const excluidosHtml = (esAdminActivo && infoMes?.enCurso && datos.excluidos.length) ? `
        <div class="panel-excluidos">
            <p class="text-xs text-muted">Excluidos este mes (${datos.excluidos.length})</p>
            ${datos.excluidos.map((p) => `
                <div class="fila-ranking">
                    ${Avatar({ nombre: p.nombre, foto: p.foto, size: "sm" })}
                    <span class="datos-ranking">
                        <span class="nombre-ranking">${p.nombre}</span>
                        ${p.sucursal ? `<span class="sucursal-ranking">${p.sucursal}</span>` : ""}
                    </span>
                    <span class="puntos-ranking">${p.puntos} pts</span>
                    <button class="boton-excluir" data-reincluir="${p.colaboradorId}">Reincluir</button>
                </div>
            `).join("")}
        </div>
    ` : "";

    cont.innerHTML = `
        <div class="ranking-header">
            <h2>${infoMes.label}</h2>
            <p>${infoMes.enCurso ? `Termina en ${diasHastaFinDeMes()} días` : "Cerrado — el premio ya se entregó"}</p>
            ${esAdminActivo ? `<p class="resumen-admin">${datos.activos.length} colaborador${datos.activos.length === 1 ? "" : "es"} participaron este mes${datos.excluidos.length ? ` · ${datos.excluidos.length} excluido${datos.excluidos.length === 1 ? "" : "s"}` : ""}</p>` : ""}
        </div>
        <div class="lista-ranking">${filasHtml}</div>
        ${excluidosHtml}
        <p class="nota-premio">Puestos 1° a 3° ganan el premio del mes</p>
    `;

    cont.querySelectorAll("[data-excluir]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.excluir;
            btn.disabled = true;
            try {
                // El backend puede rechazar la escritura (ej. permisos)
                // sin lanzar excepción — sin chequear ok, esto quedaba
                // "excluido" en pantalla aunque nunca se hubiera
                // guardado en Usuarios (mismo defecto ya corregido en
                // pages/desafio.js).
                const resultado = await actualizarUsuario(id, { excluidoDesafio: "SI" });
                if (!resultado || !resultado.ok) throw new Error((resultado && resultado.error) || "El backend rechazó el cambio");
                const persona = datos.activos.find((p) => String(p.colaboradorId) === String(id));
                datos.activos = datos.activos.filter((p) => String(p.colaboradorId) !== String(id));
                if (persona) { persona.excluido = true; datos.excluidos.push(persona); }
                renderCuerpoRanking();
            } catch (err) {
                btn.disabled = false;
                alert("No se pudo excluir: " + (err.message || "revisá tu conexión e intentá de nuevo."));
            }
        });
    });

    cont.querySelectorAll("[data-reincluir]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.reincluir;
            btn.disabled = true;
            try {
                const resultado = await actualizarUsuario(id, { excluidoDesafio: "NO" });
                if (!resultado || !resultado.ok) throw new Error((resultado && resultado.error) || "El backend rechazó el cambio");
                const persona = datos.excluidos.find((p) => String(p.colaboradorId) === String(id));
                datos.excluidos = datos.excluidos.filter((p) => String(p.colaboradorId) !== String(id));
                if (persona) { persona.excluido = false; datos.activos.push(persona); datos.activos.sort((a, b) => b.puntos - a.puntos || a.tiempo - b.tiempo); }
                renderCuerpoRanking();
            } catch (err) {
                btn.disabled = false;
                alert("No se pudo reincluir: " + (err.message || "revisá tu conexión e intentá de nuevo."));
            }
        });
    });
}

export function bindRanking() {
    document.getElementById("ranking-selector-mes")?.addEventListener("change", (e) => {
        mesActivo = e.target.value;
        renderCuerpoRanking();
    });
    renderCuerpoRanking();
}
