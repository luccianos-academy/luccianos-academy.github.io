/* ============================
   Lucciano's Academy
   services/avisoPedido.js — Qué hay que mirar antes de aprobar un pedido de alta o baja (función pura, con pruebas)
=============================*/

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** null = nada raro. `usuarios` son las filas de Usuarios (activo "SI"/"NO"). */
export function avisoDelPedido(pedido, usuarios) {
    if (pedido.tipo === "alta") {
        if (!REGEX_EMAIL.test(pedido.email)) return "El correo no parece válido";
        const existente = usuarios.find((u) => String(u.email).toLowerCase() === pedido.email);
        if (existente) return `Ese correo ya está registrado (${existente.nombre}, ${existente.activo === "SI" ? "activo" : "inactivo"})`;
        return null;
    }
    const persona = usuarios.find((u) => String(u.id) === String(pedido.usuarioId));
    if (!persona) return "No encuentro a esa persona (¿ya la eliminaron?)";
    if (persona.activo !== "SI") return "Ya estaba dada de baja";
    return null;
}
