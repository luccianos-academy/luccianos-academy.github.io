/* ============================
   Lucciano's Academy
   pages/gestion.js — Responsables de Local y Turno

   Herramienta operativa de un solo propósito: el checklist de tareas
   por día (arranca Domingo — más actividad, se cuenta para recibir el
   lunes). Cada tarea tiene una o más "dias" (ej. depósitos: Lunes Y
   Viernes) — "aplica a mi local" NO es un interruptor aparte, ES tener
   al menos un día elegido. La pestaña "Tareas" es un catálogo
   desplegable: tocás una tarea, se despliegan las pills de día ahí
   mismo, elegís, y pasa a verde ("En uso"). Sin ningún día, queda gris
   ("Sin usar") y no aparece en ningún día real.

   FASE 1 del backend (2026-08-24): el catálogo de tareas (crear/
   editar/eliminar, sin días) ya persiste de verdad contra la hoja
   "GestionTareas" (data/gestionTareas.js) — no más array hardcodeado.

   FASE 2 (2026-08-25): EN QUÉ DÍAS le aplica cada tarea a CADA
   sucursal ya no vive en la tarea del catálogo (compartido por toda
   la red, bug de diseño real) — vive aparte, por sucursal, en la hoja
   "GestionTareasSucursal" (data/gestionTareasSucursal.js). Acá se
   siguen manejando como `t.dias` en memoria (mismo shape de siempre,
   para no reescribir toda la UI) — se MEZCLAN al cargar la página
   (Gestion(), con los días de MI sucursal) y se GUARDAN aparte
   (guardarDiasSucursal, no actualizarTareaBackend) al tocar una pill.
   El CHECK de "hecho hoy" sigue siendo puramente visual (se resetea
   al recargar) — eso queda para más adelante.

   Antes convivía acá, con pestañas propias, el molde sin contenido de
   "Formación" (títulos de tema, todos "Próximamente") y "¿Qué hago
   si...?" (guía situacional) — se sacaron el 2026-08-25: las
   lecciones reales ya viven en Academia (curso "Responsables de Local
   y Turno"), y esta pantalla pasó a ser solo la herramienta de
   gestión, sin mezclar formación adentro.
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
import { getDiasPorSucursal, guardarDiasSucursal } from "../data/gestionTareasSucursal.js";
import { getChecksPorSucursal, guardarCheckSucursal } from "../data/gestionChecks.js";
import { invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";
import { AutocompleteSucursal, bindAutocompleteSucursal } from "../components/autocompleteSucursal.js";

/* ============================
   Gestión semanal — el checklist, por día

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

/** Fase 2 (2026-08-25): Admin/Supervisor/Capacitador entran en modo
 *  lectura con un selector de local — ven exactamente cómo ese local
 *  armó su semana, sin poder tocar nada (ni pills, ni checks, ni
 *  push). Responsable de local/turno (rol "colaborador") nunca ve el
 *  selector — va directo a SU sucursal, editable como siempre. Estado
 *  de módulo (no por-request) porque el selector cambia de sucursal
 *  sin recargar toda la página — Gestion()/bindGestion() lo leen. */
let esVistaLectura = false;
let sucursalActiva = "";

/** "tareaId|dia" → {marcadoPor, hora} — checks "hecho" REALES de la
 *  sucursal activa (persistidos, ya no visuales). Se puebla en
 *  cargarDatos() y se usa al renderizar tareaHtml() y al guardar un
 *  toggle. Ver data/gestionChecks.js. */
