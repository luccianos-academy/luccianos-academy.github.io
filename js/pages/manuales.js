/* ============================
   FARO v4
   pages/manuales.js — Manuales (PDFs)

   Repositorio de links a los manuales vigentes (Drive u otro link
   externo, no archivos subidos al proyecto — así se reemplazan sin
   deploy). Visible para Colaborador/Supervisor/Encargado en modo
   lectura; Admin suma un panel de gestión sobre la misma pantalla —
   mismo criterio dual que pages/noticias.js. Abierta a cualquier
   usuario autenticado (no tiene entrada en PERMISOS_PAGINA), la
   edición queda gateada acá adentro por rol.
=============================*/

import { Header } from "../components/header.js";
import { Modal, abrirModal, cerrarModal } from "../components/modal.js";
import { MultiSelectSucursales, bindMultiSelectSucursales } from "../components/multiSelectSucursales.js";
import { getManuales, crearManual, actualizarManual, eliminarManual, puedeVerManual } from "../data/manuales.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";

// "capacitador" no es un rol real (ver data/usuarios.js — es un
// Supervisor con otra etiqueta), pero necesita su propio checkbox acá
// para poder dirigir contenido solo a capacitadores sin que lo vea
// cualquier Supervisor — ver el chequeo extra en puedeVerManual.
const ROLES_COMPARTIR = [
    { id: "colaborador", label: "Colaborador" },
    { id: "supervisor",  label: "Supervisor" },
    { id: "capacitador", label: "Capacitador" },
    { id: "admin",       label: "Admin" },
];

function camposManualHtml(m = {}) {
    const rolesActuales = m.visiblePara ? m.visiblePara.split(",").map((r) => r.trim()) : [];
    const checkboxesHtml = ROLES_COMPARTIR.map((r) => `
        <label style="display:flex;align-items:center;gap:8px;font-weight:400;margin-top:0">
            <input type="checkbox" class="input-compartir-rol" value="${r.id}" style="width:auto;flex-shrink:0" ${rolesActuales.includes(r.id) ? "checked" : ""}>
            ${r.label}
        </label>
    `).join("");

    return `
        <label for="input-titulo">Título</label>
        <input type="text" id="input-titulo" placeholder="Ej: Manual de Cafetería" value="${m.titulo || ""}">

        <label for="input-categoria">Categoría (opcional)</label>
        <input type="text" id="input-categoria" placeholder="Ej: Cafetería, Atención al Cliente..." value="${m.categoria || ""}">

        <label for="input-url">Link (Drive u otro)</label>
        <input type="text" id="input-url" placeholder="https://drive.google.com/..." value="${m.url || ""}">

        <label>Compartir con <span style="color:red">*</span></label>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">${checkboxesHtml}</div>
        <p class="text-xs text-muted" style="margin-top:4px">Colaborador = lo ve toda la red. Supervisor/Admin = solo supervisión. O dejá los roles sin marcar y elegí locales abajo.</p>

        <label for="input-sucursal-manual">Locales específicos (opcional)</label>
        ${MultiSelectSucursales("input-sucursal-manual", m.sucursal ? m.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}
        <p class="text-xs text-muted" style="margin-top:4px">Si elegís locales, lo ve todo el personal de esos locales (no hace falta marcar rol). Hay que marcar al menos un rol o un local.</p>
    `;
}

function leerCamposManual() {
    const rolesElegidos = Array.from(document.querySelectorAll(".input-compartir-rol:checked")).map((c) => c.value);
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        categoria: document.getElementById("input-categoria").value.trim(),
        url: document.getElementById("input-url").value.trim(),
        visiblePara: rolesElegidos.join(","),
        sucursal: document.getElementById("input-sucursal-manual").value.trim(),
    };
}

