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
import { getCursos, crearCurso, actualizarCurso, eliminarCurso } from "../data/cursos.js";
import { getLecciones, getLeccionesPorCurso, crearLeccion, actualizarLeccion, eliminarLeccion } from "../data/lecciones.js";
import { getPreguntasPorCurso, eliminarPregunta } from "../data/evaluaciones.js";
import { getAsignaciones, eliminarAsignacion } from "../data/asignaciones.js";
import { getResultados, eliminarResultado } from "../data/resultados.js";
import { LeccionEditable, bindLeccionEditable } from "../components/leccionEditable.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { escaparHtml } from "../services/html.js";
import { MultiSelectAlcance, bindMultiSelectAlcance } from "../components/multiSelectAlcance.js";
import { PRODUCTOS_CHOCOLATERIA, CATEGORIAS_CHOCOLATERIA } from "../data/productosChocolateria.js";
import { PRODUCTOS_HELADERIA, CATEGORIAS_HELADERIA } from "../data/productosHeladeria.js";
import { PRODUCTOS_ICEPOPS, CATEGORIAS_ICEPOPS } from "../data/productosIcepops.js";
import { PRODUCTOS_PASTELERIA, CATEGORIAS_PASTELERIA } from "../data/productosPasteleria.js";
import { getDisponibilidad, mapaDisponibilidad, guardarDisponibilidad, conAlcanceCambiado } from "../data/disponibilidad.js";
import { getSucursales } from "../data/sucursales.js";
import { aplicaAlUsuario } from "../services/alcance.js";

/** Los mismos campos que ya vive el esquema real de Lecciones (ver
 *  README de apps-script) — antes este formulario solo tenía título y
 *  objetivo, así que crear una lección desde acá dejaba todo el resto
 *  vacío. Reutilizado tanto para "nueva lección" como para "editar". */
