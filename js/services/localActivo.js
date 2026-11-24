/* ============================
   Lucciano's Academy (app Firebase)
   services/localActivo.js — un Responsable de local en más de un local

   Un franquiciado puede abrir un segundo local y poner a la misma persona a cargo de los dos. El usuario sigue
   teniendo UN local principal (`sucursal`) y, opcionalmente, una lista de locales extra (`sucursalesExtra`) que carga
   el Admin. Como toda la app lee `usuario.sucursal`, la persona elige en cuál "está" ahora (selector arriba del menú) y
   ese local pasa a ser su `sucursal` en la sesión: ninguna pantalla tuvo que cambiar. Las reglas de Firestore
   (esMiLocal) aceptan el principal y los extra.

   Funciones puras (el guardado de la elección vive en auth.js).
=============================*/

/** "A, B" o ["A","B"] → ["A","B"] (sin vacíos ni repetidos). */
export function listaDeLocales(valor) {
    const lista = Array.isArray(valor) ? valor : String(valor || "").split(",");
    const vistos = new Set();
    return lista.map((n) => String(n).trim()).filter((n) => n && !vistos.has(n) && vistos.add(n));
}

/** Todos los locales donde puede estar: el principal primero, después los extra. */
export function localesDelUsuario(usuario) {
    if (!usuario) return [];
    return listaDeLocales([usuario.sucursalPrincipal || usuario.sucursal, ...listaDeLocales(usuario.sucursalesExtra)]);
}

/** ¿Tiene más de un local para elegir? */
export function tieneVariosLocales(usuario) {
    return localesDelUsuario(usuario).length > 1;
}

/** El usuario "parado" en el local elegido. Si la elección no es válida (o no tiene extras) devuelve el usuario igual. */
export function conLocalActivo(usuario, elegido) {
    if (!usuario || !tieneVariosLocales(usuario)) return usuario;
    const locales = localesDelUsuario(usuario);
    const activo = locales.includes(elegido) ? elegido : locales[0];
    return { ...usuario, sucursalPrincipal: locales[0], sucursal: activo };
}
