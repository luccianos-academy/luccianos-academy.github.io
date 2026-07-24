/* ============================
   FARO v4
   data/sucursales.js — Tabla "Sucursales"
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { sucursalesMock } from "./mock/sucursales.mock.js";
import { HOJAS } from "../config.js";

function normalizarSucursal(f) {
    return {
        id: f.id,
        nombre: f.nombre,
        supervisor: f.supervisor || "",
        estado: f.estado || "Activa",
    };
}

export async function getSucursales() {
    try {
        const filas = await fetchSheet(HOJAS.SUCURSALES, sucursalesMock);
        return filas.map(normalizarSucursal);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.SUCURSALES}':`, err.message);
        return [];
    }
}

export async function crearSucursal({ nombre, supervisor = "", estado = "Activa" }) {
    return writeSheet(HOJAS.SUCURSALES, { nombre, supervisor, estado }, sucursalesMock);
}

export async function actualizarSucursal(id, cambios) {
    return updateSheet(HOJAS.SUCURSALES, id, cambios, sucursalesMock);
}

export async function eliminarSucursal(id) {
    return deleteSheet(HOJAS.SUCURSALES, id, sucursalesMock);
}

/** Locales que supervisa un Supervisor: matchea por nombre contra
 *  Sucursales.supervisor (puede tener más de uno a cargo). Si todavía
 *  no hay ningún local vinculado a él ahí — dato que se carga a mano o
 *  se auto-completa al registrar un colaborador nuevo, ver
 *  pages/colaboradores.js — cae a su propio Usuarios.sucursal como
 *  único local, para no dejarlo bloqueado por faltar ese vínculo.
 *
 *  Usado por la home del Supervisor (inicioSupervisor.js), "Mi
 *  equipo" (pages/colaboradores.js), y los rankings por supervisor de
 *  Dashboard Ejecutivo / Supervisores / Reportes — mismo criterio en
 *  todos, así ningún supervisor sin ese vínculo cargado a mano queda
 *  mostrando 0% por una limitación de datos y no de desempeño real.
 *
 *  sucursalesPrefetch es opcional: si quien llama ya tiene
 *  getSucursales() resuelto (ej. un ranking que recorre varios
 *  supervisores a la vez), lo pasa para no repetir el fetch por cada
 *  uno. */
export async function getMisLocales(usuario, sucursalesPrefetch) {
    const sucursales = sucursalesPrefetch || await getSucursales();
    const asignados = sucursales.filter((s) => s.supervisor === usuario.nombre).map((s) => s.nombre);
    if (asignados.length) return asignados;
    return usuario.sucursal ? [usuario.sucursal] : [];
}
