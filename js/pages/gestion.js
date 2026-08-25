/* ============================
   Lucciano's Academy
   pages/gestion.js — Responsables de Local y Turno

   Sin ruta en el menú a propósito todavía (se navega escribiendo
   #/gestion) — falta decidir si termina viviendo dentro de Academia.
   Tres áreas:

     1. Formación   — texto (liderazgo, feedback, indicadores...).
                       Solo TÍTULOS de tema por ahora, cada uno
                       "Próximamente" — sin inventar contenido.
     2. Gestión semanal — el checklist tipo calendario, por día
                       (arranca Domingo — más actividad, se cuenta
                       para recibir el lunes). Cada tarea tiene una o
                       más "dias" (ej. depósitos: Lunes Y Viernes) —
                       "aplica a mi local" NO es un interruptor aparte,
                       ES tener al menos un día elegido. La pestaña
                       "Tareas" es un catálogo desplegable: tocás una
                       tarea, se despliegan las pills de día ahí mismo,
                       elegís, y pasa a verde ("En uso"). Sin ningún
                       día, queda gris ("Sin usar") y no aparece en
                       ningún día real.

                       FASE 1 del backend (2026-08-24): el catálogo de
                       tareas (crear/editar/eliminar/mover de día) ya
                       persiste de verdad contra la hoja "GestionTareas"
                       (data/gestionTareas.js) — no más array
                       hardcodeado. El CHECK de "hecho hoy" sigue
                       siendo puramente visual (se resetea al
                       recargar) — eso es Fase 2, falta decidir cómo
                       se guarda por sucursal.
     3. ¿Qué hago si...? — guía situacional. Estructura fija por
                       situación (Qué hacer / Qué NO hacer / Cuándo
                       escalar / Herramienta relacionada), TODAS
                       marcadas "pendiente de contenido" — el usuario
                       va a traer el texto real (al menos el de
                       conflicto con cliente ya existe en un manual)
                       en una pasada aparte. Nada de esto es política
                       real todavía, es el molde nomás.
=============================*/

import { Header } from "../components/header.js";
import { Icon } from "../components/icons.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { exportarAPdf, membreteHtml } from "../services/exportarPdf.js";
import { escaparHtml } from "../services/html.js";
import { getUsuarioActual } from "../services/auth.js";
import { mandarPushGestion } from "../services/push.js";
import {
    getTareas,
    crearTarea as crearTareaBackend,
    actualizarTarea as actualizarTareaBackend,
    eliminarTarea as eliminarTareaBackend,
} from "../data/gestionTareas.js";

/* ============================
   1. Formación — solo temas, sin contenido todavía
=============================*/
const TEMAS_FORMACION = [
    { icono: "trofeo", titulo: "Liderazgo y comunicación", detalle: "Cómo dar indicaciones claras y sostener al equipo en el día a día." },
    { icono: "comentario", titulo: "Feedback a tu equipo", detalle: "Cómo señalar lo que hay que corregir sin que se sienta un reto." },
    { icono: "idea", titulo: "Resolución de conflictos", detalle: "Herramientas generales para bajar tensión entre compañeros de equipo." },
    { icono: "dashboard", titulo: "Indicadores, costos y merma", detalle: "Cómo leer ticket promedio, hora pico y merma para decidir mejor." },
    { icono: "corazon", titulo: "Experiencia del cliente", detalle: "El estándar de atención que se espera de todo el local, no solo de vos." },
];

function temaFormacionHtml(t) {
    return `
        <div class="tema-formacion">
            <span class="tema-formacion-ico">${Icon(t.icono, { size: 18 })}</span>
            <span class="tema-formacion-txt">
                <strong>${t.titulo}</strong>
                <span>${t.detalle}</span>
            </span>
            <span class="badge-proximamente">Próximamente</span>
        </div>
    `;
}

/* ============================
   2. Gestión semanal — el checklist, por día

   La semana arranca DOMINGO a propósito (pedido explícito): es el día
   de más actividad — ahí se cuenta para que el lunes entren los
   pedidos.

   Cada tarea tiene un array "dias" (uno, varios, o los 7 — "todos los
   días" no es un caso especial, es simplemente los 7 marcados). Las
   pills Do/Lu/Ma/.../Sá de la propia tarjeta prenden/apagan días al
   momento, sin tocar código — mismo espíritu que "+ Agregar ítem".
=============================*/
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// FASE 1: ya no es un array fijo — Gestion() lo puebla en cada render
// con getTareas() (data/gestionTareas.js → hoja "GestionTareas" real).
// Queda `let` porque confirmarTarea/eliminarTarea empujan/sacan de
// acá mismo después de escribir en el backend, para no tener que
// releer toda la hoja por cada cambio chico.
let TAREAS = [];

/** id → tarea real de TODAS las tareas vivas — única fuente de verdad
 *  para "Editar" y para las pills de día (prellenar/leer datos reales,
 *  no adivinarlos leyendo el DOM). Se puebla al renderizar (Gestion())
 *  y se actualiza en cada alta/baja/cambio de día. */
const registroTareas = new Map();

