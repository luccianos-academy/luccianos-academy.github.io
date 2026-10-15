/* ============================
   Lucciano's Academy
   i18n/i18n.js — Idiomas (español / inglés)

   Cómo funciona, en corto:

   - El texto de la app está escrito en español dentro del código. En vez
     de reescribir cada pantalla, cuando el idioma es inglés un traductor
     recorre lo que se dibuja (textos, placeholders, títulos, tooltips) y
     cambia cada texto por su versión en inglés, buscándolo en un
     diccionario (i18n/en.js: "texto en español" → "English text").
     Los textos con partes variables ("{0} lecciones") se resuelven con
     patrones.
   - El contenido que viene de las planillas (lecciones, preguntas,
     tareas…) se traduce al leerlo, por texto exacto (i18n/en.contenido.js).
     Si el texto en español cambia en la planilla, deja de coincidir y se
     muestra en español: nunca un inglés viejo.
   - Un texto sin traducción se muestra en español. Nada se rompe.
   - Para quien usa la app en español NO se carga ningún diccionario ni se
     activa el traductor: cero costo y cero riesgo.

   Idioma: lo elige cada persona en Mi perfil. Español e inglés los puede
   elegir cualquiera; un idioma local (ver IDIOMAS) solo existe para los
   locales de su país. "Automático" = inglés si el local es de Estados
   Unidos, español en cualquier otro caso.
=============================*/

import { getUsuarioActual } from "../services/auth.js";
import { paisDelNombre } from "../services/alcance.js";
import { IDIOMAS_EN_VISTA_PREVIA, REVISORES_FIJOS, ES_ENTORNO_PRUEBA } from "../config.js";
import { cargarRevisoresIngles, revisoresInglesActuales } from "../data/idiomaRevisores.js";
import { getTraducciones } from "../data/traducciones.js";

const CLAVE = "faro_idioma"; // "auto" | id de un idioma de IDIOMAS

/** Idiomas de la app. Español e inglés los puede elegir cualquier persona.
 *  Un idioma LOCAL (el dariya marroquí) se declara con `soloPaises`: solo existe
 *  para quien trabaja en un local de esos países. `etiqueta` es el nombre del
 *  idioma escrito en ese mismo idioma; `dir` la dirección del texto; `locale` el
 *  que usan fechas y números (con cifras 0-9, que son las que usan en Marruecos).
 *  Mientras un idioma esté en IDIOMAS_EN_VISTA_PREVIA (config.js) solo lo ven
 *  las personas habilitadas (ver puedeVerIdioma). */
export const IDIOMAS = [
    { id: "es", etiqueta: "Español", dir: "ltr" },
    { id: "en", etiqueta: "English", dir: "ltr", locale: "en-US" },
    { id: "ar-MA", etiqueta: "الدارجة", dir: "rtl", locale: "ar-MA-u-nu-latn", soloPaises: ["Marruecos"] },
];

function datosIdioma(id) {
    return IDIOMAS.find((i) => i.id === id) || IDIOMAS[0];
}

function paisDelUsuario(usuario) {
    return usuario?.sucursal ? paisDelNombre(usuario.sucursal) : "";
}

/* SHA-256 síncrono (texto → hex). Se usa para que la lista de revisores de
   config.js guarde huellas y no emails en el código público del sitio. */
function sha256(texto) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = Array.from(new TextEncoder().encode(texto));
    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
        const w = new Array(64);
        for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
            const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
        H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** ¿Es una de las personas que ven los idiomas en vista previa? Las fijas
 *  (huellas de email, config.js) o las que el Admin habilitó en Configuración
 *  (ids de usuario, data/idiomaRevisores.js). */
export function esRevisor(usuario, habilitados = revisoresInglesActuales()) {
    const email = String(usuario?.email || "").trim().toLowerCase();
    if (email && REVISORES_FIJOS.includes(sha256(email))) return true;
    return usuario?.id != null && habilitados.includes(String(usuario.id));
}

/** ¿Este idioma existe para esta persona?
 *  - Español: siempre.
 *  - En vista previa: solo para los revisores, de cualquier país.
 *  - Abierto: para todos, salvo un idioma local, que es solo de su país
 *    (en REPO/local no se aplica esa restricción, para poder probarlo). */
