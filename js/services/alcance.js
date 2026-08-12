/* ============================
   Lucciano's Academy
   services/alcance.js — Qué contenido le aplica a cada persona

   Un solo set de cursos y lecciones para toda la red, segmentado por
   dónde trabaja cada uno. Chocolatería no se vende en Chile, batidos no
   en Uruguay, y dentro de Argentina hay locales chicos sin cafetería ni
   pastelería. Duplicar los módulos por país se rompe solo: cuando
   cambia un procedimiento hay que acordarse de editarlo en tres lados,
   y a los meses divergieron sin que nadie lo note.

   El campo "aplicaA" es una lista separada por comas que mezcla PAÍSES
   y LOCALES:

       aplicaA: "Argentina, Uruguay"                 → toda esa red
       aplicaA: "Lucciano's Agüero CABA"             → un local puntual
       aplicaA: "Uruguay, Lucciano's Oroño Santa Fe" → mezcla

   VACÍO = le aplica a todos. Es la semántica correcta —lo normal es que
   un contenido valga para toda la red y la excepción se declare— y la
   misma que usa Noticias.dirigidoA. OJO que es la OPUESTA a
   Manuales.visiblePara, donde vacío significa que no lo ve nadie: esa
   inconsistencia ya causó problemas y no hay que replicarla.

   El país sale de la sucursal de la persona (Sucursales.pais), nunca se
   le pregunta. Preguntarlo sería fricción en cada ingreso y además se
   puede contestar mal.
=============================*/

/** Compara nombres de local/país escritos de forma despareja en la
 *  planilla: distinta capitalización, tildes o espacios de más. */
function normalizar(s) {
    return String(s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/* El país está en el sufijo del nombre de cada local — "Lucciano's
   Pocitos Uruguay", "Lucciano's Weston USA" — y los argentinos terminan
   en provincia. Esto es el respaldo de la columna "pais" de la hoja: si
   una fila la tiene vacía (recién cargada, o antes de correr
   completarPaises() en Setup.gs) el local no queda sin país y el filtro
   por país lo sigue encontrando.

   La columna manda siempre que tenga valor: un local puede llamarse de
   una forma que no diga su país, y ahí se carga a mano. */
const PAIS_POR_SUFIJO = {
    uruguay: "Uruguay",
    paraguay: "Paraguay",
    chile: "Chile",
    espana: "España",
    usa: "Estados Unidos",
    italia: "Italia",
};

export function paisDelNombre(nombre) {
    const t = normalizar(nombre).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return "";
    return PAIS_POR_SUFIJO[t.split(" ").pop()] || "Argentina";
}

/**
 * El país de una persona, deducido de su local. "" solo si la persona
 * no tiene local asignado.
 *
 * Las sucursales son OPCIONALES, y que lo sean es lo que hace viable
 * todo esto: la regla se consulta desde una docena de pantallas, y
 * exigirles cargar la lista de sucursales para poder preguntar habría
 * significado volver asíncronas funciones que hoy no lo son. Cuando se
 * pasan, manda la columna "pais" de la hoja —un local puede llamarse de
 * una forma que no diga su país—; cuando no, se deduce del nombre, que
 * es de donde sale esa columna igual.
 */
export function paisDe(usuario, sucursales = []) {
    const miLocal = normalizar(usuario?.sucursal);
    if (!miLocal) return "";
    const suc = sucursales.find((s) => normalizar(s.nombre) === miLocal);
    if (suc) return String(suc.pais || "").trim() || paisDelNombre(suc.nombre);
    return paisDelNombre(usuario.sucursal);
}

/**
 * ¿Este curso o lección le aplica a esta persona?
 *
 * Admin y Supervisor ven todo: gestionan el contenido, y si no no
 * podrían revisar lo que le toca a otra red. Mismo criterio que
 * puedeVerManual.
 *
 * Una persona sin local asignado no matchea contra nada acotado: no hay
 * forma de saber qué le corresponde, y es mejor que le falte contenido
 * a que vea el de otra red.
 */
export function aplicaAlUsuario(item, usuario, sucursales = []) {
    const lista = String(item?.aplicaA || "").trim();
    if (!lista) return true;
    if (!usuario) return false;
    if (usuario.rol === "admin" || usuario.rol === "supervisor") return true;

    const miLocal = normalizar(usuario.sucursal);
    const miPais = normalizar(paisDe(usuario, sucursales));

    return lista
        .split(",")
        .map(normalizar)
        .filter(Boolean)
        .some((t) => t === miLocal || (miPais && t === miPais));
}

/**
 * Los cursos que le corresponden a una persona — ÚNICA fuente de
 * verdad.
 *
 * Antes esta regla ("Gestión solo para encargados") estaba copiada en
 * cinco lugares distintos: el progreso de Mi equipo, el semáforo, el
 * dashboard y las tablas. Sumar el alcance por país/local en cada copia
 * garantizaba que alguna quedara sin actualizar y el progreso diera
 * distinto según la pantalla.
 *
 * Que el progreso salga de acá es lo que hace que un chileno que
 * completó sus 6 cursos aplicables vea 100% y no 75%.
 */
export function cursosDeLaPersona(cursos, persona, sucursales = []) {
    return (cursos || []).filter((cur) => cursoAplicaAPersona(cur, persona, sucursales));
}

/**
 * La misma pregunta para UN curso. Existe porque varias pantallas
 * arman una grilla de curso × persona y necesitan pintar "No aplica"
 * celda por celda, sin filtrar la lista entera.
 */
export function cursoAplicaAPersona(curso, persona, sucursales = []) {
    if (curso?.categoria === "Gestión" && !persona?.encargado) return false;
    return aplicaAlUsuario(curso, persona, sucursales);
}

/** Las lecciones de un curso que le corresponden a una persona. Un
 *  curso puede aplicar entero y tener adentro alguna lección que no —
 *  ej. Cafetería sí, pero la lección de batidos no en Uruguay. */
export function leccionesDeLaPersona(lecciones, persona, sucursales = []) {
    return (lecciones || []).filter((l) => aplicaAlUsuario(l, persona, sucursales));
}
