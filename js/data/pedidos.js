/* ============================
   Lucciano's Academy
   data/pedidos.js — Pedidos de alta y baja de personas

   Un Responsable de local pide (alta de una persona nueva o baja de una existente) para SU local; el Administrador los aprueba o
   rechaza en la pantalla "Pedidos". Solo se leen los PENDIENTES: lo ya resuelto no se vuelve a bajar.
=============================*/

import { fetchSheet, writeSheet, updateSheet } from "../services/dataSource.js";
import { pedidosMock } from "./mock/pedidos.mock.js";
import { HOJAS } from "../config.js";

function normalizarPedido(f) {
    return {
        id: f.id,
        tipo: String(f.tipo || "").toLowerCase(),
        sucursal: String(f.sucursal || "").trim(),
        nombre: String(f.nombre || "").trim(),
        email: String(f.email || "").trim().toLowerCase(),
        rol: String(f.rol || "Colaborador").trim(),
        usuarioId: f.usuarioId,
        pedidoPorEmail: String(f.pedidoPorEmail || "").trim().toLowerCase(),
        pedidoPorNombre: String(f.pedidoPorNombre || "").trim(),
        estado: String(f.estado || "pendiente").toLowerCase(),
        creadoEn: Number(f.creadoEn) || 0,
    };
}

/** Pedidos pendientes: todos (Admin), los de mi local (Responsable de local) o los que pedí yo (Capacitador). */
export async function getPedidosPendientes() {
    try {
        const filas = await fetchSheet(HOJAS.PEDIDOS, pedidosMock);
        return filas.map(normalizarPedido).filter((p) => p.estado === "pendiente").sort((a, b) => b.creadoEn - a.creadoEn);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.PEDIDOS}':`, err.message);
        return [];
    }
}

/** Alta de una persona nueva en MI local (el local lo pone la capa de datos, no la pantalla). */
export async function pedirAlta({ nombre, email, rol = "Colaborador", sucursal }) {
    // `sucursal` solo lo usa un Capacitador (elige el local); para un Responsable de local la capa de datos pone el suyo.
    return writeSheet(HOJAS.PEDIDOS, { tipo: "alta", nombre: String(nombre).trim(), email: String(email).trim().toLowerCase(), rol, sucursal }, pedidosMock);
}

/** Baja de una persona de MI local. */
export async function pedirBaja({ usuarioId, nombre, email, sucursal }) {
    return writeSheet(HOJAS.PEDIDOS, { tipo: "baja", usuarioId, nombre: String(nombre).trim(), email: String(email || "").trim().toLowerCase(), sucursal }, pedidosMock);
}

/** Solo el Admin: marca el pedido como aprobado o rechazado. */
export async function resolverPedido(id, estado) {
    return updateSheet(HOJAS.PEDIDOS, id, { estado, resueltoEn: Date.now() }, pedidosMock);
}
