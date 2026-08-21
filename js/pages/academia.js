/* ============================
   Lucciano's Academy
   pages/academia.js — Gestión de Academia (Admin)

   Gestión de cursos + lecciones. La experiencia de "Academia" para
   Colaborador/Encargado sigue siendo pages/cursos.js (grid de
   CourseCard con progreso) — esta pantalla es la contraparte de
   gestión, ruta separada (#/academia), sin tocar cursos.js.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { getCursos, crearCurso, eliminarCurso } from "../data/cursos.js";
import { getLecciones, getLeccionesPorCurso, crearLeccion, actualizarLeccion, eliminarLeccion } from "../data/lecciones.js";
import { getPreguntasPorCurso, eliminarPregunta } from "../data/evaluaciones.js";
import { getAsignaciones, eliminarAsignacion } from "../data/asignaciones.js";
import { getResultados, eliminarResultado } from "../data/resultados.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { escaparHtml } from "../services/html.js";
import { getDisponibilidad, mapaDisponibilidad } from "../data/disponibilidad.js";
import { MultiSelectAlcance, bindMultiSelectAlcance } from "../components/multiSelectAlcance.js";
import { aplicaAlUsuario } from "../services/alcance.js";
import { Icon } from "../components/icons.js";
import { gasRequest } from "../services/google.js";

/**
 * Editor único de lección — página completa (#/academialeccion), no
 * modal: mismo patrón que "Nueva News" (pages/news.js). Reemplaza dos
 * cosas que existían separadas: el "lápiz por bloque" que editaba de a
 * un campo por vez (components/leccionEditable.js, eliminado) y el
 * formulario técnico aparte (video/manual/imagen/orden). Pedido
 * explícito: "como maneja whatsapp, limpio y ordenado, sin vueltas" —
 * todo el contenido a la vista de entrada, un solo Guardar.
 *
 * El Procedimiento deja de ser una caja de texto libre que
 * components/procedimiento.js debía ADIVINAR cómo mostrar (bullets,
 * saltos de línea, "Nombre: detalle"...). Acá se edita como una lista
 * real de pasos y se guarda siempre en el formato explícito
 * "1) ... 2) ..." que ya existe y ya se renderiza como lista numerada
 * (ver renderPasosNumerados) — sin tocar cursos.js ni procedimiento.js.
 */
function pasosDeProcedimiento(texto) {
    const t = String(texto || "").trim();
    if (!t) return [""];
    if (/^1\)\s/.test(t)) {
        const pasos = t.split(/\s*\d+\)\s*/).map((s) => s.trim()).filter(Boolean)
            .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s));
        if (pasos.length) return pasos;
    }
    // Texto viejo sin el formato explícito de pasos: se muestra entero
    // como un único paso para no perder nada ya cargado — se puede
    // partir a mano con "+ Agregar paso".
    return [t];
}

function procedimientoATexto(pasos) {
    const limpios = pasos.map((p) => p.trim()).filter(Boolean);
    return limpios.map((p, i) => `${i + 1}) ${p.replace(/\.$/, "")}.`).join(" ");
}

/** Misma tarjeta tanto al dibujar el estado inicial como al agregar un
 *  paso nuevo por JS — una sola fuente para el markup. */
function pasoHtml(texto, i) {
    return `
        <div class="paso-item" style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;margin-bottom:10px;background:var(--card);border-radius:8px;border:1px solid var(--line)">
            <span class="paso-num" style="flex:0 0 26px;height:26px;border-radius:50%;background:var(--gold-soft);color:var(--gold-deep);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;margin-top:2px">${i + 1}</span>
            <textarea class="input-paso-texto" rows="2" placeholder="Describí este paso..." style="flex:1;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;resize:vertical">${escaparHtml(texto)}</textarea>
            <button type="button" class="btn-eliminar-paso" aria-label="Eliminar este paso" style="flex:0 0 auto;padding:8px 11px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:15px;font-weight:bold;margin-top:2px">×</button>
        </div>
    `;
}

