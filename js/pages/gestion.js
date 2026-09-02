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
import { getChecksPorSucursal, guardarCheckSucursal, reabrirTareaGestion, eliminarCheckGestion, getHistoricoGestion, eliminarHistoricoGestion, getHorarioRecordatorioGestion, guardarHorarioRecordatorioGestion } from "../data/gestionChecks.js";
import { invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";
import { AutocompleteSucursal, bindAutocompleteSucursal } from "../components/autocompleteSucursal.js";
import { MultiSelectAlcance, bindMultiSelectAlcance } from "../components/multiSelectAlcance.js";
import { getSucursales } from "../data/sucursales.js";
import { aplicaASucursal, normalizar } from "../services/alcance.js";
import { TIPOS_SUBITEM, parsearSubitem, serializarSubitem, serializarMarcaSubitem, parsearMarcaSubitem, parsearFirmaSubitem, contarIncidenciasAgrupadas } from "../services/subitems.js";
import { cicloActual, cicloDeFecha, etiquetaCiclo } from "../services/gestionCiclo.js";

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

/** "toDateString()" del día real en que diaActivo se confirmó como
 *  válido por última vez — sin esto, una pestaña que queda abierta de
 *  un día para el otro seguía reabriendo el mismo día viejo para
 *  siempre: "Domingo" es un valor SIEMPRE válido para
 *  DIAS_VISUAL.includes(), así que el guard de más abajo nunca lo
 *  consideraba "inválido" aunque ya hubiera pasado a ser semana
 *  pasada. Bug real reportado en vivo (2026-09-02, captura): el
 *  calendario marcaba bien HOY con el punto dorado, pero el panel
 *  abierto seguía siendo un domingo ya bloqueado por
 *  esDiaDeHoyGestion, de una visita de días atrás. */
let fechaDiaActivo = null;

/** Claves "tareaId|dia" con cambios de sub-ítems tocados EN LOCAL pero
 *  todavía no guardados con el botón "Guardar" (ver bindTarjetaDesplegable,
 *  guardarAhora) — mientras haya al menos una, actualizarChecksEnDOM
 *  (el repaso de fondo cada 5s) se salta entero, para no pisar un
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

/** "Histórico" (2026-08-31) — pestaña de ciclos ya cerrados. Decisión
 *  explícita del usuario: NO acotarla a Responsable de local — la ve
 *  también Admin/Supervisor, una vez que eligieron un local en el
 *  selector (mismo criterio que el resto de "Tareas asignadas": sin
 *  local elegido no hay ciclo de qué hablar). Responsable de turno NO
 *  tiene acceso. */
let usuarioEncargadoActivo = false;

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
    const fecha = fechaObjDiaSemana(nombreDia);
    return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

/** Mismo cálculo que fechaDelDiaSemana, factorizado para devolver el
 *  Date entero (no solo el string "DD/M") — lo necesita el calendario
 *  de "Tareas asignadas" (calendarioDiasHtml) para ubicar cada día de
 *  ESTA semana en la grilla del mes real. */
function fechaObjDiaSemana(nombreDia) {
    const hoy = new Date();
    const idxVisualHoy = (hoy.getDay() + 6) % 7; // Date.getDay(): domingo=0 → acá lunes=0
    const idxVisualObjetivo = DIAS_VISUAL.indexOf(nombreDia);
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + (idxVisualObjetivo - idxVisualHoy));
    fecha.setHours(0, 0, 0, 0);
    return fecha;
}

/** Nombre de día de semana → día-del-mes (string), SOLO para los días
 *  de ESTA semana que caen en el mes actual — ej. {Miércoles:"2",
 *  Jueves:"3", ...}. Base para panelParaTareaYDia() de acá abajo. */
function fechaDelMesPorDiaSemanaEstaSemana() {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();
    const mapa = {};
    DIAS_VISUAL.forEach((nombre) => {
        const f = fechaObjDiaSemana(nombre);
        if (f.getFullYear() === anio && f.getMonth() === mes) mapa[nombre] = String(f.getDate());
    });
    return mapa;
}

/** En qué [data-panel-dia] vive REALMENTE una tarea+día — para una
 *  semanal, el propio nombre de día, sin cambios. Para una MENSUAL
 *  cuyo día-del-mes cae dentro de ESTA semana, el nombre de ESE día de
 *  semana — se mezcla ahí, no en un panel de mes aparte.
 *
 * Bug real reportado en vivo (2026-09-02, con video): una tarea
 * mensual asignada a "hoy" (o a cualquier día de esta semana) no
 * aparecía en ningún lado alcanzable — el calendario ya hace apuntar
 * ese día al panel SEMANAL (ver calendarioDiasHtml, nombrePorNumeroDia
 * gana con el `||`), pero la tarjeta de la tarea mensual se seguía
 * armando en un panel de MES aparte, con una clave distinta
 * (data-panel-dia="2" en vez de "Miércoles") — invisible porque nada
 * apuntaba ahí. Un día del mes que NO cae en esta semana (ej. el 29)
 * sí funcionaba, porque para ese caso el calendario apunta
 * directamente al panel de mes real.
 *
 * El "dia" que se usa para guardar/leer el check (ver tareaHtml,
 * actualizarCheckGestion) NUNCA cambia acá — sigue siendo el día del
 * mes real para una mensual; esta función solo decide DÓNDE vive la
 * tarjeta en el DOM, no la clave con la que se guarda su estado. */
function panelParaTareaYDia(tarea, dia) {
    if (tarea.frecuencia !== "mensual") return dia;
    const mapa = fechaDelMesPorDiaSemanaEstaSemana();
    return Object.keys(mapa).find((nombre) => mapa[nombre] === String(dia)) || dia;
}

const MESES_CALENDARIO_GESTION = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Calendario de mes para "Tareas asignadas" — reemplaza la fila de
 *  pills que mezclaba nombre de día de semana ("Lunes 24/8") con
 *  número de día del mes ("5/9") en una sola fila. Pedido explícito
 *  (2026-09-02, con captura real): "no se entiende qué día es",
 *  debería verse "tipo calendario del mes".
 *
 * Siempre el mes ACTUAL — no hay "otro mes" que ejecutar acá: lo ya
 * cerrado vive en Histórico, de solo lectura (con su propio selector
 * de mes). El calendario no cambia qué días le tocan a cada tarea
 * (eso lo sigue decidiendo "Asignar tareas", sin cambios) — es solo
 * una forma más clara de navegar los mismos paneles que ya existían.
 *
 * Punto dorado = ese día tiene un panel real para mostrar: es uno de
 * los 7 días de ESTA semana (las tareas semanales siempre tienen
 * panel, aunque esté vacío ese día puntual) o es un día de ESTE mes
 * con alguna tarea mensual asignada (diasMesConContenido). Cualquier
 * otro día del mes queda sin punto y deshabilitado — no existe ningún
 * panel al que llevarlo. */
