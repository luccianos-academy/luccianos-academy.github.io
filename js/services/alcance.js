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

/** El país de una persona, deducido de su local. "" si no se puede
 *  resolver (no se pasaron las sucursales, o al local le falta el país). */
export function paisDe(usuario, sucursales = []) {
    const miLocal = normalizar(usuario?.sucursal);
    if (!miLocal) return "";
    const suc = sucursales.find((s) => normalizar(s.nombre) === miLocal);
    return String(suc?.pais || "").trim();
}

/**
 * ¿Este curso o lección le aplica a esta persona?
 *
 * Admin y Supervisor ven todo: gestionan el contenido, y si no no
 * podrían revisar lo que le toca a otra red. Mismo criterio que
 * puedeVerManual.
 *
 * Si no se pasan las sucursales solo se puede resolver por local, no
 * por país — así que un contenido acotado a "Uruguay" no le aparecería
 * a nadie. Criterio conservador y explícito: es mejor que falte a que
 * se muestre de más.
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
    return (cursos || []).filter((cur) => {
        if (cur.categoria === "Gestión" && !persona?.encargado) return false;
        return aplicaAlUsuario(cur, persona, sucursales);
    });
}

/** Las lecciones de un curso que le corresponden a una persona. Un
 *  curso puede aplicar entero y tener adentro alguna lección que no —
 *  ej. Cafetería sí, pero la lección de batidos no en Uruguay. */
export function leccionesDeLaPersona(lecciones, persona, sucursales = []) {
    return (lecciones || []).filter((l) => aplicaAlUsuario(l, persona, sucursales));
}