export function puedeVerIdioma(usuario, id) {
    const idioma = datosIdioma(id);
    if (idioma.id === "es") return true;
    if (IDIOMAS_EN_VISTA_PREVIA.includes(id)) return esRevisor(usuario);
    if (idioma.soloPaises && !ES_ENTORNO_PRUEBA) return idioma.soloPaises.includes(paisDelUsuario(usuario));
    return true;
}

/** Pide en segundo plano la lista de habilitados (sin frenar la pantalla) y,
 *  cuando llega, si cambió el idioma que le corresponde a esta persona, recarga.
 *  Solo hace algo en vista previa y con una sesión iniciada. */
export function prepararIdioma() {
    if (!getUsuarioActual()) return;
    // Traducciones del Admin (hoja "Traducciones") para el idioma activo.
    if (idiomaActivo !== "es") sincronizarTraducciones();
    if (!IDIOMAS_EN_VISTA_PREVIA.length) return;
    cargarRevisoresIngles()
        .then(() => recargarSiCambioElIdioma())
        .catch(() => { /* sin lista nueva: valen los fijos y lo último guardado */ });
}

/** Los idiomas que esta persona puede elegir. */
export function idiomasDisponibles(usuario = getUsuarioActual()) {
    return IDIOMAS.filter((i) => puedeVerIdioma(usuario, i.id));
}

let idiomaActivo = "es";
let diccionario = new Map();   // texto exacto → traducción
let patrones = [];             // [{ re, val }]
let contenido = new Map();     // texto exacto de un campo de planilla → traducción
let porMayuscula = null;       // índice en mayúsculas (se arma al primer uso)
let contenidoNorm = new Map(); // lo mismo, con los espacios normalizados (para buscar en el DOM)
let observador = null;
const cacheFallos = new Set();

/** Lo que la persona eligió en Mi perfil. */
export function idiomaElegido() {
    try {
        const v = localStorage.getItem(CLAVE);
        return IDIOMAS.some((i) => i.id === v) ? v : "auto";
    } catch {
        return "auto";
    }
}

export function guardarIdioma(valor) {
    try {
        if (IDIOMAS.some((i) => i.id === valor)) localStorage.setItem(CLAVE, valor);
        else localStorage.removeItem(CLAVE);
    } catch { /* sin almacenamiento: queda en automático */ }
}

/** El idioma que corresponde HOY a esta persona. */
export function idiomaEfectivo() {
    const elegido = idiomaElegido();
    const usuario = getUsuarioActual();
    // Un idioma local elegido en un dispositivo donde ahora entró otra
    // persona (de otro país) no se aplica: cae en automático.
    if (elegido !== "auto" && idiomasDisponibles(usuario).some((i) => i.id === elegido)) return elegido;
    // Automático: el idioma del país del local, si está disponible para esta persona.
    const pais = paisDelUsuario(usuario);
    if (pais === "Estados Unidos" && puedeVerIdioma(usuario, "en")) return "en";
    if (pais === "Marruecos" && puedeVerIdioma(usuario, "ar-MA")) return "ar-MA";
    return "es";
}

export function idiomaActual() {
    return idiomaActivo;
}

/* ── Búsqueda ───────────────────────────────────────────── */

/* Terminaciones de plural: el código arma "local" + ("es" si hay más de uno),
   así que en el diccionario aparece "{0} local{1}". Esas terminaciones son del
   español ("es", "s", "n"): se capturan con una expresión ESTRICTA (solo esas
   terminaciones o vacío) y en inglés se resuelven como plural (+s) o singular.
   Se listan las palabras a mano porque "No leídas{0}" o "…personal{0}" también
   tienen una letra pegada al {n}, pero ahí {0} es una frase entera, no un plural.
   Si aparece otro texto con terminación de plural, agregar su palabra acá. */
const PALABRAS_CON_PLURAL = "local|incidencia|grave|producto|acotado|depende|excluido";
const RE_SUFIJO = new RegExp(`(?:${PALABRAS_CON_PLURAL})\\{(\\d+)\\}`, "g");

