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
// También ignora acentos y espacios repetidos ("Tomás  Ojada" = "tomas ojada"): un descuido de tipeo no deja a nadie sin equipo.
export function normalizarNombre(n) {
    return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** "Ana, Beto" → ["Ana", "Beto"] (un local puede tener más de un supervisor). */
export function listaSupervisores(campoSupervisor) {
    return String(campoSupervisor || "").split(",").map((n) => n.trim()).filter(Boolean);
}

/** ¿Este nombre figura entre los supervisores del local? (el campo es una lista separada por comas: "Ana, Beto") */
export function supervisaElLocal(sucursal, nombre) {
    const buscado = normalizarNombre(nombre);
    return listaSupervisores(sucursal && sucursal.supervisor).some((n) => normalizarNombre(n) === buscado);
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

/** Nombres que figuran como "Supervisor" en algún local pero no son el nombre de ningún usuario Supervisor (y por eso esos locales
 *  no aparecen en "Mi equipo" de nadie). Devuelve [{ nombre, locales }] con la cantidad de locales afectados. */
export function supervisoresSinUsuario(sucursales, usuarios) {
    const existentes = new Set((usuarios || []).filter((u) => u.rol === "supervisor").map((u) => normalizarNombre(u.nombre)));
    const huerfanos = new Map();
    (sucursales || []).forEach((s) => {
        listaSupervisores(s.supervisor).forEach((n) => {
            const clave = normalizarNombre(n);
            if (existentes.has(clave)) return;
            const previo = huerfanos.get(clave) || { nombre: n, locales: 0 };
            previo.locales++;
            huerfanos.set(clave, previo);
        });
    });
    return [...huerfanos.values()].sort((a, b) => b.locales - a.locales);
}

/** Para el cuadro de supervisores de "Editar local": qué usuarios Supervisor quedan tildados y qué nombres del local no son de ningún usuario.
 *  Compara sin importar acentos ni espacios (antes era letra por letra: un nombre apenas distinto quedaba sin tildar y al guardar se borraba).
 *  Los nombres sin usuario NO se pierden: se devuelven aparte para mostrarlos tildados y que el Admin decida quitarlos. */
export function supervisoresDelLocal(supervisores, campoSupervisor) {
    const guardados = listaSupervisores(campoSupervisor);
    const marcados = new Set(guardados.map(normalizarNombre));
    const conocidos = new Set((supervisores || []).map((s) => normalizarNombre(s.nombre)));
    return {
        usuarios: (supervisores || []).map((s) => ({ nombre: s.nombre, marcado: marcados.has(normalizarNombre(s.nombre)) })),
        sinUsuario: guardados.filter((n) => !conocidos.has(normalizarNombre(n))),
    };
}
