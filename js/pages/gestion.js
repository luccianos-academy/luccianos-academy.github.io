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
import { MultiSelectAlcance, bindMultiSelectAlcance } from "../components/multiSelectAlcance.js";
import { getSucursales } from "../data/sucursales.js";
import { aplicaASucursal, normalizar } from "../services/alcance.js";
import { TIPOS_SUBITEM, parsearSubitem, serializarSubitem, serializarMarcaSubitem, contarIncidenciasAgrupadas } from "../services/subitems.js";

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

/** SOLO para ORDEN VISUAL (pills/tabs) — pedido explícito: "quiero
 *  cambiar la semana que sea de lunes a domingo". DIAS (arriba) sigue
 *  siendo el array canónico para todo lo demás (guardado, el índice
 *  0=domingo de Date.getDay() en fechaDelDiaSemana/backend, el orden
 *  en que se guardan los checks) — cambiar SU orden hubiera afectado
 *  código que ya depende de "domingo primero" en varios lugares no
 *  visuales. Reordenar solo para mostrar es más simple y no arriesga
 *  nada de eso. */
const DIAS_VISUAL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** "asignar" (catálogo — elegís qué tareas y con qué frecuencia) o
 *  "ejecutar" ("Tareas asignadas" — pills de día/fecha, marcar hecha,
 *  exportar) — pedido explícito, con croquis: "quiero dos secciones...
 *  así queda dividida la sección y no está tan cargada de información
 *  que confunde". Reemplaza el toggle Semanal/Mensual + calendario
 *  visual (2026-08-26, revertido el mismo día) — un local puede tener
 *  tareas semanales Y mensuales a la vez, no tiene sentido elegir
 *  entre una u otra para EJECUTAR, solo para asignar. Estado de
 *  módulo (no se persiste, no hace falta). */
let vistaSeccion = "asignar";

/** Día (semanal) o día-del-mes (mensual) de la pill activa dentro de
 *  "Tareas asignadas" — decide qué [data-panel-dia] mostrar/ocultar.
 *  "Enviar push" ya NO lo usa (es por tarea, no por día — ver
 *  bindPushWrap), pero "Exportar a PDF" sigue siendo por día. */
let diaActivo = null;

/** Claves "tareaId|dia" con cambios de sub-ítems tocados EN LOCAL pero
 *  todavía no guardados con el botón "Guardar" (ver bindTarjetaDesplegable,
 *  guardarAhora) — mientras haya al menos una, actualizarChecksEnDOM
 *  (el repaso de fondo cada 20s) se salta entero, para no pisar un
 *  progreso a medio marcar con lo último que SÍ llegó a guardarse. */
const tareasSinGuardarGestion = new Set();

/** Los números de día (como STRING, para comparar contra t.dias tal
 *  cual vienen de la Sheet) del mes ACTUAL — pedido explícito: sin
 *  navegación entre meses, es un recordatorio del "ahora", no un
 *  planificador a futuro. Sale de la fecha real, así ya sabe si el
 *  mes tiene 28, 30 o 31 días sin ningún caso especial. */
function diasDelMesActual() {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    return Array.from({ length: ultimoDia }, (_, i) => String(i + 1));
}

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

/** idTarea → {diasPrevios, timer} — una ráfaga de toques de días
 *  (bindDiasControl) guarda UNA sola vez, con el estado final, no un
 *  pedido async por toque. Ver comentario en bindDiasControl. */
const timersDias = new Map();

/** Fase 2 (2026-08-25): Admin/Supervisor/Capacitador entran en modo
 *  lectura con un selector de local — ven exactamente cómo ese local
 *  armó su semana, sin poder tocar nada (ni pills, ni checks, ni
 *  push). Responsable de local/turno (rol "colaborador") nunca ve el
 *  selector — va directo a SU sucursal, editable como siempre. Estado
 *  de módulo (no por-request) porque el selector cambia de sucursal
 *  sin recargar toda la página — Gestion()/bindGestion() lo leen. */
let esVistaLectura = false;
/** Asignar días/frecuencia (qué tareas aplican y cuándo) es exclusivo
 *  de Responsable de LOCAL — pedido explícito: "los días de la semana
 *  o del mes debería solo poder asignar el responsable de local" /
 *  "el responsable de turno solo cargar los datos que le
 *  correspondan". Responsable de turno (colaborador, sin ser también
 *  encargado) sigue viendo "Asignar tareas" pero sin poder tocarla —
 *  mismas pills de solo lectura que ya usa Admin/Supervisor — y solo
 *  puede cargar datos en "Tareas asignadas". */
let soloLecturaAsignacion = false;
let sucursalActiva = "";

/** "tareaId|dia" → {marcadoPor, hora, hecho, marcas: Map<indice, marca>}
 *  — checks REALES de la sucursal activa (persistidos, ya no
 *  visuales) — hecho=true es "tarea completa"; marcas son las
 *  respuestas de cada sub-ítem AUNQUE la tarea no esté completa
 *  (progreso a medio camino, también persistido), una por índice —
 *  ver services/subitems.js para la forma de cada `marca` según su
 *  tipo (checkbox/estado3/numerico) y data/gestionChecks.js para
 *  cómo se guarda. Se puebla en cargarDatos() y se usa al renderizar
 *  tareaHtml() y al guardar un toggle. */
let checksActivos = {};

/** Lista completa de Sucursales (nombre/país/esPropio) — se necesita
 *  para filtrar el catálogo por aplicaA/noAplicaA (services/alcance.js
 *  → aplicaASucursal), que trabaja contra el OBJETO sucursal, no solo
 *  el nombre que guarda sucursalActiva. Se trae una sola vez por
 *  visita a la página (Gestion()), no en cada cambio de local — la
 *  propia capa de datos (dataSource.js) ya cachea la lectura. */
let sucursales = [];

/** El objeto Sucursal completo de sucursalActiva, o null si no hay
 *  ninguna elegida todavía (o no se encontró — no debería pasar). */
function sucursalActivaObj() {
    if (!sucursalActiva) return null;
    return sucursales.find((s) => normalizar(s.nombre) === normalizar(sucursalActiva)) || null;
}

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
 *  siempre visibles, sin abrir ningún modal.
 *
 *  Tareas "mensuales" (t.frecuencia) usan el MISMO mecanismo (mismas
 *  clases, mismo data-toggle-dia, mismo bindDiasControl) pero con
 *  números de día del mes (1..último día del mes actual) en vez de
 *  nombres de día — es la única diferencia real entre las dos, así
 *  que bindDiasControl no necesita saber que existen dos tipos. */
/** Semanal/Mensual, POR TAREA — pedido explícito: la decide cada
 *  local al asignar (bindFrecuenciaTarea), no Admin al cargar la
 *  tarea. Solo lectura (Admin/Supervisor mirando otro local) muestra
 *  la elegida como texto, sin botones. */
function frecuenciaTareaHtml(t) {
    const esMensual = t.frecuencia === "mensual";
    if (soloLecturaAsignacion) {
        return `
            <div class="tarea-gestion-dia-control">
                <span class="tarea-gestion-dia-label">Frecuencia</span>
                <span class="pill-dia-tarea activa">${esMensual ? "Mensual" : "Semanal"}</span>
            </div>
        `;
    }
    return `
        <div class="tarea-gestion-dia-control">
            <span class="tarea-gestion-dia-label">Frecuencia</span>
            <div class="toggle-frecuencia-gestion">
                <button type="button" class="toggle-frecuencia-btn${esMensual ? "" : " activa"}" data-elegir-frecuencia="semanal">Semanal</button>
                <button type="button" class="toggle-frecuencia-btn${esMensual ? " activa" : ""}" data-elegir-frecuencia="mensual">Mensual</button>
            </div>
        </div>
    `;
}

/** "D/M" (sin ceros a la izquierda, ej. "1/8") de un día de la semana
 *  DENTRO de la semana actual — pedido explícito: "me gustaría que
 *  diga Lunes 1/8, Martes 2/8, etc", y después "quiero cambiar la
 *  semana que sea de lunes a domingo".
 *
 *  Ojo acá: hay DOS sistemas de indexado de día distintos en el
 *  archivo. DIAS/Date.getDay() arrancan domingo=0 (así vino siempre,
 *  no se tocó — lo usan fechaDelDiaSemana original, Code.gs, las
 *  claves de GestionChecks). DIAS_VISUAL arranca lunes=0 (solo para
 *  ORDENAR cómo se muestran las pills). Mezclar los dos sin convertir
 *  daba una fecha mal calculada para "Domingo": con el índice viejo
 *  (domingo=0) el cálculo apuntaba al domingo YA PASADO en vez del
 *  que cierra la semana lunes-a-domingo actual (bug real, reportado
 *  con captura: la pill decía "Domingo 23/8" en una semana que
 *  arrancaba el lunes 24/8, cuando debía decir "30/8"). Por eso acá
 *  todo se calcula en el sistema VISUAL (lunes=0) de punta a punta.
 */
function fechaDelDiaSemana(nombreDia) {
    const hoy = new Date();
    const idxVisualHoy = (hoy.getDay() + 6) % 7; // Date.getDay(): domingo=0 → acá lunes=0
    const idxVisualObjetivo = DIAS_VISUAL.indexOf(nombreDia);
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + (idxVisualObjetivo - idxVisualHoy));
    return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

/** Pedido explícito: "que el selector de días me permita poner más de
 *  un día — los depósitos se hacen lunes y viernes". Pills, no un
 *  <select multiple> (mal en celular) — cada una prende/apaga un día,
 *  siempre visibles, sin abrir ningún modal.
 *
 *  Tareas "mensuales" (t.frecuencia, decidida por CADA LOCAL — ver
 *  frecuenciaTareaHtml) usan el MISMO mecanismo (mismas clases, mismo
 *  data-toggle-dia, mismo bindDiasControl) pero con números de día del
 *  mes (1..último día del mes actual) en vez de nombres de día — es la
 *  única diferencia real entre las dos, así que bindDiasControl no
 *  necesita saber que existen dos tipos.
 *
 *  SIN fecha al lado acá a propósito — pedido explícito: "en la
 *  selección de días de la semana la fecha es medio irrelevante
 *  porque se entiende que son los días de la semana y se va a
 *  programar cada semana". Esto es un patrón RECURRENTE (todos los
 *  lunes, no ESTE lunes puntual) — la fecha sí importa en "Tareas
 *  asignadas" (pillsDiaHtml, cuerpoGestionHtml), que es donde se
 *  ejecuta/exporta un día real y puntual. */
function diasControlHtml(t) {
    const esMensual = t.frecuencia === "mensual";
    const opciones = esMensual ? diasDelMesActual() : DIAS_VISUAL;
    // Solo lectura: pills como <span>, sin data-toggle-dia — no hay
    // nada que enganchar, ni forma de tocarlas por accidente.
    return `
        ${frecuenciaTareaHtml(t)}
        <div class="tarea-gestion-dia-control">
            <span class="tarea-gestion-dia-label">${esMensual ? "Día del mes" : "Días"}</span>
            <div class="dias-pills-tarea${esMensual ? " dias-pills-tarea-mes" : ""}">
                ${opciones.map((d) => {
                    const activa = t.dias.includes(d);
                    const etiqueta = esMensual ? d : d.slice(0, 2);
                    return soloLecturaAsignacion
                        ? `<span class="pill-dia-tarea${activa ? " activa" : ""}" title="${d}">${etiqueta}</span>`
                        : `<button type="button" class="pill-dia-tarea${activa ? " activa" : ""}" data-toggle-dia="${d}" title="${d}">${etiqueta}</button>`;
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
                ${t.subitems.map((s) => {
                    const { titulo, tipo } = parsearSubitem(s);
                    // El texto guardado va codificado con "::" para
                    // 3 estados/numérico (ver services/subitems.js) —
                    // acá solo se ve el título limpio + una etiqueta
                    // chica, nunca el string crudo.
                    const etiqueta = tipo === TIPOS_SUBITEM.ESTADO2 ? " (2 estados)" : tipo === TIPOS_SUBITEM.ESTADO3 ? " (3 estados)" : tipo === TIPOS_SUBITEM.NUMERICO ? " ($)" : "";
                    return `<li>${escaparHtml(titulo)}${etiqueta}</li>`;
                }).join("")}
            </ul>
        </div>
    `;
}

