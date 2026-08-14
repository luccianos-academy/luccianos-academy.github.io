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
const BACKEND_VERSION = "1.6.0";

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
                sheet.getRange(i + 1, col + 1).setValue(_sanitizarCelda(cambios[key]));
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
        const usuarios = _leerCrudo("Usuarios");
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
