/* ============================
   Lucciano's Academy
   sidebar.js

   Los links son <a href="#/..."> reales (no botones + JS): así el
   navegador da gratis click-derecho / "abrir en pestaña nueva" /
   ctrl-click, y el propio cambio de hash dispara el router.
=============================*/

import { MODULOS, EMPRESA } from "../config.js";
import { getUsuarioActual, MENU_POR_ROL } from "../services/auth.js";
import { Icon } from "./icons.js";
import { obtenerMiUsuario, etiquetaColaborador } from "../data/usuarios.js";
import { InstallBanner } from "./installBanner.js";
import { CampanaBoton, AvatarHeaderBoton } from "./topbar.js";

const DIAS_AVISO_VENCIMIENTO_ACCESO = 7;

// Sidebar() es síncrona (se llama en cada navegación, antes de que
// la página nueva termine de cargar — ver ui.js/router.js), pero el
// propio usuario vive en la Sheet, o sea que leerlo es async. En vez
// de frenar TODO el layout esperando ese fetch, se cachea acá y se
// parcha el sidebar YA DIBUJADO en cuanto resuelve (sin esperar a
// que el usuario navegue para que Sidebar() se vuelva a llamar con
// la cache ya lista) — un bug real reportado antes ("no está visible
// hasta que presiono cualquier botón").
let miUsuarioCache = null;
let miUsuarioIdPedido = null;

// Todavía no hay sesión la primera vez que este archivo se carga (el
// bundle se importa desde la propia pantalla de login, antes de
// cualquier login real) — si se pidiera acá arriba, getUsuarioActual()
// daría null y esto nunca se dispararía para la sesión que arranca
// después. Por eso se dispara recién la primera vez que Sidebar() se
// llama con un Colaborador logueado (ver más abajo). Comparar por id
// (no una bandera fija) también cubre "Ver como"/logout+login de otro
// Colaborador en la misma sesión del navegador, sin quedarse con la
// cache vieja.
function asegurarMiUsuarioCache(usuario) {
    if (usuario.rol !== "colaborador") return;
    if (String(miUsuarioIdPedido) === String(usuario.id)) return;
    miUsuarioIdPedido = usuario.id;
    obtenerMiUsuario(usuario).then((u) => {
        miUsuarioCache = u;
        actualizarAvisosEnDOM();
    });
}

/** Aviso no invasivo (mismo lenguaje visual que usaba antes el "NEW"
 *  de Noticias, ahora en la campana — ver components/topbar.js) de
 *  que el acceso de prueba propio vence pronto —
 *  ver también el badge por fila en pages/colaboradores.js, que es la
 *  misma idea pero para quien GESTIONA colaboradores, no para uno
 *  mismo. */
function accesoPropioVencePronto() {
    if (!miUsuarioCache || !miUsuarioCache.fechaVencimientoAcceso) return false;
    const hoy = new Date();
    const vencimiento = new Date(miUsuarioCache.fechaVencimientoAcceso);
    const dias = (vencimiento - hoy) / 86400000;
    return dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO_ACCESO;
}

/** Vuelve a calcular y pinta los avisos sobre el sidebar YA
 *  presente en el DOM (si hay uno) — se llama apenas resuelve cada
 *  fetch, en vez de esperar a que el usuario navegue para que
 *  Sidebar() se vuelva a invocar con la cache ya lista. */
function actualizarAvisosEnDOM() {
    const nav = document.querySelector(".nav-menu");
    if (!nav) return; // todavía no se montó ningún layout con sidebar

    const linkInicio = nav.querySelector(`a[href="#/inicio"]`);
    if (linkInicio) marcarAviso(linkInicio, accesoPropioVencePronto(), "VENCE");
}

function marcarAviso(link, activo, textoBadge) {
    link.classList.toggle("menu-brillo", activo);
    const existente = link.querySelector(".badge-new");
    if (activo && !existente) {
        link.insertAdjacentHTML("beforeend", `<span class="badge-new">${textoBadge}</span>`);
    } else if (!activo && existente) {
        existente.remove();
    }
}