export async function Manuales() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    // Admin ve todos los manuales igual (necesita administrarlos a
    // todos), con una etiqueta aparte marcando los restringidos; el
    // resto de los roles directamente no ve en la lista lo que no le
    // corresponde.
    const items = (await getManuales()).filter((m) => esAdmin || puedeVerManual(m, usuario));

    const itemsHtml = items.map((m) => `
        <div class="card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--tema-accent-soft, #f3e9d6);color:var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                ${Icon("reportes", { size: 18 })}
            </div>
            <div style="flex:1;min-width:180px">
                ${m.categoria ? `<div class="small text-muted">${m.categoria}</div>` : ""}
                <h3 style="margin-top:2px">${m.titulo}</h3>
                ${esAdmin && m.visiblePara && !m.visiblePara.includes("colaborador") ? `<span class="text-xs text-muted">Solo Supervisión</span>` : ""}
                ${esAdmin && m.sucursal ? `<span class="text-xs text-muted">Locales: ${m.sucursal.split(",").map((s) => s.trim().replace("Lucciano's ", "")).join(", ")}</span>` : ""}
            </div>
            <span style="display:flex;gap:8px;flex-shrink:0">
                <a class="btn btn-secondary" href="${m.url}">Ver manual</a>
                ${esAdmin ? `
                    <button class="btn btn-secondary" data-editar-manual="${m.id}">Editar</button>
                    <button class="btn btn-secondary" data-eliminar-manual="${m.id}">Eliminar</button>
                ` : ""}
            </span>
        </div>
    `).join("");

    return `
        ${Header("Manuales", "Los manuales vigentes de cada módulo, siempre a mano")}

        ${esAdmin ? `
            <div class="table-toolbar">
                <div></div>
                <button class="btn btn-primary" id="btn-nuevo-manual">+ Nuevo manual</button>
            </div>
        ` : ""}

        <div class="section" style="display:flex;flex-direction:column;gap:14px">
            ${itemsHtml || `<p class="text-sm text-muted">Todavía no hay manuales cargados.</p>`}
        </div>
    `;
}

export function bindManuales() {

    const usuario = getUsuarioActual();
    if (usuario.rol !== "admin") return;

    const btnNuevo = document.getElementById("btn-nuevo-manual");
    if (btnNuevo) btnNuevo.addEventListener("click", () => abrirModalManual());

    document.querySelectorAll("[data-editar-manual]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const items = await getManuales();
            const manual = items.find((m) => String(m.id) === String(btn.dataset.editarManual));
            if (manual) abrirModalManual(manual);
        });
    });

    document.querySelectorAll("[data-eliminar-manual]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            if (!confirm("¿Eliminar este manual?")) return;
            await eliminarManual(btn.dataset.eliminarManual);
            registrarEvento(usuario.id, "eliminar_manual", `Manual ${btn.dataset.eliminarManual} eliminado`);
            navigate("manuales");
        });
    });
}

function abrirModalManual(manual = null) {

    const modalId = "modal-manual";
    const contenidoHtml = camposManualHtml(manual || {});

    abrirModal(Modal({ id: modalId, titulo: manual ? `Editar: ${manual.titulo}` : "Nuevo manual", contenidoHtml, textoConfirmar: manual ? "Guardar" : "Crear" }), modalId, async () => {

        const cambios = leerCamposManual();
        if (!cambios.titulo || !cambios.url) {
            alert("Completá el título y el link del manual antes de guardar.");
            return;
        }
        // El link se renderiza directo como <a href> — sin https:// el
        // navegador lo trata como ruta relativa y da un 404 confuso.
        if (!/^https?:\/\//i.test(cambios.url)) {
            alert("El link tiene que empezar con https:// — copiá el link completo desde Drive.");
            return;
        }
        // Activo = tiene al menos un rol O al menos un local. Solo local
        // (sin rol) es válido: lo ve todo el personal de ese local.
        if (!cambios.visiblePara && !cambios.sucursal) {
            alert("Marcá al menos un Rol, o elegí un local — sin ninguno de los dos el manual queda inactivo y no lo ve nadie.");
            return;
        }

        const usuario = getUsuarioActual();
        if (manual) {
            await actualizarManual(manual.id, cambios);
            registrarEvento(usuario.id, "editar_manual", `Manual "${cambios.titulo}" editado`);
        } else {
            await crearManual(cambios);
            registrarEvento(usuario.id, "crear_manual", `Manual creado: ${cambios.titulo}`);
        }

        cerrarModal(modalId);
        navigate("manuales");
    });

    bindMultiSelectSucursales("input-sucursal-manual");
}
