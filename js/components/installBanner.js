/* ============================
   FARO v4
   components/installBanner.js

   Banner en el sidebar para "Agregar a inicio" en el celular. Solo
   se ve en celular (CSS, responsive.css) — en desktop no tiene
   sentido. Tres estados:
     - Ya instalada (standalone) → no se muestra nada.
     - Descartada por el usuario (botón X) → no se muestra hasta la
       próxima sesión (se guarda en localStorage).
     - Android/Chrome con el prompt real disponible → botón que
       dispara la instalación nativa.
     - iPhone/Safari (no tiene prompt nativo) → instrucción manual
       (Compartir → Agregar a inicio).
   Si no es iOS y todavía no llegó el evento beforeinstallprompt (por
   ejemplo Firefox, o Chrome que no lo disparó todavía), no se
   muestra nada — no hay nada útil que decirle a ese usuario.
=============================*/

import { Icon } from "./icons.js";
import { getItem, setItem } from "../services/storage.js";
import { hayPromptDisponible, esIOS, yaInstalada, dispararInstalacion } from "../services/installPrompt.js";

const CLAVE_DESCARTADO = "banner_instalar_oculto";

export function InstallBanner() {
    if (yaInstalada()) return "";
    if (getItem(CLAVE_DESCARTADO, false)) return "";

    const ios = esIOS();
    if (!ios && !hayPromptDisponible()) return "";

    return `
        <div class="sidebar-install-banner" data-install-banner>
            <button class="sidebar-install-cerrar" type="button" data-install-cerrar aria-label="Cerrar">${Icon("cerrar", { size: 14 })}</button>
            <span class="sidebar-install-icono">${Icon(ios ? "compartir" : "descargar", { size: 18 })}</span>
            <p>Instalá la app en tu celular</p>
            ${ios
                ? `<p class="sidebar-install-detalle">Tocá <strong>Compartir</strong> y elegí <strong>Agregar a inicio</strong></p>`
                : `<button class="btn btn-primary sidebar-install-btn" type="button" data-install-btn>Instalar</button>`}
        </div>
    `;
}

export function bindInstallBanner() {
    const banner = document.querySelector("[data-install-banner]");
    if (!banner) return;

    banner.querySelector("[data-install-cerrar]")?.addEventListener("click", () => {
        setItem(CLAVE_DESCARTADO, true);
        banner.remove();
    });

    banner.querySelector("[data-install-btn]")?.addEventListener("click", async () => {
        const resultado = await dispararInstalacion();
        if (resultado) banner.remove();
    });
}
