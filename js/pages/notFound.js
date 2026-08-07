/* ============================
   Lucciano's Academy
   pages/notFound.js — Ruta desconocida (#/algo-que-no-existe)

   A propósito NO redirige en silencio: si un Admin escribió mal
   una URL, es mejor avisarle que devolverlo a Inicio sin decir nada.
=============================*/

import { EmptyState } from "../components/emptyState.js";

export async function NotFound() {
    return EmptyState({
        titulo: "Página no encontrada",
        detalle: "La ruta que buscás no existe.",
        icono: "alertas",
        accionLabel: "Volver a Inicio",
        accionHref: "#/inicio",
    });
}
