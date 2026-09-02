/* ============================
   Lucciano's Academy
   pages/movimientos.js — "Movimientos de gestión" completo, por día

   Vista expandida de la tarjeta "Movimientos de gestión" del Inicio
   (Admin/Supervisor), que solo muestra los últimos 10 — acá se ve
   TODO, agrupado por día. Pedido explícito: "apretar un botón y ver
   todas las novedades por día, así no tengo que usar el excel" — esto
   reemplaza el reporte manual que se armaba aparte para lo mismo.

   Se actualiza sola cada 20s mientras se esté en esta pantalla (mismo
   criterio ya probado en Gestión de tareas, gestion.js) — sin esto,
   había que salir y volver a entrar para ver un movimiento nuevo.

   Filtros (pedido explícito, los 3 juntos): buscar por nombre, por
   tipo de evento y por rango de fechas. El estado de los filtros vive
   en variables de módulo para que el auto-refresco de arriba los
   respete (si no, cada 20s se perdería lo que la persona eligió).
=============================*/

import { Header } from "../components/header.js";
import { ActivityFeed } from "../components/activityFeed.js";
import { getUsuarios } from "../data/usuarios.js";
import { getAuditoria, detalleConNombres } from "../data/auditoria.js";
import { getLocalesVisibles } from "../data/sucursales.js";
import { getLocalesElegidos } from "../services/preferenciasLocales.js";
import { getUsuarioActual } from "../services/auth.js";
import { mismoId } from "../services/ids.js";

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** accion (columna cruda de Auditoria, ver registrarEvento en todo el
 *  resto de la app) → categoría legible para el filtro de pills. Lo
 *  que no está listado acá (debería ser raro) cae en "otros", no se
 *  pierde. */
const CATEGORIA_POR_ACCION = {
    login: "sesion",
    registrar_colaborador: "usuarios", registrar_usuario: "usuarios", editar_usuario: "usuarios",
    eliminar_usuario: "usuarios", eliminar_usuario_lote: "usuarios", activar_usuario: "usuarios",
    desactivar_usuario: "usuarios", deshabilitar_acceso: "usuarios", renovar_acceso: "usuarios",
    acceso_vencido: "usuarios", quitar_permanente: "usuarios", ver_como: "usuarios", editar_colaborador: "usuarios",
    avanzar_leccion: "progreso", rendir_examen: "progreso", violacion_examen: "progreso",
    crear_curso: "contenido", eliminar_curso: "contenido", crear_leccion: "contenido",
    editar_leccion: "contenido", eliminar_leccion: "contenido", crear_pregunta: "contenido",
    editar_pregunta: "contenido", eliminar_pregunta: "contenido",
    crear_local: "locales", editar_local: "locales", eliminar_local: "locales",
    activar_local: "locales", desactivar_local: "locales",
    crear_noticia: "comunicaciones", editar_noticia: "comunicaciones", eliminar_noticia: "comunicaciones",
    crear_canal: "comunicaciones", editar_canal: "comunicaciones", eliminar_canal: "comunicaciones",
    crear_publicacion: "comunicaciones", editar_publicacion: "comunicaciones", eliminar_publicacion: "comunicaciones",
    comentario_publicacion: "comunicaciones", enviar_mail: "comunicaciones",
    crear_manual: "manuales", editar_manual: "manuales", eliminar_manual: "manuales",
    crear_recurso: "manuales", editar_recurso: "manuales", eliminar_recurso: "manuales",
};

const CATEGORIAS = [
    { id: "todos", label: "Todos" },
    { id: "sesion", label: "Inicios de sesión" },
    { id: "usuarios", label: "Altas y bajas" },
    { id: "progreso", label: "Progreso y exámenes" },
    { id: "contenido", label: "Contenido" },
    { id: "locales", label: "Locales" },
    { id: "comunicaciones", label: "Comunicaciones" },
    { id: "manuales", label: "Manuales y recursos" },
];

function categoriaDe(accion) {
    return CATEGORIA_POR_ACCION[accion] || "otros";
}

