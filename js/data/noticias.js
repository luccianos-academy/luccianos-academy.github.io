/* ============================
   FARO v4
   data/noticias.js — Tabla "Noticias" (centro de notificaciones)

   Base del centro de notificaciones (campana, ver components/topbar.js
   y pages/notificaciones.js) — antes era una lista plana sin
   destinatarios ni estado de lectura, ahora suma:

   - "tipo": categoría (ver TIPOS_NOTIFICACION) — define ícono/color en
     la lista.
   - "prioridad": ver PRIORIDADES — define el color del punto/borde.
   - "visiblePara"/"sucursal": MISMO patrón que data/manuales.js (rol y/o
     local destinatario), con una diferencia a propósito: acá vacío =
     visible para TODOS (broadcast), no "inactivo" — así las noticias
     viejas (creadas antes de que existiera este campo) se siguen
     viendo igual que siempre, sin tener que migrarlas a mano.
   - "leidoPor": lista de ids de usuario separada por comas, en la
     misma fila (sin tabla nueva) — a esta escala (~20-30 usuarios,
     decenas de notificaciones) una celda de texto alcanza de sobra.
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { noticiasMock } from "./mock/noticias.mock.js";
import { HOJAS } from "../config.js";
import { getSucursales } from "./sucursales.js";

// A quién apunta una noticia (campo "dirigidoA"). News es solo para
// colaboradores — Supervisión y Admin SIEMPRE reciben copia y ven
// todo (pedido explícito del usuario: "supervisión debe estar al
// tanto de todo para no perderse nada", Comunicaciones ya cubre
// operaciones entre supervisores). Por eso no hay opción de dirigir
// a supervisor/capacitador/admin como público objetivo.
//   ""                     → todos los colaboradores de la red
//   "encargados-propios"   → encargados de locales propios (dinámico, Sucursales.esPropio)
//   "encargados-franquicias" → encargados de franquicias (por descarte)
//   "colaboradores-local"  → colaboradores de los locales elegidos (campo "sucursal")
export const DIRIGIDO_A = [
    { id: "", nombre: "Todos los colaboradores" },
    { id: "encargados-propios", nombre: "Encargados — Locales propios" },
    { id: "encargados-franquicias", nombre: "Encargados — Franquicias" },
    { id: "colaboradores-local", nombre: "Locales específicos" },
];

export const TIPOS_NOTIFICACION = [
    { id: "noticia", nombre: "Noticia", icono: "noticias" },
    { id: "curso", nombre: "Nuevo curso", icono: "academia" },
    { id: "manual", nombre: "Manual", icono: "reportes" },
    { id: "evaluacion", nombre: "Evaluación", icono: "evaluaciones" },
    { id: "recordatorio", nombre: "Recordatorio", icono: "alertas" },
    { id: "cuenta", nombre: "Cuenta", icono: "perfil" },
];

export const PRIORIDADES = [
    { id: "urgente", nombre: "Urgente", color: "var(--danger)" },
    { id: "importante", nombre: "Importante", color: "var(--warning)" },
    { id: "info", nombre: "Información", color: "var(--gold)" },
    { id: "baja", nombre: "Baja", color: "var(--muted)" },
];

function normalizarNoticia(f) {
    return {
        id: f.id,
        titulo: String(f.titulo || "").trim(),
        fecha: String(f.fecha || "").trim().slice(0, 10),
        resumen: String(f.resumen || "").trim(),
        // Todos opcionales — se completan solo si la noticia lo amerita
        // (ver pages/noticias.js): "detalle" es texto largo que se
        // muestra plegado, "enlace" es el id de un Curso para el botón
        // "Ir al curso", "adjuntoUrl" es un archivo (PDF, etc.) para el
        // botón "Ver adjunto" — ruta local (assets/docs/...) o link
        // externo, igual criterio que las fotos de Chocolatería. Si
        // están vacíos, la tarjeta se ve como antes.
        detalle: String(f.detalle || "").trim(),
        enlace: String(f.enlace || "").trim(),
        adjuntoUrl: String(f.adjuntoUrl || "").trim(),
        adjuntoLabel: String(f.adjuntoLabel || "").trim(),
        tipo: String(f.tipo || "noticia").trim() || "noticia",
        prioridad: String(f.prioridad || "info").trim() || "info",
        // A quién apunta (ver DIRIGIDO_A). Vacío = todos los
        // colaboradores. Reemplaza al viejo "visiblePara" (por rol) —
        // las filas viejas con visiblePara se leen igual acá (fallback)
        // para no romper noticias ya creadas.
        dirigidoA: String(f.dirigidoA || "").trim(),
        // Solo se usa cuando dirigidoA === "colaboradores-local":
        // lista de locales separada por comas (mismo componente que
        // Manuales). Compat: filas viejas guardaban esto en "sucursal".
        sucursal: String(f.sucursal || "").trim(),
        // Compat con noticias viejas que dirigían por rol antes de esta
        // reestructuración — solo se lee, ya no se escribe.
        visiblePara: String(f.visiblePara || "").trim(),
        leidoPor: String(f.leidoPor || "").trim(),
    };
}

/** Quién ve una noticia. News es SOLO para colaboradores como público
 *  objetivo — Admin y Supervisor (incluido Capacitador) SIEMPRE la ven
 *  (copia automática, "supervisión al tanto de todo"). El resto se
 *  resuelve según dirigidoA. `sucursales` (opcional) solo hace falta
 *  para los modos propios/franquicias (miran Sucursales.esPropio); si
 *  no se pasa, esos modos no matchean a nadie (criterio conservador). */