let checksActivos = {};

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
    // Solo lectura: pills como <span>, sin data-toggle-dia — no hay
    // nada que enganchar, ni forma de tocarlas por accidente.
    return `
        <div class="tarea-gestion-dia-control">
            <span class="tarea-gestion-dia-label">Días</span>
            <div class="dias-pills-tarea">
                ${DIAS.map((d) => {
                    const activa = t.dias.includes(d);
                    return esVistaLectura
                        ? `<span class="pill-dia-tarea${activa ? " activa" : ""}" title="${d}">${d.slice(0, 2)}</span>`
                        : `<button type="button" class="pill-dia-tarea${activa ? " activa" : ""}" data-toggle-dia="${d}" title="${d}">${d.slice(0, 2)}</button>`;
                }).join("")}
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
    // Solo Responsable de local/turno avisa por push — en modo
    // lectura (Admin/Supervisor mirando otro local) no corresponde:
    // el aviso tiene que salir de la gente que gestiona ESE local.
    if (esVistaLectura) return "";
    return `
        <div class="tarea-gestion-push">
            <button type="button" class="btn-enviar-push" data-enviar-push>${Icon("campana", { size: 14 })} Enviar push</button>
        </div>
    `;
}

/** Lista de sub-ítems de una tarea, SOLO LECTURA — pedido explícito:
 *  "en tareas si cargue sub tareas quiero verlas porque sino no se
 *  que tiene cargado una tarea". Sin checkbox ni tildado: acá no se
 *  ejecuta nada, solo se ve qué contiene la tarea (eso pasa en la
 *  vista por día, ver tareaHtml). */
function subitemsSoloLecturaHtml(t) {
    if (!t.subitems || !t.subitems.length) return "";
    return `
        <div class="tarea-gestion-dia-control">
            <span class="tarea-gestion-dia-label">Contiene</span>
            <ul class="lista-subitems-solo-lectura">
                ${t.subitems.map((s) => `<li>${s}</li>`).join("")}
            </ul>
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
    // Admin/Supervisor SIN local elegido todavía: el catálogo (crear/
    // editar/eliminar tareas) no depende de ningún local — solo los
    // días sí. Acá se ve la tarea igual, pero sin badge "en uso"/
    // pills (no tienen sentido sin saber de qué local). El push NO va
    // acá — pedido explícito: "Tareas" es donde se ASIGNA el día, el
    // push se manda desde la vista de cada día, ejecutando.
    const sinLocalElegido = esVistaLectura && !sucursalActiva;
    const enUso = t.dias.length > 0;
    return `
        <div class="tarea-gestion tarea-gestion-desplegable fila-aplica-tarea${enUso ? " en-uso" : ""}" data-desplegable data-tarea-id="${t.id}">
            <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                </span>
                ${sinLocalElegido ? "" : `<span class="badge-en-uso${enUso ? " activa" : ""}">${enUso ? "En uso" : "Sin usar"}</span>`}
                <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
            </button>
            <div class="tarea-gestion-subitems">
                ${subitemsSoloLecturaHtml(t)}
                ${sinLocalElegido ? `<p class="aviso-tareas-aplicables" style="margin:0">Elegí un local arriba para ver y tocar sus días.</p>` : diasControlHtml(t)}
                ${accionesTareaHtml()}
            </div>
        </div>
    `;
}

