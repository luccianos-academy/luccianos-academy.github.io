/* ============================
   Lucciano's Academy — Backend real (Google Apps Script)

   Implementa el contrato que espera js/services/google.js del lado
   del cliente. A partir de la revisión de seguridad de julio 2026,
   TODA operación (salvo el login) exige un token de sesión válido, y
   el rol/sucursal del que llama se resuelve acá contra la hoja
   "Usuarios" en cada request — nunca se confía en lo que manda el
   cliente (rol, colaboradorId, etc.).

   Flujo de autenticación (dos etapas):
   1) Login: el cliente manda el ID token crudo de Google Sign-In.
      Se valida su firma contra Google (tokeninfo), se saca el email
      verificado, se busca en "Usuarios", y si está OK se emite un
      token de sesión propio (firmado con HMAC, vence a las 24h).
   2) Cada request siguiente: el cliente adjunta ese token de sesión.
      Se verifica localmente (rápido, sin llamar a Google de nuevo),
      se recarga el usuario fresco de "Usuarios" (así desactivar a
      alguien surte efecto al toque) y recién ahí se autoriza.

   SETUP OBLIGATORIO (una sola vez, a mano en el editor de Apps
   Script): Configuración del proyecto → Propiedades del script →
   agregar "SESSION_SECRET" con un valor random largo. Sin eso, el
   login falla con un error claro.

   Este script va ligado ("bound") a la planilla de Google Sheets
   que contiene las hojas (ver README.md de esta carpeta para los
   encabezados exactos de cada una).
=============================*/

// Mismo valor que js/config.js (GOOGLE_CLIENT_ID). Se usa para validar
// que el ID token de Google fue emitido para ESTA app y no otra.
const GOOGLE_CLIENT_ID = "801785311174-1kkcf884hdac9s1a6og2kum1joogme4t.apps.googleusercontent.com";

const SESION_DURACION_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Versión de ESTE archivo, devuelta por doGet().
 *
 * Existe por un problema concreto y repetido: pegar el código en el
 * editor de Apps Script NO cambia lo que sirve el web app — eso recién
 * pasa al crear una "Nueva versión" de la implementación. Cuando ese
 * paso se saltea, el síntoma es que el arreglo "no funciona", y para
 * distinguirlo de un bug real había que probar a mano desde adentro de
 * la app, con sesión iniciada.
 *
 * Con esto alcanza con abrir la URL /exec en el navegador: si el número
 * no coincide con el de este archivo, la implementación quedó vieja y
 * no hay nada que depurar. Se sube junto con VERSION de js/config.js.
 */
const BACKEND_VERSION = "1.16.0";

// Qué rol puede escribir cada hoja. Lectura se maneja aparte (casi
// todo es legible por cualquier autenticado, con filtros puntuales).
// Los matices que no entran en una tabla (crear un supervisor/admin es
// más restringido que crear un colaborador; forzar colaboradorId al
// del token; allow-list de campos) se aplican en los handlers.
const PERMISOS_ESCRITURA = {
    Usuarios:     { crear: ["admin", "supervisor"],              actualizar: ["admin", "supervisor"],              eliminar: ["admin"] },
    Sucursales:   { crear: ["admin", "supervisor"],              actualizar: ["admin", "supervisor"],              eliminar: ["admin"] },
    Cursos:       { crear: ["admin"],                            actualizar: ["admin"],                            eliminar: ["admin"] },
    Lecciones:    { crear: ["admin"],                            actualizar: ["admin"],                            eliminar: ["admin"] },
    // Catálogo de tareas de "Gestión semanal" (Responsables de Local y
    // Turno, #/gestion) — Fase 1: mismo criterio que Cursos/Lecciones,
    // el contenido lo carga Admin. Lectura abierta a cualquier
    // autenticado (no está en LECTURA_SOLO_GESTION) — cualquier rol
    // que entre a esa pantalla necesita poder leer el catálogo.
    GestionTareas: { crear: ["admin"],                           actualizar: ["admin"],                            eliminar: ["admin"] },
    Evaluaciones: { crear: ["admin"],                            actualizar: ["admin"],                            eliminar: ["admin"] },
    Manuales:     { crear: ["admin"],                            actualizar: ["admin"],                            eliminar: ["admin"] },
    Noticias:     { crear: ["admin"],                            actualizar: ["admin", "colaborador"],            eliminar: ["admin"] },
    Asignaciones: { crear: ["admin", "colaborador"],             actualizar: ["admin", "supervisor", "colaborador"], eliminar: ["admin"] },
    Resultados:   { crear: ["admin", "colaborador"],             actualizar: [],                                    eliminar: ["admin"] },
    Auditoria:    { crear: ["admin", "supervisor", "colaborador"], actualizar: [],                                  eliminar: [] },
    // Coordinación Operativa (antes "Comunicaciones") — Admin y
    // Supervisor (incluye Capacitador, que no es de solo lectura acá).
    // Canales: eliminar queda solo-Admin (un canal con publicaciones
    // reales adentro es más delicado de borrar que crearlo). El resto
    // de las reglas más finas (ej. "solo el autor o Admin borra SU
    // publicación") las aplica la UI — acá alcanza con la matriz
    // gruesa por rol, mismo criterio que Asignaciones/Resultados.
    Canales:       { crear: ["admin", "supervisor"], actualizar: ["admin", "supervisor"], eliminar: ["admin"] },
    Publicaciones: { crear: ["admin", "supervisor"], actualizar: ["admin", "supervisor"], eliminar: ["admin", "supervisor"] },
    Comentarios:   { crear: ["admin", "supervisor"], actualizar: [],                       eliminar: [] },
    // Recursos: mismo criterio, Supervisor con paridad total (pedido
    // explícito del usuario — no depender de que Admin gestione todo).
    Recursos:      { crear: ["admin", "supervisor"], actualizar: ["admin", "supervisor"], eliminar: ["admin", "supervisor"] },
    // Tokens (push real): cualquier autenticado registra SU PROPIO
    // token — no hay "actualizar" (se borra y se vuelve a crear) ni
    // "eliminar" client-facing (la limpieza de tokens inválidos la
    // hace enviarPush() directo con _eliminarCrudo, sin pasar por acá).
    Tokens:        { crear: ["admin", "supervisor", "colaborador"], actualizar: [], eliminar: [] },
    // Dónde se vende cada producto del catálogo. Mismo criterio que
    // Cursos y Lecciones: el contenido lo gestiona el Admin. La LECTURA
    // queda abierta a cualquier autenticado —no está en las hojas
    // restringidas— porque sin ella el catálogo no se puede filtrar.
    Disponibilidad: { crear: ["admin"], actualizar: ["admin"], eliminar: ["admin"] },
};

// Hojas cuya lectura queda restringida (el resto la lee cualquier
// autenticado). Auditoria: solo gestión. Asignaciones/Resultados: un
// colaborador solo ve sus propias filas (filtrado en leer()).
/* Hojas que un colaborador no puede leer NI CRUDAS. Ojo: no alcanza con
   que la pantalla no exista para él — sin esto, la fila viaja igual al
   navegador y basta abrir las herramientas de desarrollo para leerla.
   Comunicaciones (Canales/Publicaciones) es Admin ↔ Supervisor por
   definición, así que sacarlas de la respuesta no le quita nada a nadie. */
const LECTURA_SOLO_GESTION = ["Auditoria", "Canales", "Publicaciones"];

function doPost(e) {
    let resultado;
    try {
        const body = JSON.parse(e.postData.contents);

        if (body.accion === "verificarLogin") {
            // Única acción sin token: es la que lo emite.
            resultado = verificarLogin(body.idToken);
        } else if (!body.token) {
            // Request SIN token: no es una sesión vencida — es un pedido no
            // autenticado que corre antes del login (ej. el getNoticias()
            // de sidebar.js, que se dispara al cargar la app para el badge
            // "NEW", cuando todavía no hay sesión). Se rechaza SIN marcar
            // sesionInvalida: el cliente hace logout+reload ante
            // sesionInvalida, y sin una sesión previa eso entra en un bucle
            // infinito de recargas (la app "reinicia sola" en el login).
            resultado = { ok: false, error: "No autenticado." };
        } else {
            const sesion = _verificarToken(body.token);
            if (!sesion) {
                resultado = { ok: false, sesionInvalida: true, error: "Tu sesión expiró o no es válida. Volvé a iniciar sesión." };
            } else {
                // Usuario fresco de la hoja en CADA request: si un admin
                // lo desactivó o le cambió el rol, se refleja acá al toque.
                const usuarioActual = _usuarioDeSesion(sesion.email);
                if (!usuarioActual || usuarioActual.activo === "NO") {
                    resultado = { ok: false, sesionInvalida: true, error: "Tu acceso ya no está activo. Volvé a iniciar sesión." };
                } else {
                    resultado = _despachar(body, usuarioActual);
                }
            }
        }
    } catch (err) {
        resultado = { ok: false, error: err.message };
    }
    return ContentService
        .createTextOutput(JSON.stringify(resultado))
        .setMimeType(ContentService.MimeType.JSON);
}

function _despachar(body, usuarioActual) {
    switch (body.accion) {
        case "leer":       return leer(body.hoja, usuarioActual);
        case "escribir":   return escribir(body.hoja, body.fila, usuarioActual);
        case "actualizar": return actualizar(body.hoja, body.id, body.cambios, usuarioActual);
        case "eliminar":   return eliminar(body.hoja, body.id, usuarioActual);
        case "enviarMail": return enviarMailDesdeApp(body.destinatarios, body.asunto, body.cuerpo, usuarioActual);
        case "enviarPush": return enviarPush(body.usuarioIds, body.titulo, body.cuerpo, body.url, usuarioActual);
        case "enviarPushGestion": return enviarPushGestion(body.titulo, body.cuerpo, body.url, usuarioActual);
        case "actualizarDiasGestionSucursal": return actualizarDiasGestionSucursal(body.tareaId, body.dias, body.frecuencia, usuarioActual);
        case "actualizarCheckGestion": return actualizarCheckGestion(body.tareaId, body.dia, body.hecho, usuarioActual, body.subitemsMarcados);
        case "reabrirTareaGestion": return reabrirTareaGestion(body.tareaId, body.dia, body.sucursal, usuarioActual);
        case "obtenerHorarioRecordatorioGestion": return obtenerHorarioRecordatorioGestion(usuarioActual);
        case "guardarHorarioRecordatorioGestion": return guardarHorarioRecordatorioGestion(body.hora, usuarioActual);
        case "obtenerHistoricoGestion": return obtenerHistoricoGestion(body.sucursal, usuarioActual);
        case "eliminarHistoricoGestion": return eliminarHistoricoGestion(body.ciclo, usuarioActual);
        case "enviarPushPrueba": return enviarPushPrueba(usuarioActual);
        case "subirArchivo": return subirArchivo(body.nombreArchivo, body.extension, body.archivoBase64);
        case "subirFotoPerfil": return subirFotoPerfil(usuarioActual, body.extension, body.archivoBase64);
        case "sync":       return sync(body.lastSync, usuarioActual);

        default:           return { ok: false, error: "Acción desconocida: " + body.accion };
    }
}

/** Útil para probar el deploy a mano desde el navegador (GET). No
 *  expone ningún dato — solo confirma que el backend está vivo. */
function doGet() {
    return ContentService
        .createTextOutput(JSON.stringify({
            ok: true,
            mensaje: "Lucciano's Academy backend activo",
            version: BACKEND_VERSION,
        }))
        .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   AUTENTICACIÓN — verificación de identidad y tokens de sesión
============================================================ */

function _secret() {
    const s = PropertiesService.getScriptProperties().getProperty("SESSION_SECRET");
    if (!s) throw new Error("Falta configurar SESSION_SECRET en Propiedades del script (ver comentario de cabecera de Code.gs).");
    return s;
}

/* ------------------------------------------------------------------
   Verificación de firma RSA (RS256) del ID token de Google — JWKS.

   Google firma cada ID token con RS256 usando una de las claves privadas
   publicadas en https://www.googleapis.com/oauth2/v3/certs (JWKS). Acá
   verificamos la firma LOCALMENTE contra la clave pública correspondiente
   (por 'kid'), sin depender de tokeninfo (que en su momento fallaba de
   forma no diagnosticable y sumaba una llamada externa por login).

   Matemática: RSA "descifra" la firma con la clave pública →
   firma^e mod n = EM, el bloque de padding PKCS#1 v1.5:
       00 01 FF..FF 00  DigestInfo(SHA-256) || SHA-256(header.payload)
   Reconstruimos ese bloque esperado y lo comparamos entero (no solo el
   sufijo): valida el padding completo, no solo el hash.

   Apps Script (V8) soporta BigInt nativo, así que la exponenciación modular
   de 2048 bits corre sin librerías externas.
------------------------------------------------------------------ */

// Bytes con signo (-128..127, como los devuelve Utilities) → BigInt sin signo.
function _bytesABigInt(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i] & 0xFF;
        hex += (b < 16 ? "0" : "") + b.toString(16);
    }
    return hex === "" ? BigInt(0) : BigInt("0x" + hex);
}

// base64url (n, e del JWKS; firma del JWT) → BigInt.
function _b64urlABigInt(b64url) {
    return _bytesABigInt(Utilities.base64DecodeWebSafe(b64url));
}