/** Resumen de los días elegidos, en TEXTO ("Lunes, Viernes" o "18 de
 *  agosto") — pedido explícito: "me gustaría que allí se vea los días
 *  o fecha seleccionado así no tengo que hacer un paso extra de
 *  desplegar". Mensual suma el mes actual al lado del número, pedido
 *  aparte: "que en el mes figure el mes corriente". */
function resumenDiasTexto(t) {
    if (!t.dias.length) return "";
    if (t.frecuencia === "mensual") {
        const mes = new Date().toLocaleDateString("es-AR", { month: "long" });
        return t.dias.map((d) => `${d} de ${mes}`).join(", ");
    }
    return t.dias.join(", ");
}

/** Badge de alcance ("Propios", "Uruguay", "Menos Franquicias"...) —
 *  pedido explícito: distinguir tareas genéricas (todos los locales,
 *  sin badge — es el caso más común, no hace falta remarcarlo) de las
 *  acotadas a país/tipo de local. Sin esto, en el catálogo completo
 *  (Admin sin ningún local elegido) no hay forma de saber de un
 *  vistazo por qué cierta tarea no le va a aparecer a cierto local.
 *  Ver services/alcance.js → aplicaASucursal. */
function alcanceBadgeHtml(t) {
    if (t.noAplicaA) return `<span class="badge-alcance-tarea" title="Aplica a todos menos: ${escaparHtml(t.noAplicaA)}">Menos ${escaparHtml(t.noAplicaA)}</span>`;
    if (t.aplicaA) return `<span class="badge-alcance-tarea" title="Solo aplica a: ${escaparHtml(t.aplicaA)}">${escaparHtml(t.aplicaA)}</span>`;
    return "";
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
    // Badges SIEMPRE en su propia fila, debajo del título — pedido
    // explícito (captura real): con un título largo que se envuelve a
    // 2 líneas, badges centrados verticalmente en la misma fila que el
    // título quedaban flotando en el medio, tapando la segunda línea.
    // En su propia fila no hay ambigüedad posible, sea cual sea el
    // largo del título.
    const badgesHtml = [
        alcanceBadgeHtml(t),
        sinLocalElegido ? "" : `<span class="badge-en-uso${enUso ? " activa" : ""}">${enUso ? "En uso" : "Sin usar"}</span>`,
    ].join("");
    return `
        <div class="tarea-gestion tarea-gestion-desplegable fila-aplica-tarea${enUso ? " en-uso" : ""}" data-desplegable data-tarea-id="${t.id}">
            <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                    ${enUso ? `<span class="tarea-gestion-resumen-dias">${resumenDiasTexto(t)}</span>` : ""}
                </span>
                <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
                ${badgesHtml ? `<span class="tarea-gestion-badges">${badgesHtml}</span>` : ""}
            </button>
            <div class="tarea-gestion-subitems">
                ${subitemsSoloLecturaHtml(t)}
                ${sinLocalElegido ? `<p class="aviso-tareas-aplicables" style="margin:0">Elegí un local arriba para ver y tocar sus días.</p>` : diasControlHtml(t)}
                ${accionesTareaHtml()}
            </div>
        </div>
    `;
}

/** UNA fila de sub-ítem, según su tipo (ver services/subitems.js) —
 *  pedido explícito, con maqueta confirmada: "arqueo de caja" no
 *  entra en un checklist binario, necesita poder marcar una
 *  incidencia SIN escribir texto.
 *  - checkbox (default): el de siempre, sin cambios.
 *  - estado3: tres círculos (✓ verde / ! amarillo / ✕ rojo) + chips
 *    de motivo (solo visibles si el estado no es "ok") — el motivo
 *    se ELIGE, nunca se escribe.
 *  - numerico: campo "$" con teclado numérico — 0 = cuadra, cualquier
 *    otro valor YA ES la incidencia, no hace falta explicarla aparte.
 *  `marca` es lo que ya está guardado para este índice (parsearMarcaSubitem),
 *  o undefined si nunca se tocó. */
function subitemFilaHtml(id, is, subitemsRaw, marcados) {
    const raw = subitemsRaw[is];
    const marca = marcados.get(String(is));
    const { titulo, tipo, motivos } = parsearSubitem(raw);

    if (tipo === TIPOS_SUBITEM.NUMERICO) {
        // Arranca en 0, NO vacío — pedido explícito: "los valores que
        // están en cero deben quedar así por default si está bien, si
        // tiene incidencia cargarla". La mayoría de los días cuadra;
        // pedirle a alguien que escriba "0" a propósito para confirmar
        // "está todo bien" es fricción de más — el 0 YA ES la
        // respuesta por defecto, listo para exportar/enviar sin tocar
        // nada; recién hace falta escribir algo si hay una diferencia
        // real.
        //
        // Magnitud + toggle Falta/Sobra, NO un solo campo con signo —
        // bug real reportado en vivo: en celular el teclado que abre
        // <input inputmode="numeric"> no tiene tecla "-", así que
        // escribir un negativo era directamente IMPOSIBLE ahí. Separar
        // "cuánto" (siempre positivo, se escribe) de "falta o sobra"
        // (se elige, un toque) evita depender de esa tecla que ningún
        // teclado numérico móvil ofrece de forma confiable. De paso
        // dejó el campo más corto (nunca hace falta un "-158.987"
        // desbordando la pill).
        const tieneMarca = marca?.tipo === TIPOS_SUBITEM.NUMERICO;
        const valorGuardado = tieneMarca ? marca.valor : 0;
        const magnitud = Math.abs(valorGuardado);
        const signo = valorGuardado < 0 ? "-" : "+";
        const incidencia = valorGuardado !== 0;

        // SIN chips de motivo acá — pedido explícito: "para qué quiero
        // en dos lugares la misma información" — Falta/Sobra + el
        // monto YA dicen todo lo que un chip "Faltante"/"Sobrante"
        // repetiría. El motivo de la incidencia (si aplica) queda
        // representado únicamente por el círculo ok/incidencia/grave
        // del estado3, sin selector de causa aparte.

        // En $0 el signo no significa nada — ninguno de los dos botones
        // arranca marcado (mismo criterio que al resetear desde "OK").
        return `
            <div class="subitem-numerico ${incidencia ? "incidencia" : "ok"}" data-subitem-tipo="numerico" data-subitem-indice="${is}" data-signo="${signo}">
                <span>${escaparHtml(titulo)}</span>
                <div class="subitem-numerico-control">
                    <div class="signo-toggle">
                        <button type="button" class="signo-btn falta${incidencia && signo === "-" ? " activo" : ""}" data-signo="-"${esVistaLectura ? " disabled" : ""}>Falta</button>
                        <button type="button" class="signo-btn sobra${incidencia && signo === "+" ? " activo" : ""}" data-signo="+"${esVistaLectura ? " disabled" : ""}>Sobra</button>
                    </div>
                    <div class="subitem-numerico-campo">
                        <span>$</span>
                        <input type="text" inputmode="decimal" class="input-numerico-subitem"${esVistaLectura ? " disabled" : ""} placeholder="0" value="${formatearMontoInput(magnitud)}">
                    </div>
                </div>
            </div>
        `;
    }

    if (tipo === TIPOS_SUBITEM.ESTADO2) {
        // Hecho/No hecho — pedido explícito: "si una tarea no se hizo
        // puede marcar hecho no hecho". A diferencia del checkbox
        // (donde no tildar nunca es una respuesta, la tarea queda
        // incompleta para siempre), "No hecho" ACÁ es una respuesta
        // real y válida — cuenta como respondido igual, así se puede
        // dejar constancia de que algo no se hizo sin trabarse.
        const tieneMarca = marca?.tipo === TIPOS_SUBITEM.ESTADO2;
        const estado = tieneMarca ? marca.estado : "";
        return `
            <div class="subitem-estado2" data-subitem-tipo="estado2" data-subitem-indice="${is}" data-estado-actual="${estado}">
                <span>${escaparHtml(titulo)}</span>
                <div class="estados2">
                    <button type="button" class="estado2-btn si${estado === "si" ? " activo" : ""}" data-estado="si"${esVistaLectura ? " disabled" : ""}>Hecho</button>
                    <button type="button" class="estado2-btn no${estado === "no" ? " activo" : ""}" data-estado="no"${esVistaLectura ? " disabled" : ""}>No hecho</button>
                </div>
            </div>
        `;
    }

    if (tipo === TIPOS_SUBITEM.ESTADO3) {
        const tieneMarca = marca?.tipo === TIPOS_SUBITEM.ESTADO3;
        const estado = tieneMarca ? marca.estado : "";
        return `
            <div class="subitem-estado3" data-subitem-tipo="estado3" data-subitem-indice="${is}" data-estado-actual="${estado}">
                <div class="subitem-estado3-fila">
                    <span>${escaparHtml(titulo)}</span>
                    <div class="estados3">
                        <button type="button" class="estado-btn ok${estado === "ok" ? " activo" : ""}" data-estado="ok"${esVistaLectura ? " disabled" : ""} aria-label="OK">✓</button>
                        <button type="button" class="estado-btn incidencia${estado === "inc" ? " activo" : ""}" data-estado="inc"${esVistaLectura ? " disabled" : ""} aria-label="Incidencia">!</button>
                        <button type="button" class="estado-btn grave${estado === "grave" ? " activo" : ""}" data-estado="grave"${esVistaLectura ? " disabled" : ""} aria-label="Incidencia grave">✕</button>
                    </div>
                </div>
            </div>
        `;
    }

    // checkbox — el de siempre, sin cambios de comportamiento visual.
    // data-subitem-tipo/indice van en el <label> (la fila de primer
    // nivel que recorren actualizarProgreso/actualizarChecksEnDOM),
    // NO en el <input> — bug real encontrado en vivo: estaban en el
    // input, así que para CUALQUIER checkbox `fila.dataset.subitemIndice`
    // leía undefined (el <label> no tenía el atributo) y el guardado
    // terminaba con la clave literal "undefined" — con más de un
    // checkbox en la misma tarea, todos pisaban la MISMA entrada
    // ("se marcan, se desmarcan solos").
    return `
        <label class="subitem-gestion" for="${id}-${is}" data-subitem-tipo="checkbox" data-subitem-indice="${is}">
            <input type="checkbox" id="${id}-${is}" class="subitem-gestion-check"${esVistaLectura ? " disabled" : ""}${marca ? " checked" : ""}>
            <span>${escaparHtml(titulo)}</span>
        </label>
    `;
}

/** Badge de resumen de incidencias en el encabezado de la tarjeta —
 *  mismo criterio visual que la maqueta confirmada. Vacío (no se
 *  muestra nada) si la tarea no tiene sub-ítems de tipo estado3/
 *  numérico, o si ninguno tiene incidencia todavía. Cuenta por GRUPO
 *  (ver contarIncidenciasAgrupadas) — "Efectivo Caja 1" + "Saldo
 *  Caja 1" con la misma incidencia no duplican el conteo. Envuelto
 *  en un span con data-badge-incidencia y :empty{display:none} en
 *  CSS — así el repaso de 20s puede refrescarlo con solo un
 *  innerHTML, sin dejar un hueco de flex-gap cuando queda vacío. */
