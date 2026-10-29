/* ============================
   Lucciano's Academy (app Firebase)
   services/firestoreSource.js — capa de datos sobre Firestore

   Reemplaza a google.js + el caché de IndexedDB de dataSource.js con la MISMA
   interfaz hacia el resto de la app: fetchSheet / writeSheet / updateSheet /
   deleteSheet / invalidar / invalidarTodo. Las pantallas y js/data/*.js siguen
   hablando en "hojas" y filas planas; acá se traduce a colecciones y documentos
   (DISENO_FIREBASE.md §3 y §8) y se respetan las reglas de firestore.rules.

   Se arma con una fábrica que recibe el SDK de Firestore por parámetro:
   - en el navegador lo carga firestoreLoader.js (módulos de gstatic);
   - en las pruebas (tests/firestoreSource.test.mjs) se inyecta el paquete npm,
     contra el emulador y con las reglas reales.

   Alcance de esta primera tanda: contenido (paquetes), Usuarios, Asignaciones,
   Resultados, Noticias, Auditoria, Tokens.
   Gestión de tareas y Desafío todavía NO: piden un error claro en vez de fallar
   en silencio.
=============================*/

import { cicloActual } from "./gestionCiclo.js";
import { parsearFirmaSubitem, serializarFirmaSubitem } from "./subitems.js";
import { localesDeSupervisor } from "./supervisores.js";

// Hojas de contenido casi estático: un documento "paquete" por hoja, contenido/{hoja}.items
const PAQUETES = [
    "Cursos", "Lecciones", "Evaluaciones", "Sucursales",
    "Disponibilidad", "Manuales", "Recursos", "GestionTareas",
    "Traducciones",     // el diccionario interno de idiomas (Configuración → Traducciones): una sola lectura al arrancar
];

// Hojas con un documento por fila.
const COLECCIONES = {
    Usuarios: "usuarios",
    Asignaciones: "asignaciones",
    Resultados: "resultados",
    Noticias: "noticias",
    Auditoria: "auditoria",
    Tokens: "tokens",
};

// Hojas con un modelo propio (no "un documento por fila"): Gestión de tareas y Desafío.
const ESPECIALES = ["GestionTareasSucursal", "GestionChecks", "DesafioResultados", "DesafioHistorial"];
const DIAS_ISO = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// En la planilla son "SI"/"NO"; las reglas de Firestore necesitan booleanos.
const FLAGS_USUARIO = ["activo", "encargado", "responsableTurno", "capacitador", "tienePush"];

// El vencimiento de acceso es una FECHA ("2026-11-16") que vale hasta el final de ese
// día en Argentina (UTC-3), igual que hoy: el backend lo considera vencido recién al día siguiente.
const UTC_MENOS_3_MS = 3 * 3600 * 1000;

const MAX_AUDITORIA = 200;

// Si una escritura no se confirma en este tiempo (sin señal, red lenta), la app sigue: Firestore la deja
// en cola en el teléfono y la manda sola al volver la conexión. Si el servidor la RECHAZA antes (ej. las
// reglas), el error sí llega a quien escribió.
const ESPERA_ESCRITURA_MS = 2500;
const MAX_FOTO_PERFIL = 120000;
const MAX_MINIATURA = 6000;        // caracteres de la miniatura del ranking (las reglas también lo exigen)
const PUESTOS_CON_FOTO = 12;       // el ranking muestra el Top 10 y tu puesto: solo de esos se traen las fotos

/** Sin navegador (pruebas) no se puede achicar una imagen: se deja pasar solo lo que ya es chico (ej. un enlace). */
async function miniaturaPorDefecto(foto) {
    const f = String(foto || "");
    return f.length <= MAX_MINIATURA ? f : "";
}   // caracteres del data URL (~90 KB)

function confirmarBase(promesa) {
    return new Promise((resolve, reject) => {
        let seguimos = false;
        const reloj = setTimeout(() => { seguimos = true; resolve({ pendiente: true }); }, ESPERA_ESCRITURA_MS);
        promesa.then(
            () => { clearTimeout(reloj); if (!seguimos) resolve({}); },
            (err) => {
                clearTimeout(reloj);
                if (seguimos) console.warn("[firestore] Una escritura que había quedado pendiente fue rechazada:", err);
                else reject(err);
            }
        );
    });
}

/* ---------- convertidores puros (también los usa firebaseAuth.js para armar la sesión) ---------- */
const numeroSiPuede = (v) => (v !== "" && v != null && !isNaN(v) ? Number(v) : v);

/** Timestamp (o milisegundos) → "2026-11-16", mirando el día en Argentina. */
export function timestampAFecha(ts) {
    if (!ts) return "";
    const ms = typeof ts.toMillis === "function" ? ts.toMillis() : Number(ts);
    return new Date(ms - UTC_MENOS_3_MS).toISOString().slice(0, 10);
}

/** Documento de Firestore → fila con el formato de la planilla que esperan las pantallas. */
export function desdeFirestore(hoja, data, idDelDoc) {
    const fila = { ...data };
    if (fila.id === undefined) fila.id = numeroSiPuede(idDelDoc);
    if (hoja === "Usuarios") {
        FLAGS_USUARIO.forEach((k) => { if (k in fila) fila[k] = fila[k] === true ? "SI" : "NO"; });
        fila.fechaVencimientoAcceso = timestampAFecha(fila.fechaVencimientoAcceso);
        fila._clave = idDelDoc;       // con qué clave está guardado el documento: para entrar tiene que ser igual al correo (ver cambiarCorreoDeUsuario)
    }
    // "leidoPor" es texto en la planilla ("1,46,30") y arreglo en Firestore.
    if (hoja === "Noticias" && Array.isArray(fila.leidoPor)) fila.leidoPor = fila.leidoPor.join(",");
    if (hoja === "GestionChecks") {
        ["hecho", "cerrada"].forEach((k) => { fila[k] = fila[k] === true ? "SI" : "NO"; });
    }
    return fila;
}

