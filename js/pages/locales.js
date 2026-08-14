/* ============================
   Lucciano's Academy
   pages/locales.js — Gestión de Locales (Sucursales)

   "Locales" es el término que usa la nueva navegación; internamente
   sigue siendo la hoja/tabla "Sucursales" (data/sucursales.js) — no
   se renombra nada del modelo de datos, solo la etiqueta en pantalla.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { getSucursales, getMisLocales, crearSucursal, actualizarSucursal, eliminarSucursal } from "../data/sucursales.js";
import { getUsuarios } from "../data/usuarios.js";
import { getCursos, actualizarCurso } from "../data/cursos.js";
import { getLecciones, actualizarLeccion } from "../data/lecciones.js";
import { getDisponibilidad, mapaDisponibilidad, guardarDisponibilidad } from "../data/disponibilidad.js";
import { PRODUCTOS_CHOCOLATERIA } from "../data/productosChocolateria.js";
import { PRODUCTOS_HELADERIA } from "../data/productosHeladeria.js";
import { PRODUCTOS_ICEPOPS } from "../data/productosIcepops.js";
import { PRODUCTOS_PASTELERIA } from "../data/productosPasteleria.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { escaparHtml } from "../services/html.js";
import { navigate } from "../router.js";

// Los productos viven en el código (data/productos*.js); acá sólo hace
// falta saber cuáles son de cada curso para armar el árbol.
const CATALOGO_POR_CURSO = {
    "Chocolatería": [PRODUCTOS_CHOCOLATERIA],
    "Heladería": [PRODUCTOS_HELADERIA],
    "Icepops": [PRODUCTOS_ICEPOPS],
    "Pastelería": [PRODUCTOS_PASTELERIA],
};

/** Cuenta cuántos ítems tienen restringido a este local, separados por
 *  TIPO (Módulos/Lecciones/Catálogo) — pedido explícito del usuario:
 *  "1 módulo, 2 lecciones, 20 catálogo", así se sabe DE QUÉ son las
 *  restricciones sin tener que entrar a revisar. Cada grupo además
 *  guarda los nombres, para el tooltip. Se arma una sola vez por
 *  render y se consulta por fila. */
const TIPOS_RESTRICCION = [
    // "tono" es fijo por TIPO — pedido explícito: "que cada pill tenga
    // un color distinto, así detectamos de dónde proviene [de qué tipo
    // es]". Antes el color marcaba local-vs-país; eso se sacó (ver
    // badgeRestricciones) porque no puede marcar dos cosas a la vez.
    { key: "Cursos", singular: "módulo", plural: "módulos", tono: "badge-warning" },
    { key: "Lecciones", singular: "lección", plural: "lecciones", tono: "badge-info" },
    // "Catálogo" no cambia con la cantidad — pedido explícito: "20
    // catálogo", no "20 catálogos".
    { key: "Catálogo", singular: "catálogo", plural: "catálogo", tono: "badge-violeta" },
];

function contarRestricciones(items, local) {
    const porTipo = {};
    TIPOS_RESTRICCION.forEach(({ key }) => { porTipo[key] = { local: [], pais: [] }; });
    items.forEach(({ nombre, tipo, noAplicaA }) => {
        const lista = String(noAplicaA || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        if (!lista.length) return;
        if (lista.includes(String(local.nombre).toLowerCase())) porTipo[tipo].local.push(nombre);
        else if (local.pais && lista.includes(String(local.pais).toLowerCase())) porTipo[tipo].pais.push(nombre);
    });
    return porTipo;
}

// Corta la lista de nombres a 8: con un local que acumula muchas
// exclusiones (típico del país entero, ej. "Gluten Free" sacado de
// toda España), un tooltip de 40 líneas es tan inútil como no tener
// ninguna — la idea es dar un vistazo, no reemplazar "Contenido que
// tiene" para una auditoría a fondo.
function textoDetalle(nombres) {
    if (nombres.length <= 8) return nombres.join(" · ");
    return nombres.slice(0, 8).join(" · ") + ` · y ${nombres.length - 8} más`;
}

function badgeRestricciones(local) {
    const porTipo = local._restricciones || {};
    const badges = TIPOS_RESTRICCION.map(({ key, singular, plural, tono }) => {
        const grupo = porTipo[key] || { local: [], pais: [] };
        const total = grupo.local.length + grupo.pais.length;
        if (!total) return "";
        // Sin aclarar "configurado acá" vs "heredado del país" — pedido
        // explícito: "no hace falta una aclaración, solo saber que no
        // está activado".
        const nombres = [...grupo.local, ...grupo.pais];
        const etiqueta = total === 1 ? singular : plural;
        // ".mod-tooltip" trae de base subrayado punteado + negrita
        // (pensado para envolver texto abreviado, ver
        // services/tooltips.js) — sobre un badge que ya tiene su
        // propio fondo y borde queda de más, se anula inline. El
        // mecanismo de hover/tap es el mismo en toda la app, así que
        // no hace falta nada más para que funcione acá.
        return `<span class="badge ${tono} mod-tooltip" style="border-bottom:none;font-weight:inherit;cursor:help" data-tooltip-texto="${escaparHtml(textoDetalle(nombres))}">${total} ${etiqueta}</span>`;
    }).filter(Boolean);
    return badges.length ? badges.join(" ") : `<span class="text-sm text-muted">—</span>`;
}

function badgeEstado(local) {
    return local.estado === "Activa"
        ? `<span class="badge badge-success">Activa</span>`
        : `<span class="badge badge-muted">Inactiva</span>`;
}

// Propio vs franquicia — usado por los canales de Comunicaciones
// "Encargados — Locales propios/Franquicias" (ver data/canales.js,
// puedeVerCanal). Por descarte: si no está marcado como propio, es
// franquicia — mismo criterio pedido explícito del usuario.
function badgeTipo(local) {
    return local.esPropio
        ? `<span class="badge badge-success">Propio</span>`
        : `<span class="badge badge-muted">Franquicia</span>`;
}

// Menú "⋮" en vez de 3 botones sólidos por fila (mismo patrón que
// pages/colaboradores.js, duplicado a propósito acá — ver la nota de
// supervisores.js sobre evitar un módulo util compartido fuera de la
// lista de archivos aprobada).
function menuAcciones(items) {
    return `
        <div class="menu-acciones-wrap">
            <button class="btn btn-secondary menu-acciones-toggle" type="button" data-menu-toggle aria-label="Acciones">⋮</button>
            <div class="menu-acciones-dropdown" hidden>${items.join("")}</div>
        </div>
    `;
}

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
        const left = Math.min(r.left, window.innerWidth - ancho - 8);
        dropdown.style.left = `${Math.max(8, left)}px`;
        dropdown.style.top = `${r.bottom + 6}px`;

        const alturaEstimada = dropdown.offsetHeight || 140;
        if (r.bottom + 6 + alturaEstimada > window.innerHeight) {
            dropdown.style.top = `${r.top - alturaEstimada - 6}px`;
        }
    });
}

