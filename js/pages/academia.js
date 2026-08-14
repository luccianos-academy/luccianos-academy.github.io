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
import { LeccionEditable, bindLeccionEditable } from "../components/leccionEditable.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { escaparHtml } from "../services/html.js";
import { getDisponibilidad, mapaDisponibilidad } from "../data/disponibilidad.js";
import { MultiSelectAlcance, bindMultiSelectAlcance } from "../components/multiSelectAlcance.js";
import { aplicaAlUsuario } from "../services/alcance.js";

/** Los mismos campos que ya vive el esquema real de Lecciones (ver
 *  README de apps-script) — antes este formulario solo tenía título y
 *  objetivo, así que crear una lección desde acá dejaba todo el resto
 *  vacío. Reutilizado tanto para "nueva lección" como para "editar". */
function camposLeccionHtml(l = {}) {
    return `
        ${l.id ? `<p class="text-xs text-muted" style="margin:-4px 0 10px">ID de esta lección: <strong>${l.id}</strong> — se pide al pedir soporte para engancharle fotos o video especiales (carrusel, decoración) que el formulario normal no cubre.</p>` : ""}
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Título de la lección" value="${l.titulo || ""}">

        <label for="input-objetivo">Objetivo</label>
        <input type="text" id="input-objetivo" placeholder="¿Qué va a aprender el colaborador?" value="${l.objetivo || ""}">

        <label for="input-duracion">Duración (minutos)</label>
        <input type="number" id="input-duracion" min="0" value="${l.duracionMinutos || ""}">

        <label for="input-orden">Orden (posición en la lista — decide dónde aparece, no hace falta que sea correlativo, ej. 16.5 la mete entre la 16 y la 17)</label>
        <input type="number" id="input-orden" step="0.5" value="${l.orden ?? ""}">

        <label for="input-video">Video (link de Drive)</label>
        <input type="text" id="input-video" placeholder="https://drive.google.com/..." value="${l.video || ""}">

        <label for="input-manual">Manual (link o texto)</label>
        <input type="text" id="input-manual" placeholder="https://... o una nota" value="${l.manual || ""}">

        <label for="input-manualLabel">Texto del botón del manual (opcional)</label>
        <input type="text" id="input-manualLabel" placeholder="Si se deja vacío, dice &quot;Ver manual&quot;" value="${l.manualLabel || ""}">

        <label for="input-imagen">Imagen (link)</label>
        <input type="text" id="input-imagen" placeholder="https://..." value="${l.imagen || ""}">

        <label for="input-procedimiento">Procedimiento</label>
        <textarea id="input-procedimiento" rows="3" placeholder="Paso a paso...">${l.procedimiento || ""}</textarea>

        <label for="input-errores">Errores frecuentes</label>
        <textarea id="input-errores" rows="2" placeholder="Qué se suele hacer mal...">${l.errores || ""}</textarea>

        <label for="input-buenasPracticas">Buenas prácticas</label>
        <textarea id="input-buenasPracticas" rows="2">${l.buenasPracticas || ""}</textarea>

        <label for="input-consejo">Consejo</label>
        <textarea id="input-consejo" rows="2">${l.consejo || ""}</textarea>

        <label for="input-resumen">Resumen</label>
        <textarea id="input-resumen" rows="2">${l.resumen || ""}</textarea>

        <label for="input-estado">Estado</label>
        <select id="input-estado">
            <option value="Activo" ${l.estado !== "Inactivo" ? "selected" : ""}>Activo</option>
            <option value="Inactivo" ${l.estado === "Inactivo" ? "selected" : ""}>Inactivo</option>
        </select>
    `;
}