/** "2026-10" del mes en que cae ese instante (hora local de quien juega, igual que hoyISO en data/desafio.js). */
export function mesDe(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** ¿Hoy es ese día de Gestión? "Lunes".."Domingo" o el número del día del mes ("15").
 *  Mismo corte que el backend (_esDiaDeHoyGestion): el día "cambia" a las 04:00, no a medianoche. */
export function esDiaDeHoy(dia, ms) {
    const efectiva = new Date(ms - 4 * 3600 * 1000);
    const dow = efectiva.getDay();                        // domingo=0
    return String(dia) === DIAS_ISO[dow === 0 ? 7 : dow] || String(dia) === String(efectiva.getDate());
}

/** "2026-11-16" → instante del final de ese día en Argentina (en milisegundos). */
export function finDeDiaEnMs(texto) {
    const t = String(texto || "").trim();
    if (!t) return null;
    const ms = Date.parse(`${t.slice(0, 10)}T23:59:59.000-03:00`);
    return isNaN(ms) ? null : ms;
}

export function crearFirestoreSource({ db, sdk, getUsuario, ahora = () => Date.now(), cacheMs = 20000, escuchas = undefined, almacen = null, avisosUrl = "", getLocalesExtra = () => [], miniaturaFoto = miniaturaPorDefecto, fetchFn = typeof fetch === "function" ? fetch : null }) {
    const {
        doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
        orderBy, limit, runTransaction, writeBatch, deleteField, serverTimestamp, Timestamp,
    } = sdk;

    const cache = {};      // { [hoja]: { datos, ts } }
    const enVuelo = {};    // dedupe de pedidos simultáneos de una misma hoja

    /* ---------- cuidado del cupo de lecturas (Spark: 50.000 por día) ----------
       Cada documento que baja de Firestore es una lectura. Tres reglas para no gastarlas de más:
       1) Las listas grandes (Usuarios, Asignaciones, Resultados) duran minutos en memoria, no segundos; cualquier escritura
          propia las invalida, y el botón de refrescar de la barra las vuelve a pedir.
       2) La Auditoría, una vez leída, solo pide lo NUEVO (creadoEn mayor al último que ya tiene).
       3) Las marcas de Gestión de un local se siguen con una escucha en vivo: cuesta una lectura por cada marca que cambia
          y cero mientras nadie toca nada (antes: todas las marcas del local cada 5 segundos).
       Con cacheMs = 0 (las pruebas) nada de esto actúa: cada lectura va al servidor. */
    const TTL_LISTAS_MS = 5 * 60 * 1000;
    const TTL_LISTAS_INCREMENTAL_MS = 60 * 1000;      // con lectura incremental, repasar cada minuto cuesta ~1 lectura por lista
    const TTL_PAQUETES_MS = 2 * 60 * 1000;
    const TTL_AUDITORIA_MS = 60 * 1000;
    const TTL_NOTICIAS_MS = 60 * 1000;
    const TTL_DESAFIO_MS = 3 * 60 * 1000;                 // el ranking cuesta ~15 lecturas por visita: se repasa cada 3 min
    const TTL_DESAFIO_HISTORIAL_MS = 10 * 60 * 1000;      // meses ya cerrados
    function ttlDe(hoja) {
        if (cacheMs <= 0) return 0;
        if (hoja === "Usuarios" || hoja === "Asignaciones" || hoja === "Resultados") return almacen && (esGestion(yo()) || yo().encargado) ? Math.max(cacheMs, TTL_LISTAS_INCREMENTAL_MS) : Math.max(cacheMs, TTL_LISTAS_MS);
        if (hoja === "Auditoria") return Math.max(cacheMs, TTL_AUDITORIA_MS);
        if (hoja === "DesafioResultados") return Math.max(cacheMs, TTL_DESAFIO_MS);       // jugar invalida la propia; los demás cambian de a poco
        if (hoja === "DesafioHistorial") return Math.max(cacheMs, TTL_DESAFIO_HISTORIAL_MS);
        if (hoja === "Noticias") return Math.max(cacheMs, TTL_NOTICIAS_MS);
        if (PAQUETES.includes(hoja) || hoja === "GestionTareasSucursal") return Math.max(cacheMs, TTL_PAQUETES_MS);
        return cacheMs;
    }
    let auditoriaUltimoMs = 0;
    // Lecturas incrementales de las 3 listas grandes (solo Admin/Supervisor, y solo si hay almacén en el dispositivo):
    // cada documento lleva `modificadoEn` (ms) puesto por cada escritura; se guarda la lista leída y la próxima vez se piden
    // solo los documentos con `modificadoEn` mayor al último visto. Una lectura completa de respaldo cada 24 h por si algo
    // (un borrado hecho desde otro equipo, un reloj atrasado) no se vio. Nunca falla hacia afuera: sin copia, se lee completo.
    const INCREMENTALES = ["Usuarios", "Asignaciones", "Resultados"];
    const COMPLETA_CADA_MS = 7 * 24 * 60 * 60 * 1000;      // red de seguridad; los borrados se avisan aparte (meta/borrados)
    const SOLAPE_MS = 5 * 60 * 1000;
    // "Copia primero": cada lista que se lee se guarda en el dispositivo con la hora. Al abrir la app (o volver a una pantalla) se
    // usa esa copia SIN preguntarle nada a la base mientras sea reciente: 10 min para listas de Admin/Supervisor/Responsable de local,
    // 30 min para el contenido (cursos, lecciones...). El botón de actualizar de la barra la salta, y cualquier escritura propia
    // invalida esa lista. Si la base no responde (sin señal, límite diario alcanzado) se muestra la última copia, aunque sea vieja.
    const FRESCURA_LISTAS_MS = 10 * 60 * 1000;
    const FRESCURA_PROPIA_MS = 2 * 60 * 1000;
    const FRESCURA_PAQUETES_MS = 30 * 60 * 1000;
    const FRESCURA_SUCURSALES_MS = 5 * 60 * 1000;
    const COPIABLES = [...INCREMENTALES, "Noticias", "Tokens", "Auditoria", ...PAQUETES];
    let ignorarCopiasAntesDe = 0;          // botón de actualizar: ninguna copia anterior a este instante vale
    const ignorarHojaAntesDe = {};         // escritura propia en una hoja: ninguna copia anterior de esa hoja vale
    let mostrandoDatosViejos = false;
    const claveCopia = (hoja) => `cp|${db && db.app && db.app.options ? db.app.options.projectId : "?"}|${String(getUsuario() && getUsuario().email || "").toLowerCase()}|${hoja}`;
    const copiable = (hoja) => !!almacen && cacheMs > 0 && COPIABLES.includes(hoja);
    function frescuraDe(hoja) {
        if (hoja === "Sucursales") return FRESCURA_SUCURSALES_MS;       // de acá sale "qué locales supervisa cada uno": una corrección tiene que llegar rápido
        if (PAQUETES.includes(hoja)) return FRESCURA_PAQUETES_MS;
        const u = yo();
        return esGestion(u) || u.encargado ? FRESCURA_LISTAS_MS : FRESCURA_PROPIA_MS;
    }
    async function leerCopia(hoja) {
        try { const c = await almacen.leer(claveCopia(hoja)); return c && Array.isArray(c.filas) ? c : null; } catch (err) { return null; }
    }
    async function guardarCopia(hoja, filas, extra) {
        try { await almacen.guardar(claveCopia(hoja), { filas, guardadoEn: ahora(), extra }); } catch (err) { /* sin copia */ }
    }
    const copiaVale = (hoja, c) => c.guardadoEn > ignorarCopiasAntesDe && c.guardadoEn > (ignorarHojaAntesDe[hoja] || 0) && ahora() - c.guardadoEn < frescuraDe(hoja) && ahora() >= c.guardadoEn;
    const claveAlmacen = (hoja) => `${db && db.app && db.app.options ? db.app.options.projectId : "?"}|${String(getUsuario() && getUsuario().email || "").toLowerCase()}|${hoja}`;
    // Un borrado no se ve en una lectura incremental. Quien borra (o importa) deja la hora en meta/borrados; al abrir, cada dispositivo
    // comprueba ese único documento (1 lectura, memoria de 5 min) y, si su copia es anterior, la rehace completa. Así la lectura completa
    // diaria deja de hacer falta y cada Responsable de local ya no baja ~300 documentos por día.
    let borradosCache = null;
    async function leerBorrados() {
        if (borradosCache && ahora() - borradosCache.ts < 5 * 60 * 1000) return borradosCache.datos;
        let datos = {};
        try { const snap = await getDoc(doc(db, "meta", "borrados")); datos = snap.exists() ? snap.data() : {}; } catch (err) { datos = null; }
        if (datos === null) return null;                    // no se pudo leer: quien llama decide (se rehace completa por prudencia)
        borradosCache = { datos, ts: ahora() };
        return datos;
    }
    async function marcarBorrado(hoja) {
        if (!INCREMENTALES.includes(hoja)) return;
        try { await setDoc(doc(db, "meta", "borrados"), { [hoja]: ahora() }, { merge: true }); borradosCache = null; } catch (err) { /* sin permiso: queda la red de 7 días */ }
    }
    const olvidarAlmacen = async (hoja) => { if (almacen && INCREMENTALES.includes(hoja)) { try { await almacen.borrar(claveAlmacen(hoja)); } catch (err) { /* sin copia */ } } };
    const usarEscuchas = escuchas !== undefined ? !!escuchas : (cacheMs > 0 && typeof sdk.onSnapshot === "function");
    const vivos = {};      // { [sucursal]: { datos, ciclos, listo, desuscribir, ultimoUso } }
    const SIN_USO_CIERRA_MS = 90 * 1000;
    let limpiador = null;
    function programarLimpieza() {
        if (limpiador || typeof setInterval !== "function") return;
        limpiador = setInterval(() => {
            Object.entries(vivos).forEach(([suc, v]) => {
                if (ahora() - v.ultimoUso > SIN_USO_CIERRA_MS) { try { v.desuscribir(); } catch (err) { /* ya cerrada */ } delete vivos[suc]; }
            });
            if (!Object.keys(vivos).length) { clearInterval(limpiador); limpiador = null; }
        }, 30 * 1000);
        if (limpiador.unref) limpiador.unref();
    }
    function cerrarEscuchas() {
        Object.entries(vivos).forEach(([suc, v]) => { try { v.desuscribir(); } catch (err) { /* ya cerrada */ } delete vivos[suc]; });
        if (limpiador) { clearInterval(limpiador); limpiador = null; }
    }

    /* ---------- escrituras pendientes (sin señal) ---------- */
    // Sin conexión, Firestore guarda lo escrito en el teléfono y lo manda solo al volver la señal. Para que la persona sepa que
    // hay algo que todavía no llegó, se pregunta al SDK si quedan escrituras sin confirmar (también al abrir la app, por las de
    // la sesión anterior). El aviso (components/pendientesSync.js) se enciende si tardan más de 1,5 s y se apaga solo al confirmarse.
    let hayPendientes = false;
    let revisionPendientes = 0;
    const oyentesPendientes = new Set();
    function fijarPendientes(valor) {
        if (valor === hayPendientes) return;
        hayPendientes = valor;
        oyentesPendientes.forEach((f) => { try { f(valor); } catch (err) { /* un oyente roto no frena a los demás */ } });
    }
    function revisarPendientes() {
        if (cacheMs <= 0 || typeof sdk.waitForPendingWrites !== "function") return;
        const marca = ++revisionPendientes;
        let resuelto = false;
        sdk.waitForPendingWrites(db).then(() => { resuelto = true; if (marca === revisionPendientes) fijarPendientes(false); }, () => {});
        setTimeout(() => { if (!resuelto && marca === revisionPendientes) fijarPendientes(true); }, 1500);
    }
    function confirmar(promesa) {
        const r = confirmarBase(promesa);
        r.then((res) => { if (res && res.pendiente) fijarPendientes(true); revisarPendientes(); }, () => {});
        return r;
    }

    /* ---------- utilidades ---------- */
    const yo = () => {
        const u = getUsuario();
        if (!u || !u.email) throw new Error("Sin sesión: no hay usuario para consultar Firestore.");
        return u;
    };
    const esGestion = (u) => u.rol === "admin" || u.rol === "supervisor";
    const siNo = (v) => (v === true || String(v).trim().toUpperCase() === "SI");
    const idDoc = (id) => String(id);
    // Los documentos de contenido se llaman en minúscula inicial (contenido/gestionTareas),
    // como los nombran las reglas; la hoja sigue siendo "GestionTareas".
    const docDePaquete = (hoja) => hoja.charAt(0).toLowerCase() + hoja.slice(1);

    // 2026-11-16 → Timestamp del final de ese día en Argentina
    function fechaATimestamp(texto) {
        const ms = finDeDiaEnMs(texto);
        return ms == null ? null : Timestamp.fromMillis(ms);
    }
    const sinUndefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

    // Un id único sin servidor ni contador compartido (los colaboradores no pueden
    // escribir contadores). Milisegundos + 3 dígitos al azar: cabe en un número seguro de JS.
    const idNuevo = () => ahora() * 1000 + Math.floor(Math.random() * 1000);

    /* ---------- planilla ⇄ Firestore ---------- */
    function aFirestore(hoja, fila) {
        const d = { ...fila };
        delete d._clave;
        if (hoja === "Usuarios") {
            FLAGS_USUARIO.forEach((k) => { if (k in d) d[k] = siNo(d[k]); });
            if (d.email != null) d.email = String(d.email).trim().toLowerCase();
            if ("fechaVencimientoAcceso" in d) d.fechaVencimientoAcceso = fechaATimestamp(d.fechaVencimientoAcceso);
        }
        if (INCREMENTALES.includes(hoja)) d.modificadoEn = ahora();     // marca para las lecturas incrementales
        if (hoja === "Noticias" && "leidoPor" in d && !Array.isArray(d.leidoPor)) {
            d.leidoPor = String(d.leidoPor || "").split(",").map((s) => s.trim()).filter(Boolean);
        }
        return sinUndefined(d);
    }

    // Las reglas piden saber DE QUIÉN es cada registro (email y local), no solo un id numérico.
    async function datosDePersona(idPersona) {
        const u = yo();
        if (String(u.id) === String(idPersona)) return { email: u.email, sucursal: u.sucursal || "" };
        if (!esGestion(u)) throw new Error("Solo Admin o Supervisor pueden escribir a nombre de otra persona.");
        for (const valor of [Number(idPersona), String(idPersona)]) {
            const snap = await getDocs(query(collection(db, "usuarios"), where("id", "==", valor), limit(1)));
            if (!snap.empty) {
                const d = snap.docs[0].data();
                return { email: String(d.email).toLowerCase(), sucursal: d.sucursal || "" };
            }
        }
        throw new Error(`No existe la persona con id ${idPersona}.`);
    }

    async function enriquecer(hoja, fila) {
        const f = { ...fila };
        if (hoja === "Asignaciones" || hoja === "Resultados") {
            const p = await datosDePersona(f.colaboradorId);
            f.colaboradorEmail = p.email;
            f.sucursal = p.sucursal;
        } else if (hoja === "Auditoria") {
            f.usuarioEmail = yo().email;
            f.creadoEn = ahora();
        } else if (hoja === "Tokens") {
            f.usuarioEmail = yo().email;
        }
        return f;
    }

    /* ---------- caché y deduplicación ---------- */
    // La clave del caché es "hoja|local": Gestión se lee por local y cada uno se cachea aparte.
    // La Auditoría no se borra: queda marcada como vencida (ts = 0) y la próxima lectura solo pide lo nuevo.
    function olvidar(k) { if (k.startsWith("Auditoria|") && cache[k]) cache[k].ts = 0; else delete cache[k]; }
    function invalidar(hoja) { ignorarHojaAntesDe[hoja] = ahora(); Object.keys(cache).filter((k) => k.startsWith(`${hoja}|`)).forEach(olvidar); }
    function invalidarTodo() { ignorarCopiasAntesDe = ahora(); Object.keys(cache).forEach(olvidar); }

    /* ---------- lectura ---------- */
    async function leerPaquete(hoja) {
        const snap = await getDoc(doc(db, "contenido", docDePaquete(hoja)));
        return snap.exists() ? (snap.data().items || []) : [];
    }

    // Un Supervisor común (no Capacitador) solo trabaja con los locales que supervisa (más el suyo): de Asignaciones y Resultados
    // baja solo las de esos locales. Es un ahorro de lecturas, no una barrera: las reglas siguen dejando leer todo a la gestión.
    // Devuelve { locales, firma } o null si no corresponde acotar (Admin, Capacitador, sin locales conocidos).
    const HOJAS_ACOTABLES = ["Asignaciones", "Resultados"];
    async function alcanceDeSupervisor(hoja) {
        const u = yo();
        if (u.rol !== "supervisor" || siNo(u.capacitador) || !HOJAS_ACOTABLES.includes(hoja)) return null;
        let sucursales = [];
        try { sucursales = await fetchSheet("Sucursales"); } catch (err) { return null; }       // sin la lista de locales no se acota
        // Sus locales asignados, el suyo y los que eligió seguir en "Elegir mis locales" (cualquiera de la red).
        let extra = [];
        try { extra = getLocalesExtra() || []; } catch (err) { /* sin preferencia guardada */ }
        const locales = [...new Set([...localesDeSupervisor(u, sucursales), String(u.sucursal || "").trim(), ...extra.map((n) => String(n).trim())].filter(Boolean))].sort();
        return locales.length ? { locales, firma: `sup:${locales.join("|")}` } : null;
    }
    // Documentos de una colección acotada a locales: `where in` admite hasta 30 valores por consulta.
    async function docsDeLocales(col, locales, extra = []) {
        const trozos = [];
        for (let i = 0; i < locales.length; i += 30) trozos.push(locales.slice(i, i + 30));
        const snaps = await Promise.all(trozos.map((t) => getDocs(query(col, where("sucursal", "in", t), ...extra))));
        return snaps.flatMap((sn) => sn.docs);
    }

    // Admin/Supervisor: lista completa la primera vez (y cada 7 días); en el medio, solo lo que cambió.
    // `suc` acota a un local (Responsable de local) y `alcance` a varios (Supervisor): mismo mecanismo, con índice (sucursal, modificadoEn).
    async function leerIncremental(hoja, suc = null, alcance = null) {
        const col = collection(db, COLECCIONES[hoja]);
        const firma = alcance ? alcance.firma : "";
        const docsConFiltros = async (extra) => {
            if (alcance) return docsDeLocales(col, alcance.locales, extra);
            const filtros = suc ? [where("sucursal", "==", suc)] : [];
            const snap = await getDocs(filtros.length || extra.length ? query(col, ...filtros, ...extra) : col);
            return snap.docs;
        };
        const clave = claveAlmacen(hoja);
        const guardado = await almacen.leer(clave);
        const t0 = ahora();
        const claveFila = (f) => String(f.id);
        let filas, ultimo;
        let hayBorrados = false;
        // Si cambió el conjunto de locales de este Supervisor, lo guardado no sirve: se rehace con el alcance nuevo.
        const guardadoVale = guardado && Array.isArray(guardado.filas) && (guardado.alcance || "") === firma;
        if (guardadoVale) {
            const b = await leerBorrados();
            hayBorrados = b === null || (Number(b[hoja]) || 0) > guardado.completoEn - SOLAPE_MS;
        }
        if (guardadoVale && !hayBorrados && t0 - guardado.completoEn < COMPLETA_CADA_MS && t0 >= guardado.completoEn) {
            const desde = (guardado.ultimoMs || 0) - SOLAPE_MS;
            const docs = await docsConFiltros([where("modificadoEn", ">", desde)]);
            const mapa = new Map(guardado.filas.map((f) => [claveFila(f), f]));
            docs.forEach((d) => { const f = desdeFirestore(hoja, d.data(), d.id); mapa.set(claveFila(f), f); });
            filas = [...mapa.values()];
            ultimo = Math.max(guardado.ultimoMs || 0, ...docs.map((d) => Number(d.data().modificadoEn) || 0));
            await almacen.guardar(clave, { filas, ultimoMs: ultimo, completoEn: guardado.completoEn, alcance: firma });
        } else {
            const docs = await docsConFiltros([]);
            filas = docs.map((d) => desdeFirestore(hoja, d.data(), d.id));
            // Lo escrito de ahora en más tiene modificadoEn >= t0 (menos el solape); lo anterior ya está en `filas`.
            ultimo = Math.max(t0, ...docs.map((d) => Number(d.data().modificadoEn) || 0));
            await almacen.guardar(clave, { filas, ultimoMs: ultimo, completoEn: t0, alcance: firma });
        }
        return filas;
    }

    async function leerColeccion(hoja) {
        const u = yo();
        const nombre = COLECCIONES[hoja];
        const col = collection(db, nombre);
        const gestion = esGestion(u);
        const sucEncargado = !gestion && u.encargado ? String(u.sucursal || "").trim() : "";
        const alcance = gestion ? await alcanceDeSupervisor(hoja) : null;
        if (almacen && INCREMENTALES.includes(hoja) && (gestion || sucEncargado)) {
            try { return await leerIncremental(hoja, sucEncargado || null, alcance); }
            catch (err) { /* sin copia o consulta rechazada: se cae a la lectura completa de siempre */ }
        }
        if (alcance) return (await docsDeLocales(col, alcance.locales)).map((d) => desdeFirestore(hoja, d.data(), d.id));
        let snap;

        switch (hoja) {
            case "Usuarios":
                if (gestion) snap = await getDocs(col);
                else if (u.encargado) snap = await getDocs(query(col, where("sucursal", "==", u.sucursal)));
                else {
                    const uno = await getDoc(doc(db, "usuarios", u.email));
                    return uno.exists() ? [desdeFirestore(hoja, uno.data(), uno.id)] : [];
                }
                break;
            case "Asignaciones":
            case "Resultados":
                if (gestion) snap = await getDocs(col);
                else if (u.encargado) snap = await getDocs(query(col, where("sucursal", "==", u.sucursal)));
                else snap = await getDocs(query(col, where("colaboradorEmail", "==", u.email)));
                break;
            case "Tokens":
                // Siempre los de uno mismo: saber QUIÉN tiene push lo da la marca `tienePush` de cada usuario (Admin/Supervisor
                // ya bajan esa lista); leer todos los tokens costaba un documento por dispositivo en cada apertura.
                snap = await getDocs(query(col, where("usuarioEmail", "==", u.email)));
                break;
            case "Auditoria":
                // Solo gestión, y nunca entera: las últimas MAX_AUDITORIA.
                if (!gestion) return [];
                snap = await getDocs(query(col, orderBy("creadoEn", "desc"), limit(MAX_AUDITORIA)));
                auditoriaUltimoMs = snap.docs.reduce((m, d) => Math.max(m, Number(d.data().creadoEn) || 0), 0);
                break;
            default: // Noticias: las lee cualquier persona con acceso vigente
                snap = await getDocs(col);
        }
        return snap.docs.map((d) => desdeFirestore(hoja, d.data(), d.id));
    }

    // Solo lo que se agregó desde la última lectura (si no hay nada nuevo cuesta 1 lectura, no 200).
    async function leerAuditoriaNuevas(previas) {
        if (!esGestion(yo())) return [];
        const snap = await getDocs(query(collection(db, "auditoria"), where("creadoEn", ">", auditoriaUltimoMs), orderBy("creadoEn", "desc"), limit(MAX_AUDITORIA)));
        if (snap.empty) return previas;
        auditoriaUltimoMs = snap.docs.reduce((m, d) => Math.max(m, Number(d.data().creadoEn) || 0), auditoriaUltimoMs);
        const nuevas = snap.docs.map((d) => desdeFirestore("Auditoria", d.data(), d.id));
        const ids = new Set(nuevas.map((f) => String(f.id)));
        return [...nuevas, ...previas.filter((f) => !ids.has(String(f.id)))].slice(0, MAX_AUDITORIA);
    }

    // Marcas de Gestión de UN local, en vivo (ver el comentario de arriba). Se cierra sola a los 90 s sin uso.
    function checksEnVivo(suc) {
        const ciclos = [cicloActual("semanal"), cicloActual("mensual")];
        const claveCiclos = ciclos.join("|");
        let v = vivos[suc];
        if (v && v.ciclos !== claveCiclos) { try { v.desuscribir(); } catch (err) { /* ya cerrada */ } delete vivos[suc]; v = null; }   // cambió la semana o el mes
        if (!v) {
            v = { datos: null, ciclos: claveCiclos, ultimoUso: ahora(), desuscribir: () => {} };
            v.listo = new Promise((resolver, rechazar) => {
                let primera = true;
                v.desuscribir = sdk.onSnapshot(
                    query(collection(db, "gestionChecks"), where("sucursal", "==", suc), where("ciclo", "in", ciclos)),
                    (snap) => {
                        v.datos = snap.docs.map((d) => desdeFirestore("GestionChecks", d.data(), d.id));
                        if (primera) { primera = false; resolver(); }
                    },
                    (err) => { if (vivos[suc] === v) delete vivos[suc]; if (primera) { primera = false; rechazar(err); } },
                );
            });
            vivos[suc] = v;
            programarLimpieza();
        }
        v.ultimoUso = ahora();
        return v;
    }

    // Gestión de tareas y Desafío. `opciones.sucursal` acota la lectura a UN local (lo pide la pantalla
    // de Gestión): sin eso, un Admin leería los 130 locales en cada refresco.
    async function leerEspecial(hoja, opciones) {
        const u = yo();
        const gestion = esGestion(u);
        const suc = gestion ? (opciones.sucursal || null) : String(u.sucursal || "").trim();

        switch (hoja) {
            case "GestionTareasSucursal": {
                const docs = suc
                    ? [await getDoc(doc(db, "gestionLocal", suc))].filter((d) => d.exists())
                    : (await getDocs(collection(db, "gestionLocal"))).docs;
                return docs.flatMap((d) => Object.entries(d.data().tareas || {}).map(([tareaId, v]) => ({
                    id: `${d.id}|${tareaId}`, tareaId: numeroSiPuede(tareaId), sucursal: d.id,
                    dias: v.dias || "", frecuencia: v.frecuencia === "mensual" ? "mensual" : "semanal",
                })));
            }
            case "GestionChecks": {
                // Solo los ciclos en curso (semanal y mensual): el resto es histórico y se pide aparte.
                const filtros = [where("ciclo", "in", [cicloActual("semanal"), cicloActual("mensual")])];
                if (suc) filtros.unshift(where("sucursal", "==", suc));
                const snap = await getDocs(query(collection(db, "gestionChecks"), ...filtros));
                return snap.docs.map((d) => desdeFirestore(hoja, d.data(), d.id));
            }
            case "DesafioResultados": {
                // El ranking sale del documento resumen del mes (1 lectura), no de las ~300 jugadas.
                // Las jugadas propias se leen aparte para saber si ya jugaste hoy y con qué resultado.
                const mes = mesDe(ahora());
                const resumen = await getDoc(doc(db, "desafio", mes));
                const propias = await getDocs(query(collection(db, "desafio", mes, "jugadas"), where("colaboradorEmail", "==", u.email)));
                const filas = propias.docs.map((d) => ({ id: d.id, ...d.data(), creadoEn: undefined }));
                const entradas = resumen.exists() ? (resumen.data().entradas || {}) : {};
                const ajenos = Object.entries(entradas).filter(([idPersona]) => String(idPersona) !== String(u.id));   // lo mío sale de mis jugadas
                // Fotos solo de los primeros puestos: son los únicos que el ranking muestra con foto.
                const primeros = [...ajenos].sort((a, b) => (b[1].puntos || 0) - (a[1].puntos || 0)).slice(0, PUESTOS_CON_FOTO).map(([id]) => id);
                const fotos = {};
                await Promise.all(primeros.map(async (id) => {
                    try { const p = await getDoc(doc(db, "perfilesDesafio", String(id))); if (p.exists()) fotos[id] = p.data().foto || ""; }
                    catch (err) { /* sin esa foto: se ven las iniciales */ }
                }));
                ajenos.forEach(([idPersona, e]) => {
                    filas.push({
                        id: `${mes}-${idPersona}`, colaboradorId: numeroSiPuede(idPersona), colaboradorNombre: e.nombre || "",
                        colaboradorLocal: e.local || "", colaboradorFoto: fotos[idPersona] || "",
                        fecha: e.ultimaFecha || `${mes}-01`, correctas: e.correctas || 0, tiempoUsado: e.tiempo || 0, puntos: e.puntos || 0,
                    });
                });
                return filas.map(sinUndefined);
            }
            case "DesafioHistorial": {
                const snap = await getDocs(collection(db, "desafioHistorial"));
                return snap.docs.flatMap((d) => d.data().items || []);
            }
            default:
                throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);
        }
    }

    async function fetchSheet(hoja, mockRows /* solo existe en modo demo */, opciones = {}) {
        const esPaquete = PAQUETES.includes(hoja);
        const esEspecial = ESPECIALES.includes(hoja);
        if (!esPaquete && !esEspecial && !COLECCIONES[hoja]) {
            throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);
        }
        // Marcas de Gestión de un local: en vivo, sin pasar por la memoria de 20 s (la escucha siempre está al día).
        if (hoja === "GestionChecks" && usarEscuchas) {
            const u = yo();
            const suc = esGestion(u) ? (opciones.sucursal || null) : String(u.sucursal || "").trim();
            if (suc) {
                try {
                    const v = checksEnVivo(suc);
                    await v.listo;
                    return [...v.datos];
                } catch (err) { /* sin escucha (permiso, red): se cae a la lectura de siempre */ }
            }
        }
        const clave = `${hoja}|${opciones.sucursal || ""}`;
        const c = cache[clave];
        if (c && ahora() - c.ts < ttlDe(hoja)) return [...c.datos];

        if (!enVuelo[clave]) {
            enVuelo[clave] = (async () => {
                const copia = copiable(hoja) ? await leerCopia(hoja) : null;
                if (copia && copiaVale(hoja, copia)) { mostrandoDatosViejos = false; return copia.filas; }          // reciente: cero lecturas
                const previasAuditoria = c ? c.datos : (copia && copia.extra && copia.extra.ultimoMs ? (auditoriaUltimoMs = copia.extra.ultimoMs, copia.filas) : null);
                try {
                    const filas = hoja === "Auditoria" && previasAuditoria && auditoriaUltimoMs > 0 ? await leerAuditoriaNuevas(previasAuditoria)
                        : esPaquete ? await leerPaquete(hoja) : esEspecial ? await leerEspecial(hoja, opciones) : await leerColeccion(hoja);
                    if (copiable(hoja)) await guardarCopia(hoja, filas, hoja === "Auditoria" ? { ultimoMs: auditoriaUltimoMs } : undefined);
                    mostrandoDatosViejos = false;
                    return filas;
                } catch (err) {
                    if (copia) { mostrandoDatosViejos = true; console.warn(`[datos] La base no respondió (${err.code || err.message}); se muestra la última copia guardada de ${hoja}.`); return copia.filas; }
                    throw err;
                }
            })()
                .then((filas) => { cache[clave] = { datos: filas, ts: ahora() }; return filas; })
                .finally(() => { delete enVuelo[clave]; });
        }
        return [...(await enVuelo[clave])];
    }

    /* ---------- escritura de paquetes (con transacción) ---------- */
    async function modificarPaquete(hoja, fn) {
        const ref = doc(db, "contenido", docDePaquete(hoja));
        const resultado = await runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const items = snap.exists() ? [...(snap.data().items || [])] : [];
            const r = fn(items);
            if (r.cambio) {
                tx.set(ref, { items });
                // Avisa a los celulares que el contenido cambió (meta/versiones).
                tx.set(doc(db, "meta", "versiones"), { [hoja]: ahora() }, { merge: true });
            }
            return r;
        });
        invalidar(hoja);
        return resultado;
    }

    /* ---------- escritura ---------- */
    async function writeSheet(hoja, fila /*, mockRows */) {
        if (PAQUETES.includes(hoja)) {
            const r = await modificarPaquete(hoja, (items) => {
                const maxId = items.reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
                const nueva = { ...sinUndefined(fila), id: maxId + 1 };
                items.push(nueva);
                return { cambio: true, fila: nueva };
            });
            return { ok: true, id: r.fila.id, fila: r.fila };
        }
        if (hoja === "DesafioResultados") return jugarDesafio(fila);
        if (!COLECCIONES[hoja]) throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);

        let datos = await enriquecer(hoja, fila);
        let id;
        if (hoja === "Usuarios") {
            // Id numérico correlativo, como el de la planilla: el siguiente al mayor que hay.
            const ultimo = await getDocs(query(collection(db, "usuarios"), orderBy("id", "desc"), limit(1)));
            id = ultimo.empty ? 1 : (Number(ultimo.docs[0].data().id) || 0) + 1;
            datos = { ...datos, id };
            const d = aFirestore(hoja, datos);
            await setDoc(doc(db, "usuarios", d.email), d);
        } else {
            id = datos.id ?? idNuevo();
            datos = { ...datos, id };
            await confirmar(setDoc(doc(db, COLECCIONES[hoja], idDoc(id)), aFirestore(hoja, datos)));
        }
        invalidar(hoja);
        return { ok: true, id, fila: desdeFirestore(hoja, aFirestore(hoja, datos), id) };
    }

    // Usuarios se guardan por email: para llegar al documento desde un id numérico hay que buscarlo.
    async function referenciaDeUsuario(id) {
        const u = yo();
        if (String(u.id) === String(id)) return doc(db, "usuarios", u.email);
        for (const valor of [Number(id), String(id)]) {
            const snap = await getDocs(query(collection(db, "usuarios"), where("id", "==", valor), limit(1)));
            if (!snap.empty) return snap.docs[0].ref;
        }
        return null;
    }

    async function referenciaDeFila(hoja, id) {
        return hoja === "Usuarios" ? referenciaDeUsuario(id) : doc(db, COLECCIONES[hoja], idDoc(id));
    }

    async function updateSheet(hoja, id, cambios /*, mockRows */) {
        if (PAQUETES.includes(hoja)) {
            const r = await modificarPaquete(hoja, (items) => {
                const i = items.findIndex((f) => String(f.id) === String(id));
                if (i === -1) return { cambio: false, ok: false };
                items[i] = { ...items[i], ...sinUndefined(cambios) };
                return { cambio: true, ok: true };
            });
            return { ok: r.ok };
        }
        if (!COLECCIONES[hoja]) throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);

        const ref = await referenciaDeFila(hoja, id);
        if (!ref) return { ok: false };
        const parcial = aFirestore(hoja, cambios);
        delete parcial.id; // el id no se reescribe
        if (hoja === "Usuarios" && parcial.email && parcial.email !== ref.id) return cambiarCorreoDeUsuario(ref, parcial);
        const localAnterior = hoja === "Usuarios" && parcial.sucursal ? localEnMemoria(ref.id) : undefined;     // antes de invalidar
        await confirmar(updateDoc(ref, parcial));
        invalidar(hoja);
        if (hoja === "Usuarios" && parcial.sucursal && localAnterior !== parcial.sucursal) await propagarSucursal(ref.id, parcial.sucursal);
        return { ok: true };
    }

    // Asignaciones y Resultados llevan copiado el local de la persona (las reglas y las lecturas acotadas por local lo usan).
    // Si la persona cambia de local, su historial la sigue: así el Supervisor/Responsable del local nuevo lo ve y el del viejo deja de verlo.
    // El documento de una persona se llama como su correo (así la encuentra el ingreso y las reglas). Cambiar solo el campo email dejaba
    // el documento con la clave vieja y la persona ya no podía entrar ("tu cuenta no está registrada"). Acá se MUEVE: se crea con la clave
    // nueva y se borra la vieja en una sola operación, y el historial de la persona (asignaciones y resultados) se pasa al correo nuevo.
    // Solo el Admin (las reglas no dejan borrar a nadie más). También repara una clave que ya había quedado distinta del correo.
    async function cambiarCorreoDeUsuario(refVieja, parcial) {
        if (yo().rol !== "admin") throw new Error("Solo el Admin puede cambiar el correo de una persona.");
        const emailNuevo = parcial.email;
        const refNueva = doc(db, "usuarios", emailNuevo);
        const [vieja, existente] = await Promise.all([getDoc(refVieja), getDoc(refNueva)]);
        if (!vieja.exists()) return { ok: false };
        if (existente.exists()) throw new Error(`Ya hay una persona registrada con el correo ${emailNuevo}.`);
        const emailViejo = refVieja.id;
        const lote = writeBatch(db);
        lote.set(refNueva, { ...vieja.data(), ...parcial, email: emailNuevo });
        lote.delete(refVieja);
        await lote.commit();
        // El historial lleva el correo de la persona: se pasa al nuevo (si no, ella no vería su propio progreso).
        for (const hojaP of ["Asignaciones", "Resultados"]) {
            try {
                const snap = await getDocs(query(collection(db, COLECCIONES[hojaP]), where("colaboradorEmail", "==", emailViejo)));
                for (let i = 0; i < snap.docs.length; i += 400) {
                    const l = writeBatch(db);
                    snap.docs.slice(i, i + 400).forEach((d) => l.update(d.ref, { colaboradorEmail: emailNuevo, modificadoEn: ahora() }));
                    await l.commit();
                }
            } catch (err) { console.warn(`[firestore] No se pudo pasar ${hojaP} al correo nuevo:`, err.code || err.message); }
        }
        await olvidarAlmacen("Usuarios"); await marcarBorrado("Usuarios");      // el documento viejo desapareció: los demás dispositivos rehacen la lista
        await olvidarAlmacen("Asignaciones"); await marcarBorrado("Asignaciones");
        invalidar("Usuarios"); invalidar("Asignaciones"); invalidar("Resultados");
        return { ok: true, movido: true };
    }

    // El local que tenía la persona según la lista en memoria (undefined si no está cargada: ahí se revisa su historial por las dudas).
    function localEnMemoria(email) {
        const previo = (cache["Usuarios|"] && cache["Usuarios|"].datos || []).find((f) => String(f.email || "").toLowerCase() === String(email).toLowerCase());
        return previo ? String(previo.sucursal || "") : undefined;
    }
    async function propagarSucursal(email, sucursal) {
        try {
            for (const hojaP of ["Asignaciones", "Resultados"]) {
                const snap = await getDocs(query(collection(db, COLECCIONES[hojaP]), where("colaboradorEmail", "==", email.toLowerCase())));
                const viejas = snap.docs.filter((d) => d.data().sucursal !== sucursal);
                for (let i = 0; i < viejas.length; i += 400) {
                    const lote = writeBatch(db);
                    viejas.slice(i, i + 400).forEach((d) => lote.update(d.ref, { sucursal, modificadoEn: ahora() }));
                    await lote.commit();
                }
                if (viejas.length) invalidar(hojaP);
            }
        } catch (err) {
            console.warn("[firestore] No se pudo actualizar el local en el historial de la persona:", err.code || err.message);
        }
    }

    async function deleteSheet(hoja, id /*, mockRows */) {
        if (PAQUETES.includes(hoja)) {
            const r = await modificarPaquete(hoja, (items) => {
                const i = items.findIndex((f) => String(f.id) === String(id));
                if (i === -1) return { cambio: false, ok: false };
                items.splice(i, 1);
                return { cambio: true, ok: true };
            });
            return { ok: r.ok };
        }
        if (!COLECCIONES[hoja]) throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);

        const ref = await referenciaDeFila(hoja, id);
        if (!ref) return { ok: false };
        await confirmar(deleteDoc(ref));
        await olvidarAlmacen(hoja);        // un borrado no se ve en una lectura incremental: la próxima va completa
        await marcarBorrado(hoja);         // y los demás dispositivos se enteran al abrir (meta/borrados)
        invalidar(hoja);
        return { ok: true };
    }


    /* ---------- Desafío Diario ---------- */
    // Una jugada por persona por día: el id "<idPersona>_<fecha>" lo garantiza (las reglas solo dejan CREAR).
    // Después se suma al resumen del mes, que es lo que lee el ranking.
    async function jugarDesafio(fila) {
        const u = yo();
        const fecha = String(fila.fecha || "").slice(0, 10);
        const mes = fecha.slice(0, 7);
        const idJugada = `${u.id}_${fecha}`;
        const foto = (await miniaturaFoto(fila.colaboradorFoto || u.foto || "")).slice(0, MAX_MINIATURA);
        const local = String(fila.colaboradorLocal || u.sucursal || "");
        const datos = {
            colaboradorId: u.id, colaboradorEmail: u.email, colaboradorNombre: fila.colaboradorNombre || u.nombre || "",
            colaboradorFoto: foto, colaboradorLocal: local,
            fecha, correctas: Number(fila.correctas) || 0, tiempoUsado: Number(fila.tiempoUsado) || 0, puntos: Number(fila.puntos) || 0,
        };
        try {
            await confirmar(setDoc(doc(db, "desafio", mes, "jugadas", idJugada), { ...datos, creadoEn: serverTimestamp() }));
        } catch (err) {
            if (err.code === "permission-denied") return { ok: false, error: "No se pudo guardar tu partida: es probable que ya hayas jugado hoy." };
            throw err;
        }
        try {
            const ref = doc(db, "desafio", mes);
            const snap = await getDoc(ref);
            const previa = snap.exists() ? (snap.data().entradas || {})[String(u.id)] : null;
            const entrada = {
                nombre: datos.colaboradorNombre, local, puntos: (previa?.puntos || 0) + datos.puntos, correctas: (previa?.correctas || 0) + datos.correctas,
                tiempo: (previa?.tiempo || 0) + datos.tiempoUsado, partidas: (previa?.partidas || 0) + 1, ultimaFecha: fecha,
            };
            if (snap.exists()) await confirmar(updateDoc(ref, { [`entradas.${u.id}`]: entrada }));
            else await confirmar(setDoc(ref, { entradas: { [u.id]: entrada } }));
        } catch (err) {
            // La jugada ya quedó guardada: el ranking de los demás se pone al día en la próxima partida.
            console.warn("[desafio] No se pudo actualizar el ranking del mes:", err);
        }
        // Miniatura y local para el ranking (un documento chico por persona, aparte del resumen del mes).
        try { await confirmar(setDoc(doc(db, "perfilesDesafio", String(u.id)), { nombre: datos.colaboradorNombre, local, foto })); }
        catch (err) { console.warn("[desafio] No se pudo guardar tu miniatura para el ranking:", err); }
        invalidar("DesafioResultados");
        return { ok: true, id: idJugada, fila: { id: idJugada, ...datos } };
    }

    /* ---------- Gestión de tareas: lo que hoy hace el backend (Code.gs) ---------- */
    const checkId = (tareaId, sucursal, dia, ciclo) => `${tareaId}_${sucursal}_${dia}_${ciclo}`;
    const horaLocal = () => {
        const d = new Date(ahora());
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const indicesDeSubitems = (csv) => String(csv || "").split(",").filter(Boolean).map((e) => e.split(":")[0]);
    const esResponsableDeLocal = (u) => u.encargado === true || u.responsableTurno === true;
    const NO_DISPONIBLE = (que) => ({ ok: false, error: `${que} todavía no está disponible en la versión Firebase.` });

    async function frecuenciaDeTarea(tareaId, sucursal) {
        let snap;
        try {
            snap = await getDoc(doc(db, "gestionLocal", sucursal));
        } catch (err) {
            // Sin conexión y sin ese documento guardado en el teléfono: se asume el valor por defecto en vez de trabar la marca.
            if (err.code === "unavailable") return "semanal";
            throw err;
        }
        const t = snap.exists() ? (snap.data().tareas || {})[String(tareaId)] : null;
        return t && t.frecuencia === "mensual" ? "mensual" : "semanal";
    }

    async function actualizarDiasGestionSucursal({ tareaId, dias, frecuencia }, u) {
        const suc = String(u.sucursal || "").trim();
        if (!esResponsableDeLocal(u)) return { ok: false, error: "Solo Responsable de local o de turno pueden editar los días de su local." };
        if (!suc) return { ok: false, error: "Tu usuario no tiene un local asignado." };
        if (!tareaId) return { ok: false, error: "Falta la tarea." };

        const diasTexto = (dias || []).join(",");
        const frec = frecuencia === "mensual" ? "mensual" : "semanal";
        const ref = doc(db, "gestionLocal", suc);
        if (!diasTexto && frec === "semanal") {
            // Sin días y en el valor por defecto no hace falta guardar nada: se saca la entrada si existía.
            try { await confirmar(updateDoc(ref, { [`tareas.${tareaId}`]: deleteField() })); }
            catch (err) { if (err.code !== "not-found") throw err; }
        } else {
            await confirmar(setDoc(ref, { tareas: { [String(tareaId)]: { dias: diasTexto, frecuencia: frec, fechaModificacion: new Date(ahora()).toISOString() } } }, { merge: true }));
        }
        invalidar("GestionTareasSucursal");
        return { ok: true };
    }

    async function actualizarCheckGestion({ tareaId, dia, hecho, subitemsMarcados }, u) {
        const suc = String(u.sucursal || "").trim();
        if (!esResponsableDeLocal(u)) return { ok: false, error: "Solo Responsable de local o de turno pueden marcar tareas de su local." };
        if (!suc) return { ok: false, error: "Tu usuario no tiene un local asignado." };
        if (!tareaId || !dia) return { ok: false, error: "Falta la tarea o el día." };

        const ciclo = cicloActual(await frecuenciaDeTarea(tareaId, suc));
        const ref = doc(db, "gestionChecks", checkId(tareaId, suc, dia, ciclo));
        // Se busca con una consulta (no con getDoc): las reglas no pueden evaluar "mi local" sobre un
        // documento que todavía no existe, pero sí sobre una consulta que ya filtra por sucursal.
        const hallado = await getDocs(query(collection(db, "gestionChecks"),
            where("sucursal", "==", suc), where("ciclo", "==", ciclo), where("tareaId", "==", tareaId), where("dia", "==", dia), limit(1)));
        const existente = hallado.empty ? null : hallado.docs[0].data();

        if (existente && existente.cerrada === true) {
            return { ok: false, error: "Esta tarea ya está cerrada. Pedile a un Admin que la reabra si hace falta corregir algo." };
        }
        if (!esDiaDeHoy(dia, ahora())) return { ok: false, error: "Solo se puede marcar esta tarea el día que corresponde — no antes ni después." };

        const nombre = u.nombre || u.email;
        const hora = horaLocal();
        const mandaSubitems = subitemsMarcados !== undefined && subitemsMarcados !== null;
        const lista = mandaSubitems ? String(subitemsMarcados) : "";

        if (!hecho && !lista) {
            if (existente) await confirmar(deleteDoc(ref));
            invalidar("GestionChecks");
            return { ok: true };
        }

        const datos = { tareaId, sucursal: suc, dia, ciclo, hecho: !!hecho, marcadoPor: nombre, hora, fechaModificacion: new Date(ahora()).toISOString() };
        if (mandaSubitems) {
            datos.subitemsMarcados = lista;
            // Quien ya firmó un sub-ítem conserva su firma; solo los NUEVOS se firman con quien guarda ahora.
            const antes = new Set(indicesDeSubitems(existente?.subitemsMarcados));
            const firmasAntes = new Map();
            String(existente?.subitemsFirmas || "").split(",").filter(Boolean).forEach((e) => {
                const f = parsearFirmaSubitem(e);
                firmasAntes.set(f.indice, f);
            });
            datos.subitemsFirmas = indicesDeSubitems(lista).map((indice) => {
                const previa = firmasAntes.get(indice);
                return antes.has(indice) && previa
                    ? serializarFirmaSubitem(indice, previa.nombre, previa.hora)
                    : serializarFirmaSubitem(indice, nombre, hora);
            }).join(",");
        }
        if (hecho) { datos.cerrada = true; datos.cerradaPor = nombre; datos.cerradaHora = hora; }

        await confirmar(setDoc(ref, datos, { merge: true }));
        invalidar("GestionChecks");
        return { ok: true };
    }

    async function reabrirOEliminarCheck({ tareaId, dia, sucursal }, u, borrar) {
        if (u.rol !== "admin") return { ok: false, error: borrar ? "Solo Administración puede borrar un registro." : "Solo Admin puede reabrir una tarea cerrada." };
        const suc = String(sucursal || "").trim();
        if (!suc || !tareaId || !dia) return { ok: false, error: "Falta la tarea, el día o el local." };
        const ciclo = cicloActual(await frecuenciaDeTarea(tareaId, suc));
        const ref = doc(db, "gestionChecks", checkId(tareaId, suc, dia, ciclo));
        if (!(await getDoc(ref)).exists()) {
            return { ok: false, error: borrar ? "No se encontró ese registro — puede que ya se haya borrado." : "No se encontró esa tarea guardada." };
        }
        if (borrar) await deleteDoc(ref); else await updateDoc(ref, { cerrada: false });
        invalidar("GestionChecks");
        return { ok: true };
    }

    async function obtenerHistoricoGestion({ sucursal }, u) {
        const suc = u.encargado === true ? String(u.sucursal || "").trim() : esGestion(u) ? String(sucursal || "").trim() : null;
        if (suc === null) return { ok: false, error: "No tenés permiso para ver el histórico de Gestión." };
        if (!suc) return { ok: false, error: "Falta el local." };
        const [checks, local] = await Promise.all([
            getDocs(query(collection(db, "gestionChecks"), where("sucursal", "==", suc))),
            getDoc(doc(db, "gestionLocal", suc)),
        ]);
        const tareas = local.exists() ? (local.data().tareas || {}) : {};
        const actual = { semanal: cicloActual("semanal"), mensual: cicloActual("mensual") };
        return checks.docs
            .map((d) => desdeFirestore("GestionChecks", d.data(), d.id))
            .filter((f) => f.ciclo !== actual[tareas[String(f.tareaId)]?.frecuencia === "mensual" ? "mensual" : "semanal"]);
    }

    async function eliminarHistoricoGestion({ ciclo }, u) {
        if (u.encargado !== true) return { ok: false, error: "Solo el Responsable de local puede borrar del histórico." };
        const suc = String(u.sucursal || "").trim();
        if (!suc || !ciclo) return { ok: false, error: "Falta el ciclo o el local." };
        const snap = await getDocs(query(collection(db, "gestionChecks"), where("sucursal", "==", suc), where("ciclo", "==", String(ciclo))));
        const lote = writeBatch(db);
        snap.docs.forEach((d) => lote.delete(d.ref));
        await lote.commit();
        invalidar("GestionChecks");
        return { ok: true, borradas: snap.size };
    }

    // El "timbre": avisa al servicio de avisos (Apps Script) que hay un pedido nuevo, para que salga al instante.
    // Es solo un aviso: no lleva ningún dato, y si falla (sin señal, servicio caído) el servicio igual revisa la cola cada 5 minutos.
    function tocarTimbre() {
        if (!avisosUrl || !fetchFn) return;
        try {
            Promise.resolve(fetchFn(avisosUrl, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ accion: "timbre" }) }))
                .catch(() => {});
        } catch (err) { /* el timbre nunca debe romper el envío */ }
    }

    async function encolarPush(tipo, extra, u) {
        await confirmar(setDoc(doc(collection(db, "colaPush")), { tipo, ...extra, creadoPor: u.email, creadoEn: serverTimestamp() }));
        tocarTimbre();
        return { ok: true, encolado: true };
    }

    /** Las "acciones" que antes resolvía Apps Script (gasRequest). Mismos nombres y mismas respuestas. */
    async function ejecutarAccion(accion, payload = {}) {
        const u = yo();
        switch (accion) {
            case "actualizarDiasGestionSucursal": return actualizarDiasGestionSucursal(payload, u);
            case "actualizarCheckGestion": return actualizarCheckGestion(payload, u);
            case "reabrirTareaGestion": return reabrirOEliminarCheck(payload, u, false);
            case "eliminarCheckGestion": return reabrirOEliminarCheck(payload, u, true);
            case "obtenerHistoricoGestion": return obtenerHistoricoGestion(payload, u);
            case "eliminarHistoricoGestion": return eliminarHistoricoGestion(payload, u);
            case "obtenerHorarioRecordatorioGestion": {
                if (u.rol !== "admin") return { ok: false, error: "Solo Admin puede ver el horario del recordatorio." };
                const snap = await getDoc(doc(db, "meta", "config"));
                return { ok: true, hora: snap.exists() && Number.isInteger(snap.data().horaRecordatorioGestion) ? snap.data().horaRecordatorioGestion : 10 };
            }
            case "guardarHorarioRecordatorioGestion": {
                if (u.rol !== "admin") return { ok: false, error: "Solo Admin puede configurar el horario del recordatorio." };
                const hora = Number(payload.hora);
                if (!Number.isInteger(hora) || hora < 0 || hora > 23) return { ok: false, error: "La hora tiene que ser un número entero entre 0 y 23." };
                await setDoc(doc(db, "meta", "config"), { horaRecordatorioGestion: hora }, { merge: true });
                return { ok: true, hora };
            }
            // El envío real lo hace el worker (DISENO §6): la app deja el pedido en la cola colaPush.
            case "enviarPushGestion":
                if (!esResponsableDeLocal(u)) return { ok: false, error: "Solo Responsable de local o de turno pueden enviar este aviso." };
                return encolarPush("gestion", { titulo: payload.titulo, cuerpo: payload.cuerpo, url: payload.url || "", sucursal: u.sucursal || "" }, u);
            case "enviarPush":
                if (!esGestion(u)) return { ok: false, error: "Solo Admin o Supervisor pueden enviar avisos." };
                return encolarPush("usuarios", { usuarioIds: payload.usuarioIds || [], titulo: payload.titulo, cuerpo: payload.cuerpo, url: payload.url || "" }, u);
            case "enviarPushPrueba": {
                // Un aviso de prueba a MIS dispositivos (el texto lo pone el servicio de avisos). Igual que en Code.gs: sin dispositivos registrados, avisa.
                const propios = await getDocs(query(collection(db, "tokens"), where("usuarioEmail", "==", u.email), limit(1)));
                if (propios.empty) return { ok: false, error: "No tienes tokens de push registrados. Activa las notificaciones en tu perfil." };
                return encolarPush("prueba", {}, u);
            }
            case "enviarMail": return NO_DISPONIBLE("El envío de mails");        // decisión abierta (DISENO §11)
            case "subirFotoPerfil": {
                // La foto ya viene achicada del teléfono (perfil.js): se guarda dentro del usuario, sin Drive ni Storage.
                const foto = String(payload.archivoBase64 || "");
                if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto)) return { ok: false, error: "La foto no tiene un formato válido." };
                if (foto.length > MAX_FOTO_PERFIL) return { ok: false, error: "La foto es muy pesada. Probá con otra." };
                return { ok: true, url: foto };
            }
            case "subirArchivo":
                // Sin Cloud Storage (requiere plan Blaze): los archivos se suben a Drive y se pega el enlace (DISENO §7).
                return { ok: false, error: "Subir archivos desde acá no está disponible. Subí el archivo a Google Drive, copiá el enlace y pegalo en el campo de enlace." };
            default: return { ok: false, error: `Acción no disponible en la versión Firebase: ${accion}` };
        }
    }

    /* ---------- importación masiva (migración y datos de muestra) ---------- */
    // Escribe las filas CONSERVANDO sus ids (writeSheet inventa uno nuevo). Solo gestión.
    // Pisa lo que ya exista con el mismo id. En Asignaciones/Resultados completa email y local
    // de cada persona con UNA lectura de usuarios, no una por fila.
    async function importarFilas(hoja, filas) {
        if (!esGestion(yo())) throw new Error("Solo Admin o Supervisor pueden importar datos.");
        if (!Array.isArray(filas)) throw new Error("importarFilas espera un arreglo de filas.");

        if (PAQUETES.includes(hoja)) {
            await setDoc(doc(db, "contenido", docDePaquete(hoja)), { items: filas.map(sinUndefined) });
            await setDoc(doc(db, "meta", "versiones"), { [hoja]: ahora() }, { merge: true });
            invalidar(hoja);
            return { ok: true, n: filas.length };
        }
        if (ESPECIALES.includes(hoja)) return importarEspecial(hoja, filas);
        if (!COLECCIONES[hoja]) throw new Error(`La hoja "${hoja}" todavía no está migrada a Firestore.`);

        let personas = null;
        if (hoja === "Asignaciones" || hoja === "Resultados") {
            const snap = await getDocs(collection(db, "usuarios"));
            personas = new Map(snap.docs.map((d) => [String(d.data().id), { email: d.data().email, sucursal: d.data().sucursal || "" }]));
        }

        let lote = writeBatch(db);
        let enLote = 0;
        for (const fila of filas) {
            let datos = { ...fila };
            if (datos.id === undefined || datos.id === null || datos.id === "") {
                throw new Error(`importarFilas(${hoja}): una fila no tiene id.`);
            }
            if (personas) {
                const p = personas.get(String(datos.colaboradorId));
                if (!p) throw new Error(`importarFilas(${hoja}): no existe la persona ${datos.colaboradorId} (fila ${datos.id}).`);
                datos.colaboradorEmail = p.email;
                datos.sucursal = p.sucursal;
            }
            const d = aFirestore(hoja, datos);
            const ref = hoja === "Usuarios" ? doc(db, "usuarios", d.email) : doc(db, COLECCIONES[hoja], idDoc(d.id));
            lote.set(ref, d);
            if (++enLote === 400) { await lote.commit(); lote = writeBatch(db); enLote = 0; }
        }
        if (enLote) await lote.commit();
        await olvidarAlmacen(hoja);
        await marcarBorrado(hoja);
        invalidar(hoja);
        return { ok: true, n: filas.length };
    }


    async function importarEspecial(hoja, filas) {
        if (hoja === "GestionTareasSucursal") {
            const porLocal = new Map();
            filas.forEach((f) => {
                const m = porLocal.get(f.sucursal) || {};
                m[String(f.tareaId)] = { dias: String(f.dias || ""), frecuencia: f.frecuencia === "mensual" ? "mensual" : "semanal" };
                porLocal.set(f.sucursal, m);
            });
            for (const [local, tareas] of porLocal) await setDoc(doc(db, "gestionLocal", local), { tareas });
        } else if (hoja === "GestionChecks") {
            let lote = writeBatch(db), n = 0;
            for (const f of filas) {
                const { id: _id, ...datos } = f;
                datos.hecho = siNo(datos.hecho);
                datos.cerrada = siNo(datos.cerrada);
                lote.set(doc(db, "gestionChecks", checkId(f.tareaId, f.sucursal, f.dia, f.ciclo)), sinUndefined(datos));
                if (++n === 400) { await lote.commit(); lote = writeBatch(db); n = 0; }
            }
            if (n) await lote.commit();
        } else if (hoja === "DesafioResultados") {
            const snap = await getDocs(collection(db, "usuarios"));
            const emails = new Map(snap.docs.map((d) => [String(d.data().id), d.data().email]));
            const meses = new Map();
            let lote = writeBatch(db), n = 0;
            for (const f of filas) {
                const fecha = String(f.fecha).slice(0, 10), mes = fecha.slice(0, 7);
                const email = emails.get(String(f.colaboradorId));
                if (!email) throw new Error(`importarFilas(DesafioResultados): no existe la persona ${f.colaboradorId}.`);
                lote.set(doc(db, "desafio", mes, "jugadas", `${f.colaboradorId}_${fecha}`), {
                    colaboradorId: f.colaboradorId, colaboradorEmail: email, colaboradorNombre: f.colaboradorNombre || "",
                    colaboradorFoto: String(f.colaboradorFoto || "").slice(0, MAX_MINIATURA), colaboradorLocal: f.colaboradorLocal || "",
                    fecha, correctas: Number(f.correctas) || 0, tiempoUsado: Number(f.tiempoUsado) || 0, puntos: Number(f.puntos) || 0, creadoEn: ahora(),
                });
                const entradas = meses.get(mes) || {};
                const e = entradas[String(f.colaboradorId)] || { nombre: f.colaboradorNombre || "", local: f.colaboradorLocal || "", puntos: 0, correctas: 0, tiempo: 0, partidas: 0, ultimaFecha: "" };
                e.puntos += Number(f.puntos) || 0; e.correctas += Number(f.correctas) || 0; e.tiempo += Number(f.tiempoUsado) || 0;
                e.partidas += 1; if (fecha > e.ultimaFecha) e.ultimaFecha = fecha;
                entradas[String(f.colaboradorId)] = e;
                meses.set(mes, entradas);
                if (++n === 400) { await lote.commit(); lote = writeBatch(db); n = 0; }
            }
            if (n) await lote.commit();
            for (const [mes, entradas] of meses) await setDoc(doc(db, "desafio", mes), { entradas });
        } else if (hoja === "DesafioHistorial") {
            const porMes = new Map();
            filas.forEach((f) => porMes.set(f.mes, [...(porMes.get(f.mes) || []), f]));
            for (const [mes, items] of porMes) await setDoc(doc(db, "desafioHistorial", mes), { items });
        }
        invalidar(hoja);
        return { ok: true, n: filas.length };
    }

    revisarPendientes();      // ¿quedaron escrituras sin enviar de la sesión anterior?
    return {
        fetchSheet, writeSheet, updateSheet, deleteSheet, invalidar, invalidarTodo, importarFilas, ejecutarAccion, cerrarEscuchas,
        datosViejos: () => mostrandoDatosViejos,
        pendientes: () => hayPendientes,
        alCambiarPendientes: (f) => { oyentesPendientes.add(f); return () => oyentesPendientes.delete(f); },
    };
}
