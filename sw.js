/* ============================
   FARO v4
   sw.js — Service worker mínimo

   No cachea nada a propósito (los datos vienen de Google Sheets vía
   Apps Script — cachear rompería la app mostrando datos viejos). Su
   único trabajo es existir con un handler de "fetch": Chrome usa eso
   como criterio de instalabilidad para disparar beforeinstallprompt
   (ver services/installPrompt.js) — sin esto, en Android el banner
   de "Instalá la app" nunca tiene nada real para ofrecer.
=============================*/

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
    evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
    // Sin respondWith: deja pasar el request tal cual, sin cachear.
});