function compilarPatrones(dic) {
    const lista = [];
    for (const [clave, valor] of dic) {
        if (!/\{\d+\}/.test(clave)) continue;
        // Un patrón con casi nada de texto fijo ("{0} de {1}") coincidiría con
        // cualquier frase y la traduciría mal: se descarta.
        const letrasFijas = clave.replace(/\{\d+\}/g, "").replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ]/g, "").length;
        const abierto = /^\{\d+\}/.test(clave) && /\{\d+\}[^A-Za-z]*$/.test(clave);
        const empiezaConGrupo = /^\{\d+\}/.test(clave);
        const sufijos = new Set([...clave.matchAll(RE_SUFIJO)].map((m) => Number(m[1])));
        if (!sufijos.size && (letrasFijas < (empiezaConGrupo ? 6 : 4) || (abierto && letrasFijas < 12))) continue;
        // Cada {n} de la clave pasa a ser un grupo de la expresión; el valor
        // los referencia por el MISMO {n} (los números no tienen que ser
        // correlativos), así que se guarda a qué grupo corresponde cada uno.
        const grupos = new Map();
        const re = clave
            .split(/(\{\d+\})/)
            .map((parte) => {
                const m = parte.match(/^\{(\d+)\}$/);
                if (m) {
                    grupos.set(Number(m[1]), grupos.size + 1);
                    if (sufijos.has(Number(m[1]))) return "(s|es|n|en|)";
                    // En una frase con plural, un {n} inicial es siempre la cantidad: sin
                    // esto "{0} local{1}" también agarraría "Elegí un local".
                    return sufijos.size && /^\{\d+\}/.test(clave) && parte === clave.match(/^\{\d+\}/)[0] ? "(\\d+)" : "(.*?)";
                }
                return parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            })
            .join("");
        lista.push({ re: new RegExp(`^${re}$`), val: valor, grupos, sufijos, peso: clave.replace(/\{\d+\}/g, "").length });
    }
    // Los más específicos primero (más texto fijo).
    lista.sort((a, b) => b.peso - a.peso);
    return lista;
}

function buscar(nucleo) {
    if (diccionario.has(nucleo)) return diccionario.get(nucleo);
    if (contenidoNorm.has(nucleo)) return contenidoNorm.get(nucleo);
    if (cacheFallos.has(nucleo)) return null;
    for (const p of patrones) {
        const m = nucleo.match(p.re);
        // Cada trozo variable capturado también se traduce por su cuenta
        // (ej. " o eliminarla" dentro de una frase más larga).
        if (m) {
            return p.val.replace(/\{(\d+)\}/g, (_, i) => {
                const captura = m[p.grupos.get(Number(i))] ?? "";
                // terminación de plural del español → plural del inglés (+s) o nada
                if (p.sufijos.has(Number(i))) return idiomaActivo === "en" && captura ? "s" : "";
                return t(captura);
            });
        }
    }
    // Numeración pegada al texto ("1. ¿Qué lleva…?", "2) Paso"): se traduce el resto.
    const num = nucleo.match(/^(\d+[.)]\s+)(.+)$/);
    if (num) {
        const r = buscar(num[2]);
        if (r != null) return num[1] + r;
    }
    // Textos armados con join(): listas ("Café, Heladería"), "A — B — C" o
    // "01 · Paso": cada elemento se traduce por su cuenta.
    for (const sep of [", ", " — ", " · "]) {
        if (!nucleo.includes(sep)) continue;
        const partes = nucleo.split(sep);
        const traducidas = partes.map((x) => buscar(x));
        if (traducidas.some((x) => x != null)) return partes.map((x, i) => traducidas[i] ?? x).join(sep);
    }
    // Nombres de producto que la planilla guarda en MAYÚSCULAS.
    if (nucleo === nucleo.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(nucleo)) {
        if (!porMayuscula) {
            porMayuscula = new Map();
            for (const [k, v] of [...diccionario, ...contenidoNorm]) porMayuscula.set(k.toUpperCase(), v);
        }
        const r = porMayuscula.get(nucleo);
        if (r != null) return r.toUpperCase();
    }
    cacheFallos.add(nucleo);
    return null;
}

/** Traduce un texto suelto (mensajes de alert/confirm, textos armados en JS). */
export function t(texto) {
    if (idiomaActivo === "es" || typeof texto !== "string") return texto;
    const m = texto.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const nucleo = m[2].replace(/\s+/g, " ");
    if (!nucleo) return texto;
    const r = buscar(nucleo);
    return r == null ? texto : m[1] + r + m[3];
}

let valoresTraducidos = null;
/** ¿Este texto es una traducción conocida (de un campo de planilla)? Sirve para no
 *  guardarla nunca como si fuera el contenido original. */