function camposLeccionEditorHtml(l = {}) {
    const pasos = pasosDeProcedimiento(l.procedimiento);
    return `
        <div class="form-seccion">
            <div class="form-seccion-head">
                <span class="form-seccion-ico">${Icon("academia", { size: 18 })}</span>
                <h3>1. Contenido</h3>
            </div>

            <label for="input-titulo" style="margin-top:0">Título</label>
            <input type="text" id="input-titulo" placeholder="Título de la lección" value="${escaparHtml(l.titulo || "")}">

            <label for="input-objetivo">Objetivo</label>
            <input type="text" id="input-objetivo" placeholder="¿Qué va a aprender el colaborador?" value="${escaparHtml(l.objetivo || "")}">

            <label style="margin-top:16px">Procedimiento — paso a paso</label>
            <div id="lista-pasos" class="pasos-lista">${pasos.map((p, i) => pasoHtml(p, i)).join("")}</div>
            <button type="button" id="btn-agregar-paso" class="btn btn-secondary">+ Agregar paso</button>

            <label for="input-errores" style="margin-top:20px">Errores frecuentes</label>
            <textarea id="input-errores" rows="3" placeholder="Qué se suele hacer mal...">${l.errores || ""}</textarea>

            <label for="input-buenasPracticas">Buenas prácticas</label>
            <textarea id="input-buenasPracticas" rows="3">${l.buenasPracticas || ""}</textarea>

            <label for="input-consejo">Consejo</label>
            <textarea id="input-consejo" rows="2">${l.consejo || ""}</textarea>

            <label for="input-resumen">Resumen</label>
            <textarea id="input-resumen" rows="2">${l.resumen || ""}</textarea>
        </div>

        <div class="form-seccion">
            <div class="form-seccion-head">
                <span class="form-seccion-ico">${Icon("reportes", { size: 18 })}</span>
                <h3>2. Adjuntos</h3>
            </div>
            <p class="form-seccion-sub">Subilos directo, o pegá el link si ya lo tenés en Drive.</p>

            <label for="input-video" style="margin-top:0">Video</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
                <input type="text" id="input-video" placeholder="https://drive.google.com/..." value="${escaparHtml(l.video || "")}">
                <input type="file" id="input-video-archivo" accept="video/*" style="display:none">
                <button type="button" id="btn-subir-video" class="btn btn-secondary">📤 Subir</button>
            </div>

            <label for="input-imagen" style="margin-top:16px">Imagen</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
                <input type="text" id="input-imagen" placeholder="https://..." value="${escaparHtml(l.imagen || "")}">
                <input type="file" id="input-imagen-archivo" accept="image/*" style="display:none">
                <button type="button" id="btn-subir-imagen" class="btn btn-secondary">📤 Subir</button>
            </div>
            <div id="preview-imagen" style="margin-top:10px">${l.imagen ? `<img src="${escaparHtml(l.imagen)}" alt="" style="width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">` : ""}</div>

            <label for="input-manual" style="margin-top:16px">Manual</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center">
                <input type="text" id="input-manual" placeholder="https://... o una nota" value="${escaparHtml(l.manual || "")}">
                <input type="file" id="input-manual-archivo" accept=".pdf,.doc,.docx,.ppt,.pptx" style="display:none">
                <button type="button" id="btn-subir-manual" class="btn btn-secondary">📤 Subir</button>
            </div>
            <label for="input-manualLabel">Texto del botón del manual <span class="text-xs text-muted" style="font-weight:400">(opcional)</span></label>
            <input type="text" id="input-manualLabel" placeholder="Si se deja vacío, dice &quot;Ver manual&quot;" value="${escaparHtml(l.manualLabel || "")}">
        </div>

        <div class="form-seccion">
            <div class="form-seccion-head">
                <span class="form-seccion-ico">${Icon("configuracion", { size: 18 })}</span>
                <h3>3. Ajustes</h3>
            </div>

            <div class="form-cols-2">
                <div class="form-col">
                    <label for="input-duracion" style="margin-top:0">Duración (minutos)</label>
                    <input type="number" id="input-duracion" min="0" value="${l.duracionMinutos || ""}">

                    <label for="input-orden">Orden <span class="text-xs text-muted" style="font-weight:400">(ej. 16.5 la mete entre la 16 y la 17)</span></label>
                    <input type="number" id="input-orden" step="0.5" value="${l.orden ?? ""}">
                </div>
                <div class="form-col">
                    <label class="toggle-switch" style="margin-top:0">
                        Obligatoria
                        <input type="checkbox" id="input-obligatoria" ${l.obligatoria !== "NO" ? "checked" : ""}>
                    </label>
                    <p class="text-xs text-muted" style="margin-top:6px;margin-bottom:0">Destildá esto para contenido de referencia que no todos necesitan (ej. una máquina que no todos los locales tienen). Queda visible igual, pero sin botón de "Marcar como vista" y sin contar para el % de progreso ni el examen.</p>

                    <label class="toggle-switch" style="margin-top:20px">
                        Activa
                        <input type="checkbox" id="input-activa" ${l.estado !== "Inactivo" ? "checked" : ""}>
                    </label>
                    <p class="text-xs text-muted" style="margin-top:6px;margin-bottom:0">Inactiva = no aparece en el curso, sin borrarla.</p>
                </div>
            </div>
            ${l.id ? `<p class="text-xs text-muted" style="margin-top:16px;margin-bottom:0">ID de esta lección: <strong>${l.id}</strong> — se pide al pedir soporte para engancharle fotos o video especiales (carrusel, decoración) que este formulario no cubre.</p>` : ""}
        </div>
    `;
}

