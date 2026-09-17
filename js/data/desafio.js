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
import { HOJAS } from "../config.js";

function normalizarResultado(f) {
    return {
        id: f.id,
        colaboradorId: f.colaboradorId,
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

/** "YYYY-MM-DD"/"YYYY-MM" en UTC — mismo criterio simple que ya usa el
 *  resto de la app para fechas (crearResultado en data/resultados.js,
 *  fechaAlta, etc.), sin sumar una librería de fechas para esto. */
export function hoyISO() {
    return new Date().toISOString().slice(0, 10);
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

export async function crearDesafioResultado({ colaboradorId, correctas, tiempoUsado, puntos }) {
    return writeSheet(HOJAS.DESAFIO_RESULTADOS, {
        colaboradorId,
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
