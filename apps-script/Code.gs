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
};

// Hojas cuya lectura queda restringida (el resto la lee cualquier
// autenticado). Auditoria: solo gestión. Asignaciones/Resultados: un
// colaborador solo ve sus propias filas (filtrado en leer()).
const LECTURA_SOLO_GESTION = ["Auditoria"];

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
        case "subirArchivo": return subirArchivo(body.nombreArchivo, body.extension, body.archivoBase64);
        case "sync":       return sync(body.lastSync, usuarioActual);

        default:           return { ok: false, error: "Acción desconocida: " + body.accion };
    }
}

/** Útil para probar el deploy a mano desde el navegador (GET). No
 *  expone ningún dato — solo confirma que el backend está vivo. */
function doGet() {
    return ContentService
        .createTextOutput(JSON.stringify({ ok: true, mensaje: "Lucciano's Academy backend activo" }))
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

function _escribirCrudo(hoja, fila) {
    const sheet = _sheet(hoja);
    const headers = sheet.getDataRange().getValues()[0];
    const nuevoId = _proximoId(sheet);
    const filaCompleta = Object.assign({ id: nuevoId }, fila);

    const valores = headers.map((h) => (filaCompleta[h] !== undefined ? _sanitizarCelda(filaCompleta[h]) : ""));
    sheet.appendRow(valores);
    return { ok: true, id: nuevoId };
}

function _actualizarCrudo(hoja, id, cambios) {
    const sheet = _sheet(hoja);
    const datos = sheet.getDataRange().getValues();
    const headers = datos[0];
    const colId = headers.indexOf("id");

    for (let i = 1; i < datos.length; i++) {
        if (String(datos[i][colId]) === String(id)) {
            Object.keys(cambios).forEach((key) => {
                const col = headers.indexOf(key);
                if (col === -1) return;
                sheet.getRange(i + 1, col + 1).setValue(_sanitizarCelda(cambios[key]));
            });
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
    return filas;
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

function actualizar(hoja, id, cambios, usuarioActual) {
    const permiso = _autorizarEscritura(hoja, "actualizar", usuarioActual);
    if (!permiso.ok) return permiso;

    cambios = Object.assign({}, cambios);

    // Allow-list de campos en Usuarios: un supervisor puede editar
    // datos de su gente, pero NUNCA el rol ni el flag capacitador (si
    // no, se auto-promovería a admin mandando {rol:"admin"}). Solo el
    // admin puede tocar esos dos campos.
    if (hoja === "Usuarios" && usuarioActual.rol !== "admin") {
        delete cambios.rol;
        delete cambios.capacitador;
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
    return _eliminarCrudo(hoja, id);
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

    // Acceso con vencimiento (colaboradores dados de alta por un
    // Supervisor): si ya pasó la fecha, se desactiva acá mismo — no hay
    // proceso en segundo plano en esta arquitectura.
    const vencimiento = String(fila.fechaVencimientoAcceso || "").trim();
    if (activo === "SI" && vencimiento && vencimiento < _fechaHoyISO()) {
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
        capacitador: String(fila.capacitador || "").trim().toUpperCase() === "SI",
        sucursal: String(fila.sucursal || "").trim(),
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

    return { ok: true, usuario: usuario, sessionToken: _emitirToken(email) };
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

/**
 * Aviso por mail del vencimiento de la beta a todos los Colaboradores
 * (incluye Encargados; NO Supervisores/Admins).
 *
 * A propósito NO está conectada a doPost — no se puede disparar desde
 * el cliente ni por accidente. Se corre una sola vez a mano desde el
 * editor de Apps Script: elegí "enviarAvisoBetaColaboradores" en el
 * desplegable de funciones y tocá "Ejecutar".
 */
function enviarAvisoBetaColaboradores() {
    const URL_APP = "https://luccianos-academy.netlify.app";
    const usuarios = _filasComoObjetos(_sheet("Usuarios"));
    const colaboradores = usuarios.filter((f) => String(f.rol || "").trim().toLowerCase() === "colaborador" && REGEX_EMAIL.test(String(f.email || "").trim()));

    const asunto = "Tu acceso a la beta de Lucciano's Academy vence el 31/7";
    let enviados = 0;

    colaboradores.forEach((c) => {
        const nombre = String(c.nombre || "").trim().split(" ")[0] || "";
        const cuerpo =
            "Hola " + nombre + ",\n\n" +
            "Estás participando de la primera etapa (beta) de Lucciano's Academy, la nueva plataforma de capacitación de Lucciano's.\n\n" +
            "Tu acceso está disponible hasta el 31/7 a las 23:59. Te recomendamos completar tus cursos asignados antes de esa fecha.\n\n" +
            "Podés ingresar acá: " + URL_APP + "\n\n" +
            "Gracias por ser parte de la prueba.\n" +
            "Equipo Lucciano's";

        if (_enviarUnMail(c.email, asunto, cuerpo)) enviados++;
    });

    return "Enviados: " + enviados + " de " + colaboradores.length;
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
function enviarPush(usuarioIds, titulo, cuerpo, url, usuarioActual) {
    if (!_esGestion(usuarioActual)) {
        return { ok: false, error: "Solo Admin o Supervisor pueden mandar notificaciones push." };
    }
    if (!titulo || !(usuarioIds || []).length) {
        return { ok: false, error: "Falta título o destinatarios." };
    }

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

/* ============================================================
   SINCRONIZACIÓN — delta desde último sync
   Retorna SOLO los registros que cambiaron desde lastSync
============================================================ */

function sync(lastSyncTime, usuarioActual) {
    try {
        const timestamp = Date.now();
        const data = {};

        // Hojas que se sincronizan
        const hojas = ['Usuarios', 'Cursos', 'Lecciones', 'Noticias', 'Comunicaciones', 'Asignaciones', 'Resultados', 'Manuales'];

        for (const hoja of hojas) {
            try {
                const registros = leer(hoja, usuarioActual).data || [];
                
                // Filtrar solo los que cambiaron desde lastSync
                // (requiere que cada fila tenga fechaModificacion)
                data[hoja.toLowerCase()] = registros.filter(r => {
                    const modificacion = r.fechaModificacion ? parseInt(r.fechaModificacion) : 0;
                    return modificacion > lastSyncTime || !lastSyncTime;
                });
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

        // Determinar tipo de carpeta según extensión
        let tipo = "Archivos";
        if (["pdf"].includes(extension.toLowerCase())) tipo = "PDFs";
        else if (["xlsx", "xls", "csv"].includes(extension.toLowerCase())) tipo = "Excel";
        else if (["doc", "docx", "txt"].includes(extension.toLowerCase())) tipo = "Documentos";
        else if (["jpg", "jpeg", "png", "gif"].includes(extension.toLowerCase())) tipo = "Imagenes";
        else if (["mp4", "webm", "mov", "avi"].includes(extension.toLowerCase())) tipo = "Videos";
        else if (["ppt", "pptx"].includes(extension.toLowerCase())) tipo = "Presentaciones";

        // Crear estructura de carpetas
        const carpetaRecursos = _obtenerOCrearFolder("Recursos", DriveApp.getRootFolder());
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