function leerCamposLeccionEditor() {
    const pasos = Array.from(document.querySelectorAll(".input-paso-texto")).map((t) => t.value);
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        objetivo: document.getElementById("input-objetivo").value.trim(),
        procedimiento: procedimientoATexto(pasos),
        errores: document.getElementById("input-errores").value.trim(),
        buenasPracticas: document.getElementById("input-buenasPracticas").value.trim(),
        consejo: document.getElementById("input-consejo").value.trim(),
        resumen: document.getElementById("input-resumen").value.trim(),
        video: document.getElementById("input-video").value.trim(),
        imagen: document.getElementById("input-imagen").value.trim(),
        manual: document.getElementById("input-manual").value.trim(),
        manualLabel: document.getElementById("input-manualLabel").value.trim(),
        duracionMinutos: Number(document.getElementById("input-duracion").value) || 0,
        orden: Number(document.getElementById("input-orden").value) || 0,
        obligatoria: document.getElementById("input-obligatoria").checked ? "SI" : "NO",
        estado: document.getElementById("input-activa").checked ? "Activo" : "Inactivo",
    };
}

/**
 * Cómo se ve el alcance en la tabla.
 *
 * Mira los DOS campos. Antes sólo leía la restricción, así que una
 * variante acotada por inclusión —la copia que hace "Duplicar para…"—
 * se mostraba como "Todos", que es exactamente lo contrario de lo que
 * pasa. Y la original, ya excluida de un país, mostraba el nombre de ese
 * país sin decir si era el único que la ve o el único que no.
 *
 * "Todos" queda en gris: es el caso normal y no tiene que competir con
 * los pocos acotados, que son los que hay que revisar.
 */
function etiquetaAlcance(aplicaA, noAplicaA) {
    const corto = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean)
        .map((s) => escaparHtml(s.replace("Lucciano's ", "")));

    const solo = corto(aplicaA);
    const menos = corto(noAplicaA);
    if (!solo.length && !menos.length) return `<span class="text-sm text-muted">Todos</span>`;

    // Con más de dos se corta: la columna no puede crecer sin empujar
    // las acciones fuera de pantalla. El detalle está a un clic.
    const resumir = (lista) => lista.slice(0, 2).join(", ") + (lista.length > 2 ? ` +${lista.length - 2}` : "");

    // Distinto peso visual a propósito. La variante es la que hay que
    // mirar —es contenido nuevo, acotado— y va con badge. La original
    // excluida es el caso normal cuando existe una variante, así que va
    // en gris chico: informa sin gritar.
    //
    // Lo que NO se hace es mostrar "Todos" en la original. Sería más
    // limpio y es tentador porque la variante suele estar al lado, pero
    // el dato vive en la lección, no en la pareja: si se borra la
    // variante, la original SIGUE excluyendo a ese país y la pantalla
    // estaría afirmando que le llega a todos. Ese error se descubre
    // meses después, cuando alguien reclama que nunca vio algo.
    const partes = [];
    if (solo.length) partes.push(`<span class="badge badge-success">Solo ${resumir(solo)}</span>`);
    if (menos.length) partes.push(`<span class="text-xs text-muted">excepto ${resumir(menos)}</span>`);
    return partes.join(" ");
}