function calendarioDiasHtml(diasMesConContenido, diaClaveActivo) {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();
    const hoyNum = hoy.getDate();

    // Día del mes (número) → nombre de día de semana, solo para los 7
    // días de la semana que contiene a "hoy" y caen en este mismo mes
    // (una semana a caballo de fin de mes deja algunos de esos 7 días
    // en el mes anterior/siguiente — esos simplemente no aparecen acá,
    // el calendario solo dibuja EL MES actual).
    const nombrePorNumeroDia = {};
    DIAS_VISUAL.forEach((nombre) => {
        const f = fechaObjDiaSemana(nombre);
        if (f.getFullYear() === anio && f.getMonth() === mes) {
            nombrePorNumeroDia[f.getDate()] = nombre;
        }
    });

    const primerDiaVisual = (new Date(anio, mes, 1).getDay() + 6) % 7; // lunes=0
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();

    let celdas = "";
    for (let i = 0; i < primerDiaVisual; i++) celdas += `<span class="calendario-gestion-relleno"></span>`;
    for (let d = 1; d <= ultimoDia; d++) {
        const clave = nombrePorNumeroDia[d] || (diasMesConContenido.includes(String(d)) ? String(d) : "");
        const clases = ["calendario-gestion-dia"];
        if (d === hoyNum) clases.push("hoy");
        if (clave) clases.push("con-tareas");
        if (clave && clave === diaClaveActivo) clases.push("activo");
        celdas += clave
            ? `<button type="button" class="${clases.join(" ")}" data-vista-dia="${clave}">${d}</button>`
            : `<span class="${clases.join(" ")}">${d}</span>`;
    }

    return `
        <div class="calendario-gestion-mes">${MESES_CALENDARIO_GESTION[mes]} ${anio}</div>
        <div class="calendario-gestion-encabezado">
            <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
        </div>
        <div class="calendario-gestion-grilla" id="calendario-dias-gestion">${celdas}</div>
    `;
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
 *  asignadas" (calendarioDiasHtml, cuerpoGestionHtml), que es donde se
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
/** Firma ("Nombre · HH:MM") de quién marcó ESE sub-ítem puntual, si la
 *  hay — pedido explícito 2026-08-31: "que cada uno marca lo que le
 *  corresponde" quede a la vista, no solo el nombre de quien cerró la
 *  tarea entera. Vacío si nunca se guardó nada para este índice. */
function firmaSubitemHtml(firmas, is) {
    const firma = firmas?.get(String(is));
    if (!firma?.nombre) return "";
    return `<span class="subitem-firma">${escaparHtml(firma.nombre)}${firma.hora ? ` · ${firma.hora}` : ""}</span>`;
}

function subitemFilaHtml(id, is, subitemsRaw, marcados, firmas = new Map(), bloqueada = false) {
    const raw = subitemsRaw[is];
    const marca = marcados.get(String(is));
    const { titulo, tipo, motivos } = parsearSubitem(raw);
    const soloLectura = esVistaLectura || bloqueada;
    const firmaHtml = firmaSubitemHtml(firmas, is);

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
            <div class="subitem-numerico ${incidencia ? "incidencia" : "ok"}" data-subitem-tipo="numerico" data-subitem-indice="${is}" data-signo="${signo}" data-tocado="${tieneMarca ? "1" : "0"}">
                <span>${escaparHtml(titulo)}</span>
                ${firmaHtml}
                <div class="subitem-numerico-control">
                    <div class="signo-toggle">
                        <button type="button" class="signo-btn cuadra${incidencia ? "" : " activo"}" data-accion-cuadra${soloLectura ? " disabled" : ""}>Cuadra</button>
                        <button type="button" class="signo-btn falta${incidencia && signo === "-" ? " activo" : ""}" data-signo="-"${soloLectura ? " disabled" : ""}>Falta</button>
                        <button type="button" class="signo-btn sobra${incidencia && signo === "+" ? " activo" : ""}" data-signo="+"${soloLectura ? " disabled" : ""}>Sobra</button>
                    </div>
                    <div class="subitem-numerico-campo">
                        <span>$</span>
                        <input type="text" inputmode="decimal" class="input-numerico-subitem"${soloLectura ? " disabled" : ""} placeholder="0" value="${formatearMontoInput(magnitud)}">
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
                ${firmaHtml}
                <div class="estados2">
                    <button type="button" class="estado2-btn si${estado === "si" ? " activo" : ""}" data-estado="si"${soloLectura ? " disabled" : ""}>Hecho</button>
                    <button type="button" class="estado2-btn no${estado === "no" ? " activo" : ""}" data-estado="no"${soloLectura ? " disabled" : ""}>No hecho</button>
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
                    ${firmaHtml}
                    <div class="estados3">
                        <button type="button" class="estado-btn ok${estado === "ok" ? " activo" : ""}" data-estado="ok"${soloLectura ? " disabled" : ""} aria-label="OK">✓</button>
                        <button type="button" class="estado-btn incidencia${estado === "inc" ? " activo" : ""}" data-estado="inc"${soloLectura ? " disabled" : ""} aria-label="Incidencia">!</button>
                        <button type="button" class="estado-btn grave${estado === "grave" ? " activo" : ""}" data-estado="grave"${soloLectura ? " disabled" : ""} aria-label="Incidencia grave">✕</button>
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
            <input type="checkbox" id="${id}-${is}" class="subitem-gestion-check"${soloLectura ? " disabled" : ""}${marca ? " checked" : ""}>
            <span>${escaparHtml(titulo)}</span>
            ${firmaHtml}
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

/** true si `dia` (nombre de día de semana, o número de día del mes)
 *  es el día real de HOY. "Tareas asignadas" solo muestra la semana o
 *  el mes en curso (nunca otro), así que comparar directo contra el
 *  nombre/número de hoy alcanza — no hace falta reconstruir una fecha
 *  completa como si esto fuera Histórico. Mismo corte a las 04:00 (no
 *  medianoche) que el resto del ciclo (ver cicloDeFecha en
 *  gestionCiclo.js) — de 00:00 a 04:00 todavía se considera "ayer" a
 *  todo efecto, para poder seguir marcando el cierre de la noche de
 *  madrugada. Espejo de _esDiaDeHoyGestion en Code.gs. */
function esDiaDeHoyGestion(dia) {
    const efectiva = new Date(Date.now() - 4 * 60 * 60 * 1000);
    return dia === DIAS_VISUAL[(efectiva.getDay() + 6) % 7] || dia === String(efectiva.getDate());
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
    // Candado (2026-08-31): una tarea guardada completa queda cerrada
    // — no se puede volver a tocar salvo que un Admin la reabra (ver
    // bannerCerradaHtml, reabrirTareaGestion).
    // Día equivocado (2026-09-02): pedido explícito — "no debería
    // dejar marcar si no estás en el día, ni antes ni después".
    // Algunos Responsables tocaban un día futuro de la semana/mes "para
    // probar", dejando marcas falsas. Nadie en modo lectura (Admin/
    // Supervisor) llega nunca a esta rama — ver esVistaLectura arriba.
    const diaEquivocado = !esVistaLectura && !check?.cerrada && !esDiaDeHoyGestion(dia);
    const bloqueada = !!check?.cerrada || diaEquivocado;

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

    // Candado rojo de Admin (2026-09-02, maqueta aprobada): "un
    // candado en cada tarea para borrar los datos del sheet desde la
    // app, en vez de entrar al sheet y borrar" — "Limpiar marcas
    // futuras" no servía para esto porque solo toca días A FUTURO,
    // nunca la tarea real del día. Visible en CUALQUIER tarea con
    // algo marcado (completa o a medias), solo para Admin.
    const puedeBorrarCheck = !!check && esAdminActual();
    const btnBorrarCheck = puedeBorrarCheck
        ? `<button type="button" class="btn-borrar-check-admin" data-borrar-check data-tarea-id="${t.id}" data-dia="${dia}" title="Borrar este registro (Admin)" aria-label="Borrar este registro">${Icon("tacho", { size: 15 })}</button>`
        : "";

    if (t.subitems) {
        const marcados = check?.marcas || new Map();
        const firmas = check?.firmas || new Map();
        return `
            <div class="tarea-gestion tarea-gestion-desplegable${check?.hecho ? " hecha" : ""}${bloqueada ? " bloqueada" : ""}${puedeBorrarCheck ? " con-borrar-admin" : ""}" data-desplegable${atrId}>
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
                ${btnBorrarCheck}
                ${bannerCerradaHtml(check, t.id, dia, diaEquivocado)}
                <div class="tarea-gestion-subitems" data-subitems>
                    ${t.subitems.map((s, is) => subitemFilaHtml(id, is, t.subitems, marcados, firmas, bloqueada)).join("")}
                </div>
                ${(esVistaLectura || bloqueada) ? "" : `
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
        <div class="tarea-gestion tarea-gestion-simple${check?.hecho ? " hecha" : ""}${bloqueada ? " bloqueada" : ""}${puedeBorrarCheck ? " con-borrar-admin" : ""}"${atrId}>
            <label class="tarea-gestion-label" for="${id}">
                <input type="checkbox" id="${id}" class="tarea-gestion-check"${(esVistaLectura || bloqueada) ? " disabled" : ""}${check?.hecho ? " checked" : ""}>
                <span class="tarea-gestion-ico">${Icon(t.icono, { size: 18 })}</span>
                <span class="tarea-gestion-txt">
                    <strong>${t.titulo}</strong>
                    <span>${t.detalle}</span>
                    <span class="tarea-gestion-hora" data-hora>${hechoTexto}</span>
                </span>
            </label>
            ${btnBorrarCheck}
            ${bannerCerradaHtml(check, t.id, dia)}
            ${accionesTareaHtml()}
        </div>
        ${pushWrapHtml}
    `;
}

/** Banner + "Reabrir" (solo Admin) de una tarea CERRADA (candado, ver
 *  actualizarCheckGestion) — pedido explícito 2026-08-31: "una vez que
 *  guarda no podrá hacer cambios". Sin "Reabrir" un cierre por error
 *  quedaría trabado para siempre; por eso es la única excepción, y
 *  solo para Admin (esAdminActual(), mismo gate que Editar/Eliminar
 *  tarea). */
function bannerCerradaHtml(check, tareaId, dia, diaEquivocado) {
    if (diaEquivocado) {
        return `
            <div class="tarea-gestion-banner-cerrada">
                ${Icon("candado", { size: 14 })}
                <span>Solo se puede marcar el día que corresponde — no antes ni después.</span>
            </div>
        `;
    }
    if (!check?.cerrada) return "";
    const reabrirBtn = esAdminActual()
        ? `<button type="button" class="btn-reabrir-tarea" data-reabrir-tarea data-tarea-id="${tareaId}" data-dia="${dia}">${Icon("candado", { size: 13 })} Reabrir</button>`
        : "";
    return `
        <div class="tarea-gestion-banner-cerrada">
            ${Icon("candado", { size: 14 })}
            <span>Cerrada por ${escaparHtml(check.cerradaPor || "")}${check.cerradaHora ? ` · ${check.cerradaHora}` : ""} — ya no se puede modificar.</span>
            ${reabrirBtn}
        </div>
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
/** Ícono actual + toda la fila de opciones — pedido explícito
 *  (2026-09-02, maqueta aprobada): "tema iconos deben ser imagen no
 *  palabras". El <select> de antes listaba SOLO el nombre ("Limpieza",
 *  "Caja / pedido"); acá cada opción es el ícono real (Icon()), con el
 *  nombre como title/aria-label para quien lo necesite. El valor
 *  elegido sigue viviendo en un <input type="hidden"> — leerCamposTarea
 *  no cambia, solo cambia CÓMO se elige. */
function selectorIconoTareaHtml(iconoActual) {
    const valorInicial = iconoActual || ICONOS_TAREA[0].valor;
    return `
        <input type="hidden" id="input-tarea-icono" value="${valorInicial}">
        <div class="selector-icono-tarea" id="selector-icono-tarea">
            ${ICONOS_TAREA.map((i) => `
                <button type="button" class="icono-tarea-opcion${i.valor === valorInicial ? " activo" : ""}" data-icono="${i.valor}" title="${i.label}" aria-label="${i.label}">${Icon(i.valor, { size: 18 })}</button>
            `).join("")}
        </div>
    `;
}

function contenidoModalTarea({ tarea } = {}) {
    const iconoActual = tarea?.icono || ICONOS_TAREA[0].valor;
    return `
        <div class="tarea-modal-header">
            <div class="tarea-modal-icono-preview" id="tarea-modal-icono-preview">${Icon(iconoActual, { size: 20 })}</div>
            <div class="tarea-modal-titulo-wrap">
                <label>Título
                    <textarea id="input-tarea-titulo" rows="1" placeholder="Ej: Inventario">${escaparHtml(tarea?.titulo || "")}</textarea>
                </label>
            </div>
        </div>
        <label>Detalle (opcional, una línea)
            <textarea id="input-tarea-detalle" rows="1" placeholder="Ej: Antes de armar el pedido a fábrica.">${escaparHtml(tarea?.detalle || "")}</textarea>
        </label>
        <label>Ícono
            ${selectorIconoTareaHtml(iconoActual)}
        </label>
        <div class="tarea-modal-grupo">
            <p class="tarea-modal-grupo-titulo">Sub-tareas</p>
            <label class="campo-subtareas-nueva">
                <div id="lista-subtareas-nueva">${(tarea?.subitems || []).map(subtareaNuevaFilaHtml).join("")}</div>
                <button type="button" class="btn-agregar-subtarea-nueva" id="btn-agregar-subtarea-nueva">+ Agregar sub-tarea</button>
                <!-- "Cargar varias de una" — pedido explícito: una tarea
                     tipo "Checklist diaria" con 10 sub-tareas, armar cada
                     fila a mano una por una era demasiado. Pegar una por
                     línea y agregarlas todas juntas, cada una como "2
                     estados" (Hecho/No hecho) por default — se puede
                     cambiar el tipo de cada fila después, individual,
                     como cualquier otra. -->
                <details class="detalle-carga-masiva-subtareas">
                    <summary>Cargar varias de una (pegar, una por línea)</summary>
                    <textarea id="input-subtareas-pegadas" rows="4" placeholder="Orden de cámara
Orden de depósito
Limpieza profunda de deck"></textarea>
                    <button type="button" class="btn btn-secondary" id="btn-agregar-subtareas-pegadas">Agregar estas líneas</button>
                </details>
            </label>
        </div>
        <div class="tarea-modal-grupo">
            <p class="tarea-modal-grupo-titulo">Alcance y recordatorio</p>
            <label>¿A quién le aplica? (vacío = a todos)
                ${MultiSelectAlcance("input-tarea-alcance", tarea?.aplicaA || "")}
            </label>
            <label class="campo-recordatorio-tarea">
                <span class="check-recordatorio-tarea-label">
                    <input type="checkbox" id="input-tarea-recordatorio-habilitado" class="tarea-modal-toggle-input"${tarea?.recordatorioHabilitado === "NO" ? "" : " checked"}>
                    <span class="tarea-modal-toggle-switch" aria-hidden="true"></span>
                    Recordatorio automático habilitado
                </span>
                <select id="input-tarea-recordatorio-hora">
                    <option value="">Usar el horario general</option>
                    ${Array.from({ length: 24 }, (_, h) => `<option value="${h}"${String(h) === String(tarea?.recordatorioHora ?? "") ? " selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}
                </select>
            </label>
        </div>
    `;
}

function bindModalTarea() {
    const listaSubtareas = document.getElementById("lista-subtareas-nueva");

    document.getElementById("btn-agregar-subtarea-nueva").addEventListener("click", () => {
        listaSubtareas.insertAdjacentHTML("beforeend", subtareaNuevaFilaHtml());
    });

    document.getElementById("btn-agregar-subtareas-pegadas").addEventListener("click", () => {
        const textarea = document.getElementById("input-subtareas-pegadas");
        const titulos = textarea.value.split("\n").map((t) => t.trim()).filter(Boolean);
        if (!titulos.length) return;
        titulos.forEach((titulo) => {
            listaSubtareas.insertAdjacentHTML("beforeend", subtareaNuevaFilaHtml(serializarSubitem({ titulo, tipo: TIPOS_SUBITEM.ESTADO2, motivos: [] })));
        });
        textarea.value = "";
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

    // Selector de íconos como imágenes — un click elige, pisa el
    // <input type="hidden"> que sigue leyendo leerCamposTarea(), y
    // refresca el preview grande de al lado del título.
    document.getElementById("selector-icono-tarea")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".icono-tarea-opcion");
        if (!btn) return;
        document.getElementById("input-tarea-icono").value = btn.dataset.icono;
        document.querySelectorAll("#selector-icono-tarea .icono-tarea-opcion").forEach((b) => b.classList.toggle("activo", b === btn));
        const preview = document.getElementById("tarea-modal-icono-preview");
        if (preview) preview.innerHTML = Icon(btn.dataset.icono, { size: 20 });
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
    // También borra la fila de Push+Exportar (.tarea-gestion-push,
    // sibling suelto, no hijo de la tarjeta — sin esto quedaba
    // huérfana en el DOM cada vez que una tarea cambiaba de día).
    document.querySelectorAll(`.tarea-gestion[data-tarea-id="${idTarea}"]:not(.fila-aplica-tarea), .tarea-gestion-push[data-tarea-id="${idTarea}"]`).forEach((n) => n.remove());
    // dias vacío = "sin usar" — el .forEach de abajo simplemente no
    // agrega ninguna copia, no hace falta un guard aparte.
    tarea.dias.forEach((d) => {
        // Una mensual cuyo día cae dentro de esta semana vive en el
        // panel SEMANAL de ese día, no en uno de mes aparte — ver
        // panelParaTareaYDia. "d" (la clave real de guardado) no
        // cambia, solo dónde se busca/inserta la tarjeta.
        const panel = panelParaTareaYDia(tarea, d);
        let lista = document.querySelector(`[data-panel-dia="${panel}"] .lista-tareas-gestion`);
        if (!lista) {
            // Día del mes que NINGUNA tarea usaba todavía — su panel
            // nunca se llegó a construir en el render inicial (solo
            // se arman paneles para diasMesConContenido de ESE
            // momento). Sin esto, la tarjeta quedaba sin ningún lugar
            // donde aparecer hasta recargar la página entera (bug
            // real reportado en vivo, 2026-09-02, con video). Los
            // paneles semanales (Lunes..Domingo) SIEMPRE existen desde
            // el inicio, así que esta rama en la práctica solo se
            // ejecuta para un día-del-mes nuevo.
            const contenedor = document.getElementById("contenido-gestion-imprimible");
            if (!contenedor) return;
            const tituloPanel = tarea.frecuencia === "mensual" ? `${panel}/${new Date().getMonth() + 1}` : `${panel} ${fechaDelDiaSemana(panel)}`;
            contenedor.insertAdjacentHTML("beforeend", `
                <div class="section" data-panel-dia="${panel}" style="display:none">
                    <h3>${tituloPanel}</h3>
                    <div class="lista-tareas-gestion"></div>
                </div>
            `);
            lista = contenedor.querySelector(`[data-panel-dia="${panel}"] .lista-tareas-gestion`);
            if (!lista) return;
        }
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
    // Un día-del-mes nuevo (o sacado) en una tarea MENSUAL tiene que
    // verse reflejado en el calendario de "Tareas asignadas" — sin
    // esto el punto nuevo recién aparecía recargando la página entera
    // (reportado en vivo, 2026-09-02). No-op si el calendario no está
    // en pantalla ahora mismo (ver actualizarCalendarioGestion).
    actualizarCalendarioGestion();
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
/** Pura extracción de campos — sin validar ni guardar. Separada de
 *  confirmarTarea() para que el carrusel de edición (abrirCarruselTareas)
 *  pueda comparar "¿cambió algo?" sin necesidad de tocar el backend,
 *  mismo criterio que leerCamposPregunta()/validarPregunta() en
 *  evaluaciones.js. */
function leerCamposTarea(idEditado) {
    const titulo = document.getElementById("input-tarea-titulo").value.trim();
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
    // Recordatorio por tarea (2026-08-31, pedido explícito: "el tema
    // push quiero que sea por tarea") — reemplaza el horario único de
    // antes. "hora" en blanco = usa el horario general (ver
    // obtenerHorarioRecordatorioGestion/tarjeta "Recordatorio
    // automático" en Asignar tareas), que ahora funciona como default
    // para las tareas que no eligieron uno propio.
    const recordatorioHabilitado = document.getElementById("input-tarea-recordatorio-habilitado")?.checked ? "SI" : "NO";
    const recordatorioHora = document.getElementById("input-tarea-recordatorio-hora")?.value || "";
    return { icono, titulo, detalle, aplicaA, noAplicaA, recordatorioHabilitado, recordatorioHora, ...(subitems.length ? { subitems } : {}) };
}

/** null = está todo bien. Única regla real hoy: el título es
 *  obligatorio (mismo mensaje que ya usaba confirmarTarea). */
function validarTarea({ titulo }) {
    if (!titulo) return "Ponele un título a la tarea antes de guardar.";
    return null;
}

async function confirmarTarea(idEditado = null) {
    const datos = leerCamposTarea(idEditado);
    const error = validarTarea(datos);
    if (error) {
        alert(error);
        return false;
    }

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

/** Abre el modal de "+ Nueva tarea" — editar una existente va por
 *  abrirCarruselTareas() más abajo, no por acá. */
function abrirModalTarea() {
    const idModal = "modal-tarea";
    abrirModal(
        Modal({ id: idModal, titulo: "Nueva tarea", contenidoHtml: contenidoModalTarea({}), textoConfirmar: "Guardar" }),
        idModal,
        async () => {
            const ok = await confirmarTarea(null);
            if (!ok) return;
            cerrarModal(idModal);
        },
    );
    bindModalTarea();
}

/** Editar el catálogo de tareas como un carrusel — Anterior/Siguiente
 *  sin cerrar y reabrir un modal por cada una, mismo patrón ya usado
 *  en evaluaciones.js (abrirCarruselPreguntas) — pedido explícito
 *  (2026-09-02): "así no tengo que entrar y salir a cada rato como
 *  tenemos en la app". El orden a recorrer es el DEL CATÁLOGO EN
 *  PANTALLA en ese momento (Mensuales → Semanales en uso → Sin usar,
 *  o el orden plano de TAREAS sin local elegido) — se lee del propio
 *  DOM en vez de reconstruir esa agrupación acá, así el carrusel
 *  siempre navega en el mismo orden que el usuario ya está viendo.
 *
 * Se guarda solo, sin preguntar, la que se está por dejar atrás — pero
 * SOLO si algo cambió; si no se tocó nada, navegar no gasta un
 * guardado de más. "Guardar cambios" cubre quedarse en una sola tarea
 * sin moverse. */
function abrirCarruselTareas(idInicial) {
    const modalId = "modal-carrusel-tareas";
    let orden = Array.from(document.querySelectorAll("#lista-aplica-tareas [data-editar-tarea]"))
        .map((btn) => btn.closest(".tarea-gestion")?.dataset.tareaId)
        .filter(Boolean);
    // Por si "Editar" se tocó desde algún otro lugar que no sea el
    // catálogo (no debería pasar hoy, pero un orden vacío no debe
    // romper el carrusel) — al menos la tarea que se pidió editar.
    if (!orden.includes(idInicial)) orden = [idInicial];
    let indice = orden.indexOf(idInicial);
    let valoresAlMostrar = null;

    function huboCambios() {
        return JSON.stringify(leerCamposTarea(orden[indice])) !== valoresAlMostrar;
    }

    async function guardarActual() {
        const ok = await confirmarTarea(orden[indice]);
        return ok;
    }

    function mostrar() {
        const idActual = orden[indice];
        const tarea = registroTareas.get(idActual);
        // Puntos de progreso — maqueta aprobada 2026-09-02. Con más de
        // 10 tareas en el catálogo, 20+ puntitos sería ruido visual sin
        // decir nada más que el número ya dice — se cae solo a la
        // etiqueta de texto en ese caso.
        const puntosHtml = orden.length <= 10
            ? `<div class="carrusel-tarea-puntos">${orden.map((_, i) => `<span class="carrusel-tarea-punto${i === indice ? " activo" : ""}"></span>`).join("")}</div>`
            : "";
        const contenidoHtml = `
            <div class="carrusel-tarea-nav">
                <button type="button" class="carrusel-tarea-nav-flecha" id="btn-tarea-anterior" ${indice === 0 ? "disabled" : ""} aria-label="Tarea anterior">‹</button>
                <div class="carrusel-tarea-nav-centro">
                    ${puntosHtml}
                    <p class="carrusel-tarea-nav-etiqueta">Tarea ${indice + 1} de ${orden.length}</p>
                </div>
                <button type="button" class="carrusel-tarea-nav-flecha${indice === orden.length - 1 ? "" : " destacada"}" id="btn-tarea-siguiente" ${indice === orden.length - 1 ? "disabled" : ""} aria-label="Tarea siguiente">›</button>
            </div>
            ${contenidoModalTarea({ tarea })}
            <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">
                <button type="button" class="btn btn-secondary" id="btn-eliminar-tarea-actual">Eliminar esta tarea</button>
                <button type="button" class="btn btn-primary" id="btn-guardar-tarea-actual">Guardar cambios</button>
            </div>
        `;

        // textoConfirmar vacío a propósito: la navegación/guardado de
        // este modal es toda propia (Anterior/Siguiente/Guardar), no el
        // botón único de abrirModal.
        abrirModal(Modal({ id: modalId, titulo: "Editar tareas", contenidoHtml, textoConfirmar: "" }), modalId);
        bindModalTarea();
        valoresAlMostrar = JSON.stringify(leerCamposTarea(idActual));

        document.getElementById("btn-tarea-anterior")?.addEventListener("click", () => moverA(indice - 1));
        document.getElementById("btn-tarea-siguiente")?.addEventListener("click", () => moverA(indice + 1));

        document.getElementById("btn-guardar-tarea-actual").addEventListener("click", async (e) => {
            const boton = e.currentTarget;
            boton.disabled = true;
            boton.textContent = "Guardando...";
            const ok = await guardarActual();
            boton.disabled = false;
            boton.textContent = "Guardar cambios";
            if (ok) valoresAlMostrar = JSON.stringify(leerCamposTarea(idActual));
        });

        document.getElementById("btn-eliminar-tarea-actual").addEventListener("click", async () => {
            const idABorrar = idActual;
            await eliminarTarea(idABorrar);
            // eliminarTarea() ya pide confirm() y avisa si falla — si el
            // registro sigue existiendo, no se confirmó/no se pudo borrar.
            if (registroTareas.get(idABorrar)) return;
            orden.splice(indice, 1);
            if (!orden.length) { cerrarModal(modalId); return; }
            if (indice >= orden.length) indice = orden.length - 1;
            cerrarModal(modalId);
            mostrar();
        });
    }

    async function moverA(nuevoIndice) {
        if (nuevoIndice < 0 || nuevoIndice >= orden.length) return;
        if (huboCambios()) {
            const ok = await guardarActual();
            if (!ok) return; // se queda en la actual para que corrija
        }
        indice = nuevoIndice;
        cerrarModal(modalId);
        mostrar();
    }

    mostrar();
}

/** "+ Cargar varias" — pedido explícito con captura real: una lista
 *  larga de títulos ("Orden de cámara / Orden de depósito / ..."),
 *  armar cada una a mano en el modal de "+ Nueva tarea" era demasiado
 *  lento. Un título por línea; cada una nace con UN sub-ítem "2
 *  estados" (Hecho/No hecho) — "todas van a tener hecho/no hecho".
 *  Sin ícono/detalle propio por línea (YAGNI, nadie lo pidió) —
 *  quien quiera afinar una en particular la edita después, ya
 *  individual, con el lápiz de siempre. */
function abrirModalCargaMasiva() {
    const idModal = "modal-carga-masiva-tareas";
    const contenidoHtml = `
        <p style="margin:0 0 12px;color:var(--muted);font-size:13.5px;">
            Un título por línea. Cada una se crea con un sub-ítem "Hecho / No hecho" —
            después la podés editar si necesita algo más específico.
        </p>
        <textarea id="input-carga-masiva-titulos" rows="10" placeholder="Orden de cámara
Orden de depósito
Limpieza profunda de deck" style="width:100%;box-sizing:border-box;resize:vertical;"></textarea>
    `;
    abrirModal(
        Modal({ id: idModal, titulo: "Cargar varias tareas", contenidoHtml, textoConfirmar: "Crear todas" }),
        idModal,
        async () => {
            const textarea = document.getElementById("input-carga-masiva-titulos");
            const titulos = textarea.value.split("\n").map((t) => t.trim()).filter(Boolean);
            if (!titulos.length) {
                alert("Pegá al menos un título, uno por línea.");
                return;
            }
            // Secuencial, no en paralelo — mismo criterio que el resto de
            // guardados contra Apps Script en esta página: más lento pero
            // no bombardea el backend con 10 escrituras a la vez.
            const fallidas = [];
            for (const titulo of titulos) {
                const nueva = await crearTareaBackend({
                    icono: "documento",
                    titulo,
                    detalle: "",
                    aplicaA: "",
                    noAplicaA: "",
                    subitems: [serializarSubitem({ titulo: "Estado", tipo: TIPOS_SUBITEM.ESTADO2, motivos: [] })],
                });
                if (!nueva) { fallidas.push(titulo); continue; }
                nueva.dias = [];
                nueva.frecuencia = "semanal";
                registroTareas.set(nueva.id, nueva);
                TAREAS.push(nueva);
                recrearTareaEnPaneles(nueva.id);
            }
            if (fallidas.length) {
                alert(`Se crearon ${titulos.length - fallidas.length} de ${titulos.length}. No se pudieron crear: ${fallidas.join(", ")}`);
                // Deja en el textarea SOLO lo que falló — si se reintenta,
                // no vuelve a crear duplicado lo que ya se creó bien.
                textarea.value = fallidas.join("\n");
                return;
            }
            cerrarModal(idModal);
        },
    );
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
    // "+ Cargar varias" — pedido explícito: tenía una lista de 10
    // tareas para cargar y armar el modal una por una era demasiado.
    // Un título por línea, todas quedan como "2 estados" (Hecho/No
    // hecho) — ver abrirModalCargaMasiva.
    const botonNueva = esAdminActual() ? `
        <button type="button" class="btn btn-primary" id="btn-nueva-tarea">
            + Nueva tarea
        </button>
        <button type="button" class="btn btn-secondary" id="btn-carga-masiva-tareas">
            + Cargar varias
        </button>
    ` : "";
    const acciones = botonNueva ? `<div class="acciones-gestion-semanal">${botonNueva}</div>` : "";
    // Recordatorio automático — horario configurable (2026-08-31,
    // pedido explícito, maqueta confirmada), antes fijo a las 10am.
    // Es un ajuste GLOBAL de toda la red (no por local), por eso vive acá
    // arriba, junto a "+ Nueva tarea" — no depende de haber elegido un
    // local. El valor real se trae async (ver bindCuerpoGestion) y
    // reemplaza el placeholder "10:00" apenas llega.
    const cardRecordatorio = esAdminActual() ? `
        <div class="card-recordatorio-gestion">
            <div class="card-recordatorio-header">
                ${Icon("campana", { size: 16 })}
                <span>Recordatorio automático</span>
                <span class="badge-solo-admin">Solo Admin</span>
            </div>
            <p class="card-recordatorio-desc">Horario general para las tareas que no tengan uno propio — cada tarea puede elegir el suyo (o apagar el recordatorio) en "+ Nueva tarea" / "Editar".</p>
            <div class="card-recordatorio-control">
                <select id="select-horario-recordatorio">
                    ${Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}:00</option>`).join("")}
                </select>
                <button type="button" class="btn btn-primary" id="btn-guardar-horario-recordatorio">Guardar</button>
            </div>
        </div>
    ` : "";

    const hayLocal = !esVistaLectura || !!sucursalActiva;
    // "Histórico" (2026-08-31) — Responsable de local siempre (va
    // directo a la suya); Admin/Supervisor solo después de elegir un
    // local en el selector (mismo criterio que "Tareas asignadas").
    // Responsable de turno NO tiene acceso — decisión explícita.
    const puedeVerHistorico = usuarioEncargadoActivo || (esVistaLectura && !!sucursalActiva);

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
            ${cardRecordatorio}
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
    // Solo los días del mes que YA tienen algo asignado — nadie
    // necesita navegar 31 pills, la mayoría vacías, para encontrar la
    // única tarea mensual real.
    const diasMesConContenido = [...new Set(tareasMensuales.flatMap((t) => t.dias))].sort((a, b) => Number(a) - Number(b));

    // Día activo al entrar: el que ya estaba elegido (ej. se cambió de
    // local sin recargar la página) si sigue siendo válido, si no HOY
    // — antes acá no se preseleccionaba nada y la pantalla arrancaba
    // sin ningún panel visible hasta el primer toque. El nombre de
    // día de HOY (Lunes..Domingo) siempre resuelve a un panel real,
    // aunque esté vacío.
    const hoyClaveSemana = DIAS_VISUAL[(new Date().getDay() + 6) % 7];
    const hoyClaveFecha = new Date().toDateString();
    // Si cambió el día real desde la última vez (pestaña que quedó
    // abierta de una fecha para otra), se fuerza HOY sin importar qué
    // día había quedado elegido — "Domingo" seguiría siendo "válido"
    // para siempre si no se chequeara esto aparte.
    if (fechaDiaActivo !== hoyClaveFecha || !diaActivo || !(DIAS_VISUAL.includes(diaActivo) || diasMesConContenido.includes(diaActivo))) {
        diaActivo = hoyClaveSemana;
        fechaDiaActivo = hoyClaveFecha;
    }

    // items[panel] = [{tarea, dia}] — "dia" es SIEMPRE la clave real
    // de guardado (nombre de día para semanal, día-del-mes para
    // mensual); "panel" es DÓNDE vive la tarjeta (panelParaTareaYDia
    // los redirige al panel semanal cuando coinciden en esta semana).
    // Se arma una sola vez acá para semanales Y mensuales por igual,
    // en vez de dos .map() separados como antes — eso es justo lo que
    // dejaba a una mensual de esta semana en un panel sin nadie
    // apuntándole (bug real, ver panelParaTareaYDia).
    const itemsPorPanel = {};
    const agregarItem = (panel, tarea, dia) => {
        (itemsPorPanel[panel] || (itemsPorPanel[panel] = [])).push({ tarea, dia });
    };
    tareasSemanales.forEach((t) => t.dias.forEach((d) => agregarItem(panelParaTareaYDia(t, d), t, d)));
    tareasMensuales.forEach((t) => t.dias.forEach((d) => agregarItem(panelParaTareaYDia(t, d), t, d)));

    const panelHtml = (panel, titulo, items) => `
        <div class="section" data-panel-dia="${panel}"${panel === diaActivo ? "" : ' style="display:none"'}>
            <h3>${titulo}</h3>
            <div class="lista-tareas-gestion">
                ${items.length ? items.map(({ tarea, dia }) => tareaHtml(tarea, `${tarea.id}-${dia}`, dia)).join("") : avisoDiaVacioHtml()}
            </div>
        </div>
    `;

    // DIAS_VISUAL (lunes primero) acá — "Tareas asignadas" es donde SÍ
    // importa la fecha real (se ejecuta/exporta un día puntual, ver la
    // nota en diasControlHtml), pedido explícito: "quiero cambiar la
    // semana que sea de lunes a domingo".
    const mesActual = new Date().getMonth() + 1;
    const panelesSemanalesHtml = DIAS_VISUAL.map((d) => panelHtml(d, `${d} ${fechaDelDiaSemana(d)}`, itemsPorPanel[d] || [])).join("");
    // Los días de "diasMesConContenido" que ya se mezclaron arriba (su
    // día-del-mes cae en esta semana) no necesitan un panel de mes
    // aparte — quedaría duplicado y, peor, inalcanzable desde el
    // calendario (que para esos días apunta al panel semanal).
    const diasMesMezcladosEstaSemana = new Set(Object.values(fechaDelMesPorDiaSemanaEstaSemana()));
    const panelesMensualesHtml = diasMesConContenido
        .filter((d) => !diasMesMezcladosEstaSemana.has(d))
        .map((d) => panelHtml(d, `${d}/${mesActual}`, itemsPorPanel[d] || []))
        .join("");

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
        ${cardRecordatorio}

        <div class="tabs-gestion" id="tabs-seccion-gestion">
            <button class="tab-gestion${vistaSeccion === "asignar" ? " activa" : ""}" data-vista-seccion="asignar">Asignar tareas</button>
            <button class="tab-gestion${vistaSeccion === "ejecutar" ? " activa" : ""}" data-vista-seccion="ejecutar">Tareas asignadas</button>
            ${puedeVerHistorico ? `<button class="tab-gestion${vistaSeccion === "historico" ? " activa" : ""}" data-vista-seccion="historico">${Icon("candado", { size: 12 })} Histórico</button>` : ""}
        </div>

        <!-- "Asignar tareas": catálogo — tocás una, se despliegan
             frecuencia + días, elegís. Con al menos un día queda
             verde ("En uso"); sin ninguno, gris ("Sin usar"). -->
        <div class="section" id="seccion-asignar-tareas"${vistaSeccion === "asignar" ? "" : ' style="display:none"'}>
            ${catalogoHtml}
        </div>

        <!-- "Tareas asignadas": calendario del mes — tocás un día, ves
             las tareas de ESE día, las marcás hechas, mandás push por
             tarea, junto al push de esa misma tarea (ver tareaHtml)
             — "Asignar tareas" no tiene nada de esto. -->
        <div id="seccion-tareas-asignadas"${vistaSeccion === "ejecutar" ? "" : ' style="display:none"'}>
            <div class="calendario-gestion">
                ${calendarioDiasHtml(diasMesConContenido, diaActivo)}
            </div>
            <div id="contenido-gestion-imprimible">
                ${membreteHtml("Guía de Gestión", sucursalActiva)}
                ${panelesSemanalesHtml}${panelesMensualesHtml}
            </div>
        </div>

        <!-- "Histórico" (2026-08-31): ciclos ya cerrados, de solo
             lectura — se carga recién al abrir la pestaña (ver
             bindCuerpoGestion), no hace falta pedirlo si nunca se
             mira. -->
        ${puedeVerHistorico ? `
            <div id="seccion-historico-gestion"${vistaSeccion === "historico" ? "" : ' style="display:none"'}>
                <div id="contenido-historico-gestion" data-cargado="0"></div>
            </div>
        ` : ""}
    `;
}

/** Trae el catálogo + los días de UNA sucursal (o ninguna) y puebla
 *  TAREAS/registroTareas — lo usan tanto la carga inicial (Gestion())
 *  como el selector de local al cambiar (bindGestion()), así las dos
 *  vías arman exactamente el mismo estado en memoria. */
/** Reset de ciclo (2026-08-31) — filtra un mapa de checks (formato de
 *  getChecksPorSucursal) a solo las filas del CICLO ACTUAL de cada
 *  tarea. Se hace ACÁ, no en getChecksPorSucursal, porque recién acá se
 *  conoce la frecuencia real de cada tarea (t.frecuencia, por
 *  sucursal). Una fila de un ciclo VIEJO simplemente no entra: la
 *  tarea vuelve a verse destildada, sin borrar ni migrar nada — sigue
 *  existiendo en la hoja, solo se lee aparte (ver "Histórico",
 *  getHistoricoGestion). Filas sin "ciclo" (columna todavía no
 *  agregada a la Sheet real) se dejan pasar tal cual — mejor mostrar
 *  de más que romper lo que ya andaba antes de este cambio. Usada
 *  tanto en la carga inicial (cargarDatos) como en el repaso de fondo
 *  de 20s (actualizarChecksEnDOM) — sin esto en el repaso, una tarea
 *  del ciclo pasado (todavía sin tocar en el ciclo nuevo) volvía a
 *  aparecer marcada apenas pasaban 20s. */
function filtrarChecksCicloActual(checks) {
    const frecuenciaPorTarea = {};
    TAREAS.forEach((t) => { frecuenciaPorTarea[t.id] = t.frecuencia; });
    const filtrados = {};
    Object.entries(checks).forEach(([clave, check]) => {
        const tareaId = clave.split("|")[0];
        const frecuencia = frecuenciaPorTarea[tareaId] || "semanal";
        // Fila sin "ciclo" (guardada antes de que existiera esa
        // columna) NO se deja pasar a ciegas — antes se trataba como
        // "siempre de hoy" y quedaba pegada para siempre en "Tareas
        // asignadas" sin pasar nunca a Histórico (bug real, Abasto/
        // Imprenta con la semana pasada pegada). Se calcula a qué
        // ciclo pertenecía de verdad según su propia fechaModificacion.
        const cicloDeLaFila = check.ciclo || cicloDeFecha(check.fechaModificacion, frecuencia);
        if (cicloDeLaFila === cicloActual(frecuencia)) {
            filtrados[clave] = check;
        }
    });
    return filtrados;
}

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

    checksActivos = filtrarChecksCicloActual(checks);
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
    usuarioEncargadoActivo = !!usuario?.encargado;
    // Y por eso mismo arranca directo en "Tareas asignadas" — mostrarle
    // primero una pantalla que no puede tocar no tiene sentido.
    if (usuario?.rol === "colaborador" && !usuario?.encargado && usuario?.responsableTurno) vistaSeccion = "ejecutar";
    sucursalActiva = esVistaLectura ? "" : (usuario?.sucursal || "");

    [sucursales] = await Promise.all([getSucursales(), cargarDatos(sucursalActiva)]);

    // Era un ícono "ⓘ" suelto con tooltip al hover (.mod-tooltip,
    // mismo mecanismo que kpiCard.js) — pedido explícito (2026-09-02):
    // "debería ser el 'cómo funciona'", igual al botón que ya usan
    // News/Recursos/Comunicaciones (.compose-ayuda + alert), para que
    // el patrón sea el mismo en toda la app en vez de un one-off acá.
    const comoFuncionaBtn = `<button type="button" class="compose-ayuda" id="btn-ayuda-gestion">${Icon("idea", { size: 16 })} ¿Cómo funciona?</button>`;

    return `
        ${Header("Gestión de tareas", "Organizá las tareas de tu local, por día o por mes", { accion: comoFuncionaBtn })}

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
/** Bug real reportado en vivo (2026-08-31): "a veces dice Guardando...
 *  pero no guarda" — quedaba PEGADO ahí para siempre. Causa: las 4
 *  funciones de guardado de acá abajo (bindCheckboxHecha, guardarAhora,
 *  bindDiasControl, bindFrecuenciaTarea) solo tenían `.then(...)`, sin
 *  `.catch(...)` — si `gasRequest` (services/google.js) TIRA una
 *  excepción en vez de devolver `{ok:false}` (timeout de 20s, se cortó
 *  la conexión, sesión inválida), esa promesa queda RECHAZADA y el
 *  `.then` nunca corre — el botón se queda deshabilitado, mostrando
 *  "Guardando..." de forma permanente, sin ningún aviso ni forma de
 *  reintentar salvo recargar la página entera. Cada call site agrega
 *  un `.catch` propio (revierte su estado optimista distinto), pero
 *  todos avisan y loguean con esta misma función. */
function manejarFalloGuardadoGestion(err, revertir) {
    console.warn("Guardado de Gestión falló:", err?.message || err);
    alert(err?.message || "No se pudo guardar — probá de nuevo.");
    revertir();
}

function bindCheckboxHecha(chk) {
    chk.addEventListener("change", () => {
        const tarjeta = chk.closest(".tarea-gestion");
        const tareaId = tarjeta.dataset.tareaId;
        const dia = tarjeta.dataset.dia;
        const hechoNuevo = chk.checked;

        // Candado — pedido explícito 2026-08-31: tildar esta tarea la
        // deja COMPLETA, y una tarea completa queda cerrada (no se
        // puede volver a tocar salvo que un Admin la reabra). Se avisa
        // ANTES de guardar, no después — revierte el tilde si cancela.
        if (hechoNuevo && !confirm('Al guardar, esta tarea queda cerrada y no vas a poder modificarla. ¿Confirmás?')) {
            chk.checked = false;
            return;
        }

        ultimaEdicionLocalGestion = Date.now();
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
            // Completa = cerrada del lado del servidor (ver
            // actualizarCheckGestion) — se refleja acá mismo,
            // re-renderizando la tarjeta bloqueada, sin esperar al
            // próximo repaso de 20s (actualizarChecksEnDOM).
            if (hechoNuevo) {
                checksActivos[`${tareaId}|${dia}`] = { ...checksActivos[`${tareaId}|${dia}`], hecho: true, marcadoPor: nombre, hora: horaAhora(), cerrada: true, cerradaPor: nombre, cerradaHora: horaAhora() };
                recrearTareaEnPaneles(tareaId);
            }
        }).catch((err) => {
            chk.disabled = false;
            manejarFalloGuardadoGestion(err, () => {
                chk.checked = !hechoNuevo;
                tarjeta.classList.toggle("hecha", !hechoNuevo);
                if (hora) hora.textContent = !hechoNuevo ? `Hecho ${horaAhora()}` : "";
            });
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
                }).catch((err) => {
                    timersDias.delete(idTarea);
                    manejarFalloGuardadoGestion(err, () => {
                        tarea.dias = estado.diasPrevios;
                        recrearTareaEnPaneles(idTarea);
                    });
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
            }).catch((err) => {
                manejarFalloGuardadoGestion(err, () => {
                    tarea.frecuencia = nueva === "mensual" ? "semanal" : "mensual";
                    tarea.dias = diasPrevios;
                    recrearTareaEnPaneles(idTarea);
                });
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
        // Bug real reportado en vivo (2026-08-31): un numérico nunca
        // tocado vale $0 por DEFAULT, y $0 se lee como "Cuadra" — sin
        // este chequeo, un ítem que nadie miró contaba igual como
        // "respondido" y dejaba exportar/avisar con algo en realidad
        // pendiente. "tocado" (ver subitemFilaHtml/bindTarjetaDesplegable)
        // distingue "nadie lo tocó todavía" de "confirmó que da 0".
        if (fila.dataset.tocado !== "1") return undefined;
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

        // Candado — pedido explícito 2026-08-31: guardar con TODO
        // respondido deja la tarea cerrada (no se puede volver a tocar
        // salvo que un Admin la reabra). Se avisa ANTES de guardar.
        if (completa && !confirm('Al guardar, esta tarea queda cerrada y no vas a poder modificarla. ¿Confirmás?')) return;

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
                // "✓ Guardado" a secas — sin distinguir "guardé tu
                // avance parcial" de "la tarea quedó terminada" — podía
                // leerse como "listo, ya está" aunque falten ítems sin
                // responder (ej. 7/10, quedó Pendiente en el PDF). Acá
                // sí se limita: solo dice "✓ Guardado" cuando la tarea
                // quedó completa DE VERDAD; si no, dice cuánto falta,
                // sin tilde — para que nadie (en especial un
                // Responsable de turno con prisa) confunda "guardé lo
                // que llevo" con "terminé". Pedido explícito: "hay que
                // limitar a responsables de turno a que no terminen la
                // tarea [sin cargar todo] — si o si tienen que cargar
                // la tarea para que aparezca su nombre, sino queda
                // como pendiente".
                btnGuardar.textContent = completa ? "✓ Guardado" : `Guardado — faltan ${filas.length - marcados.length}`;
                setTimeout(() => { btnGuardar.textContent = textoOriginal; }, completa ? 2000 : 3500);
            }
            // Completa = cerrada del lado del servidor (ver
            // actualizarCheckGestion) — se refleja acá mismo,
            // re-renderizando la tarjeta bloqueada (candado + firma por
            // ítem), sin esperar al próximo repaso de 20s.
            if (completa) {
                const nombre = getUsuarioActual()?.nombre || "";
                const horaActual = horaAhora();
                const anterior = checksActivos[clave];
                const marcasMap = new Map(marcados.map(({ indice, marca }) => [String(indice), marca]));
                const firmasMap = new Map();
                marcados.forEach(({ indice }) => {
                    const previa = anterior?.firmas?.get(String(indice));
                    firmasMap.set(String(indice), previa?.nombre ? previa : { indice: String(indice), nombre, hora: horaActual });
                });
                checksActivos[clave] = { ...anterior, hecho: true, marcadoPor: nombre, hora: horaActual, marcas: marcasMap, firmas: firmasMap, cerrada: true, cerradaPor: nombre, cerradaHora: horaActual };
                recrearTareaEnPaneles(tarjeta.dataset.tareaId);
            }
        }).catch((err) => {
            if (btnGuardar) btnGuardar.disabled = false;
            manejarFalloGuardadoGestion(err, () => {
                if (btnGuardar) btnGuardar.textContent = textoOriginal;
                if (hora && completa) hora.textContent = "";
            });
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
        if (e.target.classList.contains("input-numerico-subitem")) {
            sanearInputMonto(e.target);
            // "tocado" (bug 4.3, ver leerMarcaFilaSubitem): recién ACÁ
            // cuenta como respondido — antes del primer toque, el $0
            // por default no es una respuesta, es que nadie lo miró.
            e.target.closest(".subitem-numerico").dataset.tocado = "1";
        }
    });

    contenedorSubitems.addEventListener("click", (e) => {
        // "Cuadra" — pedido explícito 2026-08-31: si alguien tocó Falta/
        // Sobra por error, un solo botón lo vuelve a $0/verde en vez de
        // tener que borrar el monto a mano Y volver a tocar el signo
        // equivocado para destildarlo.
        const btnCuadra = e.target.closest("[data-accion-cuadra]");
        if (btnCuadra) {
            const fila = btnCuadra.closest(".subitem-numerico");
            const input = fila.querySelector(".input-numerico-subitem");
            if (input) input.value = "0";
            fila.dataset.signo = "+";
            fila.dataset.tocado = "1";
            fila.querySelectorAll(".signo-btn").forEach((b) => b.classList.remove("activo"));
            btnCuadra.classList.add("activo");
            actualizarColorNumerico(fila);
            actualizarProgresoLocal();
            return;
        }
        const signoBtn = e.target.closest(".signo-btn");
        if (signoBtn) {
            const fila = signoBtn.closest(".subitem-numerico");
            fila.dataset.signo = signoBtn.dataset.signo;
            fila.dataset.tocado = "1"; // elegir Falta/Sobra también es "tocarlo", aunque el monto siga en $0.
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
        destino.dataset.tocado = "1"; // confirmado en 0 automáticamente por el "OK" del estado3 emparejado — cuenta como respondido.
        // En $0 queda marcado "Cuadra" — ninguno de los dos botones de
        // signo (Falta/Sobra), para no dejar uno en rojo o naranja al
        // lado de un valor que en realidad está en cero.
        destino.dataset.signo = "+";
        destino.querySelectorAll(".signo-btn").forEach((b) => b.classList.remove("activo"));
        destino.querySelector("[data-accion-cuadra]")?.classList.add("activo");
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
        if (registroTareas.get(idTarea)) abrirCarruselTareas(idTarea);
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
/** true si la tarea (tareaId+día) tiene TODOS sus sub-ítems
 *  respondidos (o, sin sub-ítems, el check propio tildado) — mismo
 *  cálculo que usa el título del push. Module-level porque lo usan
 *  DOS lugares: bindPushWrap (frenar "Enviar push") y el handler de
 *  "Exportar a PDF" — pedido explícito: "pon la misma limitación que
 *  pusiste en push a exportar". */
function tareaEstaCompleta(tareaId, dia) {
    const tarjeta = document.querySelector(`.tarea-gestion[data-tarea-id="${tareaId}"][data-dia="${dia}"]`);
    // Antes devolvía true ("está completa") si no encontraba la
    // tarjeta — fallaba ABIERTO: dejaba exportar/avisar sin ninguna
    // forma de confirmar que en verdad estaba todo respondido. Bug
    // real reportado en vivo (2026-08-31): fail-closed acá, no al
    // revés — sin la tarjeta no hay cómo confirmar nada.
    if (!tarjeta) return false;
    const contenedorSubitems = tarjeta.querySelector("[data-subitems]");
    if (contenedorSubitems) {
        const marcas = Array.from(contenedorSubitems.children).map((fila) => leerMarcaFilaSubitem(fila, contenedorSubitems));
        return marcas.length > 0 && marcas.every(Boolean);
    }
    const checkPropio = tarjeta.querySelector(".tarea-gestion-check");
    return !!checkPropio?.checked;
}

function bindPushWrap(wrap) {
    const tareaId = wrap.dataset.tareaId;
    const dia = wrap.dataset.dia;

    function pintarBoton() {
        wrap.innerHTML = pushBotonHtml();
        wrap.querySelector("[data-btn-enviar-push]").addEventListener("click", pintarBanner);
    }

    function pintarBanner() {
        // No se puede enviar con ítems sin responder — pedido
        // explícito: "si le quedan pendientes está justamente hecho/
        // no hecho para que sí o sí lo envíe... yo prefiero que no
        // [pueda enviar]". Frena ACÁ, antes de mostrar el banner de
        // confirmación — no tiene sentido preguntar "¿enviar?" para
        // algo que no va a salir.
        if (!tareaEstaCompleta(tareaId, dia)) {
            alert("Todavía quedan ítems sin responder (Hecho/No hecho) — completá la tarea antes de enviar el push.");
            return;
        }
        if (tareasSinGuardarGestion.has(`${tareaId}|${dia}`)) {
            alert("Tenés cambios sin guardar — tocá \"Guardar\" antes de enviar el push.");
            return;
        }
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
            //
            // "✓ Enviado" a secas no avisaba si ALGUIEN no lo recibió
            // de verdad (token vencido, celular sin notificaciones
            // activadas, etc.) — el backend siempre respondía ok:true
            // aunque fallaran destinatarios puntuales. Pedido explícito
            // (2026-09-02, caso real: un Responsable de turno no
            // recibía los avisos y nadie se enteraba): mostrar cuántos
            // de verdad lo recibieron, no solo que el botón "funcionó".
            let mensajeEnvio, avisoParcial;
            if (!r.destinatarios) {
                mensajeEnvio = "Enviado — nadie activó push";
                avisoParcial = true;
            } else if (r.fallidos > 0) {
                mensajeEnvio = `Enviado a ${r.enviados}/${r.destinatarios}`;
                avisoParcial = true;
            } else {
                mensajeEnvio = "✓ Enviado";
                avisoParcial = false;
            }
            wrap.innerHTML = `<button type="button" class="btn-enviar-push${avisoParcial ? " aviso-parcial" : ""}" disabled>${mensajeEnvio}</button>`;
            // Un aviso parcial se queda más tiempo en pantalla — es
            // justo el caso que antes pasaba desapercibido, dos
            // segundos no alcanzan para notarlo.
            setTimeout(pintarBoton, avisoParcial ? 4500 : 2000);
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

/** ✓/— (y Falta/Sobra/Hecho-No hecho) de cada sub-ítem, como texto
 *  plano FIJO, ANTES de exportar — extraído de la exportación en vivo
 *  (2026-08-26) para reusarlo tal cual en el PDF de "Histórico"
 *  (2026-08-31, ver exportarCicloHistorico): html2canvas (motor real
 *  detrás de "Descargar PDF") reimplementa su propio soporte de
 *  pseudo-clases de estado y no renderiza bien ":checked" ni otros
 *  estados dinámicos — texto fijo no le exige entender nada de eso.
 *  Devuelve los nodos agregados para poder sacarlos apenas termina de
 *  exportar (exportarAPdf clona el HTML de forma síncrona, alcanza con
 *  sacarlos justo después). `contenedorId` es el id del contenedor
 *  cuyo contenido se va a exportar (distinto en vivo vs. Histórico). */
function prepararSubitemsParaExportar(contenedorId) {
    document.querySelectorAll(`#${contenedorId} input[type=checkbox]`).forEach((chk) => {
        if (chk.checked) chk.setAttribute("checked", "checked");
        else chk.removeAttribute("checked");
    });

    const marcasAgregadas = [];

    document.querySelectorAll(`#${contenedorId} .subitem-gestion`).forEach((label) => {
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

    document.querySelectorAll(`#${contenedorId} .subitem-numerico`).forEach((fila) => {
        const input = fila.querySelector(".input-numerico-subitem");
        const span = fila.querySelector("span");
        if (!input || !span) return;
        input.setAttribute("value", input.value);
        const magnitud = input.value === "" ? 0 : Math.abs(parsearMontoInput(input.value));
        const esFalta = fila.dataset.signo === "-";
        const marca = document.createElement("span");
        marca.className = "subitem-gestion-marca";
        marca.style.color = magnitud === 0 ? "#1a7a3c" : esFalta ? "#c0392b" : "#b8860b";
        marca.textContent = magnitud === 0 ? "✓ Cuadra " : `${esFalta ? "Faltan" : "Sobran"} $${formatearMontoInput(magnitud)} `;
        span.before(marca);
        marcasAgregadas.push(marca);
    });

    document.querySelectorAll(`#${contenedorId} .subitem-estado2`).forEach((fila) => {
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

    document.querySelectorAll(`#${contenedorId} .subitem-estado3`).forEach((fila) => {
        const span = fila.querySelector(".subitem-estado3-fila span");
        if (!span) return;
        const estado = fila.dataset.estadoActual;
        const chipActivo = document.querySelector(`#${contenedorId} [data-motivo-de="${fila.dataset.subitemIndice}"] .chip-motivo.activo`);
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

    return marcasAgregadas;
}

/** "Histórico" (2026-08-31) — trae los ciclos ya cerrados y los pinta
 *  agrupados por ciclo, más reciente primero. Se llama recién al abrir
 *  la pestaña (ver bindCuerpoGestion), no en la carga inicial — nadie
 *  paga el costo de este fetch si nunca la mira. */
/** "AAAA-MM" elegido en Histórico — null = todavía no se decidió
 *  (arranca en el mes actual, ver renderHistoricoGestion). Vive acá
 *  arriba, no en el DOM, para sobrevivir a que el contenedor se
 *  redibuje entero cada vez que se cambia de mes. */
let mesHistoricoActivo = null;

/** "toDateString()" del día real en que mesHistoricoActivo se
 *  confirmó por última vez — mismo motivo que fechaDiaActivo más
 *  arriba: un mes pasado elegido (o el default de "mes actual" de una
 *  visita de días atrás) sigue siendo "válido" para siempre mientras
 *  tenga ciclos archivados, así que sin esto una pestaña vieja seguía
 *  reabriendo agosto en pleno septiembre. */
let fechaMesHistoricoActivo = null;

/** Día del mes (número, ej. 12) elegido en el calendario de Histórico —
 *  null = se ve la lista de ciclos completa (comportamiento por
 *  defecto), un número = se ve solo ese día puntual. Pedido explícito
 *  (2026-09-02): "en histórico también debería estar el calendario,
 *  así puedo sacar PDF por día" — antes Histórico solo ofrecía
 *  descargar el CICLO entero (la semana o el mes completos juntos). */
let diaHistoricoActivo = null;

function etiquetaMes(mesISO) {
    const [anio, mes] = mesISO.split("-").map(Number);
    const nombre = MESES_CALENDARIO_GESTION[mes - 1];
    return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

const DIAS_SEMANA_ES_HISTORICO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "Martes 12 de agosto" a partir de "AAAA-MM-DD". */
function etiquetaDiaHistorico(fechaIso) {
    const [anio, mes, dia] = fechaIso.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const nombreDia = DIAS_SEMANA_ES_HISTORICO[fecha.getDay()];
    return `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)} ${dia} de ${MESES_CALENDARIO_GESTION[mes - 1]}`;
}

/** Fecha real ("AAAA-MM-DD") de una fila de GestionChecks archivada —
 *  hace falta para poder ubicarla en un calendario real, cosa que el
 *  dato crudo no da directo: una fila mensual guarda el día del mes
 *  suelto en `dia` ("12"), y una semanal guarda el NOMBRE del día
 *  ("Martes") relativo al lunes que es su `ciclo`. Devuelve null si el
 *  dato no matchea ninguno de los dos formatos esperados (no debería
 *  pasar, pero mejor no romper el calendario por una fila rara). */
function fechaIsoDeFilaHistorico(f) {
    if (/^\d{4}-\d{2}$/.test(String(f.ciclo))) {
        const dia = Number(f.dia);
        if (!dia) return null;
        return `${f.ciclo}-${String(dia).padStart(2, "0")}`;
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.ciclo));
    if (!m) return null;
    const offset = DIAS_VISUAL.indexOf(f.dia);
    if (offset < 0) return null;
    const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    fecha.setDate(fecha.getDate() + offset);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/** Mismo look que calendarioDiasHtml (Tareas asignadas) pero para un
 *  mes/año arbitrario ya cerrado, no siempre "el mes de hoy" — y con
 *  días con datos marcados por número de día del mes, no por nombre de
 *  día de semana (acá cualquier día del mes puede tener archivo). */
function calendarioMesHistoricoHtml(anio, mes, diasConDatos, diaSeleccionado) {
    const hoy = new Date();
    const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() === mes;
    const primerDiaVisual = (new Date(anio, mes, 1).getDay() + 6) % 7;
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    let celdas = "";
    for (let i = 0; i < primerDiaVisual; i++) celdas += `<span class="calendario-gestion-relleno"></span>`;
    for (let d = 1; d <= ultimoDia; d++) {
        const tieneDatos = diasConDatos.has(d);
        const clases = ["calendario-gestion-dia"];
        if (esMesActual && d === hoy.getDate()) clases.push("hoy");
        if (tieneDatos) clases.push("con-tareas");
        if (tieneDatos && d === diaSeleccionado) clases.push("activo");
        celdas += tieneDatos
            ? `<button type="button" class="${clases.join(" ")}" data-dia-historico="${d}">${d}</button>`
            : `<span class="${clases.join(" ")}">${d}</span>`;
    }
    return `
        <div class="calendario-gestion">
            <div class="calendario-gestion-encabezado"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
            <div class="calendario-gestion-grilla" id="calendario-dias-historico">${celdas}</div>
        </div>
    `;
}

async function renderHistoricoGestion() {
    const contenedor = document.getElementById("contenido-historico-gestion");
    if (!contenedor) return;
    contenedor.innerHTML = `<p class="aviso-tareas-aplicables">Cargando histórico…</p>`;

    // Responsable de local: sin sucursal explícita (el backend usa la
    // suya). Admin/Supervisor: la que eligieron en el selector.
    const filas = await getHistoricoGestion(usuarioEncargadoActivo ? undefined : sucursalActiva);

    const catalogo = {};
    TAREAS.forEach((t) => { catalogo[t.id] = t; });

    const porCiclo = new Map();
    filas.forEach((f) => {
        if (!porCiclo.has(f.ciclo)) porCiclo.set(f.ciclo, []);
        porCiclo.get(f.ciclo).push(f);
    });

    // Se entra a Histórico y se ve el MES ACTUAL primero — pedido
    // explícito (2026-09-02): "uno entra a histórico y se encuentra
    // con elegí mes, se ve el mes corriente, cuando haya más meses
    // podés elegir el que necesitás". Antes era una lista plana de
    // TODOS los ciclos juntos, sin separar por mes — imposible de
    // ubicar apenas hubiera más de un par de semanas archivadas.
    //
    // "AAAA-MM" sale de los primeros 7 caracteres tanto de un ciclo
    // semanal ("AAAA-MM-DD", el lunes de esa semana — cae en el mes
    // de ESE lunes, no en el que la semana termine) como de uno
    // mensual ("AAAA-MM", ya es exactamente eso).
    const mesesConCiclos = new Set([...porCiclo.keys()].map((c) => c.slice(0, 7)));
    const mesActualISO = new Date().toISOString().slice(0, 7);
    mesesConCiclos.add(mesActualISO); // siempre elegible, aunque esté vacío
    const mesesOrdenados = [...mesesConCiclos].sort().reverse();

    const hoyClaveFechaHistorico = new Date().toDateString();
    // Si cambió el día real desde la última vez (pestaña que quedó
    // abierta de un mes para el otro), se fuerza el mes actual sin
    // importar si el mes elegido antes sigue teniendo ciclos
    // archivados (¡casi siempre los tiene!) — ver fechaMesHistoricoActivo.
    if (fechaMesHistoricoActivo !== hoyClaveFechaHistorico || !mesHistoricoActivo || !mesesConCiclos.has(mesHistoricoActivo)) {
        mesHistoricoActivo = mesActualISO;
        fechaMesHistoricoActivo = hoyClaveFechaHistorico;
    }

    const selectorMesesHtml = mesesOrdenados.length > 1 ? `
        <div class="tabs-gestion">
            ${mesesOrdenados.map((m) => `<button type="button" class="tab-gestion${m === mesHistoricoActivo ? " activa" : ""}" data-mes-historico="${m}">${etiquetaMes(m)}</button>`).join("")}
        </div>
    ` : "";

    // Calendario de días con archivo dentro del mes elegido — pedido
    // explícito (2026-09-02): "en histórico también debería estar el
    // calendario, así puedo sacar PDF por día". Se calcula sobre TODAS
    // las filas (no solo las de ciclosDelMes de abajo): una semana cuyo
    // lunes cae a fin de mes puede tener días sueltos que caen en el
    // mes siguiente, y estos sí tienen que verse en SU propio calendario
    // aunque el ciclo entero se liste bajo el mes del lunes.
    const [anioMesActivo, numMesActivo] = mesHistoricoActivo.split("-").map(Number);
    const filasConFecha = filas
        .map((f) => ({ ...f, _fechaIso: fechaIsoDeFilaHistorico(f) }))
        .filter((f) => f._fechaIso && f._fechaIso.slice(0, 7) === mesHistoricoActivo);
    const diasConDatos = new Set(filasConFecha.map((f) => Number(f._fechaIso.slice(8, 10))));

    if (diaHistoricoActivo && !diasConDatos.has(diaHistoricoActivo)) diaHistoricoActivo = null;

    const calendarioHtml = diasConDatos.size
        ? calendarioMesHistoricoHtml(anioMesActivo, numMesActivo - 1, diasConDatos, diaHistoricoActivo)
        : "";

    // Solo el Responsable de local de ESE local puede borrar — Admin/
    // Supervisor mirando un local ajeno, no (mismo gate que el server,
    // ver eliminarHistoricoGestion en Code.gs). "Descargar PDF de un
    // día puntual" no tiene ese riesgo (no borra nada), lo ve cualquiera
    // que ya llegó hasta acá.
    const puedeBorrar = usuarioEncargadoActivo;

    // Vista "un día puntual" — reemplaza la lista de ciclos mientras
    // haya un día elegido en el calendario de arriba.
    if (diaHistoricoActivo) {
        const fechaIso = `${mesHistoricoActivo}-${String(diaHistoricoActivo).padStart(2, "0")}`;
        const filasDia = filasConFecha.filter((f) => f._fechaIso === fechaIso);
        const completasDia = filasDia.filter((f) => String(f.hecho).toUpperCase() === "SI").length;
        const filasDiaHtml = filasDia.map((f) => {
            const titulo = catalogo[f.tareaId]?.titulo || f.tareaId;
            const completa = String(f.hecho).toUpperCase() === "SI";
            return `
                <div class="fila-tarea-historico${completa ? "" : " no-completada"}">
                    <span class="estado-ico-historico ${completa ? "ok" : "no"}">${Icon(completa ? "check" : "cerrar", { size: 12 })}</span>
                    <span class="fila-tarea-historico-txt">
                        <strong>${escaparHtml(titulo)}</strong>
                        <span>${completa ? `Hecho ${f.hora || ""}${f.marcadoPor ? ` · ${escaparHtml(f.marcadoPor)}` : ""}` : "No completada"}</span>
                    </span>
                </div>
            `;
        }).join("");
        contenedor.innerHTML = `
            ${selectorMesesHtml}
            ${calendarioHtml}
            <div class="ciclo-card-historico">
                <div class="ciclo-header-historico">
                    <span class="ciclo-ico-historico">${Icon("calendario", { size: 17 })}</span>
                    <span class="ciclo-titulo-historico">
                        <strong>${etiquetaDiaHistorico(fechaIso)}</strong>
                        <span>${escaparHtml(filasDia[0]?.sucursal || "")}</span>
                    </span>
                    <span class="pill-progreso-historico ${filasDia.length && completasDia === filasDia.length ? "completo" : "parcial"}">${completasDia}/${filasDia.length} completadas</span>
                    <div class="ciclo-acciones-historico">
                        <button type="button" class="btn-mini-historico volver" data-volver-historico="1">${Icon("flecha-izq", { size: 14 })} Ver todo el mes</button>
                        <button type="button" class="btn-mini-historico descargar" data-descargar-dia="${fechaIso}" data-sucursal-dia="${escaparHtml(filasDia[0]?.sucursal || "")}">${Icon("descargar", { size: 14 })} Descargar PDF</button>
                    </div>
                </div>
                <div class="ciclo-tareas-historico">${filasDiaHtml || `<p class="text-muted text-sm">Sin tareas registradas ese día.</p>`}</div>
            </div>
        `;
        return;
    }

    const ciclosDelMes = [...porCiclo.keys()].filter((c) => c.slice(0, 7) === mesHistoricoActivo)
        // Más reciente primero — "AAAA-MM-DD" y "AAAA-MM" ordenan bien
        // como texto plano, no hace falta parsear fechas para esto.
        .sort().reverse();

    if (!ciclosDelMes.length && !diasConDatos.size) {
        contenedor.innerHTML = `
            ${selectorMesesHtml}
            <div class="vacio-historico-gestion">
                ${Icon("calendario", { size: 26 })}
                <p>${mesHistoricoActivo === mesActualISO
                    ? "Este mes todavía no hay ningún ciclo archivado — el primero va a aparecer cuando termine esta semana o este mes."
                    : "Este mes no tiene ciclos archivados."}</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = selectorMesesHtml + calendarioHtml + ciclosDelMes.map((ciclo) => {
        const filasCiclo = porCiclo.get(ciclo);
        const completas = filasCiclo.filter((f) => String(f.hecho).toUpperCase() === "SI").length;
        const esMensual = /^\d{4}-\d{2}$/.test(ciclo);
        const filasHtml = filasCiclo.map((f) => {
            const titulo = catalogo[f.tareaId]?.titulo || f.tareaId;
            const completa = String(f.hecho).toUpperCase() === "SI";
            return `
                <div class="fila-tarea-historico${completa ? "" : " no-completada"}">
                    <span class="estado-ico-historico ${completa ? "ok" : "no"}">${Icon(completa ? "check" : "cerrar", { size: 12 })}</span>
                    <span class="fila-tarea-historico-txt">
                        <strong>${escaparHtml(titulo)}</strong>
                        <span>${completa ? `Hecho ${f.hora || ""}${f.marcadoPor ? ` · ${escaparHtml(f.marcadoPor)}` : ""}` : "No completada"}</span>
                    </span>
                </div>
            `;
        }).join("");
        return `
            <div class="ciclo-card-historico">
                <div class="ciclo-header-historico">
                    <span class="ciclo-ico-historico">${Icon("calendario", { size: 17 })}</span>
                    <span class="ciclo-titulo-historico">
                        <strong>${etiquetaCiclo(ciclo)}</strong>
                        <span>${escaparHtml(filasCiclo[0].sucursal || "")}</span>
                    </span>
                    <span class="tag-frecuencia-historico">${esMensual ? "Mensual" : "Semanal"}</span>
                    <span class="pill-progreso-historico ${completas === filasCiclo.length ? "completo" : "parcial"}">${completas}/${filasCiclo.length} completadas</span>
                    <div class="ciclo-acciones-historico">
                        <button type="button" class="btn-mini-historico descargar" data-descargar-ciclo="${ciclo}" data-sucursal-ciclo="${escaparHtml(filasCiclo[0].sucursal || "")}">${Icon("descargar", { size: 14 })} Descargar PDF</button>
                        ${puedeBorrar ? `<button type="button" class="btn-mini-historico eliminar" data-eliminar-ciclo="${ciclo}">${Icon("tacho", { size: 14 })} Eliminar</button>` : ""}
                    </div>
                </div>
                <div class="ciclo-tareas-historico">${filasHtml}</div>
            </div>
        `;
    }).join("");
}

/** Re-genera el PDF de UN ciclo ya cerrado, reusando tareaHtml() +
 *  exportarAPdf() tal cual — mismo look que "Exportar a PDF" en vivo,
 *  sin duplicar esa lógica. Apunta MOMENTÁNEAMENTE checksActivos/
 *  esVistaLectura al estado archivado (en vez del vivo), renderiza
 *  fuera de pantalla, exporta, y restaura todo — así ninguna otra
 *  parte de la pantalla se entera de este cambio temporal.
 *  Limitación aceptada: si la tarea cambió de título/sub-ítems después
 *  de archivada, el PDF muestra la versión ACTUAL de la tarea, no la
 *  histórica — no vale la pena guardar una copia completa de la
 *  definición para ese caso borde. */
/** Hace el trabajo compartido de armar y bajar el PDF, sea de un ciclo
 *  entero o de un solo día — ver exportarCicloHistorico/
 *  exportarDiaHistorico más abajo, que solo difieren en QUÉ filas
 *  juntan y el título. */
async function exportarFilasHistoricoComoPdf(filasGrupo, tituloPdf, sucursal) {
    if (!filasGrupo.length) {
        alert("No se encontró información para exportar — puede que ya se haya borrado.");
        return;
    }

    const checksDelGrupo = {};
    filasGrupo.forEach((f) => {
        const marcas = new Map();
        String(f.subitemsMarcados || "").split(",").filter(Boolean).forEach((entrada) => {
            const marca = parsearMarcaSubitem(entrada);
            marcas.set(marca.indice, marca);
        });
        const firmas = new Map();
        String(f.subitemsFirmas || "").split(",").filter(Boolean).forEach((entrada) => {
            const firma = parsearFirmaSubitem(entrada);
            firmas.set(firma.indice, firma);
        });
        checksDelGrupo[`${f.tareaId}|${f.dia}`] = {
            marcadoPor: f.marcadoPor || "", hora: f.hora || "",
            hecho: String(f.hecho).toUpperCase() === "SI", marcas, firmas,
            cerrada: String(f.cerrada).toUpperCase() === "SI", cerradaPor: f.cerradaPor || "", cerradaHora: f.cerradaHora || "",
        };
    });

    const previoChecks = checksActivos;
    const previoLectura = esVistaLectura;
    checksActivos = checksDelGrupo;
    esVistaLectura = true; // Histórico es de solo lectura, pase lo que pase con el usuario real.

    const contenedor = document.createElement("div");
    contenedor.id = "contenido-historico-imprimible";
    contenedor.style.cssText = "position:fixed; left:-9999px; top:0;";
    contenedor.innerHTML = membreteHtml(`Guía de Gestión — ${tituloPdf}`, sucursal);
    filasGrupo.forEach((f) => {
        const tarea = catalogoHistorico(f.tareaId);
        if (!tarea) return;
        contenedor.insertAdjacentHTML("beforeend", tareaHtml(tarea, `hist-${f.tareaId}-${f.dia}`, f.dia));
    });
    document.body.appendChild(contenedor);

    const marcasAgregadas = prepararSubitemsParaExportar("contenido-historico-imprimible");
    try {
        exportarAPdf("contenido-historico-imprimible", `Guía de Gestión — ${tituloPdf}`, { soloDescarga: true });
    } finally {
        marcasAgregadas.forEach((m) => m.remove());
        contenedor.remove();
        checksActivos = previoChecks;
        esVistaLectura = previoLectura;
    }
}

async function exportarCicloHistorico(ciclo, sucursalDelCiclo) {
    const filas = await getHistoricoGestion(usuarioEncargadoActivo ? undefined : sucursalActiva);
    const filasCiclo = filas.filter((f) => String(f.ciclo) === String(ciclo));
    await exportarFilasHistoricoComoPdf(filasCiclo, etiquetaCiclo(ciclo), sucursalDelCiclo);
}

/** Mismo PDF que exportarCicloHistorico pero acotado a UN día real
 *  (ver fechaIsoDeFilaHistorico) — pedido explícito (2026-09-02) para
 *  no tener que bajar la semana/mes entera cuando solo hace falta un
 *  día puntual. */
async function exportarDiaHistorico(fechaIso, sucursalDelDia) {
    const filas = await getHistoricoGestion(usuarioEncargadoActivo ? undefined : sucursalActiva);
    const filasDia = filas.filter((f) => fechaIsoDeFilaHistorico(f) === fechaIso);
    await exportarFilasHistoricoComoPdf(filasDia, etiquetaDiaHistorico(fechaIso), sucursalDelDia);
}

/** Tarea del catálogo por id, para el PDF de Histórico — registroTareas
 *  puede no tener TODAS las tareas que alguna vez existieron si el
 *  catálogo cambió, TAREAS sí (viene fresco de getTareas() en
 *  cargarDatos); se prueba primero ahí, registroTareas como respaldo. */
function catalogoHistorico(tareaId) {
    return TAREAS.find((t) => t.id === tareaId) || registroTareas.get(tareaId);
}

/** Días de este mes con alguna tarea MENSUAL asignada — recalculado a
 *  partir de TAREAS/sucursalActiva en vivo (no un valor guardado de
 *  cuando se armó la página), para poder refrescar el calendario en
 *  caliente cada vez que "Asignar tareas" agrega/saca un día mensual.
 *  Mismo criterio de alcance que cuerpoGestionHtml(). */
function diasMesConContenidoActual() {
    const hayLocalAhora = !esVistaLectura || !!sucursalActiva;
    const tareasParaLocal = hayLocalAhora ? TAREAS.filter((t) => aplicaASucursal(t, sucursalActivaObj())) : TAREAS;
    return [...new Set(tareasParaLocal.filter((t) => t.frecuencia === "mensual").flatMap((t) => t.dias))].sort((a, b) => Number(a) - Number(b));
}

/** Click de un día del calendario de "Tareas asignadas" — data-vista-dia
 *  activa, muestra el [data-panel-dia] que matchea, oculta el resto.
 *  Factorizado (2026-09-02) para poder re-engancharlo también después
 *  de actualizarCalendarioGestion(), que reemplaza el innerHTML del
 *  calendario entero y por lo tanto pierde estos listeners. */
function bindCalendarioDiasGestion() {
    document.querySelectorAll("#calendario-dias-gestion [data-vista-dia]").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#calendario-dias-gestion [data-vista-dia]").forEach((b) => b.classList.remove("activo"));
            btn.classList.add("activo");
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
}

/** Refresca los puntitos del calendario de "Tareas asignadas" sin
 *  reconstruir toda la sección — pedido explícito (2026-09-02,
 *  reportado en vivo): "cuando elijo aplicar una tarea por mes no sale
 *  en el calendario". Causa real: elegir un día-del-mes en "Asignar
 *  tareas" solo reconstruía los PANELES de esa tarea (recrearTareaEnPaneles),
 *  nunca el calendario — el punto nuevo recién aparecía si se recargaba
 *  la página entera. Se llama junto con recrearTareaEnPaneles en
 *  cualquier lugar que cambie t.dias/t.frecuencia. No-op si el
 *  calendario no está en el DOM ahora mismo (ej. "Asignar tareas"
 *  activa, o sin local elegido). */
function actualizarCalendarioGestion() {
    const grilla = document.getElementById("calendario-dias-gestion");
    const contenedor = grilla?.closest(".calendario-gestion");
    if (!contenedor) return;
    contenedor.innerHTML = calendarioDiasHtml(diasMesConContenidoActual(), diaActivo);
    bindCalendarioDiasGestion();
}

/** Todo lo que hay que re-enganchar cada vez que #cuerpo-gestion se
 *  reconstruye — al cargar la página Y cada vez que Admin/Supervisor
 *  cambia de local en el selector (mismo contenido, nodos nuevos). */
function bindCuerpoGestion() {
    bindCalendarioDiasGestion();

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
            const seccionHistorico = document.getElementById("seccion-historico-gestion");
            if (seccionHistorico) {
                seccionHistorico.style.display = vistaSeccion === "historico" ? "" : "none";
                // Lazy: recién se pide al backend la PRIMERA vez que se
                // abre esta pestaña — nadie paga ese fetch si nunca la
                // mira. dataset.cargado evita repetirlo cada vez que se
                // vuelve a esta pestaña dentro de la misma visita.
                const contenido = document.getElementById("contenido-historico-gestion");
                if (vistaSeccion === "historico" && contenido && contenido.dataset.cargado !== "1") {
                    contenido.dataset.cargado = "1";
                    renderHistoricoGestion();
                }
            }
        });
    });

    // "Descargar PDF" / "Eliminar" de un ciclo del Histórico — delegado
    // en el contenedor (las tarjetas se re-arman enteras cada vez que
    // se abre la pestaña, ver renderHistoricoGestion).
    document.getElementById("contenido-historico-gestion")?.addEventListener("click", (e) => {
        const btnMes = e.target.closest("[data-mes-historico]");
        if (btnMes) {
            mesHistoricoActivo = btnMes.dataset.mesHistorico;
            diaHistoricoActivo = null; // un día de OTRO mes no tiene sentido acá
            renderHistoricoGestion();
            return;
        }
        const btnDia = e.target.closest("[data-dia-historico]");
        if (btnDia) {
            diaHistoricoActivo = Number(btnDia.dataset.diaHistorico);
            renderHistoricoGestion();
            return;
        }
        const btnVolver = e.target.closest("[data-volver-historico]");
        if (btnVolver) {
            diaHistoricoActivo = null;
            renderHistoricoGestion();
            return;
        }
        const btnDescargarDia = e.target.closest("[data-descargar-dia]");
        if (btnDescargarDia) {
            exportarDiaHistorico(btnDescargarDia.dataset.descargarDia, btnDescargarDia.dataset.sucursalDia);
            return;
        }
        const btnDescargar = e.target.closest("[data-descargar-ciclo]");
        if (btnDescargar) {
            exportarCicloHistorico(btnDescargar.dataset.descargarCiclo, btnDescargar.dataset.sucursalCiclo);
            return;
        }
        const btnEliminar = e.target.closest("[data-eliminar-ciclo]");
        if (btnEliminar) {
            if (!confirm("¿Eliminar este ciclo del histórico? No se puede deshacer.")) return;
            btnEliminar.disabled = true;
            eliminarHistoricoGestion(btnEliminar.dataset.eliminarCiclo, sucursalActiva).then((r) => {
                if (!r?.ok) {
                    alert(r?.error || "No se pudo eliminar — probá de nuevo.");
                    btnEliminar.disabled = false;
                    return;
                }
                renderHistoricoGestion();
            }).catch((err) => manejarFalloGuardadoGestion(err, () => { btnEliminar.disabled = false; }));
        }
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
    document.getElementById("btn-carga-masiva-tareas")?.addEventListener("click", () => abrirModalCargaMasiva());

    // "Recordatorio automático" — horario configurable, solo Admin
    // (2026-08-31). El <select> nace con "10:00" de placeholder (ver
    // cuerpoGestionHtml); acá se pisa con el valor real apenas llega,
    // sin bloquear el resto del render por este único dato.
    const selectHorario = document.getElementById("select-horario-recordatorio");
    if (selectHorario) {
        getHorarioRecordatorioGestion().then((r) => {
            if (r?.ok && selectHorario.isConnected) selectHorario.value = String(r.hora);
        });
        document.getElementById("btn-guardar-horario-recordatorio")?.addEventListener("click", (e) => {
            const boton = e.currentTarget;
            const textoOriginal = boton.textContent;
            boton.disabled = true;
            boton.textContent = "Guardando...";
            guardarHorarioRecordatorioGestion(selectHorario.value).then((r) => {
                boton.disabled = false;
                if (!r?.ok) {
                    alert(r?.error || "No se pudo guardar — probá de nuevo.");
                    boton.textContent = textoOriginal;
                    return;
                }
                boton.textContent = "✓ Guardado";
                setTimeout(() => { boton.textContent = textoOriginal; }, 2000);
            }).catch((err) => {
                boton.disabled = false;
                manejarFalloGuardadoGestion(err, () => { boton.textContent = textoOriginal; });
            });
        });
    }

    // "Reabrir tarea" (candado, solo Admin) — delegado en el mismo
    // contenedor estable que "Exportar a PDF" de abajo, mismo motivo:
    // el botón vive DENTRO de cada tarea (bannerCerradaHtml) y no
    // debería necesitar re-engancharse cada vez que recrearTareaEnPaneles
    // reconstruye una tarjeta.
    document.getElementById("contenido-gestion-imprimible")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-reabrir-tarea]");
        if (!btn) return;
        const { tareaId, dia } = btn.dataset;
        if (!confirm("¿Reabrir esta tarea? Vuelve a quedar editable, sin perder lo ya cargado.")) return;
        btn.disabled = true;
        reabrirTareaGestion(tareaId, dia, sucursalActiva).then((r) => {
            if (!r?.ok) {
                alert(r?.error || "No se pudo reabrir — probá de nuevo.");
                btn.disabled = false;
                return;
            }
            const clave = `${tareaId}|${dia}`;
            checksActivos[clave] = { ...checksActivos[clave], cerrada: false };
            recrearTareaEnPaneles(tareaId);
        }).catch((err) => manejarFalloGuardadoGestion(err, () => { btn.disabled = false; }));
    });

    // "Borrar registro" (candado rojo, solo Admin, 2026-09-02) — a
    // diferencia de "Reabrir" (arriba), esto BORRA de verdad hora,
    // quién la marcó y sus sub-ítems: la tarjeta vuelve a quedar sin
    // tocar. Mismo contenedor delegado que Reabrir/Exportar, mismo
    // motivo (el botón nace y muere con cada tarjeta).
    document.getElementById("contenido-gestion-imprimible")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-borrar-check]");
        if (!btn) return;
        const { tareaId, dia } = btn.dataset;
        const titulo = registroTareas.get(tareaId)?.titulo || "esta tarea";
        if (!confirm(`¿Borrar el registro de "${titulo}" de este día? Se pierden la hora, quién lo marcó y sus sub-ítems — la tarea vuelve a quedar sin tocar. No se puede deshacer.`)) return;
        btn.disabled = true;
        eliminarCheckGestion(tareaId, dia, sucursalActiva).then((r) => {
            if (!r?.ok) {
                alert(r?.error || "No se pudo borrar — probá de nuevo.");
                btn.disabled = false;
                return;
            }
            delete checksActivos[`${tareaId}|${dia}`];
            recrearTareaEnPaneles(tareaId);
        }).catch((err) => manejarFalloGuardadoGestion(err, () => { btn.disabled = false; }));
    });

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
        // Misma limitación que "Enviar push" — pedido explícito: "pon
        // la misma limitación que pusiste en push a exportar, es justo
        // lo que necesito, así siempre sale con el nombre de quien
        // hizo la tarea" — si la tarea de ESE botón (cada tarea tiene
        // el suyo, ver tareaHtml) tiene ítems sin responder, ni
        // arranca la descarga.
        const wrapDeEstaTarea = e.target.closest(".tarea-gestion-push");
        if (wrapDeEstaTarea) {
            const { tareaId: tId, dia: dDia } = wrapDeEstaTarea.dataset;
            if (!tareaEstaCompleta(tId, dDia)) {
                alert("Todavía quedan ítems sin responder (Hecho/No hecho) — completá la tarea antes de exportar.");
                return;
            }
            // "todo los ítem completos y una vez guardado habilita la
            // función enviar push y exportar" — pedido explícito:
            // completo mostrado en pantalla no alcanza si todavía no
            // se guardó (Guardar sigue en su estado "pendiente"), o
            // ese avance se pierde si se corta la conexión antes de
            // tocar Guardar, dejando un PDF exportado que no coincide
            // con lo que realmente quedó en la Sheet.
            if (tareasSinGuardarGestion.has(`${tId}|${dDia}`)) {
                alert("Tenés cambios sin guardar — tocá \"Guardar\" antes de exportar.");
                return;
            }
        }
        const marcasAgregadas = prepararSubitemsParaExportar("contenido-gestion-imprimible");

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
    // cada 5s. Sin esto el "casi en vivo" tardaba hasta 5 min en verse.
    invalidar(HOJAS.GESTION_CHECKS);
    let frescos;
    try {
        frescos = await getChecksPorSucursal(sucursalActiva);
    } catch (err) {
        return; // silencioso — es un refresco de fondo, no una acción del usuario
    }
    // Mismo filtro de ciclo que la carga inicial (ver filtrarChecksCicloActual)
    // — sin esto, una tarea del ciclo pasado (todavía sin tocar en el
    // ciclo nuevo) volvía a aparecer marcada apenas pasaban 20s.
    checksActivos = filtrarChecksCicloActual(frescos);

    document.querySelectorAll("#contenido-gestion-imprimible .tarea-gestion[data-tarea-id][data-dia]").forEach((tarjeta) => {
        const tareaId = tarjeta.dataset.tareaId;
        const dia = tarjeta.dataset.dia;
        const check = checksActivos[`${tareaId}|${dia}`];
        // Mismo criterio que tareaHtml — sin este chequeo acá, el
        // repaso de fondo cada 5s pisaba el candado de "día
        // equivocado" que puso el render inicial, dejando la tarjeta
        // editable de nuevo a los 20s (bug real encontrado probando
        // este mismo fix: se veía bloqueada al abrir, pero se
        // desbloqueaba sola apenas corría este repaso).
        const diaEquivocado = !esVistaLectura && !check?.cerrada && !esDiaDeHoyGestion(dia);
        const bloqueada = !!check?.cerrada || diaEquivocado;
        const hechoTexto = check?.hecho ? `Hecho ${check.hora || ""}${check.marcadoPor ? ` · ${check.marcadoPor}` : ""}` : "";
        const hora = tarjeta.querySelector("[data-hora]");
        if (hora) hora.textContent = hechoTexto;
        tarjeta.classList.toggle("hecha", !!check?.hecho);
        tarjeta.classList.toggle("bloqueada", bloqueada);

        // Candado rojo de Admin — aparece/desaparece según si ahora
        // hay algo marcado, mismo criterio que tareaHtml (puedeBorrarCheck).
        const puedeBorrarCheckAhora = !!check && esAdminActual();
        tarjeta.classList.toggle("con-borrar-admin", puedeBorrarCheckAhora);
        const btnBorrarExistente = tarjeta.querySelector("[data-borrar-check]");
        if (puedeBorrarCheckAhora && !btnBorrarExistente) {
            // afterend de un hijo DE ADENTRO de la tarjeta (header si es
            // desplegable, el <label> si es simple) — nunca de la
            // tarjeta misma, eso la insertaría FUERA como hermana.
            const destino = tarjeta.querySelector("[data-toggle-desplegable], .tarea-gestion-label");
            destino?.insertAdjacentHTML("afterend", `<button type="button" class="btn-borrar-check-admin" data-borrar-check data-tarea-id="${tareaId}" data-dia="${dia}" title="Borrar este registro (Admin)" aria-label="Borrar este registro">${Icon("tacho", { size: 15 })}</button>`);
        } else if (!puedeBorrarCheckAhora && btnBorrarExistente) {
            btnBorrarExistente.remove();
        }

        const checkSimple = tarjeta.querySelector(".tarea-gestion-check");
        if (checkSimple) {
            checkSimple.checked = !!check?.hecho;
            checkSimple.disabled = esVistaLectura || bloqueada;
        }

        // Banner "Cerrada por..." (candado) — se agrega/saca acá mismo
        // si el estado cambió desde el último repaso (ej. otro
        // dispositivo cerró esta tarea recién). No pisa el resto de la
        // tarjeta: es un nodo aparte, mismo criterio que bannerCerradaHtml.
        const bannerExistente = tarjeta.querySelector(".tarea-gestion-banner-cerrada");
        if (bloqueada && !bannerExistente) {
            const header = tarjeta.querySelector("[data-toggle-desplegable]") || tarjeta.querySelector(".tarea-gestion-label");
            header?.insertAdjacentHTML("afterend", bannerCerradaHtml(check, tareaId, dia, diaEquivocado));
        } else if (!bloqueada && bannerExistente) {
            bannerExistente.remove();
        }

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
            const firmas = check?.firmas || new Map();
            contenedorSubitems.innerHTML = tarea.subitems.map((s, is) => subitemFilaHtml(`tarea-${tareaId}-${dia}`, is, tarea.subitems, marcados, firmas, bloqueada)).join("");
            const progreso = tarjeta.querySelector("[data-progreso]");
            if (progreso) progreso.textContent = `${marcados.size}/${tarea.subitems.length}`;
            const badgeWrap = tarjeta.querySelector("[data-badge-incidencia]");
            if (badgeWrap) badgeWrap.innerHTML = badgeIncidenciaContenido(tarea.subitems, marcados);
            const guardarWrap = tarjeta.querySelector(".tarea-gestion-guardar");
            if (guardarWrap) guardarWrap.style.display = bloqueada ? "none" : "";
        }
    });
}

/** Firma barata de un catálogo de tareas — para detectar "¿cambió de
 *  verdad algo?" sin comparar objetos completos. Solo los campos que
 *  se ven en pantalla; si el backend agrega uno nuevo que no se
 *  muestra, no hace falta que dispare un refresco. */
function firmaCatalogoGestion(tareas) {
    return JSON.stringify(tareas.map((t) => [t.id, t.dias, t.frecuencia, t.titulo, t.detalle, t.icono, t.aplicaA, t.recordatorioHabilitado, t.recordatorioHora, (t.subitems || []).join("|")]));
}

/** Espejo de actualizarChecksEnDOM, pero para el CATÁLOGO — qué tareas
 *  existen y qué días/frecuencia tiene cada una en ESTA sucursal.
 *  Pedido explícito (2026-09-02): "el Responsable de local carga sus
 *  tareas y no impacta al toque, hay que refrescar sí o sí" — el
 *  repaso de 20s ya existente solo traía el "hecho" fresco (ver
 *  arriba), nunca esto: un Admin mirando el mismo local, o el mismo
 *  Responsable en otro celular, no veía una tarea nueva ni un día
 *  agregado hasta recargar la página entera.
 *
 * Reconstruye TODO #cuerpo-gestion (mismo camino que elegirLocalGestion
 * al cambiar de local) — pero SOLO si de verdad cambió algo
 * (firmaCatalogoGestion), para no perder el desplegable/scroll de
 * quien esté mirando algo puntual cada 5s porque sí. */
async function actualizarCatalogoGestionEnDOM() {
    if (!sucursalActiva) return;
    // Mismos guards que actualizarChecksEnDOM — no pisar una edición
    // en curso: sub-ítems sin guardar, un guardado de check reciente,
    // o una ráfaga de días con el debounce todavía pendiente (ver
    // bindDiasControl) — reconstruir el DOM ahí abajo perdería el
    // toque que la persona acaba de hacer.
    if (tareasSinGuardarGestion.size > 0) return;
    if (timersDias.size > 0) return;
    if (Date.now() - ultimaEdicionLocalGestion < MARGEN_EDICION_LOCAL_MS) return;

    invalidar(HOJAS.GESTION_TAREAS);
    invalidar(HOJAS.GESTION_TAREAS_SUCURSAL);
    let catalogo, dias;
    try {
        [catalogo, dias] = await Promise.all([getTareas(), getDiasPorSucursal(sucursalActiva)]);
    } catch (err) {
        return; // silencioso — refresco de fondo, no una acción del usuario
    }
    catalogo.forEach((t) => {
        const info = dias[t.id];
        t.dias = info?.dias || [];
        t.frecuencia = info?.frecuencia || "semanal";
    });

    if (firmaCatalogoGestion(catalogo) === firmaCatalogoGestion(TAREAS)) return; // nada cambió, no tocar el DOM

    TAREAS = catalogo;
    registroTareas.clear();
    TAREAS.forEach((t) => registroTareas.set(t.id, t));

    const cuerpo = document.getElementById("cuerpo-gestion");
    if (!cuerpo) return;
    cuerpo.innerHTML = cuerpoGestionHtml();
    bindCuerpoGestion();
}

let intervaloChecksGestion = null;

/** Marca de tiempo del último tilde/toque LOCAL en cualquier check —
 *  pedido explícito, con captura real: "el marcar sub-tareas las
 *  carga, las quita, las regresa de nuevo". Causa real: el repaso de
 *  fondo cada 5s (actualizarChecksEnDOM) puede llegar a leer el
 *  backend justo en el hueco entre "tocaste algo" y "el guardado
 *  (~1-2s de Apps Script) todavía no terminó de escribirse" — ese
 *  repaso trae el estado VIEJO y pisa el cambio recién hecho por un
 *  instante, hasta el próximo ciclo. Saltear un ciclo de repaso justo
 *  después de un toque local evita la carrera: unos segundos de
 *  margen alcanzan de sobra para que Apps Script termine de escribir. */
let ultimaEdicionLocalGestion = 0;
const MARGEN_EDICION_LOCAL_MS = 4000;

export function bindGestion() {
    document.getElementById("btn-ayuda-gestion")?.addEventListener("click", () => {
        alert("Asigná las tareas que correspondan a tu local. Recibirás recordatorios para una mejor gestión y también podrás avisar manualmente al completarlas. Luego, exportá el registro para un segundo control.");
    });

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

    // Refresco en segundo plano de los checks — cada 5s mientras se
    // esté en esta pantalla, sin recargar nada ni molestar lo que se
    // esté mirando. Se corta solo apenas el nodo desaparece (se
    // navegó a otra pantalla) — no hay hook de "salir de la página"
    // en este router, así que el propio intervalo se autochequea.
    if (intervaloChecksGestion) clearInterval(intervaloChecksGestion);
    intervaloChecksGestion = setInterval(async () => {
        if (!document.getElementById("cuerpo-gestion")) {
            clearInterval(intervaloChecksGestion);
            intervaloChecksGestion = null;
            return;
        }
        // Primero los "hecho" (parcheo puntual, liviano); recién
        // después el catálogo (puede reconstruir todo el cuerpo) —
        // así, si reconstruye, lo hace con el check más fresco posible.
        await actualizarChecksEnDOM();
        actualizarCatalogoGestionEnDOM();
    }, 5000);
}
