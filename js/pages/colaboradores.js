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
import { getUsuarios, getColaboradores, getColaboradoresPorSucursal, crearUsuario, actualizarUsuario, eliminarUsuario } from "../data/usuarios.js";
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
import { celdaPct, estadoEvaluacion, progresoCursoDePersona, barraProgreso, mapaLecciones, leccionesDePersona, kpisSemaforo } from "./reportes.js";
import { exportarAPdf, membreteHtml } from "../services/exportarPdf.js";

const DIAS_ACCESO_INICIAL = 30;
const DIAS_EXTENSION = 15;
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

    // Todo lo demás (renovar/deshabilitar/extender/permanente) es
    // gestión de acceso — Encargado (puedeDeshabilitar=false) no debe
    // ver ninguno de estos ítems, solo el estado.
    if (puedeDeshabilitar) {
        const itemsAcceso = [];
        if (colaborador.activo !== "SI") {
            itemsAcceso.push(`<button class="menu-acciones-item" data-renovar="${colaborador.id}">Renovar acceso</button>`);
        } else {
            itemsAcceso.push(`<button class="menu-acciones-item" data-deshabilitar="${colaborador.id}">Deshabilitar</button>`);
        }
        if (colaborador.fechaVencimientoAcceso) {
            itemsAcceso.push(`<button class="menu-acciones-item" data-extender="${colaborador.id}">+${DIAS_EXTENSION} días</button>`);
            itemsAcceso.push(`<button class="menu-acciones-item" data-permanente="${colaborador.id}">Hacer permanente</button>`);
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
function checkboxMail(email, nombre) {
    if (!email) return "";
    return `<input type="checkbox" class="mail-check" style="width:auto" data-mail-email="${email}" data-mail-nombre="${nombre}">`;
}

const COLUMNAS_BASE = (mostrarSucursal, puedeEnviarMail) => [
    ...(puedeEnviarMail ? [{ key: "seleccion", label: "" }] : []),
    { key: "nombre", label: "Nombre" },
    { key: "email", label: "Email" },
    { key: "rolLabel", label: "Rol" },
    ...(mostrarSucursal ? [{ key: "sucursal", label: "Sucursal" }] : []),
    { key: "progresoBadge", label: "Progreso" },
    { key: "estadoBadge", label: "Estado" },
    { key: "accesoBadge", label: `Acceso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Tocá los tres puntos (⋮) de cada fila para editar, activar/desactivar, o dar acceso permanente/extender los días a este colaborador.">ⓘ</span>` },
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
    const cursosAplicables = cursos.filter((cur) => cur.categoria !== "Gestión" || colaborador.encargado);
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
        nombre: nombreConAvatar(c.nombre, c.foto, c.encargado ? "Encargado" : "Colaborador"),
        seleccion: checkboxMail(c.email, c.nombre),
        rolLabel: c.encargado ? "Colaborador (Encargado)" : "Colaborador",
        progreso: progreso.pct,
        progresoBadge: badgeProgreso(progreso),
        estadoBadge: badgeAcceso(c),
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
        seleccion: checkboxMail(u.email, u.nombre),
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
const COLUMNAS_SEMAFORO_GESTION = (cursos) => [
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
    { key: "accesoBadge", label: `Acceso<span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Tocá los tres puntos (⋮) de cada fila para editar, activar/desactivar, o dar acceso permanente/extender los días a este colaborador.">ⓘ</span>` },
    { key: "acciones", label: "" },
];

function filaSemaforoGestion(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin, resultados, cursosConEvaluacion, mapaLeccionesPorCurso) {
    const progreso = progresoColaborador(c, asignaciones, cursos);
    const cursosAplicables = cursos.filter((cur) => cur.categoria !== "Gestión" || c.encargado);
    const { vistas: leccionesVistas, total: leccionesTotal } = leccionesDePersona(c, cursosAplicables, asignaciones, mapaLeccionesPorCurso);
    const fila = {
        ...c,
        nombre: nombreConAvatar(c.nombre, c.foto, c.encargado ? "Encargado" : "Colaborador"),
        rolLabel: c.encargado ? "Colaborador (Encargado)" : "Colaborador",
        progreso: progreso.pct,
        modulosVistos: barraProgreso(progreso.hechos, progreso.total),
        leccionesVistas: barraProgreso(leccionesVistas, leccionesTotal),
        estadoBadge: badgeAcceso(c),
        accesoBadge: badgeVencimiento(c),
        acciones: filaAcciones(c, puedeDeshabilitar, puedeEditar, esAdmin),
    };
    cursos.forEach((cur) => {
        const aplica = cur.categoria !== "Gestión" || c.encargado;
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

    let gruposPorSucursal = null; // Admin y Supervisor (con >1 local) ven la lista agrupada
    let colaboradores;
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
    } else if (esEncargado) {
        colaboradores = await getColaboradoresPorSucursal(usuario.sucursal);
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
        let elegidos = [];
        if (usuario.capacitador) {
            elegidos = getLocalesElegidos(usuario);
            cantidadLocalesElegidos = elegidos.length;
            if (elegidos.length) nombresLocales = nombresLocales.filter((n) => elegidos.includes(n));
        }
        const todos = await getColaboradores();
        colaboradores = todos.filter((c) => nombresLocales.includes(c.sucursal));
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
    // hacen falta para Supervisor/Capacitador/Encargado (el detalle de
    // evaluación real y la barra de Lecciones vistas, ver
    // estadoEvaluacion/filaSemaforoGestion) — Admin usa
    // filaDeColaborador, que no los toca, así que ni se piden.
    const [asignaciones, cursos, resultados, evaluaciones, lecciones] = await Promise.all([
        getAsignaciones(),
        getCursos(),
        esAdmin ? [] : getResultados(),
        esAdmin ? [] : getEvaluaciones(),
        esAdmin ? [] : getLecciones(),
    ]);
    const cursosConEvaluacion = esAdmin ? new Set() : new Set(evaluaciones.map((p) => String(p.cursoId)));
    const mapaLeccionesPorCurso = esAdmin ? null : mapaLecciones(lecciones);

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
        : (c) => filaSemaforoGestion(c, puedeDeshabilitar, puedeEditar, asignaciones, cursos, esAdmin, resultados, cursosConEvaluacion, mapaLeccionesPorCurso);
    const columnasTabla = esAdmin ? COLUMNAS_BASE(false, esAdmin) : COLUMNAS_SEMAFORO_GESTION(cursos);

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
                    <h3>${nombreSucursal} <span class="text-sm text-muted">(${delGrupo.length})</span></h3>
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

    const alcanceLabel = esAdmin ? "Todas las sucursales" : usuario.capacitador ? (cantidadLocalesElegidos ? `${cantidadLocalesElegidos} local(es) elegido(s) · Solo lectura` : "Toda la red · Solo lectura") : usuario.sucursal || "Tus locales";

    return `
        ${Header(esEncargado ? "Mi local" : "Colaboradores", alcanceLabel)}

        ${localesElegidosSinDatos.length ? `
            <p class="text-sm text-muted" style="margin-top:-6px">
                ${localesElegidosSinDatos.length === 1 ? "Uno de tus locales elegidos" : `${localesElegidosSinDatos.length} de tus locales elegidos`}
                todavía no ${localesElegidosSinDatos.length === 1 ? "tiene" : "tienen"} colaboradores cargados: ${localesElegidosSinDatos.join(", ")}.
            </p>
        ` : ""}

        ${!esAdmin ? '<div class="imprimible" id="equipo-imprimible">' : ""}

        ${!esAdmin && colaboradores.length ? resumenSemaforoHtml(colaboradores, asignaciones, cursos, resultados, usuario.rol === "supervisor") : ""}

        ${esAdmin ? `
            <div class="galeria-pills" style="margin-bottom:14px">
                ${ROL_TABS.map((t, i) => `<button class="pill-categoria${i === 0 ? " activa" : ""}" data-rol-tab="${t.id}">${t.label}</button>`).join("")}
            </div>
        ` : ""}

        <div class="table-toolbar">
            <input type="search" id="buscador-colaboradores" placeholder="Buscar por nombre...">
            ${usuario.capacitador ? `<button class="btn btn-secondary" id="btn-elegir-locales">📍 Elegir mis locales</button>` : ""}
            ${puedeRegistrar ? `<button class="btn btn-primary" id="btn-registrar-colaborador" data-toolbar-rol="colaborador">+ Registrar colaborador</button>` : ""}
            ${esAdmin ? `<button class="btn btn-primary" id="btn-nuevo-supervisor" data-toolbar-rol="supervisor" hidden>+ Nuevo supervisor</button>` : ""}
            ${esAdmin ? `<button class="btn btn-primary" id="btn-nuevo-admin" data-toolbar-rol="admin" hidden>+ Nuevo admin</button>` : ""}
        </div>

        <div class="galeria-pills" style="margin:14px 0">
            <button class="pill-categoria activa" data-filtro-activo="todos">Todos</button>
            <button class="pill-categoria" data-filtro-activo="SI">Activos</button>
            <button class="pill-categoria" data-filtro-activo="NO">Inactivos</button>
            <button class="pill-categoria" id="btn-filtro-encargados">Encargados</button>
        </div>

        ${esAdmin ? `
            <div class="barra-enviar-mail">
                <label class="text-sm"><input type="checkbox" id="chk-mail-todos" style="width:auto">Seleccionar todos los visibles</label>
                <button class="btn btn-secondary" id="btn-enviar-mail">✉ Enviar mail</button>
            </div>
        ` : ""}

        <div id="tabla-colaboradores">
            <div data-rol-panel="colaborador">${cuerpoHtml}</div>
            ${esAdmin ? `<div data-rol-panel="supervisor" hidden>${cuerpoSupervisoresHtml}</div>` : ""}
            ${esAdmin ? `<div data-rol-panel="admin" hidden>${cuerpoAdminsHtml}</div>` : ""}
        </div>

        ${!esAdmin ? "</div>" : ""}
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
    // toggle "Encargados" se combinan sobre las mismas filas — cada
    // uno decide si esconde una fila, nunca la muestra si otro ya la
    // escondió. "Encargado" se detecta por texto ("(Encargado)" en la
    // columna Rol, ver rolLabel en filaDeColaborador) en vez de por
    // posición de columna, porque esa columna se corre según si hay
    // checkbox de mail o columna de sucursal antes.
    function aplicarFiltros() {
        const texto = (buscador?.value || "").trim().toLowerCase();
        document.querySelectorAll("#tabla-colaboradores tbody tr").forEach((fila) => {
            // La celda de nombre ya no es siempre la primera: si puede
            // enviar mail, la primera es el checkbox de selección.
            const primeraCelda = fila.firstElementChild;
            const celdaNombre = primeraCelda?.querySelector(".mail-check") ? fila.children[1] : primeraCelda;
            const nombre = celdaNombre?.textContent.toLowerCase() || "";
            const coincideTexto = nombre.includes(texto);
            const esActivo = !!fila.querySelector(".badge-success");
            const coincideEstado = filtroActivo === "todos" || (filtroActivo === "SI") === esActivo;
            const coincideEncargado = !soloEncargados || fila.textContent.includes("(Encargado)");
            fila.style.display = coincideTexto && coincideEstado && coincideEncargado ? "" : "none";
        });
    }

    if (buscador) buscador.addEventListener("input", aplicarFiltros);

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
            if (buscador) buscador.value = "";
            const chkTodos = document.getElementById("chk-mail-todos");
            if (chkTodos) chkTodos.checked = false;
            aplicarFiltros();
        });
    });

    // ---- "Enviar mail" (uno, varios o todos los visibles) ----
    // Solo Admin — Supervisor/Encargado nunca ven estos controles
    // (a diferencia de editar/deshabilitar, que sí puede un Supervisor).

    function panelActivo() {
        return document.querySelector("#tabla-colaboradores [data-rol-panel]:not([hidden])") || document.getElementById("tabla-colaboradores");
    }

    function checksVisibles(panel) {
        return [...panel.querySelectorAll(".mail-check")].filter((chk) => {
            const fila = chk.closest("tr");
            return !fila || fila.style.display !== "none";
        });
    }

    document.getElementById("chk-mail-todos")?.addEventListener("change", (e) => {
        checksVisibles(panelActivo()).forEach((chk) => { chk.checked = e.target.checked; });
    });

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

    document.querySelectorAll("[data-renovar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.renovar;
            const colaboradores = await getColaboradores();
            const c = colaboradores.find((x) => String(x.id) === String(id));

            // Antes esto SOLO hacía {activo:"SI"} y dejaba intacta la
            // fecha de vencimiento. Para alguien con fecha ya pasada (el
            // caso típico: justamente por eso se le renueva) no servía
            // de nada — seguía figurando "vencido", y peor: al entrar,
            // el backend ve la fecha vencida y lo vuelve a desactivar
            // solo (ver _usuarioDeSesion en apps-script/Code.gs). Ahora
            // se le da una ventana nueva, igual que un alta.
            const cambios = { activo: "SI" };
            const vencimiento = c?.fechaVencimientoAcceso || "";
            const yaVencido = vencimiento && diasEntre(fechaHoyISO(), vencimiento) <= 0;
            // Sin fecha = acceso permanente: no se le pone una ahora,
            // sería degradarlo sin que nadie lo pida. Con fecha futura
            // se respeta la que ya tenía.
            if (yaVencido) cambios.fechaVencimientoAcceso = sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL);

            await actualizarUsuario(id, cambios);
            registrarEvento(getUsuarioActual().id, "renovar_acceso", `Acceso renovado (usuario ${id})${cambios.fechaVencimientoAcceso ? ` — nuevo vencimiento: ${cambios.fechaVencimientoAcceso}` : ""}`);
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

    document.querySelectorAll("[data-extender]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.extender;
            const colaboradores = await getColaboradores();
            const c = colaboradores.find((x) => String(x.id) === String(id));
            if (!c) return;
            const base = c.fechaVencimientoAcceso && diasEntre(fechaHoyISO(), c.fechaVencimientoAcceso) > 0
                ? c.fechaVencimientoAcceso
                : fechaHoyISO();
            const nuevaFecha = sumarDias(base, DIAS_EXTENSION);
            await actualizarUsuario(id, { fechaVencimientoAcceso: nuevaFecha, activo: "SI" });
            registrarEvento(getUsuarioActual().id, "extender_acceso", `Acceso de ${c.nombre} extendido ${DIAS_EXTENSION} días (nuevo vencimiento: ${nuevaFecha})`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-permanente]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.permanente;
            if (!confirm("¿Marcar este acceso como permanente (sin vencimiento)?")) return;
            await actualizarUsuario(id, { fechaVencimientoAcceso: "", activo: "SI" });
            registrarEvento(getUsuarioActual().id, "acceso_permanente", `Acceso del usuario ${id} pasó a permanente`);
            navigate("colaboradores");
        });
    });

    document.querySelectorAll("[data-editar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const colaboradores = await getColaboradores();
            const c = colaboradores.find((x) => String(x.id) === String(btn.dataset.editar));
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
        <p class="text-sm text-muted" style="margin-bottom:10px">Elegí los locales que te interesa seguir de cerca — "Mi equipo" y tu Inicio se van a acotar a esos. Dejalo vacío para seguir viendo toda la red.</p>
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

        <label for="input-encargado">
            <input type="checkbox" id="input-encargado" style="width:auto;display:inline-block;margin-right:8px" ${colaborador.encargado ? "checked" : ""}>
            Es encargado de sucursal
        </label>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Editar colaborador", contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const email = document.getElementById("input-email").value.trim();
        const sucursal = campoSucursal.leer();
        const encargado = document.getElementById("input-encargado").checked;

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
        await actualizarUsuario(colaborador.id, { nombre, email, sucursal, encargado: encargado ? "SI" : "NO" });
        registrarEvento(usuario.id, "editar_colaborador", `Datos corregidos de ${nombre} (antes: ${colaborador.nombre})`);

        cerrarModal(modalId);
        navigate("colaboradores");
    });

    campoSucursal.bind();
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

        <label for="input-encargado">
            <input type="checkbox" id="input-encargado" style="width:auto;display:inline-block;margin-right:8px">
            Es encargado de sucursal
        </label>

        <p class="text-xs text-muted" style="margin-top:14px">El acceso se da por ${DIAS_ACCESO_INICIAL} días. Se puede extender o hacer permanente después, desde esta misma pantalla.</p>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Registrar colaborador", contenidoHtml, textoConfirmar: "Registrar" }), modalId, async () => {

        const nombre = document.getElementById("input-nombre").value.trim();
        const email = document.getElementById("input-email").value.trim();
        const sucursal = campoSucursal.leer();
        const encargado = document.getElementById("input-encargado").checked;

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
        await crearUsuario({ nombre, email, rol: "colaborador", sucursal, encargado, fechaVencimientoAcceso });
        registrarEvento(usuario.id, "registrar_colaborador", `Alta de ${nombre} (acceso por ${DIAS_ACCESO_INICIAL} días)`);

        cerrarModal(modalId);
        navigate("colaboradores");
    });

    campoSucursal.bind();
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
                Es capacitador (mismos permisos que Supervisor, solo cambia la etiqueta)
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
