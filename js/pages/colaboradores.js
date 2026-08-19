/* ============================
   Lucciano's Academy
   pages/colaboradores.js — Gestión de personas (Colaboradores,
   Supervisores y Admins)

   Admin ve todos los colaboradores; Supervisor solo los de sus
   propios locales (un supervisor puede tener más de una sucursal a
   cargo — Sucursales.supervisor matchea por nombre, mismo criterio
   que ya usa inicioSupervisor.js — así que acá se agrupan visualmente
   por sucursal); Encargado ve su única sucursal, sin agrupar.

   Acceso con vencimiento: cuando un Supervisor/Admin registra un
   colaborador nuevo desde acá, el acceso queda con vencimiento a 30
   días (fechaVencimientoAcceso). Cada vez que se abre esta pantalla
   se revisa si algún acceso ya venció y se desactiva solo — no hay
   proceso corriendo en segundo plano en esta arquitectura (sitio
   estático + Sheets), así que este es el punto más cercano a
   "automático" sin sumar infraestructura nueva. El otro punto de
   chequeo es el login real (ver apps-script/Code.gs).

   Renovación automática por uso: ese vencimiento se corre solo 30 días
   hacia adelante en CADA ingreso (_registrarIngreso, en Code.gs). O
   sea que quien trabaja nunca vence y el Supervisor no tiene que
   renovar a nadie a mano; quien se fue de la empresa deja de entrar y
   su acceso caduca solo. Antes la única salida a esa fricción era
   "Hacer permanente", que dejaba a alguien que ya no trabaja acá con
   acceso a la base para siempre — por eso esa opción ya no existe
   para colaboradores. La columna "Último ingreso" muestra a quién
   conviene revisar, y "Deshabilitar" sigue siendo el corte inmediato
   para cuando se sabe que la persona se fue.

   Por eso el menú de acceso quedó con DOS opciones excluyentes
   (Renovar / Deshabilitar) y no con cinco. Las extensiones sueltas
   (+15, +30) se sacaron por quedar sin función: a alguien activo el
   vencimiento ya se le corre solo, y a alguien vencido no lo alcanzan
   —quedó inactivo, no puede entrar, y por lo tanto tampoco puede
   autorrenovarse—, que es justo para lo que está "Renovar".

   Solo Admin ve pestañas de rol (Colaboradores/Supervisores/Admins)
   — antes existía una pantalla "Usuarios" aparte para gestionar los
   3 roles, pero pisaba casi el mismo contenido que esta ("¿cuál uso
   para dar de alta a alguien?"). Se unificó todo acá: Supervisor/
   Encargado siguen viendo exactamente lo mismo que antes (nunca ven
   las pestañas ni datos de otros roles), solo cambia la experiencia
   de Admin.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { AutocompleteSucursal, bindAutocompleteSucursal } from "../components/autocompleteSucursal.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { getUsuarios, getColaboradores, getColaboradoresPorSucursal, crearUsuario, actualizarUsuario, eliminarUsuario, etiquetaColaborador, ETIQUETA_RESPONSABLE_LOCAL, ETIQUETA_RESPONSABLE_TURNO } from "../data/usuarios.js";
import { getSucursales, crearSucursal, actualizarSucursal, getMisLocales, getLocalesVisibles, agregarSupervisorASucursal, quitarSupervisorDeSucursal } from "../data/sucursales.js";
import { getAsignaciones, getAsignacionesPorColaborador, eliminarAsignacion } from "../data/asignaciones.js";
import { getResultados, getResultadosPorColaborador, eliminarResultado } from "../data/resultados.js";
import { getCursos } from "../data/cursos.js";
import { getEvaluaciones } from "../data/evaluaciones.js";
import { getLecciones } from "../data/lecciones.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual, verComo } from "../services/auth.js";
import { enviarMail } from "../services/mail.js";
import { getLocalesElegidos, setLocalesElegidos } from "../services/preferenciasLocales.js";
import { navigate } from "../router.js";
import { Avatar } from "../components/avatar.js";
import { celdaPct, estadoEvaluacion, progresoCursoDePersona, barraProgreso, leccionesDePersona, kpisSemaforo } from "./reportes.js";
import { exportarAPdf, membreteHtml } from "../services/exportarPdf.js";
import { escaparHtml } from "../services/html.js";
import { cursosDeLaPersona, cursoAplicaAPersona } from "../services/alcance.js";

const DIAS_ACCESO_INICIAL = 30;
const DIAS_AVISO_VENCIMIENTO = 7;

// Fechas como string "YYYY-MM-DD" en vez de Date — evita el desfasaje
// de un día que da new Date("YYYY-MM-DD") al leerla en hora local
// (Argentina, UTC-3), mismo criterio que ya se usa en otras páginas.
function fechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sumarDias(fechaISO, dias) {
    const [y, m, d] = fechaISO.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);
    fecha.setDate(fecha.getDate() + dias);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function diasEntre(desdeISO, hastaISO) {
    const [y1, m1, d1] = desdeISO.split("-").map(Number);
    const [y2, m2, d2] = hastaISO.split("-").map(Number);
    const ms = new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    return Math.round(ms / 86400000);
}

// "YYYY-MM-DD" -> "DD-MM-AAAA" (formato de fecha argentino, sin hora).
function aFechaDMA(fechaISO) {
    const [y, m, d] = fechaISO.split("-");
    return `${d}-${m}-${y}`;
}

/** A partir de cuántos días sin entrar una cuenta se considera dormida.
 *  Igual a DIAS_ACCESO_INICIAL a propósito: con la renovación
 *  automática por uso, quien no entró en esa ventana es exactamente
 *  quien está por vencer solo. */
const DIAS_INACTIVIDAD_DORMIDA = DIAS_ACCESO_INICIAL;

/**
 * Última vez que la persona entró. Es la señal real de "¿sigue en la
 * empresa?" — más honesta que la fecha de vencimiento, que solo dice
 * hasta cuándo alguien le dejó el acceso abierto.
 *
 * Vacío = nunca entró desde que se empezó a registrar (columna
 * ultimoIngreso, agregada 2026-08-09). En los usuarios previos eso NO
 * significa que nunca hayan usado la app, así que se muestra distinto
 * de "hace mucho": "Sin registro", en gris y sin alarma.
 */
function badgeUltimoIngreso(colaborador) {
    if (!colaborador.ultimoIngreso) {
        return `<span class="badge badge-muted" title="Todavía no entró desde que se registra este dato">Sin registro</span>`;
    }
    const dias = -diasEntre(fechaHoyISO(), colaborador.ultimoIngreso);
    if (dias <= 0) return `<span class="badge badge-success">Hoy</span>`;
    if (dias === 1) return `<span class="badge badge-success">Ayer</span>`;
    if (dias < DIAS_INACTIVIDAD_DORMIDA) return `<span class="badge badge-muted">Hace ${dias} días</span>`;
    return `<span class="badge badge-warning" title="Sin entrar hace ${dias} días — revisá si sigue en la empresa">Hace ${dias} días</span>`;
}

function estadoAcceso(colaborador) {
    if (!colaborador.fechaVencimientoAcceso) {
        return { texto: "Permanente", clase: "badge-muted", vencido: false };
    }
    const restantes = diasEntre(fechaHoyISO(), colaborador.fechaVencimientoAcceso);
    if (restantes < 0) return { texto: "Vencido", clase: "badge-danger", vencido: true };
    if (restantes <= DIAS_AVISO_VENCIMIENTO) return { texto: `Vence en ${restantes} día(s)`, clase: "badge-warning", vencido: false };
    return { texto: `Vence ${aFechaDMA(colaborador.fechaVencimientoAcceso)}`, clase: "badge-muted", vencido: false };
}

function badgeAcceso(colaborador) {
    return colaborador.activo === "SI"
        ? `<span class="badge badge-success">Activo</span>`
        : `<span class="badge badge-danger">Sin acceso</span>`;
}

function badgeVencimiento(colaborador) {
    const e = estadoAcceso(colaborador);
    return `<span class="badge ${e.clase}">${e.texto}</span>`;
}

/** Versión liviana de AutocompleteSucursal para el campo de
 *  Supervisor: la lista ya está en memoria (no hace falta un fetch
 *  propio), así que no vale la pena un componente aparte — reusa las
 *  mismas clases CSS (.autocomplete-wrap/.autocomplete-list) para
 *  verse igual. Reemplaza al <input list="datalist"> nativo, que en
 *  varios navegadores vacía el campo al elegir una sugerencia sobre
 *  un valor ya precargado. */
function autocompleteSimpleHtml(inputId, valorInicial, placeholder) {
    return `
        <div class="autocomplete-wrap">
            <input id="${inputId}" type="text" autocomplete="off" placeholder="${placeholder}" value="${valorInicial}">
            <div id="${inputId}-list" class="autocomplete-list"></div>
        </div>
    `;
}

function bindAutocompleteSimple(inputId, opciones) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(`${inputId}-list`);
    if (!input || !list) return;

    const render = (valor) => {
        const q = valor.toLowerCase().trim();
        const filtradas = q ? opciones.filter((n) => n.toLowerCase().includes(q)) : opciones;
        list.innerHTML = filtradas.length
            ? filtradas.slice(0, 8).map((n) => `<div class="autocomplete-item">${n}</div>`).join("")
            : `<div class="autocomplete-item" style="opacity:.6;cursor:default">Sin coincidencias</div>`;
        list.classList.add("open");
    };

    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => render(input.value));

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".autocomplete-item");
        if (!item || item.style.opacity === "0.6") return;
        input.value = item.textContent;
        list.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(`#${inputId}, #${inputId}-list`)) list.classList.remove("open");
    });
}

/** Campo Sucursal del modal de alta/edición, según quién lo abre: Admin
 *  y Supervisor eligen entre las ~99 (autocomplete libre — un supervisor
 *  puede necesitar cargar gente en un local que todavía no es "suyo" en
 *  Sucursales, o uno directamente nuevo); Encargado no elige, queda
 *  fijo a su única sucursal. Ver asegurarSucursalAsignada() para cómo
 *  se resuelve/crea esa sucursal al guardar. */
async function campoSucursalModal(usuario, valorActual = "") {
    if (usuario.rol === "admin" || usuario.rol === "supervisor") {
        const esAdmin = usuario.rol === "admin";
        // Solo Admin ve el campo de supervisor — la mayoría de los 99
        // locales reales no tienen uno cargado todavía (quedaron así
        // desde el alta masiva), así que el Admin necesita poder
        // asignarlo él mismo al corregir/cargar gente, sin depender de
        // que el supervisor "reclame" su local desde acá.
        const [sucursales, supervisores] = esAdmin
            ? await Promise.all([getSucursales(), getUsuarios()])
            : [[], []];
        // Un local puede tener más de un supervisor (ej. cobertura de
        // vacaciones) — se muestran los actuales como texto informativo
        // y el campo de abajo solo AGREGA uno nuevo, nunca pisa a los
        // que ya estaban. Para sacar a alguien, se edita desde su
        // propio perfil de supervisor (destildar el local ahí).
        const sucursalActual = sucursales.find((s) => s.nombre === valorActual);
        const supervisoresActuales = sucursalActual?.supervisor
            ? sucursalActual.supervisor.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        const nombresSupervisores = supervisores.filter((u) => u.rol === "supervisor").map((u) => u.nombre);

        return {
            html: `
                <label for="input-sucursal">Sucursal</label>
                ${AutocompleteSucursal("input-sucursal", valorActual)}
                ${esAdmin ? `
                    <label style="margin-top:14px">Supervisor(es) de esta sucursal</label>
                    <p class="text-sm" style="margin-top:2px">${supervisoresActuales.length ? supervisoresActuales.join(", ") : "Sin asignar"}</p>
                    ${autocompleteSimpleHtml("input-supervisor-sucursal", "", "Agregar otro supervisor...")}
                    <p class="text-xs text-muted" style="margin-top:4px">Se guarda en el local (afecta a todo el equipo de esa sucursal, no solo a esta persona) — se suma a los que ya estén, no los reemplaza. Para sacar a alguien, editá su propio perfil de supervisor.</p>
                ` : ""}
            `,
            bind: () => {
                bindAutocompleteSucursal("input-sucursal");
                if (esAdmin) bindAutocompleteSimple("input-supervisor-sucursal", nombresSupervisores);
            },
            leer: () => document.getElementById("input-sucursal").value.trim(),
            leerSupervisor: esAdmin ? () => document.getElementById("input-supervisor-sucursal").value.trim() : null,
        };
    }
    // Encargado: una sola sucursal, la suya — no hay nada que elegir.
    return { html: "", bind: () => {}, leer: () => usuario.sucursal, leerSupervisor: null };
}