// Exponenciación modular: base^exp mod mod (BigInt).
function _modpow(base, exp, mod) {
    let r = BigInt(1);
    base = base % mod;
    while (exp > BigInt(0)) {
        if (exp & BigInt(1)) r = (r * base) % mod;
        exp >>= BigInt(1);
        base = (base * base) % mod;
    }
    return r;
}

// Claves públicas de Google (JWKS), cacheadas 1h para no bajarlas en cada login.
function _clavesGoogle() {
    const cache = CacheService.getScriptCache();
    const cacheado = cache.get("jwks_google");
    if (cacheado) return JSON.parse(cacheado);
    const resp = UrlFetchApp.fetch("https://www.googleapis.com/oauth2/v3/certs", { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    const jwks = JSON.parse(resp.getContentText());
    cache.put("jwks_google", JSON.stringify(jwks), 3600);
    return jwks;
}

/**
 * Verifica la firma criptográfica RS256 de un JWT contra las claves
 * públicas de Google. Devuelve true SOLO si la firma es válida.
 */
function _verificarFirmaJWT(idToken) {
    try {
        const partes = String(idToken).split(".");
        if (partes.length !== 3) return false;

        const header = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[0])).getDataAsString());
        if (header.alg !== "RS256" || !header.kid) return false;

        const jwks = _clavesGoogle();
        if (!jwks || !jwks.keys) return false;
        const clave = jwks.keys.filter(function (k) { return k.kid === header.kid; })[0];
        if (!clave || clave.kty !== "RSA") return false;

        const n = _b64urlABigInt(clave.n);
        const e = _b64urlABigInt(clave.e);
        const firma = _b64urlABigInt(partes[2]);
        if (firma >= n) return false;

        // firma^e mod n = EM. BigInt descarta el 0x00 inicial del bloque.
        let emHex = _modpow(firma, e, n).toString(16);
        if (emHex.length % 2) emHex = "0" + emHex;

        // SHA-256 del signing input (header.payload, ASCII).
        const hash = Utilities.computeDigest(
            Utilities.DigestAlgorithm.SHA_256, partes[0] + "." + partes[1], Utilities.Charset.US_ASCII);
        let hashHex = "";
        for (let i = 0; i < hash.length; i++) {
            const b = hash[i] & 0xFF;
            hashHex += (b < 16 ? "0" : "") + b.toString(16);
        }

        // DigestInfo ASN.1 de SHA-256 + el hash.
        const tHex = "3031300d060960864801650304020105000420" + hashHex;
        // EM esperado SIN el 0x00 inicial: 01 FF..FF 00 T. Derivamos el largo
        // del relleno del propio emHex y comparamos el bloque COMPLETO.
        const psLen = (emHex.length - 2 - 2 - tHex.length) / 2;
        if (psLen < 8 || !Number.isInteger(psLen)) return false;
        let esperado = "01";
        for (let i = 0; i < psLen; i++) esperado += "ff";
        esperado += "00" + tHex;
        return emHex === esperado;
    } catch (err) {
        return false;
    }
}

/**
 * Verifica el ID token de Google y devuelve el email en minúsculas, o null.
 * Chequea, en orden: firma RS256 (contra JWKS de Google) → aud (nuestra app)
 * → iss (Google) → exp (vigente) → email_verified.
 */
function _verificarIdTokenGoogle(idToken) {
    if (!idToken) return null;
    try {
        const partes = String(idToken).split(".");
        if (partes.length !== 3) return null;

        // 1) Firma criptográfica: sin esto, un JWT con claims correctos se forja.
        if (!_verificarFirmaJWT(idToken)) return null;

        const info = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(partes[1])).getDataAsString());
        // 2) Token emitido para NUESTRA app (aud), por Google (iss) y vigente (exp).
        if (info.aud !== GOOGLE_CLIENT_ID) return null;
        if (info.iss !== "https://accounts.google.com" && info.iss !== "accounts.google.com") return null;
        if (Number(info.exp) < Math.floor(Date.now() / 1000)) return null;
        // 3) Email confirmado por Google (viene como booleano o string "true").
        if (info.email_verified !== true && info.email_verified !== "true") return null;
        return String(info.email || "").trim().toLowerCase();
    } catch (err) {
        return null;
    }
}

function _firmar(payloadB64) {
    const bytes = Utilities.computeHmacSha256Signature(payloadB64, _secret());
    return Utilities.base64EncodeWebSafe(bytes);
}

/** Token de sesión propio: "<payload>.<firma>" donde payload =
 *  base64(email|expiraUnix). No lleva datos sensibles y su firma
 *  depende del SESSION_SECRET que nunca sale del backend. */
function _emitirToken(email) {
    const expira = Date.now() + SESION_DURACION_MS;
    const payloadB64 = Utilities.base64EncodeWebSafe(email + "|" + expira);
    return payloadB64 + "." + _firmar(payloadB64);
}

/** Verifica firma + expiración de un token propio. Devuelve
 *  { email } o null. No llama a Google (rápido). */
function _verificarToken(token) {
    if (!token || typeof token !== "string") return null;
    const partes = token.split(".");
    if (partes.length !== 2) return null;
    const payloadB64 = partes[0];
    const firma = partes[1];
    if (_firmar(payloadB64) !== firma) return null;

    let decodificado;
    try {
        decodificado = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString();
    } catch (err) {
        return null;
    }
    const sep = decodificado.lastIndexOf("|");
    if (sep === -1) return null;
    const email = decodificado.substring(0, sep);
    const expira = Number(decodificado.substring(sep + 1));
    if (!email || !expira || Date.now() > expira) return null;
    return { email: email };
}

/* ============================================================
   HELPERS DE HOJA (bajo nivel, sin autorización)
============================================================ */

function _sheet(nombre) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
    if (!sheet) throw new Error('No existe la hoja "' + nombre + '"');
    return sheet;
}

/** "YYYY-MM-DD" de hoy, en la zona horaria de la planilla — comparable
 *  como string contra fechaVencimientoAcceso (mismo formato). */
function _fechaHoyISO() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/** Ciclo actual de Gestión de tareas — "semanal" → lunes de la semana
 *  en curso ("AAAA-MM-DD"); "mensual" → mes en curso ("AAAA-MM"). El
 *  corte NO es a medianoche: pedido explícito del usuario (2026-08-31)
 *  — el cierre de la noche del domingo (o de fin de mes) se extiende de
 *  madrugada, y a esa hora todavía tiene que contar como el ciclo que
 *  termina, no el que arranca. Restar 4 horas al instante actual ANTES
 *  de calcular semana/mes resuelve las dos frecuencias con la misma
 *  cuenta: antes de las 04:00 todavía es "ayer" a todo efecto.
 *  Se arma con Utilities.formatDate (zona del script), no con los
 *  getters locales de Date — Apps Script puede correr en un huso
 *  horario de contenedor distinto al configurado en el proyecto. */
function _cicloActual(frecuencia) {
    const tz = Session.getScriptTimeZone();
    const efectiva = new Date(Date.now() - 4 * 60 * 60 * 1000);
    if (frecuencia === "mensual") {
        return Utilities.formatDate(efectiva, tz, "yyyy-MM");
    }
    // "u" = día ISO de la semana en la zona del script: 1=lunes..7=domingo.
    const diaIso = Number(Utilities.formatDate(efectiva, tz, "u"));
    const [anio, mes, dia] = Utilities.formatDate(efectiva, tz, "yyyy-MM-dd").split("-").map(Number);
    const comoUTC = new Date(Date.UTC(anio, mes - 1, dia));
    comoUTC.setUTCDate(comoUTC.getUTCDate() - (diaIso - 1));
    return Utilities.formatDate(comoUTC, "UTC", "yyyy-MM-dd");
}

/** Si Sheets detectó una celda como fecha (ej. porque alguien tipeó
 *  "2026-08-03" y Sheets la autoformateó a fecha), getValues() la
 *  devuelve como objeto Date, no como texto — y ese Date, al viajar en
 *  el JSON de la respuesta, termina en el cliente como
 *  "2026-08-03T03:00:00.000Z" en vez de "2026-08-03". Achatarlo acá,
 *  para todas las columnas, evita ese problema de raíz en vez de
 *  parchearlo columna por columna. */
function _celdaComoTexto(valor) {
    return valor instanceof Date
        ? Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd")
        : valor;
}

/** Defensa contra "Formula Injection": un valor de texto que empieza
 *  con = + - @ lo interpretaría Sheets como fórmula al recalcular (ej.
 *  un nombre "=IMPORTXML(...)" exfiltrando datos). El prefijo comilla
 *  simple es el escape estándar de Sheets — se guarda/lee como texto
 *  plano, la comilla no queda almacenada. Solo aplica a strings; los
 *  números (progreso, etc.) pasan sin tocar. */
function _sanitizarCelda(valor) {
    if (typeof valor === "string" && /^[=+\-@]/.test(valor)) {
        return "'" + valor;
    }
    return valor;
}

function _filasComoObjetos(sheet) {
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    return datos.slice(1)
        .filter((fila) => fila.some((celda) => celda !== ""))
        .map((fila) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = _celdaComoTexto(fila[i]); });
            return obj;
        });
}

/**
 * IDs nunca se reciclan, ni siquiera después de borrar filas: si se
 * calculara solo con el máximo actual de la hoja, borrar un usuario
 * de prueba liberaría su id para el próximo usuario real, que así
 * heredaría cualquier Asignación/Resultado huérfano que haya quedado
 * con ese mismo colaboradorId (esto ya pasó — ver Maria Belen Ibañez,
 * julio 2026). Se guarda el máximo histórico por hoja en Script
 * Properties, que solo puede crecer.
 */
function _proximoId(sheet) {
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");
    let maxActual = 0;
    for (let i = 1; i < datos.length; i++) {
        const v = Number(datos[i][colId]);
        if (v > maxActual) maxActual = v;
    }

    const props = PropertiesService.getScriptProperties();
    const clave = "proximoId_" + sheet.getName();
    const maxGuardado = Number(props.getProperty(clave)) || 0;

    const nuevoId = Math.max(maxActual, maxGuardado) + 1;
    props.setProperty(clave, String(nuevoId));
    return nuevoId;
}

function _leerCrudo(hoja) {
    return _filasComoObjetos(_sheet(hoja));
}

/**
 * Bug real (reportado en vivo, 2026-08-19): un canal creado con 2
 * miembros guardó "1,31" en la columna — Sheets, sin que nadie se lo
 * pida, lo interpretó como el NÚMERO 1,31 (coma decimal, configuración
 * regional) en vez de dos ids separados por coma. Al leerlo de vuelta,
 * "1.31" no matchea ni con el id 1 ni con el 31 — el propio creador
 * del canal quedó afuera de su propio canal, sin ningún error visible.
 * appendRow()/setValue() dejan que Sheets adivine el tipo de cada
 * celda; para texto (cualquier lista separada por comas: miembros,
 * aplicaA, usuariosEspecificos, etc.) eso es exactamente lo que NO se
 * quiere. Forzar formato "@" (texto plano) ANTES de poner el valor
 * evita que la adivinanza pise ningún dato de acá en más.
 */
function _escribirCeldaSinAdivinar(celda, valor) {
    if (typeof valor === "string") celda.setNumberFormat("@");
    celda.setValue(valor);
}

function _escribirCrudo(hoja, fila) {
    const sheet = _sheet(hoja);
    const headers = sheet.getDataRange().getValues()[0];
    const nuevoId = _proximoId(sheet);
    const filaCompleta = Object.assign({ id: nuevoId }, fila);

    const filaDestino = sheet.getLastRow() + 1;
    headers.forEach((h, i) => {
        const valor = filaCompleta[h] !== undefined ? _sanitizarCelda(filaCompleta[h]) : "";
        _escribirCeldaSinAdivinar(sheet.getRange(filaDestino, i + 1), valor);
    });
    return { ok: true, id: nuevoId };
}

function _actualizarCrudo(hoja, id, cambios) {
    const sheet = _sheet(hoja);
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");

    for (let i = 1; i < datos.length; i++) {
        if (String(datos[i][colId]) === String(id)) {
            // Antes, si una columna no existía en la hoja (headers.indexOf
            // devuelve -1), ese campo se salteaba en silencio y la función
            // igual devolvía {ok:true} — el cliente creía que había
            // guardado todo cuando en realidad faltaba una columna en el
            // Sheet. Pasó de verdad con "foto" en Usuarios: la app decía
            // éxito, la foto nunca llegaba a la planilla. Ahora, si falta
            // alguna columna pedida, se avisa explícito en vez de mentir.
            const noEncontradas = [];
            Object.keys(cambios).forEach((key) => {
                const col = headers.indexOf(key);
                if (col === -1) { noEncontradas.push(key); return; }
                _escribirCeldaSinAdivinar(sheet.getRange(i + 1, col + 1), _sanitizarCelda(cambios[key]));
            });
            if (noEncontradas.length > 0) {
                return { ok: false, error: "Faltan columnas en \"" + hoja + "\": " + noEncontradas.join(", ") };
            }
            return { ok: true };
        }
    }
    return { ok: false, error: "No se encontró id " + id + " en " + hoja };
}