export async function Academia() {

    const [cursos, lecciones, disponibilidad] = await Promise.all([
        getCursos(), getLecciones(), getDisponibilidad(),
    ]);

    const columnas = [
        { key: "nombre", label: "Curso" },
        { key: "categoria", label: "Categoría" },
        { key: "obligatorioLabel", label: "Obligatorio" },
        { key: "leccionesLabel", label: "Lecciones" },
        { key: "alcanceLabel", label: "Restricciones" },
        { key: "acciones", label: "" },
    ];

    const filas = cursos.map((c) => ({
        ...c,
        obligatorioLabel: c.obligatorio ? "Sí" : "No",
        leccionesLabel: lecciones.filter((l) => String(l.cursoId) === String(c.id)).length,
        // Se muestra como columna y no escondido en el menú: la
        // pregunta "¿a quién le llega este curso?" es justo la que no
        // se puede contestar mirando la tabla, y un curso acotado por
        // error es invisible hasta que alguien reclama que no lo ve.
        // Dos cosas distintas en la misma celda: a quién le llega el
        // CURSO, y cuántos de sus productos tienen la venta acotada.
        // Sin lo segundo, un curso con media línea restringida se veía
        // igual que uno sin ninguna restricción, y había que entrar al
        // catálogo de cada uno para enterarse.
        alcanceLabel: etiquetaAlcance(c.aplicaA, c.noAplicaA) + (() => {
            const n = mapaDisponibilidad(disponibilidad, c.nombre).size;
            return n
                ? `<div class="text-xs text-muted" style="margin-top:4px">${n} producto${n === 1 ? "" : "s"} acotado${n === 1 ? "" : "s"}</div>`
                : "";
        })(),
        acciones: `
            <a class="btn btn-secondary" href="#/cursos/${c.id}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa</a>
            <button class="btn btn-secondary" data-ver-lecciones="${c.id}">Ver lecciones</button>
            <button class="btn btn-secondary" data-eliminar-curso="${c.id}">Eliminar</button>
        `,
    }));

    return `
        ${Header("Academia", "Cursos y lecciones de la plataforma")}

        <div class="table-toolbar">
            <div></div>
            <button class="btn btn-primary" id="btn-nuevo-curso">+ Nuevo curso</button>
        </div>

        <div id="tabla-cursos">
            ${Table(columnas, filas)}
        </div>

        <!-- La columna informa, pero acá no se edita: quién ve qué se
             configura desde el local, en una sola pantalla junto con
             sus lecciones y su catálogo. Sin este cartel, la columna
             invita a buscar un botón que ya no está. -->
        <p class="text-sm text-muted" style="margin-top:14px">
            Para cambiar qué ve cada local: <a href="#/locales">Locales</a> → tildá los locales → "Contenido que tienen".
        </p>
    `;
}

export function bindAcademia() {

    document.querySelectorAll("[data-ver-lecciones]").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalLecciones(btn.dataset.verLecciones));
    });

    document.querySelectorAll("[data-eliminar-curso]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const cursoId = btn.dataset.eliminarCurso;

            // Mismo cuidado que "Eliminar" de un usuario (colaboradores.js):
            // borrar solo la fila de Cursos deja lecciones, preguntas,
            // asignaciones y resultados huérfanos apuntando a un id que
            // ya no existe.
            const [lecciones, preguntas, asignaciones, resultados] = await Promise.all([
                getLeccionesPorCurso(cursoId),
                getPreguntasPorCurso(cursoId),
                getAsignaciones().then((as) => as.filter((a) => String(a.cursoId) === String(cursoId))),
                getResultados().then((rs) => rs.filter((r) => String(r.cursoId) === String(cursoId))),
            ]);

            const partes = [];
            if (lecciones.length) partes.push(`${lecciones.length} lección(es)`);
            if (preguntas.length) partes.push(`${preguntas.length} pregunta(s) de examen`);
            if (asignaciones.length) partes.push(`${asignaciones.length} asignación(es)`);
            if (resultados.length) partes.push(`${resultados.length} resultado(s) de examen de colaboradores`);
            const detalle = partes.length ? ` Se borra también, de forma PERMANENTE: ${partes.join(", ")}.` : "";

            if (!confirm(`¿Eliminar este curso?${detalle} Esta acción no se puede deshacer.`)) return;

            await Promise.all([
                ...lecciones.map((l) => eliminarLeccion(l.id)),
                ...preguntas.map((p) => eliminarPregunta(p.id)),
                ...asignaciones.map((a) => eliminarAsignacion(a.id)),
                ...resultados.map((r) => eliminarResultado(r.id)),
            ]);
            await eliminarCurso(cursoId);
            registrarEvento(getUsuarioActual().id, "eliminar_curso", `Curso ${cursoId} eliminado (con ${lecciones.length} lección(es), ${preguntas.length} pregunta(s), ${asignaciones.length} asignación(es) y ${resultados.length} resultado(s))`);
            navigate("academia");
        });
    });

    const btnNuevo = document.getElementById("btn-nuevo-curso");
    if (btnNuevo) btnNuevo.addEventListener("click", abrirModalNuevoCurso);
}

/**
 * "Aplica a" — a qué países y locales les corresponde este contenido.
 *
 * Sirve igual para un curso y para una lección: el campo es el mismo
 * (aplicaA) y la pregunta también. Cambia sólo a qué hoja se guarda.
 */

