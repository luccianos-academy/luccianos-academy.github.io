/* ============================
   Lucciano's Academy
   pages/traducciones.js — Traducciones (Admin)

   El diccionario interno: acá el Admin ve qué textos del contenido (lecciones,
   preguntas de examen, tareas, manuales, cursos) todavía no tienen traducción en
   un idioma y los traduce a mano. Cada traducción se guarda en la hoja
   "Traducciones" y es válida para todas las personas apenas se refresca la app:
   no hace falta subir ninguna versión.

   Se opera SIEMPRE en español: lo que se ve en pantalla es el texto original de la
   planilla (la pantalla se marca data-no-traducir) y nunca se escribe una traducción
   sobre el contenido original.

   Los textos de la INTERFAZ (botones, menús, mensajes que están en el código) no
   aparecen acá: esos cambian solo cuando se sube una versión de la app.
=============================*/

import { Header } from "../components/header.js";
import { escaparHtml } from "../services/html.js";
import { IDIOMAS, traduccionesDe, sincronizarTraducciones } from "../i18n/i18n.js";
import { getTraducciones, guardarTraduccion } from "../data/traducciones.js";
import { getLecciones } from "../data/lecciones.js";
import { getEvaluaciones } from "../data/evaluaciones.js";
import { getTareas } from "../data/gestionTareas.js";
import { getManuales } from "../data/manuales.js";
import { getCursos } from "../data/cursos.js";
import { parsearSubitem } from "../services/subitems.js";

const POR_PAGINA = 25;

const TIPOS = [
    { id: "todos", etiqueta: "Todo" },
    { id: "Lecciones", etiqueta: "Lecciones" },
    { id: "Preguntas", etiqueta: "Preguntas de examen" },
    { id: "Tareas", etiqueta: "Tareas" },
    { id: "Otros", etiqueta: "Manuales y cursos" },
];

const estado = { idioma: null, vista: "pendientes", tipo: "todos", q: "", limite: POR_PAGINA };
let textos = [];       // [{ es, tipo, ctx }]
let mapa = new Map();  // es → traducción (idioma elegido)
let existentes = [];   // filas de la hoja

const tieneLetras = (s) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(s);

/** Todos los textos del contenido, sin repetidos, con de dónde salen. */
async function juntarTextos() {
    const [lecciones, preguntas, tareas, manuales, cursos] = await Promise.all([
        getLecciones({ original: true }), getEvaluaciones(), getTareas(), getManuales(), getCursos(),
    ]);
    const vistos = new Map();
    const sumar = (es, tipo, ctx) => {
        const t = String(es || "").trim();
        if (!t || !tieneLetras(t) || vistos.has(t)) return;
        vistos.set(t, { es: t, tipo, ctx });
    };
    const campos = [["titulo", "título"], ["objetivo", "objetivo"], ["procedimiento", "procedimiento"], ["errores", "errores frecuentes"],
        ["buenasPracticas", "buenas prácticas"], ["consejo", "consejo"], ["resumen", "resumen"], ["manualLabel", "texto del enlace"]];
    lecciones.forEach((l) => campos.forEach(([c, nombre]) => sumar(l[c], "Lecciones", `Lección «${l.titulo}» · ${nombre}`)));
    preguntas.forEach((q) => {
        sumar(q.pregunta, "Preguntas", `Pregunta de examen (curso ${q.cursoId})`);
        (q.opciones || []).forEach((o) => sumar(o, "Preguntas", `Opción de «${String(q.pregunta).slice(0, 40)}…»`));
    });
    tareas.forEach((t) => {
        sumar(t.titulo, "Tareas", "Tarea de Gestión");
        sumar(t.detalle, "Tareas", `Detalle de «${t.titulo}»`);
        (t.subitems || []).forEach((s) => sumar(parsearSubitem(s).titulo, "Tareas", `Sub-ítem de «${t.titulo}»`));
    });
    manuales.forEach((m) => { sumar(m.titulo, "Otros", "Título de manual"); sumar(m.categoria, "Otros", "Categoría de manual"); });
    cursos.forEach((c) => { sumar(c.nombre, "Otros", "Nombre de curso"); sumar(c.categoria, "Otros", "Categoría de curso"); });
    return [...vistos.values()];
}

