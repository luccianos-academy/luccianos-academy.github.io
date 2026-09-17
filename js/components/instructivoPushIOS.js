/* ============================
   Lucciano's Academy
   components/instructivoPushIOS.js

   Los 4 pasos para activar notificaciones en iPhone, en un modal.
   Un solo lugar para no tener dos explicaciones distintas del mismo
   problema — antes el banner de Inicio mostraba estos pasos y Mi
   Perfil mostraba solo un párrafo de texto sin instructivo.
=============================*/

import { Icon } from "./icons.js";
import { Modal, abrirModal } from "./modal.js";

export const INSTRUCTIVO_PUSH_IOS_ID = "modal-push-ios";

/** El camino real, contra capturas de un iPhone de verdad (2026-09,
 *  iOS 18): Safari ya no tiene Compartir suelto en la barra — está
 *  detrás de los "···" —, y "Agregar a Inicio" no figura entre los
 *  accesos rápidos del menú de compartir: recién aparece al tocar
 *  "Ver más". Esos dos desvíos eran justo donde la persona se quedaba
 *  trabada. El ícono de Compartir se nombra igual porque en iPhones
 *  más viejos sigue estando directo en la barra.
 *
 *  Los nombres van tal cual los escribe iOS en español ("Agregar a
 *  Inicio", con Inicio en mayúscula): la persona los está buscando
 *  con la vista en una lista larga. */
function pasosHtml() {
    const pasos = [
        `Abajo en Safari, tocá <strong>···</strong> o el ícono ${Icon("compartir", { size: 15 })} <strong>Compartir</strong>`,
        `Tocá <strong>Ver más</strong>`,
        `Elegí <strong>Agregar a Inicio</strong> y confirmá con <strong>Agregar</strong>`,
        `Entrá por el ícono nuevo y tocá <strong>Activar</strong> cuando aparezca el aviso`,
    ];

    // El texto va envuelto en un <span>: el <li> es flex (para alinear
    // el número con el texto) y sin envoltura cada <strong> y cada
    // ícono se vuelve un flex item suelto — los pasos se partían en
    // columnas en vez de leerse como una frase.
    return `
        <ol class="pasos-ios">
            ${pasos.map((p) => `<li><span>${p}</span></li>`).join("")}
        </ol>
        <p class="pasos-ios-nota">El último paso es el que activa los avisos — agregar la app sola no alcanza.</p>
    `;
}

export function abrirInstructivoPushIOS() {
    abrirModal(
        Modal({
            id: INSTRUCTIVO_PUSH_IOS_ID,
            titulo: "Recibir avisos en iPhone",
            contenidoHtml: pasosHtml(),
            textoConfirmar: "",
        }),
        INSTRUCTIVO_PUSH_IOS_ID
    );
}