const ICONOS_TAREA = [
    { valor: "documento", label: "Documento" },
    { valor: "caja", label: "Caja / pedido" },
    { valor: "calendario", label: "Calendario" },
    { valor: "camara", label: "Cámara" },
    { valor: "tacho", label: "Limpieza" },
    { valor: "usuarios", label: "Equipo" },
    { valor: "corazon", label: "Cliente" },
    { valor: "idea", label: "Idea" },
];

/** Todas las tareas arrancan sin día — un panel de día sin nada
 *  cargado todavía no tiene que leerse como "roto". Función (no CSS
 *  ":empty") porque el contenedor real nunca queda 100% vacío: el
 *  template deja espacios en blanco entre las etiquetas, y ":empty"
 *  no los ignora. */
function avisoDiaVacioHtml() {
    return `<p class="aviso-dia-vacio">Sin tareas para este día todavía — andá a la pestaña "Tareas" y elegí cuáles corresponden.</p>`;
}

/** Agrega/saca el aviso de "día vacío" según corresponda — se llama
 *  después de cualquier cambio de día (recrearTareaEnPaneles), no
 *  solo al cargar la página. */
function actualizarAvisoDiaVacio(lista) {
    if (!lista) return;
    const hayTareas = !!lista.querySelector(".tarea-gestion");
    const aviso = lista.querySelector(".aviso-dia-vacio");
    if (hayTareas && aviso) aviso.remove();
    else if (!hayTareas && !aviso) lista.insertAdjacentHTML("beforeend", avisoDiaVacioHtml());
}

/** Pedido explícito: "que el selector de días me permita poner más de
 *  un día — los depósitos se hacen lunes y viernes". Pills, no un
 *  <select multiple> (mal en celular) — cada una prende/apaga un día,
 *  siempre visibles, sin abrir ningún modal. */
function diasControlHtml(t) {
    return `
        <div class="tarea-gestion-dia-control">
            <span class="tarea-gestion-dia-label">Días</span>
            <div class="dias-pills-tarea">
                ${DIAS.map((d) => `<button type="button" class="pill-dia-tarea${t.dias.includes(d) ? " activa" : ""}" data-toggle-dia="${d}" title="${d}">${d.slice(0, 2)}</button>`).join("")}
            </div>
        </div>
    `;
}

/** Crear/Editar/Eliminar contenido es solo Admin — Responsable de
 *  local/turno solo ejecuta (check, sub-ítems, día, push). El backend
 *  YA lo bloquea (PERMISOS_ESCRITURA en Code.gs) — esto es además no
 *  mostrar ni el botón, para no ofrecer una acción que va a fallar. */
function esAdminActual() {
    return getUsuarioActual()?.rol === "admin";
}

/** Fila de acciones al pie de cada tarjeta — Editar/Eliminar, SOLO
 *  Admin, mismos íconos/estilo que ya usa el modal de Publicación:
 *  .publicacion-accion-icono. Elegir SI la tarea aplica al local vive
 *  en la pestaña "Tareas" (aplicaTareaHtml), no acá — eso sí es de
 *  cualquiera. */
function accionesTareaHtml() {
    if (!esAdminActual()) return "";
    return `
        <div class="tarea-gestion-acciones">
            <button type="button" class="publicacion-accion-icono" data-editar-tarea title="Editar tarea" aria-label="Editar tarea">${Icon("lapiz", { size: 15 })}</button>
            <button type="button" class="publicacion-accion-icono publicacion-accion-icono-danger" data-eliminar-tarea title="Eliminar tarea" aria-label="Eliminar tarea">${Icon("tacho", { size: 15 })}</button>
        </div>
    `;
}

/** "Enviar push" — pedido explícito: avisarle al equipo del local que
 *  se hizo (o se intentó hacer) una tarea, SIN que nadie tenga que
 *  escribir nada. El mensaje dice "Tarea completa"/"Tarea incompleta"
 *  cuando hay algo tildable en ESA tarjeta (checklist o check propio)
 *  — si no (ej. desde "Tareas", que no tiene nada para tildar), manda
 *  un aviso neutro en vez de "incompleta" siempre por defecto. */
function botonPushHtml() {
    return `
        <div class="tarea-gestion-push">
            <button type="button" class="btn-enviar-push" data-enviar-push>${Icon("campana", { size: 14 })} Enviar push</button>
        </div>
    `;
}

/** Fila de la pestaña "Tareas" — pedido explícito: tocarla DESPLIEGA
 *  los días de la semana ahí mismo (mismo patrón desplegable que
 *  "Pedido a proveedores"), se eligen con las pills, y la tarjeta
 *  pasa a verde ("En uso") apenas tiene al menos un día marcado. Sin
 *  ningún día marcado queda gris ("Sin usar") — no hace falta un
 *  interruptor aparte: "aplica" ES "tiene días elegidos". */
function aplicaTareaHtml(t) {
    const enUso = t.dias.length > 0;
    return `
        <div class="tarea-gestion tarea-gestion-desplegable fila-aplica-tarea${enUso ? " en-uso" : ""}" data-desplegable data-tarea-id="${t.id}">
            <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                </span>
                <span class="badge-en-uso${enUso ? " activa" : ""}">${enUso ? "En uso" : "Sin usar"}</span>
                <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
            </button>
            <div class="tarea-gestion-subitems">
                ${diasControlHtml(t)}
                ${botonPushHtml()}
                ${accionesTareaHtml()}
            </div>
        </div>
    `;
}

