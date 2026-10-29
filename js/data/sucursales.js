/* ============================
   Lucciano's Academy
   data/sucursales.js — Tabla "Sucursales"
=============================*/

import { fetchSheet, writeSheet, updateSheet, deleteSheet } from "../services/dataSource.js";
import { sucursalesMock } from "./mock/sucursales.mock.js";
import { paisDelNombre } from "../services/alcance.js";
import { normalizarNombre, listaSupervisores, localesDeSupervisor } from "../services/supervisores.js";
import { getLocalesElegidos } from "../services/preferenciasLocales.js";
import { HOJAS } from "../config.js";

function normalizarSucursal(f) {
    return {
        id: f.id,
        nombre: f.nombre,
        // Lista separada por comas — un local puede tener más de un
        // supervisor a cargo (ej. cobertura de vacaciones, o dos
        // supervisores que comparten un local grande). Mismo patrón
        // que Manuales.visiblePara / Noticias.visiblePara: no hace
        // falta una hoja nueva, solo interpretar el campo como lista.
        supervisor: f.supervisor || "",
        estado: f.estado || "Activa",
        // Propio vs franquicia — pedido explícito del usuario: "por
        // descarte los que no sean propios serán franquicias", o sea
        // que el default (celda vacía o cualquier cosa que no sea
        // "SI") es franquicia, no al revés. Usado por
        // data/canales.js (puedeVerCanal) para los canales
        // "Encargados — Locales propios/Franquicias": como se resuelve
        // dinámicamente acá (no una lista fija guardada en el canal),
        // un local nuevo cae solo del lado correcto apenas se carga,
        // sin tener que volver a tocar ningún canal.
        esPropio: String(f.esPropio || "").trim().toUpperCase() === "SI",
        // Segmenta el contenido por país (services/alcance.js) y el
        // filtro de la pantalla de Locales. Si la celda está vacía se
        // deduce del sufijo del nombre, así una sucursal recién cargada
        // no queda fuera del filtro hasta que alguien complete la
        // columna.
        pais: String(f.pais || "").trim() || paisDelNombre(f.nombre),
    };
}

export async function getSucursales() {
    try {
        const filas = await fetchSheet(HOJAS.SUCURSALES, sucursalesMock);
        return filas.map(normalizarSucursal);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.SUCURSALES}':`, err.message);
        return [];
    }
}

export async function crearSucursal({ nombre, supervisor = "", estado = "Activa", esPropio = false, pais = "Argentina" }) {
    return writeSheet(HOJAS.SUCURSALES, { nombre, supervisor, estado, esPropio: esPropio ? "SI" : "NO", pais }, sucursalesMock);
}

export async function actualizarSucursal(id, cambios) {
    return updateSheet(HOJAS.SUCURSALES, id, cambios, sucursalesMock);
}

export async function eliminarSucursal(id) {
    return deleteSheet(HOJAS.SUCURSALES, id, sucursalesMock);
}

// normalizarNombre / listaSupervisores / localesDeSupervisor viven en services/supervisores.js
// (los usa también la capa de datos para acotar lo que baja un Supervisor).
export { listaSupervisores };

/** Agrega un supervisor a la lista de un local SIN pisar a los que ya
 *  estaban (ej. cobertura de vacaciones: el titular sigue viendo su
 *  equipo, el que cubre se suma). No hace nada si ya estaba. */
export async function agregarSupervisorASucursal(sucursalId, nombreSupervisor) {
    const sucursales = await getSucursales();
    const sucursal = sucursales.find((s) => String(s.id) === String(sucursalId));
    if (!sucursal) return;
    const actuales = listaSupervisores(sucursal.supervisor);
    if (actuales.some((n) => normalizarNombre(n) === normalizarNombre(nombreSupervisor))) return;
    actuales.push(nombreSupervisor);
    await actualizarSucursal(sucursalId, { supervisor: actuales.join(", ") });
}