async function abrirModalNuevoCurso() {

    const modalId = "modal-nuevo-curso";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del curso</label>
        <input type="text" id="input-nombre" placeholder="Ej: Atención al Cliente">

        <label for="input-categoria">Categoría</label>
        <input type="text" id="input-categoria" placeholder="Ej: Servicio">

        <label for="input-obligatorio">
            <input type="checkbox" id="input-obligatorio" style="width:auto;display:inline-block;margin-right:8px">
            Curso obligatorio
        </label>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo curso", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const categoria = document.getElementById("input-categoria").value.trim() || "General";
        const obligatorio = document.getElementById("input-obligatorio").checked;

        if (!nombre) return;

        await crearCurso({ nombre, categoria, obligatorio, orden: 99 });
        registrarEvento(getUsuarioActual().id, "crear_curso", `Curso creado: ${nombre}`);

        cerrarModal(modalId);
        navigate("academia");
    });
}

/**
 * Exclusiones huérfanas: países o locales que una lección excluye, pero
 * para los que NO existe ninguna variante en ese curso.
 *
 * Pasa al borrar una variante: la exclusión vive en la lección original,
 * no en la pareja, así que borrar la copia deja a ese país sin ninguna
 * de las dos versiones — ni la propia, que ya no existe, ni la general,
 * de la que quedó excluido. Y en la pantalla no se distingue de una
 * exclusión puesta a propósito.
 */
function exclusionesHuerfanas(leccion, hermanas) {
    const excluye = String(leccion.noAplicaA || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!excluye.length) return [];
    const cubiertos = new Set();
    hermanas.forEach((h) => {
        if (String(h.id) === String(leccion.id)) return;
        String(h.aplicaA || "").split(",").map((s) => s.trim()).filter(Boolean)
            .forEach((a) => cubiertos.add(a.toLowerCase()));
    });
    return excluye.filter((e) => !cubiertos.has(e.toLowerCase()));
}

