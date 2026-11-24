/* ============================
   Lucciano's Academy
   pages/pedidos.js — Pedidos de alta y baja (solo Administrador)

   Los Responsables de local piden desde "Mi local" (pages/colaboradores.js); acá se aprueban o rechazan. Aprobar un ALTA crea la cuenta con
   los mismos 30 días de acceso que "Registrar colaborador"; aprobar una BAJA desactiva la cuenta (no borra su historial); aprobar una
   TRANSFERENCIA pasa a la persona al otro local (solo entre locales propios). Dos transferencias cruzadas (A→B y B→A) se aprueban juntas.
   Solo se leen los pedidos pendientes; lo ya resuelto queda en el Historial, que se lee recién al abrirlo.
=============================*/

import { Header } from "../components/header.js";
import { Table } from "../components/table.js";
import { EmptyState } from "../components/emptyState.js";
import { getPedidosPendientes, getPedidosResueltos, resolverPedido } from "../data/pedidos.js";
import { getUsuarios, crearUsuario, actualizarUsuario } from "../data/usuarios.js";
import { localesDelUsuario } from "../services/localActivo.js";
import { getSucursales } from "../data/sucursales.js";
import { invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";
import { contraparteDe, localesPropios, motivoSinTransferencia } from "../services/transferencias.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { escaparHtml } from "../services/html.js";
import { DIAS_ACCESO_INICIAL, fechaHoyISO, sumarDias } from "../services/fechasAcceso.js";
import { avisoDelPedido } from "../services/avisoPedido.js";
import { navigate } from "../router.js";

const TIPO_PILL = { alta: `<span class="badge badge-success">Alta</span>`, baja: `<span class="badge badge-warning">Baja</span>`, transferencia: `<span class="badge badge-info">Transferencia</span>` };
const fmtLocal = (n) => escaparHtml(String(n || "").replace("Lucciano's ", ""));
const fmtFecha = (ms) => ms ? new Date(ms).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }) : "—";

export async function Pedidos() {
    const [pedidos, usuarios] = await Promise.all([getPedidosPendientes(), getUsuarios()]);
    const altas = pedidos.filter((p) => p.tipo === "alta").length;
    const bajas = pedidos.filter((p) => p.tipo === "baja").length;
    const transf = pedidos.filter((p) => p.tipo === "transferencia").length;
    const resumen = [[altas, "alta"], [bajas, "baja"], [transf, "transferencia"]].filter(([n]) => n)
        .map(([n, t]) => `${n} ${t}${n === 1 ? "" : "s"}`).join(", ");

    const filas = pedidos.map((p) => {
        const aviso = avisoDelPedido(p, usuarios);
        // Un alta con aviso (correo repetido o inválido) no se puede aprobar: hay que rechazarla o corregirla. Una baja con aviso se puede cerrar.
        const bloqueado = (p.tipo === "alta" || p.tipo === "transferencia") && aviso;
        const pareja = contraparteDe(p, pedidos);
        const detalleTransf = p.tipo === "transferencia" ? (pareja
            ? `<div class="text-xs" style="color:var(--success)">⇄ Cruzada con ${escaparHtml(pareja.nombre)} (${fmtLocal(pareja.sucursal)} → ${fmtLocal(pareja.destino)})</div>`
            : `<div class="text-xs text-muted">Sin pedido cruzado: nadie pidió todavía el cambio contrario</div>`) : "";
        return {
            tipo: TIPO_PILL[p.tipo] || escaparHtml(p.tipo),
            local: p.tipo === "transferencia" ? `${fmtLocal(p.sucursal)} → <strong>${fmtLocal(p.destino)}</strong>` : escaparHtml(p.sucursal),
            persona: `${escaparHtml(p.nombre)}${p.tipo === "alta" ? `<div class="text-xs text-muted">${escaparHtml(p.rol)}</div>` : ""}
                ${detalleTransf}
                ${aviso ? `<div class="text-xs" style="color:var(--warning)">⚠ ${escaparHtml(aviso)}</div>` : ""}`,
            // El correo es lo primero que se mira antes de aprobar un alta (tiene que ser exacto): va en su propia columna, bien visible.
            correo: p.email ? `<strong>${escaparHtml(p.email)}</strong>` : `<span class="text-muted">—</span>`,
            pidio: `<span class="text-sm">${escaparHtml(p.pedidoPorNombre || p.pedidoPorEmail)}</span><div class="text-xs text-muted">${fmtFecha(p.creadoEn)}</div>`,
            acciones: `<button class="btn btn-primary" style="width:auto;padding:6px 14px" data-aprobar="${escaparHtml(p.id)}" ${bloqueado ? "disabled title=\"Resolvé el aviso o rechazalo\"" : ""}>Aprobar</button>
                ${pareja ? `<button class="btn btn-primary" style="width:auto;padding:6px 14px" data-aprobar-par="${escaparHtml(p.id)}|${escaparHtml(pareja.id)}">Aprobar las dos</button>` : ""}
                <button class="btn btn-secondary" style="width:auto;padding:6px 14px" data-rechazar="${escaparHtml(p.id)}">Rechazar</button>`,
        };
    });

    const columnas = [
        { key: "tipo", label: "Tipo" }, { key: "local", label: "Local" }, { key: "persona", label: "Persona" },
        { key: "correo", label: "Correo" },
        { key: "pidio", label: "Lo pidió" }, { key: "acciones", label: "" },
    ];

    return `
        ${Header("Pedidos", pedidos.length ? `${resumen} pendientes` : "Altas, bajas y transferencias que piden los responsables de local")}
        ${pedidos.length ? `
            <div class="section"><div id="tabla-pedidos">${Table(columnas, filas)}</div></div>
            <p class="text-xs text-muted" style="margin-top:10px">Aprobar un alta crea la cuenta con ${DIAS_ACCESO_INICIAL} días de acceso. Aprobar una baja desactiva la cuenta: no se borra su historial. Aprobar una transferencia pasa a la persona al otro local, con su historial.</p>
        ` : EmptyState({ titulo: "No hay pedidos pendientes", detalle: "Cuando un responsable de local pida un alta, una baja o una transferencia, aparece acá." })}
        <div class="section" style="margin-top:18px">
            <button class="btn btn-secondary" id="btn-ver-historial" style="width:auto;padding:8px 16px">Ver historial de pedidos</button>
            <div id="historial-pedidos" style="margin-top:14px"></div>
        </div>
    `;
}

