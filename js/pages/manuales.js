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

// paisesA guarda países sueltos ("Argentina") o país + tipo de local
// ("Argentina:Propios") — ver data/manuales.js → puedeVerManual. En la
// pantalla se edita como pastillas de país + UNA pastilla de tipo que
// vale para todos los países elegidos.
function leerPaisesA(valor) {
    const tokens = String(valor || "").split(",").map((t) => t.trim()).filter(Boolean);
    const paises = [];
    let tipo = "todos";
    tokens.forEach((t) => {
        const m = t.match(/^(.+):(propios|franquicias)$/i);
        if (m) { paises.push(m[1].trim()); tipo = m[2].toLowerCase(); } else paises.push(t);
    });
    return { paises, tipo };
}

function escribirPaisesA(paises, tipo) {
    return paises.map((p) => (tipo === "propios" ? `${p}:Propios` : tipo === "franquicias" ? `${p}:Franquicias` : p)).join(",");
}

const TIPOS_LOCAL_MANUAL = [
    { valor: "todos", etiqueta: "Todos los locales" },
    { valor: "propios", etiqueta: "Solo propios" },
    { valor: "franquicias", etiqueta: "Solo franquicias" },
];

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
        <div class="fs-archivo">
            <span class="fs-archivo-ico">${Icon("documento", { size: 18 })}</span>
            <div class="fs-archivo-campos">
                <input type="text" class="input-archivo-label fs-in-label" placeholder="Nombre del botón — ej. PDF para imprimir" value="${escaparHtml(a.label || "")}" aria-label="Nombre del botón">
                <input type="text" class="input-archivo-url fs-in-url" placeholder="https://drive.google.com/..." value="${escaparHtml(a.url || "")}" aria-label="Link del archivo">
            </div>
            <button type="button" class="fs-x btn-eliminar-archivo-manual" aria-label="Quitar archivo">×</button>
        </div>
    `;
}

const ALCANCES_MANUAL = [
    { valor: "red", etiqueta: "Toda la red" },
    { valor: "pais", etiqueta: "Por país y tipo de local" },
    { valor: "loc", etiqueta: "Locales puntuales" },
];

/** Manual nuevo: por país (Argentina). Uno ya cargado: lo que tiene —
 *  locales primero, después país, y si no tiene nada, toda la red. */
function alcanceInicialManual(m) {
    if (!m.id) return "pais";
    if (m.sucursal) return "loc";
    return leerPaisesA(m.paisesA).paises.length ? "pais" : "red";
}

// El formulario se organiza en tres bloques —qué es, archivos, quién
// lo ve— y reemplaza al panel largo anterior, donde roles, locales,
// países y tipo de local aparecían todos juntos y había que deducir el
// resultado mirando los cuatro. Ahora el alcance es UNA elección
// (toda la red / país y tipo / locales puntuales) y un resumen en vivo
// dice en una frase quién lo va a ver.
function camposManualHtml(m = {}, sucursales = [], categoriasUsadas = []) {
    const rolesActuales = m.visiblePara ? m.visiblePara.split(",").map((r) => r.trim()) : [];
    // Países disponibles: salen de Sucursales.pais, no de una lista
    // fija — mismo criterio que ya usa News (pages/news.js). Argentina
    // primero y PRE-TILDADA en un manual NUEVO. Editando uno YA cargado
    // se respeta lo que tiene guardado, no se le fuerza Argentina.
    const paisesDisponibles = [...new Set(sucursales.map((s) => s.pais).filter(Boolean))]
        .sort((a, b) => a === "Argentina" ? -1 : b === "Argentina" ? 1 : a.localeCompare(b));
    const esManualNuevo = !m.id;
    const { paises: paisesGuardados, tipo: tipoLocalActual } = leerPaisesA(m.paisesA);
    const paisesElegidos = paisesGuardados.length
        ? paisesGuardados
        : (esManualNuevo ? ["Argentina"] : []);
    // Un manual nuevo arranca visible para quienes lo reciben casi
    // siempre; uno ya cargado muestra lo que tiene.
    const rolesElegidos = esManualNuevo ? ["colaborador", "supervisor", "capacitador"] : rolesActuales;
    const alcanceInicial = alcanceInicialManual(m);

    const pillsRoles = ROLES_COMPARTIR.map((r) => `
        <button type="button" class="fs-pill${rolesElegidos.includes(r.id) ? " activa" : ""}" data-rol="${r.id}">${r.label}</button>
    `).join("");

    return `
        <div class="fs-bloque">
            <div class="fs-bloque-titulo">${Icon("documento", { size: 16 })}<b>Qué es</b></div>
            <div class="fs-fila-2">
                <div>
                    <label for="input-titulo">Título</label>
                    <input type="text" id="input-titulo" placeholder="Ej: Manual de Cafetería" value="${escaparHtml(m.titulo || "")}">
                </div>
                <div>
                    <label for="input-categoria">Categoría (opcional)</label>
                    <input type="text" id="input-categoria" placeholder="Ej: Cafetería" value="${escaparHtml(m.categoria || "")}">
                </div>
            </div>
            ${categoriasUsadas.length ? `
                <div class="fs-pills fs-pills-chicas" id="pills-categorias-manual">
                    <span class="fs-ayuda">Usadas:</span>
                    ${categoriasUsadas.map((c) => `<button type="button" class="fs-pill fs-pill-chica${c === m.categoria ? " activa" : ""}" data-pill-categoria="${escaparHtml(c)}">${escaparHtml(c)}</button>`).join("")}
                </div>
            ` : ""}
        </div>

        <div class="fs-bloque">
            <div class="fs-bloque-titulo">${Icon("enlace", { size: 16 })}<b>Archivos</b><span>Podés sumar más de uno</span></div>
            <div id="lista-archivos-manual" class="fs-archivos">
                ${(m.archivos || []).map((a) => filaArchivoHtml(a)).join("")}
            </div>
            <input type="file" id="input-archivo-manual" accept=".pdf,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.csv,.txt,.zip,.jpg,.jpeg,.png,.gif" style="display:none">
            <button type="button" id="btn-subir-archivo-manual" class="fs-drop">
                ${Icon("subir", { size: 22 })}
                <span><span class="fs-drop-titulo">Subir archivo</span><small>PDF, Excel, Word o imágenes. Se guarda en Drive solo.</small></span>
            </button>
            <button type="button" id="btn-agregar-archivo-manual" class="fs-link">o pegar un link de Drive</button>
        </div>

        <div class="fs-bloque">
            <div class="fs-bloque-titulo">${Icon("usuarios", { size: 16 })}<b>Quién lo ve</b></div>
            <label style="margin-top:0">Roles</label>
            <div class="fs-pills" id="pills-roles-manual">${pillsRoles}</div>

            <label style="margin-top:16px">Alcance</label>
            <div class="fs-seg fs-seg-apilar" id="seg-alcance-manual">
                ${ALCANCES_MANUAL.map((a) => `<button type="button" class="fs-seg-btn${alcanceInicial === a.valor ? " activa" : ""}" data-alcance="${a.valor}">${a.etiqueta}</button>`).join("")}
            </div>

            <div id="panel-alcance-pais" class="fs-panel" ${alcanceInicial === "pais" ? "" : "hidden"}>
                <div class="fs-pills" id="pills-paises-manual">
                    ${paisesDisponibles.map((p) => `<button type="button" class="fs-pill${paisesElegidos.includes(p) ? " activa" : ""}" data-pill-pais="${escaparHtml(p)}">${escaparHtml(p)}</button>`).join("")}
                </div>
                <div class="fs-seg fs-seg-tipo fs-seg-apilar" id="pills-tipo-manual">
                    ${TIPOS_LOCAL_MANUAL.map((t) => `<button type="button" class="fs-seg-btn${tipoLocalActual === t.valor ? " activa" : ""}" data-pill-tipo-local="${t.valor}">${t.etiqueta}</button>`).join("")}
                </div>
                <p class="fs-ayuda">Sin ningún país tildado no se acota por país.</p>
            </div>

            <div id="panel-alcance-loc" class="fs-panel" ${alcanceInicial === "loc" ? "" : "hidden"}>
                ${MultiSelectSucursales("input-sucursal-manual", m.sucursal ? m.sucursal.split(",").map((s) => s.trim()).filter(Boolean) : [])}
            </div>

            <p class="fs-ayuda" style="margin-top:10px">El alcance acota a los colaboradores. Supervisor y Admin ven el manual completo.</p>

            <div class="fs-resumen" role="status">
                ${Icon("perfil", { size: 18 })}
                <div><b>Lo van a ver:</b> <span id="resumen-manual"></span></div>
            </div>
        </div>
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

    const { paises, tipo } = leerPaisesA(m.paisesA);
    const sufijoTipo = tipo === "propios" ? " · solo propios" : tipo === "franquicias" ? " · solo franquicias" : "";
    const chipPaises = paises.length
        ? `<span class="badge badge-info" title="${escaparHtml(paises.join(", ") + sufijoTipo)}">${(paises.length === 1 ? paises[0] : `${paises.length} países`) + sufijoTipo}</span>`
        : "";

    return chipsRoles + chipLocales + chipPaises;
}