/** Si un Supervisor eligió/escribió una sucursal que todavía no existe
 *  en la hoja Sucursales, la crea; si existe pero nadie figura como su
 *  supervisor, se lo asigna a él automáticamente. Así el colaborador
 *  siempre termina bien agrupado en "Mi equipo" (getMisLocales),
 *  sin depender de que ese vínculo ya estuviera cargado a mano. Si el
 *  local ya tiene otro supervisor asignado, no se lo pisa. */
async function asegurarSucursalAsignada(nombreSucursal, usuario) {
    if (usuario.rol !== "supervisor" || !nombreSucursal) return;
    const sucursales = await getSucursales();
    const existente = sucursales.find((s) => s.nombre === nombreSucursal);
    if (!existente) {
        await crearSucursal({ nombre: nombreSucursal, supervisor: usuario.nombre });
    } else if (!existente.supervisor) {
        await actualizarSucursal(existente.id, { supervisor: usuario.nombre });
    }
}

/** Contraparte para Admin: a diferencia de asegurarSucursalAsignada
 *  (que un Supervisor solo puede "reclamar" un local sin dueño), acá
 *  el Admin decide explícitamente sumar un supervisor a esta sucursal
 *  — se AGREGA a la lista (un local puede tener más de uno, ej.
 *  cobertura de vacaciones), nunca pisa a los que ya estaban. Un
 *  valor vacío no hace nada (para sacar a alguien, ver el perfil de
 *  ese supervisor). */
async function asignarSupervisorASucursal(nombreSucursal, nombreSupervisor) {
    if (!nombreSucursal || !nombreSupervisor) return;
    const sucursales = await getSucursales();
    const existente = sucursales.find((s) => s.nombre === nombreSucursal);
    if (!existente) {
        await crearSucursal({ nombre: nombreSucursal, supervisor: nombreSupervisor });
    } else {
        await agregarSupervisorASucursal(existente.id, nombreSupervisor);
    }
}

/** Un solo botón "⋮" por fila que despliega las acciones agrupadas
 *  por categoría, en vez de 4-5 botones sueltos apretados en la
 *  celda (Editar / Renovar / +15 días / Permanente / Eliminar, todos
 *  al mismo nivel visual, costaba distinguir cuál era cuál). Cada
 *  ítem adentro sigue usando el MISMO data-attribute de siempre — no
 *  se tocó ningún handler ya conectado, solo cómo se agrupan. */
function menuAcciones(grupos) {
    const cuerpo = grupos
        .filter((g) => g.items.length)
        .map((g) => `${g.titulo ? `<div class="menu-acciones-categoria">${g.titulo}</div>` : ""}${g.items.join("")}`)
        .join(`<div class="menu-acciones-separador"></div>`);

    return `
        <div class="menu-acciones-wrap">
            <button class="btn btn-secondary menu-acciones-toggle" type="button" data-menu-toggle aria-label="Acciones">⋮</button>
            <div class="menu-acciones-dropdown" hidden>${cuerpo}</div>
        </div>
    `;
}

function filaAcciones(colaborador, puedeDeshabilitar, puedeEditar, esAdmin) {
    const grupos = [];

    // "Ver como" — igual criterio que filaAccionesGenerico (tabla de
    // Supervisores/Admins): no aplica a otro Admin, y antes solo vivía
    // ahí, sin forma de probar el flujo como un Colaborador puntual
    // desde "Mi equipo". Admin-only, mismo alcance que ya tenía.
    const verComoBtn = esAdmin && colaborador.rol !== "admin"
        ? `<button class="menu-acciones-item" data-ver-como-usuario="${colaborador.id}">Ver como</button>`
        : "";

    if (puedeEditar || verComoBtn) {
        grupos.push({ items: [puedeEditar ? `<button class="menu-acciones-item" data-editar="${colaborador.id}">Editar</button>` : "", verComoBtn].filter(Boolean) });
    }

    // Gestión de acceso — Encargado (puedeDeshabilitar=false) no debe
    // ver ninguno de estos ítems, solo el estado.
    //
    // Quedan DOS opciones y son excluyentes: o la persona está adentro y
    // se la puede sacar, o está afuera y se la puede volver a meter. Con
    // la renovación automática por uso (_registrarIngreso, Code.gs) no
    // hace falta nada más:
    //
    // - "Hacer permanente" se sacó porque era la vía por la que alguien
    //   que se iba de la empresa quedaba con acceso a la base para
    //   siempre. Supervisores y admins siguen sin vencimiento, pero
    //   porque se crean sin fecha, no porque alguien los marque acá.
    // - "+15 días" y "+30 días" se sacaron porque quedaron sin función:
    //   a un colaborador ACTIVO el vencimiento ya se le corre solo en
    //   cada ingreso, así que extenderlo a mano es empujar una fecha que
    //   se vuelve a empujar sola. Y a uno vencido no lo alcanzan: quedó
    //   inactivo, no puede entrar, y por lo tanto tampoco puede
    //   autorrenovarse — para ese caso está "Renovar". Criterio del
    //   usuario: "quien la necesite pedirá acceso".
    if (puedeDeshabilitar) {
        const itemsAcceso = colaborador.activo !== "SI"
            // Dice los días a propósito: "Renovar acceso" a secas no los
            // mencionaba, así que nadie sabía que este era el botón de
            // +30 y se terminaba recurriendo a "Hacer permanente".
            ? [`<button class="menu-acciones-item" data-renovar="${colaborador.id}">Renovar (+${DIAS_ACCESO_INICIAL} días)</button>`]
            : [`<button class="menu-acciones-item" data-deshabilitar="${colaborador.id}">Deshabilitar</button>`];

        // Colaborador que quedó PERMANENTE de antes (celda de vencimiento
        // vacía). Al sacar "Hacer permanente" quedó sin su inverso: no
        // había ninguna forma de devolverlo al modelo de renovación por
        // uso, y encima la renovación automática no lo alcanza (solo
        // corre una fecha que ya existe). Reportado en vivo: "revisá a
        // estos dos que están en permanente y no puedo cambiarlo".
        // Solo para rol colaborador: en un supervisor o admin el acceso
        // sin vencimiento es lo correcto, no algo que haya que "quitar".
        // Hoy este menú solo lo usan filas de colaborador, pero dejarlo
        // explícito evita que reusarlo en otra tabla ofrezca degradar a
        // un supervisor sin querer.
        if (!colaborador.fechaVencimientoAcceso && colaborador.rol === "colaborador") {
            itemsAcceso.push(`<button class="menu-acciones-item" data-quitar-permanente="${colaborador.id}">Quitar permanente (+${DIAS_ACCESO_INICIAL} días)</button>`);
        }

        grupos.push({ titulo: "Acceso", items: itemsAcceso });
    }

    // Eliminar (borrado real, no solo deshabilitar acceso) quedaba
    // antes en la vieja pantalla "Usuarios" — al unificarla acá se
    // había perdido para Colaborador. Reusa el mismo data-eliminar-
    // usuario ya conectado (borrado en cascada de Asignaciones/
    // Resultados) — admin-only, Supervisor sigue sin poder borrar
    // gente, solo deshabilitar su acceso.
    if (esAdmin) {
        grupos.push({ items: [`<button class="menu-acciones-item menu-acciones-item-danger" data-eliminar-usuario="${colaborador.id}">Eliminar</button>`] });
    }

    // Sin ninguna acción disponible (ej. Capacitador, solo lectura en
    // toda la app), no tiene sentido dibujar el botón "⋮" — un menú
    // que abre vacío al clickear parece roto.
    if (!grupos.length) return "";

    return menuAcciones(grupos);
}

/** Checkbox de selección para "Enviar mail" (ver bindEnviarMail) — se
 *  suma como primera columna solo para Admin (ver COLUMNAS_BASE),
 *  nunca para Supervisor/Encargado. */
/** El mismo checkbox sirve para mandar mails y para las acciones de
 *  acceso en bloque, así que lleva también el id: sin él, "renovar a
 *  los seleccionados" tendría que resolver cada email contra la nómina
 *  otra vez. */
function checkboxMail(id, email, nombre) {
    if (!email) return "";
    return `<input type="checkbox" class="mail-check" style="width:auto" data-mail-id="${id}" data-mail-email="${email}" data-mail-nombre="${escaparHtml(nombre)}">`;
}

const COLUMNAS_BASE = (mostrarSucursal, puedeEnviarMail) => [
    ...(puedeEnviarMail ? [{ key: "seleccion", label: "" }] : []),
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "rolLabel", label: "Rol" },
    ...(mostrarSucursal ? [{ key: "sucursal", label: "Sucursal" }] : []),
    { key: "progresoBadge", label: "Progreso" },
    { key: "estadoBadge", label: "Estado" },
    { key: "ultimoIngresoBadge", label: `Último ingreso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="El acceso se renueva solo cada vez que la persona entra, así que no hace falta ir extendiéndolo. Si alguien deja de entrar, su acceso caduca solo a los ${DIAS_ACCESO_INICIAL} días. Esta columna te muestra a quién conviene revisar.">ⓘ</span>` },
    { key: "accesoBadge", label: `Acceso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Se renueva solo a 30 días cada vez que la persona entra. Tocá los tres puntos (⋮) para editar, deshabilitar el acceso o volver a habilitarlo.">ⓘ</span>` },
    { key: "acciones", label: "" },
];

/** % real del camino completo de un colaborador — sobre el TOTAL de
 *  cursos que le corresponden (mismo filtro de categoría "Gestión"
 *  que usa cursos.js), no solo sobre los que ya arrancó. Una
 *  asignación recién se crea cuando el colaborador ve su primera
 *  lección de ese curso (ver cursos.js) — promediar solo esas filas
 *  infla el número (1 curso terminado de 8 mostraba "100%" en vez de
 *  ~13%, porque los 7 sin arrancar ni entraban a la cuenta). Los
 *  cursos sin asignación cuentan como 0, no se descartan.
 *  null solo si la persona no tiene ningún curso aplicable. */
function progresoColaborador(colaborador, asignaciones, cursos) {
    const cursosAplicables = cursosDeLaPersona(cursos, colaborador);
    if (!cursosAplicables.length) return { pct: null, hechos: 0, total: 0 };

    const propias = asignaciones.filter((a) => String(a.colaboradorId) === String(colaborador.id));
    const suma = cursosAplicables.reduce((s, cur) => {
        const a = propias.find((x) => String(x.cursoId) === String(cur.id));
        return s + (a ? a.progreso : 0);
    }, 0);
    // Mismo filtro de "aplicables" que "total" — sin esto, una
    // asignación no aplicable (ej. de un curso de Gestión en alguien
    // que no es encargado) marcada "completado" infla "hechos" sin
    // inflar "total", mostrando cosas imposibles como "9 de 7".
    const idsCursosAplicables = cursosAplicables.map((cur) => String(cur.id));
    const hechos = propias.filter((a) => a.estado === "completado" && idsCursosAplicables.includes(String(a.cursoId))).length;

    return { pct: Math.round(suma / cursosAplicables.length), hechos, total: cursosAplicables.length };
}

/** Avatar circular (foto o iniciales, ver components/avatar.js) +
 *  nombre + subtítulo de rol, para la columna "Nombre" de las 3 tablas
 *  de Colaboradores (Admin, Supervisor/Semáforo, y la matriz de
 *  reportes.js) — pedido de rediseño visual del usuario, fiel a la
 *  referencia (foto de perfil grande junto al nombre, con el cargo
 *  debajo, no texto plano). */
