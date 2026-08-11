/* ============================
   Lucciano's Academy
   services/actualizacion.js — Aviso de versión nueva

   Problema real: el sitio es estático y sin build step, así que el
   navegador se queda con los .js en su caché HTTP. Alguien puede
   seguir usando una versión vieja por horas sin enterarse — y encima
   instalada como PWA no hay barra de direcciones para recargar. El
   síntoma es siempre el mismo: "el arreglo no me aparece".

   El service worker NO cachea nada (ver sw.js), así que no sirve para
   detectar esto: lo que retiene los archivos es la caché del
   navegador, no el SW.

   La versión publicada se lee del propio config.js pidiéndolo con un
   parámetro que cambia siempre, así esa lectura puntual no puede venir
   de la caché. A propósito NO se usa un version.json aparte: sería un
   segundo lugar donde subir el número, y tarde o temprano queda
   desincronizado del de config.js — que es justo la clase de problema
   que este archivo viene a evitar.
=============================*/

import { VERSION } from "../config.js";

/** Cada cuánto se pregunta si hay versión nueva. 15 minutos: alcanza
 *  para que alguien que deja la app abierta todo el día se entere, sin
 *  agregar tráfico notable (config.js pesa unos pocos KB). */
const INTERVALO_MS = 15 * 60 * 1000;

let avisoMostrado = false;

async function versionPublicada() {
    const resp = await fetch(`js/config.js?nocache=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return null;
    const texto = await resp.text();
    const m = texto.match(/VERSION\s*=\s*"([\d.]+)"/);
    return m ? m[1] : null;
}

function mostrarAviso(nueva) {
    if (avisoMostrado) return;
    avisoMostrado = true;

    const barra = document.createElement("div");
    barra.className = "aviso-actualizacion";
    barra.innerHTML = `
        <span>Hay una versión nueva (${nueva}).</span>
        <button class="btn btn-primary" type="button" id="btn-actualizar-app">Actualizar</button>
    `;
    document.body.appendChild(barra);

    barra.querySelector("#btn-actualizar-app").addEventListener("click", async () => {
        // El SW no cachea, pero si algún día lo hiciera esto evita que
        // el reload sirva lo viejo igual.
        try {
            if (window.caches) {
                const claves = await caches.keys();
                await Promise.all(claves.map((k) => caches.delete(k)));
            }
        } catch { /* si falla, el reload de abajo igual vale la pena */ }

        // Recarga con un parámetro nuevo: fuerza a pedir el documento de
        // nuevo en vez de servirlo de la caché, que es exactamente el
        // problema que estamos resolviendo.
        location.replace(`${location.pathname}?v=${nueva}${location.hash}`);
    });
}

async function chequear() {
    try {
        const publicada = await versionPublicada();
        if (publicada && publicada !== VERSION) mostrarAviso(publicada);
    } catch {
        // Sin conexión o servidor caído: no es un error que le importe
        // al usuario, se reintenta en el próximo chequeo.
    }
}

export function iniciarChequeoDeVersion() {
    // Al arrancar no: en ese momento acaba de bajar los archivos, así
    // que preguntarlo sería puro ruido. Se espera al primer intervalo.
    setInterval(chequear, INTERVALO_MS);

    // Volver a la app después de un rato es el momento más probable de
    // estar corriendo algo viejo — sobre todo en el celular, donde la
    // PWA queda en segundo plano días entre usos.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") chequear();
    });
}