function tareaHtml(t, idUnico) {
    const id = `tarea-${idUnico}`;
    // data-tarea-id va en TODAS las tarjetas — es la identidad que usa
    // Editar/Eliminar/pills-de-día para encontrar todas las copias de
    // esta tarea (una por cada día en t.dias) sin importar el panel.
    const atrId = ` data-tarea-id="${t.id}"`;

    if (t.subitems) {
        return `
            <div class="tarea-gestion tarea-gestion-desplegable" data-desplegable${atrId}>
                <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                    <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                    <span class="tarea-gestion-txt">
                        <strong>${t.titulo}</strong>
                        <span>${t.detalle}</span>
                    </span>
                    <span class="tarea-gestion-progreso" data-progreso>0/${t.subitems.length}</span>
                    <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
                </button>
                <div class="tarea-gestion-subitems" data-subitems>
                    ${t.subitems.map((s, is) => `
                        <label class="subitem-gestion" for="${id}-${is}">
                            <input type="checkbox" id="${id}-${is}" class="subitem-gestion-check">
                            <span>${s}</span>
                        </label>
                    `).join("")}
                    <div class="subitem-gestion-agregar">
                        <input type="text" class="input-subitem-nuevo" placeholder="Agregar ítem…">
                        <button type="button" class="btn-agregar-subitem" data-agregar-subitem>+</button>
                    </div>
                </div>
                ${botonPushHtml()}
                ${accionesTareaHtml()}
            </div>
        `;
    }

    return `
        <div class="tarea-gestion tarea-gestion-simple"${atrId}>
            <label class="tarea-gestion-label" for="${id}">
                <input type="checkbox" id="${id}" class="tarea-gestion-check">
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                </span>
            </label>
            ${botonPushHtml()}
            ${accionesTareaHtml()}
        </div>
    `;
}

/* ── "+ Nueva tarea" / "Editar tarea" (admin) ────────────────────
   Pedido explícito: mismo patrón que ya existe en Lecciones — un
   encabezado (ej. "Inventario") y abajo sub-tareas sueltas ("No te
   olvides de imprimir la planilla", "No te olvides de la lapicera").
   Los días se eligen con checkboxes reales (contenido-sin-errores:
   una fila por ítem, no un <select multiple>). */
function subtareaNuevaFilaHtml(texto = "") {
    return `
        <div class="subtarea-nueva-fila">
            <textarea class="input-subtarea-nueva-texto" rows="1" placeholder="Ej: No te olvides de imprimir la planilla">${escaparHtml(texto)}</textarea>
            <button type="button" class="btn-quitar-subtarea-nueva" aria-label="Quitar esta sub-tarea">×</button>
        </div>
    `;
}

/** Mismo form para crear Y editar — si viene `tarea` precarga sus
 *  valores reales (sacados de registroTareas, no adivinados del DOM). */
function contenidoModalTarea({ tarea } = {}) {
    const diasSel = tarea?.dias || ["Domingo"];
    return `
        <label>Título
            <textarea id="input-tarea-titulo" rows="1" placeholder="Ej: Inventario">${escaparHtml(tarea?.titulo || "")}</textarea>
        </label>
        <label>Detalle (opcional, una línea)
            <textarea id="input-tarea-detalle" rows="1" placeholder="Ej: Antes de armar el pedido a fábrica.">${escaparHtml(tarea?.detalle || "")}</textarea>
        </label>
        <label>Ícono
            <select id="input-tarea-icono">
                ${ICONOS_TAREA.map((i) => `<option value="${i.valor}"${i.valor === tarea?.icono ? " selected" : ""}>${i.label}</option>`).join("")}
            </select>
        </label>
        <div class="campo-dias-modal">
            <div class="campo-dias-modal-header">
                <span>Días</span>
                <button type="button" id="btn-todos-los-dias-modal">Marcar todos</button>
            </div>
            <div class="dias-checkbox-grid">
                ${DIAS.map((d) => `
                    <label class="dia-checkbox-fila">
                        <input type="checkbox" class="check-dia-tarea" value="${d}"${diasSel.includes(d) ? " checked" : ""}>
                        <span>${d}</span>
                    </label>
                `).join("")}
            </div>
        </div>
        <label class="campo-subtareas-nueva">Sub-tareas (opcional)
            <div id="lista-subtareas-nueva">${(tarea?.subitems || []).map(subtareaNuevaFilaHtml).join("")}</div>
            <button type="button" class="btn-agregar-subtarea-nueva" id="btn-agregar-subtarea-nueva">+ Agregar sub-tarea</button>
        </label>
    `;
}