function tareaHtml(t, idUnico, dia) {
    const id = `tarea-${idUnico}`;
    // data-tarea-id va en TODAS las tarjetas — es la identidad que usa
    // Editar/Eliminar/pills-de-día para encontrar todas las copias de
    // esta tarea (una por cada día en t.dias) sin importar el panel.
    // data-dia identifica CUÁL de esos días es esta copia puntual — el
    // check ahora es real (GestionChecks), por tarea+sucursal+día, así
    // que hace falta saber cuál para guardar/leer el correcto.
    const atrId = ` data-tarea-id="${t.id}" data-dia="${dia}"`;
    const check = checksActivos[`${t.id}|${dia}`];
    const hechoTexto = check ? `Hecho ${check.hora || ""}${check.marcadoPor ? ` · ${check.marcadoPor}` : ""}` : "";

    if (t.subitems) {
        return `
            <div class="tarea-gestion tarea-gestion-desplegable${check ? " hecha" : ""}" data-desplegable${atrId}>
                <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                    <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                    <span class="tarea-gestion-txt">
                        <strong>${t.titulo}</strong>
                        <span>${t.detalle}</span>
                    </span>
                    <span class="tarea-gestion-hora" data-hora>${hechoTexto}</span>
                    <span class="tarea-gestion-progreso" data-progreso>${check ? t.subitems.length : 0}/${t.subitems.length}</span>
                    <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
                </button>
                <div class="tarea-gestion-subitems" data-subitems>
                    ${t.subitems.map((s, is) => `
                        <label class="subitem-gestion" for="${id}-${is}">
                            <input type="checkbox" id="${id}-${is}" class="subitem-gestion-check"${esVistaLectura ? " disabled" : ""}${check ? " checked" : ""}>
                            <span>${s}</span>
                        </label>
                    `).join("")}
                </div>
                ${botonPushHtml()}
                ${accionesTareaHtml()}
            </div>
        `;
    }

    return `
        <div class="tarea-gestion tarea-gestion-simple${check ? " hecha" : ""}"${atrId}>
            <label class="tarea-gestion-label" for="${id}">
                <input type="checkbox" id="${id}" class="tarea-gestion-check"${esVistaLectura ? " disabled" : ""}${check ? " checked" : ""}>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                </span>
                <span class="tarea-gestion-hora" data-hora>${hechoTexto}</span>
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
/** Nueva/Editar tarea — catálogo puro (Admin). Los días quedaron
 *  afuera de este modal desde Fase 2: no son parte de la definición
 *  de la tarea, son elección de cada local — se eligen con las pills
 *  de la pestaña "Tareas", no acá. */
function contenidoModalTarea({ tarea } = {}) {
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
        lista.insertAdjacentHTML("beforeend", tareaHtml(tarea, `${idTarea}-${d}`, d));
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
/** Guarda el catálogo (título/ícono/detalle/sub-ítems) — los días NO
 *  se tocan acá desde Fase 2: son de cada local, no de la tarea. Al
 *  editar, se preserva el `dias` que ya tenía cargado en memoria (el
 *  de MI sucursal, mezclado al entrar a la página) — si no, "Editar"
 *  el título de una tarea borraría de la pantalla los días que ese
 *  mismo local ya había elegido (aunque en la Sheet de
 *  GestionTareasSucursal sigan intactos). */
async function confirmarTarea(idEditado = null) {
    const titulo = document.getElementById("input-tarea-titulo").value.trim();
    if (!titulo) {
        alert("Ponele un título a la tarea antes de guardar.");
        return false;
    }
    const detalle = document.getElementById("input-tarea-detalle").value.trim();
    const icono = document.getElementById("input-tarea-icono").value;
    const subitems = Array.from(document.querySelectorAll(".input-subtarea-nueva-texto"))
        .map((t) => t.value.trim())
        .filter(Boolean);
    const datos = { icono, titulo, detalle, ...(subitems.length ? { subitems } : {}) };

    if (idEditado) {
        const r = await actualizarTareaBackend(idEditado, datos);
        if (!r?.ok) {
            alert("No se pudo guardar — probá de nuevo.");
            return false;
        }
        const diasPrevios = registroTareas.get(idEditado)?.dias || [];
        registroTareas.set(idEditado, { id: idEditado, ...datos, dias: diasPrevios });
        TAREAS = TAREAS.map((t) => (t.id === idEditado ? registroTareas.get(idEditado) : t));
        recrearTareaEnPaneles(idEditado);
    } else {
        const nueva = await crearTareaBackend(datos);
        if (!nueva) {
            alert("No se pudo crear la tarea — probá de nuevo.");
            return false;
        }
        nueva.dias = []; // nace "sin usar" en todos los locales.
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
   Página
=============================*/
/** Selector de local — SOLO Admin/Supervisor/Capacitador (esVistaLectura).
 *  Responsable de local/turno nunca lo ve: va directo a su sucursal.
 *  Buscador con coincidencia en vivo (AutocompleteSucursal, mismo
 *  componente que usa Colaboradores) — con ~125 locales reales, un
 *  <select> obligaba a scrollear la lista entera para encontrar uno. */
function selectorLocalHtml() {
    // El botón de limpiar vive siempre en el DOM (oculto por CSS si no
    // hay local elegido) — el selector se renderiza una sola vez en
    // Gestion() y NO se reconstruye al elegir un local (solo
    // #cuerpo-gestion sí), así que mostrarlo/ocultarlo es cosa de
    // bindGestion(), no de volver a armar este HTML.
    return `
        <div class="campo-selector-local">
            <label for="selector-local-gestion">${Icon("locales", { size: 15 })} Local</label>
            ${AutocompleteSucursal("selector-local-gestion", sucursalActiva)}
            <button type="button" class="btn-limpiar-local" id="btn-limpiar-local" title="Borrar selección" aria-label="Borrar selección de local"${sucursalActiva ? "" : ' style="display:none"'}>${Icon("cerrar", { size: 14 })}</button>
        </div>
    `;
}

/** Todo lo que depende de qué local está activo — se reconstruye
 *  entero cada vez que cambia el selector (Admin/Supervisor) sin
 *  recargar la página. Para Responsable de local/turno es simplemente
 *  "su" cuerpo de siempre, una sola vez. */
function cuerpoGestionHtml() {
    const botonExportar = sucursalActiva ? `
        <button type="button" class="btn btn-secondary" id="btn-exportar-gestion">
            ${Icon("descargar", { size: 16 })} Exportar a PDF
        </button>
    ` : "";
    const botonNueva = esAdminActual() ? `
        <button type="button" class="btn btn-primary" id="btn-nueva-tarea">
            + Nueva tarea
        </button>
    ` : "";
    const acciones = (botonExportar || botonNueva) ? `<div class="acciones-gestion-semanal">${botonExportar}${botonNueva}</div>` : "";
    const hayLocal = !esVistaLectura || !!sucursalActiva;

    // "Tareas" (catálogo) se ve SIEMPRE, con local elegido o sin él —
    // Admin no necesita elegir un local para crear/editar/eliminar
    // tareas del catálogo, eso es global. aplicaTareaHtml() ya sabe
    // ocultar días/push cuando no hay local (sinLocalElegido).
    // Segmentado en Activas/No activas — pedido explícito: "si cargo
    // 50 tareas es un montón de info", con un local elegido (ahí SÍ
    // hay días reales para decidir quién es activa) separarlas de un
    // pantallazo evita tener que abrir tarjeta por tarjeta para saber
    // cuáles están en uso. Sin local elegido no hay "activa" que
    // decidir (t.dias siempre viene vacío), así que ahí sigue plana.
    const listaTareasHtml = hayLocal
        ? (() => {
            const activas = TAREAS.filter((t) => t.dias.length > 0);
            const noActivas = TAREAS.filter((t) => t.dias.length === 0);
            return `
                ${activas.length ? `
                    <p class="titulo-grupo-tareas">En uso (${activas.length})</p>
                    <div class="lista-tareas-gestion">${activas.map(aplicaTareaHtml).join("")}</div>
                ` : ""}
                ${noActivas.length ? `
                    <p class="titulo-grupo-tareas">Sin usar (${noActivas.length})</p>
                    <div class="lista-tareas-gestion">${noActivas.map(aplicaTareaHtml).join("")}</div>
                ` : ""}
            `;
        })()
        : `<div class="lista-tareas-gestion">${TAREAS.map(aplicaTareaHtml).join("")}</div>`;

    const catalogoHtml = `
        <div class="section" data-panel-dia="tareas">
            <p class="aviso-tareas-aplicables">${!hayLocal ? "Elegí un local arriba para ver y tocar sus días." : esVistaLectura ? "Así quedaron elegidos los días de cada tarea en este local." : TAREAS.length ? "Tocá una tarea para elegir en qué días la necesitás." : "Todavía no hay ninguna tarea cargada — empezá con \"+ Nueva tarea\"."}</p>
            <div id="lista-aplica-tareas">
                ${listaTareasHtml}
            </div>
        </div>
    `;

    // Sin local elegido (Admin/Supervisor): se ve el catálogo pero no
    // los tabs de día ni el contenido imprimible — no hay UN esquema
    // de días sin saber de qué local (cada local tiene el suyo).
    if (!hayLocal) {
        return `
            ${acciones}
            <div class="tabs-gestion" id="tabs-dias-gestion">
                <button class="tab-gestion activa" data-vista-dia="tareas">Tareas</button>
            </div>
            ${catalogoHtml}
        `;
    }

    return `
        ${acciones}

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
        ${catalogoHtml}

        <div id="contenido-gestion-imprimible">
            ${membreteHtml("Guía de Gestión", sucursalActiva)}
            ${DIAS.map((d) => {
                const tareasDelDia = TAREAS.filter((t) => t.dias.includes(d));
                return `
                <div class="section" data-panel-dia="${d}" style="display:none">
                    <h3>${d}</h3>
                    <div class="lista-tareas-gestion">
                        ${tareasDelDia.length ? tareasDelDia.map((t) => tareaHtml(t, `${t.id}-${d}`, d)).join("") : avisoDiaVacioHtml()}
                    </div>
                </div>
            `;
            }).join("")}
        </div>
    `;
}

/** Trae el catálogo + los días de UNA sucursal (o ninguna) y puebla
 *  TAREAS/registroTareas — lo usan tanto la carga inicial (Gestion())
 *  como el selector de local al cambiar (bindGestion()), así las dos
 *  vías arman exactamente el mismo estado en memoria. */
async function cargarDatos(sucursal) {
    const [catalogo, dias, checks] = await Promise.all([
        getTareas(),
        sucursal ? getDiasPorSucursal(sucursal) : Promise.resolve({}),
        sucursal ? getChecksPorSucursal(sucursal) : Promise.resolve({}),
    ]);
    TAREAS = catalogo;
    // Se mezclan acá — el resto del archivo sigue leyendo/escribiendo
    // t.dias como siempre, sin saber que ahora viene de otra hoja.
    TAREAS.forEach((t) => { t.dias = dias[t.id] || []; });
    checksActivos = checks;
    registroTareas.clear();
    TAREAS.forEach((t) => registroTareas.set(t.id, t));
}

export async function Gestion() {
    const usuario = getUsuarioActual();
    // Admin/Supervisor/Capacitador (rol !== "colaborador") entran en
    // modo lectura con selector — nunca tienen "su" sucursal propia
    // para gestionar. Responsable de local/turno (rol "colaborador")
    // va directo a la suya, sin selector, editable como siempre.
    esVistaLectura = usuario?.rol !== "colaborador";
    sucursalActiva = esVistaLectura ? "" : (usuario?.sucursal || "");

    await cargarDatos(sucursalActiva);

    return `
        ${Header("Gestión semanal", "Organizá las tareas de tu local, día por día")}

        <div class="aviso-maqueta">
            ${Icon("idea", { size: 16 })}
            <p>Elegí en qué días aplica cada tarea desde "Tareas", tildala como hecha en la vista de cada día, y avisale al equipo con "Enviar push" cuando haga falta.</p>
        </div>

        ${esVistaLectura ? selectorLocalHtml() : ""}

        <div id="cuerpo-gestion">${cuerpoGestionHtml()}</div>
    `;
}

// ── Funciones de bind reutilizables ──────────────────────────────
// Se usan tanto en la carga inicial de la página como en una tarea
// recién creada/editada/movida de día — así una tarjeta siempre se
// comporta igual, sin duplicar la lógica en dos lugares.

/** "HH:MM" de ahora — pedido explícito: mostrar a qué hora se marcó
 *  una tarea como hecha. Por ahora es puramente visual, igual que el
 *  propio check (se resetea al recargar) — persistirlo de verdad
 *  contra el backend es la Fase pendiente del check por sucursal. */
function horaAhora() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Guarda el check DE VERDAD contra GestionChecks — antes era
 *  puramente visual (bug real: "quien dio el marcado no le aparece al
 *  otro", dos dispositivos en el mismo local no se veían entre sí).
 *  Optimista, mismo patrón que bindDiasControl: la pantalla cambia al
 *  toque, si el backend rechaza se avisa y se revierte. */
function bindCheckboxHecha(chk) {
    chk.addEventListener("change", () => {
        const tarjeta = chk.closest(".tarea-gestion");
        const tareaId = tarjeta.dataset.tareaId;
        const dia = tarjeta.dataset.dia;
        const hechoNuevo = chk.checked;

        tarjeta.classList.toggle("hecha", hechoNuevo);
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) hora.textContent = hechoNuevo ? `Hecho ${horaAhora()}` : "";

        guardarCheckSucursal(tareaId, dia, hechoNuevo, sucursalActiva).then((r) => {
            if (r?.ok) return;
            alert(r?.error || "No se pudo guardar — probá de nuevo.");
            chk.checked = !hechoNuevo;
            tarjeta.classList.toggle("hecha", !hechoNuevo);
            if (hora) hora.textContent = !hechoNuevo ? `Hecho ${horaAhora()}` : "";
        });
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
            // Fase 2: se guarda en GestionTareasSucursal (mi sucursal),
            // no en el catálogo — el backend decide de qué sucursal es
            // la fila (usuarioActual.sucursal), este valor es solo
            // para el guardado optimista en modo demo.
            guardarDiasSucursal(idTarea, tarea.dias, getUsuarioActual()?.sucursal).then((r) => {
                if (r?.ok) return;
                alert(r?.error || `No se pudo guardar el cambio de día para "${tarea.titulo}" — probá de nuevo.`);
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
        const completa = subitems.length > 0 && hechos === subitems.length;
        const yaEstabaCompleta = tarjeta.classList.contains("hecha");
        tarjeta.classList.toggle("hecha", completa);
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) {
            // Solo se pisa el horario al COMPLETARSE recién ahora — si
            // ya estaba completa y se vuelve a marcar (ej. se agregó un
            // ítem nuevo y se tildó de nuevo), no tiene sentido correr
            // la hora sin que haya cambiado el estado real.
            if (completa && !yaEstabaCompleta) hora.textContent = `Hecho ${horaAhora()}`;
            else if (!completa) hora.textContent = "";
        }
        // Se guarda DE VERDAD solo cuando el estado completo/incompleto
        // cambió — se persiste la tarea entera (completa o no), no
        // sub-ítem por sub-ítem (ver data/gestionChecks.js).
        if (completa !== yaEstabaCompleta) {
            guardarCheckSucursal(tarjeta.dataset.tareaId, tarjeta.dataset.dia, completa, sucursalActiva).then((r) => {
                if (r?.ok) return;
                alert(r?.error || "No se pudo guardar — probá de nuevo.");
            });
        }
    }

    // Un solo listener por delegación cubre todos los checkboxes.
    contenedorSubitems.addEventListener("change", (e) => {
        if (e.target.classList.contains("subitem-gestion-check")) actualizarProgreso();
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

/** Todo lo que hay que re-enganchar cada vez que #cuerpo-gestion se
 *  reconstruye — al cargar la página Y cada vez que Admin/Supervisor
 *  cambia de local en el selector (mismo contenido, nodos nuevos). */
function bindCuerpoGestion() {
    // Pills de días (Domingo primero) — único switcher de la pantalla
    // desde que se sacaron las pestañas de área ("Formación"/"¿Qué
    // hago si...?", 2026-08-25).
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
    // Lecciones: encabezado + sub-tareas sueltas.
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
        // soloDescarga: acá el reporte nunca es grande (un local, una
        // semana) — el botón "Imprimir" de respaldo para reportes
        // enormes es ruido, ver la nota en exportarAPdf().
        exportarAPdf("contenido-gestion-imprimible", "Guía de Gestión", { soloDescarga: true });
    });
}

/** Cambia de local (o lo borra, con nombre="") — la usan tanto elegir
 *  uno de la lista filtrada como el botón de limpiar (×). Trae los
 *  días de la sucursal elegida y reconstruye SOLO #cuerpo-gestion (el
 *  selector y el aviso de arriba no cambian). */
async function elegirLocalGestion(nombre) {
    sucursalActiva = nombre;
    const botonLimpiar = document.getElementById("btn-limpiar-local");
    if (botonLimpiar) botonLimpiar.style.display = nombre ? "" : "none";
    // Aviso de carga inmediato — traer los días de la sucursal pega
    // contra el backend real (~1-1.5s), sin esto la pantalla quedaba
    // quieta y no se notaba que estaba haciendo algo.
    const cuerpoAntes = document.getElementById("cuerpo-gestion");
    if (cuerpoAntes && nombre) cuerpoAntes.innerHTML = `<p class="aviso-tareas-aplicables">Cargando "${escaparHtml(nombre)}"…</p>`;
    await cargarDatos(sucursalActiva);
    const cuerpo = document.getElementById("cuerpo-gestion");
    if (!cuerpo) return;
    cuerpo.innerHTML = cuerpoGestionHtml();
    bindCuerpoGestion();
}

/** Trae los checks frescos de la sucursal activa y actualiza SOLO los
 *  checkboxes/clases/horas en el DOM (no reconstruye #cuerpo-gestion)
 *  — pedido explícito: "no es inmediato... quien recibió lo ve mal".
 *  Sin esto, la única forma de ver lo que marcó otro dispositivo era
 *  recargar la página entera, perdiendo el día/tarjeta que tenías
 *  abierta. Actualiza en el lugar, sin tocar pestañas ni desplegables. */
async function actualizarChecksEnDOM() {
    if (!sucursalActiva) return;
    // Fuerza una lectura REALMENTE fresca — invalidar() acá tira tanto
    // la caché en memoria (20s) como la marca de frescura de
    // IndexedDB (hasta 5 min), que si no seguía devolviendo la copia
    // vieja sin pegarle al backend, aunque este refresco se dispare
    // cada 20s. Sin esto el "casi en vivo" tardaba hasta 5 min en verse.
    invalidar(HOJAS.GESTION_CHECKS);
    let frescos;
    try {
        frescos = await getChecksPorSucursal(sucursalActiva);
    } catch (err) {
        return; // silencioso — es un refresco de fondo, no una acción del usuario
    }
    checksActivos = frescos;

    document.querySelectorAll("#contenido-gestion-imprimible .tarea-gestion[data-tarea-id][data-dia]").forEach((tarjeta) => {
        const clave = `${tarjeta.dataset.tareaId}|${tarjeta.dataset.dia}`;
        const check = checksActivos[clave];
        const hechoTexto = check ? `Hecho ${check.hora || ""}${check.marcadoPor ? ` · ${check.marcadoPor}` : ""}` : "";
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) hora.textContent = hechoTexto;
        tarjeta.classList.toggle("hecha", !!check);

        const checkSimple = tarjeta.querySelector(".tarea-gestion-check");
        if (checkSimple) checkSimple.checked = !!check;

        const subitems = tarjeta.querySelectorAll(".subitem-gestion-check");
        if (subitems.length) {
            subitems.forEach((s) => { s.checked = !!check; });
            const progreso = tarjeta.querySelector("[data-progreso]");
            if (progreso) progreso.textContent = `${check ? subitems.length : 0}/${subitems.length}`;
        }
    });
}

let intervaloChecksGestion = null;

export function bindGestion() {
    // Selector de local (Admin/Supervisor/Capacitador) — bindAutocompleteSucursal
    // es async (trae la lista de locales) — no bloquea el resto del bind.
    if (document.getElementById("selector-local-gestion")) {
        bindAutocompleteSucursal("selector-local-gestion", elegirLocalGestion);
    }

    // Botón "×" — pedido explícito: "que haya un botón de borrar
    // sucursal para no tener que entrar y borrar todo manual". Limpia
    // el input Y vuelve al estado sin local elegido, sin tener que
    // borrar el texto a mano letra por letra.
    document.getElementById("btn-limpiar-local")?.addEventListener("click", () => {
        const input = document.getElementById("selector-local-gestion");
        if (input) input.value = "";
        elegirLocalGestion("");
    });

    bindCuerpoGestion();

    // Refresco en segundo plano de los checks — cada 20s mientras se
    // esté en esta pantalla, sin recargar nada ni molestar lo que se
    // esté mirando. Se corta solo apenas el nodo desaparece (se
    // navegó a otra pantalla) — no hay hook de "salir de la página"
    // en este router, así que el propio intervalo se autochequea.
    if (intervaloChecksGestion) clearInterval(intervaloChecksGestion);
    intervaloChecksGestion = setInterval(() => {
        if (!document.getElementById("cuerpo-gestion")) {
            clearInterval(intervaloChecksGestion);
            intervaloChecksGestion = null;
            return;
        }
        actualizarChecksEnDOM();
    }, 20000);
}
