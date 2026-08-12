/* ============================
   Lucciano's Academy
   services/ids.js — Comparar ids que vienen de la planilla

   Los ids se generan con Date.now() y viajan a Google Sheets, que los
   guarda como NÚMERO. De vuelta pueden llegar con una cola decimal
   ("1786486477496.17" en vez de "1786486477496") según cómo quedó
   formateada la celda. Comparados como texto, dejan de coincidir.

   Eso no es cosmético: `puedeVerNoticia` decide con esa comparación a
   quién le llega una News dirigida a personas puntuales. Con el id
   torcido no matchea NADIE — y como la lista no está vacía, tampoco
   entra el resto. La News no le llega a nadie y no hay ningún error
   visible. Encontrado el 2026-08-12 con una News real que decía
   "1 usuario(s): id 1786486477496.17".
=============================*/

/**
 * true si los dos ids son el mismo, tolerando que uno venga como número
 * y el otro como texto, y que la planilla le haya agregado decimales.
 *
 * Se redondea a propósito: los ids son enteros (Date.now()), así que
 * cualquier parte decimal es ruido del formato de la celda, no un id
 * distinto.
 */
export function mismoId(a, b) {
    const sa = String(a ?? "").trim();
    const sb = String(b ?? "").trim();
    if (!sa || !sb) return false;
    if (sa === sb) return true;

    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.round(na) === Math.round(nb);
    return false;
}

/** ¿Alguno de la lista es este id? Para las listas separadas por coma
 *  que guarda la planilla (usuariosEspecificos, leidoPor, etc.). */
export function listaTieneId(lista, id) {
    return String(lista || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .some((x) => mismoId(x, id));
}