function bindModalTarea() {
    const listaSubtareas = document.getElementById("lista-subtareas-nueva");

    document.getElementById("btn-agregar-subtarea-nueva").addEventListener("click", () => {
        listaSubtareas.insertAdjacentHTML("beforeend", subtareaNuevaFilaHtml());
    });

    listaSubtareas.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-quitar-subtarea-nueva")) {
            e.target.closest(".subtarea-nueva-fila").remove();
        }
    });

    // "Marcar todos" — atajo para el caso "todos los días", sin tener
    // que tildar las 7 a mano. Si ya estaban todas tildadas, destilda
    // todas (toggle), no queda pegado en un solo sentido.
    const checksDias = Array.from(document.querySelectorAll(".check-dia-tarea"));
    document.getElementById("btn-todos-los-dias-modal").addEventListener("click", () => {
        const todosMarcados = checksDias.every((c) => c.checked);
        checksDias.forEach((c) => { c.checked = !todosMarcados; });
    });
}

/** Reconstruye en el DOM TODAS las copias de una tarea (una por cada
 *  día en su .dias actual) a partir de lo que hay en registroTareas —
 *  saca las copias viejas primero. La usan tanto "Guardar" del modal
 *  como las pills de día de la propia tarjeta (bindDiasControl), así
 *  el mismo mecanismo cubre los dos caminos de cambiar el día. */
function recrearTareaEnPaneles(idTarea) {
    const tarea = registroTareas.get(idTarea);
    if (!tarea) return;
    // :not(.fila-aplica-tarea) — la fila de "Tareas" es también
    // .tarea-gestion con el mismo data-tarea-id, pero esa se
    // actualiza aparte (actualizarFilaAplica), no se destruye acá.
    document.querySelectorAll(`.tarea-gestion[data-tarea-id="${idTarea}"]:not(.fila-aplica-tarea)`).forEach((n) => n.remove());
    // dias vacío = "sin usar" — el .forEach de abajo simplemente no
    // agrega ninguna copia, no hace falta un guard aparte.
    tarea.dias.forEach((d) => {
        const lista = document.querySelector(`[data-panel-dia="${d}"] .lista-tareas-gestion`);
        if (!lista) return;
        lista.insertAdjacentHTML("beforeend", tareaHtml(tarea, `${idTarea}-${d}`));
        bindTarjetaNueva(lista.lastElementChild);
    });
    // Cualquier día pudo haber quedado sin nada (se le sacó la última
    // tarea) o dejar de estar vacío (se le sumó la primera) — revisar
    // los 7, no solo los de esta tarea, es la forma simple de no
    // dejar ni un aviso viejo colgado ni uno faltante.
    DIAS.forEach((d) => {
        actualizarAvisoDiaVacio(document.querySelector(`[data-panel-dia="${d}"] .lista-tareas-gestion`));
    });
    // Si el cambio de día se disparó DESDE la propia fila de "Tareas"
    // (sus pills son las mismas que las de la tarjeta), esa fila
    // también tiene que reflejar el estado nuevo — si no, queda
    // mostrando los días viejos hasta el próximo render.
    actualizarFilaAplica(idTarea);
}

/** Lee el form, valida (título + al menos un día) y guarda DE VERDAD
 *  contra la hoja "GestionTareas" (Fase 1) — crea o actualiza según
 *  venga `idEditado`. Devuelve true/false según si pudo guardar
 *  (false = validación falló O el backend rechazó, ya avisado con
 *  alert, el modal se queda abierto para corregir). El botón
 *  "Guardar" del modal ya muestra "Guardando..." solo mientras esto
 *  está pendiente (abrirModal lo maneja). */
async function confirmarTarea(idEditado = null) {
    const titulo = document.getElementById("input-tarea-titulo").value.trim();
    if (!titulo) {
        alert("Ponele un título a la tarea antes de guardar.");
        return false;
    }
    const dias = Array.from(document.querySelectorAll(".check-dia-tarea:checked")).map((c) => c.value);
    if (!dias.length) {
        alert("Elegí al menos un día para la tarea.");
        return false;
    }
    const detalle = document.getElementById("input-tarea-detalle").value.trim();
    const icono = document.getElementById("input-tarea-icono").value;
    const subitems = Array.from(document.querySelectorAll(".input-subtarea-nueva-texto"))
        .map((t) => t.value.trim())
        .filter(Boolean);
    const datos = { icono, titulo, detalle, dias, ...(subitems.length ? { subitems } : {}) };

    if (idEditado) {
        const r = await actualizarTareaBackend(idEditado, datos);
        if (!r?.ok) {
            alert("No se pudo guardar — probá de nuevo.");
            return false;
        }
        registroTareas.set(idEditado, { id: idEditado, ...datos });
        TAREAS = TAREAS.map((t) => (t.id === idEditado ? registroTareas.get(idEditado) : t));
        recrearTareaEnPaneles(idEditado);
    } else {
        const nueva = await crearTareaBackend(datos);
        if (!nueva) {
            alert("No se pudo crear la tarea — probá de nuevo.");
            return false;
        }
        registroTareas.set(nueva.id, nueva);
        TAREAS.push(nueva);
        recrearTareaEnPaneles(nueva.id);
    }
    return true;
}

/** Elimina TODAS las copias de una tarea (Admin, incluida la fila de
 *  "Tareas" — también es .tarea-gestion) — pide confirmación
 *  explícita, mismo patrón que ya usan Locales/Manuales/Colaboradores
 *  (confirm() con el nombre de lo que se borra), y recién saca del
 *  DOM/registro si el backend confirmó el borrado. */