function claveDia(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return "otros";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoy", "Ayer", o "lunes 1 de septiembre" — mismo criterio de
 *  lenguaje natural que el resto de la app (etiquetaCiclo en
 *  gestionCiclo.js). Fuera de esos dos casos, sin año: el filtro de
 *  "Movimientos de gestión" no llega a mostrar movimientos de hace
 *  más de un año en la práctica, y agregarlo sería ruido. */
function tituloDia(clave, hoyClave, ayerClave) {
    if (clave === hoyClave) return "Hoy";
    if (clave === ayerClave) return "Ayer";
    if (clave === "otros") return "Fecha desconocida";
    const [anio, mes, dia] = clave.split("-").map(Number);
    const d = new Date(anio, mes - 1, dia);
    return `${DIAS_ES[d.getDay()]} ${dia} de ${MESES_ES[mes - 1]}`;
}

/** Solo lo que necesita el auto-refresco: usuarios + auditoría, ya
 *  escopados al mismo criterio de "quién puede ver qué" que el resto
 *  de la app. Separado de Movimientos() para no repetir esa lógica de
 *  alcance en cada tick del intervalo. Cada fila sale ya con el texto
 *  legible y la categoría resueltos, para no recalcularlos en cada
 *  filtrado. */
async function actividadVisible() {
    const usuario = getUsuarioActual();
    const [usuarios, auditoriaCompleta] = await Promise.all([getUsuarios(), getAuditoria()]);

    let auditoria = auditoriaCompleta;
    if (usuario.rol === "supervisor") {
        let misLocales = await getLocalesVisibles(usuario);
        if (usuario.capacitador) {
            const elegidos = getLocalesElegidos(usuario);
            if (elegidos.length) misLocales = misLocales.filter((n) => elegidos.includes(n));
        }
        const equipoIds = usuarios.filter((u) => u.rol === "colaborador" && misLocales.includes(u.sucursal)).map((c) => String(c.id));
        auditoria = auditoriaCompleta.filter((a) => equipoIds.some((eid) => mismoId(eid, a.usuarioId)) || mismoId(a.usuarioId, usuario.id));
    }

    const entradas = auditoria.map((a) => ({
        fecha: a.fecha,
        categoria: categoriaDe(a.accion),
        texto: detalleConNombres(a.detalle, usuarios),
    }));

    return entradas;
}

// Estado de los filtros — vive acá, no en el DOM, para que el
// auto-refresco (que reemplaza el HTML de la lista cada 20s) los siga
// respetando en vez de resetearlos.
let filtroTexto = "";
let filtroCategoria = "todos";
let filtroDesde = "";
let filtroHasta = "";

function aplicarFiltros(entradas) {
    const texto = filtroTexto.trim().toLowerCase();
    return entradas.filter((e) => {
        if (texto && !e.texto.toLowerCase().includes(texto)) return false;
        if (filtroCategoria !== "todos" && e.categoria !== filtroCategoria) return false;
        if (filtroDesde && claveDia(e.fecha) < filtroDesde) return false;
        if (filtroHasta && claveDia(e.fecha) > filtroHasta) return false;
        return true;
    });
}

function listaHtml(entradas) {
    const filtradas = aplicarFiltros(entradas);

    if (!entradas.length) {
        return `<p class="text-muted text-sm">Todavía no hay movimientos registrados.</p>`;
    }
    if (!filtradas.length) {
        return `<p class="text-muted text-sm">Ningún movimiento coincide con el filtro elegido.</p>`;
    }

    const hoyClave = claveDia(new Date());
    const ayerClave = claveDia(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const grupos = new Map();
    filtradas.forEach((e) => {
        const clave = claveDia(e.fecha);
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(e);
    });

    return [...grupos.entries()].map(([clave, filas]) => `
        <div class="section">
            <h2>${tituloDia(clave, hoyClave, ayerClave)}</h2>
            ${ActivityFeed(filas, { soloHora: true })}
        </div>
    `).join("");
}

function filtrosHtml() {
    const pills = CATEGORIAS.map((c) => `<button class="pill-categoria${c.id === filtroCategoria ? " activa" : ""}" data-categoria="${c.id}">${c.label}</button>`).join("");
    return `
        <div class="galeria-pills" id="movimientos-pills" style="margin-bottom:14px">${pills}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
            <input type="search" id="input-buscar-movimientos" placeholder="Buscar por nombre..." value="${filtroTexto}" style="flex:1;min-width:200px;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">Desde
                <input type="date" id="input-desde-movimientos" value="${filtroDesde}" style="padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)">Hasta
                <input type="date" id="input-hasta-movimientos" value="${filtroHasta}" style="padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </label>
        </div>
    `;
}

let entradasActuales = [];

export async function Movimientos() {
    entradasActuales = await actividadVisible();

    return `
        ${Header("Movimientos de gestión", "Altas, bajas y cambios hechos desde la plataforma, agrupados por día. Se actualiza solo.")}
        ${filtrosHtml()}
        <div id="movimientos-lista">${listaHtml(entradasActuales)}</div>
    `;
}

function redibujarLista() {
    const contenedor = document.getElementById("movimientos-lista");
    if (contenedor) contenedor.innerHTML = listaHtml(entradasActuales);
}

let intervaloMovimientos = null;

export function bindMovimientos() {
    document.getElementById("movimientos-pills")?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-categoria]");
        if (!btn) return;
        filtroCategoria = btn.dataset.categoria;
        document.querySelectorAll("#movimientos-pills [data-categoria]").forEach((b) => b.classList.toggle("activa", b === btn));
        redibujarLista();
    });

    document.getElementById("input-buscar-movimientos")?.addEventListener("input", (e) => {
        filtroTexto = e.target.value;
        redibujarLista();
    });

    document.getElementById("input-desde-movimientos")?.addEventListener("change", (e) => {
        filtroDesde = e.target.value;
        redibujarLista();
    });

    document.getElementById("input-hasta-movimientos")?.addEventListener("change", (e) => {
        filtroHasta = e.target.value;
        redibujarLista();
    });

    // Mismo patrón que gestion.js: sin hook de "salir de la página" en
    // este router, el propio intervalo se autochequea contra un nodo
    // de esta pantalla y se corta solo si ya no está.
    if (intervaloMovimientos) clearInterval(intervaloMovimientos);
    intervaloMovimientos = setInterval(async () => {
        if (!document.getElementById("movimientos-lista")) {
            clearInterval(intervaloMovimientos);
            intervaloMovimientos = null;
            return;
        }
        const frescas = await actividadVisible();
        // Sigue existiendo tras el await? el chequeo de arriba pudo
        // pasar y de ahí a acá haberse navegado afuera.
        if (document.getElementById("movimientos-lista")) {
            entradasActuales = frescas;
            redibujarLista();
        }
    }, 20000);
}
