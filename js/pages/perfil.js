/* ============================
   FARO v4
   pages/perfil.js — Mi perfil (solo lectura por ahora)

   Sprint 9 le suma edición de datos y foto; acá alcanza con
   probar que la ruta y la entrada de menú ya existen para
   los 3 roles.
=============================*/

import { Header } from "../components/header.js";
import { getUsuarioActual } from "../services/auth.js";
import { soportaPush, estadoPermisoPush, activarPush } from "../services/push.js";
import { getTokensDeUsuario } from "../data/tokens.js";
import { navigate } from "../router.js";

const ROL_LEGIBLE = { admin: "Administrador", supervisor: "Supervisor", colaborador: "Colaborador" };

/** Estado del permiso → qué mostrar. "granted"/"denied" son
 *  decisiones del navegador que un botón nuestro no puede revertir
 *  (por diseño, así evitan que un sitio insista) — para "denied" solo
 *  se explica cómo re-habilitarlo a mano en la config del navegador.
 *
 *  IMPORTANTE: "granted" (permiso del navegador) NO es lo mismo que
 *  "hay un token real guardado" — un rechazo del backend, un error de
 *  red, o un service worker con caché vieja pueden dejar el permiso
 *  otorgado sin que el registro haya funcionado de verdad. Por eso
 *  esto chequea la hoja "Tokens" real, no solo el permiso — mostrar
 *  "Activadas ✓" sin haberlo verificado fue justamente el bug que hizo
 *  perder tiempo buscando el problema en el lugar equivocado. */
async function bloquePush(usuario) {
    if (!soportaPush()) return "";

    const estado = estadoPermisoPush();
    if (estado === "denied") {
        return `
            <div class="card" style="max-width:420px;margin-top:16px">
                <div class="item"><span>Notificaciones push</span><strong class="text-sm text-muted">Bloqueadas</strong></div>
                <p class="text-xs text-muted" style="margin-top:8px">Las bloqueaste antes desde el navegador. Para recibirlas, habilitalas a mano en la configuración del sitio (ícono de candado en la barra de direcciones).</p>
            </div>
        `;
    }
    if (estado === "granted") {
        const tokens = await getTokensDeUsuario(usuario.id);
        if (tokens.length) {
            return `
                <div class="card" style="max-width:420px;margin-top:16px">
                    <div class="item"><span>Notificaciones push</span><strong class="text-sm" style="color:var(--success)">Activadas ✓</strong></div>
                </div>
            `;
        }
        // El navegador dio el permiso, pero no hay ningún token
        // guardado para este usuario — el registro falló en algún
        // punto (backend, red, service worker). Reintentar no vuelve a
        // pedir el permiso nativo (ya está concedido), solo repite el
        // registro del token.
        return `
            <div class="card" style="max-width:420px;margin-top:16px">
                <div class="item"><span>Notificaciones push</span><button class="btn btn-secondary" id="btn-activar-push" style="width:auto">Reintentar</button></div>
                <p class="text-xs text-muted" style="margin-top:8px">Diste el permiso, pero el dispositivo no quedó registrado. Puede ser algo puntual — tocá "Reintentar".</p>
            </div>
        `;
    }
    return `
        <div class="card" style="max-width:420px;margin-top:16px">
            <div class="item"><span>Notificaciones push</span><button class="btn btn-secondary" id="btn-activar-push" style="width:auto">Activar</button></div>
            <p class="text-xs text-muted" style="margin-top:8px">Recibí avisos en el celular cuando haya algo nuevo en Coordinación Operativa o News, aunque no tengas la app abierta.</p>
        </div>
    `;
}

export async function Perfil() {

    const usuario = getUsuarioActual();

    return `
        ${Header("Mi perfil")}

        <div class="card" style="max-width:420px">
            <div class="list">
                <div class="item"><span>Nombre</span><strong>${usuario.nombre}</strong></div>
                <div class="item"><span>Email</span><strong>${usuario.email}</strong></div>
                <div class="item"><span>Rol</span><strong>${ROL_LEGIBLE[usuario.rol] || usuario.rol}${usuario.encargado ? " (Encargado)" : ""}${usuario.capacitador ? " (Capacitador)" : ""}</strong></div>
                ${usuario.sucursal ? `<div class="item"><span>Sucursal</span><strong>${usuario.sucursal}</strong></div>` : ""}
            </div>
        </div>

        ${await bloquePush(usuario)}
    `;
}

export function bindPerfil() {
    document.getElementById("btn-activar-push")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Activando...";
        const usuario = getUsuarioActual();
        const resultado = await activarPush(usuario);
        if (resultado.ok) {
            navigate("perfil");
            return;
        }
        btn.disabled = false;
        btn.textContent = "Activar";
        if (resultado.motivo === "denegado") alert("No diste el permiso de notificaciones — podés activarlo más tarde desde la configuración del navegador.");
        else alert("No se pudo activar. Probá de nuevo en un momento." + (resultado.detalle ? `\n\nDetalle: ${resultado.detalle}` : ""));
    });
}
