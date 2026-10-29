/* ============================
   Lucciano's Academy
   services/alcanceContenido.js — Qué contenido "tiene" un local o un país (para la pantalla Locales)

   Una sola cuenta, la MISMA que usa la app para mostrarle contenido a la gente (services/alcance.js, aplicaAlUsuario), para que la lista
   de Locales y el modal "Contenido" nunca se contradigan:
     · noAplicaA  — exclusiones: nombra locales o países. Gana siempre.
     · aplicaA    — "solo aplica a": si tiene algo, lo que no nombra al local (o a su país) NO lo tiene.
     · un local hereda lo que excluye su país, y lo que "solo aplica a" otro país.
   `paisDe(ambito)` devuelve el país de un local ("" si el ámbito ya es un país).
=============================*/

import { normalizar } from "./alcance.js";

const lista = (texto) => String(texto || "").split(",").map((s) => normalizar(s)).filter(Boolean);

/** ¿El ámbito (un local o un país) tiene este ítem? por: "propio" (lo excluye él), "pais" (lo excluye su país) o "solo" (solo aplica a otros). */
export function diagnostico(item, ambito, paisDe = () => "") {
    const no = lista(item && item.noAplicaA), si = lista(item && item.aplicaA);
    const a = normalizar(ambito), p = normalizar(paisDe(ambito));
    if (no.includes(a)) return { tiene: false, por: "propio" };
    if (p && no.includes(p)) return { tiene: false, por: "pais" };
    if (si.length && !si.includes(a) && !(p && si.includes(p))) return { tiene: false, por: "solo" };
    return { tiene: true };
}

/** Con varios ámbitos: "si" (todos lo tienen), "no" (ninguno) o "mezcla". `heredado`: algún ámbito lo pierde por su país o por "solo aplica a". */
export function estadoEnAmbitos(item, ambitos, paisDe) {
    const d = ambitos.map((a) => diagnostico(item, a, paisDe));
    const tienen = d.filter((x) => x.tiene).length;
    return {
        estado: tienen === ambitos.length ? "si" : tienen === 0 ? "no" : "mezcla",
        heredado: d.some((x) => x.por === "pais" || x.por === "solo"),
        porPais: d.some((x) => x.por === "pais"),
        porSolo: d.some((x) => x.por === "solo"),
    };
}

function sinEstos(texto, quitar) {
    const bajos = quitar.map(normalizar);
    return String(texto || "").split(",").map((s) => s.trim()).filter((s) => s && !bajos.includes(normalizar(s)));
}

/** Los campos nuevos de un ítem después de tildarlo (habilitar) o destildarlo en estos ámbitos. */
export function alcanceTrasCambio(item, ambitos, paisDe, habilitar) {
    if (!habilitar) {
        return { noAplicaA: [...sinEstos(item && item.noAplicaA, ambitos), ...ambitos].join(", "), aplicaA: String((item && item.aplicaA) || "") };
    }
    // Habilitar: se le saca la exclusión propia Y la del país (un local no puede tener lo que su país excluye)…
    const quitar = ambitos.flatMap((a) => [a, paisDe(a)].filter(Boolean));
    const noAplicaA = sinEstos(item && item.noAplicaA, quitar).join(", ");
    // …y si el ítem es "solo aplica a X", se suma el ámbito a esa lista.
    let aplicaA = String((item && item.aplicaA) || "");
    if (lista(aplicaA).length) {
        const si = lista(aplicaA);
        const faltan = ambitos.filter((a) => !si.includes(normalizar(a)) && !(paisDe(a) && si.includes(normalizar(paisDe(a)))));
        aplicaA = [...String(aplicaA).split(",").map((s) => s.trim()).filter(Boolean), ...faltan].join(", ");
    }
    return { noAplicaA, aplicaA };
}