export function Sidebar(rutaActiva = "inicio") {

    const usuario = getUsuarioActual();
    const esEncargado = usuario.rol === "colaborador" && usuario.encargado;

    asegurarMiUsuarioCache(usuario);

    // Encargado suma "Mi local" (misma pantalla que usa el Supervisor,
    // acotada a su propia sucursal — incluye el Semáforo de desempeño
    // arriba de la tabla de gestión, ver pages/colaboradores.js) sin
    // agregar un 4to nivel a MENU_POR_ROL — ver services/auth.js. Se
    // inserta antes de "perfil" (no al final) para que "Mi perfil"
    // siga siendo siempre el último ítem del menú. Comunicaciones NO
    // se suma acá — es exclusivamente Admin/Supervisor, pedido
    // explícito del usuario (revertido tras un pase anterior que lo
    // había sumado por error).
    const idsDelMenu = [...(MENU_POR_ROL[usuario.rol] || ["inicio"])];
    if (esEncargado) {
        const posPerfil = idsDelMenu.indexOf("perfil");
        idsDelMenu.splice(posPerfil === -1 ? idsDelMenu.length : posPerfil, 0, "colaboradores");
    }

    // { activo, texto } por id de módulo — misma fuente que usa
    // actualizarAvisosEnDOM() para parchar un sidebar ya dibujado, así
    // ambos caminos (este render y el parche async) siempre coinciden.
    const avisosPorId = {
        inicio: { activo: accesoPropioVencePronto(), texto: "VENCE" },
    };

    // El orden del menú es el de idsDelMenu (o sea, MENU_POR_ROL) —
    // NO el orden en que aparecen las entradas en MODULOS. MODULOS es
    // el catálogo (qué existe, ícono, nombre); el orden por rol vive
    // en MENU_POR_ROL, así cada rol puede tener su propia prioridad
    // sin pisar la de los demás (ver services/auth.js).
    const links = MODULOS
        .filter((m) => idsDelMenu.includes(m.id))
        .sort((a, b) => idsDelMenu.indexOf(a.id) - idsDelMenu.indexOf(b.id))
        .map((m) => {
            const nombre = m.id === "colaboradores"
                ? (esEncargado ? "Mi local" : usuario.rol === "admin" ? "Colaboradores" : m.nombre)
                : m.nombre;
            const aviso = avisosPorId[m.id];
            const conAviso = aviso?.activo;
            return `
                <a class="menu${m.id === rutaActiva ? " active" : ""}${conAviso ? " menu-brillo" : ""}" href="#/${m.id}">
                    ${Icon(m.icono)} <span>${nombre}</span>
                    ${conAviso ? `<span class="badge-new">${aviso.texto}</span>` : ""}
                </a>
            `;
        })
        .join("");

    // Capacitador es Supervisor con otra etiqueta (mismo permiso, ver
    // data/usuarios.js) — mismo criterio que Encargado sobre Colaborador:
    // el sistema lo trata como supervisor, pero necesita verse a sí
    // mismo identificado como capacitador, no solo el admin desde la
    // lista de Colaboradores.
    const rolLegible = {
        admin: "Administrador",
        supervisor: usuario.capacitador ? "Capacitador" : "Supervisor",
        colaborador: etiquetaColaborador(usuario),
    }[usuario.rol] || usuario.rol;

    return `
        <aside class="sidebar">

            <button class="sidebar-cerrar" id="btn-cerrar-sidebar" aria-label="Cerrar menú">${Icon("cerrar", { size: 20 })}</button>

            <div class="logo logo-con-campana">
                <span>${EMPRESA.logoUrl ? `<img src="${EMPRESA.logoUrl}" alt="${EMPRESA.nombre}">` : EMPRESA.logo}</span>
                ${CampanaBoton("sidebar")}
            </div>

            <nav class="nav-menu">
                ${links}
            </nav>

            ${InstallBanner()}

            <!-- Aviso de versión en desarrollo. Va atado al ROL y no al
                 entorno: la cuenta de revisión se usa en producción, donde
                 ES_STAGING es falso y el badge de "PRUEBA" no aparece —
                 justo cuando más hace falta el aviso. Un capacitador es
                 quien entra a mirar sin gestionar, o sea exactamente
                 quien necesita saber que puede encontrar cosas a medio
                 hacer. No se puede cerrar: si se olvida, el aviso deja de
                 cumplir su función. -->
            ${usuario.capacitador ? `
                <div class="sidebar-beta">
                    <strong>Versión en desarrollo</strong>
                    Estás viendo una vista previa. Puede haber contenido
                    incompleto o cosas que todavía no funcionan.
                </div>
            ` : ""}

            <div class="sidebar-footer">
                <div class="quien">${usuario.nombre} · ${rolLegible}</div>
                ${usuario.sucursal ? `<div class="sucursal">${usuario.sucursal.replace("Lucciano's ", "")}</div>` : ""}
                <button class="menu" id="btn-logout" style="color:#f3a0a0">
                    ${Icon("logout")} <span>Cerrar sesión</span>
                </button>
            </div>

        </aside>
    `;
}