function leerCamposLeccion() {
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        objetivo: document.getElementById("input-objetivo").value.trim(),
        duracionMinutos: Number(document.getElementById("input-duracion").value) || 0,
        orden: Number(document.getElementById("input-orden").value) || 0,
        video: document.getElementById("input-video").value.trim(),
        manual: document.getElementById("input-manual").value.trim(),
        manualLabel: document.getElementById("input-manualLabel").value.trim(),
        imagen: document.getElementById("input-imagen").value.trim(),
        procedimiento: document.getElementById("input-procedimiento").value.trim(),
        errores: document.getElementById("input-errores").value.trim(),
        buenasPracticas: document.getElementById("input-buenasPracticas").value.trim(),
        consejo: document.getElementById("input-consejo").value.trim(),
        resumen: document.getElementById("input-resumen").value.trim(),
        estado: document.getElementById("input-estado").value,
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
                    <button class="btn btn-secondary" data-editar-leccion="${l.id}">Editar</button>
                    <button class="btn btn-secondary" data-duplicar-leccion="${l.id}">Duplicar para…</button>
                    <button class="btn btn-secondary" data-eliminar-leccion="${l.id}">Eliminar</button>
                </span>
            </div>
        `).join("")
        : `<p class="text-muted text-sm">Este curso todavía no tiene lecciones.</p>`;

    const contenidoHtml = `
        <a class="btn btn-secondary" href="#/cursos/${cursoId}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa del curso</a>
        <div class="list" style="margin-top:14px">${listaHtml}</div>
        <h3 style="margin-top:20px">Nueva lección</h3>
        ${camposLeccionHtml()}
    `;

    abrirModal(Modal({ id: modalId, titulo: "Lecciones del curso", contenidoHtml, textoConfirmar: "Agregar lección" }), modalId, async () => {

        const cambios = leerCamposLeccion();
        if (!cambios.titulo) return;

        // Si no se tocó el campo Orden (quedó en 0, el default del
        // formulario vacío), se sigue agregando al final como siempre.
        // Si se puso un valor a propósito (ej. para meterla primera o
        // entre dos existentes), gana ese.
        if (!cambios.orden) cambios.orden = lecciones.length + 1;

        await crearLeccion({ cursoId, ...cambios });
        registrarEvento(getUsuarioActual().id, "crear_leccion", `Lección "${cambios.titulo}" agregada`);

        cerrarModal(modalId);
        navigate("academia");
    });

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

    document.querySelectorAll("[data-editar-leccion]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.editarLeccion));
            if (!leccion) return;
            // Cierra el modal de la lista antes de abrir el de edición —
            // los dos usan los mismos ids de campo (input-titulo, etc.),
            // así que tenerlos abiertos a la vez hace que
            // document.getElementById() agarre el formulario equivocado.
            cerrarModal(modalId);
            abrirModalEditarLeccion(leccion);
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
 * Editar una lección VIÉNDOLA como la ve un colaborador.
 *
 * Antes esto abría un formulario de once campos: se editaba a ciegas y
 * había que ir a #/cursos para ver el resultado — dos pantallas para
 * una sola tarea. Ahora se dibuja la lección con el mismo lenguaje
 * visual que la real, y cada bloque tiene su lápiz.
 *
 * Los campos de configuración (video, manual, imagen, orden, duración)
 * siguen en el formulario completo, accesible desde el botón de abajo:
 * no son contenido que se lea, así que verlos renderizados no aporta
 * nada y mezclarlos ensuciaría la vista.
 */
async function abrirModalEditarLeccion(leccion) {

    const modalId = "modal-editar-leccion";
    const contenidoHtml = `
        <p class="text-xs text-muted" style="margin:0 0 12px">Tocá el lápiz de cada bloque para editarlo. Se guarda de a uno.</p>
        ${LeccionEditable(leccion)}
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
            <button class="btn btn-sutil" type="button" id="btn-campos-tecnicos">Video, manual, imagen y orden</button>
        </div>
    `;

    // Cada sección guarda sola, así que no hay un "Guardar" global que
    // pueda perder algo: el botón principal solo cierra y recarga la
    // pantalla de atrás, para que la lista muestre los títulos nuevos.
    abrirModal(Modal({ id: modalId, titulo: leccion.titulo, contenidoHtml, textoConfirmar: "Listo" }), modalId, async () => {
        cerrarModal(modalId);
        navigate("academia");
    });
    bindLeccionEditable(leccion, {
        alGuardar: (campo) => {
            registrarEvento(getUsuarioActual().id, "editar_leccion", `Lección "${leccion.titulo}" — campo "${campo}" editado`);
        },
    });

    document.getElementById("btn-campos-tecnicos")?.addEventListener("click", () => {
        cerrarModal(modalId);
        abrirModalCamposTecnicos(leccion);
    });
}

/** El formulario completo de siempre, ahora solo para lo que no es
 *  contenido de lectura. Se conserva entero — crear una lección nueva
 *  lo sigue usando tal cual. */
async function abrirModalCamposTecnicos(leccion) {
    const modalId = "modal-campos-leccion";

    abrirModal(Modal({ id: modalId, titulo: `Ajustes: ${leccion.titulo}`, contenidoHtml: camposLeccionHtml(leccion), textoConfirmar: "Guardar" }), modalId, async () => {

        const cambios = leerCamposLeccion();
        if (!cambios.titulo) return;

        const r = await actualizarLeccion(leccion.id, cambios);
        if (!r || r.ok === false) {
            alert(r?.error || "No se pudo guardar. Probá de nuevo.");
            return;
        }
        registrarEvento(getUsuarioActual().id, "editar_leccion", `Lección "${cambios.titulo}" editada`);

        cerrarModal(modalId);
        navigate("academia");
    });
}
