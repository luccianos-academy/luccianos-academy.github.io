/* ============================
   Lucciano's Academy
   services/contenidoNuevo.js — Avisar de lecciones nuevas en cursos
   que la persona ya tenía empezados o terminados.

   El progreso se guarda como UN porcentaje por curso, no lección por
   lección (ver pages/cursos.js): si se agrega una lección a un curso al
   100%, sigue al 100% y la nueva figura como vista sin que nadie se
   entere. Este módulo cubre ese hueco con una etiqueta "Nuevo".

   Una lección es nueva PARA UNA PERSONA cuando:
   - tiene fechaPublicacion (solo las cargadas con "Avisar como contenido
     nuevo" — las anteriores a este campo no la tienen y nunca avisan);
   - se publicó dentro de la ventana (así la etiqueta no queda para
     siempre si nadie entra);
   - se publicó DESPUÉS de que la persona recibió el curso (alguien que
     entra hoy a un curso ya armado no tiene nada "nuevo");
   - todavía no la tuvo en pantalla.

   El "ya la vi" vive en el navegador de cada persona (localStorage): es
   una comodidad por dispositivo, no un dato a auditar. Si cambia de
   celular, la etiqueta vuelve a salir una vez más.
=============================*/

/** Días que una lección sigue marcada como nueva desde que se publicó. */
export const VENTANA_DIAS_NUEVO = 60;

const clave = (usuarioId) => `lecciones_nuevas_vistas_${usuarioId}`;

function leerVistas(usuarioId) {
    try {
        const crudo = localStorage.getItem(clave(usuarioId));
        const lista = crudo ? JSON.parse(crudo) : [];
        return new Set(Array.isArray(lista) ? lista.map(String) : []);
    } catch (_) {
        return new Set();
    }
}

/** Anota que la lección ya estuvo en pantalla. */
export function marcarLeccionNuevaVista(usuarioId, leccionId) {
    try {
        const vistas = leerVistas(usuarioId);
        vistas.add(String(leccionId));
        localStorage.setItem(clave(usuarioId), JSON.stringify([...vistas]));
    } catch (_) {
        /* sin almacenamiento: la etiqueta se repite, no se rompe nada */
    }
}

function diasDesde(fechaISO) {
    const t = Date.parse(`${fechaISO}T00:00:00`);
    if (Number.isNaN(t)) return Infinity;
    return Math.floor((Date.now() - t) / 86400000);
}

/**
 * De las lecciones (ya filtradas por alcance de la persona), las que le
 * resultan nuevas en un curso. `asignacion` es la suya de ese curso: sin
 * asignación todavía no empezó el curso y no hay nada que avisarle.
 */
export function leccionesNuevasDeCurso(lecciones, asignacion, usuarioId) {
    if (!asignacion) return [];
    const recibidoEl = String(asignacion.fechaAlta || "").slice(0, 10);
    const vistas = leerVistas(usuarioId);
    return lecciones.filter((l) => {
        const publicada = String(l.fechaPublicacion || "").slice(0, 10);
        if (!publicada) return false;
        if (diasDesde(publicada) > VENTANA_DIAS_NUEVO) return false;
        if (recibidoEl && publicada <= recibidoEl) return false;
        return !vistas.has(String(l.id));
    });
}