export function esTraduccion(texto) {
    if (idiomaActivo === "es" || typeof texto !== "string" || !texto.trim()) return false;
    if (!valoresTraducidos) valoresTraducidos = new Set([...contenido.values()].map((v) => v.trim()));
    return valoresTraducidos.has(texto.trim());
}

/** Traduce el campo de una planilla (lección, pregunta, tarea…). */
export function tc(texto) {
    if (idiomaActivo === "es" || typeof texto !== "string" || !texto) return texto;
    return contenido.get(texto.trim()) ?? contenido.get(texto) ?? texto;
}

/* ── Traductor del DOM ──────────────────────────────────── */

const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt", "data-tooltip-texto"];
const SELECTOR_ATR = ATRIBUTOS.map((a) => `[${a}]`).join(",");
const IGNORAR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

function traducirNodoTexto(nodo) {
    const p = nodo.parentElement;
    if (!p || IGNORAR.has(p.tagName) || p.closest("[data-no-traducir]")) return;
    const nuevo = t(nodo.nodeValue);
    if (nuevo !== nodo.nodeValue) nodo.nodeValue = nuevo;
}

function traducirAtributos(el) {
    for (const a of ATRIBUTOS) {
        const v = el.getAttribute?.(a);
        if (v) {
            const nuevo = t(v);
            if (nuevo !== v) el.setAttribute(a, nuevo);
        }
    }
}

function traducirArbol(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { traducirNodoTexto(raiz); return; }
    if (raiz.nodeType !== 1) return;
    if (IGNORAR.has(raiz.tagName) || raiz.closest?.("[data-no-traducir]")) return;
    traducirAtributos(raiz);
    raiz.querySelectorAll?.(SELECTOR_ATR).forEach(traducirAtributos);
    const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = caminante.nextNode())) traducirNodoTexto(n);
}

function alMutar(registros) {
    observador.disconnect();
    try {
        for (const r of registros) {
            if (r.type === "childList") r.addedNodes.forEach(traducirArbol);
            else if (r.type === "characterData") traducirNodoTexto(r.target);
            else if (r.type === "attributes") traducirAtributos(r.target);
        }
        if (document.title) document.title = t(document.title);
    } finally {
        observarDOM();
    }
}

function observarDOM() {
    observador.observe(document.documentElement, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATRIBUTOS,
    });
}

/* ── Traducciones escritas por el Admin ─────────────────── */

/* Se suman a los diccionarios que vienen con la app y tienen prioridad.
   Se guardan en el dispositivo para que la primera pantalla ya salga con ellas
   (sin esperar a la red); apenas llega la lista fresca se actualiza todo. */
const CLAVE_TRAD = (idioma) => `faro_trad_${idioma}`;
const VIGENCIA_TRAD_MS = 5 * 60 * 1000;
let sincronizadoEn = 0;

function norm(texto) {
    return texto.replace(/\s+/g, " ").trim();
}

function leerCacheTraducciones(idioma) {
    try { return JSON.parse(localStorage.getItem(CLAVE_TRAD(idioma)) || "[]"); } catch { return []; }
}

function aplicarTraducciones(pares) {
    let hayPatrones = false;
    for (const [es, tr] of pares) {
        const clave = es.trim();
        diccionario.set(clave, tr);
        contenido.set(clave, tr);
        contenido.set(es, tr);
        contenidoNorm.set(norm(es), tr);
        if (/\{\d+\}/.test(clave)) hayPatrones = true;
    }
    if (hayPatrones) patrones = compilarPatrones(diccionario);
    valoresTraducidos = null;
    porMayuscula = null;
    cacheFallos.clear();
}

function retraducirPantalla() {
    if (!observador) return;
    observador.disconnect();
    try { traducirArbol(document.body); } finally { observarDOM(); }
}

/** Trae las traducciones del Admin para el idioma activo y las aplica en vivo.
 *  `forzar` ignora la vigencia (lo usa la pantalla de Traducciones al guardar). */
export async function sincronizarTraducciones(forzar = false) {
    if (idiomaActivo === "es" || !getUsuarioActual()) return;
    if (!forzar && Date.now() - sincronizadoEn < VIGENCIA_TRAD_MS) return;
    sincronizadoEn = Date.now();
    const idioma = idiomaActivo;
    try {
        const filas = (await getTraducciones()).filter((f) => f.idioma === idioma);
        const pares = filas.map((f) => [f.es, f.traduccion]);
        try { localStorage.setItem(CLAVE_TRAD(idioma), JSON.stringify(pares)); } catch { /* sin almacenamiento */ }
        if (idioma !== idiomaActivo) return;
        aplicarTraducciones(pares);
        retraducirPantalla();
    } catch { /* sin red: quedan las guardadas */ }
}