const traduccionDe = (es) => mapa.get(es) ?? mapa.get(es.replace(/\s+/g, " ")) ?? null;

function filaHtml(item, i) {
    const tr = traduccionDe(item.es);
    return `
        <div class="card" style="margin-top:12px;padding:14px" data-fila="${i}">
            <div class="text-xs text-muted" style="margin-bottom:6px">${escaparHtml(item.ctx)}</div>
            <div style="white-space:pre-wrap;font-size:14px;margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,.04)">${escaparHtml(item.es)}</div>
            <textarea data-trad-texto rows="${Math.min(10, Math.max(2, item.es.split("\n").length))}" style="width:100%" placeholder="Traducción…">${escaparHtml(tr ?? "")}</textarea>
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
                <button type="button" class="btn btn-primary" data-trad-guardar>Guardar</button>
                <span class="text-xs text-muted" data-trad-estado>${tr ? "Traducido" : "Sin traducir"}</span>
            </div>
        </div>`;
}

function lista() {
    const q = estado.q.toLowerCase().trim();
    return textos
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => (estado.tipo === "todos" || item.tipo === estado.tipo)
            && (estado.vista === "pendientes" ? traduccionDe(item.es) == null : traduccionDe(item.es) != null)
            && (!q || item.es.toLowerCase().includes(q) || (traduccionDe(item.es) || "").toLowerCase().includes(q)));
}

function pintar() {
    const cont = document.getElementById("trad-contenido");
    if (!cont) return;
    const filtradas = lista();
    const pendientes = textos.filter((t) => traduccionDe(t.es) == null).length;
    document.getElementById("trad-resumen").textContent =
        `${pendientes} sin traducir de ${textos.length} textos · ${textos.length - pendientes} traducidos`;
    document.querySelectorAll("[data-trad-vista]").forEach((b) => b.classList.toggle("activa", b.dataset.tradVista === estado.vista));
    cont.innerHTML = filtradas.length
        ? filtradas.slice(0, estado.limite).map(({ item, i }) => filaHtml(item, i)).join("")
          + (filtradas.length > estado.limite ? `<button type="button" class="btn btn-secondary" data-trad-mas style="margin-top:14px">Mostrar más (${filtradas.length - estado.limite})</button>` : "")
        : `<p class="text-sm text-muted" style="margin-top:16px">${estado.vista === "pendientes" ? "No hay textos sin traducir con este filtro. ✓" : "No hay textos traducidos con este filtro."}</p>`;
}

async function cargarIdioma(idioma) {
    estado.idioma = idioma;
    estado.limite = POR_PAGINA;
    const cont = document.getElementById("trad-contenido");
    if (cont) cont.innerHTML = `<p class="text-sm text-muted" style="margin-top:16px">Cargando…</p>`;
    [mapa, existentes] = await Promise.all([traduccionesDe(idioma), getTraducciones()]);
    document.querySelectorAll("[data-trad-idioma]").forEach((b) => b.classList.toggle("activa", b.dataset.tradIdioma === idioma));
    pintar();
}