async function abrirModalLecciones(cursoId) {

    const todasLasLecciones = await getLecciones();
    const lecciones = todasLasLecciones.filter((l) => String(l.cursoId) === String(cursoId));

    const modalId = "modal-lecciones";

    const listaHtml = lecciones.length
        ? lecciones.map((l) => `
            <div class="list item">
                <span>${l.orden}. ${l.titulo} ${etiquetaAlcance(l.aplicaA, l.noAplicaA)}
                ${(() => {
                    const huerfanas = exclusionesHuerfanas(l, lecciones);
                    if (!huerfanas.length) return "";
                    const nombres = huerfanas.map((h) => h.replace("Lucciano's ", ""));
                    return `<div class="aviso-huerfana">
                        ⚠ ${escaparHtml(nombres.join(", "))} no ve esta lección y tampoco tiene una versión propia.
                        <button class="btn btn-sutil" data-reparar-leccion="${l.id}"
                                data-devolver="${escaparHtml(huerfanas.join(", "))}">Devolvérsela</button>
                    </div>`;
                })()}</span>
                <span>
                    <a class="btn btn-secondary" href="#/academialeccion/${cursoId}/${l.id}">Editar</a>
                    <button class="btn btn-secondary" data-duplicar-leccion="${l.id}">Duplicar para…</button>
                    <button class="btn btn-secondary" data-eliminar-leccion="${l.id}">Eliminar</button>
                </span>
            </div>
        `).join("")
        : `<p class="text-muted text-sm">Este curso todavía no tiene lecciones.</p>`;

    const contenidoHtml = `
        <a class="btn btn-secondary" href="#/cursos/${cursoId}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa del curso</a>
        <div class="list" style="margin-top:14px">${listaHtml}</div>
        <a class="btn btn-primary" href="#/academialeccion/${cursoId}" style="margin-top:20px;display:inline-block">+ Nueva lección</a>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Lecciones del curso", contenidoHtml, textoConfirmar: "" }), modalId);

    document.querySelectorAll("[data-reparar-leccion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.repararLeccion));
            if (!leccion) return;
            const devolver = btn.dataset.devolver.split(",").map((s) => s.trim().toLowerCase());
            const queda = String(leccion.noAplicaA || "").split(",").map((s) => s.trim()).filter(Boolean)
                .filter((s) => !devolver.includes(s.toLowerCase()));

            btn.disabled = true;
            btn.textContent = "Devolviendo...";
            await actualizarLeccion(leccion.id, { noAplicaA: queda.join(", ") });
            registrarEvento(getUsuarioActual().id, "editar_leccion",
                `Se devolvió "${leccion.titulo}" a ${btn.dataset.devolver}`);
            cerrarModal(modalId);
            abrirModalLecciones(cursoId);
        });
    });

    /**
     * "Duplicar para…" — la misma lección en otra versión.
     *
     * Europa usa otras unidades y otros nombres: donde acá dice "vaso",
     * allá es "copeta" o "tarrina". Eso no es un ajuste de la lección
     * argentina, es otra lección. Hacerlo a mano son tres pasos —crear,
     * acotar la copia, acotar la original— y el tercero es fácil de
     * olvidar: si falta, ese país termina viendo LAS DOS versiones.
     *
     * Acá la copia nace acotada al ámbito elegido y la original queda
     * excluida de él, en una sola operación.
     *
     * Es el único lugar donde se usa la INCLUSIÓN (aplicaA) en vez de la
     * restricción: una variante nace para un destino puntual, y
     * declararla al revés obligaría a enumerar los otros seis países.
     */
    document.querySelectorAll("[data-duplicar-leccion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.duplicarLeccion));
            if (!leccion) return;

            cerrarModal(modalId);
            const dupId = "modal-duplicar";
            const contenidoHtml = `
                <p class="text-sm text-muted" style="margin-bottom:12px">
                    Se crea una copia de <strong>${escaparHtml(leccion.titulo)}</strong> para el país o
                    local que elijas. La original deja de verse ahí, así nadie ve las dos versiones.
                </p>
                ${MultiSelectAlcance("input-duplicar", "")}
            `;

            abrirModal(
                Modal({ id: dupId, titulo: "Duplicar para…", contenidoHtml, textoConfirmar: "Duplicar" }),
                dupId,
                async () => {
                    const ambito = document.getElementById("input-duplicar").value.trim();
                    if (!ambito) {
                        alert("Elegí al menos un país o local para la copia.");
                        return;
                    }

                    const copia = { ...leccion };
                    delete copia.id;
                    // El título NO lleva el país. Para alguien de Madrid
                    // esa lección es "Menú Kosher" a secas: el sufijo le
                    // avisaba que está viendo la versión de otro, cuando
                    // para él es la única que existe. De qué país es cada
                    // versión es información de gestión, y en la lista de
                    // Academia ya está a la vista con la insignia "Solo
                    // España" — que además no se desactualiza si alguien
                    // cambia el alcance, cosa que un título sí haría.
                    copia.titulo = leccion.titulo;
                    copia.aplicaA = ambito;
                    copia.noAplicaA = "";
                    // La copia va justo después de la original para que
                    // no aparezca al final de la lista, lejos de su par.
                    // Mismo orden que la original: con el título ahora
                    // idéntico, quedar lejos en la lista las volvería
                    // indistinguibles al recorrerla.
                    copia.orden = leccion.orden;

                    await crearLeccion(copia);

                    // La exclusión va a TODAS las lecciones del curso que
                    // hoy le llegan a ese ámbito, no sólo a la que se
                    // tocó. Excluir únicamente la tocada dejaba un hueco
                    // real: duplicando desde la variante de España para
                    // Chile, la exclusión caía en la de España —que a
                    // Chile no le llegaba igual— y la versión GENERAL no
                    // se enteraba, así que un chileno terminaba viendo la
                    // general y la suya nueva.
                    const destinos = ambito.split(",").map((s) => s.trim()).filter(Boolean);
                    const alcanzaAlAmbito = (otra) => destinos.some((d) => {
                        const falso = { rol: "colaborador", sucursal: d, encargado: false };
                        // Si "d" es un país y no un local, sucursal no
                        // matchea por nombre pero sí por país deducido.
                        return aplicaAlUsuario(otra, falso) || aplicaAlUsuario(otra, { ...falso, sucursal: `Lucciano's X ${d}` });
                    });

                    const aExcluir = lecciones.filter((otra) =>
                        String(otra.cursoId) === String(leccion.cursoId) && alcanzaAlAmbito(otra));

                    for (const otra of aExcluir) {
                        const ya = String(otra.noAplicaA || "").split(",").map((s) => s.trim()).filter(Boolean);
                        const nuevos = destinos.filter((d) => !ya.some((y) => y.toLowerCase() === d.toLowerCase()));
                        if (!nuevos.length) continue;
                        await actualizarLeccion(otra.id, { noAplicaA: [...ya, ...nuevos].join(", ") });
                    }

                    registrarEvento(getUsuarioActual().id, "crear_leccion",
                        `Variante de "${leccion.titulo}" para ${ambito} (${aExcluir.length} excluida/s)`);
                    cerrarModal(dupId);
                    navigate("academia");
                },
            );

            await bindMultiSelectAlcance("input-duplicar");
        });
    });

    document.querySelectorAll("[data-eliminar-leccion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.eliminarLeccion));

            // La ORIGINAL de una familia no se borra. Es la que ve todo
            // el que no tiene variante propia: borrarla deja sin esa
            // lección a la red entera menos los dos o tres países que sí
            // tienen la suya, y las variantes quedan huérfanas apuntando
            // a algo que ya no existe. Primero se borran las variantes.
            const variantes = lecciones.filter((otra) => {
                if (String(otra.id) === String(leccion?.id)) return false;
                const cubre = String(otra.aplicaA || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
                if (!cubre.length) return false;
                const excluyo = String(leccion?.noAplicaA || "").split(",").map((s) => s.trim().toLowerCase());
                return cubre.some((c) => excluyo.includes(c));
            });

            if (variantes.length) {
                alert(
                    `No se puede borrar "${leccion.titulo}".\n\n`
                    + `Es la versión general: la ve todo el que no tiene una propia. `
                    + `Hay ${variantes.length} ${variantes.length === 1 ? "versión" : "versiones"} que depende${variantes.length === 1 ? "" : "n"} de ella:\n\n`
                    + variantes.map((v) => `· ${v.titulo}`).join("\n")
                    + `\n\nBorrá primero esas versiones.`,
                );
                return;
            }

            // Si es una VARIANTE, borrarla sola deja al país que cubría
            // sin ninguna versión: la original sigue excluyéndolo. Se
            // ofrece devolvérsela en el mismo paso, porque acordarse
            // después no pasa — el síntoma aparece semanas más tarde,
            // cuando alguien reclama que nunca vio esa lección.
            const cubria = String(leccion?.aplicaA || "").split(",").map((s) => s.trim()).filter(Boolean);
            const originales = cubria.length
                ? lecciones.filter((otra) => {
                    if (String(otra.id) === String(leccion.id)) return false;
                    const excluye = String(otra.noAplicaA || "").split(",").map((s) => s.trim().toLowerCase());
                    return cubria.some((c) => excluye.includes(c.toLowerCase()));
                })
                : [];

            if (!confirm("¿Eliminar esta lección? Esta acción no se puede deshacer.")) return;

            let devolver = false;
            if (originales.length) {
                const nombres = cubria.map((c) => c.replace("Lucciano's ", "")).join(", ");
                devolver = confirm(
                    `Esta es la versión para ${nombres}.\n\n`
                    + `Si la borrás sin más, ${nombres} se queda sin ninguna versión de `
                    + `"${originales[0].titulo}" — la original lo tiene excluido.\n\n`
                    + `¿Querés que le devuelva la versión general?`,
                );
            }

            await eliminarLeccion(btn.dataset.eliminarLeccion);

            if (devolver) {
                for (const otra of originales) {
                    const queda = String(otra.noAplicaA || "").split(",").map((s) => s.trim()).filter(Boolean)
                        .filter((s) => !cubria.some((c) => c.toLowerCase() === s.toLowerCase()));
                    await actualizarLeccion(otra.id, { noAplicaA: queda.join(", ") });
                }
            }

            registrarEvento(getUsuarioActual().id, "eliminar_leccion",
                `Lección ${btn.dataset.eliminarLeccion} eliminada${devolver ? " (se devolvió la versión general)" : ""}`);
            cerrarModal(modalId);
            navigate("academia");
        });
    });
}