/** Todas las traducciones conocidas de un idioma (diccionarios de la app + las del
 *  Admin), SIN activarlo: es lo que usa la pantalla de Traducciones, que se opera
 *  siempre en español. Devuelve un Map texto-en-español → traducción. */
export async function traduccionesDe(idioma) {
    const [ui, cont] = await Promise.all([import(`./${idioma}.js`), import(`./${idioma}.contenido.js`)]);
    const mapa = new Map([...Object.entries(ui.default), ...Object.entries(cont.default)]);
    (await getTraducciones()).filter((f) => f.idioma === idioma).forEach((f) => mapa.set(f.es.trim(), f.traduccion));
    return mapa;
}

/* ── Fechas y números en el idioma activo ───────────────── */

let localesParcheados = false;
function parchearLocales() {
    if (localesParcheados) return;
    localesParcheados = true;
    const mapa = (loc) => (typeof loc === "string" && /^es\b/i.test(loc) ? datosIdioma(idiomaActivo).locale : loc);
    for (const [proto, nombres] of [
        [Date.prototype, ["toLocaleDateString", "toLocaleString", "toLocaleTimeString"]],
        [Number.prototype, ["toLocaleString"]],
    ]) {
        for (const nombre of nombres) {
            const original = proto[nombre];
            proto[nombre] = function (loc, ...resto) {
                return original.call(this, idiomaActivo !== "es" ? mapa(loc) : loc, ...resto);
            };
        }
    }
    const DTF = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function (loc, ...resto) { return new DTF(idiomaActivo !== "es" ? mapa(loc) : loc, ...resto); };
    Intl.DateTimeFormat.prototype = DTF.prototype;
    Intl.DateTimeFormat.supportedLocalesOf = DTF.supportedLocalesOf;
}

function parchearDialogos() {
    for (const nombre of ["alert", "confirm", "prompt"]) {
        const original = window[nombre].bind(window);
        window[nombre] = (mensaje, ...resto) => original(t(String(mensaje ?? "")), ...resto);
    }
}

/* ── Arranque ───────────────────────────────────────────── */

let diccionariosCargados = false;
async function cargarDiccionarios(idioma) {
    if (diccionariosCargados) return;
    const [ui, cont] = await Promise.all([import(`./${idioma}.js`), import(`./${idioma}.contenido.js`)]);
    diccionario = new Map(Object.entries(ui.default));
    contenido = new Map(Object.entries(cont.default));
    contenidoNorm = new Map([...contenido].map(([k, v]) => [k.replace(/\s+/g, " ").trim(), v]));
    patrones = compilarPatrones(diccionario);
    diccionariosCargados = true;
}

/** Llamar UNA vez al arrancar la app, antes de dibujar la primera pantalla. */
export async function iniciarI18n() {
    const idioma = idiomaEfectivo();
    const datos = datosIdioma(idioma);
    document.documentElement.lang = idioma;
    document.documentElement.dir = datos.dir;
    if (idioma === "es") { idiomaActivo = "es"; return; }

    // Un idioma de derecha a izquierda necesita su hoja de estilos espejada
    // (css/rtl.css, generada por tools/i18n/generar_rtl.py): se espera a que
    // cargue para que la primera pantalla ya salga bien.
    const hoja = datos.dir === "rtl" ? cargarHojaRtl() : Promise.resolve();
    await Promise.all([cargarDiccionarios(idioma), hoja]);
    aplicarTraducciones(leerCacheTraducciones(idioma));
    idiomaActivo = idioma;
    parchearLocales();
    parchearDialogos();
    observador = new MutationObserver(alMutar);
    traducirArbol(document.body);
    observarDOM();
}

function cargarHojaRtl() {
    return new Promise((resolver) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "css/rtl.css";
        link.onload = link.onerror = () => resolver();
        document.head.appendChild(link);
    });
}

/** Si el idioma que corresponde cambió (ej. alguien inició sesión), recarga
 *  para que toda la pantalla —incluidos los datos ya leídos— salga en el
 *  idioma correcto. */
export function recargarSiCambioElIdioma() {
    if (idiomaEfectivo() !== idiomaActivo) window.location.reload();
}
