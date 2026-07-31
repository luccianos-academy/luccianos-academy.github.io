/* ============================
   FARO v4
   pages/recursos.js — Recursos (accesos operativos externos)

   Reemplaza el Google Sites que armó el equipo de Operaciones a mano
   (un menú de links a Sheets/Drive: Auditorías, Claims, Ponderados de
   Google, Relevamientos, etc.) por una versión editable adentro de la
   app: Admin Y Supervisor agregan/renombran/borran accesos desde acá
   (mismo criterio que Canales — el Admin no tiene que ser el único
   que gestiona esto), sin depender de otra herramienta aparte ni de
   un cambio de código.

   "visiblePara" (data/recursos.js) es una lista de roles, no un solo
   valor fijo — hoy todos los recursos cargados son para Supervisión,
   pero la pantalla ya funciona igual para cualquier combinación de
   roles que se cargue a futuro (ver VISIBILIDAD_RECURSO_PRESETS).
=============================*/

import { Header } from "../components/header.js";
import { abrirModal } from "../components/modal.js";
import { Icon } from "../components/icons.js";
import { EmptyState } from "../components/emptyState.js";
import {
    getRecursosVisibles, crearRecurso, actualizarRecurso, eliminarRecurso,
    ICONOS_RECURSO, VISIBILIDAD_RECURSO_PRESETS,
} from "../data/recursos.js";
import { getUsuarioActual } from "../services/auth.js";
import { registrarEvento } from "../data/auditoria.js";
import { navigate } from "../router.js";

export async function Recursos() {
    const usuario = getUsuarioActual();
    const recursos = await getRecursosVisibles(usuario);
    // Mismo criterio que Canales (Coordinación Operativa): gestionar
    // no es exclusivo de Admin — cualquier Supervisor (incluido
    // Capacitador, que acá NO es de solo lectura, esa regla es
    // específica de Colaboradores) puede cargar/editar/borrar.
    const puedeGestionar = usuario.rol === "admin" || usuario.rol === "supervisor";

    // Sin target="_blank" a propósito — en la PWA instalada (iPhone)
    // eso saca a la persona de la app hacia Safari, sin forma fácil de
    // volver (mismo bug ya encontrado y sacado de Manuales/Noticias/
    // lecciones). Navegando en la misma ventana, el gesto de "volver"
    // (swipe desde el borde) sigue funcionando adentro de la PWA.
    const itemsHtml = recursos.map((r) => `
        <a class="canal-item" href="${r.url}" rel="noopener">
            <span class="canal-item-icono">${Icon(r.icono, { size: 20 })}</span>
            <span class="canal-item-body">
                <span class="canal-item-nombre">${r.nombre}</span>
                <span class="canal-item-detalle">Enlace externo</span>
            </span>
        </a>
    `).join("");

    return `
        ${Header("Recursos", "Accesos rápidos a herramientas operativas")}

        ${puedeGestionar ? `
            <div class="table-toolbar">
                <div></div>
                <button class="btn btn-secondary" id="btn-gestionar-recursos">Gestionar recursos</button>
            </div>
        ` : ""}

        <div class="section canal-lista">
            ${itemsHtml || EmptyState({ titulo: "Todavía no hay recursos cargados", detalle: "Ningún acceso operativo está disponible para tu rol por ahora.", icono: "integraciones" })}
        </div>
    `;
}

export function bindRecursos() {
    document.getElementById("btn-gestionar-recursos")?.addEventListener("click", () => abrirModalGestionarRecursos());
}

