/* ============================
   Lucciano's Academy
   services/badgeComunicaciones.js — Cache compartida del contador de
   "no leídas" en Comunicaciones (mismo espíritu que el contador de la
   campana de News, topbar.js).

   Nace de un bug real reportado en vivo (2026-08-19): sidebar.js y
   bottomNav.js tenían CADA UNO su propia copia de este número, cada
   una con su propio "ya lo pedí, no lo pido de nuevo" — así que abrir
   una publicación (que la marca como leída) no tenía forma de avisarle
   a NINGUNA de las dos que el número bajó. El badge quedaba pegado en
   lo que fuera al primer cálculo, para siempre.

   Ahora hay UNA sola cache, y quien la cambia (acá o desde afuera, ver
   decrementarNoLeidas) avisa a todos los que se suscribieron —
   sidebar y bottom nav pintan siempre el mismo número, sin importar
   cuál de los dos disparó el cambio.
=============================*/

import { contarPublicacionesNoLeidas } from "../data/publicaciones.js";

let cache = 0;
let usuarioIdCacheado = null;
const suscriptores = new Set();

function avisar() {
    suscriptores.forEach((fn) => fn(cache));
}

/** Se llama una vez por consumidor (sidebar.js, bottomNav.js) cuando
 *  se monta — pinta con lo que ya haya en cache de una, y de ahí en
 *  más recibe cualquier cambio futuro sin tener que volver a pedir
 *  nada. Devuelve una función para desuscribirse (no se usa hoy,
 *  queda por prolijidad). */
export function suscribirseANoLeidas(fn) {
    suscriptores.add(fn);
    fn(cache);
    return () => suscriptores.delete(fn);
}

/** Pedido inicial — solo pega a la red la primera vez por usuario
 *  (comparando id), igual que antes. Llamar en cada render del
 *  sidebar/bottom nav es barato: si ya se pidió para este usuario,
 *  no hace nada. */
export async function asegurarNoLeidas(usuario) {
    if (!usuario || usuario.rol === "colaborador") return;
    if (String(usuarioIdCacheado) === String(usuario.id)) return;
    usuarioIdCacheado = usuario.id;
    cache = await contarPublicacionesNoLeidas(usuario);
    avisar();
}

/** Recalcula de cero contra el backend — usar cuando no se puede
 *  saber de antemano si el número subió, bajó o quedó igual (ej. se
 *  entra de nuevo a Comunicaciones después de un rato afuera). */
export async function refrescarNoLeidas(usuario) {
    if (!usuario || usuario.rol === "colaborador") return;
    cache = await contarPublicacionesNoLeidas(usuario);
    avisar();
}

/** Ya se sabe que el número baja en "n" (se acaba de marcar como
 *  leída una publicación) — ajustar en memoria y avisar es
 *  instantáneo, evita esperar un round-trip solo para confirmar algo
 *  que ya se sabe del lado del cliente. Mismo criterio que
 *  decrementarContadorCampana() en topbar.js. */
export function decrementarNoLeidas(n = 1) {
    cache = Math.max(0, cache - n);
    avisar();
}
