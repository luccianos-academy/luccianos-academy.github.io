/* ============================
   Lucciano's Academy
   data/desafio.js — Tablas "DesafioResultados" y "DesafioHistorial"

   Un desafío = una fila en DesafioResultados por cada vez que alguien
   juega (colaboradorId, fecha, correctas, tiempoUsado, puntos). El
   ranking del mes en curso se calcula sumando estas filas — no hay
   una tabla de "ranking" aparte que se pueda desincronizar.

   DesafioHistorial recién se usa a partir del cierre de mes (ver
   apps-script/README.md cuando esa pieza esté armada): la foto
   congelada de un mes ya cerrado, para no tener que sumar filas
   viejas de DesafioResultados para siempre.
=============================*/

import { fetchSheet, writeSheet } from "../services/dataSource.js";
import { desafioResultadosMock, desafioHistorialMock } from "./mock/desafio.mock.js";
import { getDisponibilidad, guardarDisponibilidad } from "./disponibilidad.js";
import { invalidar } from "../services/dataSource.js";
import { HOJAS } from "../config.js";

function normalizarResultado(f) {
    return {
        id: f.id,
        colaboradorId: f.colaboradorId,
        // Quién es, tal como era al jugar. El ranking lo muestra a TODOS los
        // participantes, pero un colaborador no puede leer la hoja Usuarios
        // (solo su fila), así que el join por id solo le sirve para sí mismo
        // y todos los demás salían como "Colaborador" con una "C". Por eso
        // cada partida guarda nombre, foto y local de quien la jugó; el
        // ranking usa Usuarios cuando puede y esto cuando no.
        colaboradorNombre: String(f.colaboradorNombre || "").trim(),
        colaboradorFoto: String(f.colaboradorFoto || "").trim(),
        colaboradorLocal: String(f.colaboradorLocal || "").trim(),
        fecha: String(f.fecha || "").trim().slice(0, 10),
        correctas: Number(f.correctas) || 0,
        tiempoUsado: Number(f.tiempoUsado) || 0,
        puntos: Number(f.puntos) || 0,
    };
}

export async function getDesafioResultados() {
    try {
        const filas = await fetchSheet(HOJAS.DESAFIO_RESULTADOS, desafioResultadosMock);
        return filas.map(normalizarResultado);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.DESAFIO_RESULTADOS}':`, err.message);
        return [];
    }
}

export async function getDesafioResultadosPorColaborador(colaboradorId) {
    const filas = await getDesafioResultados();
    return filas.filter((f) => String(f.colaboradorId) === String(colaboradorId));
}

/** "YYYY-MM-DD"/"YYYY-MM" en hora LOCAL de quien juega. Antes se sacaba
 *  de toISOString() (UTC): en Argentina el día "cambiaba" a las 21:00 —
 *  una partida a las 22:00 del 7 quedaba guardada como del 8, se podía
 *  jugar dos veces en lo que para la persona era el mismo día, y las
 *  partidas de la última noche del mes caían en el mes siguiente. El
 *  cierre de mes del backend (Code.gs) ya usa la zona horaria del
 *  script, que es la misma. */
export function hoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mesActualISO() {
    return hoyISO().slice(0, 7);
}

/** Un desafío por día por persona. Server-side esto lo vuelve a
 *  chequear pages/desafio.js antes de dejar entrar (mismo criterio
 *  que el gate real de examen.js: esto acá solo decide qué mostrar,
 *  no alcanza como única traba). */
export async function yaJugoHoy(colaboradorId) {
    const filas = await getDesafioResultadosPorColaborador(colaboradorId);
    return filas.some((f) => f.fecha === hoyISO());
}

/** Suma de puntos de un colaborador en un mes dado (por defecto, el
 *  actual). Puntaje = correctas × 10, ya calculado al guardar cada
 *  fila — acá solo se suma, no se recalcula. */
export function totalDelMes(filasColaborador, anioMes = mesActualISO()) {
    return filasColaborador
        .filter((f) => f.fecha.startsWith(anioMes))
        .reduce((suma, f) => suma + f.puntos, 0);
}

export async function crearDesafioResultado({ colaboradorId, colaboradorNombre, colaboradorFoto = "", colaboradorLocal = "", correctas, tiempoUsado, puntos }) {
    return writeSheet(HOJAS.DESAFIO_RESULTADOS, {
        colaboradorId,
        colaboradorNombre,
        colaboradorFoto,
        colaboradorLocal,
        fecha: hoyISO(),
        correctas,
        tiempoUsado,
        puntos,
    }, desafioResultadosMock);
}

function normalizarHistorial(f) {
    return {
        id: f.id,
        mes: String(f.mes || "").trim(),
        colaboradorId: f.colaboradorId,
        colaboradorNombre: String(f.colaboradorNombre || "").trim(),
        puesto: Number(f.puesto) || 0,
        puntos: Number(f.puntos) || 0,
    };
}

export async function getDesafioHistorial() {
    try {
        const filas = await fetchSheet(HOJAS.DESAFIO_HISTORIAL, desafioHistorialMock);
        return filas.map(normalizarHistorial);
    } catch (err) {
        console.warn(`No se pudo leer '${HOJAS.DESAFIO_HISTORIAL}':`, err.message);
        return [];
    }
}

/* ── Quién está excluido del ranking ─────────────────────────────
   La fuente de verdad es Usuarios.excluidoDesafio, pero un colaborador no puede
   leer esa hoja (solo su fila), así que no podía saber a quién ocultar y el
   ranking de ellos seguía mostrando a gente que el Admin había excluido.
   Por eso se guarda además una lista pública de ids en una fila reservada de
   "Disponibilidad" (curso "__app", producto "desafio-excluidos", ids en
   "aplicaA"): la escribe el Admin y la lee cualquier persona con sesión. Solo
   contiene ids numéricos. Cuando el Admin abre el ranking, la lista se
   corrige sola para que coincida con Usuarios. */

const CURSO_APP = "__app";
const PRODUCTO_EXCLUIDOS = "desafio-excluidos";

export async function getExcluidosDesafio() {
    const filas = await getDisponibilidad();
    const fila = filas.find((f) => f.curso === CURSO_APP && f.producto === PRODUCTO_EXCLUIDOS);
    return new Set(String(fila?.aplicaA || "").split(",").map((x) => x.trim()).filter(Boolean));
}

/** Reemplaza la lista completa (solo Admin). */
export async function guardarExcluidosDesafio(ids) {
    const lista = [...new Set([...ids].map((x) => String(x).trim()).filter(Boolean))];
    invalidar(HOJAS.DISPONIBILIDAD);
    const existentes = await getDisponibilidad();
    return guardarDisponibilidad(CURSO_APP, PRODUCTO_EXCLUIDOS, { aplicaA: lista.join(","), noAplicaA: "" }, existentes);
}
