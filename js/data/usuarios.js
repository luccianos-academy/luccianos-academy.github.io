/* ============================
   FARO v4
   data/usuarios.js — Tabla "Usuarios"

   Un colaborador ES un usuario con rol="colaborador"; "encargado"
   es un atributo booleano sobre ese mismo usuario, no un rol
   aparte (así lo define el póster del proyecto).
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { usuariosMock } from "./mock/usuarios.mock.js";
import { HOJAS } from "../config.js";

function normalizarUsuario(f) {
    return {
        id: f.id,
        nombre: String(f.nombre || "").trim(),
        email: String(f.email || "").trim().toLowerCase(),
        // trim+lowercase: una fila cargada a mano en Sheets con un
        // espacio de más ("colaborador ") rompía silenciosamente
        // MENU_POR_ROL/PERMISOS_PAGINA (búsqueda de clave exacta) —
        // ver services/auth.js.
        rol: String(f.rol || "").trim().toLowerCase(),
        encargado: String(f.encargado || "").trim().toUpperCase() === "SI",
        sucursal: String(f.sucursal || "").trim(),
        activo: String(f.activo || "").trim().toUpperCase() === "NO" ? "NO" : "SI",
        // Vacío = acceso permanente (sin vencimiento). "YYYY-MM-DD" =
        // fecha en la que vence el acceso — ver pages/colaboradores.js
        // para el cálculo de días restantes y el chequeo automático.
        // Si Sheets guardó la celda como fecha (autoformato al tipear
        // "2026-08-03"), acá llega como "2026-08-03T03:00:00.000Z" —
        // nos quedamos solo con la parte de fecha.
        fechaVencimientoAcceso: String(f.fechaVencimientoAcceso || "").trim().slice(0, 10),
        // Fecha real de alta (se completa sola al crear el usuario
        // desde acá — ver crearUsuario). Usuarios cargados antes de
        // que existiera esta columna quedan con "" — inicioColaborador.js
        // cae a un proxy honesto (primera asignación) solo en ese caso.
        fechaAlta: String(f.fechaAlta || "").trim().slice(0, 10),
        // Igual que "encargado" pero sobre un Supervisor: mismo rol,
        // mismos permisos, es solo una etiqueta para diferenciarlo de
        // un Supervisor de sucursal en la interfaz (así el capacitador
        // no queda mezclado con "el supervisor" sin que nadie lo note).
        capacitador: String(f.capacitador || "").trim().toUpperCase() === "SI",
    };
}

export async function getUsuarios() {
    try {
        const filas = await fetchSheet(HOJAS.USUARIOS, usuariosMock);
        return filas.map(normalizarUsuario);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.USUARIOS}':`, err.message);
        return [];
    }
}

export async function getColaboradores() {
    const usuarios = await getUsuarios();
    return usuarios.filter((u) => u.rol === "colaborador");
}

/** Colaboradores de una sucursal puntual (alcance de un Supervisor). */
export async function getColaboradoresPorSucursal(sucursal) {
    const colaboradores = await getColaboradores();
    return colaboradores.filter((c) => c.sucursal === sucursal);
}

export async function crearUsuario({ nombre, email, rol, sucursal = "", encargado = false, activo = "SI", fechaVencimientoAcceso = "", capacitador = false }) {
    // Un rol fuera de estos tres rompe MENU_POR_ROL/PERMISOS_PAGINA en
    // silencio (búsqueda de clave exacta) — mejor frenar el alta acá
    // que debuggear un usuario "sin menú" después.
    if (!["admin", "supervisor", "colaborador"].includes(rol)) {
        throw new Error(`Rol inválido: "${rol}" (tiene que ser admin, supervisor o colaborador)`);
    }
    return writeSheet(HOJAS.USUARIOS, {
        nombre,
        email: String(email).trim().toLowerCase(),
        rol,
        sucursal,
        encargado: encargado ? "SI" : "NO",
        activo,
        fechaVencimientoAcceso,
        fechaAlta: new Date().toISOString().slice(0, 10),
        capacitador: capacitador ? "SI" : "NO",
    }, usuariosMock);
}

export async function actualizarUsuario(id, cambios) {
    return updateSheet(HOJAS.USUARIOS, id, cambios, usuariosMock);
}

export async function eliminarUsuario(id) {
    return deleteSheet(HOJAS.USUARIOS, id, usuariosMock);
}

/**
 * Resuelve la fila completa de Usuarios que corresponde a la
 * sesión actual. Preferimos el id; si no está, caemos a email.
 */
export async function obtenerMiUsuario(sesion) {
    const usuarios = await getUsuarios();
    if (sesion.id) {
        const porId = usuarios.find((u) => String(u.id) === String(sesion.id));
        if (porId) return porId;
    }
    return usuarios.find((u) => u.email === String(sesion.email || "").trim().toLowerCase()) || null;
}
