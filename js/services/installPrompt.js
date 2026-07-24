/* ============================
   FARO v4
   services/installPrompt.js

   "Agregar a inicio" del celular. Android/Chrome tiene un evento real
   (beforeinstallprompt) que se puede disparar con un botón — se
   captura acá, UNA sola vez al cargar la app (no en cada navegación,
   si no se pierde el evento). iPhone/Safari no tiene ese evento, la
   única forma de instalar ahí es manual (Compartir → Agregar a
   inicio) — por eso esIOS() existe, para mostrar esa instrucción en
   vez de un botón que ahí nunca funcionaría.
=============================*/

let promptDiferido = null;

window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    promptDiferido = evento;
});

window.addEventListener("appinstalled", () => {
    promptDiferido = null;
});

export function hayPromptDisponible() {
    return !!promptDiferido;
}

export async function dispararInstalacion() {
    if (!promptDiferido) return null;
    promptDiferido.prompt();
    const resultado = await promptDiferido.userChoice;
    promptDiferido = null;
    return resultado;
}

export function esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Ya corriendo como app instalada (standalone) — no tiene sentido
 *  ofrecer instalarla de nuevo. */
export function yaInstalada() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