/** `estado` lo comparten el formulario y su binding: { alcance,
 *  alcanceCambiado }. Si el manual ya tenía país Y local a la vez (el
 *  formulario anterior lo permitía) y no se toca el alcance, se
 *  conservan los dos tal cual — no se pierde nada en silencio. */
function leerCamposManual(manual, estado) {
    const rolesElegidos = Array.from(document.querySelectorAll("#pills-roles-manual .fs-pill.activa")).map((c) => c.dataset.rol);
    const archivos = [];
    document.querySelectorAll(".fs-archivo").forEach((item, i) => {
        const url = item.querySelector(".input-archivo-url")?.value.trim() || "";
        // Etiqueta vacía con un solo archivo: "Ver manual", igual que
        // siempre. Con más de uno hace falta distinguirlos — sin
        // etiqueta un segundo archivo sin nombre confunde más de lo
        // que ayuda, así que se numera en vez de repetir "Ver manual".
        const label = item.querySelector(".input-archivo-label")?.value.trim() || (i === 0 ? "Ver manual" : `Archivo ${i + 1}`);
        if (url) archivos.push({ url, label });
    });
    const paisesElegidos = [...document.querySelectorAll("#pills-paises-manual .fs-pill.activa")].map((p) => p.dataset.pillPais);
    const tipoLocal = document.querySelector("#pills-tipo-manual .fs-seg-btn.activa")?.dataset.pillTipoLocal || "todos";

    const teniaAmbos = !!(manual?.sucursal && leerPaisesA(manual?.paisesA).paises.length);
    const conservar = teniaAmbos && !estado.alcanceCambiado;
    let sucursal = "";
    let paisesA = "";
    if (conservar) {
        sucursal = manual.sucursal;
        paisesA = manual.paisesA;
    } else if (estado.alcance === "loc") {
        sucursal = document.getElementById("input-sucursal-manual").value.trim();
    } else if (estado.alcance === "pais") {
        paisesA = escribirPaisesA(paisesElegidos, tipoLocal);
    }

    return {
        titulo: document.getElementById("input-titulo").value.trim(),
        categoria: document.getElementById("input-categoria").value.trim(),
        archivos,
        visiblePara: rolesElegidos.join(","),
        sucursal,
        paisesA,
    };
}