function _eliminarCrudo(hoja, id) {
    const sheet = _sheet(hoja);
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");

    for (let i = 1; i < datos.length; i++) {
        if (String(datos[i][colId]) === String(id)) {
            sheet.deleteRow(i + 1);
            return { ok: true };
        }
    }
    return { ok: false, error: "No se encontró id " + id + " en " + hoja };
}

/* ============================================================
   HANDLERS CON AUTORIZACIÓN (los que llama _despachar)
============================================================ */

function _esGestion(usuarioActual) {
    return usuarioActual.rol === "admin" || usuarioActual.rol === "supervisor";
}

/**
 * Qué filas de Usuarios puede ver alguien que NO es gestión.
 *
 * Antes se devolvía la hoja entera a cualquier autenticado: nombre,
 * email, local, estado y vencimiento de TODA la empresa quedaban a un
 * request de distancia para cualquier colaborador. No hacía falta para
 * nada — ninguna pantalla de colaborador raso usa la nómina; la única
 * que la necesita es "Mi equipo", y solo la ve un Encargado, de su
 * propio local.
 *
 *   - Encargado  → los de SU sucursal (es lo que su pantalla muestra).
 *   - Colaborador → solo su propia fila. No es un caso vacío: el router
 *     llama obtenerMiUsuario() en cada carga y necesita encontrarse.
 */
function _usuariosVisiblesPara(filas, usuarioActual) {
    if (usuarioActual.encargado) {
        const miSucursal = String(usuarioActual.sucursal || "").trim().toLowerCase();
        return filas.filter(function (f) {
            return String(f.sucursal || "").trim().toLowerCase() === miSucursal;
        });
    }
    return filas.filter(function (f) {
        return String(f.id) === String(usuarioActual.id);
    });
}

function leer(hoja, usuarioActual) {
    if (LECTURA_SOLO_GESTION.indexOf(hoja) !== -1 && !_esGestion(usuarioActual)) {
        return { ok: false, error: "No tenés permiso para leer " + hoja + "." };
    }

    const filas = _leerCrudo(hoja);

    // Un colaborador raso solo ve sus propias asignaciones/resultados;
    // gestión (admin/supervisor) ve todo (los dashboards lo necesitan).
    if ((hoja === "Asignaciones" || hoja === "Resultados") && !_esGestion(usuarioActual)) {
        return filas.filter((f) => String(f.colaboradorId) === String(usuarioActual.id));
    }

    // Tokens de push: cada uno ve los suyos. La app solo los consulta
    // para el indicador "notificaciones activadas" de Mi Perfil
    // (getTokensDeUsuario, con el id propio), así que filtrar no le
    // saca nada a nadie — y los tokens ajenos no tienen por qué estar
    // al alcance. El envío real de push los lee server-side con
    // _leerCrudo, sin pasar por acá.
    if (hoja === "Tokens" && !_esGestion(usuarioActual)) {
        return filas.filter((f) => String(f.usuarioId) === String(usuarioActual.id));
    }

    if (hoja === "Usuarios" && !_esGestion(usuarioActual)) {
        return _usuariosVisiblesPara(filas, usuarioActual);
    }

    // Canales privados: la lista de miembros se aplica ACÁ, no solo en el
    // navegador. La regla está escrita dos veces (acá y en
    // js/data/canales.js) y eso es a propósito: la del cliente decide qué
    // se dibuja, la de acá decide qué sale del servidor. Si se toca una,
    // hay que tocar la otra.
    if (hoja === "Canales") {
        return filas.filter((c) => _puedeVerCanal(c, usuarioActual));
    }

    // Y las publicaciones de adentro, que son el contenido real: sin esto
    // el canal quedaba oculto pero sus mensajes viajaban igual.
    if (hoja === "Publicaciones") {
        const permitidos = {};
        _leerCrudo("Canales").forEach(function (c) {
            if (_puedeVerCanal(c, usuarioActual)) permitidos[String(c.id)] = true;
        });
        return filas.filter((p) => permitidos[String(p.canal)]);
    }

    return filas;
}

/** Espejo de puedeVerCanal() de js/data/canales.js. La lista de miembros
 *  gana sobre todo, incluso sobre el pase de Admin: un canal armado para
 *  tres personas no lo ve un cuarto por tener rol de administrador. */
