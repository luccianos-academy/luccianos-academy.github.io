/* ============================
   Lucciano's Academy
   services/autoExpandirTextareas.js — Cuadros de texto que crecen solos

   Pedido explícito del usuario: "que cuando me limita a ver solo lo
   que está en pantalla... poder expandir y contraer a necesidad, como
   excel". Antes cada <textarea> tenía una altura fija chica (rows="2"
   o "3") con el resize nativo del navegador como única salida — había
   que arrastrar la esquina a mano cada vez que el texto no entraba, en
   CADA campo, de nuevo.

   Ahora cualquier <textarea> de la app crece solo con lo que se
   escribe (como una celda de Excel/Sheets) hasta una altura tope; de
   ahí en más aparece scroll interno en vez de seguir creciendo sin
   límite. El resize a mano (arrastrar la esquina) se mantiene como
   antes — esto es un piso automático, no reemplaza la posibilidad de
   agrandar/achicar manualmente si alguien lo prefiere.

   Se registra UNA sola vez para toda la app (bootstrap, ver app.js),
   mismo criterio que protegerMedia.js — así cubre cualquier textarea
   que aparezca en cualquier pantalla, incluidas las que se insertan
   después via innerHTML (modales, pasos agregados dinámicamente, el
   editor de lecciones), sin tener que tocar cada formulario.
=============================*/

// A partir de acá, scroll interno en vez de seguir creciendo — un
// pegado gigantesco no debería poder empujar el resto de la pantalla
// (footer del modal, botones de Guardar) fuera de vista.
const ALTURA_MAXIMA_PX = 480;

function ajustarAltura(textarea) {
    // "auto" primero: si no se resetea, scrollHeight solo puede crecer
    // (nunca refleja que el texto se borró y el cuadro debería achicarse).
    textarea.style.height = "auto";
    const alturaContenido = textarea.scrollHeight;
    const nuevaAltura = Math.min(alturaContenido, ALTURA_MAXIMA_PX);
    textarea.style.height = `${nuevaAltura}px`;
    textarea.style.overflowY = alturaContenido > ALTURA_MAXIMA_PX ? "auto" : "hidden";
}

function ajustarExistentes() {
    document.querySelectorAll("textarea").forEach(ajustarAltura);
}

export function autoExpandirTextareas() {
    if (document._autoExpandirListo) return;
    document._autoExpandirListo = true;

    // Delegado en el document (no un listener por textarea): cubre
    // también los que todavía no existen en este momento.
    document.addEventListener("input", (e) => {
        if (e.target.tagName === "TEXTAREA") ajustarAltura(e.target);
    });

    ajustarExistentes();

    // Modales y pasos/opciones agregados dinámicamente (editor de
    // lecciones, evaluaciones) insertan sus <textarea> mucho después de
    // este arranque — sin esto, arrancarían con la altura chica de
    // siempre hasta el primer tecleo.
    new MutationObserver((mutaciones) => {
        for (const m of mutaciones) {
            m.addedNodes.forEach((nodo) => {
                if (nodo.nodeType !== 1) return;
                if (nodo.tagName === "TEXTAREA") ajustarAltura(nodo);
                nodo.querySelectorAll?.("textarea").forEach(ajustarAltura);
            });
        }
    }).observe(document.body, { childList: true, subtree: true });
}
