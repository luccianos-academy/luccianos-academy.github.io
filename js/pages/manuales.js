/* ============================
   Lucciano's Academy
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
import { getSucursales } from "../data/sucursales.js";
import { registrarEvento } from "../data/auditoria.js";
import { getUsuarioActual } from "../services/auth.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { escaparHtml } from "../services/html.js";
import { gasRequest } from "../services/google.js";

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

function filaArchivoHtml(a = { url: "", label: "" }) {
    return `
        <div class="archivo-manual-item">
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Link (Drive u otro)</label>
                <input type="text" class="input-archivo-url" placeholder="https://drive.google.com/..." value="${a.url || ""}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </div>
            <div>
                <label style="display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Etiqueta</label>
                <input type="text" class="input-archivo-label" placeholder="Ej: PDF para imprimir" value="${a.label || ""}" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
            </div>
            <button type="button" class="btn-eliminar-archivo-manual" style="padding:10px 12px;background:var(--danger-soft);border:1px solid var(--danger);border-radius:6px;color:var(--danger);cursor:pointer;font-size:16px;font-weight:bold">×</button>
        </div>
    `;
}

function camposManualHtml(m = {}, sucursales = []) {
    const rolesActuales = m.visiblePara ? m.visiblePara.split(",").map((r) => r.trim()) : [];
    // Países disponibles: salen de Sucursales.pais, no de una lista
    // fija — mismo criterio que ya usa News (pages/news.js). Argentina
    // primero y PRE-TILDADA en un manual NUEVO — pedido explícito del
    // usuario: "si pongo un manual, ¿la gente de otros países también
    // lo ve?" — antes sí, sin darse cuenta. Editando uno YA cargado se
    // respeta lo que tiene guardado (vacío incluido), no se le fuerza
    // Argentina de golpe.
    const paisesDisponibles = [...new Set(sucursales.map((s) => s.pais).filter(Boolean))]
        .sort((a, b) => a === "Argentina" ? -1 : b === "Argentina" ? 1 : a.localeCompare(b));
    const esManualNuevo = !m.id;
    const paisesElegidos = m.paisesA
        ? m.paisesA.split(",").map((p) => p.trim()).filter(Boolean)
        : (esManualNuevo ? ["Argentina"] : []);
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

        <label style="margin-top:0">Archivos <span class="mod-tooltip" data-tooltip-texto="Un mismo manual puede agrupar más de un archivo — ej. el PDF para imprimir y el Excel del mismo procedimiento para descargar.">ⓘ</span></label>
        <div id="lista-archivos-manual" style="display:flex;flex-direction:column;gap:14px;margin-bottom:14px">
            ${(m.archivos && m.archivos.length > 0 ? m.archivos : [{ url: "", label: "" }]).map((a) => filaArchivoHtml(a)).join("")}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <button type="button" id="btn-agregar-archivo-manual" class="btn btn-secondary" style="padding:12px;font-weight:600">+ Agregar otro link</button>
            <input type="file" id="input-archivo-manual" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.csv,.txt,.zip,.jpg,.jpeg,.png,.gif" style="display:none">
            <button type="button" id="btn-subir-archivo-manual" class="btn btn-secondary" style="padding:12px;font-weight:600">📤 Subir archivo</button>
        </div>
        <p class="text-xs text-muted" style="margin-top:4px">Subir archivo lo guarda en Drive y completa el link solo — pedido explícito: cargar a mano en Drive, compartirlo y copiar la URL era un trabajo extra que se puede evitar.</p>

        <label>Compartir con <span style="color:red">*</span></label>
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">${checkboxesHtml}</div>
        <p class="text-xs text-muted" style="margin-top:4px">Colaborador = lo ve toda la red. Supervisor/Admin = solo supervisión. O dejá los roles sin marcar y elegí locales abajo.</p>

        <label for="input-sucursal-manual">Locales específicos (opcional)</label>
        ${MultiSelectSucursales("input-sucursal-manual", m.sucursal ? m.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}
        <p class="text-xs text-muted" style="margin-top:4px">Si elegís locales, lo ve todo el personal de esos locales (no hace falta marcar rol). Hay que marcar al menos un rol o un local.</p>

        <label style="margin-top:16px">Países <span class="mod-tooltip" data-tooltip-texto="Argentina viene tildada por ser el país operativo. Sumá otros países si el manual también es para ellos, o destildá todos para que no acote por país (queda solo el Rol/Local de arriba).">ⓘ</span></label>
        <div class="galeria-pills" id="pills-paises-manual">
            ${paisesDisponibles.map((p) => `<button type="button" class="pill-categoria${paisesElegidos.includes(p) ? " activa" : ""}" data-pill-pais="${escaparHtml(p)}">${escaparHtml(p)}</button>`).join("")}
        </div>
        <p class="text-xs text-muted" style="margin-top:4px">Sin ningún país tildado, el manual no se acota por país — se rige solo por Rol/Local.</p>
    `;
}

// Vistazo rápido para el Admin de a quién está habilitado cada
// manual — antes solo decía "Solo Supervisión" sin aclarar a cuáles
// roles exactos, obligando a entrar a Editar para confirmarlo.
function chipsVisibilidadHtml(m) {
    const roles = m.visiblePara ? m.visiblePara.split(",").map((r) => r.trim()).filter(Boolean) : [];
    const chipsRoles = roles.map((id) => {
        const r = ROLES_COMPARTIR.find((rc) => rc.id === id);
        return r ? `<span class="badge badge-success">${r.label}</span>` : "";
    }).join("");

    const locales = m.sucursal ? m.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const chipLocales = locales.length
        ? `<span class="badge badge-muted">${locales.length} local${locales.length > 1 ? "es" : ""}</span>`
        : "";

    const paises = m.paisesA ? m.paisesA.split(",").map((p) => p.trim()).filter(Boolean) : [];
    const chipPaises = paises.length
        ? `<span class="badge badge-info" title="${escaparHtml(paises.join(", "))}">${paises.length === 1 ? paises[0] : `${paises.length} países`}</span>`
        : "";

    return chipsRoles + chipLocales + chipPaises;
}

function leerCamposManual() {
    const rolesElegidos = Array.from(document.querySelectorAll(".input-compartir-rol:checked")).map((c) => c.value);
    const archivos = [];
    document.querySelectorAll(".archivo-manual-item").forEach((item, i) => {
        const url = item.querySelector(".input-archivo-url")?.value.trim() || "";
        // Etiqueta vacía con un solo archivo: "Ver manual", igual que
        // siempre. Con más de uno hace falta distinguirlos — sin
        // etiqueta un segundo archivo sin nombre confunde más de lo
        // que ayuda, así que se numera en vez de repetir "Ver manual".
        const label = item.querySelector(".input-archivo-label")?.value.trim() || (i === 0 ? "Ver manual" : `Archivo ${i + 1}`);
        if (url) archivos.push({ url, label });
    });
    const paisesElegidos = [...document.querySelectorAll("#pills-paises-manual .pill-categoria.activa")].map((p) => p.dataset.pillPais);
    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        categoria: document.getElementById("input-categoria").value.trim(),
        archivos,
        visiblePara: rolesElegidos.join(","),
        sucursal: document.getElementById("input-sucursal-manual").value.trim(),
        paisesA: paisesElegidos.join(","),
    };
}

export async function Manuales() {

    const usuario = getUsuarioActual();
    const esAdmin = usuario.rol === "admin";
    // Admin ve todos los manuales igual (necesita administrarlos a
    // todos), con una etiqueta aparte marcando los restringidos; el
    // resto de los roles directamente no ve en la lista lo que no le
    // corresponde.
    const sucursales = esAdmin ? [] : await getSucursales();
    const items = (await getManuales()).filter((m) => esAdmin || puedeVerManual(m, usuario, sucursales));

    const itemsHtml = items.map((m) => `
        <div class="card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--tema-accent-soft, #f3e9d6);color:var(--gold);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                ${Icon("reportes", { size: 18 })}
            </div>
            <div style="flex:1;min-width:180px">
                ${m.categoria ? `<div class="small text-muted">${m.categoria}</div>` : ""}
                <h3 style="margin-top:2px">${m.titulo}</h3>
                ${esAdmin ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${chipsVisibilidadHtml(m)}</div>` : ""}
            </div>
            <span class="manual-item-acciones" style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
                <!-- Sin target="_blank" a propósito — en la PWA instalada
                     (iPhone) eso saca a la persona hacia Safari sin forma
                     fácil de volver (mismo bug ya sacado del resto de
                     Manuales/Noticias/Recursos). -->
                ${(m.archivos || []).map((a) => `<a class="btn btn-secondary" href="${a.url}">${a.label || "Ver manual"}</a>`).join("")}
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
            if (manual) await abrirModalManual(manual);
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

async function abrirModalManual(manual = null) {

    const modalId = "modal-manual";
    const sucursales = await getSucursales();
    const contenidoHtml = camposManualHtml(manual || {}, sucursales);

    abrirModal(Modal({ id: modalId, titulo: manual ? `Editar: ${manual.titulo}` : "Nuevo manual", contenidoHtml, textoConfirmar: manual ? "Guardar" : "Crear" }), modalId, async () => {

        const cambios = leerCamposManual();
        if (!cambios.titulo || !cambios.archivos.length) {
            alert("Completá el título y al menos un link antes de guardar.");
            return;
        }
        // Los links se renderizan directo como <a href> — sin https:// el
        // navegador los trata como ruta relativa y da un 404 confuso.
        const linkInvalido = cambios.archivos.find((a) => !/^https?:\/\//i.test(a.url));
        if (linkInvalido) {
            alert(`"${linkInvalido.url}" tiene que empezar con https:// — copiá el link completo desde Drive.`);
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

    // Pills de país — multi-select (cada click suma o saca), mismo
    // patrón que News.
    document.querySelectorAll("#pills-paises-manual [data-pill-pais]").forEach((pill) => {
        pill.addEventListener("click", () => pill.classList.toggle("activa"));
    });

    const listaArchivos = document.getElementById("lista-archivos-manual");
    function wireEliminarArchivo() {
        listaArchivos.querySelectorAll(".btn-eliminar-archivo-manual").forEach((btn) => {
            btn.onclick = () => {
                // Nunca menos de una fila — sin ninguna, no hay dónde
                // tipear el primer link y el formulario queda mudo.
                if (listaArchivos.querySelectorAll(".archivo-manual-item").length > 1) {
                    btn.closest(".archivo-manual-item")?.remove();
                }
            };
        });
    }
    wireEliminarArchivo();

    document.getElementById("btn-agregar-archivo-manual")?.addEventListener("click", () => {
        listaArchivos.insertAdjacentHTML("beforeend", filaArchivoHtml());
        wireEliminarArchivo();
    });

    // Subir un archivo directo a Drive en vez de tener que cargarlo a
    // mano, compartirlo y copiar la URL — mismo mecanismo que ya usa
    // News (subirArchivo en el backend, genérico, no hace falta
    // tocar nada del lado del servidor). Pedido explícito del usuario:
    // "es un laburito que se puede evitar".
    const inputArchivo = document.getElementById("input-archivo-manual");
    const btnSubirArchivo = document.getElementById("btn-subir-archivo-manual");
    btnSubirArchivo?.addEventListener("click", () => inputArchivo?.click());

    inputArchivo?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const textoOriginal = btnSubirArchivo.textContent;
        btnSubirArchivo.disabled = true;
        btnSubirArchivo.textContent = "Subiendo...";

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
                reader.readAsDataURL(file);
            });

            const resultado = await gasRequest("subirArchivo", {
                nombreArchivo: file.name,
                extension: file.name.split(".").pop() || "bin",
                archivoBase64: base64,
            });

            if (!resultado || !resultado.ok) {
                throw new Error(resultado?.error || "No se pudo subir el archivo.");
            }

            listaArchivos.insertAdjacentHTML("beforeend", filaArchivoHtml({ url: resultado.url, label: file.name }));
            wireEliminarArchivo();
        } catch (err) {
            alert(err.message || "No se pudo subir el archivo.");
        } finally {
            inputArchivo.value = "";
            btnSubirArchivo.disabled = false;
            btnSubirArchivo.textContent = textoOriginal;
        }
    });
}