function nombreConAvatar(nombre, foto, subtitulo) {
    return `
        <div class="fila-avatar-nombre">
            ${Avatar({ nombre, foto, size: "" })}
            <div>
                <div class="fila-avatar-nombre-txt">${nombre}</div>
                ${subtitulo ? `<div class="fila-avatar-nombre-sub">${subtitulo}</div>` : ""}
            </div>
        </div>
    `;
}

function badgeProgreso({ pct, hechos, total }) {
    if (pct === null) return `<span class="text-xs text-muted">Sin datos</span>`;
    const tono = pct < 30 ? "danger" : pct < 60 ? "warning" : "success";
    return `
        <div class="progreso-mini">
            <div class="progreso-mini-barra"><i class="progreso-mini-${tono}" style="width:${pct}%"></i></div>
            <span class="progreso-mini-valor progreso-mini-texto-${tono}">${pct}%</span>
            <span class="text-xs text-muted">(${hechos}/${total} cursos)</span>
        </div>
    `;
}

function filaDeColaborador(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin) {
    const progreso = progresoColaborador(c, asignaciones, cursos);
    return {
        ...c,
        nombre: nombreConAvatar(c.nombre, c.foto, etiquetaColaborador(c)),
        seleccion: checkboxMail(c.id, c.email, c.nombre),
        rolLabel: c.encargado || c.responsableTurno ? `Colaborador (${etiquetaColaborador(c)})` : "Colaborador",
        // El filtro de la pill lee ESTO, no el texto de la fila. Antes
        // buscaba la cadena "(Encargado)" adentro del HTML, así que
        // renombrar la etiqueta lo dejaba sin encontrar a nadie sin
        // avisar — justo lo que este cambio venía a hacer.
        _datos: { encargado: c.encargado ? "si" : "no" },
        progreso: progreso.pct,
        progresoBadge: badgeProgreso(progreso),
        estadoBadge: badgeAcceso(c),
        ultimoIngresoBadge: badgeUltimoIngreso(c),
        accesoBadge: badgeVencimiento(c),
        acciones: filaAcciones(c, puedeDeshabilitar, puedeEditar, esAdmin),
    };
}

/** Los más atrasados primero — sin datos cuenta como el caso más
 *  urgente de todos (ni siquiera arrancó), junto a los de progreso
 *  bajo real. Con equipos de 8 a 16 personas por local, este orden
 *  es lo que le permite a un supervisor/encargado detectar de un
 *  vistazo a quién hay que hacerle seguimiento. */
function ordenarPorProgresoAscendente(filas) {
    return filas.slice().sort((a, b) => (a.progreso ?? -1) - (b.progreso ?? -1));
}

/** Los últimos dados de alta primero — por fechaAlta (ver
 *  data/usuarios.js). Es la vista del Admin: acaba de cargar/está
 *  revisando altas recientes, así que le sirve más ver "qué se
 *  cargó último" que "quién va atrasado" (eso sigue siendo lo que
 *  ve Supervisor/Encargado, coaching de su propio equipo). Sin
 *  fechaAlta (usuarios de antes de esa columna) quedan al final,
 *  no arriba — no son "los más nuevos".
 */
function ordenarPorFechaAltaDescendente(filas) {
    return filas.slice().sort((a, b) => (b.fechaAlta || "").localeCompare(a.fechaAlta || ""));
}

// ---- Filas de Supervisor/Admin (pestañas de rol, solo Admin) ----
// Sin progreso ni vencimiento de acceso — esos dos conceptos son de
// Colaborador (asignaciones/resultados, acceso de prueba). Acá el
// estado es simplemente Activo/Inactivo, mismo criterio que tenía
// la vieja pantalla "Usuarios".

const ROL_BADGE_GENERICO = {
    admin: `<span class="badge badge-warning">Administrador</span>`,
    supervisor: `<span class="badge badge-success">Supervisor</span>`,
};

// Capacitador = Supervisor con otra etiqueta, mismo rol y permisos —
// para dar de alta a un capacitador sin que se confunda con "el"
// supervisor de un local.
function rolLabelGenerico(u) {
    if (u.rol === "supervisor" && u.capacitador) {
        return `<span class="badge badge-success">Supervisor (Capacitador)</span>`;
    }
    return ROL_BADGE_GENERICO[u.rol] || u.rol;
}

function badgeEstadoGenerico(u) {
    return u.activo === "SI"
        ? `<span class="badge badge-success">Activo</span>`
        : `<span class="badge badge-danger">Inactivo</span>`;
}

function filaAccionesGenerico(u) {
    const toggle = u.activo === "SI"
        ? `<button class="menu-acciones-item" data-desactivar-usuario="${u.id}">Desactivar</button>`
        : `<button class="menu-acciones-item" data-activar-usuario="${u.id}">Activar</button>`;
    // "Ver como" no aplica a otro Admin — verse a uno mismo con otros
    // ojos de Admin no aporta nada, y suma confusión.
    const verComoBtn = u.rol !== "admin"
        ? `<button class="menu-acciones-item" data-ver-como-usuario="${u.id}">Ver como</button>`
        : "";
    return menuAcciones([
        { items: [`<button class="menu-acciones-item" data-editar-usuario="${u.id}">Editar</button>`, verComoBtn, toggle].filter(Boolean) },
        { items: [`<button class="menu-acciones-item menu-acciones-item-danger" data-eliminar-usuario="${u.id}">Eliminar</button>`] },
    ]);
}

function filaUsuarioGenerico(u) {
    return {
        ...u,
        seleccion: checkboxMail(u.id, u.email, u.nombre),
        rolBadge: rolLabelGenerico(u),
        sucursalLabel: u.sucursal || "—",
        estadoBadge: badgeEstadoGenerico(u),
        acciones: filaAccionesGenerico(u),
    };
}

const COLUMNAS_GENERICO = [
    { key: "seleccion", label: "" },
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "rolBadge", label: "Rol" },
    { key: "sucursalLabel", label: "Sucursal" },
    { key: "estadoBadge", label: "Estado" },
    { key: "acciones", label: "" },
];

const ROL_TABS = [
    { id: "colaborador", label: "Colaboradores" },
    { id: "supervisor",  label: "Supervisores" },
    { id: "admin",       label: "Admins" },
];

/** Resumen del Semáforo (Supervisor/Capacitador/Encargado) — pedido
 *  explícito del usuario: nada de un ítem de menú "Reportes" aparte,
 *  y nada de una tabla separada de la de gestión (mostrar el mismo
 *  colaborador dos veces, una en cada tabla, se sentía redundante).
 *  Solo el resumen de arriba (promedio + semáforo) es propio de esta
 *  sección — el detalle por colaborador/curso vive DENTRO de la misma
 *  tabla de gestión de siempre (ver COLUMNAS_SEMAFORO_GESTION /
 *  filaSemaforoGestion más abajo), no repetido. */
function resumenSemaforoHtml(colaboradores, asignaciones, cursos, resultados, puedeExportar) {
    return `
        ${membreteHtml("Estado del equipo")}
        <div class="section">
            <div class="header" style="margin-bottom:0">
                <h3 style="margin:0">Semáforo de desempeño<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Módulos/Lecciones vistas miden cuánto avanzó (no si aprobó). Debajo de cada módulo (M1, M2...) vas a encontrar además el resultado real de la evaluación: ✓ y la nota si aprobó, ✗ y la nota si rindió y no aprobó, 'Sin rendir' si nunca la rindió.">ⓘ</span></h3>
                ${puedeExportar ? `<button class="btn btn-secondary" id="btn-exportar-equipo">🖨 Exportar PDF</button>` : ""}
            </div>
            <div style="margin:14px 0">
                ${kpisSemaforo(colaboradores, asignaciones, cursos, resultados)}
            </div>
        </div>
    `;
}

/** Columnas de la tabla de gestión para Supervisor/Capacitador/
 *  Encargado — la de siempre (Nombre/Email/Rol/Estado/Acceso/
 *  Acciones) MÁS el detalle del Semáforo (Módulos/Lecciones vistas +
 *  una columna por curso), todo en una sola tabla en vez de dos
 *  separadas. Sin columna de "Evaluación" aparte: un promedio global
 *  no dice CUÁL módulo rindió — la nota real va debajo del % de cada
 *  módulo puntual (ver estadoEvaluacion, reportes.js), pedido
 *  explícito del usuario. Admin sigue viendo la versión simple
 *  (COLUMNAS_BASE) — no se pidió este detalle ahí, y ya maneja 3
 *  pestañas de rol. */
const COLUMNAS_SEMAFORO_GESTION = (cursos, conSeleccion = false) => [
    // El supervisor ve ESTA tabla, no la de admin, así que la columna de
    // selección tiene que existir también acá o la barra de acciones en
    // lote no tendría sobre qué operar. Va condicionada porque el
    // Encargado ve la misma tabla en modo solo lectura.
    ...(conSeleccion ? [{ key: "seleccion", label: "" }] : []),
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "rolLabel", label: "Rol" },
    { key: "modulosVistos", label: "Módulos vistos" },
    { key: "leccionesVistas", label: "Lecciones vistas" },
    // "M1".."Mn" en vez del nombre completo del curso — con 6-8 cursos
    // reales, la columna con el nombre entero (ej. "Atención al
    // Cliente") volvía la tabla enorme. El nombre real aparece en un
    // tooltip propio (css .mod-tooltip) al pasar el mouse (desktop) o
    // tocar (celular, ver bindColaboradores) — pedido del usuario.
    ...cursos.map((cur, i) => ({ key: `curso_${cur.id}`, label: `<span class="mod-tooltip" data-tooltip-texto="${cur.nombre}">M${i + 1}</span>` })),
    { key: "estadoBadge", label: "Estado" },
    { key: "ultimoIngresoBadge", label: `Último ingreso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="El acceso se renueva solo cada vez que la persona entra, así que no hace falta ir extendiéndolo. Si alguien deja de entrar, su acceso caduca solo a los ${DIAS_ACCESO_INICIAL} días. Esta columna te muestra a quién conviene revisar.">ⓘ</span>` },
    { key: "accesoBadge", label: `Acceso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Se renueva solo a 30 días cada vez que la persona entra. Tocá los tres puntos (⋮) para editar, deshabilitar el acceso o volver a habilitarlo.">ⓘ</span>` },
    { key: "acciones", label: "" },
];

function filaSemaforoGestion(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin, resultados, cursosConEvaluacion, leccionesParaSemaforo) {
    const progreso = progresoColaborador(c, asignaciones, cursos);
    const cursosAplicables = cursosDeLaPersona(cursos, c);
    const { vistas: leccionesVistas, total: leccionesTotal } = leccionesDePersona(c, cursosAplicables, asignaciones, leccionesParaSemaforo);
    const fila = {
        ...c,
        seleccion: checkboxMail(c.id, c.email, c.nombre),
        nombre: nombreConAvatar(c.nombre, c.foto, etiquetaColaborador(c)),
        rolLabel: c.encargado || c.responsableTurno ? `Colaborador (${etiquetaColaborador(c)})` : "Colaborador",
        _datos: { encargado: c.encargado ? "si" : "no" },
        progreso: progreso.pct,
        modulosVistos: barraProgreso(progreso.hechos, progreso.total),
        leccionesVistas: barraProgreso(leccionesVistas, leccionesTotal),
        estadoBadge: badgeAcceso(c),
        ultimoIngresoBadge: badgeUltimoIngreso(c),
        accesoBadge: badgeVencimiento(c),
        acciones: filaAcciones(c, puedeDeshabilitar, puedeEditar, esAdmin),
    };
    cursos.forEach((cur) => {
        const aplica = cursoAplicaAPersona(cur, c);
        fila[`curso_${cur.id}`] = aplica
            ? `<div class="celda-curso">${celdaPct(progresoCursoDePersona(c, cur, asignaciones))}${estadoEvaluacion(c, cur, resultados, cursosConEvaluacion)}</div>`
            : `<span class="text-xs text-muted">No aplica</span>`;
    });
    return fila;
}

