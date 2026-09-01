/* ============================
   Lucciano's Academy
   services/gestionCiclo.js — Ciclo semanal/mensual de Gestión de tareas

   Espejo cliente de _cicloActual (apps-script/Code.gs) — mismo corte a
   las 04:00, NO medianoche (pedido explícito 2026-08-31: el cierre de
   la noche del domingo, o de fin de mes, se extiende de madrugada, y a
   esa hora todavía tiene que contar como el ciclo que termina). El
   servidor es la fuente de verdad real (usa SU hora, no la del
   celular de cada uno) — esto se usa para el modo mock (ES_LOCAL_DEV,
   sin backend) y para armar etiquetas legibles a partir de un ciclo ya
   devuelto por el server.
=============================*/

export function cicloActual(frecuencia) {
    return cicloDeFecha(null, frecuencia);
}

/** Igual que cicloActual, pero para una fecha puntual en vez de "ahora"
 *  — espejo de _cicloDeFecha (Code.gs). Hace falta para las filas de
 *  GestionChecks guardadas antes de que existiera "ciclo" (quedaron con
 *  ese campo vacío): tratarlas como "siempre son de hoy" (lo que hacía
 *  antes filtrarChecksCicloActual en gestion.js) las dejaba pegadas
 *  para siempre en "Tareas asignadas", sin pasar nunca a Histórico —
 *  bug real reportado en vivo. Acá se calcula a qué ciclo pertenecían
 *  de verdad, a partir de su propia fechaModificacion. */
export function cicloDeFecha(fechaISO, frecuencia) {
    const instante = fechaISO ? new Date(fechaISO) : new Date();
    const efectiva = new Date(instante.getTime() - 4 * 60 * 60 * 1000);
    if (frecuencia === "mensual") {
        return `${efectiva.getFullYear()}-${String(efectiva.getMonth() + 1).padStart(2, "0")}`;
    }
    const dow = efectiva.getDay(); // domingo=0..sábado=6
    const offsetALunes = (dow + 6) % 7; // lunes=0
    const lunes = new Date(efectiva);
    lunes.setDate(efectiva.getDate() - offsetALunes);
    return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, "0")}-${String(lunes.getDate()).padStart(2, "0")}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function capitalizar(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-08-18" → "Semana del 18 al 24 de agosto". "2026-08" →
 *  "Agosto 2026" — mismo formato que la maqueta ya aprobada. */
export function etiquetaCiclo(ciclo) {
    if (/^\d{4}-\d{2}$/.test(String(ciclo))) {
        const [anio, mes] = ciclo.split("-").map(Number);
        return `${capitalizar(MESES[mes - 1])} ${anio}`;
    }
    const [anio, mes, dia] = String(ciclo).split("-").map(Number);
    const lunes = new Date(anio, mes - 1, dia);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    if (lunes.getMonth() === domingo.getMonth()) {
        return `Semana del ${lunes.getDate()} al ${domingo.getDate()} de ${MESES[domingo.getMonth()]}`;
    }
    return `Semana del ${lunes.getDate()} de ${MESES[lunes.getMonth()]} al ${domingo.getDate()} de ${MESES[domingo.getMonth()]}`;
}
