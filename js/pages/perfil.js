/* ============================
   FARO v4
   pages/perfil.js — Mi perfil (solo lectura por ahora)

   Sprint 9 le suma edición de datos y foto; acá alcanza con
   probar que la ruta y la entrada de menú ya existen para
   los 3 roles.
=============================*/

import { Header } from "../components/header.js";
import { getUsuarioActual } from "../services/auth.js";

const ROL_LEGIBLE = { admin: "Administrador", supervisor: "Supervisor", colaborador: "Colaborador" };

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
    `;
}