async function mostrarHistorial() {
    const cont = document.getElementById("historial-pedidos");
    const boton = document.getElementById("btn-ver-historial");
    // Segundo toque: se cierra. El botón cambia de texto para que se entienda que abre y cierra.
    if (cont.dataset.abierto === "si") {
        cont.innerHTML = "";
        cont.dataset.abierto = "no";
        boton.textContent = "Ver historial de pedidos";
        return;
    }
    cont.dataset.abierto = "si";
    boton.textContent = "Ocultar historial";
    cont.innerHTML = `<p class="text-sm text-muted">Cargando...</p>`;
    invalidar(HOJAS.PEDIDOS_HISTORIAL);
    const resueltos = await getPedidosResueltos();
    if (cont.dataset.abierto !== "si") return;      // lo cerró mientras cargaba
    if (!resueltos.length) { cont.innerHTML = `<p class="text-sm text-muted">Todavía no hay pedidos resueltos.</p>`; return; }
    const filas = resueltos.map((p) => ({
        cuando: fmtFecha(p.resueltoEn),
        tipo: TIPO_PILL[p.tipo] || escaparHtml(p.tipo),
        local: p.tipo === "transferencia" ? `${fmtLocal(p.sucursal)} → ${fmtLocal(p.destino)}` : fmtLocal(p.sucursal),
        persona: `${escaparHtml(p.nombre)}${p.email ? `<div class="text-xs text-muted">${escaparHtml(p.email)}</div>` : ""}`,
        pidio: `<span class="text-sm">${escaparHtml(p.pedidoPorNombre || p.pedidoPorEmail)}</span><div class="text-xs text-muted">${fmtFecha(p.creadoEn)}</div>`,
        resultado: p.estado === "aprobado" ? `<span class="badge badge-success">Aprobado</span>` : `<span class="badge badge-danger">Rechazado</span>`,
        resolvio: escaparHtml(p.resueltoPorNombre || "—"),
    }));
    cont.innerHTML = Table([
        { key: "cuando", label: "Resuelto" }, { key: "tipo", label: "Tipo" }, { key: "local", label: "Local" }, { key: "persona", label: "Persona" },
        { key: "pidio", label: "Lo pidió (y cuándo)" }, { key: "resultado", label: "Resultado" }, { key: "resolvio", label: "Lo resolvió" },
    ], filas) + `<p class="text-xs text-muted" style="margin-top:8px">Se muestran los últimos pedidos resueltos.</p>`;
}

export function bindPedidos() {
    document.getElementById("btn-ver-historial")?.addEventListener("click", mostrarHistorial);
    document.querySelectorAll("[data-aprobar-par]").forEach((btn) => btn.addEventListener("click", async () => {
        const [a, b] = btn.dataset.aprobarPar.split("|");
        btn.disabled = true;
        btn.textContent = "Aprobando...";
        try { await aprobar(a); await aprobar(b); }
        catch (err) { alert(`No se pudo aprobar: ${err.message}`); }
        navigate("pedidos", { replace: true });
    }));
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
            await resolverPedido(btn.dataset.rechazar, "rechazado", getUsuarioActual().nombre);
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
    } else if (p.tipo === "transferencia") {
        if (aviso) throw new Error(aviso);
        // Solo entre locales propios: se vuelve a controlar acá, no solo en la pantalla del responsable.
        // Valen los locales propios y los que gestiona quien lo pidió (se mira en su ficha, no en lo que mande la pantalla).
        const quienPidio = usuarios.find((u) => String(u.email).toLowerCase() === p.pedidoPorEmail);
        const motivo = motivoSinTransferencia(p.sucursal, p.destino, localesPropios(await getSucursales()), quienPidio ? localesDelUsuario(quienPidio) : []);
        if (motivo) throw new Error(motivo);
        await actualizarUsuario(p.usuarioId, { sucursal: p.destino });     // también le pasa su historial al local nuevo
        registrarEvento(admin.id, "transferir_colaborador", `${p.nombre}: de ${p.sucursal} a ${p.destino} (pedido por ${p.pedidoPorNombre || p.pedidoPorEmail})`);
    } else if (!aviso) {
        await actualizarUsuario(p.usuarioId, { activo: "NO" });
        registrarEvento(admin.id, "deshabilitar_acceso", `Baja de ${p.nombre} pedida por ${p.pedidoPorNombre || p.pedidoPorEmail}`);
    }
    await resolverPedido(p.id, "aprobado", admin.nombre);
}
