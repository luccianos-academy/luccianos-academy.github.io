/* ============================
   Lucciano's Academy (app Firebase)
   services/firestoreLoader.js — arranque de Firestore en el navegador

   Carga el SDK modular de Firebase desde gstatic (la app no tiene paso de
   compilación), abre Firestore con caché persistente en el dispositivo y arma la
   fuente de datos (firestoreSource.js). Solo se usa si USAR_FIRESTORE está en true.
=============================*/

import { FIREBASE_CONFIG, ES_LOCAL_DEV, AVISOS_URL } from "../config.js";
import { crearFirestoreSource } from "./firestoreSource.js";
import { crearSesionFirebase } from "./firebaseAuth.js";
import { medicionActiva, medirLecturas } from "./medidorLecturas.js";
import { crearAlmacenIDB } from "./almacenListas.js";
import { getLocalesElegidos } from "./preferenciasLocales.js";

const VERSION_SDK = "12.19.0";
const BASE = `https://www.gstatic.com/firebasejs/${VERSION_SDK}`;

/** Achica una foto a una miniatura cuadrada (para el ranking del Desafío). Un enlace (Drive) se deja como está.
 *  Sale ~2 KB con 48 px: así el resumen del mes entra holgado en el límite de 1 MB de un documento. */
export async function miniaturaDeFoto(foto, lado = 48) {
    const f = String(foto || "");
    if (!f.startsWith("data:")) return f.length <= 6000 ? f : "";
    try {
        const imagen = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("no se pudo leer la foto"));
            i.src = f;
        });
        const lienzo = document.createElement("canvas");
        lienzo.width = lienzo.height = lado;
        const lado0 = Math.min(imagen.width, imagen.height);          // recorte cuadrado al centro
        lienzo.getContext("2d").drawImage(imagen, (imagen.width - lado0) / 2, (imagen.height - lado0) / 2, lado0, lado0, 0, 0, lado, lado);
        return lienzo.toDataURL("image/jpeg", 0.6);
    } catch (err) {
        return "";    // sin miniatura: en el ranking se ven las iniciales
    }
}

/** Devuelve { app, db, sdk, fuente, auth, sesion }. `getUsuario` es la sesión de la app (formato planilla). */
export async function iniciarFirestore(getUsuario) {
    if (!FIREBASE_CONFIG.projectId) {
        throw new Error("Falta FIREBASE_CONFIG en js/config.js: no hay proyecto Firebase al que conectarse.");
    }
    const [{ initializeApp }, sdk, sdkAuth] = await Promise.all([
        import(`${BASE}/firebase-app.js`),
        import(`${BASE}/firebase-firestore.js`),
        import(`${BASE}/firebase-auth.js`),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    // Caché persistente (IndexedDB) compartida entre pestañas: la app abre sin red con lo último que vio. OJO: no baja el gasto
    // de lecturas de las consultas (getDocs va igual al servidor); eso se cuida en firestoreSource.js (memoria, incremental, en vivo).
    const db = sdk.initializeFirestore(app, {
        localCache: sdk.persistentLocalCache({ tabManager: sdk.persistentMultipleTabManager() }),
    });
    // Solo en localhost: para probar el modo sin conexión desde la consola (disableNetwork / enableNetwork).
    if (ES_LOCAL_DEV) window.__firebaseDev = { db, sdk };
    const auth = sdkAuth.getAuth(app);   // la sesión de Firebase se guarda sola en el dispositivo
    return {
        app, db, sdk, auth,
        fuente: crearFirestoreSource({ db, sdk: medicionActiva() ? medirLecturas(sdk) : sdk, getUsuario, almacen: crearAlmacenIDB(), avisosUrl: AVISOS_URL, getLocalesExtra: () => { const u = getUsuario(); return u ? getLocalesElegidos(u) : []; }, miniaturaFoto: miniaturaDeFoto }),
        sesion: crearSesionFirebase({ auth, db, sdkAuth, sdkFs: sdk }),
    };
}
