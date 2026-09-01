/* ============================
   Lucciano's Academy
   pages/movimientos.js — "Movimientos de gestión" completo, por día

   Vista expandida de la tarjeta "Movimientos de gestión" del Inicio
   (Admin/Supervisor), que solo muestra los últimos 10 — acá se ve
   TODO, agrupado por día. Pedido explícito: "apretar un botón y ver
   todas las novedades por día, así no tengo que usar el excel" — esto
   reemplaza el reporte manual que se armaba aparte para lo mismo.

   Se actualiza sola cada 20s mientras se esté en esta pantalla (mismo
   criterio ya probado en Gestión de tareas, gestion.js) — sin esto,
   había que salir y volver a entrar para ver un movimiento nuevo.
=============================*/

import { Header } from "../components/header.js";
import { ActivityFeed } from "../components/activityFeed.js";
import { getUsuarios } from "../data/usuarios.js";
import { getAuditoria, detalleConNombres } from "../data/auditoria.js";
import { getLocalesVisibles } from "../data/sucursales.js";
import { getLocalesElegidos } from "../services/preferenciasLocales.js";
import { getUsuarioActual } from "../services/auth.js";
import { mismoId } from "../services/ids.js";

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function claveDia(fecha) {
    const d = new Date(fecha);
    if (isNaN(d)) return "otros";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoy", "Ayer", o "lunes 1 de septiembre" — mismo criterio de
 *  lenguaje natural que el resto de la app (etiquetaCiclo en
 *  gestionCiclo.js). Fuera de esos dos casos, sin año: el filtro de
 *  "Movimientos de gestión" no llega a mostrar movimientos de hace
 *  más de un año en la práctica, y agregarlo sería ruido. */
function tituloDia(clave, hoyClave, ayerClave) {
    if (clave === hoyClave) return "Hoy";
    if (clave === ayerClave) return "Ayer";
    if (clave === "otros") return "Fecha desconocida";
    const [anio, mes, dia] = clave.split("-").map(Number);
    const d = new Date(anio, mes - 1, dia);
    return `${DIAS_ES[d.getDay()]} ${dia} de ${MESES_ES[mes - 1]}`;
}

/** Solo lo que necesita el auto-refresco: usuarios + auditoría, ya
 *  escopados al mismo criterio de "quién puede ver qué" que el resto
 *  de la app. Separado de Movimientos() para no repetir esa lógica de
 *  alcance en cada tick del intervalo. */
async function actividadVisible() {
    const usuario = getUsuarioActual();
    const [usuarios, auditoriaCompleta] = await Promise.all([getUsuarios(), getAuditoria()]);

    let auditoria = auditoriaCompleta;
    if (usuario.rol === "supervisor") {
        let misLocales = await getLocalesVisibles(usuario);
        if (usuario.capacitador) {
            const elegidos = getLocalesElegidos(usuario);
            if (elegidos.length) misLocales = misLocales.filter((n) => elegidos.includes(n));
        }
        const equipoIds = usuarios.filter((u) => u.rol === "colaborador" && misLocales.includes(u.sucursal)).map((c) => String(c.id));
        auditoria = auditoriaCompleta.filter((a) => equipoIds.some((eid) => mismoId(eid, a.usuarioId)) || mismoId(a.usuarioId, usuario.id));
    }

    return { usuarios, auditoria };
}

function grupoHtml(usuarios, auditoria) {
    if (!auditoria.length) {
        return `<p class="text-muted text-sm">Todavía no hay movimientos registrados.</p>`;
    }

    const hoyClave = claveDia(new Date());
    const ayerClave = claveDia(new Date(Date.now() - 24 * 60 * 60 * 1000));

    const grupos = new Map();
    auditoria.forEach((a) => {
        const clave = claveDia(a.fecha);
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave).push(a);
    });

    return [...grupos.entries()].map(([clave, filas]) => `
        <div class="section">
            <h2>${tituloDia(clave, hoyClave, ayerClave)}</h2>
            ${ActivityFeed(filas.map((a) => ({ fecha: a.fecha, texto: detalleConNombres(a.detalle, usuarios) })), { soloHora: true })}
        </div>
    `).join("");
}

export async function Movimientos() {
    const { usuarios, auditoria } = await actividadVisible();

    return `
        ${Header("Movimientos de gestión", "Altas, bajas y cambios hechos desde la plataforma, agrupados por día. Se actualiza solo.")}
        <div id="movimientos-lista">${grupoHtml(usuarios, auditoria)}</div>
    `;
}

let intervaloMovimientos = null;

export function bindMovimientos() {
    // Mismo patrón que gestion.js: sin hook de "salir de la página" en
    // este router, el propio intervalo se autochequea contra un nodo
    // de esta pantalla y se corta solo si ya no está.
    if (intervaloMovimientos) clearInterval(intervaloMovimientos);
    intervaloMovimientos = setInterval(async () => {
        const contenedor = document.getElementById("movimientos-lista");
        if (!contenedor) {
            clearInterval(intervaloMovimientos);
            intervaloMovimientos = null;
            return;
        }
        const { usuarios, auditoria } = await actividadVisible();
        // Contenedor sigue existiendo tras el await? el chequeo de
        // arriba pudo pasar y de ahí a acá haberse navegado afuera.
        if (document.getElementById("movimientos-lista")) {
            contenedor.innerHTML = grupoHtml(usuarios, auditoria);
        }
    }, 20000);
}