function _puedeVerCanal(canal, usuarioActual) {
    const miembros = String(canal.miembros || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    if (miembros.length) {
        return miembros.some(function (id) { return String(id) === String(usuarioActual.id); });
    }
    if (usuarioActual.rol === "admin") return true;
    const restriccion = String(canal.restringidoA || "").trim();
    if (!restriccion) return true;
    if (restriccion === "admin") return false;
    const esCapacitador = usuarioActual.rol === "supervisor" && String(usuarioActual.capacitador || "").trim().toUpperCase() === "SI";
    if (restriccion === "capacitador") return esCapacitador;
    if (restriccion === "supervisor") return usuarioActual.rol === "supervisor" && !esCapacitador;
    return false;
}

function escribir(hoja, fila, usuarioActual) {
    const permiso = _autorizarEscritura(hoja, "crear", usuarioActual);
    if (!permiso.ok) return permiso;

    fila = Object.assign({}, fila);

    // Crear un supervisor/admin es solo-admin (crear un colaborador lo
    // puede hacer también un supervisor).
    if (hoja === "Usuarios") {
        const rolNuevo = String(fila.rol || "").trim().toLowerCase();
        if ((rolNuevo === "admin" || rolNuevo === "supervisor") && usuarioActual.rol !== "admin") {
            return { ok: false, error: "Solo un administrador puede crear supervisores o administradores." };
        }
    }

    // colaboradorId/usuarioId SIEMPRE se fuerzan al id verificado del
    // token — el cliente no puede crear filas a nombre de otro.
    if (hoja === "Asignaciones" || hoja === "Resultados") {
        fila.colaboradorId = usuarioActual.id;
    }
    if (hoja === "Auditoria") {
        fila.usuarioId = usuarioActual.id;
    }

    return _escribirCrudo(hoja, fila);
}

/** Campos que CUALQUIER usuario autenticado puede cambiar en SU PROPIA
 *  fila de Usuarios, sin importar el rol: su foto de perfil y la marca
 *  de "ya vi la historia". Todo lo demás (rol, sucursal, activo,
 *  vencimiento) sigue siendo exclusivo de admin/supervisor.
 *  fechaModificacion viaja en todo payload (lo agrega dataSource.js),
 *  así que va en la lista o el autoservicio nunca pasaría. */
const CAMPOS_AUTOSERVICIO_USUARIOS = ["foto", "historiaVista", "fechaModificacion"];

/** true si es el propio usuario tocando solo sus campos de autoservicio
 *  — el caso "subo mi foto de perfil", que si no caía en el chequeo de
 *  rol y devolvía "No tenés permiso para actualizar en Usuarios". */
function _esAutoservicioUsuarios(hoja, id, cambios, usuarioActual) {
    if (hoja !== "Usuarios") return false;
    if (String(id) !== String(usuarioActual.id)) return false;
    return Object.keys(cambios).every((k) => CAMPOS_AUTOSERVICIO_USUARIOS.indexOf(k) !== -1);
}

/** La foto se muestra con <img src="..."> en pantallas que abre un
 *  ADMIN (lista de Colaboradores, Reportes). Si acá entrara texto
 *  libre, un colaborador podría guardarse una "foto" con comillas y
 *  un onerror, y ese código correría en la sesión del admin que la
 *  mire. El cliente ya escapa al pintar; esto es el segundo cerrojo,
 *  del lado que no se puede saltear llamando a la API a mano.
 *  Solo se aceptan URLs https sin comillas, espacios ni < >. */
function _fotoValida(url) {
    const v = String(url == null ? "" : url).trim();
    if (v === "") return true; // vacío = sacar la foto, es legítimo
    if (v.length > 500) return false;
    if (!/^https:\/\//i.test(v)) return false;
    return !/["'<>\s\\]/.test(v);
}

function actualizar(hoja, id, cambios, usuarioActual) {
    if (!_esAutoservicioUsuarios(hoja, id, cambios, usuarioActual)) {
        const permiso = _autorizarEscritura(hoja, "actualizar", usuarioActual);
        if (!permiso.ok) return permiso;
    }

    cambios = Object.assign({}, cambios);

    // Allow-list de campos en Usuarios: un supervisor puede editar
    // datos de su gente, pero NUNCA el rol ni el flag capacitador (si
    // no, se auto-promovería a admin mandando {rol:"admin"}). Solo el
    // admin puede tocar esos dos campos.
    if (hoja === "Usuarios" && usuarioActual.rol !== "admin") {
        delete cambios.rol;
        delete cambios.capacitador;
    }

    // Vale para cualquier rol: ni un admin tiene motivo para guardar
    // una "foto" que no sea una URL https limpia.
    if (hoja === "Usuarios" && cambios.hasOwnProperty("foto") && !_fotoValida(cambios.foto)) {
        return { ok: false, error: "La foto debe ser una URL https válida." };
    }

    // Noticias: colaborador solo puede tocar leidoPor (para marcar como leído)
    if (hoja === "Noticias" && usuarioActual.rol === "colaborador") {
        const cambiosOriginales = Object.keys(cambios);
        const permitidos = ["leidoPor"];
        const no_permitidos = cambiosOriginales.filter((c) => !permitidos.includes(c));
        if (no_permitidos.length > 0) {
            return { ok: false, error: "No tenés permiso para editar esos campos en Noticias." };
        }
    }

    return _actualizarCrudo(hoja, id, cambios);
}

function eliminar(hoja, id, usuarioActual) {
    const permiso = _autorizarEscritura(hoja, "eliminar", usuarioActual);
    if (!permiso.ok) return permiso;

    // Borrar a alguien del sistema tiene que llevarse también su carpeta
    // de Drive: si no, queda una carpeta huérfana con su foto para
    // siempre, y con rotación alta eso se acumula. Va ANTES de borrar la
    // fila porque necesita el nombre para encontrarla.
    //
    // Solo en "Eliminar" (borrado real, que ya se lleva asignaciones y
    // resultados). "Deshabilitar" no pasa por acá — ahí la persona sigue
    // en el sistema y su foto tiene que quedar, por si vuelve.
    if (hoja === "Usuarios") _borrarCarpetaDeColaborador(id);

    return _eliminarCrudo(hoja, id);
}

/**
 * Manda a la papelera la carpeta de Drive de un colaborador.
 *
 * A la papelera y no borrado definitivo: si alguien elimina a la
 * persona equivocada, dentro de los 30 días se recupera.
 *
 * Busca por ID, no por nombre: la carpeta se llama "Nombre (id)" y el
 * nombre pudo haber cambiado desde que se creó. El id es lo único
 * estable.
 *
 * Nunca tira error: que Drive falle no puede impedir que se borre al
 * usuario del sistema, que es lo que realmente pidió quien apretó el
 * botón.
 */
function _borrarCarpetaDeColaborador(id) {
    try {
        const raiz = DriveApp.getRootFolder();
        const recursos = raiz.getFoldersByName("Lucciano's Academy — Recursos");
        if (!recursos.hasNext()) return;
        const colaboradores = recursos.next().getFoldersByName("Colaboradores");
        if (!colaboradores.hasNext()) return;

        const buscado = String(id).split(".")[0];
        const carpetas = colaboradores.next().getFolders();
        while (carpetas.hasNext()) {
            const c = carpetas.next();
            const nombre = c.getName();
            // "Nombre (id)" o, en las viejas, solo el id.
            const m = nombre.match(/\((\d+)\)\s*$/);
            const idCarpeta = m ? m[1] : nombre.trim().split(".")[0];
            if (idCarpeta === buscado) {
                c.setTrashed(true);
                Logger.log("Carpeta de Drive enviada a papelera: " + nombre);
                return;
            }
        }
    } catch (err) {
        Logger.log("No se pudo borrar la carpeta de Drive: " + err.message);
    }
}

/** Interruptor de emergencia: por defecto Supervisor tiene paridad con
 *  Admin en Canales/Recursos (crear/actualizar/eliminar) — pedido
 *  explícito del usuario, para no depender de que Admin gestione todo.
 *  Si hace falta restringirlo por algún inconveniente puntual, alcanza
 *  con cargar la Propiedad del script SUPERVISOR_GESTIONA_CANALES_RECURSOS
 *  en "NO" (Configuración del proyecto → Propiedades del script, mismo
 *  lugar que SESSION_SECRET) — sin tocar código ni redesplegar. Ausente
 *  o cualquier otro valor = sigue como está hoy (Supervisor con paridad). */
function _supervisorGestionaCanalesRecursos() {
    const v = PropertiesService.getScriptProperties().getProperty("SUPERVISOR_GESTIONA_CANALES_RECURSOS");
    return String(v || "").trim().toUpperCase() !== "NO";
}

function _autorizarEscritura(hoja, operacion, usuarioActual) {
    if ((hoja === "Canales" || hoja === "Recursos") && !_supervisorGestionaCanalesRecursos()) {
        if (usuarioActual.rol === "admin") return { ok: true };
        return { ok: false, error: "La gestión de " + hoja + " está restringida a Admin por ahora." };
    }
    const reglas = PERMISOS_ESCRITURA[hoja];
    if (!reglas) return { ok: false, error: 'Hoja desconocida: "' + hoja + '".' };
    const permitidos = reglas[operacion] || [];
    if (permitidos.indexOf(usuarioActual.rol) === -1) {
        return { ok: false, error: "No tenés permiso para " + operacion + " en " + hoja + "." };
    }
    return { ok: true };
}

/* ============================================================
   LOGIN — verificación de identidad Google + emisión de token
============================================================ */

function _buscarFilaUsuario(email) {
    const usuarios = _filasComoObjetos(_sheet("Usuarios"));
    const emailNorm = String(email || "").trim().toLowerCase();
    return usuarios.find((f) => String(f.email || "").trim().toLowerCase() === emailNorm) || null;
}

/**
 * Devuelve el usuario normalizado al formato exacto de sesión que
 * espera el cliente (encargado/capacitador como booleanos, activo
 * como "SI"/"NO"), o null si no existe. Aplica el auto-vencimiento de
 * acceso (si ya pasó fechaVencimientoAcceso, lo desactiva en la hoja).
 */
function _usuarioDeSesion(email) {
    const fila = _buscarFilaUsuario(email);
    if (!fila) return null;

    let activo = String(fila.activo).toUpperCase() === "NO" ? "NO" : "SI";
    const rol = String(fila.rol || "").trim().toLowerCase();

    // Acceso con vencimiento (colaboradores dados de alta por un
    // Supervisor): si ya pasó la fecha, se desactiva acá mismo — no hay
    // proceso en segundo plano en esta arquitectura.
    //
    // Solo para rol colaborador — supervisor/admin se crean SIN
    // vencimiento a propósito (acceso permanente, ver README). Sin este
    // chequeo de rol, un supervisor que alguna vez existió como
    // colaborador (y conservó esa fecha al cambiarle el rol a mano en
    // la planilla) quedaba atrapado en un loop: el admin lo activaba,
    // volvía a intentar entrar, este chequeo lo desactivaba de nuevo en
    // el acto y el login se rechazaba — "lo activo y vuelve a aparecer
    // inactivo", reportado en vivo 2026-08-15.
    const vencimiento = String(fila.fechaVencimientoAcceso || "").trim();
    if (rol === "colaborador" && activo === "SI" && vencimiento && vencimiento < _fechaHoyISO()) {
        activo = "NO";
        _actualizarCrudo("Usuarios", fila.id, { activo: "NO" });
    }

    return {
        id: fila.id,
        nombre: String(fila.nombre || "").trim(),
        // trim+lowercase: un espacio de más cargado a mano en la celda
        // "rol" (ej. "colaborador ") rompe silenciosamente el menú del
        // cliente (MENU_POR_ROL busca clave exacta).
        email: String(fila.email || "").trim().toLowerCase(),
        rol: String(fila.rol || "").trim().toLowerCase(),
        encargado: String(fila.encargado || "").trim().toUpperCase() === "SI",
        // Faltaba acá (bug real, 2026-08-25): _usuarioDeSesion arma el
        // usuario en CADA request — enviarPushGestion y
        // actualizarDiasGestionSucursal miran este flag, así que sin
        // él un Responsable de turno (sin ser también de local)
        // fallaba siempre esas acciones, sin relación con su sucursal
        // ni con nada que hiciera mal.
        responsableTurno: String(fila.responsableTurno || "").trim().toUpperCase() === "SI",
        capacitador: String(fila.capacitador || "").trim().toUpperCase() === "SI",
        sucursal: String(fila.sucursal || "").trim(),
        foto: String(fila.foto || "").trim(),
        activo: activo,
    };
}

/**
 * Login. Recibe el ID token CRUDO de Google Sign-In (no un email —
 * antes se confiaba en un email en texto plano, lo que permitía
 * suplantar a cualquiera). Valida el token contra Google, saca el
 * email verificado, y si el usuario existe y está activo emite un
 * token de sesión propio.
 */
function verificarLogin(idToken) {
    if (!idToken) {
        // Cliente viejo (cacheado) que todavía manda {email} en vez de
        // {idToken}: fallamos claro en vez de crashear.
        return { ok: false, error: "Actualizá la app (recargá la página) para poder ingresar." };
    }

    const email = _verificarIdTokenGoogle(idToken);
    if (!email) {
        return { ok: false, error: "No pudimos verificar tu identidad con Google. Probá de nuevo." };
    }

    const usuario = _usuarioDeSesion(email);
    if (!usuario) {
        return { ok: false, error: "Tu cuenta (" + email + ") todavía no está registrada en Lucciano's Academy. Solicitá acceso a tu supervisor o administrador." };
    }
    if (usuario.activo === "NO") {
        return { ok: false, error: "Tu acceso está desactivado. Consultá con tu supervisor o administrador." };
    }

    _registrarIngreso(usuario);

    return { ok: true, usuario: usuario, sessionToken: _emitirToken(email) };
}

/** Días de acceso que suma cada ingreso. Espejo de DIAS_ACCESO_INICIAL
 *  en js/pages/colaboradores.js — si cambia uno, cambiar el otro. */
const DIAS_RENOVACION_POR_USO = 30;

/**
 * Renovación automática por uso — se llama en CADA login exitoso.
 *
 * El vencimiento de acceso se estaba usando como mecanismo de baja, y
 * para eso no sirve: obligaba al supervisor a renovar a mano gente que
 * evidentemente sigue trabajando, y esa fricción repetida empujaba a
 * marcar accesos como permanentes — que es justo lo que no se quiere,
 * porque alguien que se va de la empresa se queda con acceso a la base
 * para siempre.
 *
 * Invirtiendo la lógica: quien usa la app corre su propio vencimiento
 * hacia adelante y nunca vence; quien se fue simplemente deja de entrar
 * y su acceso caduca solo a los 30 días, sin que nadie tenga que
 * acordarse. El supervisor solo actúa en la excepción (dar de baja a
 * alguien que sabe que se fue → "Deshabilitar", que es inmediato).
 *
 * Los accesos permanentes (fechaVencimientoAcceso vacío) NO se tocan:
 * no hay nada que correr.
 */
function _registrarIngreso(usuario) {
    try {
        const cambios = { ultimoIngreso: _fechaHoyISO() };

        const fila = _buscarFilaUsuario(usuario.email);
        const vencimiento = fila ? String(fila.fechaVencimientoAcceso || "").trim() : "";
        if (vencimiento) {
            const nuevo = _sumarDiasISO(_fechaHoyISO(), DIAS_RENOVACION_POR_USO);
            // Solo empujar hacia adelante: si a alguien le dieron un
            // acceso más largo a propósito, no se lo acortamos.
            if (nuevo > vencimiento) cambios.fechaVencimientoAcceso = nuevo;
        }

        const r = _actualizarCrudo("Usuarios", usuario.id, cambios);

        // _actualizarCrudo rechaza el payload ENTERO si alguna columna
        // no existe. Sin este reintento, una planilla sin la columna
        // ultimoIngreso se llevaría puesta también la renovación del
        // vencimiento — el usuario terminaría venciendo igual y sin
        // ninguna señal de por qué.
        if (r && r.ok === false && cambios.fechaVencimientoAcceso) {
            Logger.log("Ingreso: " + r.error + " — reintentando solo con el vencimiento.");
            _actualizarCrudo("Usuarios", usuario.id, { fechaVencimientoAcceso: cambios.fechaVencimientoAcceso });
        }
    } catch (err) {
        // Nunca romper el login por esto: si falta la columna
        // ultimoIngreso, entrar sigue siendo más importante que
        // registrar la métrica.
        Logger.log("No se pudo registrar el ingreso: " + err.message);
    }
}

/** "2026-08-09" + n días → "2026-08-19". Trabaja en texto ISO para no
 *  depender de la zona horaria (una fecha sin hora corrida por UTC es
 *  el bug clásico acá). */
function _sumarDiasISO(fechaISO, dias) {
    const partes = String(fechaISO).split("-");
    const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    d.setDate(d.getDate() + Number(dias));
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/* ============================================================
   MAIL
============================================================ */

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida formato + intenta el envío sin tirar abajo el resto del
 *  lote si uno falla (ej. el usuario "prueba" tiene email:"prueba",
 *  no una dirección real — MailApp.sendEmail tira excepción con eso
 *  y, sin este try/catch, frenaba TODO el lote antes de mandar nada). */
function _enviarUnMail(email, asunto, cuerpo) {
    const limpio = String(email || "").trim();
    if (!REGEX_EMAIL.test(limpio)) return false;
    try {
        MailApp.sendEmail(limpio, asunto, cuerpo);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * Envío masivo genérico — lo usa la propia app (botón "Enviar mail"
 * en Colaboradores). Solo Admin (mismo criterio que el gate del
 * cliente). Mismo asunto/cuerpo para toda la lista. MailApp tiene un
 * límite diario de envíos (100/día en Gmail normal, más en Workspace).
 */
function enviarMailDesdeApp(destinatarios, asunto, cuerpo, usuarioActual) {
    if (!usuarioActual || usuarioActual.rol !== "admin") {
        return { ok: false, error: "Solo un administrador puede enviar mails desde la app." };
    }
    const fallidos = [];
    let enviados = 0;
    (destinatarios || []).forEach((email) => {
        if (_enviarUnMail(email, asunto, cuerpo)) {
            enviados++;
        } else {
            fallidos.push(String(email || "").trim());
        }
    });
    return { ok: true, enviados, fallidos };
}

/* ============================================================
   PUSH REAL — Firebase Cloud Messaging (Fase B de Coordinación
   Operativa / News)

   SETUP OBLIGATORIO (una sola vez, a mano, DESPUÉS de crear el
   proyecto Firebase — ver instrucciones fuera de este archivo):
   Configuración del proyecto → Propiedades del script → agregar:
     - FCM_PROJECT_ID    (el "ID de proyecto" de Firebase)
     - FCM_CLIENT_EMAIL  (campo "client_email" del JSON de la cuenta
                           de servicio, Configuración → Cuentas de
                           servicio → Generar nueva clave privada)
     - FCM_PRIVATE_KEY   (campo "private_key" de ESE MISMO JSON,
                           completo, con los \n incluidos)
   Sin esto, enviarPush() falla con un error claro (mismo criterio
   que _secret() para SESSION_SECRET) — no rompe el resto del backend.

   Por qué un JWT propio y no una librería: Apps Script no tiene un
   cliente OAuth2 de Google para cuentas de servicio incluido, pero
   Utilities.computeRsaSha256Signature() firma RS256 con una clave PEM
   directamente — alcanza para armar el JWT "a mano" (header.claims,
   firmado) y cambiarlo por un access_token en el endpoint estándar de
   Google. El token se cachea (CacheService) porque vale por 1h y
   armar+firmar el JWT en cada request sería trabajo de más.
============================================================ */

function _propFCM(nombre) {
    const v = PropertiesService.getScriptProperties().getProperty(nombre);
    if (!v) throw new Error("Falta configurar " + nombre + " en Propiedades del script (ver comentario arriba de _propFCM).");
    return v;
}

function _base64url(bytes) {
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

/** Access token OAuth2 para llamar a la API de FCM, vía el flujo
 *  "JWT Bearer" de cuentas de servicio de Google. Cacheado 55min
 *  (el token real vale 60min — margen para no usarlo justo vencido). */
function _obtenerAccessTokenFCM() {
    const cache = CacheService.getScriptCache();
    const cacheado = cache.get("fcm_access_token");
    if (cacheado) return cacheado;

    const clientEmail = _propFCM("FCM_CLIENT_EMAIL");
    // computeRsaSha256Signature exige un PEM con saltos de línea REALES.
    // Si la propiedad se cargó con "\n" como texto literal (dos
    // caracteres, como aparece tal cual en el JSON crudo) en vez de
    // saltos de línea de verdad, esto lo normaliza — funciona para
    // cualquiera de las dos formas en las que alguien la haya pegado.
    const privateKey = _propFCM("FCM_PRIVATE_KEY").replace(/\\n/g, "\n");
    const ahora = Math.floor(Date.now() / 1000);

    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: ahora,
        exp: ahora + 3600,
    };

    const signingInput = _base64url(Utilities.newBlob(JSON.stringify(header)).getBytes())
        + "." + _base64url(Utilities.newBlob(JSON.stringify(claims)).getBytes());
    const firma = Utilities.computeRsaSha256Signature(signingInput, privateKey);
    const jwt = signingInput + "." + _base64url(firma);

    const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
        method: "post",
        payload: {
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        },
        muteHttpExceptions: true,
    });

    const data = JSON.parse(resp.getContentText());
    if (!data.access_token) throw new Error("No se pudo obtener access token de FCM: " + resp.getContentText());

    cache.put("fcm_access_token", data.access_token, 55 * 60);
    return data.access_token;
}

/** Manda UN push a UN token. Devuelve {ok, invalido} — invalido:true
 *  cuando FCM dice que ese token ya no sirve (UNREGISTERED/inválido),
 *  para que el caller lo borre de la hoja "Tokens" y no lo siga
 *  intentando para siempre.
 *
 *  A propósito manda un "data message" (todo adentro de "data", SIN
 *  campo "notification") en vez de un "notification message". Un
 *  mensaje CON "notification" espera que el SDK de Firebase lo
 *  decodifique del lado del service worker (formato interno propio) —
 *  nuestro sw.js ya no carga ese SDK ahí (ver sw.js), así que un
 *  push con "notification" podía llegar y quedar sin mostrarse, sin
 *  ningún error visible. Un "data message" es JSON plano que
 *  cualquier listener nativo de "push" puede leer sin depender de
 *  nada de Firebase — FCM lo entrega tal cual, sin magia de por
 *  medio. Nota: FCM exige que TODOS los valores de "data" sean
 *  strings (no objetos/números crudos). */
function _enviarUnPush(token, titulo, cuerpo, url, accessToken, projectId) {
    const resp = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send", {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + accessToken },
        payload: JSON.stringify({
            message: {
                token: token,
                data: { title: titulo, body: cuerpo, url: url || "" },
            },
        }),
        muteHttpExceptions: true,
    });

    if (resp.getResponseCode() === 200) return { ok: true };

    const texto = resp.getContentText();
    const invalido = /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(texto);
    return { ok: false, invalido: invalido };
}

/**
 * Envío masivo a una lista de usuarios (todos sus dispositivos
 * registrados en "Tokens") — Admin y Supervisor (incluye Capacitador,
 * mismo criterio que Coordinación Operativa: no es de solo lectura
 * ahí). Limpia solo los tokens que FCM confirma inválidos; un error
 * de red/timeout puntual NO borra el token (podría ser transitorio).
 */
/** El envío real — sin ACL acá, cada acción que llama a esto valida
 *  el permiso ANTES (enviarPush: solo Admin/Supervisor con lista
 *  libre; enviarPushGestion: cualquiera con destinatarios que decide
 *  el servidor, no el cliente). */
function _enviarPushATodos(usuarioIds, titulo, cuerpo, url) {
    const projectId = _propFCM("FCM_PROJECT_ID");
    const accessToken = _obtenerAccessTokenFCM();

    const ids = usuarioIds.map(String);
    const tokens = _leerCrudo("Tokens").filter((t) => ids.includes(String(t.usuarioId)));

    let enviados = 0;
    const fallidos = [];
    tokens.forEach((t) => {
        const resultado = _enviarUnPush(t.token, titulo, cuerpo, url, accessToken, projectId);
        if (resultado.ok) {
            enviados++;
        } else {
            fallidos.push(t.token);
            if (resultado.invalido) _eliminarCrudo("Tokens", t.id);
        }
    });

    return { ok: true, enviados, fallidos: fallidos.length, destinatarios: tokens.length };
}

function enviarPush(usuarioIds, titulo, cuerpo, url, usuarioActual) {
    if (!_esGestion(usuarioActual)) {
        return { ok: false, error: "Solo Admin o Supervisor pueden mandar notificaciones push." };
    }
    if (!titulo || !(usuarioIds || []).length) {
        return { ok: false, error: "Falta título o destinatarios." };
    }
    return _enviarPushATodos(usuarioIds, titulo, cuerpo, url);
}

/** Push acotado para "Gestión semanal" (#/gestion) — a diferencia de
 *  enviarPush (solo Admin/Supervisor, acepta CUALQUIER lista de
 *  destinatarios que mande el cliente), esta la puede llamar
 *  cualquier Responsable de local/turno, pero el SERVIDOR decide los
 *  destinatarios — el cliente no manda ninguna lista de ids, así no
 *  hay forma de usarla para avisarle a alguien ajeno a su local.
 *  Destinatarios: los demás Responsables de local/turno de SU MISMA
 *  sucursal. (Hasta 2026-08-24 sumaba también a todo Admin como
 *  testigo mientras se confirmaba que llegaba — ya confirmado con
 *  cuentas reales de Responsable de local y de turno, se sacó.) */
/** ids de Usuarios que son Responsable de local o de turno (encargado
 *  o responsableTurno) en UNA sucursal — extraído de enviarPushGestion
 *  (2026-08-26) porque _revisarRecordatoriosGestion necesita
 *  exactamente el mismo cálculo, sin depender de un usuarioActual (el
 *  trigger de tiempo no tiene sesión). "excluirId" es opcional (lo usa
 *  enviarPushGestion para no duplicar a quien ya se suma aparte).
 *
 *  Chequeo de "activo" (2026-08-31, bug reportado en vivo): "borrar" un
 *  usuario en esta app en realidad lo desactiva (activo="NO"), la fila
 *  sigue existiendo con sus flags encargado/responsableTurno intactos
 *  — sin este chequeo, alguien desactivado seguía recibiendo avisos de
 *  Gestión para siempre. */
function _responsablesDeSucursal(sucursal, excluirId) {
    const suc = String(sucursal || "").trim().toLowerCase();
    if (!suc) return [];
    const usuarios = _filasComoObjetos(_sheet("Usuarios"));
    return usuarios.filter(function (u) {
        if (excluirId && String(u.id) === String(excluirId)) return false;
        if (String(u.activo).toUpperCase() === "NO") return false;
        return String(u.sucursal || "").trim().toLowerCase() === suc
            && (String(u.encargado || "").toUpperCase() === "SI" || String(u.responsableTurno || "").toUpperCase() === "SI");
    }).map(function (u) { return u.id; });
}

function enviarPushGestion(titulo, cuerpo, url, usuarioActual) {
    const puedeUsar = _esGestion(usuarioActual) || usuarioActual.encargado || usuarioActual.responsableTurno;
    if (!puedeUsar) {
        return { ok: false, error: "Solo Responsable de local/turno (o Admin/Supervisor) pueden avisar desde acá." };
    }
    if (!titulo) return { ok: false, error: "Falta título." };

    const otrosResponsables = _responsablesDeSucursal(usuarioActual.sucursal, usuarioActual.id);

    // Pedido explícito del usuario (2026-08-25): "ese push debe ir
    // directo a quien lo envía... para asegurarse de que el mensaje
    // efectivamente salió" — antes se excluía a uno mismo a propósito;
    // ahora SIEMPRE se suma el propio id, así quien manda el aviso
    // recibe su propia confirmación en el celular, sin depender de
    // tener otra cuenta a mano para verificar que la notificación
    // realmente llegó a algún lado.
    const destinatarios = [usuarioActual.id].concat(otrosResponsables);
    return _enviarPushATodos(destinatarios, titulo, cuerpo, url);
}

/* ============================================================
   RECORDATORIOS AUTOMÁTICOS de Gestión semanal (2026-08-26)

   Pedido explícito: "las tareas que recibirían push son las semanales
   fijando un horario 10am, las que son mensuales un día antes 10am y
   luego el mismo día 10am". Corre vía un TRIGGER DE TIEMPO instalado
   a mano (ver instalarTriggerRecordatoriosGestion más abajo, se corre
   UNA sola vez desde el editor de Apps Script) — no hay forma de
   instalarlo desde acá (Claude Code no tiene acceso a tu cuenta de
   Google).

   No guarda estado propio (qué ya avisó hoy): revisa el día real cada
   vez que corre. Con el trigger disparando una vez por día está bien
   así de simple — si algún día se dispara dos veces el mismo día
   (poco probable, pero Apps Script no garantiza el minuto exacto,
   solo la hora), mandaría el mismo aviso dos veces. Aceptado como
   límite conocido, no se resuelve acá.

   OJO ZONA HORARIA: "hoy"/"mañana" salen de Session.getScriptTimeZone()
   — la del PROYECTO de Apps Script, UNA sola para toda la red. Con
   locales reales en Uruguay/Chile/España/USA/Italia (varios husos
   horarios), "10am" es exacto para la zona del proyecto (Argentina) y
   puede caer en otra hora local en el resto — límite conocido, no
   resuelto acá.
============================================================ */

const _DIAS_SEMANA_GESTION = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Hora del recordatorio automático de Gestión — configurable por
 *  Admin desde la app (2026-08-31, pedido explícito: "arma los push
 *  manuales para que pueda decidir el horario"), antes fija en el
 *  código (10am). Vive en Script Properties, no en una Sheet — es un
 *  ajuste global de la red entera, no un dato por fila. Sin configurar
 *  todavía, cae a 10 (el default de siempre) para no cambiar nada
 *  hasta que un Admin lo toque una vez. */
const _PROP_HORA_RECORDATORIO_GESTION = "RECORDATORIO_GESTION_HORA";

function _horaRecordatorioGestion() {
    const v = Number(PropertiesService.getScriptProperties().getProperty(_PROP_HORA_RECORDATORIO_GESTION));
    return Number.isInteger(v) && v >= 0 && v <= 23 ? v : 10;
}

/** Lectura del horario configurado — solo Admin (mismo gate que
 *  guardarlo; no hace falta que nadie más lo sepa). */
function obtenerHorarioRecordatorioGestion(usuarioActual) {
    if (usuarioActual.rol !== "admin") {
        return { ok: false, error: "Solo Admin puede ver el horario del recordatorio." };
    }
    return { ok: true, hora: _horaRecordatorioGestion() };
}

function guardarHorarioRecordatorioGestion(hora, usuarioActual) {
    if (usuarioActual.rol !== "admin") {
        return { ok: false, error: "Solo Admin puede configurar el horario del recordatorio." };
    }
    const horaNum = Number(hora);
    if (!Number.isInteger(horaNum) || horaNum < 0 || horaNum > 23) {
        return { ok: false, error: "La hora tiene que ser un número entero entre 0 y 23." };
    }
    PropertiesService.getScriptProperties().setProperty(_PROP_HORA_RECORDATORIO_GESTION, String(horaNum));
    return { ok: true, hora: horaNum };
}

/** true si esa tarea+sucursal+día ya está resuelta EN EL CICLO ACTUAL
 *  — pedido explícito 2026-08-31: "una tarea completada no vuelve a
 *  generar recordatorios durante ese ciclo". Antes esta función no
 *  chequeaba GestionChecks para nada: mandaba el recordatorio con solo
 *  mirar si hoy correspondía, tarea ya hecha o no. Una fila de un ciclo
 *  VIEJO (el reset todavía no la tocó de nuevo) no cuenta como "ya
 *  hecha" — si contara, la primera vez de cada ciclo nuevo no
 *  recordaría nada. */
function _tareaYaResueltaEnCiclo(checksPorClave, tareaId, sucursal, dia, cicloEsperado) {
    const check = checksPorClave[tareaId + "|" + String(sucursal || "").trim().toLowerCase() + "|" + dia];
    if (!check) return false;
    if (check.ciclo && check.ciclo !== cicloEsperado) return false;
    return String(check.hecho).toUpperCase() === "SI" || String(check.cerrada).toUpperCase() === "SI";
}

/** Hora efectiva de recordatorio de UNA tarea puntual, o null si la
 *  tiene apagado — pedido explícito 2026-08-31: "el tema push quiero
 *  que sea por tarea", reemplaza el horario único de antes. Sin hora
 *  propia (recordatorioHora vacío), usa el horario general (Admin,
 *  ver _horaRecordatorioGestion) como default. */
function _horaEfectivaRecordatorio(tarea) {
    if (String(tarea.recordatorioHabilitado || "SI").toUpperCase() === "NO") return null;
    const propia = Number(tarea.recordatorioHora);
    return Number.isInteger(propia) && propia >= 0 && propia <= 23 ? propia : _horaRecordatorioGestion();
}

function _revisarRecordatoriosGestion() {
    // El trigger corre CADA HORA (ver instalarTriggerRecordatoriosGestion)
    // — cada tarea decide acá adentro si ESTA hora es la suya (propia o,
    // sin una configurada, el horario general de Admin), así cambiar
    // cualquier horario desde la app no requiere tocar Apps Script.
    const horaActual = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "H"));

    const hoy = new Date();
    const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
    const diaSemanaHoy = _DIAS_SEMANA_GESTION[hoy.getDay()];
    const diaMesHoy = String(hoy.getDate());
    const diaMesManana = String(manana.getDate());

    const catalogo = {};
    _leerCrudo("GestionTareas").forEach(function (t) { catalogo[String(t.id)] = t; });

    const checksPorClave = {};
    _leerCrudo("GestionChecks").forEach(function (f) {
        checksPorClave[f.tareaId + "|" + String(f.sucursal || "").trim().toLowerCase() + "|" + f.dia] = f;
    });
    const cicloSemanalActual = _cicloActual("semanal");
    const cicloMensualActual = _cicloActual("mensual");

    _leerCrudo("GestionTareasSucursal").forEach(function (fila) {
        const tarea = catalogo[String(fila.tareaId)];
        if (!tarea || !tarea.titulo) return;
        const dias = String(fila.dias || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!dias.length) return;

        // Recordatorio por tarea — esta tarea puede tener su propio
        // horario, o el recordatorio directamente apagado (horaEfectiva
        // null). Sin esto, TODAS las tareas se revisaban a la hora
        // general por igual.
        const horaEfectiva = _horaEfectivaRecordatorio(tarea);
        if (horaEfectiva === null || horaActual !== horaEfectiva) return;

        const destinatarios = _responsablesDeSucursal(fila.sucursal, null);
        if (!destinatarios.length) return;

        if (fila.frecuencia !== "mensual") {
            if (dias.indexOf(diaSemanaHoy) === -1) return;
            if (_tareaYaResueltaEnCiclo(checksPorClave, fila.tareaId, fila.sucursal, diaSemanaHoy, cicloSemanalActual)) return;
            _enviarPushATodos(destinatarios, tarea.titulo, tarea.detalle || "Recordatorio de tarea de hoy.", "#/gestion");
            return;
        }
        if (dias.indexOf(diaMesManana) !== -1 && !_tareaYaResueltaEnCiclo(checksPorClave, fila.tareaId, fila.sucursal, diaMesManana, cicloMensualActual)) {
            _enviarPushATodos(destinatarios, tarea.titulo, "Mañana: " + (tarea.detalle || "recordatorio de tarea mensual."), "#/gestion");
        }
        if (dias.indexOf(diaMesHoy) !== -1 && !_tareaYaResueltaEnCiclo(checksPorClave, fila.tareaId, fila.sucursal, diaMesHoy, cicloMensualActual)) {
            _enviarPushATodos(destinatarios, tarea.titulo, tarea.detalle || "Recordatorio de tarea de hoy.", "#/gestion");
        }
    });
}

/** Correr UNA SOLA VEZ desde el editor de Apps Script (elegir esta
 *  función en el desplegable de arriba de "Ejecutar", tocar Ejecutar)
 *  para instalar el trigger — no hace falta tocar nada más.
 *
 *  2026-08-31 — horario configurable desde la app (antes fijo a las
 *  10am, un solo trigger diario a esa hora): ahora el trigger corre
 *  CADA HORA, y _revisarRecordatoriosGestion decide puertas adentro si
 *  esta hora es la configurada (ver _horaRecordatorioGestion) — así
 *  cambiar el horario desde Admin no requiere tocar Apps Script de
 *  nuevo. Por eso ahora esta función BORRA cualquier trigger viejo de
 *  _revisarRecordatoriosGestion (el diario a las 10, de antes de este
 *  cambio) antes de crear el nuevo — dejarlo habría duplicado los
 *  avisos justo a las 10 (uno por cada trigger corriendo esa hora).
 *  Correrla de nuevo más adelante sigue siendo seguro: siempre queda
 *  UN solo trigger, nunca dos. */
function instalarTriggerRecordatoriosGestion() {
    let borrados = 0;
    ScriptApp.getProjectTriggers().forEach(function (t) {
        if (t.getHandlerFunction() === "_revisarRecordatoriosGestion") {
            ScriptApp.deleteTrigger(t);
            borrados++;
        }
    });
    ScriptApp.newTrigger("_revisarRecordatoriosGestion")
        .timeBased()
        .everyHours(1)
        .create();
    return "Trigger horario instalado" + (borrados ? " (se reemplazó " + borrados + " trigger viejo)" : "") + " — corre cada hora; cada tarea avisa en SU horario (o, sin uno propio, el general de Admin — hoy: " + _horaRecordatorioGestion() + ":00, zona " + Session.getScriptTimeZone() + ").";
}

/** "Días" de una tarea, POR SUCURSAL (Fase 2 de Gestión semanal,
 *  2026-08-25) — separado del catálogo de tareas (hoja
 *  "GestionTareas", solo Admin), que define QUÉ tareas existen
 *  (título/ícono/subitems), no en qué días le aplican a cada local.
 *  Cada sucursal tiene su propio esquema en la hoja
 *  "GestionTareasSucursal" (id | tareaId | sucursal | dias |
 *  frecuencia | fechaModificacion) — una fila por combinación
 *  tarea+sucursal que tenga AL MENOS un día elegido; sin fila = "sin
 *  usar" en esa sucursal, no hace falta escribir filas vacías para
 *  todo el catálogo por todos los locales. "frecuencia" (2026-08-26)
 *  es "semanal" o "mensual" — decide si "dias" son nombres de día
 *  ("Lunes") o números de día del mes ("20") PARA ESE LOCAL. Vive acá
 *  y no en el catálogo (GestionTareas) a propósito: la decide cada
 *  Responsable al asignar, no Admin al cargar la tarea.
 *
 *  El SERVIDOR decide de qué sucursal es la fila que se toca —
 *  usuarioActual.sucursal, nunca un valor que mande el cliente — así
 *  un Responsable de local no puede, ni por error ni a propósito,
 *  pisar el esquema de otro local. Mismo criterio de seguridad que
 *  enviarPushGestion. Admin/Supervisor/Capacitador NO escriben acá —
 *  ven cualquier sucursal en modo lectura desde el cliente (leyendo
 *  esta misma hoja entera, sin filtro server-side: no es información
 *  sensible), pero el esquema de cada local es potestad de SU
 *  Responsable, a propósito. */
function actualizarDiasGestionSucursal(tareaId, dias, frecuencia, usuarioActual) {
    if (!usuarioActual.encargado && !usuarioActual.responsableTurno) {
        return { ok: false, error: "Solo Responsable de local o de turno pueden editar los días de su local." };
    }
    const sucursal = String(usuarioActual.sucursal || "").trim();
    if (!sucursal) {
        return { ok: false, error: "Tu usuario no tiene un local asignado." };
    }
    if (!tareaId) return { ok: false, error: "Falta la tarea." };

    const filas = _leerCrudo("GestionTareasSucursal");
    const existente = filas.find(function (f) {
        return String(f.tareaId) === String(tareaId) && String(f.sucursal).trim() === sucursal;
    });
    const diasTexto = (dias || []).join(",");
    // "semanal" o "mensual" — pedido explícito (2026-08-26): la
    // frecuencia la decide CADA LOCAL al asignar, no el catálogo
    // (Admin solo carga título/ícono/detalle, "no tengo que estar
    // modificando nada"). Mismo criterio que "dias": vive acá, por
    // sucursal, no en GestionTareas.
    const frecuenciaTexto = frecuencia === "mensual" ? "mensual" : "semanal";
    const ahora = new Date().toISOString();

    if (existente) {
        if (!diasTexto) return _eliminarCrudo("GestionTareasSucursal", existente.id);
        return _actualizarCrudo("GestionTareasSucursal", existente.id, { dias: diasTexto, frecuencia: frecuenciaTexto, fechaModificacion: ahora });
    }
    if (!diasTexto) return { ok: true }; // nada que crear si ya arranca vacío
    return _escribirCrudo("GestionTareasSucursal", { tareaId: tareaId, sucursal: sucursal, dias: diasTexto, frecuencia: frecuenciaTexto, fechaModificacion: ahora });
}

/** Índices marcados de una lista "0,2,4" / "1:inc:Faltante,5:n:-320" —
 *  el índice es siempre lo que va ANTES del primer ":" (o la entrada
 *  entera si no tiene ":"). Usado para diffear qué sub-ítems son NUEVOS
 *  entre un guardado y el anterior (ver actualizarCheckGestion). */
function _indicesDeSubitems(csv) {
    return String(csv || "").split(",").filter(Boolean).map(function (e) { return e.split(":")[0]; });
}

/** "0:Belén Ibáñez:0910,2:Damián:2105" → {"0":{nombre,horaCompacta},...}
 *  — mismo encoding que serializarFirmaSubitem/parsearFirmaSubitem del
 *  cliente (services/subitems.js), reimplementado acá porque Apps
 *  Script no puede importar módulos ES del front. */
function _firmasComoMapa(csv) {
    const mapa = {};
    String(csv || "").split(",").filter(Boolean).forEach(function (entrada) {
        const partes = entrada.split(":");
        const indice = partes[0];
        const horaCompacta = partes[partes.length - 1] || "";
        const nombre = partes.slice(1, -1).join(":");
        mapa[indice] = { nombre: nombre, horaCompacta: horaCompacta };
    });
    return mapa;
}

/** El check de "hecho" de una tarea, POR SUCURSAL Y POR DÍA — antes
 *  era puramente visual (vivía en el navegador de quien lo tocaba, se
 *  perdía al recargar y nunca se veía entre dispositivos distintos:
 *  bug real reportado en vivo, "quien dio el marcado no le aparece al
 *  otro"). Hoja "GestionChecks" (id | tareaId | sucursal | dia |
 *  hecho | marcadoPor | hora | fechaModificacion) — una fila por
 *  combinación tarea+sucursal+día. Mismo criterio de seguridad que
 *  actualizarDiasGestionSucursal: el servidor decide la sucursal
 *  desde usuarioActual, nunca el cliente.
 *
 *  Guarda el estado GLOBAL de la tarea (completa o no), no el detalle
 *  de cada sub-ítem — una tarea con sub-ítems se guarda como
 *  completa/incompleta en su conjunto, no ítem por ítem. Simplifica
 *  el modelo y alcanza para lo pedido: saber si YA SE HIZO, no
 *  reconstruir exactamente cuáles de los sub-ítems. */
/**
 * subitemsMarcados (2026-08-26) — antes SOLO se guardaba "hecho: SI/NO"
 * (la tarea completa o no), nunca el detalle de qué sub-ítem estaba
 * tildado. Reportado en vivo: una tarea con checklist a MITAD de
 * camino (3 de 5 tildados, nunca llegó a completa) no tenía ninguna
 * fila guardada — al volver a abrir la app (o con cualquier recarga)
 * ese progreso parcial desaparecía, "quedaba todo desmarcado". Ahora
 * el cliente manda además la lista de índices tildados (string
 * separado por comas, ej. "0,2,4", mismo criterio que "dias") y esa
 * lista se guarda pase lo que pase, esté completa la tarea o no —
 * "hecho" sigue existiendo aparte para no romper las tareas simples
 * (sin sub-ítems, que no mandan este parámetro).
 *
 * subitemsMarcados es OPCIONAL a propósito: las tareas simples (sin
 * checklist) siguen llamando esto sin el 5to parámetro, igual que
 * siempre — undefined acá NUNCA toca esa columna.
 *
 * ciclo / cerrada+cerradaPor+cerradaHora / subitemsFirmas (2026-08-31)
 * — reset automático de ciclo, candado al completar (con "Reabrir" solo
 * para Admin, ver reabrirTareaGestion) y firma por sub-ítem, pedido
 * explícito del usuario. "cerrada" se estampa cuando ESTE guardado deja
 * la tarea completa (mismo "hecho" que ya decide el cliente); a partir
 * de ahí cualquier nuevo guardado sobre esa fila se rechaza acá mismo,
 * antes de tocar nada.
 *
 * OJO: TODAS estas columnas nuevas ("ciclo", "cerrada", "cerradaPor",
 * "cerradaHora", "subitemsFirmas") tienen que existir en la hoja
 * "GestionChecks" ANTES de pegar este código en producción — igual que
 * ya pasó con "subitemsMarcados": sin la columna, _actualizarCrudo
 * (guardar sobre una fila EXISTENTE) devuelve "Faltan columnas..." en
 * vez de guardar. _escribirCrudo (fila nueva) sí las saltea en
 * silencio si faltan, así que el síntoma solo aparece al re-guardar
 * algo ya guardado antes.
 */
function actualizarCheckGestion(tareaId, dia, hecho, usuarioActual, subitemsMarcados) {
    if (!usuarioActual.encargado && !usuarioActual.responsableTurno) {
        return { ok: false, error: "Solo Responsable de local o de turno pueden marcar tareas de su local." };
    }
    const sucursal = String(usuarioActual.sucursal || "").trim();
    if (!sucursal) return { ok: false, error: "Tu usuario no tiene un local asignado." };
    if (!tareaId || !dia) return { ok: false, error: "Falta la tarea o el día." };

    // Frecuencia real de ESTA tarea en ESTE local (nunca la manda el
    // cliente, mismo criterio que "sucursal") — decide si el ciclo es
    // semanal o mensual para esta fila puntual. Se calcula ANTES de
    // buscar "existente": la fila a tocar es la de ESTE ciclo, nunca
    // una de un ciclo viejo — sin esto, el primer guardado de una
    // semana/mes nuevo pisaba la fila anterior en vez de crear una
    // nueva, y esa fila vieja (que tenía que quedar disponible para
    // "Histórico") desaparecía sin dejar rastro.
    const filaFrecuencia = _leerCrudo("GestionTareasSucursal").find(function (f) {
        return String(f.tareaId) === String(tareaId) && String(f.sucursal).trim() === sucursal;
    });
    const ciclo = _cicloActual(filaFrecuencia && filaFrecuencia.frecuencia === "mensual" ? "mensual" : "semanal");

    const filas = _leerCrudo("GestionChecks");
    const existente = filas.find(function (f) {
        return String(f.tareaId) === String(tareaId) && String(f.sucursal).trim() === sucursal && String(f.dia) === String(dia) && String(f.ciclo) === String(ciclo);
    });

    if (existente && String(existente.cerrada).toUpperCase() === "SI") {
        return { ok: false, error: "Esta tarea ya está cerrada. Pedile a un Admin que la reabra si hace falta corregir algo." };
    }

    const ahora = new Date();
    const hora = Utilities.formatDate(ahora, Session.getScriptTimeZone(), "HH:mm");
    const nombreUsuario = usuarioActual.nombre || usuarioActual.email;

    const mandaSubitems = subitemsMarcados !== undefined && subitemsMarcados !== null;
    const listaSubitems = mandaSubitems ? String(subitemsMarcados) : "";

    // Nada que conservar (ni completa ni ningún sub-ítem tildado) —
    // borra la fila, mismo criterio de siempre. Con sub-ítems a
    // medias (mandaSubitems=true pero listaSubitems=""), TAMBIÉN se
    // borra: es "destildé todo", equivalente a nunca haber tildado
    // nada.
    if (!hecho && !listaSubitems) {
        if (existente) return _eliminarCrudo("GestionChecks", existente.id);
        return { ok: true };
    }

    const datos = { hecho: hecho ? "SI" : "NO", marcadoPor: nombreUsuario, hora: hora, fechaModificacion: ahora.toISOString(), ciclo: ciclo };

    if (mandaSubitems) {
        datos.subitemsMarcados = listaSubitems;
        // Firma por sub-ítem: un índice YA marcado antes conserva su
        // firma original (no se la "roba" quien guarda después) — solo
        // los índices NUEVOS en este guardado se firman con quien
        // guarda ahora. Pedido explícito: "cada uno marca lo que le
        // corresponde".
        const indicesAntes = new Set(_indicesDeSubitems(existente && existente.subitemsMarcados));
        const firmasAntes = _firmasComoMapa(existente && existente.subitemsFirmas);
        const horaCompacta = hora.replace(":", "");
        datos.subitemsFirmas = _indicesDeSubitems(listaSubitems).map(function (indice) {
            const previa = firmasAntes[indice];
            if (indicesAntes.has(indice) && previa) {
                return indice + ":" + previa.nombre + ":" + previa.horaCompacta;
            }
            return indice + ":" + nombreUsuario + ":" + horaCompacta;
        }).join(",");
    }

    // Candado — se cierra cuando ESTE guardado deja la tarea completa
    // (mismo booleano "hecho" que ya decide el cliente); server-side
    // solo estampa quién/cuándo, igual que con marcadoPor.
    if (hecho) {
        datos.cerrada = "SI";
        datos.cerradaPor = nombreUsuario;
        datos.cerradaHora = hora;
    }

    if (existente) return _actualizarCrudo("GestionChecks", existente.id, datos);
    return _escribirCrudo("GestionChecks", Object.assign({ tareaId: tareaId, sucursal: sucursal, dia: dia }, datos));
}

/** Reabre una tarea cerrada — pedido explícito 2026-08-31: sin esto, un
 *  cierre por error (tocar Guardar antes de tiempo) queda trabado para
 *  siempre, sin ninguna vía de excepción. SOLO Admin (no Supervisor, no
 *  Responsable de local) — mismo gate que ya usa esAdminActual() del
 *  lado del cliente. No toca los datos ya guardados (hecho,
 *  subitemsMarcados, firmas): solo destraba para poder seguir editando. */
function reabrirTareaGestion(tareaId, dia, sucursal, usuarioActual) {
    if (usuarioActual.rol !== "admin") {
        return { ok: false, error: "Solo Admin puede reabrir una tarea cerrada." };
    }
    const suc = String(sucursal || "").trim();
    if (!suc || !tareaId || !dia) return { ok: false, error: "Falta la tarea, el día o el local." };

    // Mismo criterio que actualizarCheckGestion: la fila a destrabar es
    // la del CICLO ACTUAL — sin esto, con más de una fila guardada para
    // el mismo tareaId+sucursal+dia (una por ciclo, ver Histórico),
    // .find() podía agarrar una fila vieja en vez de la que está cerrada
    // ahora mismo en pantalla.
    const filaFrecuencia = _leerCrudo("GestionTareasSucursal").find(function (f) {
        return String(f.tareaId) === String(tareaId) && String(f.sucursal).trim() === suc;
    });
    const ciclo = _cicloActual(filaFrecuencia && filaFrecuencia.frecuencia === "mensual" ? "mensual" : "semanal");

    const existente = _leerCrudo("GestionChecks").find(function (f) {
        return String(f.tareaId) === String(tareaId) && String(f.sucursal).trim() === suc && String(f.dia) === String(dia) && String(f.ciclo) === String(ciclo);
    });
    if (!existente) return { ok: false, error: "No se encontró esa tarea guardada." };
    return _actualizarCrudo("GestionChecks", existente.id, { cerrada: "NO" });
}

/** Ciclos YA CERRADOS de Gestión de tareas ("Histórico") — el reset
 *  automático de ciclo (ver _cicloActual) hace que lo tildado de un
 *  ciclo pasado deje de verse en "Tareas asignadas", pero no se pierde:
 *  queda acá. Accesible por el Responsable de local de esa sucursal (el
 *  server usa la suya, como siempre) O por Admin/Supervisor mirando
 *  CUALQUIER sucursal (la pasan explícita — mismo patrón que ya usa
 *  getChecksPorSucursal en lectura, no es información sensible) —
 *  decisión explícita del usuario (2026-08-31) de ampliarlo ya en vez
 *  de dejarlo solo para Responsable de local. Responsable de turno NO
 *  tiene acceso. Devuelve el ARRAY de filas directo (o {ok:false,error}
 *  si no hay permiso) — mismo criterio que leer(), nunca envolver en
 *  {data:...} (ver el comentario de sync() sobre ese bug real). */
function obtenerHistoricoGestion(sucursalPedida, usuarioActual) {
    let sucursal;
    if (usuarioActual.encargado) {
        sucursal = String(usuarioActual.sucursal || "").trim();
    } else if (_esGestion(usuarioActual)) {
        sucursal = String(sucursalPedida || "").trim();
    } else {
        return { ok: false, error: "No tenés permiso para ver el histórico de Gestión." };
    }
    if (!sucursal) return { ok: false, error: "Falta el local." };

    const filas = _leerCrudo("GestionChecks").filter(function (f) {
        return String(f.sucursal || "").trim() === sucursal;
    });
    const frecuencias = {};
    _leerCrudo("GestionTareasSucursal").filter(function (f) {
        return String(f.sucursal || "").trim() === sucursal;
    }).forEach(function (f) { frecuencias[f.tareaId] = f.frecuencia; });

    const cicloSemanalActual = _cicloActual("semanal");
    const cicloMensualActual = _cicloActual("mensual");

    return filas.filter(function (f) {
        const cicloActualDeEsta = frecuencias[f.tareaId] === "mensual" ? cicloMensualActual : cicloSemanalActual;
        return f.ciclo && f.ciclo !== cicloActualDeEsta;
    });
}

/** Borra TODAS las filas de UN ciclo cerrado, de la sucursal del
 *  Responsable que lo pide — a diferencia de la lectura de arriba,
 *  borrar es una acción de escritura: solo el Responsable de local de
 *  ESE local (no Admin/Supervisor mirando un local ajeno). */
function eliminarHistoricoGestion(ciclo, usuarioActual) {
    if (!usuarioActual.encargado) {
        return { ok: false, error: "Solo el Responsable de local puede borrar del histórico." };
    }
    const sucursal = String(usuarioActual.sucursal || "").trim();
    if (!sucursal || !ciclo) return { ok: false, error: "Falta el ciclo o el local." };

    const filas = _leerCrudo("GestionChecks").filter(function (f) {
        return String(f.sucursal || "").trim() === sucursal && String(f.ciclo) === String(ciclo);
    });
    filas.forEach(function (f) { _eliminarCrudo("GestionChecks", f.id); });
    return { ok: true, borradas: filas.length };
}

function enviarPushPrueba(usuarioActual) {
    if (!usuarioActual || !usuarioActual.id) {
        return { ok: false, error: "Usuario no identificado." };
    }

    const projectId = _propFCM("FCM_PROJECT_ID");
    const accessToken = _obtenerAccessTokenFCM();

    const tokens = _leerCrudo("Tokens").filter((t) => String(t.usuarioId) === String(usuarioActual.id));

    if (!tokens.length) {
        return { ok: false, error: "No tienes tokens de push registrados. Activa las notificaciones en tu perfil." };
    }

    let enviados = 0;
    const fallidos = [];
    tokens.forEach((t) => {
        const resultado = _enviarUnPush(
            t.token,
            "¡Funcionan! 🎉",
            "Recibiste un mensaje de prueba desde tu perfil.",
            null,
            accessToken,
            projectId
        );
        if (resultado.ok) {
            enviados++;
        } else {
            fallidos.push(t.token);
            if (resultado.invalido) _eliminarCrudo("Tokens", t.id);
        }
    });

    return { ok: enviados > 0, enviados, fallidos: fallidos.length };
}

/**
 * Aviso automático de vencimiento próximo — pensada para correr sola
 * una vez por día vía trigger programado (ver instalarTriggerVencimientos
 * más abajo, se activa una sola vez desde el editor). No la llama el
 * cliente por HTTP como al resto de los "enviarPush*" — por eso no
 * pasa por _despachar ni pide usuarioActual/_esGestion: la dispara el
 * propio Apps Script, no una persona.
 *
 * Mismo umbral que ya usa el badge "Vence en N día(s)" en Colaboradores
 * (DIAS_AVISO_VENCIMIENTO = 7, ver pages/colaboradores.js). Se manda
 * el push el día EXACTO en que quedan 7 (no "7 o menos"): así no se
 * repite el mismo aviso toda la semana previa al vencimiento.
 *
 * Solo colaboradores — supervisor/admin no tienen vencimiento (ver
 * _usuarioDeSesion). Entrar a la app alcanza para renovar: el aviso
 * no hace nada más que empujar a esa acción antes de que sea tarde.
 */
function avisarVencimientosProximos() {
    const DIAS_AVISO = 7;
    const limite = _sumarDiasISO(_fechaHoyISO(), DIAS_AVISO);

    const usuarios = _leerCrudo("Usuarios").filter((u) =>
        String(u.rol || "").trim().toLowerCase() === "colaborador" &&
        String(u.activo || "").trim().toUpperCase() === "SI" &&
        String(u.fechaVencimientoAcceso || "").trim() === limite
    );
    if (!usuarios.length) return;

    const projectId = _propFCM("FCM_PROJECT_ID");
    const accessToken = _obtenerAccessTokenFCM();
    const tokens = _leerCrudo("Tokens");

    usuarios.forEach((u) => {
        tokens
            .filter((t) => String(t.usuarioId) === String(u.id))
            .forEach((t) => {
                const resultado = _enviarUnPush(
                    t.token,
                    "Tu acceso vence pronto",
                    "Entrá a la app en los próximos días para que no se te desactive el acceso.",
                    "#/inicio",
                    accessToken,
                    projectId
                );
                if (!resultado.ok && resultado.invalido) _eliminarCrudo("Tokens", t.id);
            });
    });
}

/**
 * Instalador — correr UNA SOLA VEZ desde el editor: elegir esta
 * función en el desplegable de arriba (al lado de "Ejecutar") y
 * tocar Ejecutar. Deja programado avisarVencimientosProximos() para
 * correr sola todos los días a las 9am. Se puede volver a correr sin
 * miedo a duplicar el aviso: primero borra cualquier trigger viejo de
 * la misma función antes de crear el nuevo.
 */
function instalarTriggerVencimientos() {
    ScriptApp.getProjectTriggers()
        .filter((t) => t.getHandlerFunction() === "avisarVencimientosProximos")
        .forEach((t) => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger("avisarVencimientosProximos")
        .timeBased()
        .everyDays(1)
        .atHour(9)
        .create();

    Logger.log("Listo — avisarVencimientosProximos va a correr todos los días a las 9am.");
}

/* ============================================================
   SINCRONIZACIÓN — foto completa de cada hoja

   ANTES devolvía solo las filas con fechaModificacion > lastSync
   ("delta"), y el cliente las mergeaba encima de su copia local. Eso
   tenía dos agujeros graves, los dos reportados en producción:

     · BORRAR nunca se propagaba. Una fila borrada simplemente deja de
       existir en la hoja — no hay ninguna "lápida" con fecha nueva que
       avise, así que la copia local del resto de los dispositivos
       sobrevivía para siempre ("lo borré y sigue apareciendo").
     · EDITAR A MANO en el Sheet tampoco se propagaba: escribir una
       celda a mano no toca fechaModificacion, así que esa edición
       quedaba invisible para todos los dispositivos, para siempre.

   Ahora devuelve la hoja ENTERA y el cliente reemplaza su copia (ver
   mergeDelta en services/syncManager.js). Con estos volúmenes
   (decenas/cientos de filas) el costo es despreciable, y la hoja
   vuelve a ser la única fuente de verdad. lastSyncTime se sigue
   recibiendo por compatibilidad, pero ya no filtra nada.
============================================================ */

function sync(lastSyncTime, usuarioActual) {
    try {
        const timestamp = Date.now();
        const data = {};

        // Hojas que se sincronizan
        const hojas = ['Usuarios', 'Cursos', 'Lecciones', 'Noticias', 'Comunicaciones', 'Asignaciones', 'Resultados', 'Manuales'];

        for (const hoja of hojas) {
            try {
                // leer() devuelve el ARRAY de filas (o {ok:false,error} si
                // no hay permiso), nunca un objeto con .data. Con el
                // ".data" que había acá el resultado era siempre
                // undefined → [], así que el sync mandaba las 8 hojas
                // vacías y mergeDelta, que limpia cada store antes de
                // guardar, dejaba IndexedDB en cero en cada corrida.
                // La app seguía andando porque fetchSheet, al no
                // encontrar nada local, cae a la red — o sea que la
                // caché local nunca sirvió para nada y cada pantalla
                // pegaba contra Apps Script.
                const filas = leer(hoja, usuarioActual);
                data[hoja.toLowerCase()] = Array.isArray(filas) ? filas : [];
            } catch (err) {
                console.log(`Sync: error reading ${hoja}:`, err.message);
                data[hoja.toLowerCase()] = [];
            }
        }

        return {
            ok: true,
            timestamp: timestamp,
            data: data
        };
    } catch (err) {
        return {
            ok: false,
            error: 'Sync failed: ' + err.message
        };
    }
}

/* ============================================================
   NOTIFICACIONES PROGRAMADAS — Trigger time-driven diario
   Se ejecuta cada día a las 00:05 UTC para procesar noticias
   programadas cuya fecha/hora ya llegó.
============================================================ */

function procesarNoticiasProgamadas() {
    try {
        const ahora = new Date();
        const hoyISO = ahora.toISOString().split('T')[0]; // YYYY-MM-DD
        const horaActual = ("0" + ahora.getHours()).slice(-2) + ":" + ("0" + ahora.getMinutes()).slice(-2); // HH:MM

        const noticias = _leerCrudo("Noticias");
        // Mismo bug que _responsablesDeSucursal (2026-08-31, reportado
        // en vivo): "borrar" un usuario acá en realidad lo desactiva
        // (activo="NO"), la fila sigue existiendo — sin este filtro,
        // alguien desactivado seguía recibiendo Noticias programadas.
        const usuarios = _leerCrudo("Usuarios").filter((u) => String(u.activo).toUpperCase() !== "NO");
        const sucursales = _leerCrudo("Sucursales");

        let procesadas = 0;
        let errores = [];

        noticias.forEach((noticia) => {
            // Solo procesar noticias que tengan fecha = HOY y hora <= AHORA
            const fecha = String(noticia.fecha || "").trim();
            const hora = String(noticia.hora || "").trim();

            if (fecha !== hoyISO || !hora) return; // No es para enviar hoy
            if (hora > horaActual) return; // Aún no llegó la hora

            try {
                // Determinar destinatarios según dirigidoA
                const dirigidoA = String(noticia.dirigidoA || "").trim();
                let destinatarios = [];

                if (dirigidoA === "usuarios-especificos") {
                    // Usuarios específicos (Admin only)
                    const idsStr = String(noticia.usuariosEspecificos || "").trim();
                    if (idsStr) {
                        const ids = idsStr.split(",").map(id => String(id).trim()).filter(Boolean);
                        destinatarios = usuarios.filter(u => ids.includes(String(u.id))).map(u => u.id);
                    }
                } else if (dirigidoA === "colaboradores-local") {
                    // Colaboradores de locales específicos
                    const localesStr = String(noticia.sucursal || "").trim();
                    if (localesStr) {
                        const locales = localesStr.split(",").map(s => s.trim()).filter(Boolean);
                        destinatarios = usuarios.filter(u => locales.includes(u.sucursal) && u.rol === "colaborador").map(u => u.id);
                    }
                } else if (dirigidoA === "encargados-propios" || dirigidoA === "encargados-franquicias") {
                    // Encargados según si local es propio o franquicia
                    const esPropio = dirigidoA === "encargados-propios";
                    destinatarios = usuarios.filter(u => {
                        if (!u.encargado) return false;
                        const sucursal = sucursales.find(s => s.nombre === u.sucursal);
                        const esLocalPropio = sucursal && sucursal.esPropio;
                        return esPropio ? esLocalPropio : !esLocalPropio;
                    }).map(u => u.id);
                } else if (!dirigidoA) {
                    // Todos los colaboradores (por defecto)
                    destinatarios = usuarios.filter(u => u.rol === "colaborador").map(u => u.id);
                }

                // Supervisores siempre reciben copia
                const supervisores = usuarios.filter(u => u.rol === "supervisor" || u.rol === "admin").map(u => u.id);
                destinatarios = [...new Set([...destinatarios, ...supervisores])];

                if (destinatarios.length > 0) {
                    // Enviar push
                    const resultado = enviarPush(destinatarios, noticia.titulo, noticia.resumen, "#/news", { rol: "admin" });
                    if (resultado.ok) {
                        procesadas++;
                        Logger.log("[NOTICIAS PROGRAMADAS] Enviada: " + noticia.titulo + " a " + destinatarios.length + " usuarios");
                    } else {
                        errores.push(noticia.titulo + ": " + resultado.error);
                    }
                }
            } catch (err) {
                errores.push(noticia.titulo + ": " + err.message);
            }
        });

        // Registrar en Auditoria
        const admin = usuarios.find(u => u.rol === "admin");
        if (admin) {
            _escribirCrudo("Auditoria", {
                usuarioId: admin.id,
                accion: "procesar_noticias_programadas",
                detalles: "Procesadas " + procesadas + " noticias programadas. Errores: " + errores.length,
                timestamp: Date.now()
            });
        }

        Logger.log("[NOTICIAS PROGRAMADAS] Completado: " + procesadas + " procesadas, " + errores.length + " errores");
        return { ok: true, procesadas, errores };
    } catch (err) {
        Logger.error("[NOTICIAS PROGRAMADAS] Error: " + err.message);
        return { ok: false, error: err.message };
    }
}

/* ============================================================
   SUBIDA DE ARCHIVOS A DRIVE
   Guarda el archivo en Recursos/Tipo/Año/Mes y devuelve el link
   público, para adjuntarlo a una News o Comunicación sin tener
   que subirlo a mano a Drive y copiar la URL.
============================================================ */

/** Devuelve la subcarpeta con ese nombre dentro de `padre`, creándola
 *  si no existe. Drive permite varias carpetas con el mismo nombre en
 *  el mismo lugar, así que si ya hay una se reusa la primera en vez de
 *  crear duplicados en cada subida. */
function _obtenerOCrearFolder(nombre, padre) {
    const existentes = padre.getFoldersByName(nombre);
    return existentes.hasNext() ? existentes.next() : padre.createFolder(nombre);
}

function subirArchivo(nombreArchivo, extension, archivoBase64) {
    try {
        if (!nombreArchivo || !extension || !archivoBase64) {
            return { ok: false, error: "Parámetros faltantes" };
        }

        // Estructura de carpetas: Recursos/Tipo/YYYY/Mes/
        const hoy = new Date();
        const year = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, "0");
        const nomMes = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][hoy.getMonth()];

        // Prefijo fecha+hora al nombre real del archivo — así con muchos
        // archivos subidos (celulares suelen nombrarlos "IMG_0392.jpg")
        // quedan ordenados cronológicamente y son rastreables sin abrir
        // uno por uno. A propósito SIN el nombre de quién lo subió: el
        // archivo queda con link público (cualquiera que lo reciba puede
        // verlo), y exponer ahí el nombre de la persona sería filtrar su
        // identidad a quien sea que termine con el link. Quién lo subió
        // ya queda registrado aparte, en el campo autorNombre de la
        // News/Comunicación — no hace falta repetirlo acá.
        const marcaTiempo = Utilities.formatDate(hoy, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd_HH-mm");
        nombreArchivo = marcaTiempo + "_" + nombreArchivo;

        // Determinar tipo de carpeta según extensión
        let tipo = "Archivos";
        if (["pdf"].includes(extension.toLowerCase())) tipo = "PDFs";
        else if (["xlsx", "xls", "csv"].includes(extension.toLowerCase())) tipo = "Excel";
        else if (["doc", "docx", "txt"].includes(extension.toLowerCase())) tipo = "Documentos";
        else if (["jpg", "jpeg", "png", "gif"].includes(extension.toLowerCase())) tipo = "Imagenes";
        else if (["mp4", "webm", "mov", "avi"].includes(extension.toLowerCase())) tipo = "Videos";
        else if (["ppt", "pptx"].includes(extension.toLowerCase())) tipo = "Presentaciones";

        // Crear estructura de carpetas. Nombre distintivo (no solo
        // "Recursos") a propósito: mientras Drive siga siendo la cuenta
        // personal compartida con archivos ajenos al proyecto, así se
        // identifica de un vistazo sin abrir la carpeta. Cuando se migre
        // a la cuenta dedicada, se puede volver a "Recursos" a secas.
        const carpetaRecursos = _obtenerOCrearFolder("Lucciano's Academy — Recursos", DriveApp.getRootFolder());
        const carpetaTipo = _obtenerOCrearFolder(tipo, carpetaRecursos);
        const carpetaYear = _obtenerOCrearFolder(String(year), carpetaTipo);
        const carpetaMes = _obtenerOCrearFolder(nomMes, carpetaYear);

        // Decodificar y guardar archivo
        const buffer = Utilities.base64Decode(archivoBase64.split(",")[1] || archivoBase64);
        const mimeType = _getMimeType(extension) || "application/octet-stream";
        const blob = Utilities.newBlob(buffer, mimeType, nombreArchivo);

        const archivo = carpetaMes.createFile(blob);
        archivo.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);

        return {
            ok: true,
            url: archivo.getUrl(),
            archivoId: archivo.getId(),
            nombre: nombreArchivo
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/** Foto de perfil — carpeta propia por usuario (Colaboradores/{id}/),
 *  no el balde genérico Recursos/Imagenes/Año/Mes que usa subirArchivo:
 *  acá interesa PISAR la foto anterior (si no, cada cambio de foto
 *  deja basura acumulada en Drive para siempre) y tener un lugar fijo
 *  y predecible por persona. usuarioActual sale del token de sesión,
 *  no de un id que mande el cliente — así nadie puede pisar la foto de
 *  otro pasando otro id a mano. La URL que se guarda es la de
 *  thumbnail (no archivo.getUrl(), que abre el visor de Drive) —
 *  esa sí sirve directo como src de una <img>. */
/**
 * La carpeta de cada colaborador en Drive, por NOMBRE.
 *
 * Antes se llamaba con el id (un Date.now() de 13 dígitos), así que
 * abrir Drive era una lista de números sin manera de saber de quién es
 * cada carpeta. Pedido del usuario: "las carpetas caen sobre id, nunca
 * voy a saber quiénes son; debe decir nombre de usuario, si no será un
 * desmadre cuando haya mucha información".
 *
 * Migra sola: si ya existe la carpeta vieja con el id, la renombra en
 * vez de crear una nueva — así las fotos ya subidas no quedan
 * huérfanas en una carpeta que nadie vuelve a mirar.
 *
 * El nombre lleva el id entre paréntesis al final para que dos personas
 * que se llamen igual no compartan carpeta (y con ella, la foto: el
 * archivo se llama "perfil_*" en las dos).
 */
function _carpetaDeColaborador(padre, usuarioActual) {
    const nombre = String(usuarioActual.nombre || "").trim() || "Sin nombre";
    const id = String(usuarioActual.id);
    const deseado = nombre + " (" + id + ")";

    const yaEsta = padre.getFoldersByName(deseado);
    if (yaEsta.hasNext()) return yaEsta.next();

    // Carpeta vieja, nombrada solo con el id: se renombra.
    const vieja = padre.getFoldersByName(id);
    if (vieja.hasNext()) {
        const c = vieja.next();
        c.setName(deseado);
        return c;
    }

    // Carpeta nombrada solo con el nombre (por si quedó alguna así).
    const soloNombre = padre.getFoldersByName(nombre);
    if (soloNombre.hasNext()) {
        const c = soloNombre.next();
        c.setName(deseado);
        return c;
    }

    return padre.createFolder(deseado);
}

function subirFotoPerfil(usuarioActual, extension, archivoBase64) {
    try {
        if (!usuarioActual || !extension || !archivoBase64) {
            return { ok: false, error: "Parámetros faltantes" };
        }

        const carpetaRecursos = _obtenerOCrearFolder("Lucciano's Academy — Recursos", DriveApp.getRootFolder());
        const carpetaColaboradores = _obtenerOCrearFolder("Colaboradores", carpetaRecursos);
        const carpetaUsuario = _carpetaDeColaborador(carpetaColaboradores, usuarioActual);

        // Cualquier "perfil*" anterior en esa carpeta se manda a la
        // papelera antes de subir la nueva — sin esto, re-subir la foto
        // varias veces deja copias viejas dando vueltas.
        const iter = carpetaUsuario.getFiles();
        while (iter.hasNext()) {
            const f = iter.next();
            if (f.getName().indexOf("perfil") === 0) f.setTrashed(true);
        }

        // Nombre con la persona (pedido explícito del usuario, para
        // identificar de quién es sin tener que abrir cada archivo) —
        // esto es distinto del criterio de subirArchivo (que a propósito
        // NO incluye el nombre): ahí el archivo tiene link público que
        // puede circular fuera de la app; acá la carpeta ya está
        // organizada por id de colaborador y es la propia foto de esa
        // persona, no hay nada nuevo que "filtrar".
        const nombreLimpio = String(usuarioActual.nombre || "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca acentos
            .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const buffer = Utilities.base64Decode(archivoBase64.split(",")[1] || archivoBase64);
        const mimeType = _getMimeType(extension) || "image/jpeg";
        const blob = Utilities.newBlob(buffer, mimeType, "perfil_" + nombreLimpio + "." + extension);
        const archivo = carpetaUsuario.createFile(blob);
        archivo.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);

        return {
            ok: true,
            url: "https://drive.google.com/thumbnail?id=" + archivo.getId() + "&sz=w640",
            archivoId: archivo.getId()
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

function _getMimeType(extension) {
    const tipos = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        csv: "text/csv",
        txt: "text/plain",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
        zip: "application/zip"
    };
    return tipos[extension.toLowerCase()] || null;
}