/**
 * Página completa de edición/creación de lección (#/academialeccion/
 * :cursoId/:leccionId?) — mismo patrón que "Nueva News"
 * (pages/news.js: NuevaNews/bindNuevaNews). Todo el contenido y los
 * campos técnicos en un solo lugar, siempre a la vista, un solo
 * Guardar — ver la nota grande sobre camposLeccionEditorHtml más
 * arriba para el porqué.
 */
export async function EditarLeccion(params = []) {
    const [cursoId, leccionId] = params;
    const cursos = await getCursos();
    const curso = cursos.find((c) => String(c.id) === String(cursoId));
    if (!curso) return `<p class="text-sm text-muted" style="padding:24px">Curso no encontrado.</p>`;

    const leccion = leccionId
        ? (await getLeccionesPorCurso(cursoId)).find((l) => String(l.id) === String(leccionId))
        : null;

    return `
        <div class="compose-page-header">
            <span class="compose-ico">${Icon("academia", { size: 24 })}</span>
            <div style="flex:1">
                <h1>${leccion ? "Editar lección" : "Nueva lección"}</h1>
                <p>${escaparHtml(curso.titulo || curso.nombre || "")}</p>
            </div>
        </div>

        <div class="form-secciones">
            ${camposLeccionEditorHtml(leccion || {})}
        </div>

        <div class="compose-footer">
            <button class="btn btn-secondary" id="btn-cancelar-leccion">Cancelar</button>
            <button class="btn btn-primary" id="btn-guardar-leccion">${leccion ? "Guardar cambios" : "Crear lección"}</button>
        </div>
    `;
}