export function puedeVerNoticia(noticia, usuario, sucursales = []) {
    if (usuario.rol === "admin" || usuario.rol === "supervisor") return true;

    // De acá en adelante, usuario es colaborador (encargado o no).
    const dirigidoA = String(noticia.dirigidoA || "").trim();

    // Compat: noticias viejas sin dirigidoA pero con visiblePara/sucursal
    // por el modelo anterior — se respetan como estaban.
    if (!dirigidoA) {
        const visiblePara = String(noticia.visiblePara || "").trim();
        const sucursalVieja = String(noticia.sucursal || "").trim();
        if (visiblePara || sucursalVieja) {
            if (sucursalVieja) {
                const locales = sucursalVieja.split(",").map((s) => s.trim()).filter(Boolean);
                return locales.includes(usuario.sucursal);
            }
            const roles = visiblePara.split(",").map((r) => r.trim()).filter(Boolean);
            const paraEncargado = roles.includes("encargado") && usuario.encargado;
            return roles.includes("colaborador") || paraEncargado;
        }
        return true; // sin nada = todos los colaboradores
    }

    if (dirigidoA === "colaboradores-local") {
        const locales = String(noticia.sucursal || "").split(",").map((s) => s.trim()).filter(Boolean);
        return locales.includes(usuario.sucursal);
    }

    if (dirigidoA === "encargados-propios" || dirigidoA === "encargados-franquicias") {
        if (!usuario.encargado) return false;
        const sucursal = sucursales.find((s) => s.nombre === usuario.sucursal);
        const esPropio = !!(sucursal && sucursal.esPropio);
        return dirigidoA === "encargados-propios" ? esPropio : !esPropio;
    }

    return true; // dirigidoA === "" → todos los colaboradores
}

export function estaLeida(noticia, usuarioId) {
    return String(noticia.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean).includes(String(usuarioId));
}

/** Una noticia con fecha futura está PROGRAMADA — todavía no se
 *  publicó. Los destinatarios (colaboradores/supervisión) no la ven
 *  hasta ese día; solo Admin la ve antes (para gestionarla). Pedido
 *  del usuario: "armo hoy porque ya tengo la info, le pongo fecha a
 *  futuro y ese día se envía". OJO: esto es la parte CLIENTE (se
 *  muestra sola al llegar la fecha, cada vez que se abre la app). El
 *  push automático en la fecha + el recordatorio a Supervisión
 *  necesitan un disparador de tiempo en el backend (Apps Script
 *  time-driven trigger) — no está hecho todavía, ver nota en news.js. */
export function estaProgramada(noticia) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [y, m, d] = String(noticia.fecha || "").split("-").map(Number);
    if (!y || !m || !d) return false;
    return new Date(y, m - 1, d) > hoy;
}

export async function getNoticias() {
    try {
        const filas = await fetchSheet(HOJAS.NOTICIAS, noticiasMock);
        return filas.map(normalizarNoticia).sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.NOTICIAS}':`, err.message);
        return [];
    }
}

/** Noticias visibles para un usuario puntual — para la campana y el
 *  centro de notificaciones. Admin ve todas (para poder gestionarlas). */
export async function getNoticiasVisibles(usuario) {
    const todas = await getNoticias();
    if (usuario.rol === "admin") return todas;
    // sucursales solo hace falta para los modos propios/franquicias
    // (miran esPropio); se prefetchea una vez y se pasa a cada chequeo.
    const sucursales = await getSucursales();
    // Las programadas (fecha futura) todavía no se muestran a los
    // destinatarios — recién aparecen el día que les toca.
    return todas.filter((n) => !estaProgramada(n) && puedeVerNoticia(n, usuario, sucursales));
}

export async function crearNoticia({ titulo, fecha, resumen, detalle, enlace, adjuntoUrl, adjuntoLabel, tipo, prioridad, dirigidoA, sucursal }) {
    return writeSheet(HOJAS.NOTICIAS, {
        titulo, fecha, resumen,
        detalle: detalle || "", enlace: enlace || "",
        adjuntoUrl: adjuntoUrl || "", adjuntoLabel: adjuntoLabel || "",
        tipo: tipo || "noticia", prioridad: prioridad || "info",
        dirigidoA: dirigidoA || "", sucursal: sucursal || "",
        leidoPor: "",
    }, noticiasMock);
}

export async function actualizarNoticia(id, cambios) {
    return updateSheet(HOJAS.NOTICIAS, id, cambios, noticiasMock);
}

/** Agrega el id del usuario a "leidoPor" si todavía no estaba. */
export async function marcarNotificacionLeida(noticia, usuarioId) {
    if (estaLeida(noticia, usuarioId)) return;
    const actuales = String(noticia.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);
    actuales.push(String(usuarioId));
    await actualizarNoticia(noticia.id, { leidoPor: actuales.join(",") });
}

export async function eliminarNoticia(id) {
    return deleteSheet(HOJAS.NOTICIAS, id, noticiasMock);
}