async function eliminarTarea(idTarea) {
    const tarea = registroTareas.get(idTarea);
    if (!confirm(`¿Eliminar "${tarea?.titulo || "esta tarea"}"? Esta acción no se puede deshacer.`)) return;
    const r = await eliminarTareaBackend(idTarea);
    if (!r?.ok) {
        alert("No se pudo eliminar — probá de nuevo.");
        return;
    }
    document.querySelectorAll(`.tarea-gestion[data-tarea-id="${idTarea}"]`).forEach((n) => n.remove());
    registroTareas.delete(idTarea);
    TAREAS = TAREAS.filter((t) => t.id !== idTarea);
}

/** Abre el modal de tarea — sin argumentos, "+ Nueva tarea"; con
 *  `idEditado` + `tarea`, "Editar" precargado. */
function abrirModalTarea({ idEditado = null, tarea = null } = {}) {
    const idModal = "modal-tarea";
    abrirModal(
        Modal({ id: idModal, titulo: idEditado ? "Editar tarea" : "Nueva tarea", contenidoHtml: contenidoModalTarea({ tarea }), textoConfirmar: "Guardar" }),
        idModal,
        async () => {
            const ok = await confirmarTarea(idEditado);
            if (!ok) return;
            cerrarModal(idModal);
        },
    );
    bindModalTarea();
}

/* ============================
   3. ¿Qué hago si...? — molde fijo, sin contenido todavía

   Mismas 5 columnas para TODAS las situaciones a propósito — así el
   día que se carga el contenido real, es llenar el molde, no
   inventar el formato de nuevo cada vez. "fuente" queda documentado
   acá mismo (no en el HTML) para saber de un vistazo qué situación
   ya tiene material real esperando y cuál hay que redactar de cero.
=============================*/
const SITUACIONES_QUE_HAGO_SI = [
    {
        icono: "corazon",
        titulo: "Conflicto con un cliente",
        fuente: "Ya existe contenido real en Manuales (Atención al Cliente) — pendiente traerlo acá, no inventar de nuevo.",
    },
    {
        icono: "usuarios",
        titulo: "Falta de personal",
        fuente: "Sin fuente todavía — hay que definir el criterio con el usuario, situación por situación.",
    },
];

const CAMPOS_QUE_HAGO_SI = [
    { clave: "queHacer", label: "Qué hacer" },
    { clave: "queNoHacer", label: "Qué NO hacer" },
    { clave: "cuandoEscalar", label: "Cuándo escalar" },
    { clave: "herramienta", label: "Herramienta relacionada" },
];

