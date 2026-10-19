/* ============================
   Lucciano's Academy (app Firebase)
   services/supervisores.js — qué locales supervisa cada Supervisor

   Funciones puras (sin lecturas) que comparten data/sucursales.js (lo que ve cada pantalla)
   y firestoreSource.js (qué documentos baja un Supervisor de la base): mismo criterio en los
   dos lados, así la lectura acotada nunca deja afuera algo que la pantalla iba a mostrar.
=============================*/

// Comparación tolerante (recorta espacios, ignora mayúsculas): el campo "Supervisor de esta
// sucursal" (pages/colaboradores.js) es de texto libre con sugerencias, no fuerza elegir una —
// un espacio de más o una mayúscula distinta al tipearlo a mano ya rompía el match exacto de
// antes y dejaba al supervisor sin equipo, silenciosamente.
export function normalizarNombre(n) {
    return String(n || "").trim().toLowerCase();
}

/** "Ana, Beto" → ["Ana", "Beto"] (un local puede tener más de un supervisor). */
export function listaSupervisores(campoSupervisor) {
    return String(campoSupervisor || "").split(",").map((n) => n.trim()).filter(Boolean);
}

/** Nombres de los locales cuyo campo "supervisor" nombra a esta persona. Sin ninguno vinculado
 *  cae a su propio local (para no dejarla bloqueada por faltar ese vínculo). */
export function localesDeSupervisor(usuario, sucursales) {
    const nombre = normalizarNombre(usuario && usuario.nombre);
    const asignados = (sucursales || [])
        .filter((s) => listaSupervisores(s.supervisor).some((n) => normalizarNombre(n) === nombre))
        .map((s) => s.nombre);
    if (asignados.length) return asignados;
    return usuario && usuario.sucursal ? [usuario.sucursal] : [];
}
