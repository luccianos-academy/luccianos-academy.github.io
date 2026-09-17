/* ============================
   Lucciano's Academy
   services/cooldownExamen.js

   Cuánto hay que esperar para volver a rendir un examen reprobado.
   Antes de esto, "Volver a intentar" quedaba disponible en el acto —
   entra en el mismo hueco que el bug real de Valentina Cerutti y 7
   colaboradores más (2026-09-17): examen.js nunca verifica del lado
   del servidor que el progreso de lecciones esté completo, así que
   alguien podía re-rendir sin límite hasta que le saliera bien, sin
   ningún incentivo real a repasar el contenido.

   Un solo lugar para esta cuenta — la usan cursos.js (el CTA dentro
   del curso), misEvaluaciones.js ("Evaluaciones") y examen.js (el
   bloqueo real, no solo cosmético: sin esto alguien podía seguir
   entrando directo a #/examen/:cursoId aunque la pantalla de "Volver
   a intentar" no se lo ofreciera).
=============================*/

export const COOLDOWN_HORAS_REEXAMEN = 48;

/** null si ya puede rendir (nunca lo intentó, ya aprobó alguna vez, o
 *  ya pasó el cooldown desde el último intento). Si no, la fecha en
 *  que se habilita de nuevo.
 *
 *  Mira el ÚLTIMO resultado del array (mismo criterio que ya usan
 *  cursos.js/misEvaluaciones.js para "ultimoIntento": los resultados
 *  vienen en orden de cuándo se guardaron) — si ese último es
 *  aprobado, no hay nada que esperar, aunque haya reprobados previos
 *  en el historial. */
export function proximoReintento(resultadosCurso) {
    if (!resultadosCurso.length) return null;
    const ultimo = resultadosCurso[resultadosCurso.length - 1];
    if (ultimo.aprobado) return null;

    const disponibleDesde = Number(ultimo.fechaModificacion || 0) + COOLDOWN_HORAS_REEXAMEN * 60 * 60 * 1000;
    if (!ultimo.fechaModificacion || Date.now() >= disponibleDesde) return null;
    return new Date(disponibleDesde);
}

/** Mismo tono en los 3 lugares donde aparece — sin regaño, con la
 *  fecha exacta para que la persona sepa cuándo volver. */
export function mensajeCooldown(fecha, nota) {
    // hour12: false a propósito — con hour12 (el default en es-AR),
    // Intl agrega "a. m."/"p. m." con su propio punto final, que
    // chocaba con el punto de cierre de la oración ("10:42 a. m..").
    const texto = fecha.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
    return `Nota: ${nota}/10 — todavía no llegaste al mínimo. Seguí practicando: repasá el curso y volvé a intentarlo el ${texto}.`;
}