/**
 * Un Capacitador es de solo lectura en TODA la app — decisión del
 * cliente, ver la nota en pages/colaboradores.js. Faltaba aplicarlo
 * acá: podía editar un local, activarlo o cambiarle el tipo. Es el rol
 * que se le da a alguien que tiene que RECORRER la plataforma sin poder
 * alterarla.
 */
/* El prefijo "Lucciano's" lo pone la app, no se tipea. Escribirlo a mano
   fue lo que metió "Lucciano’s Oroño Santa Fe" con apóstrofo tipográfico
   —el que ponen solo los teclados de iPhone y Word— mientras el resto de
   la red usa el recto. Son caracteres distintos, y como los nombres de
   local son la clave con la que se compara todo, un local escrito de una
   forma no matchea contra el mismo nombre escrito de la otra. Falla en
   silencio: nadie ve un error, simplemente ese local queda afuera. */
const PREFIJO_LOCAL = "Lucciano's ";

/** Saca el prefijo escrito de cualquier forma, para que el campo muestre
 *  sólo la parte editable y pegar el nombre completo no lo duplique. */
function sinPrefijo(nombre) {
    return String(nombre || "")
        .replace(/^\s*lucciano['\u2018\u2019\u02BC]?s?\s+/i, "")
        .trim();
}

function puedeGestionarLocales(usuario) {
    if (usuario?.rol === "admin") return true;
    return usuario?.rol === "supervisor" && !usuario?.capacitador;
}

function filaAcciones(local, puedeGestionar, esAdmin) {
    const editarBtn = `<button class="menu-acciones-item" data-editar="${local.id}">Editar</button>`;
    const estadoBtn = local.estado === "Activa"
        ? `<button class="menu-acciones-item" data-desactivar="${local.id}">Desactivar</button>`
        : `<button class="menu-acciones-item" data-activar="${local.id}">Activar</button>`;
    const tipoBtn = local.esPropio
        ? `<button class="menu-acciones-item" data-marcar-franquicia="${local.id}">Marcar franquicia</button>`
        : `<button class="menu-acciones-item" data-marcar-propio="${local.id}">Marcar propio</button>`;
    const modulosBtn = `<button class="menu-acciones-item" data-modulos="${local.id}">Contenido que tiene</button>`;
    // Eliminar es Admin-only, mismo criterio que dar de alta un local
    // nuevo: es un cambio estructural, no una corrección del día a día
    // (eso es Editar/Desactivar/Marcar propio, que sí puede un
    // Supervisor). El chequeo real de si se puede borrar sin dejar
    // gente sin sucursal pasa recién al hacer click — acá solo se
    // decide quién ve el botón.
    const eliminarBtn = `<button class="menu-acciones-item menu-acciones-item-danger" data-eliminar-local="${local.id}">Eliminar</button>`;
    // "Contenido que tiene" queda para todos: ya abre en solo lectura si
    // no sos Admin, y es justo lo que alguien que viene a revisar la
    // plataforma necesita mirar.
    if (!puedeGestionar) return menuAcciones([modulosBtn]);
    return menuAcciones(esAdmin ? [editarBtn, modulosBtn, estadoBtn, tipoBtn, eliminarBtn] : [editarBtn, modulosBtn, estadoBtn, tipoBtn]);
}

export async function Locales() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario?.rol === "admin";
    const puedeGestionar = puedeGestionarLocales(usuario);

    // El Supervisor entra a VERIFICAR que sus locales estén bien
    // cargados y a corregir lo que haga falta, no a dar de alta locales
    // nuevos: eso es un cambio estructural y queda en el Admin. Editar,
    // activar y marcar propio/franquicia sí puede — el backend ya se lo
    // permite (Code.gs, Sucursales.actualizar).
    const [locales, cursos, lecciones, disponibilidad] = await Promise.all([
        getSucursales(), getCursos(), getLecciones(), getDisponibilidad(),
    ]);
    const misLocales = esAdmin ? [] : await getMisLocales(usuario, locales);

    // Todas las restricciones que existen, de las tres fuentes, en una
    // sola lista — con el NOMBRE de cada una, no solo el texto crudo de
    // noAplicaA, para que el tooltip de abajo pueda decir "Gluten Free"
    // en vez de un número pelado. Se arma una vez y no por fila: con
    // 123 locales, recalcularlo en cada uno serían 123 pasadas sobre
    // los ~300 ítems.
    const todosLosItems = [
        ...cursos.map((c) => ({ nombre: c.nombre, tipo: "Cursos", noAplicaA: c.noAplicaA })),
        ...lecciones.map((l) => ({ nombre: l.titulo, tipo: "Lecciones", noAplicaA: l.noAplicaA })),
        ...disponibilidad.map((d) => ({ nombre: d.producto ? `${d.producto} (${d.curso})` : d.curso, tipo: "Catálogo", noAplicaA: d.noAplicaA })),
    ].filter((it) => it.noAplicaA);
    locales.forEach((l) => { l._restricciones = contarRestricciones(todosLosItems, l); });

    const columnas = [
        { key: "seleccion", label: "" },
        { key: "nombre", label: "Local" },
        { key: "supervisor", label: "Supervisor" },
        { key: "restriccionBadge", label: "Restricciones" },
        { key: "tipoBadge", label: "Tipo" },
        { key: "estadoBadge", label: "Estado" },
        { key: "acciones", label: "" },
    ];

    const armarFila = (l) => ({
        ...l,
        // El país va como atributo de la fila y no como columna visible:
        // repetir "Argentina" 102 veces gasta ancho sin decir nada, y el
        // filtro lo lee igual. Lo mismo con "mío", que además solo le
        // importa al Supervisor.
        _datos: { pais: l.pais || "", mio: misLocales.includes(l.nombre) ? "1" : "0" },
        // Distingue si lo que le falta viene heredado del país o es
        // propio del local. Sin separarlos, un local con "3
        // restricciones" no dice si es una excepción suya o algo que le
        // pasa a todo el país — y son dos cosas muy distintas al
        // revisar por qué alguien no ve un contenido.
        restriccionBadge: badgeRestricciones(l),
        seleccion: `<input type="checkbox" class="local-check" style="width:auto" data-local-id="${l.id}" data-local-nombre="${escaparHtml(l.nombre)}">`,
        supervisor: l.supervisor || "—",
        tipoBadge: badgeTipo(l),
        estadoBadge: badgeEstado(l),
        acciones: filaAcciones(l, puedeGestionar, esAdmin),
    });

    // Propios y franquicias se operan distinto, así que la pregunta más
    // frecuente frente a esta pantalla es "¿cuáles son los propios?".
    // Mezclados en una sola tabla había que leer la columna Tipo fila
    // por fila; agrupados se responde de un vistazo. Mismo patrón de
    // secciones que ya usa "Mi equipo" al agrupar por sucursal.
    const propios = locales.filter((l) => l.esPropio);
    const franquicias = locales.filter((l) => !l.esPropio);

    const seccion = (titulo, lista, ayuda) => `
        <div class="section" data-tipo-seccion="${titulo}">
            <h3>${titulo} <span class="text-sm text-muted">(${lista.length})</span></h3>
            ${lista.length
                ? Table(columnas, lista.map(armarFila))
                : `<p class="text-sm text-muted">${ayuda}</p>`}
        </div>
    `;

    // Segmentador por país. Con 122 locales repartidos en 7 países,
    // llegar a los 4 de Uruguay scrolleando es incómodo. Se arma desde
    // los datos y no con una lista fija: el día que abra un local en un
    // país nuevo, la pill aparece sola.
    //
    // Argentina primero por ser el 84% de los locales, el resto por
    // cantidad. Ordenar alfabéticamente dejaba Chile —con un local—
    // antes que Argentina.
    const porPais = new Map();
    locales.forEach((l) => {
        const p = l.pais || "Sin país";
        porPais.set(p, (porPais.get(p) || 0) + 1);
    });
    const paises = [...porPais.entries()].sort((a, b) => {
        if (a[0] === "Argentina") return -1;
        if (b[0] === "Argentina") return 1;
        return b[1] - a[1] || a[0].localeCompare(b[0], "es");
    });

    const pillsPais = [
        // "Todos los países" y no "Todos" a secas: al Supervisor le
        // aparece arriba la fila Todos/Mis locales, y dos pills "Todos"
        // una encima de la otra se leen como duplicadas.
        `<button class="pill-categoria activa" data-filtro-pais="todos">Todos los países <span class="text-sm">(${locales.length})</span></button>`,
        ...paises.map(([p, n]) =>
            `<button class="pill-categoria" data-filtro-pais="${escaparHtml(p)}">${escaparHtml(p)} <span class="text-sm">(${n})</span></button>`),
    ].join("");

    return `
        ${Header("Locales", "Sucursales de Lucciano's")}

        <div class="table-toolbar">
            <input type="search" id="buscador-locales" placeholder="Buscar local o supervisor...">
            ${esAdmin ? `<button class="btn btn-primary" id="btn-nuevo-local">+ Nuevo local</button>` : ""}
        </div>

        <!-- El Supervisor ve toda la red por defecto y filtra los suyos
             cuando quiere. Arrancar acotado a lo propio escondía
             justamente el error que viene a detectar: un local que
             DEBERÍA ser suyo y no está asignado no aparecería nunca. -->
        ${!esAdmin ? `
            <div class="galeria-pills" id="filtro-mios" style="margin:14px 0 0">
                <button class="pill-categoria activa" data-filtro-mio="todos">Todos <span class="text-sm">(${locales.length})</span></button>
                <button class="pill-categoria" data-filtro-mio="1">Mis locales <span class="text-sm">(${misLocales.length})</span></button>
            </div>
        ` : ""}

        <div class="galeria-pills" id="filtro-paises" style="margin:14px 0">${pillsPais}</div>

        <!-- Mismo patrón que Mi equipo: los botones de acción en lote
             aparecen sólo cuando hay algo tildado y dicen sobre cuántos
             van a aplicar. Siempre visibles y sin contador, no se sabía
             si "Marcar como propios" iba a tocar 1 local o 122. -->
        <!-- El ⓘ va FUERA del <label>: adentro, tocarlo cuenta como
             tocar la etiqueta y tildaba los 122 locales de una. -->
        <div class="barra-seleccion-todos text-sm">
            <label><input type="checkbox" id="chk-locales-todos" style="width:auto">Seleccionar todos los visibles</label>
            <span class="mod-tooltip kpi-ayuda" data-tooltip-texto="Tilda solo los locales que estás viendo ahora. Si filtraste por país o buscaste algo, los que quedaron ocultos NO se seleccionan — así podés, por ejemplo, filtrar Uruguay y marcarlos todos de una.">ⓘ</span>
        </div>
        <div class="barra-seleccion" id="barra-seleccion-locales" hidden>
            <span class="barra-seleccion-cuenta" id="cuenta-seleccion-locales">0 seleccionados</span>
            <div class="barra-seleccion-acciones">
                ${puedeGestionar ? `
                <button class="btn btn-secondary" id="btn-lote-propio">Marcar como propios</button>
                <button class="btn btn-secondary" id="btn-lote-franquicia">Marcar como franquicias</button>
                <!-- Mismo criterio que los dos de arriba: cuando entra un
                     supervisor nuevo hay que pasarle sus locales de a uno
                     por el menú ⋮, y son decenas. -->
                <button class="btn btn-secondary" id="btn-lote-supervisor">Asignar supervisor</button>
                ` : ""}
                <button class="btn btn-primary" id="btn-lote-contenido">Contenido que tienen</button>
            </div>
            <button class="btn btn-sutil" id="btn-limpiar-seleccion-locales">Deseleccionar</button>
        </div>

        <div id="tabla-locales">
            ${seccion("Locales propios", propios, "Ninguno marcado como propio todavía — usá el menú ⋮ de cada local para marcarlo.")}
            ${seccion("Franquicias", franquicias, "Todos los locales están marcados como propios.")}
        </div>

        <p id="locales-sin-resultados" class="text-sm text-muted" hidden>
            Ningún local coincide con la búsqueda.
        </p>
    `;
}

export function bindLocales() {

    bindMenuAcciones();

    const buscador = document.getElementById("buscador-locales");
    let paisActivo = "todos";
    let mioActivo = "todos";

    // Texto y país se aplican juntos: filtrarlos por separado hacía que
    // el último en ejecutarse pisara al otro (elegir un país mostraba
    // locales que la búsqueda había descartado).
    function aplicarFiltros() {
        const filtro = (buscador?.value || "").trim().toLowerCase();

        document.querySelectorAll("#tabla-locales tbody tr").forEach((fila) => {
            // Por columna y no por posición. Antes esto leía
            // firstElementChild, que desde que existe la columna de
            // checkboxes es una celda vacía: el buscador comparaba
            // siempre contra "" y escondía todos los locales apenas
            // tipeabas una letra.
            const nombre = fila.querySelector('[data-col="nombre"]')?.textContent.toLowerCase() || "";
            const supervisor = fila.querySelector('[data-col="supervisor"]')?.textContent.toLowerCase() || "";
            const pais = fila.dataset.pais || "";

            const coincideTexto = !filtro || nombre.includes(filtro) || supervisor.includes(filtro);
            const coincidePais = paisActivo === "todos" || pais === paisActivo;
            const coincideMio = mioActivo === "todos" || fila.dataset.mio === "1";
            fila.style.display = coincideTexto && coincidePais && coincideMio ? "" : "none";
        });

        // Una búsqueda que no matchea nada de un grupo dejaba su título
        // colgado sobre una tabla vacía, como si el local buscado no
        // existiera en ningún lado. Se esconde la sección entera.
        document.querySelectorAll("#tabla-locales .section").forEach((seccion) => {
            const visibles = [...seccion.querySelectorAll("tbody tr")]
                .some((f) => f.style.display !== "none");
            seccion.style.display = visibles ? "" : "none";
        });

        const vacio = document.getElementById("locales-sin-resultados");
        if (vacio) {
            const hay = [...document.querySelectorAll("#tabla-locales tbody tr")]
                .some((f) => f.style.display !== "none");
            vacio.hidden = hay;
        }

        // Filtrar cambia qué está a la vista, y las acciones en lote sólo
        // aplican sobre lo visible. Sin esto la barra podía decir "12
        // seleccionados" cuando el filtro dejó 2 en pantalla.
        refrescarBarraSeleccion();
    }

    buscador?.addEventListener("input", aplicarFiltros);

    document.getElementById("filtro-mios")?.addEventListener("click", (e) => {
        const pill = e.target.closest("[data-filtro-mio]");
        if (!pill) return;
        mioActivo = pill.dataset.filtroMio;
        document.querySelectorAll("#filtro-mios [data-filtro-mio]")
            .forEach((p) => p.classList.toggle("activa", p === pill));
        aplicarFiltros();
    });

    document.getElementById("filtro-paises")?.addEventListener("click", (e) => {
        const pill = e.target.closest("[data-filtro-pais]");
        if (!pill) return;
        paisActivo = pill.dataset.filtroPais;
        document.querySelectorAll("#filtro-paises [data-filtro-pais]")
            .forEach((p) => p.classList.toggle("activa", p === pill));
        aplicarFiltros();
    });

    // ---- Marcar propio / franquicia en bloque ----
    //
    // Marcarlos de a uno con el menú ⋮ era el trabajo que el usuario
    // terminó haciendo a mano ("si hay 10 propias las elijo todas juntas
    // y las marco de una vez, no una por una"). Se combina con el
    // buscador: filtrás, tildás todos los visibles, y aplicás.

    /** Los visibles AHORA — sólo para "seleccionar todos los visibles". */
    function checksVisibles() {
        return [...document.querySelectorAll("#tabla-locales .local-check")].filter((chk) => {
            const fila = chk.closest("tr");
            if (fila && fila.style.display === "none") return false;
            // El buscador también esconde la SECCIÓN entera cuando ningún
            // local suyo matchea. Sin mirar eso, las filas de una sección
            // oculta seguían contando como visibles y "seleccionar todos"
            // agarraba locales que no se estaban viendo.
            const seccion = chk.closest(".section");
            return !seccion || seccion.style.display !== "none";
        });
    }

    /**
     * Todos los tildados, estén filtrados o no.
     *
     * La selección NO se limita a lo visible, y esa era la falla: con
     * 123 locales el flujo real es buscar uno, tildarlo, borrar la
     * búsqueda, buscar el siguiente. Contando sólo lo visible, el
     * primero desaparecía de la cuenta al buscar el segundo y nunca se
     * podían juntar dos.
     */
    function marcados() {
        return [...document.querySelectorAll("#tabla-locales .local-check:checked")];
    }

    function refrescarBarraSeleccion() {
        const barra = document.getElementById("barra-seleccion-locales");
        if (!barra) return;
        const todos = marcados();
        barra.hidden = todos.length === 0;
        const cuenta = document.getElementById("cuenta-seleccion-locales");
        if (!cuenta) return;

        // Se avisa cuántos quedaron fuera del filtro: si no, la barra
        // dice "3 seleccionados" con un solo local en pantalla y parece
        // un error.
        const visibles = checksVisibles().filter((chk) => chk.checked).length;
        const ocultos = todos.length - visibles;
        cuenta.textContent = `${todos.length} ${todos.length === 1 ? "local seleccionado" : "locales seleccionados"}`
            + (ocultos ? ` · ${ocultos} fuera de la búsqueda` : "");
    }

    document.getElementById("chk-locales-todos")?.addEventListener("change", (e) => {
        checksVisibles().forEach((chk) => { chk.checked = e.target.checked; });
        refrescarBarraSeleccion();
    });

    // Delegado: las filas se re-renderizan al aplicar un lote, y un
    // listener por checkbox se perdería en ese redibujo.
    document.addEventListener("change", (e) => {
        if (e.target.classList?.contains("local-check")) refrescarBarraSeleccion();
    });

    document.getElementById("btn-limpiar-seleccion-locales")?.addEventListener("click", () => {
        document.querySelectorAll("#tabla-locales .local-check").forEach((chk) => { chk.checked = false; });
        const todos = document.getElementById("chk-locales-todos");
        if (todos) todos.checked = false;
        refrescarBarraSeleccion();
    });

    refrescarBarraSeleccion();

    // Una pasada al entrar deja la barra de selección y el cartel de
    // "sin resultados" consistentes con el estado inicial de los
    // filtros, sin depender de que el usuario toque algo primero.
    aplicarFiltros();

    /**
     * Aplica los mismos campos a todos los locales tildados.
     *
     * Genérica y no una función por acción: marcar propio/franquicia y
     * asignar supervisor comparten todo lo que importa —el confirm con
     * la lista, el guardado secuencial con progreso, el reporte de los
     * que fallaron— y solo cambia qué se escribe.
     */
    async function aplicarEnLote(etiqueta, campos, boton) {
        const seleccionados = marcados();
        if (!seleccionados.length) {
            alert("Primero tildá los locales que querés cambiar.");
            return;
        }

        const nombres = seleccionados.map((chk) => chk.dataset.localNombre);
        const muestra = nombres.slice(0, 10).join("\n· ");
        const resto = nombres.length > 10 ? `\n…y ${nombres.length - 10} más` : "";
        if (!confirm(`${etiqueta} a ${nombres.length} local(es):\n\n· ${muestra}${resto}\n\n¿Confirmás?`)) return;

        const textoOriginal = boton.textContent;
        boton.disabled = true;

        // Secuencial y con progreso, mismo criterio que el lote de
        // accesos en Mi equipo: cada guardado es una llamada a Apps
        // Script, y un Promise.all abortaría todo al primer fallo sin
        // dejar saber cuáles quedaron hechos.
        const fallaron = [];
        for (let i = 0; i < seleccionados.length; i++) {
            boton.textContent = `Procesando ${i + 1}/${seleccionados.length}...`;
            try {
                const r = await actualizarSucursal(seleccionados[i].dataset.localId, campos);
                if (r && r.ok === false) fallaron.push(nombres[i]);
            } catch (err) {
                fallaron.push(nombres[i]);
            }
        }

        boton.textContent = textoOriginal;
        boton.disabled = false;

        const hechos = seleccionados.length - fallaron.length;
        registrarEvento(getUsuarioActual().id, "editar_local", `${etiqueta} en bloque: ${hechos} de ${seleccionados.length}`);

        if (fallaron.length) {
            alert(`Se aplicó a ${hechos} de ${seleccionados.length}.\n\nNo se pudo con:\n· ${fallaron.join("\n· ")}`);
        }
        navigate("locales");
    }

    document.getElementById("btn-lote-propio")?.addEventListener("click", (e) =>
        aplicarEnLote("Marcar como PROPIOS", { esPropio: "SI" }, e.currentTarget));
    document.getElementById("btn-lote-franquicia")?.addEventListener("click", (e) =>
        aplicarEnLote("Marcar como FRANQUICIAS", { esPropio: "NO" }, e.currentTarget));

    document.getElementById("btn-lote-contenido")?.addEventListener("click", () => {
        const seleccionados = marcados();
        if (!seleccionados.length) {
            alert("Primero tildá los locales que querés configurar.");
            return;
        }
        const nombres = seleccionados.map((chk) => chk.dataset.localNombre);

        // Si están TODOS los locales del país activo, se guarda el país
        // en vez de los N nombres. No es cosmético: guardando los
        // nombres, el próximo local que abra en ese país no heredaría la
        // restricción y quedaría viendo lo que el resto no ve.
        const delPais = paisActivo !== "todos"
            ? [...document.querySelectorAll("#tabla-locales tbody tr")]
                .filter((f) => f.dataset.pais === paisActivo).length
            : 0;
        const esPaisEntero = paisActivo !== "todos" && nombres.length === delPais && delPais > 0;

        const ambitos = esPaisEntero ? [paisActivo] : nombres;
        // Se nombran los locales mientras entren: confirmar sobre "3
        // locales" obliga a cerrar el modal para recordar cuáles eran.
        const cortos = nombres.map((n) => n.replace("Lucciano's ", ""));
        const etiqueta = esPaisEntero
            ? `todo ${paisActivo}`
            : cortos.length <= 3
                ? cortos.join(", ")
                : `${cortos.slice(0, 2).join(", ")} y ${cortos.length - 2} más`;
        abrirModalContenido(ambitos, etiqueta);
    });

    document.getElementById("btn-lote-supervisor")?.addEventListener("click", async (e) => {
        const boton = e.currentTarget;
        if (!marcados().length) {
            alert("Primero tildá los locales a los que querés asignarle un supervisor.");
            return;
        }

        const usuarios = await getUsuarios();
        const supervisores = usuarios.filter((u) => u.rol === "supervisor");
        const modalId = "modal-lote-supervisor";
        const cuantos = marcados().length;

        const contenidoHtml = `
            <p class="text-sm text-muted" style="margin-bottom:12px">
                Se va a aplicar a ${cuantos} ${cuantos === 1 ? "local" : "locales"}.
            </p>
            <label for="input-lote-supervisor">Supervisor</label>
            <select id="input-lote-supervisor">
                <option value="">Sin asignar</option>
                ${supervisores.map((s) => `<option value="${escaparHtml(s.nombre)}">${escaparHtml(s.nombre)}</option>`).join("")}
            </select>
            <!-- "Sin asignar" es una opción real y no un placeholder: sacarle
                 los locales a un supervisor que se va es tan necesario como
                 dárselos a uno que entra, y de a uno sería el mismo trabajo
                 que esto viene a evitar. -->
            <p class="text-xs text-muted" style="margin-top:6px">
                Elegí "Sin asignar" para quitarles el supervisor que tengan.
            </p>
        `;

        abrirModal(
            Modal({ id: modalId, titulo: "Asignar supervisor", contenidoHtml, textoConfirmar: "Aplicar" }),
            modalId,
            async () => {
                const supervisor = document.getElementById("input-lote-supervisor").value;
                cerrarModal(modalId);
                await aplicarEnLote(
                    supervisor ? `Asignar a ${supervisor}` : "Quitar el supervisor",
                    { supervisor },
                    boton,
                );
            },
        );
    });

    document.querySelectorAll("[data-desactivar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.desactivar, { estado: "Inactiva" });
            registrarEvento(getUsuarioActual().id, "desactivar_local", `Local desactivado (id ${btn.dataset.desactivar})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-activar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.activar, { estado: "Activa" });
            registrarEvento(getUsuarioActual().id, "activar_local", `Local activado (id ${btn.dataset.activar})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-marcar-propio]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.marcarPropio, { esPropio: "SI" });
            registrarEvento(getUsuarioActual().id, "editar_local", `Local marcado como propio (id ${btn.dataset.marcarPropio})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-marcar-franquicia]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            await actualizarSucursal(btn.dataset.marcarFranquicia, { esPropio: "NO" });
            registrarEvento(getUsuarioActual().id, "editar_local", `Local marcado como franquicia (id ${btn.dataset.marcarFranquicia})`);
            navigate("locales");
        });
    });

    // Eliminar es irreversible y el nombre del local es la ÚNICA
    // manera en que Usuarios.sucursal apunta acá — no hay id de por
    // medio. Si se borra con gente todavía asignada, esas personas
    // quedan con una sucursal que ya no existe, en silencio: no
    // rompen, pero "Mi local" les muestra un nombre fantasma y ya no
    // matchean contra ninguna restricción por local. Por eso el
    // bloqueo de acá es real, no un simple confirm — hay que reasignar
    // a esa gente primero.
    document.querySelectorAll("[data-eliminar-local]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.eliminarLocal;
            const [locales, usuarios] = await Promise.all([getSucursales(), getUsuarios()]);
            const local = locales.find((l) => String(l.id) === String(id));
            if (!local) return;

            const gente = usuarios.filter((u) => u.rol === "colaborador" && u.sucursal === local.nombre);
            if (gente.length) {
                const nombres = gente.slice(0, 5).map((u) => u.nombre).join(", ") + (gente.length > 5 ? "…" : "");
                alert(`No se puede eliminar "${local.nombre}": todavía tiene ${gente.length} colaborador(es) asignado(s) (${nombres}). Reasignalos a otro local desde Colaboradores y volvé a intentar — el nombre del local es lo único que los vincula, y si se borra quedan con una sucursal fantasma, sin avisar.`);
                return;
            }

            if (!confirm(`¿Eliminar "${local.nombre}" definitivamente? No se puede deshacer.

No tiene colaboradores asignados. Si algún Manual o News quedó dirigido puntualmente a este local, esa restricción deja de encontrar a nadie — no rompe nada, pero convendría revisarlos después.`)) return;

            await eliminarSucursal(id);
            registrarEvento(getUsuarioActual().id, "eliminar_local", `Local eliminado: ${local.nombre} (id ${id})`);
            navigate("locales");
        });
    });

    document.querySelectorAll("[data-modulos]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const locales = await getSucursales();
            const local = locales.find((l) => String(l.id) === String(btn.dataset.modulos));
            if (local) abrirModalContenido([local.nombre], local.nombre);
        });
    });

    document.querySelectorAll("[data-editar]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const locales = await getSucursales();
            const local = locales.find((l) => String(l.id) === String(btn.dataset.editar));
            if (local) abrirModalEditarLocal(local);
        });
    });

    const btnNuevo = document.getElementById("btn-nuevo-local");
    if (btnNuevo) btnNuevo.addEventListener("click", abrirModalNuevoLocal);
}

/**
 * "Módulos" — qué cursos tiene este local.
 *
 * Se administra desde el LOCAL porque así es como se piensa: "Devoto no
 * tiene cafetería" es una característica de Devoto, no de las 26
 * lecciones de Cafetería. Preguntarlo del otro lado obligaría a abrir el
 * curso y enumerar los 122 locales que sí lo tienen.
 *
 * Se GUARDA en el curso igual (campo noAplicaA), y no en la sucursal,
 * para que decidir "¿este curso le toca?" no necesite cargar la lista de
 * sucursales: esa pregunta se hace desde una docena de pantallas y
 * varias de ellas no son asíncronas.
 */
/**
 * "Contenido" — qué módulos, lecciones y productos tiene un conjunto de
 * locales.
 *
 * Un solo lugar para las tres cosas. Antes estaban repartidas: los
 * módulos acá, el alcance de curso/lección en Academia, y el catálogo en
 * otro modal de Academia, cada una con una interacción distinta. La
 * pregunta es siempre la misma —"¿esto lo tiene?"— así que el gesto
 * también: tildado lo tiene, destildado no.
 *
 * El alcance sale de la pantalla: las pills de país y los checkboxes de
 * la tabla ya son el selector. No hace falta otro adentro del modal.
 *
 * Sólo se guardan EXCEPCIONES: si a un país no le falta nada, no queda
 * ni una fila. Argentina no se toca por tener 100 locales; se nombran
 * Devoto y Rivadavia dentro de Cafetería, y listo.
 */
async function abrirModalContenido(ambitos, etiquetaAmbito) {

    if (!ambitos.length) return;

    // El Supervisor entra a VERIFICAR que un local esté bien
    // configurado, no a cambiarlo: acá un destildado por error le saca
    // un módulo entero a toda la gente de ese local y no salta ningún
    // aviso — se enteran cuando alguien reclama que no ve algo.
    const soloLectura = getUsuarioActual()?.rol !== "admin";

    const [cursos, lecciones, disponibilidad] = await Promise.all([
        getCursos(), getLecciones(), getDisponibilidad(),
    ]);
    const modalId = "modal-contenido";

    // Un ítem está EXCLUIDO de un ámbito si su noAplicaA lo nombra. Con
    // varios ámbitos hay tres estados posibles, no dos: todos lo tienen,
    // ninguno lo tiene, o mezclado. Mostrar "mezclado" como tildado
    // sería mentir sobre lo que pasa en la mitad de los locales.
    const estado = (noAplicaA) => {
        const lista = String(noAplicaA || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
        const excluidos = ambitos.filter((a) => lista.includes(a.toLowerCase())).length;
        if (excluidos === 0) return "si";
        if (excluidos === ambitos.length) return "no";
        return "mezcla";
    };
    const attrs = (est) => (est === "si" ? "checked" : est === "mezcla" ? "data-mezcla" : "")
        + (soloLectura ? " disabled" : "");

    const productosDe = (nombreCurso) => (CATALOGO_POR_CURSO[nombreCurso] || [[]])[0];
    const alcances = (nombreCurso) => mapaDisponibilidad(disponibilidad, nombreCurso);

    const bloques = cursos.map((curso) => {
        const misLecciones = lecciones.filter((l) => String(l.cursoId) === String(curso.id));
        const misProductos = productosDe(curso.nombre);
        const alc = alcances(curso.nombre);

        const subLecciones = misLecciones.length ? `
            <div class="arbol-rama">
                <label class="arbol-sub">
                    <input type="checkbox" data-rama="lecciones-${curso.id}" ${soloLectura ? "disabled" : ""}>
                    <span class="arbol-sub-nombre">Lecciones</span>
                    <span class="arbol-meta">${misLecciones.length}</span>
                    <button type="button" class="arbol-toggle" data-abrir="lecciones-${curso.id}">Ver</button>
                </label>
                <div class="arbol-hijos" id="lecciones-${curso.id}" hidden>
                    ${misLecciones.map((l) => `
                        <label class="arbol-hoja">
                            <input type="checkbox" data-tipo="leccion" data-id="${l.id}"
                                   data-rama-de="lecciones-${curso.id}" ${attrs(estado(l.noAplicaA))}>
                            <span>${escaparHtml(l.titulo)}</span>
                        </label>`).join("")}
                </div>
            </div>` : "";

        const subCatalogo = misProductos.length ? `
            <div class="arbol-rama">
                <label class="arbol-sub">
                    <input type="checkbox" data-rama="catalogo-${curso.id}" ${soloLectura ? "disabled" : ""}>
                    <span class="arbol-sub-nombre">Catálogo</span>
                    <span class="arbol-meta">${misProductos.length}</span>
                    <button type="button" class="arbol-toggle" data-abrir="catalogo-${curso.id}">Ver</button>
                </label>
                <div class="arbol-hijos" id="catalogo-${curso.id}" hidden>
                    ${misProductos.map((prod) => `
                        <label class="arbol-hoja">
                            <input type="checkbox" data-tipo="producto" data-curso="${escaparHtml(curso.nombre)}"
                                   data-id="${escaparHtml(prod.nombre)}" data-rama-de="catalogo-${curso.id}"
                                   ${attrs(estado((alc.get(prod.nombre) || {}).noAplicaA))}>
                            ${prod.foto ? `<img class="arbol-foto" src="${escaparHtml(prod.foto)}" alt="" loading="lazy">` : ""}
                            <span>${escaparHtml(prod.nombre)}</span>
                        </label>`).join("")}
                </div>
            </div>` : "";

        return `
            <div class="arbol-modulo">
                <label class="arbol-raiz">
                    <input type="checkbox" data-tipo="curso" data-id="${curso.id}" ${attrs(estado(curso.noAplicaA))}>
                    <span class="arbol-raiz-nombre">${escaparHtml(curso.nombre)}</span>
                    <span class="arbol-meta">${escaparHtml(curso.categoria)}</span>
                </label>
                ${subCatalogo}
                ${subLecciones}
            </div>`;
    }).join("");

    const contenidoHtml = `
        <p class="text-sm text-muted" style="margin-bottom:14px">
            ${soloLectura
                ? `Esto es lo que ve <strong>${escaparHtml(etiquetaAmbito)}</strong>. Lo tachado no le aparece. Para cambiarlo, pedíselo a un administrador.`
                : `Destildá lo que <strong>${escaparHtml(etiquetaAmbito)}</strong>
                   ${ambitos.length === 1 ? "no tiene" : "no tienen"}. Lo que no toques queda como está.`}
        </p>
        <input type="search" id="buscador-arbol" placeholder="Buscar módulo, lección o producto...">
        <div id="arbol-contenido" style="margin-top:14px">${bloques}</div>
    `;

    abrirModal(
        Modal({ id: modalId, titulo: `Contenido — ${etiquetaAmbito}`, contenidoHtml, textoConfirmar: soloLectura ? "" : "Guardar" }),
        modalId,
        soloLectura ? undefined :
        async () => {
            const boton = document.querySelector(`[data-confirm="${modalId}"]`);
            const chks = [...document.querySelectorAll("#arbol-contenido [data-tipo]")];

            // Sólo lo que cambió. Un tilde que sigue en "mezcla" no se
            // tocó: aplicar mezcla a todos borraría diferencias que el
            // usuario no pidió cambiar.
            const cambios = chks.filter((chk) => {
                if (chk.dataset.mezcla !== undefined && chk.indeterminate) return false;
                return chk.checked !== (chk.defaultChecked && chk.dataset.mezcla === undefined);
            });

            if (!cambios.length) { cerrarModal(modalId); return; }

            boton.disabled = true;
            for (let i = 0; i < cambios.length; i++) {
                const chk = cambios[i];
                boton.textContent = `Guardando ${i + 1}/${cambios.length}...`;

                if (chk.dataset.tipo === "curso") {
                    const curso = cursos.find((c) => String(c.id) === chk.dataset.id);
                    await actualizarCurso(curso.id, { noAplicaA: conAmbitos(curso.noAplicaA, ambitos, chk.checked) });
                } else if (chk.dataset.tipo === "leccion") {
                    const lec = lecciones.find((l) => String(l.id) === chk.dataset.id);
                    await actualizarLeccion(lec.id, { noAplicaA: conAmbitos(lec.noAplicaA, ambitos, chk.checked) });
                } else {
                    const actual = alcances(chk.dataset.curso).get(chk.dataset.id) || {};
                    await guardarDisponibilidad(chk.dataset.curso, chk.dataset.id,
                        { noAplicaA: conAmbitos(actual.noAplicaA, ambitos, chk.checked) }, disponibilidad);
                }
            }

            registrarEvento(getUsuarioActual().id, "editar_local",
                `Contenido de ${etiquetaAmbito}: ${cambios.length} cambio(s)`);
            cerrarModal(modalId);
            navigate("locales");
        },
    );

    // Los "mezcla" arrancan indeterminados: ni tildado ni destildado.
    document.querySelectorAll("#arbol-contenido [data-mezcla]").forEach((chk) => { chk.indeterminate = true; });

    document.getElementById("arbol-contenido").addEventListener("click", (e) => {
        const toggle = e.target.closest("[data-abrir]");
        if (!toggle) return;
        e.preventDefault();
        const caja = document.getElementById(toggle.dataset.abrir);
        caja.hidden = !caja.hidden;
        toggle.textContent = caja.hidden ? "Ver" : "Ocultar";
    });

    document.getElementById("arbol-contenido").addEventListener("change", (e) => {
        // Tocar una rama ("Catálogo", "Lecciones") arrastra a sus hijos.
        if (e.target.dataset.rama) {
            document.querySelectorAll(`[data-rama-de="${e.target.dataset.rama}"]`).forEach((chk) => {
                chk.indeterminate = false;
                chk.checked = e.target.checked;
            });
        }
        if (e.target.dataset.mezcla !== undefined) e.target.indeterminate = false;
    });

    document.getElementById("buscador-arbol").addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#arbol-contenido .arbol-hijos").forEach((c) => { c.hidden = !q; });
        document.querySelectorAll("#arbol-contenido .arbol-hoja").forEach((hoja) => {
            hoja.style.display = !q || hoja.textContent.toLowerCase().includes(q) ? "" : "none";
        });
        document.querySelectorAll("#arbol-contenido .arbol-modulo").forEach((mod) => {
            const raiz = mod.querySelector(".arbol-raiz-nombre").textContent.toLowerCase();
            const hay = !q || raiz.includes(q)
                || [...mod.querySelectorAll(".arbol-hoja")].some((h) => h.style.display !== "none");
            mod.style.display = hay ? "" : "none";
        });
    });
}

/** Agrega o saca varios ámbitos de una lista separada por comas. */
function conAmbitos(actual, ambitos, loTiene) {
    const lista = String(actual || "").split(",").map((s) => s.trim()).filter(Boolean);
    const bajos = ambitos.map((a) => a.toLowerCase());
    const sinEstos = lista.filter((s) => !bajos.includes(s.toLowerCase()));
    return (loTiene ? sinEstos : [...sinEstos, ...ambitos]).join(", ");
}

async function abrirModalNuevoLocal() {

    const usuarios = await getUsuarios();
    const supervisores = usuarios.filter((u) => u.rol === "supervisor");

    const modalId = "modal-nuevo-local";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del local</label>
        <div class="campo-con-prefijo">
            <span class="campo-prefijo">${PREFIJO_LOCAL.trim()}</span>
            <input type="text" id="input-nombre" placeholder="Agüero CABA">
        </div>
        <p class="text-xs text-muted" style="margin-top:4px">
            Escribí sólo el resto. Terminá con la provincia o el país (CABA, GBA, Uruguay…): de ahí sale el país del local.
        </p>

        <label for="input-supervisor">Supervisor</label>
        <select id="input-supervisor">
            <option value="">Sin asignar</option>
            ${supervisores.map((s) => `<option value="${s.nombre}">${s.nombre}</option>`).join("")}
        </select>

        <!-- Mismo componente .radio-card que ya usa News para elegir
             destinatario: los radios nativos sueltos que había acá se
             veían con el azul del sistema y desalineados entre sí. -->
        <label style="margin-top:16px;display:block;margin-bottom:8px">Tipo de local</label>
        <div class="radio-cards" style="margin-bottom:16px">
            <label class="radio-card">
                <input type="radio" name="tipo-local" value="propio" id="input-propio">
                <span class="radio-card-radio"></span>
                <span class="radio-card-titulo">Propio</span>
                <span class="radio-card-desc">Operado por Lucciano's</span>
            </label>
            <label class="radio-card">
                <input type="radio" name="tipo-local" value="franquicia" id="input-franquicia" checked>
                <span class="radio-card-radio"></span>
                <span class="radio-card-titulo">Franquicia</span>
                <span class="radio-card-desc">Operado por un tercero</span>
            </label>
        </div>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Nuevo local", contenidoHtml, textoConfirmar: "Crear" }), modalId, async () => {

        const resto = sinPrefijo(document.getElementById("input-nombre").value);
        const nombre = resto ? PREFIJO_LOCAL + resto : "";
        const supervisor = document.getElementById("input-supervisor").value;
        const esPropio = document.getElementById("input-propio").checked;

        if (!nombre) {
            alert("El nombre es requerido.");
            return;
        }

        await crearSucursal({ nombre, supervisor, estado: "Activa", esPropio });
        registrarEvento(getUsuarioActual().id, "crear_local", `Alta de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}

async function abrirModalEditarLocal(local) {

    const usuarios = await getUsuarios();
    const supervisores = usuarios.filter((u) => u.rol === "supervisor");

    const modalId = "modal-editar-local";

    const contenidoHtml = `
        <label for="input-nombre">Nombre del local</label>
        <div class="campo-con-prefijo">
            <span class="campo-prefijo">${PREFIJO_LOCAL.trim()}</span>
            <input type="text" id="input-nombre" placeholder="Agüero CABA" value="${escaparHtml(sinPrefijo(local.nombre))}">
        </div>
        <p class="text-xs text-muted" style="margin-top:4px">
            Escribí sólo el resto. Terminá con la provincia o el país (CABA, GBA, Uruguay…): de ahí sale el país del local.
        </p>

        <label for="input-supervisor">Supervisor</label>
        <select id="input-supervisor">
            <option value="">Sin asignar</option>
            ${supervisores.map((s) => `<option value="${s.nombre}" ${local.supervisor === s.nombre ? "selected" : ""}>${s.nombre}</option>`).join("")}
        </select>
    `;

    abrirModal(Modal({ id: modalId, titulo: "Editar local: " + local.nombre, contenidoHtml, textoConfirmar: "Guardar" }), modalId, async () => {

        const resto = sinPrefijo(document.getElementById("input-nombre").value);
        const nombre = resto ? PREFIJO_LOCAL + resto : "";
        const supervisor = document.getElementById("input-supervisor").value;

        if (!nombre) {
            alert("El nombre es requerido.");
            return;
        }

        await actualizarSucursal(local.id, { nombre, supervisor });
        registrarEvento(getUsuarioActual().id, "editar_local", `Edición de local ${nombre}`);

        cerrarModal(modalId);
        navigate("locales");
    });
}