function badgeIncidenciasHtml(subitemsRaw, marcados) {
    return `<span class="tarea-gestion-badge-incidencia" data-badge-incidencia>${badgeIncidenciaContenido(subitemsRaw, marcados)}</span>`;
}
function badgeIncidenciaContenido(subitemsRaw, marcados) {
    const items = subitemsRaw.map((raw, is) => ({ titulo: parsearSubitem(raw).titulo, marca: marcados.get(String(is)) }));
    const { incidencias, graves } = contarIncidenciasAgrupadas(items);
    if (graves > 0) return `<span class="badge-incidencia grave">${graves} incidencia grave${graves > 1 ? "s" : ""}</span>`;
    if (incidencias > 0) return `<span class="badge-incidencia">${incidencias} incidencia${incidencias > 1 ? "s" : ""}</span>`;
    return "";
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
    // check ahora existe también para tareas A MEDIAS (algún sub-ítem
    // tildado, sin llegar a completa) — "hecha"/"Hecho ..." dependen
    // de check.hecho (completa), no de que la fila exista.
    const hechoTexto = check?.hecho ? `Hecho ${check.hora || ""}${check.marcadoPor ? ` · ${check.marcadoPor}` : ""}` : "";

    // Push + Exportar, JUNTOS, como sibling DESPUÉS de la tarjeta (no
    // adentro) — pedido explícito con captura real: "el push está
    // sobre la tarea... está por fuera... con una pill linda premium,
    // y exportar justamente al lado". El push volvió a ser por tarea
    // (no un solo push por día, pedido aparte: "la idea es que esté
    // el encabezado DE LA TAREA") — pero "al lado" seguía siendo un
    // pedido real ("las pusiste una sobre la otra, quiero que estén
    // una al lado de la otra"), así que Exportar se repite junto a
    // CADA push en vez de vivir solo, una vez, lejos de cualquiera de
    // ellos — exporta lo mismo (la guía del día completo) sin
    // importar desde qué tarea se lo toque. Reusa la clase
    // "tarea-gestion-push" a propósito: exportarPdf.js ya la oculta
    // del PDF (ESTILOS_IMPRESION), así estos botones de acción nunca
    // aparecen en el documento exportado sin tocar ese archivo de
    // nuevo. El wrap de push arranca vacío, bindPushWrap() lo pinta
    // al enganchar.
    const pushInteriorHtml = esVistaLectura ? "" : `<div class="push-tarea-wrap" data-push-tarea-wrap${atrId}></div>`;
    const exportarInteriorHtml = sucursalActiva ? `
        <button type="button" class="btn btn-secondary btn-exportar-tarea" data-exportar-gestion>${Icon("descargar", { size: 16 })} Exportar a PDF</button>
    ` : "";
    const pushWrapHtml = (pushInteriorHtml || exportarInteriorHtml) ? `
        <div class="tarea-gestion-push"${atrId}>${pushInteriorHtml}${exportarInteriorHtml}</div>
    ` : "";

    if (t.subitems) {
        const marcados = check?.marcas || new Map();
        return `
            <div class="tarea-gestion tarea-gestion-desplegable${check?.hecho ? " hecha" : ""}" data-desplegable${atrId}>
                <button type="button" class="tarea-gestion-header" data-toggle-desplegable>
                    <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                    <span class="tarea-gestion-txt">
                        <strong>${t.titulo}</strong>
                        <span>${t.detalle}</span>
                        <span class="tarea-gestion-hora" data-hora>${hechoTexto}</span>
                    </span>
                    <span class="tarea-gestion-progreso" data-progreso>${marcados.size}/${t.subitems.length}</span>
                    ${badgeIncidenciasHtml(t.subitems, marcados)}
                    <span class="tarea-gestion-chevron">${Icon("flecha-der", { size: 16 })}</span>
                </button>
                <div class="tarea-gestion-subitems" data-subitems>
                    ${t.subitems.map((s, is) => subitemFilaHtml(id, is, t.subitems, marcados)).join("")}
                </div>
                ${esVistaLectura ? "" : `
                    <div class="tarea-gestion-guardar">
                        <button type="button" class="btn-guardar-subitems" data-guardar-subitems>${Icon("check", { size: 15 })} Guardar</button>
                    </div>
                `}
                ${accionesTareaHtml()}
            </div>
            ${pushWrapHtml}
        `;
    }

    return `
        <div class="tarea-gestion tarea-gestion-simple${check?.hecho ? " hecha" : ""}"${atrId}>
            <label class="tarea-gestion-label" for="${id}">
                <input type="checkbox" id="${id}" class="tarea-gestion-check"${esVistaLectura ? " disabled" : ""}${check?.hecho ? " checked" : ""}>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                    <span class="tarea-gestion-hora" data-hora>${hechoTexto}</span>
                </span>
            </label>
            ${accionesTareaHtml()}
        </div>
        ${pushWrapHtml}
    `;
}

/* ── "+ Nueva tarea" / "Editar tarea" (admin) ────────────────────
   Pedido explícito: mismo patrón que ya existe en Lecciones — un
   encabezado (ej. "Inventario") y abajo sub-tareas sueltas ("No te
   olvides de imprimir la planilla", "No te olvides de la lapicera").
   Los días se eligen con checkboxes reales (contenido-sin-errores:
   una fila por ítem, no un <select multiple>). */
/** `raw` viene YA CODIFICADO (services/subitems.js) cuando se está
 *  editando una tarea existente — se parsea acá para precargar el
 *  tipo/motivos, ni Admin ni este archivo tienen que saber del
 *  formato interno en ningún otro lado. Pedido explícito, con
 *  maqueta confirmada: un arqueo de caja necesita sub-ítems de 3
 *  estados (con motivos para elegir, sin escribir) y numéricos
 *  ($, saldo/diferencia) además del checkbox simple de siempre. */
function subtareaNuevaFilaHtml(raw = "") {
    const { titulo, tipo, motivos } = parsearSubitem(raw);
    return `
        <div class="subtarea-nueva-fila">
            <div class="subtarea-nueva-fila-principal">
                <textarea class="input-subtarea-nueva-texto" rows="1" placeholder="Ej: No te olvides de imprimir la planilla">${escaparHtml(titulo)}</textarea>
                <select class="input-subtarea-nueva-tipo">
                    <option value="${TIPOS_SUBITEM.CHECKBOX}"${tipo === TIPOS_SUBITEM.CHECKBOX ? " selected" : ""}>Simple</option>
                    <option value="${TIPOS_SUBITEM.ESTADO2}"${tipo === TIPOS_SUBITEM.ESTADO2 ? " selected" : ""}>2 estados (Hecho/No hecho)</option>
                    <option value="${TIPOS_SUBITEM.ESTADO3}"${tipo === TIPOS_SUBITEM.ESTADO3 ? " selected" : ""}>3 estados</option>
                    <option value="${TIPOS_SUBITEM.NUMERICO}"${tipo === TIPOS_SUBITEM.NUMERICO ? " selected" : ""}>Número ($)</option>
                </select>
                <button type="button" class="btn-quitar-subtarea-nueva" aria-label="Quitar esta sub-tarea">×</button>
            </div>
            <input type="text" class="input-subtarea-nueva-motivos"${tipo === TIPOS_SUBITEM.ESTADO3 ? "" : ' style="display:none"'} placeholder="Motivos de incidencia, separados por coma (ej: Faltante, Sobrante)" value="${escaparHtml(motivos.join(", "))}">
        </div>
    `;
}

/** Mismo form para crear Y editar — si viene `tarea` precarga sus
 *  valores reales (sacados de registroTareas, no adivinados del DOM). */