export async function Colaboradores() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    // Encargado (colaborador con encargado=true) ve la misma pantalla
    // que un Supervisor, acotada a su sucursal, pero es de solo
    // lectura — puede ver el estado de su equipo, pero no registrar,
    // editar, deshabilitar ni extender acceso (eso queda en manos de
    // Admin/Supervisor).
    //
    // Capacitador (Supervisor con capacitador:true) es de solo lectura
    // en TODA la app, decisión del cliente — ni siquiera gestiona su
    // propio equipo real si lo tuviera. Ve todos los locales (más
    // abajo, getLocalesVisibles), nunca botones de gestión.
    const esEncargado = usuario.rol === "colaborador" && usuario.encargado;
    const puedeDeshabilitar = usuario.rol !== "colaborador" && !usuario.capacitador;
    const puedeEditar = usuario.rol !== "colaborador" && !usuario.capacitador;
    const puedeRegistrar = !esEncargado && !usuario.capacitador;

    // Las acciones en lote son las mismas que ya tiene fila por fila —
    // la barra sólo evita repetirlas 20 veces. Por eso se apoya en
    // puedeDeshabilitar en vez de exigir admin: un supervisor que ya
    // puede renovar el acceso de a uno no gana ningún permiso nuevo por
    // hacerlo de a diez.
    //
    // Eliminar es la excepción y va aparte: en el backend
    // Usuarios.eliminar es ["admin"], así que un supervisor sólo se
    // comería el rechazo. El botón no se le muestra.
    const puedeAccionesEnLote = puedeDeshabilitar;

    let miSupervisor = "";
    let gruposPorSucursal = null; // Admin y Supervisor (con >1 local) ven la lista agrupada
    let colaboradores;
    // Para Admin, distinto de `colaboradores`: ese se mantiene completo
    // (lo necesita el chequeo de vencimientos más abajo, que tiene que
    // barrer TODA la red sin importar qué locales estén elegidos ahora
    // mismo). Este es el que alimenta las tarjetas de Semáforo — bug
    // real reportado: "elijo un local y las tarjetas no cambian",
    // porque antes recibían siempre `colaboradores` completo, nunca
    // recortado por "Elegir mis locales".
    let colaboradoresParaKpis;
    let supervisores = [];
    let admins = [];
    let cantidadLocalesElegidos = 0; // Capacitador — ver Header más abajo
    let localesElegidosSinDatos = []; // Capacitador — ver aviso más abajo

    if (esAdmin) {
        // Un solo fetch para las 3 pestañas de rol — Colaboradores,
        // Supervisores y Admins salen del mismo getUsuarios().
        const todosLosUsuarios = await getUsuarios();
        colaboradores = todosLosUsuarios.filter((u) => u.rol === "colaborador");
        supervisores = todosLosUsuarios.filter((u) => u.rol === "supervisor");
        admins = todosLosUsuarios.filter((u) => u.rol === "admin");
        // Con ~95 locales reales pero personal cargado solo en un
        // puñado, agrupar por TODAS las sucursales (como haría
        // getSucursales()) mostraría decenas de secciones vacías —
        // se agrupa solo por las que ya tienen algún colaborador,
        // igual que ya hace la vista de Supervisor.
        gruposPorSucursal = [...new Set(colaboradores.map((c) => c.sucursal).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        // "Elegir mis locales" — antes solo existía para Capacitador.
        // Pedido explícito: un Admin con decenas de locales cargados
        // también necesita poder acotar la pantalla a 3 o 4 puntuales
        // en vez de scrollear todos juntos, sin que eso le saque
        // acceso a nada (es una preferencia de este dispositivo, ver
        // services/preferenciasLocales.js).
        const elegidosAdmin = getLocalesElegidos(usuario);
        cantidadLocalesElegidos = elegidosAdmin.length;
        if (elegidosAdmin.length) {
            gruposPorSucursal = gruposPorSucursal.filter((n) => elegidosAdmin.includes(n));
            localesElegidosSinDatos = elegidosAdmin.filter((n) => !gruposPorSucursal.includes(n));
        }
        colaboradoresParaKpis = elegidosAdmin.length
            ? colaboradores.filter((c) => elegidosAdmin.includes(c.sucursal))
            : colaboradores;
    } else if (esEncargado) {
        colaboradores = await getColaboradoresPorSucursal(usuario.sucursal);
        colaboradoresParaKpis = colaboradores;
        // Puede haber más de uno (cobertura de vacaciones, locales
        // grandes) — la columna es una lista separada por comas.
        const sucursales = await getSucursales();
        const miLocal = sucursales.find((s) => s.nombre === usuario.sucursal);
        miSupervisor = String(miLocal?.supervisor || "").split(",").map((n) => n.trim()).filter(Boolean).join(", ");
    } else {
        // Supervisor: puede tener más de un local a cargo (ver
        // getMisLocales, incluye el fallback a su propio
        // Usuarios.sucursal si Sucursales.supervisor no lo tiene
        // cargado). Capacitador ve TODOS los locales de la red
        // (getLocalesVisibles) — de solo lectura, puedeEditar ya da
        // false para cualquier fila que le aparezca acá.
        let nombresLocales = await getLocalesVisibles(usuario);
        // Preferencia personal (solo Capacitador, guardada en este
        // dispositivo — ver services/preferenciasLocales.js): NO le
        // saca acceso a nada, solo recorta cuáles ve por default. Sin
        // preferencia guardada todavía, sigue viendo toda la red.
        // "Elegir mis locales" — antes solo para Capacitador (ve TODA
        // la red). Un Supervisor común, aunque ya esté acotado a sus
        // propios locales, puede tener muchos a cargo (zona) y también
        // quiere poder acotar más — mismo mecanismo, mismo criterio: no
        // le saca acceso a nada, solo recorta qué ve por default.
        let elegidos = getLocalesElegidos(usuario);
        cantidadLocalesElegidos = elegidos.length;
        if (elegidos.length) nombresLocales = nombresLocales.filter((n) => elegidos.includes(n));
        const todos = await getColaboradores();
        colaboradores = todos.filter((c) => nombresLocales.includes(c.sucursal));
        // Acá `colaboradores` ya sale filtrado por locales elegidos
        // (nombresLocales los incluye) — no hace falta un recorte
        // aparte, a diferencia de Admin.
        colaboradoresParaKpis = colaboradores;
        // Un capacitador sin locales elegidos ve TODA la red (~95
        // locales), la mayoría sin nadie cargado todavía. Mismo
        // recorte que ya usa la vista de Admin: agrupar solo por los
        // locales que de verdad tienen gente, no mostrar decenas de
        // secciones vacías.
        gruposPorSucursal = usuario.capacitador
            ? [...new Set(colaboradores.map((c) => c.sucursal).filter(Boolean))].sort((a, b) => a.localeCompare(b))
            : nombresLocales;
        // De los elegidos a mano, cuáles no tienen NADIE cargado
        // todavía — sin este aviso, un local elegido que no tiene
        // colaboradores simplemente "desaparece" de la pantalla sin
        // explicación.
        if (elegidos.length) {
            localesElegidosSinDatos = elegidos.filter((n) => !gruposPorSucursal.includes(n));
        }
    }

    // Los 5 pedidos son independientes entre sí — en paralelo (en vez
    // de un await atrás del otro) para no pagar 1-3s reales de red
    // por CADA uno en serie. Resultados/Evaluaciones/Lecciones solo
    // Evaluaciones/Lecciones solo hacen falta para Supervisor/
    // Capacitador/Encargado (el detalle de evaluación real y la barra
    // de Lecciones vistas, ver estadoEvaluacion/filaSemaforoGestion) —
    // Admin usa filaDeColaborador, que no los toca. Resultados SÍ se
    // pide también para Admin: lo necesita kpisSemaforo (Mejor/Menor
    // rendimiento, Evaluaciones registradas) — antes Admin exportaba
    // sin ese resumen ("ya está en Reportes"), pero es justo la pieza
    // que sirve para comparar un local contra otro, que es para lo que
    // Admin usa "Elegir mis locales" acá.
    const [asignaciones, cursos, resultados, evaluaciones, lecciones] = await Promise.all([
        getAsignaciones(),
        getCursos(),
        getResultados(),
        esAdmin ? [] : getEvaluaciones(),
        esAdmin ? [] : getLecciones(),
    ]);
    const cursosConEvaluacion = esAdmin ? new Set() : new Set(evaluaciones.map((p) => String(p.cursoId)));
    // Se pasa el array crudo: leccionesDePersona necesita filtrar por
    // alcance persona por persona, y un mapa ya contado no lo permite.
    const leccionesParaSemaforo = esAdmin ? [] : lecciones;

    // Chequeo + desactivación de accesos vencidos — se corre cada vez
    // que se abre esta pantalla (ver nota arriba sobre por qué acá).
    // Un capacitador es de solo lectura: corrige el badge en memoria
    // para que se vea honesto (no queda mostrando "Activo" a alguien
    // ya vencido), pero NO escribe en la Sheet — ver a todo el equipo
    // de la red no puede tener el efecto secundario de desactivar
    // gente que no es su equipo real.
    for (const c of colaboradores) {
        if (c.activo === "SI" && estadoAcceso(c).vencido) {
            if (usuario.capacitador) {
                c.activo = "NO";
            } else {
                await actualizarUsuario(c.id, { activo: "NO" });
                c.activo = "NO";
                registrarEvento(usuario.id, "acceso_vencido", `El acceso de ${c.nombre} venció y se desactivó automáticamente.`);
            }
        }
    }

    // Supervisor/Capacitador/Encargado ven el detalle del Semáforo
    // (Total/Resultado/Nivel/M1..Mn) integrado en la MISMA tabla de
    // gestión — pedido explícito del usuario, para no repetir a cada
    // colaborador en dos tablas separadas. Admin sigue con la versión
    // simple (columnas de siempre) — ese detalle ya lo tiene en Reportes.
    const armarFila = esAdmin
        ? (c) => filaDeColaborador(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin)
        : (c) => filaSemaforoGestion(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin, resultados, cursosConEvaluacion, leccionesParaSemaforo);
    const columnasTabla = esAdmin
        ? COLUMNAS_BASE(false, esAdmin)
        : COLUMNAS_SEMAFORO_GESTION(cursos, puedeAccionesEnLote);

    let cuerpoHtml;
    if (gruposPorSucursal) {
        cuerpoHtml = gruposPorSucursal.map((nombreSucursal) => {
            const delGrupo = colaboradores.filter((c) => c.sucursal === nombreSucursal);
            const filas = ordenarPorProgresoAscendente(delGrupo.map(armarFila));
            // data-sucursal-seccion: ver filtro de local más abajo (solo
            // Capacitador, que ve toda la red y necesita poder acotar la
            // vista a un local puntual en vez de scrollear todos juntos).
            return `
                <div class="section" data-sucursal-seccion="${nombreSucursal}">
                    <h3>${nombreSucursal} <span class="text-sm text-muted seccion-conteo">(${delGrupo.length})</span></h3>
                    ${Table(columnasTabla, filas)}
                </div>
            `;
        }).join("");
        if (!gruposPorSucursal.length) {
            cuerpoHtml = `<p class="text-sm text-muted">${esAdmin ? "Todavía no hay colaboradores cargados." : "Todavía no tenés ningún local asignado como supervisor."}</p>`;
        }
    } else {
        const filasSinOrdenar = colaboradores.map(armarFila);
        const filas = esAdmin ? ordenarPorFechaAltaDescendente(filasSinOrdenar) : ordenarPorProgresoAscendente(filasSinOrdenar);
        cuerpoHtml = Table(esAdmin ? COLUMNAS_BASE(esAdmin, esAdmin) : columnasTabla, filas);
    }

    // Pestañas de supervisor/admin: solo existen para Admin — el
    // resto de los roles nunca las ve ni tiene los datos cargados
    // (supervisores/admins quedan como arrays vacíos arriba).
    const cuerpoSupervisoresHtml = esAdmin
        ? (supervisores.length
            ? Table(COLUMNAS_GENERICO, ordenarPorFechaAltaDescendente(supervisores.map(filaUsuarioGenerico)))
            : `<p class="text-sm text-muted">Todavía no hay supervisores cargados.</p>`)
        : "";
    const cuerpoAdminsHtml = esAdmin
        ? (admins.length
            ? Table(COLUMNAS_GENERICO, ordenarPorFechaAltaDescendente(admins.map(filaUsuarioGenerico)))
            : `<p class="text-sm text-muted">Todavía no hay administradores cargados.</p>`)
        : "";

    const alcanceLabel = esAdmin
        ? (cantidadLocalesElegidos ? `${cantidadLocalesElegidos} local(es) elegido(s)` : "Todas las sucursales")
        : usuario.capacitador
            ? (cantidadLocalesElegidos ? `${cantidadLocalesElegidos} local(es) elegido(s) · Solo lectura` : "Toda la red · Solo lectura")
            : usuario.rol === "supervisor"
                ? (cantidadLocalesElegidos ? `${cantidadLocalesElegidos} local(es) elegido(s)` : "Tus locales")
                : usuario.sucursal || "Tus locales";

    return `
        ${Header(esEncargado ? "Mi local" : "Colaboradores", alcanceLabel)}

        ${localesElegidosSinDatos.length ? `
            <p class="text-sm text-muted" style="margin-top:-6px">
                ${localesElegidosSinDatos.length === 1 ? "Uno de tus locales elegidos" : `${localesElegidosSinDatos.length} de tus locales elegidos`}
                todavía no ${localesElegidosSinDatos.length === 1 ? "tiene" : "tienen"} colaboradores cargados: ${localesElegidosSinDatos.join(", ")}.
            </p>
        ` : ""}

        <div class="imprimible" id="equipo-imprimible">

        <!-- El resumen de KPIs (Mejor/Menor rendimiento, Evaluaciones
             registradas) antes era solo de Supervisor/Capacitador — a
             Admin se le daba una versión sin eso ("ya está en
             Reportes"). Pedido explícito del usuario: es justo la
             pieza que sirve para comparar un local contra otro, que es
             para lo que usa "Elegir mis locales" acá — así que Admin
             lo recibe igual ahora. -->
        ${colaboradoresParaKpis.length ? resumenSemaforoHtml(colaboradoresParaKpis, asignaciones, cursos, resultados, esAdmin || usuario.rol === "supervisor") : ""}

        ${esAdmin ? `
            <div class="galeria-pills" style="margin-bottom:14px">
                ${ROL_TABS.map((t, i) => `<button class="pill-categoria${i === 0 ? " activa" : ""}" data-rol-tab="${t.id}">${t.label}</button>`).join("")}
            </div>
        ` : ""}

        <div class="table-toolbar">
            <input type="search" id="buscador-colaboradores" placeholder="Buscar por nombre, email o local...">
            ${(esAdmin || usuario.rol === "supervisor") ? `<button class="btn btn-secondary" id="btn-elegir-locales">📍 Elegir mis locales</button>` : ""}
            ${puedeRegistrar ? `<button class="btn btn-primary" id="btn-registrar-colaborador" data-toolbar-rol="colaborador">+ Registrar colaborador</button>` : ""}
            ${esAdmin ? `<button class="btn btn-primary" id="btn-nuevo-supervisor" data-toolbar-rol="supervisor" hidden>+ Nuevo supervisor</button>` : ""}
            ${esAdmin ? `<button class="btn btn-primary" id="btn-nuevo-admin" data-toolbar-rol="admin" hidden>+ Nuevo admin</button>` : ""}
        </div>

        <div class="galeria-pills" style="margin:14px 0">
            <button class="pill-categoria activa" data-filtro-activo="todos">Todos</button>
            <button class="pill-categoria" data-filtro-activo="SI">Activos</button>
            <button class="pill-categoria" data-filtro-activo="NO">Inactivos</button>
            <!-- Sirve para encontrar a los responsables de local entre
                 mucha gente. Un responsable de local ve sólo su propio
                 local, donde el único responsable es él: la pill no
                 filtra nada útil. -->
            ${esEncargado ? "" : `<button class="pill-categoria" id="btn-filtro-encargados" data-solo-tab="colaborador">Responsables de local</button>`}
        </div>

        <!-- A quién responder. Un Encargado no tiene dónde ver quién es
             su supervisor, y es el dato que necesita cuando algo se le
             complica. Sale de la columna "supervisor" del local, que ya
             se carga en Locales. -->
        ${esEncargado && miSupervisor ? `
            <p class="text-sm text-muted" style="margin:-6px 0 14px">
                Supervisor a cargo: <strong style="color:var(--gold-deep)">${escaparHtml(miSupervisor)}</strong>
            </p>
        ` : ""}

        ${puedeAccionesEnLote ? `
            <!-- Barra de selección al estilo Gmail: aparece SOLO cuando hay
                 algo tildado, dice cuántos son, y junta todas las acciones
                 en un lugar. Antes los botones estaban siempre visibles y
                 sin contexto: no se sabía sobre cuántos iban a aplicar. -->
            <!-- El ⓘ va FUERA del <label>: adentro, tocarlo cuenta como
                 tocar la etiqueta y seleccionaba a toda la gente visible. -->
            <div class="barra-seleccion-todos text-sm">
                <label><input type="checkbox" id="chk-mail-todos" style="width:auto">Seleccionar todos los visibles</label>
                <span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Tilda solo a las personas que estás viendo ahora. Si filtraste por local o estado, o buscaste un nombre, las que quedaron ocultas NO se seleccionan — así podés filtrar un local y aplicarle la acción a todo ese equipo de una.">ⓘ</span>
            </div>
            <div class="barra-seleccion" id="barra-seleccion" hidden>
                <span class="barra-seleccion-cuenta" id="cuenta-seleccion">0 seleccionados</span>
                <div class="barra-seleccion-acciones">
                    <button class="btn btn-secondary" id="btn-lote-renovar">Dar acceso ${DIAS_ACCESO_INICIAL} días</button>
                    <button class="btn btn-secondary" id="btn-lote-deshabilitar">Quitar acceso</button>
                    <button class="btn btn-secondary" id="btn-enviar-mail">✉ Enviar mail</button>
                    ${esAdmin ? `<button class="btn btn-sutil-danger" id="btn-lote-eliminar">Eliminar</button>` : ""}
                </div>
                <button class="btn btn-sutil" id="btn-limpiar-seleccion">Deseleccionar</button>
            </div>
        ` : ""}

        <p class="text-sm text-muted" id="aviso-sin-resultados" hidden style="margin:10px 0">
            No hay nadie que coincida con los filtros puestos.
            <button class="btn-enlace" id="btn-limpiar-filtros">Limpiar filtros</button>
        </p>

        <div id="tabla-colaboradores">
            <div data-rol-panel="colaborador">${cuerpoHtml}</div>
            ${esAdmin ? `<div data-rol-panel="supervisor" hidden>${cuerpoSupervisoresHtml}</div>` : ""}
            ${esAdmin ? `<div data-rol-panel="admin" hidden>${cuerpoAdminsHtml}</div>` : ""}
        </div>

        </div>
    `;
}

// Menú "⋮" por fila (ver menuAcciones más arriba) — un solo listener
// delegado en document alcanza para todas las filas de la tabla, sin
// importar cuántas haya ni en qué pestaña de rol estén. Se registra
// UNA sola vez para toda la sesión (guard en el propio document,
// _menuAccionesListo) — bindColaboradores() corre de nuevo cada vez
// que se vuelve a esta pantalla, y document.addEventListener sin
// este guard iba acumulando un listener más por cada visita: con 2
// listeners activos, un mismo click abría el menú con el primero y
// lo volvía a cerrar con el segundo en el mismo evento (el toggle
// nunca se veía). El dropdown es position:fixed (ver CSS) para no
// quedar recortado por el overflow:hidden de .table-wrapper — hay
// que calcularle top/left a mano acá, ya que fixed no se posiciona
// solo con top:100% de un ancestro como haría absolute.
function bindMenuAcciones() {
    if (document._menuAccionesListo) return;
    document._menuAccionesListo = true;

    document.addEventListener("click", (e) => {
        const toggle = e.target.closest("[data-menu-toggle]");
        document.querySelectorAll(".menu-acciones-dropdown").forEach((dropdown) => {
            if (toggle && dropdown === toggle.nextElementSibling) return;
            dropdown.hidden = true;
        });
        if (!toggle) return;

        const dropdown = toggle.nextElementSibling;
        const abrir = dropdown.hidden;
        dropdown.hidden = !abrir;
        if (!abrir) return;

        const r = toggle.getBoundingClientRect();
        const ancho = dropdown.offsetWidth || 190;
        // Si no entra a la derecha (mismo criterio que antes con
        // right:0 en absolute), lo alinea al borde derecho del botón
        // en vez de dejarlo salirse de la pantalla.
        const left = Math.min(r.left, window.innerWidth - ancho - 8);
        dropdown.style.left = `${Math.max(8, left)}px`;
        dropdown.style.top = `${r.bottom + 6}px`;

        // Si tampoco entra hacia abajo (fila pegada al fondo de la
        // pantalla), se abre hacia arriba del botón en vez de tapar
        // el resto por fuera del viewport.
        const alturaEstimada = dropdown.offsetHeight || 140;
        if (r.bottom + 6 + alturaEstimada > window.innerHeight) {
            dropdown.style.top = `${r.top - alturaEstimada - 6}px`;
        }
    });
}

export function bindColaboradores() {

    bindMenuAcciones();
    document.getElementById("btn-exportar-equipo")?.addEventListener("click", () => exportarAPdf("equipo-imprimible", "Estado del equipo - Lucciano's Academy"));

    const buscador = document.getElementById("buscador-colaboradores");
    let filtroActivo = "todos";
    let soloEncargados = false;

    // Búsqueda por nombre, el segmentador Activos/Inactivos y el
    // toggle de responsables se combinan sobre las mismas filas — cada
    // uno decide si esconde una fila, nunca la muestra si otro ya la
    // escondió. Quién es responsable de local sale de data-encargado en
    // el <tr> (ver _datos en filaDeColaborador), no del texto de la
    // fila: leerlo del texto ataba el filtro a cómo está escrita la
    // etiqueta y se rompía sin avisar apenas se la renombraba.
    // Busca por nombre, email O sucursal — antes solo miraba la celda de
    // nombre, así que escribir "Devoto" o el mail de alguien no
    // encontraba nada aunque la persona estuviera ahí. data-col (ver
    // components/table.js) identifica cada celda por su columna sin
    // importar en qué posición quedó — con o sin checkbox de mail
    // adelante, con o sin columna de sucursal, siempre encuentra la
    // celda correcta.
    function textoBuscable(fila) {
        return ["nombre", "email", "sucursal", "sucursalLabel"]
            .map((col) => fila.querySelector(`[data-col="${col}"]`)?.textContent || "")
            .join(" ")
            .toLowerCase();
    }

    function aplicarFiltros() {
        const texto = (buscador?.value || "").trim().toLowerCase();
        // SOLO el panel visible. Antes barría "#tabla-colaboradores
        // tbody tr", que envuelve a los tres (Colaboradores /
        // Supervisores / Admins): la pill de responsables dejaba las
        // filas de supervisor sin data-encargado y las escondía a todas.
        // La pestaña de Supervisores aparecía vacía, sin decir por qué,
        // y parecía que a esa gente no se la podía editar ni eliminar.
        const panel = panelActivo();
        let visibles = 0;
        panel.querySelectorAll("tbody tr").forEach((fila) => {
            // En la vista agrupada (Colaboradores de Admin/Supervisor),
            // el nombre del local está en el título de la SECCIÓN, no en
            // ninguna celda de la fila (mostrarSucursal=false ahí, sería
            // redundante repetirlo en las 100 filas de abajo) — así que
            // buscar "Martinez" no encontraba a nadie de ese local
            // aunque estuviera en la lista. closest() no hace nada en
            // las vistas sin agrupar (Supervisores/Admins), que no
            // tienen ese contenedor.
            const seccionLocal = fila.closest("[data-sucursal-seccion]")?.dataset.sucursalSeccion || "";
            const coincideTexto = textoBuscable(fila).includes(texto) || seccionLocal.toLowerCase().includes(texto);
            const esActivo = !!fila.querySelector(".badge-success");
            const coincideEstado = filtroActivo === "todos" || (filtroActivo === "SI") === esActivo;
            const coincideEncargado = !soloEncargados || fila.dataset.encargado === "si";
            const pasa = coincideTexto && coincideEstado && coincideEncargado;
            fila.style.display = pasa ? "" : "none";
            if (pasa) visibles++;
        });
        // Con la vista agrupada por local (Admin/Supervisor/Capacitador),
        // filtrar solo las FILAS dejaba el encabezado de cada local a la
        // vista igual — filtrar "Inactivos" mostraba los ~100 locales
        // igual, la mayoría con la sección vacía debajo. Un local sin
        // ninguna fila que pase el filtro se oculta entero; el contador
        // del título pasa a reflejar cuántas quedaron visibles, no el
        // total del local.
        panel.querySelectorAll("[data-sucursal-seccion]").forEach((seccion) => {
            const filasVisibles = [...seccion.querySelectorAll("tbody tr")].filter((f) => f.style.display !== "none");
            seccion.style.display = filasVisibles.length ? "" : "none";
            const conteo = seccion.querySelector(".seccion-conteo");
            if (conteo) conteo.textContent = `(${filasVisibles.length})`;
        });
        // Una tabla vacía sin explicación se lee como "acá no hay nadie"
        // —o peor, como que la app está rota— cuando en realidad hay un
        // filtro puesto. Si esconderlo todo fue decisión de un filtro,
        // se dice, y se ofrece el camino de vuelta.
        const aviso = document.getElementById("aviso-sin-resultados");
        const hayFiltro = !!texto || filtroActivo !== "todos" || soloEncargados;
        if (aviso) aviso.hidden = !(visibles === 0 && hayFiltro);
    }

    function limpiarFiltros() {
        if (buscador) buscador.value = "";
        filtroActivo = "todos";
        soloEncargados = false;
        document.querySelectorAll("[data-filtro-activo]").forEach((p) => p.classList.toggle("activa", p.dataset.filtroActivo === "todos"));
        document.getElementById("btn-filtro-encargados")?.classList.remove("activa");
        aplicarFiltros();
    }

    if (buscador) buscador.addEventListener("input", aplicarFiltros);

    document.getElementById("btn-limpiar-filtros")?.addEventListener("click", limpiarFiltros);

    document.getElementById("btn-filtro-encargados")?.addEventListener("click", (e) => {
        soloEncargados = !soloEncargados;
        e.currentTarget.classList.toggle("activa", soloEncargados);
        aplicarFiltros();
    });

    // "Elegir mis locales" (solo Capacitador — ve toda la red y
    // necesita poder guardar cuáles le interesan, en vez de scrollear
    // todos juntos cada vez). No le saca acceso a ningún local: la
    // preferencia es propia de este dispositivo (ver
    // services/preferenciasLocales.js) y se puede vaciar para volver
    // a ver toda la red en cualquier momento.
    document.getElementById("btn-elegir-locales")?.addEventListener("click", () => abrirModalElegirLocales());

    document.querySelectorAll("[data-filtro-activo]").forEach((pill) => {
        pill.addEventListener("click", () => {
            filtroActivo = pill.dataset.filtroActivo;
            document.querySelectorAll("[data-filtro-activo]").forEach((p) => p.classList.toggle("activa", p === pill));
            aplicarFiltros();
        });
    });

    // Pestañas de rol (solo Admin) — alterna qué panel se ve y cuál
    // botón "+ Nuevo..." queda visible, sin recargar la pantalla.
    document.querySelectorAll("[data-rol-tab]").forEach((tab) => {
        tab.addEventListener("click", () => {
            const rol = tab.dataset.rolTab;
            document.querySelectorAll("[data-rol-tab]").forEach((t) => t.classList.toggle("activa", t === tab));
            document.querySelectorAll("[data-rol-panel]").forEach((panel) => {
                panel.hidden = panel.dataset.rolPanel !== rol;
            });
            document.querySelectorAll("[data-toolbar-rol]").forEach((btn) => {
                btn.hidden = btn.dataset.toolbarRol !== rol;
            });
            // Un filtro puesto en Colaboradores no tiene por qué seguir
            // aplicando en Supervisores: es la vía por la que la otra
            // pestaña aparecía vacía. Se limpia todo, no solo el buscador.
            document.querySelectorAll("[data-solo-tab]").forEach((el) => { el.hidden = el.dataset.soloTab !== rol; });
            limpiarFiltros();
            const chkTodos = document.getElementById("chk-mail-todos");
            if (chkTodos) chkTodos.checked = false;
            // Cambiar de pestaña destilda todo: una selección hecha sobre
            // Colaboradores no debe aplicarse sin querer a Supervisores.
            document.querySelectorAll(".mail-check").forEach((chk) => { chk.checked = false; });
            refrescarBarraSeleccion();
        });
    });

    // ---- Selección múltiple: mail y acciones de acceso en lote ----
    // Admin y Supervisor. El Encargado no, porque su vista es de solo
    // lectura y no llega a renderizar los checkboxes.
    //
    // Los handlers de acá no chequean el rol: si el usuario no tiene
    // permiso, los controles directamente no existen en el HTML y los
    // addEventListener con "?." no hacen nada. El permiso real igual lo
    // valida el backend en cada llamada.

    function panelActivo() {
        return document.querySelector("#tabla-colaboradores [data-rol-panel]:not([hidden])") || document.getElementById("tabla-colaboradores");
    }

    function checksVisibles(panel) {
        return [...panel.querySelectorAll(".mail-check")].filter((chk) => {
            const fila = chk.closest("tr");
            return !fila || fila.style.display !== "none";
        });
    }

    // La barra de acciones aparece SOLO con algo tildado y dice cuántos
    // son — mismo criterio que Gmail. Sin eso los botones estaban
    // siempre a la vista y sin contexto: no se sabía sobre cuánta gente
    // iban a aplicar hasta leer el confirm.
    function refrescarBarraSeleccion() {
        const barra = document.getElementById("barra-seleccion");
        if (!barra) return;
        const n = checksVisibles(panelActivo()).filter((chk) => chk.checked).length;
        barra.hidden = n === 0;
        const cuenta = document.getElementById("cuenta-seleccion");
        if (cuenta) cuenta.textContent = n === 1 ? "1 seleccionado" : `${n} seleccionados`;
    }

    // Delegado en el documento: las filas se redibujan al cambiar de
    // pestaña o al filtrar, así que enganchar cada checkbox de a uno se
    // pierde en el primer re-render.
    document.addEventListener("change", (e) => {
        if (e.target.classList?.contains("mail-check")) refrescarBarraSeleccion();
    });

    document.getElementById("chk-mail-todos")?.addEventListener("change", (e) => {
        checksVisibles(panelActivo()).forEach((chk) => { chk.checked = e.target.checked; });
        refrescarBarraSeleccion();
    });

    document.getElementById("btn-limpiar-seleccion")?.addEventListener("click", () => {
        document.querySelectorAll(".mail-check").forEach((chk) => { chk.checked = false; });
        const todos = document.getElementById("chk-mail-todos");
        if (todos) todos.checked = false;
        refrescarBarraSeleccion();
    });

    refrescarBarraSeleccion();

    document.getElementById("btn-enviar-mail")?.addEventListener("click", () => {
        const visibles = checksVisibles(panelActivo());
        const marcados = visibles.filter((chk) => chk.checked);
        const destinatarios = (marcados.length ? marcados : visibles)
            .map((chk) => ({ email: chk.dataset.mailEmail, nombre: chk.dataset.mailNombre }));

        if (!destinatarios.length) {
            alert("No hay destinatarios disponibles en esta vista (revisá el buscador/filtro activo).");
            return;
        }
        abrirModalEnviarMail(destinatarios);
    });

    // ---- Acciones de acceso en bloque ----
    //
    // Pedido concreto: restaurar el acceso de decenas de personas de una,
    // en vez de abrir el menú ⋮ de cada fila. Se combina con los filtros
    // de arriba (Activos / Inactivos / Encargados) y el buscador, así
    // "seleccionar todos los visibles" ya deja el grupo que se quiere.
    //
    // A DIFERENCIA de "Enviar mail", acá NO se cae a "todos los visibles"
    // cuando no hay nada tildado: mandar un mail de más se perdona, dar o
    // quitar acceso a 45 personas sin querer, no.
    async function accionEnLote(accion, etiqueta, cambiosDe, boton) {
        const marcados = checksVisibles(panelActivo()).filter((chk) => chk.checked);
        if (!marcados.length) {
            alert("Primero tildá a quiénes querés aplicarles la acción.");
            return;
        }

        const nombres = marcados.map((chk) => chk.dataset.mailNombre);
        const muestra = nombres.slice(0, 8).join("\n· ");
        const resto = nombres.length > 8 ? `\n…y ${nombres.length - 8} más` : "";
        if (!confirm(`${etiqueta} a ${nombres.length} persona(s):\n\n· ${muestra}${resto}\n\n¿Confirmás?`)) return;

        const textoOriginal = boton.textContent;
        boton.disabled = true;

        // Secuencial a propósito: cada guardado es una llamada a Apps
        // Script de ~1,5s y en paralelo se lo satura. Además, un
        // Promise.all abortaría todo el lote apenas falla uno y no se
        // sabría cuáles quedaron hechos (el mismo problema que ya nos
        // pasó mandando pushes de News).
        const fallaron = [];
        for (let i = 0; i < marcados.length; i++) {
            boton.textContent = `Procesando ${i + 1}/${marcados.length}...`;
            const id = marcados[i].dataset.mailId;
            try {
                const r = await actualizarUsuario(id, cambiosDe());
                if (!r || r.ok === false) fallaron.push(nombres[i]);
            } catch (err) {
                fallaron.push(nombres[i]);
            }
        }

        boton.textContent = textoOriginal;
        boton.disabled = false;

        const hechos = marcados.length - fallaron.length;
        registrarEvento(getUsuarioActual().id, accion, `${etiqueta} en bloque: ${hechos} de ${marcados.length}`);

        if (fallaron.length) {
            alert(`Se aplicó a ${hechos} de ${marcados.length}.\n\nNo se pudo con:\n· ${fallaron.join("\n· ")}`);
        }
        navigate("colaboradores");
    }

    document.getElementById("btn-lote-renovar")?.addEventListener("click", (e) => {
        accionEnLote(
            "renovar_acceso_lote",
            `Dar acceso por ${DIAS_ACCESO_INICIAL} días`,
            () => ({ activo: "SI", fechaVencimientoAcceso: sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL) }),
            e.currentTarget,
        );
    });

    document.getElementById("btn-lote-deshabilitar")?.addEventListener("click", (e) => {
        accionEnLote("deshabilitar_acceso_lote", "Quitar el acceso", () => ({ activo: "NO" }), e.currentTarget);
    });

    // Eliminar en bloque. NO usa accionEnLote porque borrar una persona
    // no es un update: hay que llevarse también sus asignaciones y sus
    // resultados (si no quedan huérfanos apuntando a un id que ya no
    // existe) y, desde Code.gs v1.4.3, su carpeta de Drive.
    //
    // Es la única acción de esta pantalla que no se puede deshacer, así
    // que pide confirmar DOS veces: la primera lista los nombres, la
    // segunda hace escribir la cantidad. Suena excesivo hasta que
    // alguien tilda "todos los visibles" y le da sin leer.
    document.getElementById("btn-lote-eliminar")?.addEventListener("click", async (e) => {
        const boton = e.currentTarget;
        const marcados = checksVisibles(panelActivo()).filter((chk) => chk.checked);
        if (!marcados.length) {
            alert("Primero tildá a quiénes querés eliminar.");
            return;
        }

        const nombres = marcados.map((chk) => chk.dataset.mailNombre);
        const muestra = nombres.slice(0, 8).join("\n· ");
        const resto = nombres.length > 8 ? `\n…y ${nombres.length - 8} más` : "";
        if (!confirm(`ELIMINAR definitivamente a ${nombres.length} persona(s):\n\n· ${muestra}${resto}\n\nSe borran también sus asignaciones, sus resultados de examen y su carpeta de fotos.\n\nEsto no se puede deshacer.`)) return;

        const escrito = prompt(`Para confirmar, escribí cuántas personas vas a eliminar (${nombres.length}):`);
        if (String(escrito || "").trim() !== String(nombres.length)) {
            alert("No coincide. No se eliminó a nadie.");
            return;
        }

        const textoOriginal = boton.textContent;
        boton.disabled = true;
        const fallaron = [];

        for (let i = 0; i < marcados.length; i++) {
            boton.textContent = `Eliminando ${i + 1}/${marcados.length}...`;
            const id = marcados[i].dataset.mailId;
            try {
                const [asignaciones, resultados] = await Promise.all([
                    getAsignacionesPorColaborador(id),
                    getResultadosPorColaborador(id),
                ]);
                for (const a of asignaciones) await eliminarAsignacion(a.id);
                for (const r of resultados) await eliminarResultado(r.id);
                const borrado = await eliminarUsuario(id);
                if (borrado && borrado.ok === false) fallaron.push(nombres[i]);
            } catch (err) {
                fallaron.push(nombres[i]);
            }
        }

        boton.textContent = textoOriginal;
        boton.disabled = false;

        const hechos = marcados.length - fallaron.length;
        registrarEvento(getUsuarioActual().id, "eliminar_usuario_lote", `Eliminación en bloque: ${hechos} de ${marcados.length}`);
        if (fallaron.length) {
            alert(`Se eliminaron ${hechos} de ${marcados.length}.\n\nNo se pudo con:\n· ${fallaron.join("\n· ")}`);
        }
        navigate("colaboradores");
    });

    document.querySelectorAll("[data-renovar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.renovar;
            // getUsuarios (no getColaboradores): ese filtra por
            // rol==="colaborador", así que para cualquier otro rol no
            // encontraba la fila, asumía "sin fecha" y terminaba
            // reactivando sin renovar — el bug que esto venía a arreglar.
            const usuarios = await getUsuarios();
            const c = usuarios.find((x) => String(x.id) === String(id));

            // Antes esto SOLO hacía {activo:"SI"} y dejaba intacta la
            // fecha de vencimiento. Para alguien con fecha ya pasada (el
            // caso típico: justamente por eso se le renueva) no servía
            // de nada — seguía figurando "vencido", y peor: al entrar,
            // el backend ve la fecha vencida y lo vuelve a desactivar
            // solo (ver _usuarioDeSesion en apps-script/Code.gs). Ahora
            // se le da una ventana nueva, igual que un alta.
            const cambios = { activo: "SI" };
            const vencimiento = c?.fechaVencimientoAcceso || "";
            const tieneFechaFutura = vencimiento && diasEntre(fechaHoyISO(), vencimiento) > 0;
            // Se le da ventana nueva salvo que ya tenga una fecha futura
            // (ahí se respeta la que tiene, no se le acorta).
            //
            // Un COLABORADOR sin fecha también entra acá a propósito.
            // Antes se lo dejaba permanente "para no degradarlo sin que
            // nadie lo pida", pero eso era del modelo viejo: hoy
            // permanente es el estado que se quiere evitar, y además la
            // renovación automática no alcanza a quien no tiene fecha
            // (solo corre una que ya exista). Para supervisor/admin sí se
            // respeta el permanente, que en ellos es lo correcto.
            const esColaborador = !c || c.rol === "colaborador";
            if (!tieneFechaFutura && (vencimiento || esColaborador)) {
                cambios.fechaVencimientoAcceso = sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL);
            }

            // Si el backend rechaza el guardado devuelve {ok:false} sin
            // tirar excepción — sin este chequeo la pantalla se recargaba
            // como si todo hubiera salido bien y el acceso seguía vencido,
            // sin ninguna pista de qué pasó.
            const guardado = await actualizarUsuario(id, cambios);
            if (!guardado || guardado.ok === false) {
                alert(guardado?.error || "No se pudo renovar el acceso. Probá de nuevo.");
                return;
            }
            registrarEvento(getUsuarioActual().id, "renovar_acceso", `Acceso renovado (usuario ${id})${cambios.fechaVencimientoAcceso ? ` — nuevo vencimiento: ${cambios.fechaVencimientoAcceso}` : ""}`);
            navigate("colaboradores");
        });
    });

    // Devuelve al modelo de renovación por uso a un colaborador que
    // había quedado permanente. Sin esto no había ninguna forma de
    // sacarle el "Permanente" desde la app.
    document.querySelectorAll("[data-quitar-permanente]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.quitarPermanente;
            const nuevaFecha = sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL);
            const guardado = await actualizarUsuario(id, { fechaVencimientoAcceso: nuevaFecha, activo: "SI" });
            if (!guardado || guardado.ok === false) {
                alert(guardado?.error || "No se pudo cambiar el acceso. Probá de nuevo.");
                return;
            }
            registrarEvento(getUsuarioActual().id, "quitar_permanente", `Acceso permanente convertido a ${DIAS_ACCESO_INICIAL} días (usuario ${id}) — vence ${nuevaFecha}`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-deshabilitar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.deshabilitar;
            await actualizarUsuario(id, { activo: "NO" });
            registrarEvento(getUsuarioActual().id, "deshabilitar_acceso", `Acceso deshabilitado (usuario ${id})`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-editar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const usuarios = await getUsuarios();
            const c = usuarios.find((x) => String(x.id) === String(btn.dataset.editar));
            if (c) abrirModalEditar(c);
        });
    });

    const btnRegistrar = document.getElementById("btn-registrar-colaborador");
    if (btnRegistrar) {
        btnRegistrar.addEventListener("click", abrirModalRegistrar);
    }

    // ---- Pestañas de Supervisor/Admin (solo Admin) ----

    document.getElementById("btn-nuevo-supervisor")?.addEventListener("click", () => abrirModalUsuarioGenerico("supervisor"));
    document.getElementById("btn-nuevo-admin")?.addEventListener("click", () => abrirModalUsuarioGenerico("admin"));

    document.querySelectorAll("[data-editar-usuario]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const todos = await getUsuarios();
            const u = todos.find((x) => String(x.id) === String(btn.dataset.editarUsuario));
            if (u) abrirModalUsuarioGenerico(u.rol, u);
        });
    });

    document.querySelectorAll("[data-activar-usuario]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.activarUsuario;
            await actualizarUsuario(id, { activo: "SI" });
            registrarEvento(getUsuarioActual().id, "activar_usuario", `Usuario ${id} activado`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-desactivar-usuario]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.desactivarUsuario;
            await actualizarUsuario(id, { activo: "NO" });
            registrarEvento(getUsuarioActual().id, "desactivar_usuario", `Usuario ${id} desactivado`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-ver-como-usuario]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const admin = getUsuarioActual();
            const todos = await getUsuarios();
            const objetivo = todos.find((u) => String(u.id) === String(btn.dataset.verComoUsuario));
            if (!objetivo) return;
            registrarEvento(admin.id, "ver_como", `${admin.nombre} activó la vista como ${objetivo.nombre}`);
            verComo(objetivo);
            navigate("inicio", { replace: true });
        });
    });

    document.querySelectorAll("[data-eliminar-usuario]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.eliminarUsuario;

            // Mismo cuidado que "Eliminar" de un Colaborador: borrar
            // solo la fila de Usuarios deja Asignaciones/Resultados
            // huérfanos apuntando a un id que ya no existe.
            const [asignaciones, resultados] = await Promise.all([
                getAsignacionesPorColaborador(id),
                getResultadosPorColaborador(id),
            ]);

            const detalleProgreso = (asignaciones.length || resultados.length)
                ? ` Se van a borrar también ${asignaciones.length} asignación(es) y ${resultados.length} resultado(s) de examen.`
                : "";
            if (!confirm(`¿Eliminar este usuario?${detalleProgreso} Esta acción no se puede deshacer.`)) return;

            await Promise.all([
                ...asignaciones.map((a) => eliminarAsignacion(a.id)),
                ...resultados.map((r) => eliminarResultado(r.id)),
            ]);
            await eliminarUsuario(id);
            registrarEvento(getUsuarioActual().id, "eliminar_usuario", `Usuario ${id} eliminado (con ${asignaciones.length} asignación(es) y ${resultados.length} resultado(s))`);
            navigate("colaboradores");
        });
    });
}

