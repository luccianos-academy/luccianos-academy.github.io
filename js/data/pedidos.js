/* ============================
   Lucciano's Academy
   data/pedidos.js — Pedidos de alta y baja de personas

   Un Responsable de local pide (alta de una persona nueva o baja de una existente) para SU local; el Administrador los aprueba o
   rechaza en la pantalla "Pedidos". Solo se leen los PENDIENTES: lo ya resuelto no se vuelve a bajar.
=============================*/

import { fetchSheet, writeSheet, updateSheet } from "../services/dataSource.js";
import { pedidosMock } from "./mock/pedidos.mock.js";
import { HOJAS } from "../config.js";
import { avisarPedidoReal } from "../services/google.js";
import { getUsuarioActual } from "../services/auth.js";

const sinMarca = (n) => String(n || "").replace("Lucciano's ", "");
/** Push a los Administradores de que llegó un pedido. Nunca frena el pedido: si el aviso falla, el pedido igual quedó guardado. */
function avisarAlAdmin(titulo, detalle) {
    const yo = getUsuarioActual();
    const cuerpo = `${detalle}${yo && yo.nombre ? ` · lo pidió ${yo.nombre}` : ""}`;
    Promise.resolve().then(() => avisarPedidoReal(titulo, cuerpo)).catch((err) => console.warn("[pedidos] No se pudo avisar al Administrador:", err));
}

function normalizarPedido(f) {
    return {
        id: f.id,
        tipo: String(f.tipo || "").toLowerCase(),
        sucursal: String(f.sucursal || "").trim(),
        destino: String(f.destino || "").trim(),          // solo en las transferencias: el local al que va la persona
        nombre: String(f.nombre || "").trim(),
        email: String(f.email || "").trim().toLowerCase(),
        rol: String(f.rol || "Colaborador").trim(),
        usuarioId: f.usuarioId,
        pedidoPorEmail: String(f.pedidoPorEmail || "").trim().toLowerCase(),
        pedidoPorNombre: String(f.pedidoPorNombre || "").trim(),
        estado: String(f.estado || "pendiente").toLowerCase(),
        creadoEn: Number(f.creadoEn) || 0,
        resueltoEn: Number(f.resueltoEn) || 0,
        resueltoPorNombre: String(f.resueltoPorNombre || "").trim(),
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
    const r = await writeSheet(HOJAS.PEDIDOS, { tipo: "alta", nombre: String(nombre).trim(), email: String(email).trim().toLowerCase(), rol, sucursal }, pedidosMock);
    avisarAlAdmin("Nuevo pedido de alta", `${String(nombre).trim()} · ${sinMarca(sucursal || getUsuarioActual()?.sucursal)}`);
    return r;
}

/** Baja de una persona de MI local. */
export async function pedirBaja({ usuarioId, nombre, email, sucursal }) {
    const r = await writeSheet(HOJAS.PEDIDOS, { tipo: "baja", usuarioId, nombre: String(nombre).trim(), email: String(email || "").trim().toLowerCase(), sucursal }, pedidosMock);
    avisarAlAdmin("Nuevo pedido de baja", `${String(nombre).trim()} · ${sinMarca(sucursal || getUsuarioActual()?.sucursal)}`);
    return r;
}

/** Transferencia de una persona de MI local a otro local (solo entre locales propios; el Admin la aprueba). */
export async function pedirTransferencia({ usuarioId, nombre, email, sucursal, destino }) {
    const r = await writeSheet(HOJAS.PEDIDOS, { tipo: "transferencia", usuarioId, nombre: String(nombre).trim(), email: String(email || "").trim().toLowerCase(), sucursal, destino: String(destino).trim() }, pedidosMock);
    avisarAlAdmin("Nuevo pedido de transferencia", `${String(nombre).trim()}: ${sinMarca(sucursal)} → ${sinMarca(destino)}`);
    return r;
}

/** Solo el Admin: marca el pedido como aprobado o rechazado y deja quién y cuándo lo resolvió. */
export async function resolverPedido(id, estado, resueltoPorNombre = "") {
    return updateSheet(HOJAS.PEDIDOS, id, { estado, resueltoEn: Date.now(), resueltoPorNombre }, pedidosMock);
}

/** Solo el Admin: el registro de lo ya resuelto, lo más reciente primero. Se lee al abrir el historial, no antes. */
export async function getPedidosResueltos() {
    try {
        const filas = await fetchSheet(HOJAS.PEDIDOS_HISTORIAL, pedidosMock);
        return filas.map(normalizarPedido).filter((p) => p.estado !== "pendiente").sort((a, b) => b.resueltoEn - a.resueltoEn);
    } catch (err) {
        console.warn(`No se pudo leer el historial de '${HOJAS.PEDIDOS}':`, err.message);
        return [];
    }
}