/** Nueva/Editar tarea — catálogo puro (Admin). Los días quedaron
 *  afuera de este modal desde Fase 2: no son parte de la definición
 *  de la tarea, son elección de cada local — se eligen con las pills
 *  de la pestaña "Tareas", no acá. Mismo criterio para la frecuencia
 *  (Semanal/Mensual, 2026-08-26): tampoco vive acá — pedido explícito
 *  del usuario, Admin: "yo cargo la tarea, ellos deciden si es mensual
 *  o semanal, no tengo que estar modificando nada" — se elige por
 *  local, junto a los días, ver frecuenciaTareaHtml. */
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
        <label>¿A quién le aplica? (vacío = a todos)
            ${MultiSelectAlcance("input-tarea-alcance", tarea?.aplicaA || "")}
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

    // El campo de motivos solo tiene sentido para "3 estados" — se
    // muestra/oculta al cambiar el tipo, no hace falta un modal aparte.
    listaSubtareas.addEventListener("change", (e) => {
        if (!e.target.classList.contains("input-subtarea-nueva-tipo")) return;
        const fila = e.target.closest(".subtarea-nueva-fila");
        const campoMotivos = fila.querySelector(".input-subtarea-nueva-motivos");
        campoMotivos.style.display = e.target.value === TIPOS_SUBITEM.ESTADO3 ? "" : "none";
    });

    bindMultiSelectAlcance("input-tarea-alcance");
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
    // También borra la fila de Push+Exportar (.tarea-gestion-push,
    // sibling suelto, no hijo de la tarjeta — sin esto quedaba
    // huérfana en el DOM cada vez que una tarea cambiaba de día).
    document.querySelectorAll(`.tarea-gestion[data-tarea-id="${idTarea}"]:not(.fila-aplica-tarea), .tarea-gestion-push[data-tarea-id="${idTarea}"]`).forEach((n) => n.remove());
    // dias vacío = "sin usar" — el .forEach de abajo simplemente no
    // agrega ninguna copia, no hace falta un guard aparte.
    tarea.dias.forEach((d) => {
        const lista = document.querySelector(`[data-panel-dia="${d}"] .lista-tareas-gestion`);
        if (!lista) return;
        // tareaHtml() devuelve DOS elementos hermanos (tarjeta + fila
        // de Push+Exportar) — buscarlos por atributo en vez de asumir
        // lastElementChild, que cambia según haya wrap o no
        // (esVistaLectura/sucursalActiva pueden vaciarlo).
        lista.insertAdjacentHTML("beforeend", tareaHtml(tarea, `${idTarea}-${d}`, d));
        const cardNueva = lista.querySelector(`.tarea-gestion[data-tarea-id="${idTarea}"][data-dia="${d}"]`);
        // El botón de Exportar de acá no necesita bind propio (usa
        // delegación, ver bindCuerpoGestion) — solo el wrap de push.
        const wrapNuevo = lista.querySelector(`[data-push-tarea-wrap][data-tarea-id="${idTarea}"][data-dia="${d}"]`);
        if (cardNueva) bindTarjetaNueva(cardNueva);
        if (wrapNuevo) bindPushWrap(wrapNuevo);
    });
    // Cualquier día pudo haber quedado sin nada (se le sacó la última
    // tarea) o dejar de estar vacío (se le sumó la primera) — revisar
    // TODOS los paneles posibles (7 días de semana + hasta 31 del mes),
    // no solo los de esta tarea, es la forma simple de no dejar ni un
    // aviso viejo colgado ni uno faltante. actualizarAvisoDiaVacio ya
    // no hace nada si el panel no existe en el DOM (vista semanal
    // activa cuando la tarea es mensual, o viceversa), así que barrer
    // los dos juegos siempre es seguro.
    [...DIAS, ...diasDelMesActual()].forEach((d) => {
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
    // Cada fila arma su propio string codificado (services/subitems.js)
    // según el tipo elegido — "Simple" queda IDÉNTICO al texto plano
    // de siempre, no cambia nada para las tareas que ya existen.
    const subitems = Array.from(document.querySelectorAll(".subtarea-nueva-fila"))
        .map((fila) => {
            const tituloSub = fila.querySelector(".input-subtarea-nueva-texto").value.trim();
            if (!tituloSub) return null;
            const tipo = fila.querySelector(".input-subtarea-nueva-tipo").value;
            const motivos = tipo === TIPOS_SUBITEM.ESTADO3
                ? fila.querySelector(".input-subtarea-nueva-motivos").value.split(",").map((m) => m.trim()).filter(Boolean)
                : [];
            return serializarSubitem({ titulo: tituloSub, tipo, motivos });
        })
        .filter(Boolean);
    const aplicaA = document.getElementById("input-tarea-alcance")?.value.trim() || "";
    // noAplicaA no tiene campo propio en este modal (YAGNI — nadie lo
    // pidió todavía, aplicaA solo ya cubre "Propios"/"Franquicias"/país/
    // local) — se preserva lo que ya tuviera en vez de pisarlo con "",
    // por si se cargó a mano en la Sheet.
    const noAplicaA = registroTareas.get(idEditado)?.noAplicaA || "";
    const datos = { icono, titulo, detalle, aplicaA, noAplicaA, ...(subitems.length ? { subitems } : {}) };

    if (idEditado) {
        const r = await actualizarTareaBackend(idEditado, datos);
        if (!r?.ok) {
            alert("No se pudo guardar — probá de nuevo.");
            return false;
        }
        // dias/frecuencia son de cada local, no del catálogo — se
        // preservan tal cual estaban en memoria (los de MI sucursal,
        // mezclados al entrar a la página), editar el título no los
        // toca. Ver frecuenciaTareaHtml/bindFrecuenciaTarea para cómo
        // se cambian de verdad.
        const previa = registroTareas.get(idEditado);
        registroTareas.set(idEditado, { id: idEditado, ...datos, dias: previa?.dias || [], frecuencia: previa?.frecuencia || "semanal" });
        TAREAS = TAREAS.map((t) => (t.id === idEditado ? registroTareas.get(idEditado) : t));
        recrearTareaEnPaneles(idEditado);
    } else {
        const nueva = await crearTareaBackend(datos);
        if (!nueva) {
            alert("No se pudo crear la tarea — probá de nuevo.");
            return false;
        }
        nueva.dias = []; // nace "sin usar" en todos los locales.
        nueva.frecuencia = "semanal"; // default hasta que algún local la asigne y elija.
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
    const botonNueva = esAdminActual() ? `
        <button type="button" class="btn btn-primary" id="btn-nueva-tarea">
            + Nueva tarea
        </button>
    ` : "";
    const acciones = botonNueva ? `<div class="acciones-gestion-semanal">${botonNueva}</div>` : "";
    const hayLocal = !esVistaLectura || !!sucursalActiva;

    // Filtro país/propio-franquicia (services/alcance.js →
    // aplicaASucursal) — pedido explícito: "puede haber tareas
    // genéricas de todos los locales, sin embargo puede haber algunas
    // específicas en propios". SIN local elegido (Admin gestionando
    // el catálogo entero) se ven TODAS — gestiona todo, no solo lo que
    // le toca a un local puntual; alcanceBadgeHtml() ahí le muestra a
    // cuál le aplica cada una. CON local elegido, solo las que
    // corresponden a ESE local — mismo criterio que ya usan
    // Cursos/Lecciones.
    const sucObjActiva = sucursalActivaObj();
    const tareasParaLocal = hayLocal ? TAREAS.filter((t) => aplicaASucursal(t, sucObjActiva)) : TAREAS;

    // Semanal/Mensual (t.frecuencia, decidida por CADA LOCAL — ver
    // frecuenciaTareaHtml) — necesarios acá arriba porque tanto el
    // catálogo "Tareas" (agrupado abajo) como los paneles por día (más
    // abajo) los usan por separado.
    const tareasSemanales = tareasParaLocal.filter((t) => t.frecuencia !== "mensual");
    const tareasMensuales = tareasParaLocal.filter((t) => t.frecuencia === "mensual");

    // "Tareas" (catálogo) se ve SIEMPRE, con local elegido o sin él —
    // Admin no necesita elegir un local para crear/editar/eliminar
    // tareas del catálogo, eso es global. aplicaTareaHtml() ya sabe
    // ocultar días/push cuando no hay local (sinLocalElegido).
    //
    // Con local elegido, agrupada en secciones — pedido explícito:
    // "que cada uno se agrupe a su sector, no todo en lo mismo". Las
    // mensuales van SIEMPRE en su propia sección (nunca mezcladas con
    // las semanales): una tarea mensual sin ningún día elegido no
    // puede existir en la práctica (sacar el último día borra la fila
    // en el backend, y sin fila la frecuencia vuelve a "semanal" por
    // default — ver getDiasPorSucursal), así que "Mensuales" es
    // siempre, de hecho, "las mensuales en uso". Sin local elegido no
    // hay frecuencia real que agrupar (t.frecuencia no significa nada
    // sin saber de qué local), sigue plana como siempre.
    //
    // Agrupada en secciones — pedido explícito: "que cada uno se
    // agrupe a su sector, no todo en lo mismo". Mensuales SIEMPRE en
    // su propia sección: una tarea mensual sin ningún día elegido no
    // existe en la práctica (sacar el último día borra la fila en el
    // backend, y sin fila la frecuencia vuelve a "semanal" por default
    // — ver getDiasPorSucursal), así que "Mensuales" es, de hecho,
    // "las mensuales en uso". Sin local elegido no hay frecuencia real
    // que agrupar (t.frecuencia no significa nada sin saber de qué
    // local), sigue plana. Se ve completa para TODOS (Admin/Supervisor/
    // Responsable) — el filtro por vista que había acá (toggle Semanal/
    // Mensual) se sacó junto con ese toggle, ver la nota más abajo.
    const listaTareasHtml = hayLocal
        ? (() => {
            const activas = tareasSemanales.filter((t) => t.dias.length > 0);
            const noActivas = tareasSemanales.filter((t) => t.dias.length === 0);
            return `
                ${tareasMensuales.length ? `
                    <p class="titulo-grupo-tareas">Mensuales (${tareasMensuales.length})</p>
                    <div class="lista-tareas-gestion">${tareasMensuales.map(aplicaTareaHtml).join("")}</div>
                ` : ""}
                ${activas.length ? `
                    <p class="titulo-grupo-tareas">Semanales en uso (${activas.length})</p>
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
        <p class="aviso-tareas-aplicables">${!hayLocal ? "Elegí un local arriba para ver y tocar sus días." : esVistaLectura ? "Así quedaron elegidos los días de cada tarea en este local." : TAREAS.length ? "Tocá una tarea para elegir en qué días la necesitás." : "Todavía no hay ninguna tarea cargada — empezá con \"+ Nueva tarea\"."}</p>
        <div id="lista-aplica-tareas">
            ${listaTareasHtml}
        </div>
    `;

    // Sin local elegido (Admin/Supervisor): se ve el catálogo pero no
    // hay UN esquema de días sin saber de qué local (cada local tiene
    // el suyo) — no existe la sección "Tareas asignadas" todavía.
    // Sin local elegido (Admin/Supervisor mirando el catálogo entero)
    // no existe "Tareas asignadas" — no hay ningún local cuyo día
    // mostrar. Antes había un tab "Asignar tareas" solo, sin nada para
    // alternar — pedido explícito, con captura real: "acá no necesito
    // ese Asignar tareas, sino que debería ser 'Nueva tarea' solamente
    // si es para mí" (el botón de arriba ya cubre lo que Admin hace
    // acá). Va directo al catálogo, sin tabs.
    if (!hayLocal) {
        return `
            ${acciones}
            ${catalogoHtml}
        `;
    }

    // DOS SECCIONES — pedido explícito, con croquis a mano: "quiero dos
    // secciones: Asignar Tareas (elegís las que necesitás, elegís
    // semanal o mensual, listo) y Tareas Asignadas (días de la semana +
    // pills con fecha del mes, entrás donde corresponde, marcás y
    // enviás)". Reemplaza el toggle Semanal/Mensual + calendario visual
    // que existió unas horas antes el mismo día — un local puede tener
    // tareas semanales Y mensuales al mismo tiempo, no tenía sentido
    // elegir entre una u otra para EJECUTAR (solo para asignar, que
    // sigue siendo por tarea, en "Asignar tareas"). "Así queda dividida
    // la sección y no está tan cargada de información que confunde"
    // (palabras del usuario). Válido para Admin/Supervisor/Responsable
    // por igual: ya no hay ninguna diferencia de UI entre vista lectura
    // y edición acá, solo si las pills son <button> o <span> (ver
    // diasControlHtml) y si hay o no botón "+ Nueva tarea"/"Enviar push".
    const panelHtml = (d, titulo, tareasDelDia) => `
        <div class="section" data-panel-dia="${d}" style="display:none">
            <h3>${titulo}</h3>
            <div class="lista-tareas-gestion">
                ${tareasDelDia.length ? tareasDelDia.map((t) => tareaHtml(t, `${t.id}-${d}`, d)).join("") : avisoDiaVacioHtml()}
            </div>
        </div>
    `;

    // DIAS_VISUAL (lunes primero) acá — "Tareas asignadas" es donde SÍ
    // importa la fecha real (se ejecuta/exporta un día puntual, ver la
    // nota en diasControlHtml), pedido explícito: "quiero cambiar la
    // semana que sea de lunes a domingo".
    const mesActual = new Date().getMonth() + 1;
    const panelesSemanalesHtml = DIAS_VISUAL.map((d) => panelHtml(d, `${d} ${fechaDelDiaSemana(d)}`, tareasSemanales.filter((t) => t.dias.includes(d)))).join("");

    // Solo los días del mes que YA tienen algo asignado — nadie
    // necesita navegar 31 pills, la mayoría vacías, para encontrar la
    // única tarea mensual real.
    const diasMesConContenido = [...new Set(tareasMensuales.flatMap((t) => t.dias))].sort((a, b) => Number(a) - Number(b));
    const panelesMensualesHtml = diasMesConContenido.map((d) => panelHtml(d, `${d}/${mesActual}`, tareasMensuales.filter((t) => t.dias.includes(d)))).join("");

    const pillsDiaHtml = DIAS_VISUAL.map((d) => `<button class="tab-gestion" data-vista-dia="${d}">${d} ${fechaDelDiaSemana(d)}</button>`).join("")
        + diasMesConContenido.map((d) => `<button class="tab-gestion" data-vista-dia="${d}">${d}/${mesActual}</button>`).join("");

    // "Exportar a PDF" YA NO vive acá suelto — se mudó adentro de
    // cada fila de tarea (junto al push de esa tarea, ver tareaHtml)
    // porque un solo botón lejos de todas las tareas no podía estar
    // "al lado" de ninguna — pedido explícito: "las pusiste una sobre
    // la otra, quiero que estén una al lado de la otra". Se repite
    // por tarea (exporta lo mismo, la guía del día completo, sin
    // importar desde cuál se lo toque) y ya no necesita mostrar/
    // ocultar aparte: nace y muere con el panel del día, que ya se
    // muestra/oculta solo.

    return `
        ${acciones}

        <div class="tabs-gestion" id="tabs-seccion-gestion">
            <button class="tab-gestion${vistaSeccion === "asignar" ? " activa" : ""}" data-vista-seccion="asignar">Asignar tareas</button>
            <button class="tab-gestion${vistaSeccion === "ejecutar" ? " activa" : ""}" data-vista-seccion="ejecutar">Tareas asignadas</button>
        </div>

        <!-- "Asignar tareas": catálogo — tocás una, se despliegan
             frecuencia + días, elegís. Con al menos un día queda
             verde ("En uso"); sin ninguno, gris ("Sin usar"). -->
        <div class="section" id="seccion-asignar-tareas"${vistaSeccion === "asignar" ? "" : ' style="display:none"'}>
            ${catalogoHtml}
        </div>

        <!-- "Tareas asignadas": pills de día/fecha — tocás una, ves
             las tareas de ESE día, las marcás hechas, mandás push por
             tarea, junto al push de esa misma tarea (ver tareaHtml)
             — "Asignar tareas" no tiene nada de esto. -->
        <div id="seccion-tareas-asignadas"${vistaSeccion === "ejecutar" ? "" : ' style="display:none"'}>
            <div class="tabs-gestion" id="tabs-dias-gestion">
                ${pillsDiaHtml}
            </div>
            <div id="contenido-gestion-imprimible">
                ${membreteHtml("Guía de Gestión", sucursalActiva)}
                ${panelesSemanalesHtml}${panelesMensualesHtml}
            </div>
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
    // t.dias/t.frecuencia como siempre, sin saber que vienen de otra
    // hoja. Sin fila para esta tarea en este local, "semanal" (mismo
    // default que devuelve getDiasPorSucursal para el caso "nunca la
    // tocó" — no debería pasar acá porque solo entran tareas CON fila,
    // pero un default explícito nunca está de más).
    TAREAS.forEach((t) => {
        const info = dias[t.id];
        t.dias = info?.dias || [];
        t.frecuencia = info?.frecuencia || "semanal";
    });
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
    // Responsable de turno (colaborador, sin encargado) ve el catálogo
    // pero no lo toca — solo Responsable de local asigna días/frecuencia.
    soloLecturaAsignacion = esVistaLectura || !usuario?.encargado;
    // Y por eso mismo arranca directo en "Tareas asignadas" — mostrarle
    // primero una pantalla que no puede tocar no tiene sentido.
    if (usuario?.rol === "colaborador" && !usuario?.encargado && usuario?.responsableTurno) vistaSeccion = "ejecutar";
    sucursalActiva = esVistaLectura ? "" : (usuario?.sucursal || "");

    [sucursales] = await Promise.all([getSucursales(), cargarDatos(sucursalActiva)]);

    // Antes era un banner grande (.aviso-maqueta, título + 3 párrafos)
    // — pedido explícito con captura real: "el banner azul en celular
    // queda gigante y no permite ver entre el espacio que queda,
    // quizás un tooltip sería mejor con ese color que me gusta".
    // Mismo mecanismo que .mod-tooltip (kpiCard.js, "ⓘ" que explica
    // una tarjeta), variante ".info-ayuda" con el mismo azul que
    // tenía el banner — se abre solo al tocar, no ocupa lugar fijo.
    // Texto acotado a propósito, sin saltos de línea forzados (se
    // deja envolver solo): el ícono vive justo arriba de los tabs de
    // sección, con poco margen — reportado en vivo, con captura, que
    // el texto largo de antes tapaba esos tabs por completo.
    const infoAyuda = `Asigná las tareas que correspondan a tu local. Recibirás un recordatorio automático a las 10am y también podrás avisar manualmente al completarlas. Luego, exportá el registro para un segundo control.`;

    return `
        ${Header("Gestión de tareas", `Organizá las tareas de tu local, por día o por mes <span class="mod-tooltip info-ayuda" data-tooltip-texto="${infoAyuda}">${Icon("idea", { size: 14 })}</span>`)}

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

/** Sufijo compartido "Caja N"/"Posnet N" en un título — mismo criterio
 *  en los 3 lugares que necesitan emparejar sub-ítems de la misma
 *  caja/posnet (acá, el reseteo al marcar "OK", y el conteo agrupado
 *  de incidencias en services/subitems.js). */
function sufijoCaja(titulo) {
    return String(titulo || "").toLowerCase().match(/\b(caja|posnet)\s*\d+/)?.[0] || "";
}

/** Monto de un sub-ítem numérico — "," es el separador decimal (poco
 *  común acá, pero soportado), "." NUNCA se interpreta como decimal.
 *  Pedido explícito, con bug real reportado en vivo: escribir "10.500"
 *  pensando en diez mil quinientos (como se escriben los miles acá)
 *  el sistema lo tomaba como 10,5 al exportar — un "." de más volvía
 *  el monto casi cien veces más chico sin ningún aviso. */
function parsearMontoInput(texto) {
    const limpio = String(texto || "").replace(/\./g, "").replace(",", ".");
    const n = Number(limpio);
    return Number.isFinite(n) ? n : 0;
}
/** Inverso — solo para pintar el valor guardado de vuelta en el
 *  input, nunca agrega separador de miles (no hace falta para
 *  ESCRIBIR, solo estorbaría). */
function formatearMontoInput(valor) {
    return String(valor).replace(".", ",");
}
/** Filtra mientras se escribe: sin "." (nunca es decimal acá — ver
 *  parsearMontoInput), como mucho UNA coma. */
function sanearInputMonto(input) {
    let v = input.value.replace(/\./g, "");
    const partes = v.split(",");
    if (partes.length > 2) v = partes[0] + "," + partes.slice(1).join("");
    v = v.replace(/[^\d,]/g, "");
    if (input.value !== v) input.value = v;
}

/** Guarda el check DE VERDAD contra GestionChecks — antes era
 *  puramente visual (bug real: "quien dio el marcado no le aparece al
 *  otro", dos dispositivos en el mismo local no se veían entre sí).
 *  Optimista, mismo patrón que bindDiasControl: la pantalla cambia al
 *  toque, si el backend rechaza se avisa y se revierte. */
function bindCheckboxHecha(chk) {
    chk.addEventListener("change", () => {
        ultimaEdicionLocalGestion = Date.now();
        const tarjeta = chk.closest(".tarea-gestion");
        const tareaId = tarjeta.dataset.tareaId;
        const dia = tarjeta.dataset.dia;
        const hechoNuevo = chk.checked;

        tarjeta.classList.toggle("hecha", hechoNuevo);
        const hora = tarjeta.querySelector("[data-hora]");
        // "Guardando..." mientras dura el ~1-1.5s real de Apps Script —
        // pedido explícito: si no se avisa, quien marca puede irse de
        // la página pensando que ya quedó, y el cambio no llega a
        // impactar. Se deshabilita el checkbox por lo mismo, para que
        // no se pueda destildar a mitad de un guardado en curso.
        if (hora) hora.textContent = "Guardando...";
        chk.disabled = true;

        guardarCheckSucursal(tareaId, dia, hechoNuevo, sucursalActiva).then((r) => {
            chk.disabled = false;
            if (!r?.ok) {
                alert(r?.error || "No se pudo guardar — probá de nuevo.");
                chk.checked = !hechoNuevo;
                tarjeta.classList.toggle("hecha", !hechoNuevo);
                if (hora) hora.textContent = !hechoNuevo ? `Hecho ${horaAhora()}` : "";
                return;
            }
            const nombre = getUsuarioActual()?.nombre || "";
            if (hora) hora.textContent = hechoNuevo ? `Hecho ${horaAhora()}${nombre ? ` · ${nombre}` : ""}` : "";
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

            // Debounce por tarea — UN solo guardado por ráfaga de
            // toques, con el estado FINAL acumulado, no un pedido
            // async por cada toque. Bug real reportado en vivo: tocar
            // varios días seguidos (ej. Lu, Ma, Mi, Ju) podía guardar
            // solo los primeros ("queda marcado solo Lu Ma Mi") — cada
            // toque disparaba su PROPIO pedido contra Apps Script
            // (~1.5s de latencia real), y en celular esos pedidos
            // podían llegar DESORDENADOS: el último en salir no
            // siempre es el último en llegar, así que uno más viejo
            // podía pisar a uno más nuevo. Con un solo pedido por
            // ráfaga no hay nada que se pueda desordenar entre sí.
            let estado = timersDias.get(idTarea);
            if (!estado) {
                estado = { diasPrevios: [...tarea.dias] }; // snapshot de ANTES de esta ráfaga, para poder revertir el combo entero si falla
                timersDias.set(idTarea, estado);
            }

            const idx = tarea.dias.indexOf(dia);
            if (idx === -1) tarea.dias.push(dia); else tarea.dias.splice(idx, 1);
            recrearTareaEnPaneles(idTarea);

            clearTimeout(estado.timer);
            estado.timer = setTimeout(() => {
                // Fase 2: se guarda en GestionTareasSucursal (mi
                // sucursal), no en el catálogo — el backend decide de
                // qué sucursal es la fila (usuarioActual.sucursal),
                // este valor es solo para el guardado optimista en
                // modo demo. La frecuencia viaja siempre junto con los
                // días (viven en la MISMA fila, ver guardarDiasSucursal)
                // — tocar una pill no la cambia, solo la preserva tal
                // cual está.
                guardarDiasSucursal(idTarea, [...tarea.dias], getUsuarioActual()?.sucursal, tarea.frecuencia).then((r) => {
                    timersDias.delete(idTarea);
                    if (r?.ok) return;
                    alert(r?.error || `No se pudo guardar el cambio de día para "${tarea.titulo}" — probá de nuevo.`);
                    // Revertir TODA la ráfaga (no solo el último toque) al estado de antes de empezarla.
                    tarea.dias = estado.diasPrevios;
                    recrearTareaEnPaneles(idTarea);
                });
            }, 700);
        });
    });
}

/** Semanal/Mensual POR TAREA — pedido explícito: "yo cargo la tarea,
 *  ellos deciden si es mensual o semanal, no tengo que estar
 *  modificando nada". Cada local elige acá, al desplegar la tarea en
 *  "Asignar tareas" — mismo lugar donde ya elige los días. Cambiarla
 *  con días ya elegidos los borra (no tienen sentido en el otro
 *  patrón) — mismo aviso que ya existía cuando esto vivía en el modal
 *  de Admin, ahora acá. */
function bindFrecuenciaTarea(contenedor) {
    contenedor.querySelectorAll("[data-elegir-frecuencia]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idTarea = contenedor.closest(".tarea-gestion").dataset.tareaId;
            const tarea = registroTareas.get(idTarea);
            if (!tarea) return;
            const nueva = btn.dataset.elegirFrecuencia;
            if (nueva === tarea.frecuencia) return;
            if (tarea.dias.length > 0) {
                if (!confirm(`Cambiar a "${nueva === "mensual" ? "Mensual" : "Semanal"}" borra los días que ya habías elegido para "${tarea.titulo}" (no tienen sentido en el otro patrón). ¿Seguro?`)) {
                    return;
                }
            }
            const diasPrevios = tarea.dias.slice();
            tarea.frecuencia = nueva;
            tarea.dias = [];
            recrearTareaEnPaneles(idTarea);
            guardarDiasSucursal(idTarea, [], getUsuarioActual()?.sucursal, nueva).then((r) => {
                if (r?.ok) return;
                alert(r?.error || "No se pudo guardar — probá de nuevo.");
                tarea.frecuencia = nueva === "mensual" ? "semanal" : "mensual";
                tarea.dias = diasPrevios;
                recrearTareaEnPaneles(idTarea);
            });
        });
    });
}

/** Estado ACTUAL de una fila de sub-ítem, cualquiera sea su tipo —
 *  undefined si todavía no se respondió (checkbox sin tildar, estado3
 *  sin ningún círculo tocado). Numérico NUNCA es undefined — arranca
 *  en 0 por default (pedido explícito: "los valores que están en
 *  cero deben quedar así por default si está bien, si tiene
 *  incidencia cargarla"), así que ya cuenta como respondido desde el
 *  primer render, sin que nadie tenga que confirmarlo a propósito. A
 *  nivel de módulo (no solo adentro de bindTarjetaDesplegable) porque
 *  también la usa el push por tarea, para saber si hay incidencias —
 *  ver bindPushWrap. */
/** contenedor (el [data-subitems] entero) es opcional pero hace falta
 *  para leer el motivo de un estado3 — sus chips ahora viven en el
 *  numérico hermano (ver subitemFilaHtml), NO adentro de esta fila,
 *  así que buscarlos con fila.querySelector ya no alcanza. */
function leerMarcaFilaSubitem(fila, contenedor) {
    const tipo = fila.dataset.subitemTipo;
    if (tipo === TIPOS_SUBITEM.NUMERICO) {
        // Magnitud (siempre ≥0, lo que se escribe) + signo (lo que se
        // elige con Falta/Sobra) — ver comentario en subitemFilaHtml.
        const input = fila.querySelector(".input-numerico-subitem");
        if (!input) return undefined;
        const magnitud = input.value === "" ? 0 : Math.abs(parsearMontoInput(input.value));
        const valor = fila.dataset.signo === "-" ? -magnitud : magnitud;
        return { tipo: TIPOS_SUBITEM.NUMERICO, valor };
    }
    if (tipo === TIPOS_SUBITEM.ESTADO2) {
        const estado = fila.dataset.estadoActual;
        return estado ? { tipo: TIPOS_SUBITEM.ESTADO2, estado } : undefined;
    }
    if (tipo === TIPOS_SUBITEM.ESTADO3) {
        const estado = fila.dataset.estadoActual;
        if (!estado) return undefined;
        const raiz = contenedor || fila;
        const chipActivo = raiz.querySelector(`[data-motivo-de="${fila.dataset.subitemIndice}"] .chip-motivo.activo`);
        return { tipo: TIPOS_SUBITEM.ESTADO3, estado, motivo: chipActivo?.dataset.motivo || "" };
    }
    const chk = fila.querySelector(".subitem-gestion-check");
    return chk?.checked ? { tipo: TIPOS_SUBITEM.CHECKBOX } : undefined;
}

/** Tareas con sub-ítems (ej. "Pedido a proveedores") y situaciones de
 *  "¿Qué hago si...?" comparten el mismo patrón desplegable: tocar el
 *  encabezado abre/cierra lo de abajo, con "+ Agregar ítem" propio. */
function bindTarjetaDesplegable(tarjeta) {
    const header = tarjeta.querySelector("[data-toggle-desplegable]");
    const contenedorSubitems = tarjeta.querySelector("[data-subitems]");
    const progreso = tarjeta.querySelector("[data-progreso]");
    const btnGuardar = tarjeta.querySelector("[data-guardar-subitems]");

    header.addEventListener("click", () => {
        tarjeta.classList.toggle("desplegada");
    });

    if (!contenedorSubitems || !progreso) return; // situación de "¿Qué hago si...?": no tiene checklist derivado.

    const clave = `${tarjeta.dataset.tareaId}|${tarjeta.dataset.dia}`;

    function leerTodo() {
        const filas = Array.from(contenedorSubitems.children);
        const marcados = [];
        filas.forEach((fila) => {
            const marca = leerMarcaFilaSubitem(fila, contenedorSubitems);
            if (marca) marcados.push({ indice: fila.dataset.subitemIndice, marca });
        });
        return { filas, marcados };
    }

    /** Recalcula SIEMPRE contra lo que hay en el DOM en ese momento (no
     *  una lista capturada al abrir la página) — así "16/16" en vez de
     *  "0/8" cuando se agregaron ítems nuevos, sin pedirlo por código.
     *  Actualiza SOLO la pantalla — YA NO guarda en cada toque, ver
     *  guardarAhora() más abajo. */
    function actualizarProgresoLocal() {
        const { filas, marcados } = leerTodo();
        progreso.textContent = `${marcados.length}/${filas.length}`;
        const completa = filas.length > 0 && marcados.length === filas.length;
        tarjeta.classList.toggle("hecha", completa);
        // Marca la tarjeta como "con cambios sin guardar" — pedido
        // explícito, con captura real: "al moverte de la página se
        // sale todo" — antes se guardaba en CADA toque (fetch de
        // fondo por cada click), y si el usuario navegaba rápido entre
        // varios toques, esos guardados podían llegar DESORDENADOS al
        // backend (el último en salir no siempre es el último en
        // llegar) y uno pisaba al otro. Ahora nada se manda hasta que
        // se toca "Guardar" — un solo pedido con el estado final,
        // nada que ordenar. tareasSinGuardarGestion (módulo) también
        // frena el repaso de fondo mientras haya algo sin guardar acá
        // — ver actualizarChecksEnDOM.
        tareasSinGuardarGestion.add(clave);
        if (btnGuardar) btnGuardar.classList.add("pendiente");
    }

    /** Recalcula estado numérico visual (borde verde/ámbar) de UNA
     *  fila numérica al tipear — antes solo se pintaba al renderizar,
     *  así que escribir un monto no cambiaba el color hasta el
     *  próximo repaso completo. */
    function actualizarColorNumerico(fila) {
        const input = fila.querySelector(".input-numerico-subitem");
        const magnitud = input && input.value !== "" ? Math.abs(parsearMontoInput(input.value)) : 0;
        fila.classList.toggle("incidencia", magnitud !== 0);
        fila.classList.toggle("ok", magnitud === 0);
    }

    /** Junta TODO lo tildado/elegido en este momento y lo manda en UN
     *  solo pedido — pedido explícito: "poner un botón que al terminar
     *  diga guardar así queda todo guardado y no pasa más eso". */
    function guardarAhora() {
        const { filas, marcados } = leerTodo();
        const completa = filas.length > 0 && marcados.length === filas.length;
        tarjeta.classList.toggle("hecha", completa);
        // "Guardando..." hasta que el guardado REAL termine — SIEMPRE
        // que el resultado sea completa, no solo la primera vez que se
        // completa. Bug real reportado en vivo: reeditar una tarea que
        // YA estaba completa (ej. destildar un sub-ítem por error y
        // volver a guardar) no pisaba el nombre/hora en absoluto — el
        // botón decía "Guardado" al toque, pero el nombre quedaba
        // esperando al PRÓXIMO repaso de 20s para actualizarse (de ahí
        // los 7-10s reportados: no era la latencia real del guardado,
        // era el tiempo hasta el siguiente repaso). Con tareas simples
        // (sin sub-ítems, ver bindCheckboxHecha) esto nunca pasaba
        // porque ese guardado no distinguía "recién completa" de
        // "ya estaba completa" — ahora tampoco distingue acá.
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) hora.textContent = completa ? "Guardando..." : "";

        const textoOriginal = btnGuardar?.textContent;
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.textContent = "Guardando...";
        }
        guardarCheckSucursal(tarjeta.dataset.tareaId, tarjeta.dataset.dia, completa, sucursalActiva, marcados.map(({ indice, marca }) => serializarMarcaSubitem(indice, marca))).then((r) => {
            if (btnGuardar) btnGuardar.disabled = false;
            if (!r?.ok) {
                alert(r?.error || "No se pudo guardar — probá de nuevo.");
                if (btnGuardar) btnGuardar.textContent = textoOriginal;
                if (hora && completa) hora.textContent = "";
                return;
            }
            tareasSinGuardarGestion.delete(clave);
            if (hora && completa) {
                const nombre = getUsuarioActual()?.nombre || "";
                hora.textContent = `Hecho ${horaAhora()}${nombre ? ` · ${nombre}` : ""}`;
            }
            if (btnGuardar) {
                btnGuardar.classList.remove("pendiente");
                btnGuardar.textContent = "✓ Guardado";
                setTimeout(() => { btnGuardar.textContent = textoOriginal; }, 2000);
            }
        });
    }

    if (btnGuardar) btnGuardar.addEventListener("click", guardarAhora);

    // checkbox y numérico disparan "change"; los círculos de estado3,
    // los chips de motivo y el toggle Falta/Sobra son <button>,
    // disparan "click" — un solo listener por delegación de cada tipo
    // cubre toda la tarjeta.
    contenedorSubitems.addEventListener("change", (e) => {
        if (e.target.classList.contains("input-numerico-subitem")) {
            actualizarColorNumerico(e.target.closest(".subitem-numerico"));
        }
        if (e.target.classList.contains("subitem-gestion-check") || e.target.classList.contains("input-numerico-subitem")) actualizarProgresoLocal();
    });

    // Selecciona todo el "0" por defecto al enfocar, para que escribir
    // reemplace en vez de acumularse detrás (ej. "0" + "158987" nunca
    // debería quedar "0158987") — capturado en vivo con captura real.
    contenedorSubitems.addEventListener("focusin", (e) => {
        if (e.target.classList.contains("input-numerico-subitem")) e.target.select();
    });

    // Filtra "." mientras se escribe — nunca es decimal acá (ver
    // parsearMontoInput). Bug real reportado en vivo: "10.500" pensado
    // como diez mil quinientos se leía como 10,5 al exportar.
    contenedorSubitems.addEventListener("input", (e) => {
        if (e.target.classList.contains("input-numerico-subitem")) sanearInputMonto(e.target);
    });

    contenedorSubitems.addEventListener("click", (e) => {
        const signoBtn = e.target.closest(".signo-btn");
        if (signoBtn) {
            const fila = signoBtn.closest(".subitem-numerico");
            fila.dataset.signo = signoBtn.dataset.signo;
            fila.querySelectorAll(".signo-btn").forEach((b) => b.classList.remove("activo"));
            signoBtn.classList.add("activo");
            actualizarProgresoLocal();
            return;
        }
        const estado2Btn = e.target.closest(".estado2-btn");
        if (estado2Btn) {
            const fila = estado2Btn.closest(".subitem-estado2");
            fila.querySelectorAll(".estado2-btn").forEach((b) => b.classList.remove("activo"));
            estado2Btn.classList.add("activo");
            fila.dataset.estadoActual = estado2Btn.dataset.estado;
            actualizarProgresoLocal();
            return;
        }
        const estadoBtn = e.target.closest(".estado-btn");
        if (estadoBtn) {
            const fila = estadoBtn.closest(".subitem-estado3");
            fila.querySelectorAll(".estado-btn").forEach((b) => b.classList.remove("activo"));
            estadoBtn.classList.add("activo");
            fila.dataset.estadoActual = estadoBtn.dataset.estado;
            // Los chips de este estado3 viven en el numérico hermano
            // (ver subitemFilaHtml) — se ubican por data-motivo-de con
            // el ÍNDICE de esta fila, no adentro de ella.
            const chips = contenedorSubitems.querySelector(`[data-motivo-de="${fila.dataset.subitemIndice}"]`);
            if (chips) {
                const esOk = estadoBtn.dataset.estado === "ok";
                chips.classList.toggle("visible", !esOk);
                // Volver a "OK" descarta cualquier motivo elegido antes
                // — no tiene sentido guardar un motivo de incidencia
                // sobre un ítem que ahora dice que está todo bien.
                if (esOk) chips.querySelectorAll(".chip-motivo").forEach((c) => c.classList.remove("activo"));
            }
            resetearNumericoParejo(estadoBtn);
            actualizarProgresoLocal();
            return;
        }
        const chip = e.target.closest(".chip-motivo");
        if (chip) {
            const grupo = chip.parentElement;
            grupo.querySelectorAll(".chip-motivo").forEach((c) => c.classList.remove("activo"));
            chip.classList.add("activo");
            actualizarProgresoLocal();
        }
    });

    // Al marcar "OK" (verde) en un ítem de 3 estados (ej. "Efectivo —
    // Caja 1"), resetea a 0 el numérico de la MISMA caja/posnet (ej.
    // "Saldo Caja 1") — si el efectivo cuadra, el saldo cuadra solo,
    // sin un segundo toque. El sentido Falta/Sobra y el monto son
    // exclusivos del numérico — no se decide en ningún otro lado — así
    // que si en cambio se marca incidencia, acá no se toca nada: la
    // persona carga el valor real directamente en el numérico.
    function resetearNumericoParejo(estadoBtn) {
        if (estadoBtn.dataset.estado !== "ok") return;
        const filaEstado3 = estadoBtn.closest(".subitem-estado3");
        const tituloEstado3 = filaEstado3?.querySelector(".subitem-estado3-fila > span")?.textContent || "";
        const sufijo = sufijoCaja(tituloEstado3);
        const filasNumericas = Array.from(contenedorSubitems.querySelectorAll(".subitem-numerico"));
        const destino = sufijo
            ? filasNumericas.find((f) => f.querySelector(":scope > span")?.textContent.toLowerCase().includes(sufijo))
            : (filasNumericas.length === 1 ? filasNumericas[0] : null);
        if (!destino) return;
        const input = destino.querySelector(".input-numerico-subitem");
        if (input) input.value = "0";
        // En $0 el signo no significa nada — ninguno de los dos botones
        // queda marcado, para no dejar un "Falta"/"Sobra" en rojo o
        // naranja al lado de un valor que en realidad está en cero.
        destino.dataset.signo = "+";
        destino.querySelectorAll(".signo-btn").forEach((b) => b.classList.remove("activo"));
        actualizarColorNumerico(destino);
    }
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

    // Con un local elegido, respetar el filtro de alcance (aplicaA/
    // noAplicaA) también acá — si Admin edita el alcance de una tarea
    // y la deja fuera del local que está mirando en ese momento, sacarla
    // de la lista en vez de dejarla visible hasta el próximo recargue.
    const hayLocal = !esVistaLectura || !!sucursalActiva;
    if (hayLocal && !aplicaASucursal(tarea, sucursalActivaObj())) {
        filaVieja?.remove();
        return;
    }

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

/** Botón normal de "Enviar push" — estado por defecto de cada wrap
 *  por tarea. Separado en su propia función porque bindPushWrap() lo
 *  vuelve a pintar cada vez que se cancela la confirmación o termina
 *  un envío (ver más abajo). */
function pushBotonHtml() {
    return `<button type="button" class="btn-enviar-push" data-btn-enviar-push>${Icon("campana", { size: 14 })} Enviar push</button>`;
}

/** Banner de confirmación — pedido explícito: "sumar un banner
 *  enviar, así si presiono por error lo revierte". Reemplaza al botón
 *  DENTRO del wrap en vez de abrir un modal aparte: mismo lugar, un
 *  toque menos que cancelar un popup. Sin ids en los botones a
 *  propósito — cada tarea tiene su propio wrap, e ids repetidos por
 *  toda la página serían HTML inválido (los queries de acá van todos
 *  con wrap.querySelector, scopeados, así que no hace falta). */
function pushBannerHtml() {
    return `
        <div class="banner-confirmar-push">
            <span>¿Enviar push a todo el equipo?</span>
            <div class="banner-confirmar-push-botones">
                <button type="button" class="btn-cancelar-push" data-btn-cancelar-push>Cancelar</button>
                <button type="button" class="btn-confirmar-push" data-btn-confirmar-push>Confirmar envío</button>
            </div>
        </div>
    `;
}

/** "Enviar push" — UN wrap POR TAREA (sibling después de la tarjeta,
 *  ver pushWrapHtml en tareaHtml). Tocar "Enviar push" NO manda nada
 *  todavía: cambia el botón por un banner de confirmación
 *  (pushBannerHtml) — solo "Confirmar envío" arma el título/cuerpo
 *  según el estado ACTUAL de ESA tarea (sus propios checkboxes, no
 *  las demás del día) y lo manda vía mandarPushGestion, que NO recibe
 *  destinatarios — el backend decide solo (los demás Responsables de
 *  local/turno de la MISMA sucursal). No depende de que el check esté
 *  persistido (eso es Fase 2) — mide lo que hay tildado ahora mismo.
 *
 *  Orden de prioridad pedido explícito (2026-08-26), con ejemplo real
 *  ("Reclamos Pedidos ya / completa e incompleta / Máximo Busquets"):
 *  1º el encabezado DE LA TAREA ("es lo importante" — antes era el
 *  día, perdía justo el dato de CUÁL tarea), 2º completa/incompleta,
 *  3º el nombre de quien envía. Encabezado + estado van juntos en el
 *  TÍTULO (corto, siempre visible completo); el nombre va al CUERPO,
 *  primero en su línea para que no se corte — reportado en vivo que
 *  al final de un cuerpo largo la vista previa colapsada de Android
 *  lo tapaba. */
function bindPushWrap(wrap) {
    const tareaId = wrap.dataset.tareaId;
    const dia = wrap.dataset.dia;

    function pintarBoton() {
        wrap.innerHTML = pushBotonHtml();
        wrap.querySelector("[data-btn-enviar-push]").addEventListener("click", pintarBanner);
    }

    function pintarBanner() {
        wrap.innerHTML = pushBannerHtml();
        wrap.querySelector("[data-btn-cancelar-push]").addEventListener("click", pintarBoton);
        wrap.querySelector("[data-btn-confirmar-push]").addEventListener("click", enviar);
    }

    async function enviar() {
        const boton = wrap.querySelector("[data-btn-confirmar-push]");
        const tarea = registroTareas.get(tareaId);
        // El wrap ya NO es sibling directo de la tarjeta (ahora los
        // dos viven adentro de .tarea-gestion-push, junto a
        // Exportar, para quedar "al lado" uno del otro) — se busca
        // por tarea+día, que juntos son únicos en la página (la fila
        // de "Tareas" tiene tarea-id pero nunca data-dia).
        const tarjeta = document.querySelector(`.tarea-gestion[data-tarea-id="${tareaId}"][data-dia="${dia}"]`);
        if (!tarea || !tarjeta) { pintarBoton(); return; }

        // Tarea con sub-ítems (checkbox/estado3/numérico mezclados,
        // ver services/subitems.js) vs. tarea simple (un solo check
        // propio) — cada una lee su estado distinto.
        const contenedorSubitems = tarjeta.querySelector("[data-subitems]");
        let hayEstado, completa, incidencias, graves;
        if (contenedorSubitems) {
            const filas = Array.from(contenedorSubitems.children);
            const marcas = filas.map((fila) => leerMarcaFilaSubitem(fila, contenedorSubitems));
            hayEstado = marcas.length > 0;
            completa = hayEstado && marcas.every(Boolean);
            // Agrupado por caja/posnet (ver services/subitems.js) — no
            // cuenta "Efectivo Caja 1" + "Saldo Caja 1" como dos
            // incidencias separadas cuando describen la misma.
            const items = filas.map((fila, i) => ({ titulo: fila.querySelector(":scope > span, .subitem-estado3-fila > span")?.textContent || "", marca: marcas[i] }));
            ({ incidencias, graves } = contarIncidenciasAgrupadas(items));
        } else {
            const checkPropio = tarjeta.querySelector(".tarea-gestion-check");
            hayEstado = !!checkPropio;
            completa = !!checkPropio?.checked;
            incidencias = 0;
            graves = 0;
        }

        const usuario = getUsuarioActual();
        // Completa/incompleta manda primero (¿se terminó de revisar o
        // no?) — recién con la tarea COMPLETA importa si hubo alguna
        // incidencia adentro, pedido explícito con maqueta confirmada
        // (arqueo de caja: "verde/amarillo/rojo si hay incidencia").
        const estado = !hayEstado ? ""
            : !completa ? "Incompleta ⚠️"
            : graves > 0 ? "Incidencia grave 🔴"
            : incidencias > 0 ? "Con incidencia ⚠️"
            : "Completa ✅";
        const titulo = [tarea.titulo, estado].filter(Boolean).join(" · ");

        boton.disabled = true;
        boton.textContent = "Enviando...";
        try {
            // Nombre PRIMERO en el cuerpo (así nunca se corta, es lo
            // menos importante pero se ve igual) + un detalle corto
            // solo cuando aporta algo real.
            const detalle = !hayEstado ? "Aviso desde Gestión de tareas." : completa ? "" : "Revisá qué falta en la app.";
            const cuerpo = usuario?.nombre ? (detalle ? `${usuario.nombre} — ${detalle}` : usuario.nombre) : (detalle || "Gestión de tareas");
            const r = await mandarPushGestion(titulo, cuerpo, "#/gestion");
            if (!r?.ok) {
                alert(r?.error || "No se pudo enviar el push — probá de nuevo.");
                pintarBoton();
                return;
            }
            // Confirmación visible de que SÍ salió — antes quedaba
            // mudo en el caso de éxito, indistinguible de "no hizo
            // nada" (pedido explícito: "no se sabe si se envió").
            wrap.innerHTML = `<button type="button" class="btn-enviar-push" disabled>✓ Enviado</button>`;
            setTimeout(pintarBoton, 2000);
        } catch (err) {
            alert("No se pudo enviar el push — probá de nuevo.");
            pintarBoton();
        }
    }

    pintarBoton();
}

/** Le engancha a un nodo (recién insertado por confirmarTarea o
 *  recrearTareaEnPaneles) todo lo que le corresponda según su forma —
 *  mismo resultado que si hubiera venido en el render inicial. */
function bindTarjetaNueva(nodo) {
    nodo.querySelectorAll(".tarea-gestion-check").forEach(bindCheckboxHecha);
    nodo.querySelectorAll(".tarea-gestion-dia-control").forEach(bindDiasControl);
    nodo.querySelectorAll(".tarea-gestion-dia-control").forEach(bindFrecuenciaTarea);
    nodo.querySelectorAll("[data-editar-tarea]").forEach(bindEditarTarea);
    nodo.querySelectorAll("[data-eliminar-tarea]").forEach(bindEliminarTarea);
    if (nodo.matches("[data-desplegable]")) bindTarjetaDesplegable(nodo);
}

/** Todo lo que hay que re-enganchar cada vez que #cuerpo-gestion se
 *  reconstruye — al cargar la página Y cada vez que Admin/Supervisor
 *  cambia de local en el selector (mismo contenido, nodos nuevos). */
function bindCuerpoGestion() {
    // Pills de "Tareas asignadas" (día de semana + fecha, o día del mes
    // + fecha) — data-vista-dia activa, muestra el [data-panel-dia] que
    // matchea, oculta el resto. Vive DENTRO de #seccion-tareas-asignadas,
    // así que solo importa mientras esa sección está visible.
    document.querySelectorAll("#tabs-dias-gestion [data-vista-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#tabs-dias-gestion [data-vista-dia]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            diaActivo = btn.dataset.vistaDia;
            document.querySelectorAll("[data-panel-dia]").forEach((panel) => {
                panel.style.display = panel.dataset.panelDia === diaActivo ? "" : "none";
            });
            // "Exportar a PDF" ya no necesita mostrarse/ocultarse
            // aparte: vive adentro de cada tarea (ver tareaHtml), que
            // ya nace/muere con el panel del día que se está
            // mostrando/ocultando acá arriba.
        });
    });

    // "Asignar tareas" / "Tareas asignadas" — pedido explícito, con
    // croquis: dos secciones separadas en vez de todo amontonado en
    // una. Solo muestra/oculta (no hace falta re-renderizar ni traer
    // nada del backend, la data ya está toda en memoria).
    document.querySelectorAll("[data-vista-seccion]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (btn.dataset.vistaSeccion === vistaSeccion) return;
            vistaSeccion = btn.dataset.vistaSeccion;
            document.querySelectorAll("[data-vista-seccion]").forEach((b) => b.classList.remove("activa"));
            btn.classList.add("activa");
            document.getElementById("seccion-asignar-tareas").style.display = vistaSeccion === "asignar" ? "" : "none";
            document.getElementById("seccion-tareas-asignadas").style.display = vistaSeccion === "ejecutar" ? "" : "none";
        });
    });

    document.querySelectorAll(".tarea-gestion-check").forEach(bindCheckboxHecha);
    document.querySelectorAll(".tarea-gestion-dia-control").forEach(bindDiasControl);
    document.querySelectorAll(".tarea-gestion-dia-control").forEach(bindFrecuenciaTarea);
    document.querySelectorAll("[data-desplegable]").forEach(bindTarjetaDesplegable);
    document.querySelectorAll("[data-editar-tarea]").forEach(bindEditarTarea);
    document.querySelectorAll("[data-eliminar-tarea]").forEach(bindEliminarTarea);
    document.querySelectorAll("[data-push-tarea-wrap]").forEach(bindPushWrap);

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
    // Delegado en #contenido-gestion-imprimible (contenedor estable)
    // en vez de un id único — ahora "Exportar a PDF" se repite una
    // vez por tarea (ver tareaHtml), así que cualquiera de esas
    // copias tiene que disparar lo mismo sin necesitar su propio
    // listener ni volver a engancharse cada vez que una tarea cambia
    // de día (recrearTareaEnPaneles).
    document.getElementById("contenido-gestion-imprimible")?.addEventListener("click", (e) => {
        if (!e.target.closest("[data-exportar-gestion]")) return;
        document.querySelectorAll("#contenido-gestion-imprimible input[type=checkbox]").forEach((chk) => {
            if (chk.checked) chk.setAttribute("checked", "checked");
            else chk.removeAttribute("checked");
        });

        // ✓/— de cada sub-ítem: se agrega como texto plano FIJO acá,
        // no con CSS ":checked" en el documento exportado — reportado
        // en vivo (2026-08-26): "Descargar PDF" seguía fallando con
        // sub-ítems aunque ya no usara ":has()". El motor real detrás
        // de esa descarga (html2canvas) reimplementa su propio motor
        // de CSS y su soporte de pseudo-clases de estado en general es
        // poco confiable, no solo ":has()" — texto fijo no le exige
        // entender nada dinámico. No es "mentirle a la app": el
        // checkbox está REALMENTE tildado o no, esto solo hace que ese
        // estado real sea legible para un motor de PDF limitado — se
        // saca el nodo agregado apenas termina de exportar (exportarAPdf
        // clona el HTML de forma síncrona, así que esto alcanza).
        const spansSubitem = document.querySelectorAll("#contenido-gestion-imprimible .subitem-gestion");
        const marcasAgregadas = [];
        spansSubitem.forEach((label) => {
            const input = label.querySelector("input[type=checkbox]");
            const span = label.querySelector("span");
            if (!input || !span) return;
            const marca = document.createElement("span");
            marca.className = "subitem-gestion-marca";
            marca.style.color = input.checked ? "#1a7a3c" : "#999";
            marca.textContent = input.checked ? "✓ " : "— ";
            span.before(marca);
            marcasAgregadas.push(marca);
        });

        // Sub-ítems numéricos (ej. "Saldo/diferencia") — magnitud +
        // signo (Falta/Sobra), NO un solo valor con "-" (ver
        // subitemFilaHtml) — el ATRIBUTO value tampoco sigue al valor
        // tecleado (mismo problema que "checked" arriba), se
        // sincroniza antes de clonar. Suma una etiqueta de texto fijo
        // con el resultado (Cuadra ✓ / Faltan $X / Sobran $X), mismo
        // criterio que el ✓/— de los checkbox.
        document.querySelectorAll("#contenido-gestion-imprimible .subitem-numerico").forEach((fila) => {
            const input = fila.querySelector(".input-numerico-subitem");
            const span = fila.querySelector("span");
            if (!input || !span) return;
            input.setAttribute("value", input.value);
            const magnitud = input.value === "" ? 0 : Math.abs(parsearMontoInput(input.value));
            const esFalta = fila.dataset.signo === "-";
            const marca = document.createElement("span");
            marca.className = "subitem-gestion-marca";
            // Mismo criterio que en pantalla: Falta = rojo (más grave),
            // Sobra = naranja, Cuadra (0) = verde.
            marca.style.color = magnitud === 0 ? "#1a7a3c" : esFalta ? "#c0392b" : "#b8860b";
            marca.textContent = magnitud === 0 ? "✓ Cuadra " : `${esFalta ? "Faltan" : "Sobran"} $${formatearMontoInput(magnitud)} `;
            span.before(marca);
            marcasAgregadas.push(marca);
        });

        // Sub-ítems de 2 estados (Hecho/No hecho), mismo criterio.
        document.querySelectorAll("#contenido-gestion-imprimible .subitem-estado2").forEach((fila) => {
            const span = fila.querySelector("span");
            if (!span) return;
            const estado = fila.dataset.estadoActual;
            const marca = document.createElement("span");
            marca.className = "subitem-gestion-marca";
            marca.style.color = estado === "si" ? "#1a7a3c" : estado === "no" ? "#c0392b" : "#999";
            marca.textContent = estado === "si" ? "✓ " : estado === "no" ? "✕ No hecho " : "— ";
            span.before(marca);
            marcasAgregadas.push(marca);
        });

        // Sub-ítems de 3 estados (ej. "Efectivo") — estado + motivo
        // elegido, mismo criterio que arriba.
        document.querySelectorAll("#contenido-gestion-imprimible .subitem-estado3").forEach((fila) => {
            const span = fila.querySelector(".subitem-estado3-fila span");
            if (!span) return;
            const estado = fila.dataset.estadoActual;
            // Los chips de este estado3 viven en el numérico hermano
            // (ver subitemFilaHtml) — no adentro de esta fila.
            const chipActivo = document.querySelector(`#contenido-gestion-imprimible [data-motivo-de="${fila.dataset.subitemIndice}"] .chip-motivo.activo`);
            const marca = document.createElement("span");
            marca.className = "subitem-gestion-marca";
            if (!estado) {
                marca.style.color = "#999";
                marca.textContent = "— ";
            } else if (estado === "ok") {
                marca.style.color = "#1a7a3c";
                marca.textContent = "✓ ";
            } else {
                marca.style.color = estado === "grave" ? "#c0392b" : "#b8860b";
                marca.textContent = `${estado === "grave" ? "✕" : "!"} ${chipActivo ? chipActivo.dataset.motivo + " " : ""}`;
            }
            span.before(marca);
            marcasAgregadas.push(marca);
        });

        // Se exporta EXACTAMENTE lo que está en pantalla en este
        // momento (el día activo), sin trucos — pedido explícito:
        // "no se le puede mentir a la app diciéndole que todo es el
        // mismo texto, lo que debe convertir a PDF es el diseño
        // final, no como viene de la app". Un intento anterior de
        // forzar todos los días a la vez (para que "Tareas" no diera
        // un PDF vacío) se revirtió el mismo día por esto — en vez de
        // eso, el botón vive adentro de cada tarea (ver tareaHtml),
        // que ya solo existe dentro del panel del día que esté
        // activo en ese momento.

        // soloDescarga:true (2026-08-26, revertido el mismo día): la idea
        // era que acá el reporte nunca es grande y el botón "Imprimir"
        // de respaldo (pensado para reportes de cientos de filas) era
        // ruido — pero reportado en vivo: "Descargar PDF" puede fallar
        // igual por otros motivos (el timeout de 25s de html2pdf, una
        // imagen externa que no carga, etc.), y sin "Imprimir" ahí no
        // quedaba NINGÚN camino que funcionara — el propio mensaje de
        // error decía "probá con Imprimir" para un botón que ya no
        // estaba. Los dos botones se quedan: "Imprimir" no es solo el
        // respaldo por tamaño, es el respaldo por confiabilidad.
        exportarAPdf("contenido-gestion-imprimible", "Guía de Gestión");

        marcasAgregadas.forEach((marca) => marca.remove());
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
    // Sub-ítems: mientras haya CUALQUIER checklist con cambios sin
    // guardar (tocaste algo, todavía no tocaste "Guardar"), se salta
    // el repaso entero — leer ahora traería el último estado
    // GUARDADO, no lo que hay tildado en pantalla, y lo pisaría.
    if (tareasSinGuardarGestion.size > 0) return;
    // Tareas simples (un solo check, sin botón "Guardar" — se sigue
    // guardando solo, al toque): mismo criterio de margen que antes,
    // por si el guardado (Apps Script, ~1-2s) todavía no terminó.
    if (Date.now() - ultimaEdicionLocalGestion < MARGEN_EDICION_LOCAL_MS) return;
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
        const tareaId = tarjeta.dataset.tareaId;
        const dia = tarjeta.dataset.dia;
        const check = checksActivos[`${tareaId}|${dia}`];
        const hechoTexto = check?.hecho ? `Hecho ${check.hora || ""}${check.marcadoPor ? ` · ${check.marcadoPor}` : ""}` : "";
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) hora.textContent = hechoTexto;
        tarjeta.classList.toggle("hecha", !!check?.hecho);

        const checkSimple = tarjeta.querySelector(".tarea-gestion-check");
        if (checkSimple) checkSimple.checked = !!check?.hecho;

        // Sub-ítems con tipos mixtos (checkbox/estado3/numérico, ver
        // services/subitems.js) — más simple RE-RENDERIZAR con la
        // misma subitemFilaHtml() que arma el HTML inicial, en vez de
        // duplicar "cómo se ve cada tipo" acá aparte. Los listeners
        // siguen andando: son delegados en el contenedor
        // (bindTarjetaDesplegable), no en cada fila — reemplazar el
        // innerHTML no los pierde.
        const contenedorSubitems = tarjeta.querySelector("[data-subitems]");
        const tarea = registroTareas.get(tareaId);
        if (contenedorSubitems && tarea?.subitems) {
            const marcados = check?.marcas || new Map();
            contenedorSubitems.innerHTML = tarea.subitems.map((s, is) => subitemFilaHtml(`tarea-${tareaId}-${dia}`, is, tarea.subitems, marcados)).join("");
            const progreso = tarjeta.querySelector("[data-progreso]");
            if (progreso) progreso.textContent = `${marcados.size}/${tarea.subitems.length}`;
            const badgeWrap = tarjeta.querySelector("[data-badge-incidencia]");
            if (badgeWrap) badgeWrap.innerHTML = badgeIncidenciaContenido(tarea.subitems, marcados);
        }
    });
}

let intervaloChecksGestion = null;

/** Marca de tiempo del último tilde/toque LOCAL en cualquier check —
 *  pedido explícito, con captura real: "el marcar sub-tareas las
 *  carga, las quita, las regresa de nuevo". Causa real: el repaso de
 *  fondo cada 20s (actualizarChecksEnDOM) puede llegar a leer el
 *  backend justo en el hueco entre "tocaste algo" y "el guardado
 *  (~1-2s de Apps Script) todavía no terminó de escribirse" — ese
 *  repaso trae el estado VIEJO y pisa el cambio recién hecho por un
 *  instante, hasta el próximo ciclo. Saltear un ciclo de repaso justo
 *  después de un toque local evita la carrera: 20s es margen de sobra
 *  para no perder nada real. */
let ultimaEdicionLocalGestion = 0;
const MARGEN_EDICION_LOCAL_MS = 4000;

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
