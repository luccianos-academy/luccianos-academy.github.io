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
const FLAGS_USUARIO = ["activo", "encargado", "responsableTurno", "capacitador"];

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

function confirmar(promesa) {
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

export function crearFirestoreSource({ db, sdk, getUsuario, ahora = () => Date.now(), cacheMs = 20000, avisosUrl = "", miniaturaFoto = miniaturaPorDefecto, fetchFn = typeof fetch === "function" ? fetch : null }) {
    const {
        doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
        orderBy, limit, runTransaction, writeBatch, deleteField, serverTimestamp, Timestamp,
    } = sdk;

    const cache = {};      // { [hoja]: { datos, ts } }
    const enVuelo = {};    // dedupe de pedidos simultáneos de una misma hoja

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
        if (hoja === "Usuarios") {
            FLAGS_USUARIO.forEach((k) => { if (k in d) d[k] = siNo(d[k]); });
            if (d.email != null) d.email = String(d.email).trim().toLowerCase();
            if ("fechaVencimientoAcceso" in d) d.fechaVencimientoAcceso = fechaATimestamp(d.fechaVencimientoAcceso);
        }
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
    function invalidar(hoja) { Object.keys(cache).filter((k) => k.startsWith(`${hoja}|`)).forEach((k) => delete cache[k]); }
    function invalidarTodo() { Object.keys(cache).forEach((k) => delete cache[k]); }

    /* ---------- lectura ---------- */
    async function leerPaquete(hoja) {
        const snap = await getDoc(doc(db, "contenido", docDePaquete(hoja)));
        return snap.exists() ? (snap.data().items || []) : [];
    }

    async function leerColeccion(hoja) {
        const u = yo();
        const nombre = COLECCIONES[hoja];
        const col = collection(db, nombre);
        const gestion = esGestion(u);
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
                snap = gestion ? await getDocs(col) : await getDocs(query(col, where("usuarioEmail", "==", u.email)));
                break;
            case "Auditoria":
                // Solo gestión, y nunca entera: las últimas MAX_AUDITORIA.
                if (!gestion) return [];
                snap = await getDocs(query(col, orderBy("creadoEn", "desc"), limit(MAX_AUDITORIA)));
                break;
            default: // Noticias: las lee cualquier persona con acceso vigente
                snap = await getDocs(col);
        }
        return snap.docs.map((d) => desdeFirestore(hoja, d.data(), d.id));
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
        const clave = `${hoja}|${opciones.sucursal || ""}`;
        const c = cache[clave];
        if (c && ahora() - c.ts < cacheMs) return [...c.datos];

        if (!enVuelo[clave]) {
            const lectura = esPaquete ? leerPaquete(hoja) : esEspecial ? leerEspecial(hoja, opciones) : leerColeccion(hoja);
            enVuelo[clave] = lectura
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
        await confirmar(updateDoc(ref, parcial));
        invalidar(hoja);
        return { ok: true };
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

    return { fetchSheet, writeSheet, updateSheet, deleteSheet, invalidar, invalidarTodo, importarFilas, ejecutarAccion };
}