function camposLeccionHtml(l = {}) {
    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Título de la lección" value="${l.titulo || ""}">

        <label for="input-objetivo">Objetivo</label>
        <input type="text" id="input-objetivo" placeholder="¿Qué va a aprender el colaborador?" value="${l.objetivo || ""}">

        <label for="input-duracion">Duración (minutos)</label>
        <input type="number" id="input-duracion" min="0" value="${l.duracionMinutos || ""}">

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

/** Cómo se ve el alcance en la tabla. "Todos" en gris y no en blanco:
 *  es el caso normal y no tiene que competir visualmente con los pocos
 *  que sí están acotados, que son los que hay que revisar. */
function etiquetaAlcance(aplicaA) {
    const lista = String(aplicaA || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!lista.length) return `<span class="text-sm text-muted">Todos</span>`;
    const corto = lista.map((s) => escaparHtml(s.replace("Lucciano's ", "")));
    // Con más de dos se corta: la columna no puede crecer sin empujar
    // las acciones fuera de pantalla. El detalle está a un clic.
    const visibles = corto.slice(0, 2).join(", ");
    const resto = corto.length > 2 ? ` +${corto.length - 2}` : "";
    return `<span class="badge badge-warning">${visibles}${resto}</span>`;
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
        { key: "alcanceLabel", label: "No aplica a" },
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
        alcanceLabel: etiquetaAlcance(c.noAplicaA) + (() => {
            const n = mapaDisponibilidad(disponibilidad, c.nombre).size;
            return n
                ? `<div class="text-xs text-muted" style="margin-top:4px">${n} producto${n === 1 ? "" : "s"} acotado${n === 1 ? "" : "s"}</div>`
                : "";
        })(),
        acciones: `
            <a class="btn btn-secondary" href="#/cursos/${c.id}" title="Ver el curso tal cual lo ve un colaborador">👁 Vista previa</a>
            <button class="btn btn-secondary" data-ver-lecciones="${c.id}">Ver lecciones</button>
            <button class="btn btn-secondary" data-alcance-curso="${c.id}">No aplica a</button>
            ${CATALOGO_POR_CURSO[c.nombre] ? `<button class="btn btn-secondary" data-catalogo-curso="${escaparHtml(c.nombre)}">Catálogo</button>` : ""}
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
    `;
}

export function bindAcademia() {

    document.querySelectorAll("[data-ver-lecciones]").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalLecciones(btn.dataset.verLecciones));
    });

    document.querySelectorAll("[data-alcance-curso]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const cursos = await getCursos();
            const curso = cursos.find((c) => String(c.id) === String(btn.dataset.alcanceCurso));
            if (!curso) return;
            abrirModalAlcance({
                titulo: `No aplica a — ${curso.nombre}`,
                valorActual: curso.noAplicaA,
                guardar: async (noAplicaA) => {
                    await actualizarCurso(curso.id, { noAplicaA });
                    registrarEvento(getUsuarioActual().id, "editar_curso",
                        `Restricción de "${curso.nombre}": ${noAplicaA || "ninguna"}`);
                },
                volver: () => navigate("academia"),
            });
        });
    });

    document.querySelectorAll("[data-catalogo-curso]").forEach((btn) => {
        btn.addEventListener("click", () => abrirModalCatalogo(btn.dataset.catalogoCurso));
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
/**
 * "No aplica a" — quiénes NO ven este curso o lección.
 *
 * Se declara la RESTRICCIÓN, no el permiso. Al revés obligaba a
 * enumerar a todos los que sí lo ven para sacar a uno: para que una
 * lección no vaya en Uruguay había que escribir los otros 6 países, y
 * cada país nuevo que abre hay que acordarse de sumarlo a mano en cada
 * lección. Declarando la excepción, lo nuevo hereda el default —le
 * llega a todos— que es lo correcto para contenido de capacitación.
 */
async function abrirModalAlcance({ titulo, valorActual, guardar, volver }) {

    const modalId = "modal-alcance";
    const contenidoHtml = `
        <p class="text-sm text-muted" style="margin-bottom:12px">
            Agregá los países o locales donde <strong>no</strong> corresponde.
            Si no ponés nada, le llega a toda la red.
        </p>
        ${MultiSelectAlcance("input-alcance", valorActual || "")}
    `;

    abrirModal(
        Modal({ id: modalId, titulo, contenidoHtml, textoConfirmar: "Guardar" }),
        modalId,
        async () => {
            const noAplicaA = document.getElementById("input-alcance").value.trim();
            await guardar(noAplicaA);
            cerrarModal(modalId);
            volver();
        },
    );

    // Después de abrirModal: el HTML tiene que estar en el DOM para
    // que el buscador encuentre sus elementos.
    await bindMultiSelectAlcance("input-alcance");
}

/* ── Catálogo: dónde se vende cada producto ────────────────────────

   Los productos viven en el código (data/productos*.js) porque son
   material de consulta —fotos, nombres, descripciones del manual—, no
   datos de negocio. Lo que SÍ cambia por país es dónde se vende cada
   uno, y eso se guarda en la hoja Disponibilidad, sólo para los que
   son excepción.

   Se administra por producto y no por categoría porque las
   restricciones reales no respetan categorías: Chile no tiene la línea
   Gluten Free entera, pero un país puede tener la línea y no un sabor
   suelto, y la certificación Kosher está repartida entre todas las
   categorías. Por producto incluye el caso de la categoría entera —con
   el atajo de "marcar toda la categoría"—; al revés no.                */

const CATALOGO_POR_CURSO = {
    "Chocolatería": [PRODUCTOS_CHOCOLATERIA, CATEGORIAS_CHOCOLATERIA],
    "Heladería": [PRODUCTOS_HELADERIA, CATEGORIAS_HELADERIA],
    "Icepops": [PRODUCTOS_ICEPOPS, CATEGORIAS_ICEPOPS],
    "Pastelería": [PRODUCTOS_PASTELERIA, CATEGORIAS_PASTELERIA],
};

async function abrirModalCatalogo(nombreCurso, ambitoElegido) {

    const catalogo = CATALOGO_POR_CURSO[nombreCurso];
    if (!catalogo) return;
    const [productos, categorias] = catalogo;

    const [filas, sucursales] = await Promise.all([getDisponibilidad(), getSucursales()]);
    const alcances = mapaDisponibilidad(filas, nombreCurso);
    const modalId = "modal-catalogo";

    const activas = sucursales.filter((s) => s.estado === "Activa");
    const paises = [...new Set(activas.map((s) => s.pais).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "es"));

    // Se trabaja parado en UN país o local por vez, igual que "Módulos
    // que tiene" de Locales. Antes había que marcar productos y después
    // declarar en qué países se venden, o sea pensar al revés: para
    // sacar Gluten Free de Chile había que enumerar los otros 6 países.
    const ambito = ambitoElegido || paises[0] || "";

    // ¿Este producto se vende en el ámbito elegido? Se responde con la
    // misma función que usa la app para mostrar el catálogo, así la
    // pantalla no puede decir una cosa y el colaborador ver otra.
    const usuarioDelAmbito = paises.includes(ambito)
        ? { rol: "colaborador", sucursal: (activas.find((s) => s.pais === ambito) || {}).nombre || "" }
        : { rol: "colaborador", sucursal: ambito };
    const seVende = (nombre) => aplicaAlUsuario(alcances.get(nombre) || {}, usuarioDelAmbito, activas);

    const bloques = categorias.map((cat) => {
        const deLaCat = productos.filter((p) => (p.categorias || []).includes(cat));
        if (!deLaCat.length) return "";
        const fuera = deLaCat.filter((p) => !seVende(p.nombre)).length;
        return `
            <div class="catalogo-grupo" data-grupo="${escaparHtml(cat)}">
                <label class="catalogo-grupo-titulo">
                    <input type="checkbox" data-cat-todos="${escaparHtml(cat)}" ${fuera ? "" : "checked"}>
                    <span class="catalogo-grupo-nombre">${escaparHtml(cat)}</span>
                    <span class="catalogo-grupo-meta">${deLaCat.length}${fuera ? ` · ${fuera} fuera` : ""}</span>
                </label>
                ${deLaCat.map((p) => `
                    <label class="catalogo-item" data-nombre="${escaparHtml(p.nombre.toLowerCase())}">
                        <input type="checkbox" class="prod-check"
                               data-cat="${escaparHtml(cat)}" data-producto="${escaparHtml(p.nombre)}"
                               ${seVende(p.nombre) ? "checked" : ""}>
                        ${p.foto
                            ? `<img class="catalogo-foto" src="${escaparHtml(p.foto)}" alt="" loading="lazy">`
                            : `<span class="catalogo-foto catalogo-foto-vacia">${escaparHtml(p.nombre.slice(0, 2).toUpperCase())}</span>`}
                        <span class="catalogo-nombre">${escaparHtml(p.nombre)}</span>
                    </label>
                `).join("")}
            </div>
        `;
    }).join("");

    // Agrupado por país, con "todo el país" arriba de sus locales. Una
    // lista plana de 123 nombres obliga a saber de memoria en qué país
    // está cada uno; así se baja del país al local sin buscar.
    const opciones = paises.map((p) => {
        const locales = activas.filter((s) => s.pais === p);
        return `
            <optgroup label="${escaparHtml(p)}">
                <option value="${escaparHtml(p)}" ${p === ambito ? "selected" : ""}>
                    Todo ${escaparHtml(p)} — ${locales.length} ${locales.length === 1 ? "local" : "locales"}
                </option>
                ${locales.map((s) => `
                    <option value="${escaparHtml(s.nombre)}" ${s.nombre === ambito ? "selected" : ""}>
                        &nbsp;&nbsp;${escaparHtml(s.nombre.replace("Lucciano's ", ""))}
                    </option>`).join("")}
            </optgroup>
        `;
    }).join("");

    const contenidoHtml = `
        <label for="select-ambito">¿Para qué país o local?</label>
        <select id="select-ambito">${opciones}</select>

        <p class="text-sm text-muted" style="margin:12px 0 10px">
            Destildá los productos que <strong>no</strong> se venden ahí. Las lecciones no se tocan:
            el curso se hace igual, sólo desaparecen de la galería.
        </p>

        <input type="search" id="buscador-catalogo" placeholder="Buscar producto...">
        <div id="catalogo-lista" style="margin-top:14px">${bloques}</div>
        <p id="catalogo-sin-resultados" class="text-sm text-muted" hidden>Ningún producto coincide con la búsqueda.</p>
    `;

    abrirModal(
        Modal({ id: modalId, titulo: `Catálogo — ${nombreCurso}`, contenidoHtml, textoConfirmar: "Guardar" }),
        modalId,
        async () => {
            const boton = document.querySelector(`[data-confirm="${modalId}"]`);
            const chks = [...document.querySelectorAll("#catalogo-lista .prod-check")];

            // Sólo los que cambiaron: guardar los 60 serían 60 llamadas
            // a Apps Script para tocar 8.
            const cambios = chks.map((chk) => {
                const nombre = chk.dataset.producto;
                if (seVende(nombre) === chk.checked) return null;
                const actual = alcances.get(nombre) || {};
                return {
                    nombre,
                    noAplicaA: conAlcanceCambiado(actual.noAplicaA, ambito, chk.checked),
                };
            }).filter(Boolean);

            if (!cambios.length) { cerrarModal(modalId); return; }

            boton.disabled = true;
            for (let i = 0; i < cambios.length; i++) {
                boton.textContent = `Guardando ${i + 1}/${cambios.length}...`;
                await guardarDisponibilidad(nombreCurso, cambios[i].nombre, { noAplicaA: cambios[i].noAplicaA }, filas);
            }

            registrarEvento(getUsuarioActual().id, "editar_curso",
                `Catálogo de ${nombreCurso} en ${ambito}: ${cambios.length} producto(s) cambiados`);
            cerrarModal(modalId);
            navigate("academia");
        },
    );

    // Cambiar de país recarga la lista con lo que corresponde a ese
    // ámbito. Se avisa si hay cambios sin guardar: se perderían.
    document.getElementById("select-ambito").addEventListener("change", (e) => {
        const hayCambios = [...document.querySelectorAll("#catalogo-lista .prod-check")]
            .some((chk) => seVende(chk.dataset.producto) !== chk.checked);
        if (hayCambios && !confirm("Hay cambios sin guardar en " + ambito + ". ¿Descartarlos?")) {
            e.target.value = ambito;
            return;
        }
        cerrarModal(modalId);
        abrirModalCatalogo(nombreCurso, e.target.value);
    });

    document.getElementById("catalogo-lista").addEventListener("change", (e) => {
        // Atajo por categoría: el título marca o desmarca todos los suyos.
        if (e.target.dataset.catTodos) {
            document.querySelectorAll(`#catalogo-lista .prod-check[data-cat="${CSS.escape(e.target.dataset.catTodos)}"]`)
                .forEach((chk) => { chk.checked = e.target.checked; });
        }
    });

    document.getElementById("buscador-catalogo").addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#catalogo-lista .catalogo-item").forEach((item) => {
            item.style.display = !q || item.dataset.nombre.includes(q) ? "" : "none";
        });
        let alguno = false;
        document.querySelectorAll("#catalogo-lista .catalogo-grupo").forEach((grupo) => {
            const hay = [...grupo.querySelectorAll(".catalogo-item")].some((i) => i.style.display !== "none");
            grupo.style.display = hay ? "" : "none";
            if (hay) alguno = true;
        });
        document.getElementById("catalogo-sin-resultados").hidden = alguno;
    });
}

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