/** Picker de "mis locales" para un Capacitador — misma pieza
 *  (MultiSelectSucursales) que ya usan Manuales/Notificaciones para
 *  acotar por local. Se guarda en este dispositivo (localStorage,
 *  ver services/preferenciasLocales.js), no en la Sheet: es una
 *  preferencia de pantalla, no un cambio de a quién ve o no ve —
 *  vacío = sigue viendo toda la red, como antes de elegir nada. */
async function abrirModalElegirLocales() {

    const modalId = "modal-elegir-locales";
    const usuario = getUsuarioActual();
    const actuales = getLocalesElegidos(usuario);

    const contenidoHtml = `
        <p class="text-sm text-muted" style="margin-bottom:10px">Elegí los locales que te interesa seguir de cerca — esta lista se va a acotar a esos. Dejalo vacío para volver a ver todo.</p>
        <label for="input-locales-elegidos">Mis locales</label>
        ${MultiSelectSucursales("input-locales-elegidos", actuales)}
    `;

    abrirModal(Modal({ id: modalId, titulo: "Elegir mis locales", contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {
        const valor = document.getElementById("input-locales-elegidos").value.trim();
        const elegidos = valor ? valor.split(",").map((n) => n.trim()).filter(Boolean) : [];
        setLocalesElegidos(usuario, elegidos);
        cerrarModal(modalId);
        navigate("colaboradores");
    });

    bindMultiSelectSucursales("input-locales-elegidos");
}

async function abrirModalEditar(colaborador) {

    const modalId = "modal-editar-colaborador";
    const usuario = getUsuarioActual();
    const campoSucursal = await campoSucursalModal(usuario, colaborador.sucursal);

    const contenidoHtml = `
        <label for="input-nombre">Nombre completo</label>
        <input type="text" id="input-nombre" value="${colaborador.nombre}" required>

        <label for="input-email">Email</label>
        <input type="email" id="input-email" value="${colaborador.email}" required>

        ${campoSucursal.html}

        ${camposLiderazgo(colaborador)}
    `;

    abrirModal(Modal({ id: modalId, titulo: "Editar colaborador", contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const email = document.getElementById("input-email").value.trim();
        const sucursal = campoSucursal.leer();
        const encargado = document.getElementById("input-encargado").checked;
        const responsableTurno = document.getElementById("input-responsable-turno").checked;

        if (!nombre || !email) {
            alert("Completá nombre y email antes de guardar — sin email no se puede cargar bien en la planilla.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert(`"${email}" no parece un email válido (ej: nombre@gmail.com). Revisalo antes de guardar.`);
            return;
        }

        await asegurarSucursalAsignada(sucursal, usuario);
        if (campoSucursal.leerSupervisor) await asignarSupervisorASucursal(sucursal, campoSucursal.leerSupervisor());
        await actualizarUsuario(colaborador.id, { nombre, email, sucursal, encargado: encargado ? "SI" : "NO", responsableTurno: responsableTurno ? "SI" : "NO" });
        registrarEvento(usuario.id, "editar_colaborador", `Datos corregidos de ${nombre} (antes: ${colaborador.nombre})`);

        cerrarModal(modalId);
        navigate("colaboradores");
    });

    campoSucursal.bind();
    bindLiderazgo();
}

/* Las dos etiquetas de liderazgo de un colaborador.

   Son EXCLUYENTES a propósito: el responsable de local ya es el
   referente de la sucursal, y marcarlo además como responsable de turno
   no agrega información — deja la lista con dos etiquetas que parecen
   lo mismo. Se destildan entre sí en vez de avisar con un cartel.

   "Responsable de turno" es SOLO una etiqueta: no abre permisos, no
   suma cursos de Gestión y no cambia qué ve la persona. Lo que decide
   todo eso sigue siendo "encargado" — ver data/usuarios.js. */
function camposLiderazgo(c = {}) {
    return `
        <label for="input-encargado">
            <input type="checkbox" id="input-encargado" style="width:auto;display:inline-block;margin-right:8px" ${c.encargado ? "checked" : ""}>
            ${ETIQUETA_RESPONSABLE_LOCAL} <span class="text-xs text-muted">— a cargo de la sucursal</span>
        </label>

        <label for="input-responsable-turno">
            <input type="checkbox" id="input-responsable-turno" style="width:auto;display:inline-block;margin-right:8px" ${c.responsableTurno ? "checked" : ""}>
            ${ETIQUETA_RESPONSABLE_TURNO} <span class="text-xs text-muted">— lidera su turno, sin estar a cargo del local</span>
        </label>
    `;
}

function bindLiderazgo() {
    const local = document.getElementById("input-encargado");
    const turno = document.getElementById("input-responsable-turno");
    if (!local || !turno) return;
    local.addEventListener("change", () => { if (local.checked) turno.checked = false; });
    turno.addEventListener("change", () => { if (turno.checked) local.checked = false; });
}

async function abrirModalRegistrar() {

    const usuario = getUsuarioActual();
    const campoSucursal = await campoSucursalModal(usuario);

    const modalId = "modal-registrar-colaborador";

    const contenidoHtml = `
        <label for="input-nombre">Nombre completo</label>
        <input type="text" id="input-nombre" placeholder="Nombre y apellido" required>

        <label for="input-email">Email</label>
        <input type="email" id="input-email" placeholder="nombre@luccianos.com" required>

        ${campoSucursal.html}

        ${camposLiderazgo()}

        <p class="text-xs text-muted" style="margin-top:14px">El acceso se da por ${DIAS_ACCESO_INICIAL} días y se renueva solo cada vez que la persona entra, así que no hay que estar extendiéndolo. Si deja de entrar, caduca solo a los ${DIAS_ACCESO_INICIAL} días.</p>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Registrar colaborador", contenidoHtml, textoConfirmar: "Registrar" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const email = document.getElementById("input-email").value.trim();
        const sucursal = campoSucursal.leer();
        const encargado = document.getElementById("input-encargado").checked;
        const responsableTurno = document.getElementById("input-responsable-turno").checked;

        if (!nombre || !email) {
            alert("Completá nombre y email antes de registrar — sin email no se puede cargar bien en la planilla.");
            return;
        }
        // Mismo regex que valida el backend (apps-script/Code.gs) — un
        // email mal tipeado acá recién falla al intentar loguearse o al
        // mandarle un mail, mucho más difícil de rastrear.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert(`"${email}" no parece un email válido (ej: nombre@gmail.com). Revisalo antes de registrar.`);
            return;
        }
        if (usuario.rol === "supervisor" && !sucursal) {
            alert("Elegí o escribí una sucursal antes de registrar — así el colaborador queda bien agrupado en tu equipo.");
            return;
        }

        await asegurarSucursalAsignada(sucursal, usuario);
        if (campoSucursal.leerSupervisor) await asignarSupervisorASucursal(sucursal, campoSucursal.leerSupervisor());
        const fechaVencimientoAcceso = sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL);
        await crearUsuario({ nombre, email, rol: "colaborador", sucursal, encargado, responsableTurno, fechaVencimientoAcceso });
        registrarEvento(usuario.id, "registrar_colaborador", `Alta de ${nombre} (acceso por ${DIAS_ACCESO_INICIAL} días)`);

        cerrarModal(modalId);
        navigate("colaboradores");
    });

    campoSucursal.bind();
    bindLiderazgo();
}

/** Alta/edición de Supervisor o Admin — mucho más simple que el modal
 *  de Colaborador: sin sucursal real (quedan en "Operaciones", fijo,
 *  mismo criterio ya usado para Carlos Torres/Fabricio Mirabelli),
 *  sin encargado, sin vencimiento de acceso (eso es un concepto de
 *  Colaborador en período de prueba). "Capacitador" solo se ofrece
 *  de verdad al crear/editar un Supervisor. */
async function abrirModalUsuarioGenerico(rol, usuarioExistente = null) {

    const modalId = "modal-usuario-generico";
    const tituloRol = rol === "admin" ? "administrador" : "supervisor";

    // Antes no había forma de asignar/cambiar los locales de un
    // Supervisor desde la app — la única vía era editar la Sheet
    // "Sucursales" a mano (por eso Carlos Torres tenía un local real
    // cargado y los otros 7 no). Se resuelve acá: mismo buscador
    // multi-select que ya usa Manuales, precargado con lo que hoy
    // figura en Sucursales.supervisor === este nombre.
    let localesActuales = [];
    if (rol === "supervisor" && usuarioExistente) {
        const sucursales = await getSucursales();
        localesActuales = sucursales.filter((s) => s.supervisor === usuarioExistente.nombre).map((s) => s.nombre);
    }

    const contenidoHtml = `
        <label for="input-nombre">Nombre completo</label>
        <input type="text" id="input-nombre" placeholder="Nombre y apellido" value="${usuarioExistente?.nombre || ""}">

        <label for="input-email">Email</label>
        <input type="email" id="input-email" placeholder="nombre@luccianos.com" value="${usuarioExistente?.email || ""}">

        ${rol === "supervisor" ? `
            <label for="input-capacitador">
                <input type="checkbox" id="input-capacitador" style="width:auto;display:inline-block;margin-right:8px" ${usuarioExistente?.capacitador ? "checked" : ""}>
                <strong>Solo lectura</strong> — ve toda la red pero no puede editar,
                deshabilitar ni registrar a nadie. Para quien tiene que revisar la
                plataforma sin poder alterarla.
            </label>

            <label for="input-locales-supervisor" style="margin-top:14px">Locales asignados</label>
            ${MultiSelectSucursales("input-locales-supervisor", localesActuales)}
            <p class="text-xs text-muted" style="margin-top:4px">Se guarda en cada local (columna "supervisor" de Sucursales) — así aparece en "Supervisores" y agrupa a su equipo en "Mi equipo".</p>
        ` : ""}
    `;

    abrirModal(Modal({
        id: modalId,
        titulo: usuarioExistente ? `Editar ${tituloRol}` : `Nuevo ${tituloRol}`,
        contenidoHtml,
        textoConfirmar: usuarioExistente ? "Guardar" : "Crear",
    }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const email = document.getElementById("input-email").value.trim();
        const capacitador = rol === "supervisor" && document.getElementById("input-capacitador").checked;
        const localesSeleccionados = rol === "supervisor"
            ? (document.getElementById("input-locales-supervisor").value || "").split(",").map((n) => n.trim()).filter(Boolean)
            : [];

        if (!nombre || !email) {
            alert("Completá nombre y email antes de guardar — sin email no se puede cargar bien en la planilla.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert(`"${email}" no parece un email válido (ej: nombre@gmail.com). Revisalo antes de guardar.`);
            return;
        }

        const admin = getUsuarioActual();
        if (usuarioExistente) {
            await actualizarUsuario(usuarioExistente.id, { nombre, email, capacitador: capacitador ? "SI" : "NO" });
            registrarEvento(admin.id, "editar_usuario", `Datos corregidos de ${nombre} (antes: ${usuarioExistente.nombre})`);
        } else {
            await crearUsuario({ nombre, email, rol, sucursal: "Operaciones", capacitador });
            registrarEvento(admin.id, "registrar_usuario", `Alta de ${nombre} (${tituloRol}${capacitador ? " — capacitador" : ""})`);
        }

        if (rol === "supervisor") {
            await sincronizarLocalesSupervisor(usuarioExistente?.nombre || nombre, nombre, localesSeleccionados);
        }

        cerrarModal(modalId);
        navigate("colaboradores");
    });

    if (rol === "supervisor") bindMultiSelectSucursales("input-locales-supervisor");
}

/** Aplica la selección de locales de un Supervisor a la Sheet
 *  "Sucursales": lo desvincula de los que ya no están tildados y lo
 *  suma a los que sí — SIN afectar a otros supervisores que ya
 *  tuviera ese mismo local (ver agregarSupervisorASucursal/
 *  quitarSupervisorDeSucursal, data/sucursales.js). Antes esto
 *  pisaba el campo entero; con más de un supervisor por local
 *  posible (cobertura de vacaciones, locales grandes), pisar borraría
 *  al resto. */
async function sincronizarLocalesSupervisor(nombreAnterior, nombreNuevo, localesSeleccionados) {
    const sucursales = await getSucursales();

    const asignadosAntes = sucursales.filter((s) => s.supervisor.split(",").map((n) => n.trim()).includes(nombreAnterior));
    for (const s of asignadosAntes) {
        if (!localesSeleccionados.includes(s.nombre)) {
            await quitarSupervisorDeSucursal(s.id, nombreAnterior);
        }
    }

    for (const nombreLocal of localesSeleccionados) {
        const sucursal = sucursales.find((s) => s.nombre === nombreLocal);
        if (sucursal) {
            // Si cambió de nombre (edición de perfil), primero se saca
            // el nombre viejo de este local antes de sumar el nuevo.
            if (nombreAnterior !== nombreNuevo) await quitarSupervisorDeSucursal(sucursal.id, nombreAnterior);
            await agregarSupervisorASucursal(sucursal.id, nombreNuevo);
        }
    }
}

/** Modal de "Enviar mail" — destinatarios ya resueltos por
 *  bindColaboradores() antes de abrir (seleccionados, o todos los
 *  visibles si no se tildó ninguno). Mismo asunto/cuerpo para toda
 *  la lista (ver services/mail.js + apps-script/Code.gs). No hay
 *  costura de mock data acá: enviarMail() ya avisa solo si no hay
 *  backend real conectado. */
function abrirModalEnviarMail(destinatarios) {

    const modalId = "modal-enviar-mail";
    const primeros = destinatarios.slice(0, 6).map((d) => d.nombre).join(", ");
    const resto = destinatarios.length > 6 ? ` y ${destinatarios.length - 6} más` : "";

    const contenidoHtml = `
        <p class="text-sm text-muted">Para: ${primeros}${resto} (${destinatarios.length})</p>

        <label for="input-mail-asunto">Asunto</label>
        <input type="text" id="input-mail-asunto" placeholder="Asunto del mail">

        <label for="input-mail-cuerpo">Mensaje</label>
        <textarea id="input-mail-cuerpo" rows="8" placeholder="Escribí el mensaje..."></textarea>
    `;

    abrirModal(Modal({
        id: modalId,
        titulo: `Enviar mail (${destinatarios.length})`,
        contenidoHtml,
        textoConfirmar: "Enviar",
    }), modalId, async () => {

        const asunto = document.getElementById("input-mail-asunto").value.trim();
        const cuerpo = document.getElementById("input-mail-cuerpo").value.trim();

        if (!asunto || !cuerpo) {
            alert("Completá asunto y mensaje antes de enviar.");
            return;
        }
        if (!confirm(`¿Enviar este mail a ${destinatarios.length} persona(s)? Esta acción no se puede deshacer.`)) return;

        const resultado = await enviarMail(destinatarios.map((d) => d.email), asunto, cuerpo);

        if (!resultado || resultado.ok === false) {
            alert(resultado?.error || "No se pudo enviar el mail.");
            return;
        }

        const admin = getUsuarioActual();
        registrarEvento(admin.id, "enviar_mail", `Mail "${asunto}" enviado a ${resultado.enviados} de ${destinatarios.length} destinatario(s).`);

        cerrarModal(modalId);
        alert(
            resultado.fallidos?.length
                ? `Mail enviado a ${resultado.enviados} persona(s). No se pudo enviar a: ${resultado.fallidos.join(", ")}.`
                : `Mail enviado a ${resultado.enviados} persona(s).`
        );
    });
}
