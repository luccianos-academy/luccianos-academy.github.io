/* ============================
   Lucciano's Academy
   app.js — Bootstrap
=============================*/

import { initRouter } from "./router.js";
import { bindTooltips } from "./services/tooltips.js";
import { protegerMedia } from "./services/protegerMedia.js";
import { autoExpandirTextareas } from "./services/autoExpandirTextareas.js";
import { bindAvatarFallback } from "./components/avatar.js";
import { iniciarChequeoDeVersion } from "./services/actualizacion.js";
import { haySesion, getUsuarioActual, login, logout, estaViendoComo } from "./services/auth.js";
import { registrarSesionFirebase, registrarEjecutorAcciones } from "./services/sesionFirebase.js";
import { revalidarPushSiYaEstaConcedido } from "./services/push.js";
import "./services/google.js"; // Cargar antes de syncManager
import "./services/indexeddb.js";
import "./services/syncManager.js";
import { USAR_FIRESTORE } from "./config.js";
import { registrarFuenteFirestore } from "./services/dataSource.js";
import { iniciarI18n } from "./i18n/i18n.js";

// Wait for idbManager and syncManager to be available in window
async function waitForServices() {
    return new Promise(resolve => {
        const checkInterval = setInterval(() => {
            if (window.idbManager && window.syncManager) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 50);
    });
}

async function initApp() {
    try {
        // Wait for services to be globally available
        await waitForServices();
        
        // IndexedDB SÍ se espera: es la caché local desde la que
        // fetchSheet lee, y sin ella la primera pantalla iría a la red
        // aunque los datos ya estuvieran guardados del uso anterior.
        console.log('[APP] Initializing IndexedDB...');
        await window.idbManager.init();

        // El sync NO se espera. Antes sí, y eso bloqueaba el arranque
        // entero detrás de una llamada de red que lee las 8 hojas: la
        // app no dibujaba nada hasta que volviera. Es justo al revés de
        // lo que la arquitectura offline-first promete — la gracia de
        // tener copia local es pintar YA con lo que hay y actualizar
        // después.
        //
        // No esperar es seguro: fetchSheet cae a la red por su cuenta si
        // la copia local está vacía (primer uso), así que lo peor que
        // pasa es lo que pasaba siempre. Y en cualquier arranque
        // posterior la pantalla sale al toque desde IndexedDB mientras
        // el sync se pone al día en segundo plano.
        // Con Firebase el sincronizador heredado (el de la app vieja contra Apps Script) no tiene nada que hacer:
        // ya no se arranca. Las pantallas leen de firestoreSource.js, que cuida su propia copia en el dispositivo.
        if (!USAR_FIRESTORE) {
            console.log('[APP] Initializing Sync Manager (en segundo plano)...');
            window.syncManager.init().catch((err) => {
                console.warn('[APP] Sync en segundo plano falló:', err);
            });
        }

        if (USAR_FIRESTORE) {
            // Carga perezosa: con el interruptor apagado ni se descarga el SDK de Firebase.
            const { iniciarFirestore } = await import("./services/firestoreLoader.js");
            const { fuente, sesion } = await iniciarFirestore(getUsuarioActual);
            registrarFuenteFirestore(fuente);
            import("./components/pendientesSync.js").then((m) => m.iniciarPendientesSync(fuente)).catch(() => {});
            registrarSesionFirebase(sesion);
            registrarEjecutorAcciones((accion, payload) => fuente.ejecutarAccion(accion, payload));
            // Si volvemos de una redirección de Google (celulares que bloquean la ventana), se completa acá.
            await sesion.esperarEstadoInicial();
            const vuelta = await sesion.completarRedireccion().catch((err) => ({ ok: false, error: err.message }));
            if (vuelta && vuelta.ok) login(vuelta.usuario);
            else if (vuelta && vuelta.error) sessionStorage.setItem("faro_error_login", vuelta.error);
            // La sesión de la app y la de Firebase tienen que ir juntas: si Firebase la perdió
            // (vencimiento, otro dispositivo, borrado de datos), las reglas negarían todo.
            if (haySesion() && !sesion.haySesionFirebase()) logout();
            // Sesión ya abierta de antes (la de Firebase no vence): se deja el "Ingreso de X", se renueva el acceso por uso y se
            // comprueba que la cuenta siga activa. En segundo plano y como mucho cada 6 h por dispositivo (services/chequeoAcceso.js).
            if (haySesion() && !estaViendoComo()) {
                Promise.all([import("./services/chequeoAcceso.js"), import("./data/auditoria.js")]).then(async ([{ chequearAccesoAlAbrir }, { registrarEvento }]) => {
                    const r = await chequearAccesoAlAbrir({ sesion, usuario: getUsuarioActual(), registrarEvento });
                    if (r.ok) login(r.usuario);
                    else if (r.ok === false) { sessionStorage.setItem("faro_error_login", r.error); logout(); location.hash = "#/login"; location.reload(); }
                }).catch((err) => console.warn("[APP] No se pudo revisar el acceso:", err));
            }
            console.log('[APP] Firestore listo.');
        }

        // Idiomas (i18n/i18n.js): antes del router, así la primera pantalla ya
        // sale en el idioma de la persona. Para quien usa español no carga nada.
        await iniciarI18n();

        console.log('[APP] Initializing Router...');
        initRouter();
        bindTooltips();
        protegerMedia();
        autoExpandirTextareas();
        // Antes de que se pinte cualquier avatar: si una foto no carga,
        // caer a las iniciales en vez del ícono de imagen rota.
        bindAvatarFallback();
        // Avisa si se publicó una versión nueva mientras la app estaba
        // abierta — instalada como PWA no hay forma de darse cuenta.
        iniciarChequeoDeVersion();

        // Push: si el permiso ya está concedido pero el token real
        // quedó viejo/inválido (service worker reinstalado, storage
        // limpiado por inactividad, etc.), nadie se enteraba hasta
        // entrar a Mi Perfil a mano — se revalida solo, en segundo
        // plano, en cada carga. No pide permiso de nuevo ni bloquea el
        // arranque (ver revalidarPushSiYaEstaConcedido).
        if (haySesion()) {
            revalidarPushSiYaEstaConcedido(getUsuarioActual());
        }

        console.log('[APP] ✅ App fully initialized');
    } catch (err) {
        console.error('[APP] ❌ Initialization error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Registra el service worker
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // Primera visita: el service worker todavía no controlaba la página cuando pidió sus archivos; se los
    // pasamos para que la app abra sin internet desde el primer día (ver sw.js, mensaje "guardar-recursos").
    const pasarRecursosAlServiceWorker = async () => {
        try {
            const registro = await navigator.serviceWorker.ready;
            const urls = [location.href.split("#")[0], ...performance.getEntriesByType("resource").map((r) => r.name)];
            registro.active?.postMessage({ tipo: "guardar-recursos", urls });
        } catch (err) { /* sin service worker: la app funciona igual, solo que sin modo sin conexión */ }
    };
    // Dos veces: al cargar, y unos segundos después (el SDK de Firebase y las pantallas se piden un poco más tarde).
    window.addEventListener("load", () => { pasarRecursosAlServiceWorker(); setTimeout(pasarRecursosAlServiceWorker, 7000); });
}

// Aviso de "sin conexión": la app sigue andando con lo guardado y lo que se marque se manda al volver la señal.
(function avisoSinConexion() {
    const barra = document.createElement("div");
    barra.id = "aviso-sin-conexion";
    barra.setAttribute("role", "status");
    barra.textContent = "Sin conexión — usás lo último guardado. Lo que marques se envía solo cuando vuelva la señal.";
    barra.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;padding:6px 12px;text-align:center;font-size:12px;"
        + "background:#6b4f12;color:#fff;display:none;pointer-events:none";
    const actualizar = () => { barra.style.display = navigator.onLine ? "none" : "block"; };
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    document.addEventListener("DOMContentLoaded", () => { document.body.appendChild(barra); actualizar(); });
    if (document.body) { document.body.appendChild(barra); actualizar(); }
})();

// Expose debug utilities globally
window.lucciano = window.lucciano || {};
window.lucciano.debug = {
    getIndexedDBSize: () => window.idbManager?.getDBSize(),
    forceSyncNow: () => window.syncManager?.forceSyncNow(),
    clearLocalDB: () => window.idbManager?.clearAll(),
    getSyncStatus: () => window.syncManager?.getStatus(),
    exportDB: () => window.idbManager?.exportDB()
};

console.log('[APP] Debug tools available at window.lucciano.debug');