async function abrirModalLecciones(cursoId) {

    const todasLasLecciones = await getLecciones();
    const lecciones = todasLasLecciones.filter((l) => String(l.cursoId) === String(cursoId));

    const modalId = "modal-lecciones";

    const listaHtml = lecciones.length
        ? lecciones.map((l) => `
            <div class="list item">
                <span>${l.orden}. ${l.titulo} ${etiquetaAlcance(l.noAplicaA)}</span>
                <span>
                    <button class="btn btn-secondary" data-editar-leccion="${l.id}">Editar</button>
                    <button class="btn btn-secondary" data-alcance-leccion="${l.id}">No aplica a</button>
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

        await crearLeccion({ cursoId, orden: lecciones.length + 1, ...cambios });
        registrarEvento(getUsuarioActual().id, "crear_leccion", `Lección "${cambios.titulo}" agregada`);

        cerrarModal(modalId);
        navigate("academia");
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

    document.querySelectorAll("[data-alcance-leccion]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const leccion = lecciones.find((l) => String(l.id) === String(btn.dataset.alcanceLeccion));
            if (!leccion) return;
            // Se cierra el modal de lecciones antes de abrir el otro:
            // dos modales encimados dejan el de abajo clickeable.
            cerrarModal(modalId);
            abrirModalAlcance({
                titulo: `No aplica a — ${leccion.titulo}`,
                valorActual: leccion.noAplicaA,
                guardar: async (noAplicaA) => {
                    await actualizarLeccion(leccion.id, { noAplicaA });
                    registrarEvento(getUsuarioActual().id, "editar_leccion",
                        `Restricción de "${leccion.titulo}": ${noAplicaA || "ninguna"}`);
                },
                volver: () => abrirModalLecciones(cursoId),
            });
        });
    });

    document.querySelectorAll("[data-eliminar-leccion]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar esta lección? Esta acción no se puede deshacer.")) return;
            await eliminarLeccion(btn.dataset.eliminarLeccion);
            registrarEvento(getUsuarioActual().id, "eliminar_leccion", `Lección ${btn.dataset.eliminarLeccion} eliminada`);
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
