/* ============================
   Lucciano's Academy
   pages/pedidos.js — Pedidos de alta y baja (solo Administrador)

   Los Responsables de local piden desde "Mi local" (pages/colaboradores.js); acá se aprueban o rechazan. Aprobar un ALTA crea la cuenta con
   los mismos 30 días de acceso que "Registrar colaborador"; aprobar una BAJA desactiva la cuenta (no borra su historial). Solo se leen los
   pedidos pendientes.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { EmptyState } from "../components/emptyState.js";
import { getPedidosPendientes, resolverPedido } from "../data/pedidos.js";
import { getUsuarios, crearUsuario, actualizarUsuario } from "../data/usuarios.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { escaparHtml } from "../services/html.js";
import { DIAS_ACCESO_INICIAL, fechaHoyISO, sumarDias } from "../services/fechasAcceso.js";
import { avisoDelPedido } from "../services/avisoPedido.js";
import { navigate } from "../router.js";

const TIPO_PILL = { alta: `<span class="badge badge-success">Alta</span>`, baja: `<span class="badge badge-warning">Baja</span>` };

export async function Pedidos() {
    const [pedidos, usuarios] = await Promise.all([getPedidosPendientes(), getUsuarios()]);
    const altas = pedidos.filter((p) => p.tipo === "alta").length;
    const bajas = pedidos.length - altas;

    const filas = pedidos.map((p) => {
        const aviso = avisoDelPedido(p, usuarios);
        // Un alta con aviso (correo repetido o inválido) no se puede aprobar: hay que rechazarla o corregirla. Una baja con aviso se puede cerrar.
        const bloqueado = p.tipo === "alta" && aviso;
        return {
            tipo: TIPO_PILL[p.tipo] || escaparHtml(p.tipo),
            local: escaparHtml(p.sucursal),
            persona: `${escaparHtml(p.nombre)}${p.tipo === "alta" ? `<div class="text-xs text-muted">${escaparHtml(p.rol)}</div>` : ""}
                ${aviso ? `<div class="text-xs" style="color:var(--warning)">⚠ ${escaparHtml(aviso)}</div>` : ""}`,
            // El correo es lo primero que se mira antes de aprobar un alta (tiene que ser exacto): va en su propia columna, bien visible.
            correo: p.email ? `<strong>${escaparHtml(p.email)}</strong>` : `<span class="text-muted">—</span>`,
            pidio: `<span class="text-sm">${escaparHtml(p.pedidoPorNombre || p.pedidoPorEmail)}</span>`,
            acciones: `<button class="btn btn-primary" style="width:auto;padding:6px 14px" data-aprobar="${escaparHtml(p.id)}" ${bloqueado ? "disabled title=\"Resolvé el aviso o rechazalo\"" : ""}>Aprobar</button>
                <button class="btn btn-secondary" style="width:auto;padding:6px 14px" data-rechazar="${escaparHtml(p.id)}">Rechazar</button>`,
        };
    });

    const columnas = [
        { key: "tipo", label: "Tipo" }, { key: "local", label: "Local" }, { key: "persona", label: "Persona" },
        { key: "correo", label: "Correo" },
        { key: "pidio", label: "Lo pidió" }, { key: "acciones", label: "" },
    ];

    return `
        ${Header("Pedidos", pedidos.length ? `${altas} alta${altas === 1 ? "" : "s"} y ${bajas} baja${bajas === 1 ? "" : "s"} pendientes` : "Altas y bajas que piden los responsables de local")}
        ${pedidos.length ? `
            <div class="section"><div id="tabla-pedidos">${Table(columnas, filas)}</div></div>
            <p class="text-xs text-muted" style="margin-top:10px">Aprobar un alta crea la cuenta con ${DIAS_ACCESO_INICIAL} días de acceso. Aprobar una baja desactiva la cuenta: no se borra su historial.</p>
        ` : EmptyState({ titulo: "No hay pedidos pendientes", detalle: "Cuando un responsable de local pida un alta o una baja, aparece acá." })}
    `;
}

export function bindPedidos() {
    document.querySelectorAll("[data-aprobar]").forEach((btn) => btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Aprobando...";
        try { await aprobar(btn.dataset.aprobar); }
        catch (err) { alert(`No se pudo aprobar: ${err.message}`); }
        navigate("pedidos", { replace: true });
    }));
    document.querySelectorAll("[data-rechazar]").forEach((btn) => btn.addEventListener("click", async () => {
        if (!confirm("¿Rechazar este pedido?")) return;
        btn.disabled = true;
        try {
            await resolverPedido(btn.dataset.rechazar, "rechazado");
            registrarEvento(getUsuarioActual().id, "rechazar_pedido", `Pedido ${btn.dataset.rechazar} rechazado`);
        } catch (err) { alert(`No se pudo rechazar: ${err.message}`); }
        navigate("pedidos", { replace: true });
    }));
}

async function aprobar(id) {
    const [pedidos, usuarios] = await Promise.all([getPedidosPendientes(), getUsuarios()]);
    const p = pedidos.find((x) => String(x.id) === String(id));
    if (!p) throw new Error("el pedido ya no está pendiente");
    const admin = getUsuarioActual();
    const aviso = avisoDelPedido(p, usuarios);

    if (p.tipo === "alta") {
        if (aviso) throw new Error(aviso);
        await crearUsuario({
            nombre: p.nombre, email: p.email, rol: "colaborador", sucursal: p.sucursal,
            responsableTurno: p.rol === "Responsable de turno",
            encargado: p.rol === "Responsable de local",      // solo lo puede pedir un Capacitador; un Responsable de local no pide otros responsables
            fechaVencimientoAcceso: sumarDias(fechaHoyISO(), DIAS_ACCESO_INICIAL),
        });
        registrarEvento(admin.id, "registrar_colaborador", `Alta de ${p.nombre} pedida por ${p.pedidoPorNombre || p.pedidoPorEmail} (acceso por ${DIAS_ACCESO_INICIAL} días)`);
    } else if (!aviso) {
        await actualizarUsuario(p.usuarioId, { activo: "NO" });
        registrarEvento(admin.id, "deshabilitar_acceso", `Baja de ${p.nombre} pedida por ${p.pedidoPorNombre || p.pedidoPorEmail}`);
    }
    await resolverPedido(p.id, "aprobado");
}