function situacionQueHagoSiHtml(s, idx) {
    return `
        <div class="situacion-gestion" data-desplegable>
            <button type="button" class="situacion-gestion-header" data-toggle-desplegable>
                <span class="tarea-gestion-ico">${Icon(s.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${s.titulo}</strong>
                    <span>${s.fuente}</span>
                </span>
                <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
            </button>
            <div class="situacion-gestion-cuerpo" data-subitems>
                ${CAMPOS_QUE_HAGO_SI.map((c) => `
                    <div class="situacion-gestion-campo">
                        <strong>${c.label}</strong>
                        <p class="situacion-gestion-pendiente">Pendiente de contenido.</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

/* ============================
   Página
=============================*/
const TABS = [
    { id: "formacion", label: "Formación" },
    { id: "quehagosi", label: "¿Qué hago si...?" },
    { id: "semanal", label: "Gestión semanal" },
];

export async function Gestion() {
    // FASE 1: se lee de la hoja real en cada entrada a la página — el
    // router ya muestra MascotaCarga() mientras esto resuelve, no hace
    // falta un loading propio acá.
    TAREAS = await getTareas();

    // Puebla el registro (id → tarea real) con lo que arranca cargado
    // — así "Editar" y las pills de día tienen de dónde leer/escribir
    // desde el primer render, no solo para lo creado después.
    registroTareas.clear();
    TAREAS.forEach((t) => registroTareas.set(t.id, t));

    return `
        ${Header("Gestión semanal", "Tareas, formación y guías para el día a día de tu local")}

        <div class="tabs-gestion" id="tabs-gestion">
            ${TABS.map((t, i) => `<button class="tab-gestion${i === 0 ? " activa" : ""}" data-vista-gestion="${t.id}">${t.label}</button>`).join("")}
        </div>

        <div data-panel-gestion="formacion">
            <div class="aviso-maqueta">
                ${Icon("idea", { size: 16 })}
                <p>Estas guías se van a ir sumando de a poco. Si te falta algo puntual, consultalo con tu supervisor mientras tanto.</p>
            </div>
            <div class="section">
                <div class="lista-temas-formacion">
                    ${TEMAS_FORMACION.map(temaFormacionHtml).join("")}
                </div>
            </div>
        </div>

        <div data-panel-gestion="semanal" style="display:none">
            <div class="acciones-gestion-semanal">
                <button type="button" class="btn btn-secondary" id="btn-exportar-gestion">
                    ${Icon("descargar", { size: 16 })} Exportar a PDF
                </button>
                ${esAdminActual() ? `
                    <button type="button" class="btn btn-primary" id="btn-nueva-tarea">
                        + Nueva tarea
                    </button>
                ` : ""}
            </div>

            <div class="tabs-gestion" id="tabs-dias-gestion">
                <button class="tab-gestion activa" data-vista-dia="tareas">Tareas</button>
                ${DIAS.map((d) => `<button class="tab-gestion" data-vista-dia="${d}">${d}</button>`).join("")}
            </div>

            <!-- "Tareas": catálogo — tocás una, se despliegan sus
                 días, elegís. Con al menos un día queda verde ("En
                 uso") y aparece en esos días reales; sin ninguno,
                 gris ("Sin usar") y no aparece en ningún lado. Vive
                 FUERA de #contenido-gestion-imprimible: es
                 configuración, no algo que se exporte en el PDF del
                 día. -->
            <div class="section" data-panel-dia="tareas">
                <p class="aviso-tareas-aplicables">${TAREAS.length ? "Tocá una tarea para elegir en qué días la necesitás." : "Todavía no hay ninguna tarea cargada — empezá con \"+ Nueva tarea\"."}</p>
                <div class="lista-tareas-gestion" id="lista-aplica-tareas">
                    ${TAREAS.map(aplicaTareaHtml).join("")}
                </div>
            </div>

            <div id="contenido-gestion-imprimible">
                ${membreteHtml("Guía de Gestión")}
                ${DIAS.map((d) => {
                    const tareasDelDia = TAREAS.filter((t) => t.dias.includes(d));
                    return `
                    <div class="section" data-panel-dia="${d}" style="display:none">
                        <h3>${d}</h3>
                        <div class="lista-tareas-gestion">
                            ${tareasDelDia.length ? tareasDelDia.map((t) => tareaHtml(t, `${t.id}-${d}`)).join("") : avisoDiaVacioHtml()}
                        </div>
                    </div>
                `;
                }).join("")}
            </div>
        </div>

        <div data-panel-gestion="quehagosi" style="display:none">
            <div class="section">
                <div class="lista-situaciones-gestion">
                    ${SITUACIONES_QUE_HAGO_SI.map(situacionQueHagoSiHtml).join("")}
                </div>
            </div>
        </div>
    `;
}

// ── Funciones de bind reutilizables ──────────────────────────────
// Se usan tanto en la carga inicial de la página como en una tarea
// recién creada/editada/movida de día — así una tarjeta siempre se
// comporta igual, sin duplicar la lógica en dos lugares.

function bindCheckboxHecha(chk) {
    chk.addEventListener("change", () => {
        chk.closest(".tarea-gestion").classList.toggle("hecha", chk.checked);
    });
}

/** Pills Do/Lu/Ma/.../Sá de la propia tarjeta — tocar una prende/apaga
 *  ESE día para la tarea (no reemplaza el resto, los suma/saca). NO
 *  cambia de pestaña sola (se sacó a pedido — molestaba justo donde
 *  más se usa, eligiendo varios días seguidos desde "Tareas"). Llegar
 *  a CERO días es válido a propósito: es la forma de decir "sin usar"
 *  desde ahí — no hay un interruptor aparte, "aplica" ES tener algún
 *  día. Reconstruye las copias con recrearTareaEnPaneles (mismo
 *  camino que "Guardar" del modal).
 *
 *  FASE 1: optimista — la pantalla cambia al toque, el guardado real
 *  contra "GestionTareas" va en segundo plano sin bloquear el click
 *  (tocar 3-4 pills seguidas no tiene que sentirse con el ~1.5s de
 *  latencia real de Apps Script en cada una). Si falla, se avisa y se
 *  revierte — no queda mostrando algo que en la hoja real no quedó. */
function bindDiasControl(contenedor) {
    contenedor.querySelectorAll("[data-toggle-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idTarea = contenedor.closest(".tarea-gestion").dataset.tareaId;
            const tarea = registroTareas.get(idTarea);
            if (!tarea) return;
            const dia = btn.dataset.toggleDia;
            const idx = tarea.dias.indexOf(dia);
            if (idx === -1) tarea.dias.push(dia); else tarea.dias.splice(idx, 1);
            recrearTareaEnPaneles(idTarea);
            actualizarTareaBackend(idTarea, tarea).then((r) => {
                if (r?.ok) return;
                alert(`No se pudo guardar el cambio de día para "${tarea.titulo}" — probá de nuevo.`);
                // Revertir en memoria y en pantalla al estado de antes del click.
                if (idx === -1) tarea.dias.splice(tarea.dias.indexOf(dia), 1);
                else tarea.dias.splice(idx, 0, dia);
                recrearTareaEnPaneles(idTarea);
            });
        });
    });
}

/** Tareas con sub-ítems (ej. "Pedido a proveedores") y situaciones de
 *  "¿Qué hago si...?" comparten el mismo patrón desplegable: tocar el
 *  encabezado abre/cierra lo de abajo, con "+ Agregar ítem" propio. */