/** Saca UN supervisor puntual de la lista de un local, sin afectar a
 *  los demás que pueda tener a cargo el mismo local. */
export async function quitarSupervisorDeSucursal(sucursalId, nombreSupervisor) {
    const sucursales = await getSucursales();
    const sucursal = sucursales.find((s) => String(s.id) === String(sucursalId));
    if (!sucursal) return;
    const restantes = listaSupervisores(sucursal.supervisor).filter((n) => normalizarNombre(n) !== normalizarNombre(nombreSupervisor));
    await actualizarSucursal(sucursalId, { supervisor: restantes.join(", ") });
}

/** Locales que supervisa un Supervisor: matchea por nombre contra la
 *  lista de Sucursales.supervisor (puede tener más de uno a cargo, y
 *  un mismo local puede tener más de un supervisor — ver
 *  agregarSupervisorASucursal). Si todavía no hay ningún local
 *  vinculado a él ahí — dato que se carga a mano o se auto-completa al
 *  registrar un colaborador nuevo, ver pages/colaboradores.js — cae a
 *  su propio Usuarios.sucursal como único local, para no dejarlo
 *  bloqueado por faltar ese vínculo.
 *
 *  Usado por la home del Supervisor (inicioSupervisor.js), "Mi
 *  equipo" (pages/colaboradores.js), y los rankings por supervisor de
 *  Dashboard Ejecutivo / Supervisores / Reportes — mismo criterio en
 *  todos, así ningún supervisor sin ese vínculo cargado a mano queda
 *  mostrando 0% por una limitación de datos y no de desempeño real.
 *
 *  sucursalesPrefetch es opcional: si quien llama ya tiene
 *  getSucursales() resuelto (ej. un ranking que recorre varios
 *  supervisores a la vez), lo pasa para no repetir el fetch por cada
 *  uno. */
export async function getMisLocales(usuario, sucursalesPrefetch) {
    const sucursales = sucursalesPrefetch || await getSucursales();
    return localesDeSupervisor(usuario, sucursales);
}

/** Qué locales VE un usuario — distinto de getMisLocales (qué
 *  ADMINISTRA). Para un Supervisor común son lo mismo. Un Capacitador
 *  (Supervisor con capacitador:true) es de solo lectura en TODA la
 *  app (decisión del cliente: nunca gestiona, ni siquiera su propio
 *  equipo real si lo tuviera) — necesita ver el desarrollo de la
 *  capacitación en toda la red, no solo su local, así que acá ve
 *  TODOS los locales. Quien llama sigue usando getMisLocales() (no
 *  esta función) para decidir qué puede EDITAR — ver pages/colaboradores.js. */
export async function getLocalesVisibles(usuario, sucursalesPrefetch) {
    if (usuario.capacitador) {
        const sucursales = sucursalesPrefetch || await getSucursales();
        return sucursales.map((s) => s.nombre);
    }
    return getMisLocales(usuario, sucursalesPrefetch);
}

/** Con qué locales trabaja hoy un Supervisor/Capacitador en "Inicio", "Mi equipo" y "Movimientos": los que ELIGIÓ en "Elegir mis locales"
 *  (cualquiera de la red, también los que no tiene asignados) y, si no eligió ninguno, los que tiene asignados (el Capacitador, toda la red).
 *  Ver un local no cambia a quién gestiona: lo asignado sigue siendo lo asignado. */
export async function getLocalesDeTrabajo(usuario, sucursalesPrefetch) {
    const sucursales = sucursalesPrefetch || await getSucursales();
    const porDefecto = await getLocalesVisibles(usuario, sucursales);
    const elegidos = getLocalesElegidos(usuario);
    if (!elegidos.length) return porDefecto;
    const existentes = new Set(sucursales.map((s) => s.nombre));
    const validos = elegidos.filter((n) => existentes.has(n));
    return validos.length ? validos : porDefecto;
}