async function abrirModalGestionarRecursos() {
    const modalId = "modal-gestionar-recursos";
    const usuario = getUsuarioActual();

    async function contenidoActual() {
        const recursos = await getRecursosVisibles(usuario);
        return `
            <div class="canal-gestion-lista">
                ${recursos.map((r) => `
                    <div class="canal-gestion-item">
                        <div class="canal-gestion-fila-nombre">
                            <span class="canal-item-icono">${Icon(r.icono, { size: 16 })}</span>
                            <input type="text" class="input-recurso-nombre" data-recurso-id="${r.id}" value="${r.nombre}">
                        </div>
                        <input type="text" class="input-recurso-url" data-recurso-id="${r.id}" value="${r.url}" placeholder="https://...">
                        <div class="canal-gestion-fila-acciones">
                            <select class="input-recurso-visibilidad" data-recurso-id="${r.id}">
                                ${VISIBILIDAD_RECURSO_PRESETS.map((v) => `<option value="${v.id}"${v.id === r.visiblePara ? " selected" : ""}>${v.nombre}</option>`).join("")}
                            </select>
                            <button class="btn btn-secondary" data-guardar-recurso="${r.id}">Guardar</button>
                            <button class="btn btn-secondary" data-eliminar-recurso="${r.id}">Eliminar</button>
                        </div>
                    </div>
                `).join("")}
            </div>

            <label for="input-nuevo-recurso-nombre" style="margin-top:16px">Nuevo recurso</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <select id="input-nuevo-recurso-icono" style="flex:0 0 110px">
                    ${ICONOS_RECURSO.map((i) => `<option value="${i.id}">${i.nombre}</option>`).join("")}
                </select>
                <input type="text" id="input-nuevo-recurso-nombre" placeholder="Ej: Auditorías" style="flex:1 1 140px">
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                <input type="text" id="input-nuevo-recurso-url" placeholder="URL (Sheet, Drive, etc.)" style="flex:1 1 200px">
                <select id="input-nuevo-recurso-visibilidad" style="flex:0 0 200px">
                    ${VISIBILIDAD_RECURSO_PRESETS.map((v) => `<option value="${v.id}">${v.nombre}</option>`).join("")}
                </select>
                <button class="btn btn-primary" id="btn-crear-recurso" style="flex:0 0 auto">Crear</button>
            </div>
        `;
    }

    abrirModal(`
        <div class="modal-overlay" id="${modalId}">
            <div class="modal">
                <div class="modal-header">
                    <h2>Gestionar recursos</h2>
                    <button class="modal-close" data-close="${modalId}">✕</button>
                </div>
                <div class="modal-body" id="recursos-gestion-body">${await contenidoActual()}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-close="${modalId}">Cerrar</button>
                </div>
            </div>
        </div>
    `, modalId);

    async function reRender() {
        const body = document.getElementById("recursos-gestion-body");
        if (body) body.innerHTML = await contenidoActual();
        bindAcciones();
    }

    function bindAcciones() {
        document.querySelectorAll("[data-guardar-recurso]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.guardarRecurso;
                const nombre = document.querySelector(`.input-recurso-nombre[data-recurso-id="${id}"]`).value.trim();
                const url = document.querySelector(`.input-recurso-url[data-recurso-id="${id}"]`).value.trim();
                const visiblePara = document.querySelector(`.input-recurso-visibilidad[data-recurso-id="${id}"]`).value;
                if (!nombre || !url) return;
                await actualizarRecurso(id, { nombre, url, visiblePara });
                registrarEvento(usuario.id, "editar_recurso", `Recurso "${nombre}" actualizado`);
                await reRender();
            });
        });

        document.querySelectorAll("[data-eliminar-recurso]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!confirm("¿Eliminar este recurso?")) return;
                await eliminarRecurso(btn.dataset.eliminarRecurso);
                registrarEvento(usuario.id, "eliminar_recurso", `Recurso ${btn.dataset.eliminarRecurso} eliminado`);
                await reRender();
            });
        });

        document.getElementById("btn-crear-recurso")?.addEventListener("click", async () => {
            const nombre = document.getElementById("input-nuevo-recurso-nombre").value.trim();
            const url = document.getElementById("input-nuevo-recurso-url").value.trim();
            if (!nombre || !url) return;
            const icono = document.getElementById("input-nuevo-recurso-icono").value;
            const visiblePara = document.getElementById("input-nuevo-recurso-visibilidad").value;
            await crearRecurso({ nombre, url, icono, creadoPor: usuario.nombre, visiblePara });
            registrarEvento(usuario.id, "crear_recurso", `Recurso creado: ${nombre}`);
            await reRender();
        });
    }
    bindAcciones();

    document.getElementById(modalId)?.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => navigate("recursos"));
    });
}
