/* ============================
   Lucciano's Academy
   services/transferencias.js — Transferencias entre locales propios (funciones puras, con pruebas)

   Dos responsables acuerdan entre ellos un cambio (una persona sale de A hacia B y otra de B hacia A) y cada uno pide la salida de LA SUYA.
   El Administrador ve las dos pedidos juntas y las aprueba de una vez, sin tener que mediar.
=============================*/

/** El pedido contrario: otra transferencia pendiente que va de mi destino a mi origen. null si nadie la pidió todavía. */
export function contraparteDe(pedido, pedidos) {
    if (!pedido || pedido.tipo !== "transferencia") return null;
    return (pedidos || []).find((q) => q.tipo === "transferencia" && q.estado === "pendiente"
        && String(q.id) !== String(pedido.id) && q.sucursal === pedido.destino && q.destino === pedido.sucursal) || null;
}

/** Nombres de los locales propios (los únicos entre los que se puede transferir). */
export function localesPropios(sucursales) {
    return (sucursales || []).filter((s) => s.esPropio && s.estado !== "Inactiva").map((s) => s.nombre);
}

/** null si se puede transferir entre estos dos locales; si no, el motivo. */
export function motivoSinTransferencia(origen, destino, propios) {
    if (!origen || !destino) return "Falta el local";
    if (origen === destino) return "Es el mismo local";
    if (!propios.includes(origen) || !propios.includes(destino)) return "Solo se transfiere entre locales propios";
    return null;
}
