/* ============================
   FARO v4
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

   "sucursal" es el segundo modo de restricción, pensado para
   Encargados (no un rol propio, ver data/usuarios.js) — lista de
   locales separada por comas (mismo formato/componente que ya usa
   Manuales, ver components/multiSelectSucursales.js), sin importar
   si son propios o franquicia: el Encargado/a de CUALQUIERA de esos
   locales ve el canal, nadie más de rol colaborador. Pedido explícito
   del usuario: "un mensaje, una sola vez, llega a toda la red del
   canal" en vez de mandarlo local por local. Cuando "sucursal" tiene
   algo cargado, gana por sobre "restringidoA" (mismo criterio "el
   local gana" que ya usa Manuales) — son modos alternativos, no se
   combinan.

   "restringidoA" también acepta "encargados-propios"/
   "encargados-franquicias" — a diferencia de "sucursal" (una lista
   fija elegida a mano), esto se resuelve DINÁMICAMENTE contra
   Sucursales.esPropio (data/sucursales.js) en cada chequeo: un local
   nuevo cae del lado correcto solo con marcarlo como propio o no,
   sin volver a tocar el canal. Pedido explícito del usuario: "por
   descarte los que no sean propios serán franquicias, y aunque no
   estén cargados, si en algún momento se decide sumar a esos
   encargados estarán incluidos".
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { canalesMock } from "./mock/canales.mock.js";
import { HOJAS } from "../config.js";
import { getSucursales } from "./sucursales.js";

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
    { id: "encargados-propios", nombre: "Encargados — Locales propios" },
    { id: "encargados-franquicias", nombre: "Encargados — Franquicias" },
];

function normalizarCanal(f) {
    return {
        id: f.id,
        nombre: String(f.nombre || "").trim(),
        icono: ICONOS_CANAL.some((i) => i.id === f.icono) ? f.icono : "comentario",
        creadoPor: String(f.creadoPor || "").trim(),
        restringidoA: String(f.restringidoA || "").trim(),
        sucursal: String(f.sucursal || "").trim(),
    };
}

/** sucursales es opcional — solo hace falta para resolver
 *  "encargados-propios"/"encargados-franquicias" (necesitan mirar
 *  Sucursales.esPropio). Si no se pasa, esos dos modos simplemente no
 *  matchean a nadie (mismo criterio conservador que "sin dato, no se
 *  muestra" en vez de asumir). Quien llama en un `.filter()` la trae
 *  prefetcheada UNA vez, mismo patrón que sucursalesPrefetch en
 *  data/sucursales.js. */
export function puedeVerCanal(canal, usuario, sucursales = []) {
    if (usuario.rol === "admin") return true;

    const locales = String(canal.sucursal || "").trim();
    if (locales) {
        const lista = locales.split(",").map((s) => s.trim()).filter(Boolean);
        return usuario.rol === "colaborador" && !!usuario.encargado && lista.includes(usuario.sucursal);
    }

    const restriccion = String(canal.restringidoA || "").trim();
    if (!restriccion) return true;
    if (restriccion === "admin") return false;
    if (restriccion === "capacitador") return usuario.rol === "supervisor" && !!usuario.capacitador;
    if (restriccion === "supervisor") return usuario.rol === "supervisor" && !usuario.capacitador;
    if (restriccion === "encargados-propios" || restriccion === "encargados-franquicias") {
        if (usuario.rol !== "colaborador" || !usuario.encargado) return false;
        const sucursal = sucursales.find((s) => s.nombre === usuario.sucursal);
        const esPropio = !!(sucursal && sucursal.esPropio);
        return restriccion === "encargados-propios" ? esPropio : !esPropio;
    }
    return true;
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
    if (usuario.rol === "admin") return getCanales();
    const [todos, sucursales] = await Promise.all([getCanales(), getSucursales()]);
    return todos.filter((c) => puedeVerCanal(c, usuario, sucursales));
}

export async function canalInfo(canalId) {
    const canales = await getCanales();
    return canales.find((c) => String(c.id) === String(canalId)) || canales[0] || { id: "", nombre: "Sin canal", icono: "comentario", restringidoA: "", sucursal: "" };
}

export async function crearCanal({ nombre, icono, creadoPor, restringidoA, sucursal }) {
    return writeSheet(HOJAS.CANALES, { nombre, icono: icono || "comentario", creadoPor: creadoPor || "", restringidoA: restringidoA || "", sucursal: sucursal || "" }, canalesMock);
}

export async function actualizarCanal(id, cambios) {
    return updateSheet(HOJAS.CANALES, id, cambios, canalesMock);
}

export async function eliminarCanal(id) {
    return deleteSheet(HOJAS.CANALES, id, canalesMock);
}