const ROLES_PLURAL = { colaborador: "Colaboradores", supervisor: "Supervisores", capacitador: "Capacitadores", admin: "Admin" };

/** La frase de "Lo van a ver:" — se recalcula con cada cambio. */
function actualizarResumenManual(estado) {
    const destino = document.getElementById("resumen-manual");
    if (!destino) return;
    const roles = [...document.querySelectorAll("#pills-roles-manual .fs-pill.activa")].map((b) => ROLES_PLURAL[b.dataset.rol] || b.dataset.rol);
    const locales = (document.getElementById("input-sucursal-manual")?.value || "").split(",").map((l) => l.trim()).filter(Boolean);

    let alcance = "toda la red";
    if (estado.alcance === "pais") {
        const paises = [...document.querySelectorAll("#pills-paises-manual .fs-pill.activa")].map((b) => b.dataset.pillPais);
        const tipo = document.querySelector("#pills-tipo-manual .fs-seg-btn.activa")?.dataset.pillTipoLocal || "todos";
        const sufijo = tipo === "propios" ? "solo locales propios" : tipo === "franquicias" ? "solo franquicias" : "todos los locales";
        alcance = `${paises.length ? paises.join(", ") : "todos los países"} · ${sufijo}`;
    } else if (estado.alcance === "loc") {
        alcance = locales.length ? (locales.length === 1 ? "1 local elegido" : `${locales.length} locales elegidos`) : "ningún local elegido todavía";
    }

    if (!roles.length) {
        destino.textContent = estado.alcance === "loc" && locales.length
            ? `todo el personal de ${locales.length === 1 ? "ese local" : `esos ${locales.length} locales`}`
            : "nadie todavía — marcá al menos un rol";
        return;
    }
    destino.textContent = `${roles.join(", ")} — ${alcance}`;
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
    const [sucursales, todosLosManuales] = await Promise.all([getSucursales(), getManuales()]);
    // Las categorías que ya existen, para elegirlas de un toque en vez
    // de volver a escribirlas (y escribirlas distinto cada vez).
    const categoriasUsadas = [...new Set(todosLosManuales.map((x) => String(x.categoria || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const contenidoHtml = camposManualHtml(manual || {}, sucursales, categoriasUsadas);

    const estado = { alcance: alcanceInicialManual(manual || {}), alcanceCambiado: false };

    abrirModal(Modal({ id: modalId, titulo: manual ? `Editar: ${manual.titulo}` : "Nuevo manual", contenidoHtml, textoConfirmar: manual ? "Guardar manual" : "Crear manual", claseExtra: "modal-suave" }), modalId, async () => {

        const cambios = leerCamposManual(manual, estado);
        if (!cambios.titulo || !cambios.archivos.length) {
            alert("Completá el título y al menos un archivo o link antes de guardar.");
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
            alert("Marcá al menos un rol, o elegí un local — sin ninguno de los dos el manual queda inactivo y no lo ve nadie.");
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

    const refrescarResumen = () => actualizarResumenManual(estado);

    bindMultiSelectSucursales("input-sucursal-manual");
    document.getElementById("input-sucursal-manual")?.addEventListener("change", refrescarResumen);

    // Categorías usadas: un toque la copia al campo.
    document.querySelectorAll("#pills-categorias-manual [data-pill-categoria]").forEach((pill) => {
        pill.addEventListener("click", () => {
            document.getElementById("input-categoria").value = pill.dataset.pillCategoria;
            document.querySelectorAll("#pills-categorias-manual [data-pill-categoria]").forEach((p) => p.classList.toggle("activa", p === pill));
        });
    });
    document.getElementById("input-categoria")?.addEventListener("input", (e) => {
        document.querySelectorAll("#pills-categorias-manual [data-pill-categoria]").forEach((p) => p.classList.toggle("activa", p.dataset.pillCategoria === e.target.value.trim()));
    });

    // Roles y países: multi-select (cada click suma o saca).
    document.querySelectorAll("#pills-roles-manual .fs-pill, #pills-paises-manual .fs-pill").forEach((pill) => {
        pill.addEventListener("click", () => { pill.classList.toggle("activa"); refrescarResumen(); });
    });

    // Alcance: una sola opción; muestra el panel que corresponde.
    document.querySelectorAll("#seg-alcance-manual [data-alcance]").forEach((btn) => {
        btn.addEventListener("click", () => {
            estado.alcance = btn.dataset.alcance;
            estado.alcanceCambiado = true;
            document.querySelectorAll("#seg-alcance-manual [data-alcance]").forEach((b) => b.classList.toggle("activa", b === btn));
            document.getElementById("panel-alcance-pais").hidden = estado.alcance !== "pais";
            document.getElementById("panel-alcance-loc").hidden = estado.alcance !== "loc";
            refrescarResumen();
        });
    });

    // Tipo de local — una sola opción a la vez.
    document.querySelectorAll("#pills-tipo-manual [data-pill-tipo-local]").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#pills-tipo-manual [data-pill-tipo-local]").forEach((b) => b.classList.toggle("activa", b === btn));
            refrescarResumen();
        });
    });
    refrescarResumen();

    const listaArchivos = document.getElementById("lista-archivos-manual");
    function wireEliminarArchivo() {
        listaArchivos.querySelectorAll(".btn-eliminar-archivo-manual").forEach((btn) => {
            btn.onclick = () => btn.closest(".fs-archivo")?.remove();
        });
    }
    wireEliminarArchivo();

    document.getElementById("btn-agregar-archivo-manual")?.addEventListener("click", () => {
        listaArchivos.insertAdjacentHTML("beforeend", filaArchivoHtml());
        wireEliminarArchivo();
        listaArchivos.lastElementChild?.querySelector(".input-archivo-url")?.focus();
    });

    // Subir un archivo directo a Drive en vez de tener que cargarlo a
    // mano, compartirlo y copiar la URL — mismo mecanismo que ya usa
    // News (subirArchivo en el backend, genérico, no hace falta
    // tocar nada del lado del servidor). Pedido explícito del usuario:
    // "es un laburito que se puede evitar".
    const inputArchivo = document.getElementById("input-archivo-manual");
    const btnSubirArchivo = document.getElementById("btn-subir-archivo-manual");
    const tituloSubir = btnSubirArchivo?.querySelector(".fs-drop-titulo");
    btnSubirArchivo?.addEventListener("click", () => inputArchivo?.click());

    inputArchivo?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const textoOriginal = tituloSubir.textContent;
        btnSubirArchivo.disabled = true;
        tituloSubir.textContent = "Subiendo...";

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
            tituloSubir.textContent = textoOriginal;
        }
    });
}
