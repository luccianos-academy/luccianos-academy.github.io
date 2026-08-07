/* ============================
   Lucciano's Academy
   data/canales.js — Tabla "Canales" (Comunicaciones)

   Antes eran una lista fija en el código; ahora es una hoja más, que
   Admin y Supervisor pueden crear/editar desde la propia app (ver
   pages/comunicaciones.js) — así un canal nuevo no depende de pedir
   un cambio de código. Eliminar queda solo para Admin (un canal con
   publicaciones reales adentro es más delicado de borrar que
   crearlo/renombrarlo).

   "restringidoA" acota quién ve el canal: "" (todos los que entran a
   Comunicaciones), "supervisor" (solo Supervisor sin capacitador, para
   temas de supervisión que no le interesan a Capacitación), "capacitador"
   (solo Supervisor con capacitador:true), o "admin" (nadie más que
   Admin — pensado para probar cosas, ej. push, sin exponerlas a
   usuarios reales). Admin siempre ve todos los canales igual, para
   poder moderar cualquiera — mismo criterio que ya usa
   puedeVerManual/puedeVerNoticia con "capacitador" como caso especial
   (no es un rol real, ver data/usuarios.js).

   Comunicaciones es exclusivamente Admin ↔ Supervisor — pedido
   explícito del usuario ("esa función es solo para supervisor y
   admin"). Colaborador/Encargado NUNCA participa acá (el targeting
   por Encargado propio/franquicia vive en News — ver data/noticias.js
   — no acá; esta hoja tuvo un pase con un modo "sucursal"/"encargados-
   propios/franquicias" que se revirtió por estar mal ubicado).
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { canalesMock } from "./mock/canales.mock.js";
import { HOJAS } from "../config.js";

// Set acotado para el selector de ícono al crear/editar un canal —
// mismos íconos ya usados por los canales de ejemplo, no hace falta
// más variedad por ahora (se puede sumar sin migrar nada).
export const ICONOS_CANAL = [
    { id: "noticias", nombre: "Anuncio" },
    { id: "configuracion", nombre: "Supervisión" },
    { id: "warning", nombre: "Alerta" },
    { id: "idea", nombre: "Idea" },
    { id: "comentario", nombre: "Comentario" },
    { id: "corazon", nombre: "Corazón" },
    { id: "helado", nombre: "Helado" },
    { id: "cafe", nombre: "Café" },
    { id: "chocolate", nombre: "Chocolate" },
    { id: "pastel", nombre: "Pastelería" },
    { id: "icepop", nombre: "Icepop" },
    { id: "caja", nombre: "Caja" },
    { id: "usuarios", nombre: "Equipo" },
    { id: "academia", nombre: "Academia" },
];

export const VISIBILIDAD_CANAL = [
    { id: "", nombre: "Supervisores y Capacitadores" },
    { id: "supervisor", nombre: "Solo Supervisores" },
    { id: "capacitador", nombre: "Solo Capacitadores" },
    { id: "admin", nombre: "Solo Admin (pruebas)" },
];

function normalizarCanal(f) {
    return {
        id: f.id,
        nombre: String(f.nombre || "").trim(),
        icono: ICONOS_CANAL.some((i) => i.id === f.icono) ? f.icono : "comentario",
        creadoPor: String(f.creadoPor || "").trim(),
        restringidoA: String(f.restringidoA || "").trim(),
    };
}

export function puedeVerCanal(canal, usuario) {
    if (usuario.rol === "admin") return true;
    const restriccion = String(canal.restringidoA || "").trim();
    if (!restriccion) return true;
    if (restriccion === "admin") return false;
    if (restriccion === "capacitador") return usuario.rol === "supervisor" && !!usuario.capacitador;
    if (restriccion === "supervisor") return usuario.rol === "supervisor" && !usuario.capacitador;
    // Cualquier valor de restringidoA que no sea uno de los de arriba
    // (ej. "sucursal"/"encargados-propios" de un modo viejo ya
    // revertido, ver comentario de cabecera) NO debe filtrar a "todos
    // lo ven" — eso fue justo el bug reportado en producción: un canal
    // pensado para un grupo acotado quedaba visible para cualquiera
    // apenas su restricción no calzaba con ninguno de los casos
    // conocidos. Por defecto, oculto — solo se muestra ante un match
    // explícito.
    return false;
}

export async function getCanales() {
    try {
        const filas = await fetchSheet(HOJAS.CANALES, canalesMock);
        return filas.map(normalizarCanal).sort((a, b) => a.nombre.localeCompare(b.nombre));
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.CANALES}':`, err.message);
        return [];
    }
}

/** Canales que un usuario puede VER — Admin ve todos (gestión); el
 *  resto queda filtrado por puedeVerCanal. */
export async function getCanalesVisibles(usuario) {
    const todos = await getCanales();
    if (usuario.rol === "admin") return todos;
    return todos.filter((c) => puedeVerCanal(c, usuario));
}

export async function canalInfo(canalId) {
    const canales = await getCanales();
    return canales.find((c) => String(c.id) === String(canalId)) || canales[0] || { id: "", nombre: "Sin canal", icono: "comentario", restringidoA: "" };
}

export async function crearCanal({ nombre, icono, creadoPor, restringidoA }) {
    return writeSheet(HOJAS.CANALES, { nombre, icono: icono || "comentario", creadoPor: creadoPor || "", restringidoA: restringidoA || "" }, canalesMock);
}

export async function actualizarCanal(id, cambios) {
    return updateSheet(HOJAS.CANALES, id, cambios, canalesMock);
}

export async function eliminarCanal(id) {
    return deleteSheet(HOJAS.CANALES, id, canalesMock);
}