function bindTarjetaDesplegable(tarjeta) {
    const header = tarjeta.querySelector("[data-toggle-desplegable]");
    const contenedorSubitems = tarjeta.querySelector("[data-subitems]");
    const progreso = tarjeta.querySelector("[data-progreso]");

    header.addEventListener("click", () => {
        tarjeta.classList.toggle("desplegada");
    });

    if (!contenedorSubitems || !progreso) return; // situación de "¿Qué hago si...?": no tiene checklist derivado.

    // Recalcula SIEMPRE contra lo que hay en el DOM en ese momento (no
    // una lista capturada al abrir la página) — así "16/16" en vez de
    // "0/8" cuando se agregaron ítems nuevos, sin pedirlo por código.
    function actualizarProgreso() {
        const subitems = contenedorSubitems.querySelectorAll(".subitem-gestion-check");
        const hechos = Array.from(subitems).filter((s) => s.checked).length;
        progreso.textContent = `${hechos}/${subitems.length}`;
        tarjeta.classList.toggle("hecha", subitems.length > 0 && hechos === subitems.length);
    }

    // Un solo listener por delegación cubre los checkboxes de siempre
    // Y los que se agreguen después — no hace falta reenganchar nada
    // cuando crece la lista.
    contenedorSubitems.addEventListener("change", (e) => {
        if (e.target.classList.contains("subitem-gestion-check")) actualizarProgreso();
    });

    const inputNuevo = tarjeta.querySelector(".input-subitem-nuevo");
    const filaAgregar = tarjeta.querySelector(".subitem-gestion-agregar");

    function agregarSubitem() {
        const texto = (inputNuevo.value || "").trim();
        if (!texto) return;
        const idNuevo = `subitem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const label = document.createElement("label");
        label.className = "subitem-gestion";
        label.setAttribute("for", idNuevo);
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.id = idNuevo;
        chk.className = "subitem-gestion-check";
        const span = document.createElement("span");
        span.textContent = texto; // textContent, nunca innerHTML — no confiar en lo que tipeó el usuario acá
        label.append(chk, span);
        contenedorSubitems.insertBefore(label, filaAgregar);
        inputNuevo.value = "";
        inputNuevo.focus();
        actualizarProgreso();
    }

    tarjeta.querySelector("[data-agregar-subitem]")?.addEventListener("click", agregarSubitem);
    inputNuevo?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); agregarSubitem(); }
    });
}

/** Sincroniza la fila de la pestaña "Tareas" con lo que se acaba de
 *  crear/editar/mover de día — la vuelve a dibujar si ya existía
 *  (título/detalle/días/color "en uso" pueden haber cambiado) o la
 *  agrega si es una tarea nueva. Conserva si estaba desplegada, para
 *  no cerrarle la tarjeta en la cara a media edición. */
function actualizarFilaAplica(idTarea) {
    const tarea = registroTareas.get(idTarea);
    if (!tarea) return;
    const filaVieja = document.querySelector(`.fila-aplica-tarea[data-tarea-id="${idTarea}"]`);
    const estabaDesplegada = filaVieja?.classList.contains("desplegada");
    if (filaVieja) filaVieja.outerHTML = aplicaTareaHtml(tarea);
    else document.getElementById("lista-aplica-tareas")?.insertAdjacentHTML("beforeend", aplicaTareaHtml(tarea));
    const filaNueva = document.querySelector(`.fila-aplica-tarea[data-tarea-id="${idTarea}"]`);
    if (!filaNueva) return;
    if (estabaDesplegada) filaNueva.classList.add("desplegada");
    // bindTarjetaNueva le engancha TODO lo que le corresponda (día,
    // desplegable, Editar, Eliminar) — antes solo se enganchaba el
    // desplegable y las pills de día, y Editar/Eliminar quedaban sin
    // listener (el botón estaba en el HTML pero clickearlo no hacía
    // nada). bindTarjetaNueva también busca .tarea-gestion-check, que
    // acá no existe — no-op inofensivo, no un problema.
    bindTarjetaNueva(filaNueva);
}

function bindEditarTarea(boton) {
    boton.addEventListener("click", () => {
        const idTarea = boton.closest(".tarea-gestion").dataset.tareaId;
        const tarea = registroTareas.get(idTarea);
        if (tarea) abrirModalTarea({ idEditado: idTarea, tarea });
    });
}

function bindEliminarTarea(boton) {
    boton.addEventListener("click", () => {
        eliminarTarea(boton.closest(".tarea-gestion").dataset.tareaId);
    });
}

/** "Enviar push" — arma el título/cuerpo según el estado ACTUAL en
 *  pantalla (todos los sub-ítems tildados, o el propio check si es
 *  una tarea simple) y lo manda vía mandarPushGestion, que NO recibe
 *  destinatarios — el backend decide solo (los demás Responsables de
 *  local/turno de la MISMA sucursal). Así lo puede usar cualquier
 *  Responsable de local/turno sin que el cliente tenga que saber (ni
 *  pueda manipular) a quién le llega. No depende de que el
 *  check esté persistido (eso es Fase 2) — mide lo que hay tildado
 *  ahora mismo, tal como se pidió. */
function bindEnviarPush(boton) {
    boton.addEventListener("click", async () => {
        const tarjeta = boton.closest(".tarea-gestion");
        const idTarea = tarjeta.dataset.tareaId;
        const tarea = registroTareas.get(idTarea);
        if (!tarea) return;

        const subitems = Array.from(tarjeta.querySelectorAll(".subitem-gestion-check"));
        const checkPropio = tarjeta.querySelector(".tarea-gestion-check");
        // Desde "Tareas" (catálogo) no hay nada tildable en la tarjeta
        // — ahí no corresponde decir "incompleta" por defecto, es un
        // aviso neutro nomás.
        const hayEstado = subitems.length > 0 || !!checkPropio;
        const completa = subitems.length ? subitems.every((s) => s.checked) : !!checkPropio?.checked;

        const textoOriginal = boton.textContent;
        let enviado = false;
        boton.disabled = true;
        boton.textContent = "Enviando...";
        try {
            const cuerpo = !hayEstado
                ? "Aviso desde Gestión semanal."
                : completa ? "Tarea completa ✅" : "Tarea incompleta ⚠️ — revisá qué falta en la app.";
            const r = await mandarPushGestion(tarea.titulo, cuerpo, "#/gestion");
            if (!r?.ok) {
                alert(r?.error || "No se pudo enviar el push — probá de nuevo.");
                return;
            }
            // Confirmación visible de que SÍ salió — antes quedaba
            // mudo en el caso de éxito, indistinguible de "no hizo
            // nada" (pedido explícito: "no se sabe si se envió").
            enviado = true;
            boton.textContent = "✓ Enviado";
            setTimeout(() => { boton.textContent = textoOriginal; }, 2000);
        } finally {
            boton.disabled = false;
            if (!enviado) boton.textContent = textoOriginal;
        }
    });
}

/** Le engancha a un nodo (recién insertado por confirmarTarea o
 *  recrearTareaEnPaneles) todo lo que le corresponda según su forma —
 *  mismo resultado que si hubiera venido en el render inicial. */
function bindTarjetaNueva(nodo) {
    nodo.querySelectorAll(".tarea-gestion-check").forEach(bindCheckboxHecha);
    nodo.querySelectorAll(".tarea-gestion-dia-control").forEach(bindDiasControl);
    nodo.querySelectorAll("[data-editar-tarea]").forEach(bindEditarTarea);
    nodo.querySelectorAll("[data-eliminar-tarea]").forEach(bindEliminarTarea);
    nodo.querySelectorAll("[data-enviar-push]").forEach(bindEnviarPush);
    if (nodo.matches("[data-desplegable]")) bindTarjetaDesplegable(nodo);
}

export function bindGestion() {
    // Tabs: mostrar/ocultar paneles, nada más — cada panel ya vino
    // renderizado entero desde Gestion(), no hay fetch por tab.
    const tabs = document.getElementById("tabs-gestion");
    tabs?.querySelectorAll("[data-vista-gestion]").forEach((btn) => {
        btn.addEventListener("click", () => {
            tabs.querySelectorAll("[data-vista-gestion]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            const vista = btn.dataset.vistaGestion;
            document.querySelectorAll("[data-panel-gestion]").forEach((panel) => {
                panel.style.display = panel.dataset.panelGestion === vista ? "" : "none";
            });
        });
    });

    // Pills de días (Domingo primero) — mismo patrón que los tabs de
    // área, anidado adentro de "Gestión semanal".
    const tabsDias = document.getElementById("tabs-dias-gestion");
    tabsDias?.querySelectorAll("[data-vista-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
            tabsDias.querySelectorAll("[data-vista-dia]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            const dia = btn.dataset.vistaDia;
            document.querySelectorAll("[data-panel-dia]").forEach((panel) => {
                panel.style.display = panel.dataset.panelDia === dia ? "" : "none";
            });
        });
    });

    document.querySelectorAll(".tarea-gestion-check").forEach(bindCheckboxHecha);
    document.querySelectorAll(".tarea-gestion-dia-control").forEach(bindDiasControl);
    document.querySelectorAll("[data-desplegable]").forEach(bindTarjetaDesplegable);
    document.querySelectorAll("[data-editar-tarea]").forEach(bindEditarTarea);
    document.querySelectorAll("[data-eliminar-tarea]").forEach(bindEliminarTarea);
    document.querySelectorAll("[data-enviar-push]").forEach(bindEnviarPush);

    // "+ Nueva tarea" (admin) — mismo patrón que ya existe en
    // Lecciones: encabezado + sub-tareas sueltas, los días se eligen
    // con checkboxes.
    document.getElementById("btn-nueva-tarea")?.addEventListener("click", () => abrirModalTarea());

    // "Exportar a PDF" — solo la Gestión semanal (es la única parte
    // operativa, lo que se "lleva al sistema" después de hacer la
    // ronda). exportarAPdf() copia el innerHTML tal cual está en el
    // DOM — un checkbox tildado a mano cambia su propiedad .checked
    // pero NO el atributo checked="" que queda en el HTML serializado,
    // así que sin este paso el PDF salía con TODO destildado por más
    // que se hubiera marcado todo. Se sincroniza el atributo con el
    // estado real justo antes de exportar.
    document.getElementById("btn-exportar-gestion")?.addEventListener("click", () => {
        document.querySelectorAll("#contenido-gestion-imprimible input[type=checkbox]").forEach((chk) => {
            if (chk.checked) chk.setAttribute("checked", "checked");
            else chk.removeAttribute("checked");
        });
        exportarAPdf("contenido-gestion-imprimible", "Guía de Gestión");
    });
}