export async function Traducciones() {
    textos = await juntarTextos();
    const idiomas = IDIOMAS.filter((i) => i.id !== "es");
    estado.idioma = idiomas[0]?.id || null;
    estado.vista = "pendientes"; estado.tipo = "todos"; estado.q = ""; estado.limite = POR_PAGINA;
    return `
        ${Header("Traducciones", "El diccionario de la app: traducí el contenido a cada idioma")}
        <div data-no-traducir>
            <p class="text-sm text-muted" style="max-width:640px">
                Acá aparecen los textos del contenido (lecciones, preguntas, tareas, manuales y cursos) que todavía no tienen
                traducción. Escribila abajo y tocá <strong>Guardar</strong>: la ve toda la gente apenas refresca la app, sin
                esperar una versión nueva. Si cambiás un texto en español, vuelve a aparecer acá como pendiente.
            </p>
            <div class="fs-seg" id="trad-idiomas" style="margin-top:14px;max-width:420px">
                ${idiomas.map((i) => `<button type="button" class="fs-seg-btn" data-trad-idioma="${i.id}">${escaparHtml(i.etiqueta)}</button>`).join("")}
            </div>
            <div class="fs-seg" style="margin-top:12px;max-width:420px">
                <button type="button" class="fs-seg-btn activa" data-trad-vista="pendientes">Sin traducir</button>
                <button type="button" class="fs-seg-btn" data-trad-vista="traducidos">Traducidos</button>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;max-width:640px">
                <select id="trad-tipo" style="flex:1;min-width:160px">${TIPOS.map((t) => `<option value="${t.id}">${escaparHtml(t.etiqueta)}</option>`).join("")}</select>
                <input id="trad-buscar" type="text" placeholder="Buscar…" style="flex:2;min-width:180px" autocomplete="off">
            </div>
            <p class="text-xs text-muted" id="trad-resumen" style="margin-top:10px"></p>
            <div id="trad-contenido" style="max-width:720px"></div>
        </div>
    `;
}

export function bindTraducciones() {
    if (!estado.idioma) return;
    document.querySelectorAll("[data-trad-idioma]").forEach((b) => b.addEventListener("click", () => cargarIdioma(b.dataset.tradIdioma)));
    document.querySelectorAll("[data-trad-vista]").forEach((b) => b.addEventListener("click", () => { estado.vista = b.dataset.tradVista; estado.limite = POR_PAGINA; pintar(); }));
    document.getElementById("trad-tipo")?.addEventListener("change", (e) => { estado.tipo = e.target.value; estado.limite = POR_PAGINA; pintar(); });
    let espera;
    document.getElementById("trad-buscar")?.addEventListener("input", (e) => {
        clearTimeout(espera);
        espera = setTimeout(() => { estado.q = e.target.value; estado.limite = POR_PAGINA; pintar(); }, 250);
    });
    document.getElementById("trad-contenido")?.addEventListener("click", async (e) => {
        if (e.target.closest("[data-trad-mas]")) { estado.limite += POR_PAGINA; pintar(); return; }
        const btn = e.target.closest("[data-trad-guardar]");
        if (!btn) return;
        const fila = btn.closest("[data-fila]");
        const item = textos[Number(fila.dataset.fila)];
        const ta = fila.querySelector("[data-trad-texto]");
        const texto = ta.value.replace(/\s+$/, "");
        const estadoEl = fila.querySelector("[data-trad-estado]");
        if (!texto.trim()) { alert("Escribí la traducción antes de guardar."); return; }
        // En lecciones cada línea del original es una línea de la traducción (los pasos y sus viñetas).
        if (item.es.includes("\n") && item.es.split("\n").length !== texto.split("\n").length
            && !confirm(`El original tiene ${item.es.split("\n").length} líneas y la traducción ${texto.split("\n").length}. Los pasos numerados se arman por línea. ¿Guardar igual?`)) return;
        btn.disabled = true; estadoEl.textContent = "Guardando…";
        try {
            const r = await guardarTraduccion(estado.idioma, item.es, texto, existentes);
            if (!r?.ok) throw new Error(r?.error || "No se pudo guardar.");
            mapa.set(item.es, texto);
            existentes = await getTraducciones();
            sincronizarTraducciones(true);
            estadoEl.textContent = "Guardado ✓";
            setTimeout(pintar, 600);
        } catch (err) {
            alert(err?.message || "No se pudo guardar — probá de nuevo.");
            estadoEl.textContent = "No se guardó";
        } finally {
            btn.disabled = false;
        }
    });
    cargarIdioma(estado.idioma);
}
