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
        visiblePara: String(f.visiblePara || "").trim(),
        sucursal: String(f.sucursal || "").trim(),
        leidoPor: String(f.leidoPor || "").trim(),
    };
}

/** Mismo criterio que puedeVerManual (data/manuales.js), con una
 *  diferencia a propósito: acá vacío = visible para todos. */
export function puedeVerNoticia(noticia, usuario) {
    const visiblePara = String(noticia.visiblePara || "").trim();
    const sucursalNoticia = String(noticia.sucursal || "").trim();

    if (!visiblePara && !sucursalNoticia) return true;

    if (sucursalNoticia) {
        const locales = sucursalNoticia.split(",").map((s) => s.trim()).filter(Boolean);
        if (usuario.rol === "admin" || usuario.rol === "supervisor") return true;
        if (usuario.rol === "colaborador" && locales.includes(usuario.sucursal)) return true;
        return false;
    }

    const roles = visiblePara.split(",").map((r) => r.trim()).filter(Boolean);
    const paraCapacitador = roles.includes("capacitador") && usuario.rol === "supervisor" && usuario.capacitador;
    return roles.includes(usuario.rol) || paraCapacitador;
}

export function estaLeida(noticia, usuarioId) {
    return String(noticia.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean).includes(String(usuarioId));
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
    return todas.filter((n) => puedeVerNoticia(n, usuario));
}

export async function crearNoticia({ titulo, fecha, resumen, detalle, enlace, adjuntoUrl, adjuntoLabel, tipo, prioridad, visiblePara, sucursal }) {
    return writeSheet(HOJAS.NOTICIAS, {
        titulo, fecha, resumen,
        detalle: detalle || "", enlace: enlace || "",
        adjuntoUrl: adjuntoUrl || "", adjuntoLabel: adjuntoLabel || "",
        tipo: tipo || "noticia", prioridad: prioridad || "info",
        visiblePara: visiblePara || "", sucursal: sucursal || "",
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
