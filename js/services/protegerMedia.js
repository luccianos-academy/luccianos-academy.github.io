/* ============================
   Lucciano's Academy
   services/protegerMedia.js — Desalentar la descarga casual de fotos/video

   Pedido explícito del usuario: contenido de marca (fotos y videos de
   producto/procedimiento) bajo contrato de confidencialidad — no
   debería aparecer ninguna opción que diga "Descargar" en ningún lado
   de la app.

   Esto NO hace que sea imposible sacar el archivo (una captura o
   grabación de pantalla siempre está fuera del alcance de cualquier
   sitio web) — bloquea los tres caminos fáciles y casuales:
     1. Clic derecho → "Guardar imagen/video como..." (desktop).
     2. Mantener apretado → "Guardar imagen"/"Agregar a Fotos" (celular).
     3. El botón de descarga nativo que Chrome dibuja solo en los
        controles de <video> (la flechita hacia abajo).

   Se registra UNA sola vez para toda la app (bootstrap, ver app.js),
   mismo criterio que bindTooltips() — así cubre cualquier imagen o
   video que aparezca en cualquier pantalla, incluidas las que se
   insertan después via innerHTML (carruseles, galerías de producto),
   sin tener que tocar cada lugar que dibuja un <img> o un <video>.
=============================*/

/** Video agregado a la página después de que esto ya corrió (carrusel
 *  que recién ahora insertó su innerHTML, por ejemplo) — controlsList
 *  es una propiedad seteable en cualquier momento, no hace falta que
 *  esté en el HTML original. disablePictureInPicture saca además el
 *  botón de PiP, que abre su propio camino para grabar/recortar. */
function protegerVideo(video) {
    if (video.dataset.protegido) return;
    video.dataset.protegido = "1";
    try {
        video.controlsList.add("nodownload", "noremoteplayback");
    } catch {
        // Navegador viejo sin controlsList — no rompe nada, sigue sin
        // el botón nativo bloqueado pero el resto de las protecciones
        // (clic derecho, long-press) sigue funcionando igual.
    }
    video.disablePictureInPicture = true;
}

function protegerVideosExistentes() {
    document.querySelectorAll("video").forEach(protegerVideo);
}

export function protegerMedia() {
    if (document._proteccionMediaLista) return;
    document._proteccionMediaLista = true;

    // Clic derecho sobre cualquier imagen o video de la app — cubre
    // "Guardar imagen como.../Guardar video como...". No se toca el
    // resto de la pantalla: clic derecho en un texto o en el fondo
    // sigue funcionando normal.
    document.addEventListener("contextmenu", (e) => {
        if (e.target.closest("img, video")) e.preventDefault();
    });

    // Arrastrar una imagen fuera de la ventana (a otra app, al
    // Escritorio) es otro camino de guardado casual en desktop.
    document.addEventListener("dragstart", (e) => {
        if (e.target.closest("img, video")) e.preventDefault();
    });

    protegerVideosExistentes();

    // Carruseles/galerías insertan sus <video> mucho después de este
    // arranque (navegación a una lección, apertura de un modal) — sin
    // esto, cualquier video que no exista TODAVÍA en el momento en que
    // corre este archivo se quedaría sin el controlsList aplicado.
    new MutationObserver((mutaciones) => {
        for (const m of mutaciones) {
            m.addedNodes.forEach((nodo) => {
                if (nodo.nodeType !== 1) return;
                if (nodo.tagName === "VIDEO") protegerVideo(nodo);
                nodo.querySelectorAll?.("video").forEach(protegerVideo);
            });
        }
    }).observe(document.body, { childList: true, subtree: true });
}