export function bindEditarLeccion(params = []) {
    const [cursoId, leccionId] = params;

    // --- Pasos del procedimiento: agregar/eliminar, sin perder nunca
    // la última fila (siempre queda una, vacía si hace falta, así "+
    // Agregar paso" no es la única forma de tener dónde escribir). ---
    const listaPasos = document.getElementById("lista-pasos");

    function renumerarPasos() {
        listaPasos.querySelectorAll(".paso-item").forEach((item, i) => {
            const num = item.querySelector(".paso-num");
            if (num) num.textContent = i + 1;
        });
    }

    function eliminarPaso(item) {
        if (listaPasos.children.length > 1) item.remove();
        else item.querySelector(".input-paso-texto").value = "";
        renumerarPasos();
    }

    function agregarPaso(texto = "") {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = pasoHtml(texto, listaPasos.children.length);
        const item = wrapper.firstElementChild;
        listaPasos.appendChild(item);
        item.querySelector(".btn-eliminar-paso").addEventListener("click", () => eliminarPaso(item));
        renumerarPasos();
        item.querySelector(".input-paso-texto").focus();
    }

    listaPasos?.querySelectorAll(".btn-eliminar-paso").forEach((btn) => {
        btn.addEventListener("click", () => eliminarPaso(btn.closest(".paso-item")));
    });
    document.getElementById("btn-agregar-paso")?.addEventListener("click", () => agregarPaso());

    // --- Subir video/imagen/manual directo a Drive (mismo mecanismo
    // que ya usan Manuales y los adjuntos de News) — el link resultante
    // se carga solo en el campo de texto, que sigue editable a mano
    // por si ya se tiene un link de Drive hecho. ---
    function bindSubida(btnId, inputFileId, inputUrlId, { onSubido } = {}) {
        const btn = document.getElementById(btnId);
        const inputFile = document.getElementById(inputFileId);
        const inputUrl = document.getElementById(inputUrlId);

        btn?.addEventListener("click", () => inputFile?.click());

        inputFile?.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Subiendo...";

            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
                    reader.readAsDataURL(file);
                });

                const resultado = await gasRequest("subirArchivo", {
                    nombreArchivo: file.name,
                    extension: file.name.split(".").pop() || "bin",
                    archivoBase64: base64,
                });

                if (!resultado || !resultado.ok) throw new Error(resultado?.error || "No se pudo subir el archivo.");

                inputUrl.value = resultado.url;
                if (onSubido) onSubido(resultado.url);
            } catch (err) {
                alert(err.message || "No se pudo subir el archivo.");
            } finally {
                inputFile.value = "";
                btn.disabled = false;
                btn.textContent = original;
            }
        });
    }

    bindSubida("btn-subir-video", "input-video-archivo", "input-video");
    bindSubida("btn-subir-imagen", "input-imagen-archivo", "input-imagen", {
        onSubido: (url) => {
            const preview = document.getElementById("preview-imagen");
            if (preview) preview.innerHTML = `<img src="${escaparHtml(url)}" alt="" style="width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">`;
        },
    });
    bindSubida("btn-subir-manual", "input-manual-archivo", "input-manual");

    document.getElementById("btn-cancelar-leccion")?.addEventListener("click", () => navigate("academia"));

    const btnGuardar = document.getElementById("btn-guardar-leccion");
    btnGuardar?.addEventListener("click", async () => {
        if (btnGuardar.disabled) return;

        const cambios = leerCamposLeccionEditor();
        if (!cambios.titulo) {
            alert("Ponele un título a la lección.");
            return;
        }

        const original = btnGuardar.textContent;
        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        try {
            const usuario = getUsuarioActual();
            if (leccionId) {
                const r = await actualizarLeccion(leccionId, cambios);
                if (!r || r.ok === false) throw new Error(r?.error || "No se pudo guardar. Probá de nuevo.");
                registrarEvento(usuario.id, "editar_leccion", `Lección "${cambios.titulo}" editada`);
            } else {
                // Si no se tocó el campo Orden (quedó en 0, el default del
                // formulario vacío), se agrega al final como siempre. Si
                // se puso un valor a propósito (ej. meterla primera o
                // entre dos existentes), gana ese.
                if (!cambios.orden) {
                    const todasDelCurso = await getLeccionesPorCurso(cursoId);
                    cambios.orden = todasDelCurso.length + 1;
                }
                await crearLeccion({ cursoId, ...cambios });
                registrarEvento(usuario.id, "crear_leccion", `Lección "${cambios.titulo}" agregada`);
            }
            navigate("academia");
        } catch (err) {
            alert(err.message || "No se pudo guardar. Probá de nuevo.");
            btnGuardar.disabled = false;
            btnGuardar.textContent = original;
        }
    });
}
