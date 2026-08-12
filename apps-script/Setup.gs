/**
 * Setup.gs — Utilidades de inicialización para sincronización
 * 
 * Ejecutar una sola vez: Run > setupSyncColumns()
 * Agrega columna 'fechaModificacion' a todas las hojas de datos
 */

/**
 * setupUltimoIngreso() — agrega la columna 'ultimoIngreso' a Usuarios.
 *
 * La escribe el backend en cada login (ver _registrarIngreso en
 * Code.gs). Sin esta columna, la renovación automática por uso no
 * funciona y la pantalla de "cuentas dormidas" queda vacía.
 *
 * Ejecutar una sola vez. Es idempotente: si ya existe, no hace nada.
 * Las filas existentes quedan vacías — la app las trata como "nunca
 * ingresó", que es lo honesto: no sabemos cuándo entraron por última
 * vez antes de empezar a registrarlo.
 */
function setupUltimoIngreso() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!hoja) {
    console.log('No existe la hoja Usuarios.');
    return;
  }

  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const indice = headers.findIndex(h => String(h).trim().toLowerCase() === 'ultimoingreso');

  if (indice !== -1) {
    if (headers[indice] === 'ultimoIngreso') {
      console.log('✓ La columna ultimoIngreso ya existe.');
    } else {
      hoja.getRange(1, indice + 1).setValue('ultimoIngreso');
      console.log(`✓ Encabezado corregido ("${headers[indice]}" → "ultimoIngreso").`);
    }
    return;
  }

  hoja.getRange(1, hoja.getLastColumn() + 1).setValue('ultimoIngreso');
  console.log('✓ Columna ultimoIngreso agregada. Se completa sola en el próximo login de cada persona.');
}

/**
 * setupAplicaA() — agrega la columna "aplicaA" a Cursos y Lecciones.
 *
 * Es lo que habilita el alcance de contenido por país y local
 * (js/services/alcance.js). Sin la columna, el código no rompe: lee ""
 * y todo le aplica a todos, que es el comportamiento de siempre.
 *
 * VACÍO = le aplica a TODOS. Es la semántica correcta para contenido
 * —lo normal es que un curso valga para toda la red y la excepción se
 * declare— y la misma de Noticias.dirigidoA. Es la OPUESTA a
 * Manuales.visiblePara, que es un permiso y falla cerrado.
 *
 * Se puede correr las veces que haga falta: si la columna ya está, no
 * la toca.
 */
function setupAplicaA() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    ['Cursos', 'Lecciones'].forEach(function (nombreHoja) {
        var hoja = ss.getSheetByName(nombreHoja);
        if (!hoja) { console.log('Hoja no encontrada: ' + nombreHoja); return; }

        // Igual que en setupSyncColumns: el backend busca la columna con
        // indexOf(), que distingue mayúsculas. Un encabezado "AplicaA"
        // parece bien en la planilla pero para el código no existe.
        var headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
        var i = headers.findIndex(function (h) { return String(h).trim().toLowerCase() === 'aplicaa'; });

        if (i !== -1) {
            if (headers[i] === 'aplicaA') {
                console.log('✓ ' + nombreHoja + ': "aplicaA" ya existe');
            } else {
                hoja.getRange(1, i + 1).setValue('aplicaA');
                console.log('✓ ' + nombreHoja + ': encabezado corregido de "' + headers[i] + '" a "aplicaA"');
            }
            return;
        }

        hoja.getRange(1, hoja.getLastColumn() + 1).setValue('aplicaA');
        console.log('✓ ' + nombreHoja + ': columna "aplicaA" creada');
    });

    console.log('');
    console.log('Listo. Se deja VACÍA a propósito: vacío = le aplica a todos.');
    console.log('Para acotar, escribir países y/o locales separados por comas:');
    console.log('   Argentina, Uruguay');
    console.log("   Lucciano's Pocitos Uruguay");
    console.log("   Uruguay, Lucciano's Agüero CABA");
}

function setupSyncColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = ['Usuarios', 'Cursos', 'Lecciones', 'Noticias', 'Comunicaciones', 'Asignaciones', 'Resultados', 'Manuales'];

  hojas.forEach(nombreHoja => {
    try {
      const hoja = ss.getSheetByName(nombreHoja);
      if (!hoja) {
        console.log(`Hoja no encontrada: ${nombreHoja}`);
        return;
      }
      
      // El backend busca la columna con headers.indexOf('fechaModificacion'),
      // que distingue mayúsculas. Un encabezado escrito "FechaModificacion"
      // parece correcto en la planilla pero para _actualizarCrudo no existe,
      // y TODAS las escrituras de esa hoja fallan. Por eso, si aparece con
      // otra capitalización, se corrige en vez de darla por buena.
      const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
      const indice = headers.findIndex(h => String(h).trim().toLowerCase() === 'fechamodificacion');

      if (indice !== -1) {
        if (headers[indice] === 'fechaModificacion') {
          console.log(`✓ ${nombreHoja}: columna fechaModificacion ya existe`);
        } else {
          hoja.getRange(1, indice + 1).setValue('fechaModificacion');
          console.log(`✓ ${nombreHoja}: encabezado corregido ("${headers[indice]}" → "fechaModificacion")`);
        }
        return;
      }

      // Agregar columna al final
      const ultimaColumna = hoja.getLastColumn() + 1;
      hoja.getRange(1, ultimaColumna).setValue('fechaModificacion');

      // Las filas existentes quedan VACÍAS a propósito. Antes se rellenaban
      // con =NOW(), que es volátil: se recalcula con cada cambio de la
      // planilla, así que el valor no significaba "cuándo se modificó esta
      // fila" sino "cuándo se miró". Con 8 hojas llenas de esa fórmula la
      // planilla recalcula todo el tiempo sin aportar nada. Vacío es
      // correcto: el backend escribe el timestamp real en la primera
      // actualización de cada fila, y el sync ya no compara por este campo
      // (baja la hoja entera y reemplaza la copia local).
      console.log(`✓ ${nombreHoja}: columna agregada en columna ${ultimaColumna}`);
    } catch (err) {
      console.error(`✗ Error en ${nombreHoja}:`, err.message);
    }
  });
  
  console.log('=== Setup completado ===');
}

/**
 * revisarAccesos() — diagnóstico, NO modifica nada.
 *
 * Foto del estado de accesos de toda la nómina, para decidir a quién
 * restaurar sin ir fila por fila en la planilla. Reporta cuatro grupos:
 *
 *   1. PERMANENTES SIN MOTIVO — colaboradores con fechaVencimientoAcceso
 *      vacía. Vacío significa "no vence nunca", que es correcto para un
 *      admin o supervisor pero no para un colaborador: son los que
 *      quedaron fuera del modelo de renovación por uso y hay que
 *      revisar uno por uno.
 *   2. ACTIVOS — entran normal, se renuevan solos al usar la app.
 *   3. SIN ACCESO — vencidos o deshabilitados. Vuelven con "Renovar".
 *   4. NUNCA INGRESARON — sin ultimoIngreso registrado.
 *
 * Ejecutar: elegir la función y darle Ejecutar. Después: Ver → Registros.
 */
function revisarAccesos() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!hoja) { console.log('No existe la hoja Usuarios.'); return; }

  const filas = _filasComoObjetos(hoja);
  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const permanentesSinMotivo = [];
  const activos = [];
  const sinAcceso = [];
  let nuncaIngresaron = 0;

  filas.forEach(function (f) {
    const rol = String(f.rol || '').trim().toLowerCase();
    if (!rol) return;
    const nombre = String(f.nombre || '(sin nombre)').trim();
    const vence = String(f.fechaVencimientoAcceso || '').trim();
    const activo = String(f.activo || '').trim().toUpperCase() !== 'NO';
    const ingreso = String(f.ultimoIngreso || '').trim();
    const etiqueta = nombre + ' — ' + String(f.sucursal || 'sin sucursal').trim();

    if (!ingreso) nuncaIngresaron++;

    // Un admin/supervisor sin vencimiento es lo esperado; un colaborador
    // sin vencimiento es el que quedó permanente de antes.
    if (rol === 'colaborador' && vence === '') {
      permanentesSinMotivo.push(etiqueta + (activo ? '' : ' (inactivo)'));
      return;
    }
    if (rol !== 'colaborador') return;

    if (activo && (vence === '' || vence >= hoy)) {
      activos.push(etiqueta + ' — vence ' + vence + (ingreso ? ' — último ingreso ' + ingreso : ' — nunca ingresó'));
    } else {
      sinAcceso.push(etiqueta + ' — venció ' + vence + (ingreso ? ' — último ingreso ' + ingreso : ' — nunca ingresó'));
    }
  });

  console.log('Hoy: ' + hoy + ' — ' + filas.length + ' filas en la hoja');
  console.log('');

  console.log('⚠️  COLABORADORES PERMANENTES (celda de vencimiento vacía): ' + permanentesSinMotivo.length);
  permanentesSinMotivo.forEach(function (x) { console.log('    ' + x); });
  if (!permanentesSinMotivo.length) console.log('    (ninguno — bien)');
  console.log('');

  console.log('✅ COLABORADORES CON ACCESO: ' + activos.length);
  activos.forEach(function (x) { console.log('    ' + x); });
  console.log('');

  console.log('🚫 COLABORADORES SIN ACCESO: ' + sinAcceso.length);
  sinAcceso.forEach(function (x) { console.log('    ' + x); });
  console.log('');

  console.log('Nunca ingresaron (sin ultimoIngreso), en toda la nómina: ' + nuncaIngresaron);
  console.log('Ojo: ultimoIngreso se registra recién desde el 2026-08-09, así que');
  console.log('"nunca ingresó" incluye a quienes sí usaron la app antes de esa fecha.');
}

/**
 * probarVisibilidadUsuarios() — diagnóstico, no modifica nada.
 *
 * Responde "¿el filtro de lectura está realmente activo?" sin tener que
 * entrar a la app ni abrir la consola del navegador. Corre la misma
 * función leer() que usa el backend, con la sesión de cada persona, y
 * muestra cuántas filas le tocan.
 *
 * OJO — esto ejecuta el código GUARDADO en el editor, que puede ser más
 * nuevo que el IMPLEMENTADO. Si acá da bien pero en la app no, lo que
 * falta es "Nueva versión" de la implementación. Para saber qué versión
 * está publicada, abrí la URL /exec en el navegador y mirá "version"
 * (BACKEND_VERSION en Code.gs).
 *
 * Ejecutar: elegir esta función y darle Ejecutar. Después: Ver → Registros.
 */
function probarVisibilidadUsuarios() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const total = _filasComoObjetos(hoja).length;
  console.log('Filas totales en la hoja Usuarios: ' + total);
  console.log('');

  const usuarios = _filasComoObjetos(hoja);
  let probados = 0;

  usuarios.forEach(function (fila) {
    const email = String(fila.email || '').trim().toLowerCase();
    if (!email) return;
    // Una muestra por tipo de usuario alcanza; recorrer los 45 llena el
    // log sin agregar información.
    const rol = String(fila.rol || '').trim().toLowerCase();
    const esEncargado = String(fila.encargado || '').trim().toUpperCase() === 'SI';
    const clave = rol + (esEncargado ? '-encargado' : '');
    probarVisibilidadUsuarios._vistos = probarVisibilidadUsuarios._vistos || {};
    if (probarVisibilidadUsuarios._vistos[clave]) return;
    probarVisibilidadUsuarios._vistos[clave] = true;

    const sesion = _usuarioDeSesion(email);
    if (!sesion) return;
    const visibles = leer('Usuarios', sesion);
    const cantidad = Array.isArray(visibles) ? visibles.length : 0;

    const esperado = (rol === 'admin' || rol === 'supervisor') ? total
      : esEncargado ? 'los de su sucursal' : 1;

    console.log('· ' + sesion.nombre + ' (' + rol + (esEncargado ? ', encargado' : '') + ')');
    console.log('    ve ' + cantidad + ' de ' + total + ' — esperado: ' + esperado);
    probados++;
  });

  probarVisibilidadUsuarios._vistos = null;
  console.log('');
  console.log('=== ' + probados + ' tipo(s) de usuario probados ===');
  console.log('Si un colaborador raso ve más de 1, el filtro NO está activo.');
}

/* ══════════════════════════════════════════════════════════════════
   LOCALES PROPIOS
   ══════════════════════════════════════════════════════════════════

   Lista pasada por el usuario el 2026-08-12. Todo lo que NO esté acá
   queda como franquicia (mismo criterio "por descarte" que ya usa la
   app: esPropio vacío = franquicia).

   Los nombres vienen cortos ("ABASTO") y en la planilla están completos
   ("Lucciano's Shopping Abasto CABA"), así que hay un matcheo tolerante
   abajo. NO se renombra nada en la hoja — pedido explícito del usuario:
   "no cambiemos nombres, matchea".

   "ABASTO 2" son dos puntos de venta dentro del mismo shopping que
   COMPARTEN NÓMINA. Van como dos sucursales igual, para que la cantidad
   coincida con el listado de locales de la empresa. Como la nómina es
   una sola, toda la gente va cargada en "Abasto" y "Abasto 2" queda sin
   colaboradores: es lo esperado, no un error. Lo que NO hay que hacer es
   repartir el equipo entre las dos, porque el encargado de una no ve a
   la gente de la otra.                                                 */

const LOCALES_PROPIOS = [
    'ABASTO', 'ABASTO 2', 'AV. SANTA FE (AGUERO)', 'LA IMPRENTA', 'DISTRITO ARCOS',
    'MARTINEZ', 'SANTA FE Y PARANA', 'CALLE CORRIENTES', 'OBELISCO', 'GALERIAS PACIFICO',
    'SAN MIGUEL', 'DOT BAIRES', 'BULLRICH', 'NORDELTA', 'OLIVOS', 'RECOLETA',
    'CORDOBA CERRO', 'NUEVOCENTRO SHOPPING CBA', 'POSADAS', 'SALTA', 'SALTA ALTO NOA',
    'ALTO ROSARIO',
    'ALEM MDP', 'CONSTITUCION MDP', 'GUEMES MDP', 'LOS GALLEGOS MDP', 'CENTRAL',
    'PASEO ALDREY MDP', 'PEATONAL GRAND THEATRE', 'VARESE', 'PASO MDP', 'TORREON',
    // Único local propio fuera de Argentina. El resto del exterior
    // (España, Uruguay, USA, Chile, Paraguay) son franquicias.
    'ROMA',
];

/**
 * Equivalencias que el matcheo automático NO puede resolver solo,
 * verificadas contra la lista real de sucursales:
 *
 *   DOT BAIRES        → el shopping se llama Dot Baires, la sucursal "Dot"
 *   LOS GALLEGOS MDP  → en la hoja está sin el "Los"
 *   PASEO ALDREY MDP  → en la hoja está sin el "Paseo"
 *   PEATONAL GRAND THEATRE → hay DOS "Peatonal" (Mar del Plata y
 *                     Sarmiento Mendoza); Grand Theatre es la de MDP
 *   SALTA             → hay dos en Salta; por descarte es Galerías,
 *                     porque la otra está en la lista como SALTA ALTO NOA
 */
const EQUIVALENCIAS_PROPIOS = {
    // Abasto y Abasto 2 se necesitan SÍ O SÍ acá: sin esto, "ABASTO"
    // matchea parcialmente contra las dos y el matcheo se declara
    // ambiguo. Con el nombre completo cada una da match exacto.
    'ABASTO': "Shopping Abasto",
    'ABASTO 2': "Shopping Abasto 2",
    'AV. SANTA FE (AGUERO)': "Aguero",
    'SALTA ALTO NOA': "Alto NOA",
    // Nombres completos, confirmados por el usuario contra la hoja: acá
    // el matcheo por tokens no puede funcionar (ver la nota en
    // _buscarSucursal) y la comparación literal los resuelve seguro.
    'CORDOBA CERRO': "Lucciano's Cerro De Las Rosas Córdoba",
    'NUEVOCENTRO SHOPPING CBA': "Lucciano's Nuevocentro Córdoba",
    'DOT BAIRES': "Dot CABA",
    'LOS GALLEGOS MDP': "Gallegos Mar del Plata",
    'PASEO ALDREY MDP': "Aldrey Mar del Plata",
    'PEATONAL GRAND THEATRE': "Peatonal Mar del Plata",
    'SALTA': "Galerias Salta",
};

/* Las regiones se sacan SOLO cuando est\u00e1n al final del nombre, nunca en
   el medio. Borrarlas en cualquier posici\u00f3n romp\u00eda feo: "Lucciano's Santa
   Fe Santa Fe" quedaba en cadena VAC\u00cdA, y la cadena vac\u00eda es substring de
   todo, as\u00ed que esa sucursal sal\u00eda candidata de cualquier local. */
var _REGIONES = ['caba', 'gba', 'mdp', 'mar del plata', 'buenos aires',
                 'cordoba', 'cba', 'santa fe', 'misiones', 'de las rosas'];

function _normLocal(s) {
    var t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    t = t.replace(/lucciano's/g, ' ').replace(/luccianos/g, ' ');
    t = t.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

    var siguio = true;
    while (siguio) {
        siguio = false;
        for (var i = 0; i < _REGIONES.length; i++) {
            var suf = ' ' + _REGIONES[i];
            // el "length >" garantiza que nunca devuelva vac\u00edo
            if (t.length > suf.length && t.slice(-suf.length) === suf) {
                t = t.slice(0, -suf.length).trim();
                siguio = true;
            }
        }
    }
    return t;
}

/** Devuelve {fila, nombre} de la sucursal que corresponde, o null si no
 *  se puede resolver sin ambigüedad. */
function _buscarSucursal(corto, filas, colNombre) {
    var objetivo = EQUIVALENCIAS_PROPIOS[corto];

    // Si la equivalencia es el nombre COMPLETO tal cual está en la hoja,
    // se usa literal y no se normaliza nada. Es la salida de emergencia
    // para los casos donde normalizar juega en contra: "Lucciano's Cerro
    // De Las Rosas Córdoba" pierde "Córdoba" y "De Las Rosas" al sacarle
    // las regiones del final y queda en "cerro", mientras que el nombre
    // corto "CORDOBA CERRO" las conserva porque las tiene en el medio —
    // así el token "cordoba" no existía de un lado y no matcheaba nunca.
    if (objetivo) {
        var literal = [];
        for (var k = 1; k < filas.length; k++) {
            if (String(filas[k][colNombre] || '').trim().toLowerCase() === objetivo.trim().toLowerCase()) literal.push(k);
        }
        if (literal.length === 1) return { fila: literal[0], nombre: filas[literal[0]][colNombre] };
    }

    var nc = _normLocal(objetivo || corto);

    var exactos = [];
    for (var i = 1; i < filas.length; i++) {
        if (_normLocal(filas[i][colNombre]) === nc) exactos.push(i);
    }
    if (exactos.length === 1) return { fila: exactos[0], nombre: filas[exactos[0]][colNombre] };
    if (exactos.length > 1) return null;

    var toks = nc.split(' ').filter(function (t) { return t.length > 2; });
    if (!toks.length) return null;
    var cand = [];
    for (var j = 1; j < filas.length; j++) {
        var partes = _normLocal(filas[j][colNombre]).split(' ');
        var todos = toks.every(function (t) { return partes.indexOf(t) !== -1; });
        if (todos) cand.push(j);
    }
    return cand.length === 1 ? { fila: cand[0], nombre: filas[cand[0]][colNombre] } : null;
}

/**
 * previsualizarLocalesPropios() — NO modifica nada. Ejecutar PRIMERO.
 *
 * Muestra qué sucursal de la hoja se va a marcar por cada nombre de la
 * lista, y qué queda sin resolver. Clasificar mal un local es un error
 * de datos que después nadie encuentra, así que conviene leer esto
 * antes de aplicar.
 */
function previsualizarLocalesPropios() {
    _propios(false);
}

/**
 * marcarLocalesPropios() — MODIFICA la hoja Sucursales.
 *
 * Marca esPropio="SI" en los de la lista y "NO" en el resto. Se NIEGA a
 * aplicar si algún nombre quedó sin resolver: una clasificación a medias
 * es peor que ninguna, porque parece completa.
 */
function marcarLocalesPropios() {
    _propios(true, false);
}

/**
 * marcarLocalesPropiosIgual() — MODIFICA la hoja Sucursales aunque haya
 * nombres sin resolver.
 *
 * Escribe lo grueso y deja el resto para corregir a mano desde la
 * pantalla de Locales. OJO con lo que implica: los locales que NO
 * resolvieron quedan escritos como "NO" —franquicia— porque la función
 * no tiene forma de saber a qué fila corresponden. Si eran propios, hay
 * que arreglarlos después. Por eso al terminar los vuelve a listar.
 *
 * Preferí marcarLocalesPropios() siempre que puedas: esta versión deja
 * la hoja con datos que parecen completos y no lo están.
 */
function marcarLocalesPropiosIgual() {
    _propios(true, true);
}

function _propios(aplicar, forzar) {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sucursales');
    if (!hoja) { console.log('No existe la hoja Sucursales.'); return; }

    var filas = hoja.getDataRange().getValues();
    var enc = filas[0];
    var colNombre = enc.indexOf('nombre');
    var colPropio = enc.indexOf('esPropio');
    if (colNombre === -1) { console.log('Falta la columna "nombre".'); return; }
    if (colPropio === -1) { console.log('Falta la columna "esPropio". Agregá ese encabezado y volvé a ejecutar.'); return; }

    var resueltas = {};
    var sinResolver = [];
    var duplicados = [];

    LOCALES_PROPIOS.forEach(function (corto) {
        var m = _buscarSucursal(corto, filas, colNombre);
        if (!m) { sinResolver.push(corto); return; }
        if (resueltas[m.fila]) { duplicados.push(corto + ' y ' + resueltas[m.fila] + ' → ' + m.nombre); return; }
        resueltas[m.fila] = corto;
        console.log('  ' + corto + '   →   ' + m.nombre);
    });

    var cuantas = Object.keys(resueltas).length;
    console.log('');
    console.log('Resueltos: ' + cuantas + ' de ' + LOCALES_PROPIOS.length);

    if (duplicados.length) {
        console.log('');
        console.log('⚠️  DOS nombres de la lista apuntan a la MISMA sucursal:');
        duplicados.forEach(function (d) { console.log('    ' + d); });
    }
    if (sinResolver.length) {
        console.log('');
        console.log('⚠️  SIN RESOLVER (no existen en la hoja o son ambiguos):');
        sinResolver.forEach(function (s) { console.log('    ' + s); });

        // Sin esto hay que ir a mirar la hoja a mano para descubrir cómo
        // se llama realmente el local que no matcheó. Se listan sólo las
        // sucursales libres que comparten alguna palabra con el nombre
        // sin resolver: listarlas todas serían 89 franquicias de ruido.
        sinResolver.forEach(function (corto) {
            var palabras = _normLocal(EQUIVALENCIAS_PROPIOS[corto] || corto)
                .split(' ').filter(function (p) { return p.length > 2; });
            var candidatas = [];
            for (var j = 1; j < filas.length; j++) {
                var nom = String(filas[j][colNombre] || '').trim();
                if (!nom || resueltas[j]) continue;
                var n = _normLocal(nom);
                var pega = palabras.some(function (p) { return n.indexOf(p) !== -1; });
                if (pega) candidatas.push(nom);
            }
            console.log('');
            if (candidatas.length) {
                console.log('    ¿"' + corto + '" es alguna de estas?');
                candidatas.forEach(function (c) { console.log('       · ' + c); });
                console.log('      Si es una, ponela en EQUIVALENCIAS_PROPIOS con ese nombre.');
            } else {
                console.log('    "' + corto + '" no se parece a ninguna sucursal libre.');
                console.log('      O no está cargada en la hoja, o se llama de otra forma.');
            }
        });
    }

    var pendientes = sinResolver.concat(duplicados.map(function (d) { return d.split(' y ')[0]; }));

    if (!aplicar) {
        console.log('');
        console.log('— Previsualización. No se modificó nada. —');
        if (pendientes.length) {
            console.log('Para escribir igual lo que sí resolvió y corregir el resto a');
            console.log('mano después, ejecutá marcarLocalesPropiosIgual().');
        } else {
            console.log('Si el listado de arriba está bien, ejecutá marcarLocalesPropios().');
        }
        return;
    }

    if (pendientes.length && !forzar) {
        console.log('');
        console.log('❌ NO SE APLICÓ NADA. Resolvé primero lo de arriba:');
        console.log('   · si el local no existe en la hoja, cargalo o sacalo de LOCALES_PROPIOS');
        console.log('   · si es ambiguo, agregá la equivalencia exacta en EQUIVALENCIAS_PROPIOS');
        console.log('');
        console.log('   O ejecutá marcarLocalesPropiosIgual() para escribir lo que sí');
        console.log('   resolvió y corregir el resto a mano.');
        return;
    }

    // Una sola escritura para toda la columna. Celda por celda serían 120
    // llamadas y Apps Script se arrastra con eso.
    var columna = [];
    var propios = 0, franquicias = 0;
    for (var i = 1; i < filas.length; i++) {
        if (!String(filas[i][colNombre] || '').trim()) {
            columna.push([filas[i][colPropio]]);   // fila vacía: no la tocamos
            continue;
        }
        var esPropio = !!resueltas[i];
        columna.push([esPropio ? 'SI' : 'NO']);
        esPropio ? propios++ : franquicias++;
    }
    hoja.getRange(2, colPropio + 1, columna.length, 1).setValues(columna);
    console.log('');
    console.log('✓ ' + propios + ' PROPIOS · ' + franquicias + ' FRANQUICIAS');

    if (pendientes.length) {
        console.log('');
        console.log('⚠️  FALTAN ' + pendientes.length + ', CORREGILOS A MANO en Locales.');
        console.log('   Quedaron escritos como FRANQUICIA porque la función no supo a');
        console.log('   qué fila de la hoja corresponden, pero son PROPIOS:');
        pendientes.forEach(function (p) { console.log('      · ' + p); });
        console.log('');
        console.log('   Total real: ' + (propios + pendientes.length) + ' propios.');
    }
}

/* ══════════════════════════════════════════════════════════════════
   SUCURSALES FALTANTES
   ══════════════════════════════════════════════════════════════════

   La hoja se sembró con una lista de 99 locales y desde entonces la red
   creció a 122: faltan los 5 de USA, los 8 de España, Roma, dos de
   Uruguay, Abasto 2 y siete argentinas. En la app se notaba en el filtro
   por país, que no mostraba ni Estados Unidos ni España.

   Esta lista es el padrón completo. La función de abajo SOLO AGREGA lo
   que no está: nunca edita ni borra una fila existente, así que no pisa
   nada cargado a mano y se puede correr las veces que haga falta.       */

var PADRON_SUCURSALES = [
    { id: 1, nombre: "Lucciano's Martinez GBA", propio: true },
    { id: 2, nombre: "Lucciano's Olivos GBA", propio: true },
    { id: 7, nombre: "Lucciano's San Miguel GBA", propio: true },
    { id: 12, nombre: "Lucciano's Shopping Abasto CABA", propio: true },
    { id: 121, nombre: "Lucciano's Shopping Abasto 2 CABA", propio: true },
    { id: 13, nombre: "Lucciano's La Imprenta Gran Hotel CABA", propio: true },
    { id: 14, nombre: "Lucciano's Distrito Arcos CABA", propio: true },
    { id: 20, nombre: "Lucciano's Recoleta CABA", propio: true },
    { id: 21, nombre: "Lucciano's Dot CABA", propio: true },
    { id: 33, nombre: "Lucciano's Agüero CABA", propio: true },
    { id: 37, nombre: "Lucciano's Galerias Pacifico CABA", propio: true },
    { id: 42, nombre: "Lucciano's Patio Bullrich CABA", propio: true },
    { id: 43, nombre: "Lucciano's Obelisco CABA", propio: true },
    { id: 45, nombre: "Lucciano's Calle Corrientes CABA", propio: true },
    { id: 46, nombre: "Lucciano's Santa Fe y Parana CABA", propio: true },
    { id: 47, nombre: "Lucciano's Nordelta Buenos Aires", propio: true },
    { id: 63, nombre: "Lucciano's Cerro De Las Rosas Córdoba", propio: true },
    { id: 64, nombre: "Lucciano's Nuevocentro Córdoba", propio: true },
    { id: 66, nombre: "Lucciano's Alto Rosario Santa Fe", propio: true },
    { id: 79, nombre: "Lucciano's Galerias Salta", propio: true },
    { id: 80, nombre: "Lucciano's Alto NOA Salta", propio: true },
    { id: 81, nombre: "Lucciano's Posadas Misiones", propio: true },
    { id: 90, nombre: "Lucciano's Alem Mar del Plata", propio: true },
    { id: 91, nombre: "Lucciano's Aldrey Mar del Plata", propio: true },
    { id: 92, nombre: "Lucciano's Central Mar del Plata", propio: true },
    { id: 93, nombre: "Lucciano's Constitucion Mar del Plata", propio: true },
    { id: 94, nombre: "Lucciano's Gallegos Mar del Plata", propio: true },
    { id: 95, nombre: "Lucciano's Guemes Mar del Plata", propio: true },
    { id: 96, nombre: "Lucciano's Paso Mar del Plata", propio: true },
    { id: 97, nombre: "Lucciano's Peatonal Mar del Plata", propio: true },
    { id: 98, nombre: "Lucciano's Torreon Mar del Plata", propio: true },
    { id: 99, nombre: "Lucciano's Varese Mar del Plata", propio: true },
    { id: 3, nombre: "Lucciano's Parque Avellaneda Shopping GBA" },
    { id: 4, nombre: "Lucciano's Ituzaingo GBA" },
    { id: 5, nombre: "Lucciano's Distrito T GBA" },
    { id: 6, nombre: "Lucciano's Adrogué GBA" },
    { id: 8, nombre: "Lucciano's Parque Leloir GBA" },
    { id: 9, nombre: "Lucciano's Quilmes GBA" },
    { id: 10, nombre: "Lucciano's Caseros GBA" },
    { id: 11, nombre: "Lucciano's Ramos Mejia GBA" },
    { id: 15, nombre: "Lucciano's Arcos del Rosedal CABA" },
    { id: 16, nombre: "Lucciano's Villa del Parque CABA" },
    { id: 17, nombre: "Lucciano's Honduras CABA" },
    { id: 18, nombre: "Lucciano's Cid Campeador CABA" },
    { id: 19, nombre: "Lucciano's Devoto CABA" },
    { id: 22, nombre: "Lucciano's Puerto Madero Dique CABA" },
    { id: 23, nombre: "Lucciano's Puerto Madero CABA" },
    { id: 24, nombre: "Lucciano's Caballito CABA" },
    { id: 25, nombre: "Lucciano's Parque Rivadavia CABA" },
    { id: 26, nombre: "Lucciano's Libertador CABA" },
    { id: 27, nombre: "Lucciano's Villa Urquiza CABA" },
    { id: 28, nombre: "Lucciano's Villa Urquiza II CABA" },
    { id: 29, nombre: "Lucciano's Villa Luro CABA" },
    { id: 30, nombre: "Lucciano's Coghlan CABA" },
    { id: 31, nombre: "Lucciano's Las Cañitas CABA" },
    { id: 32, nombre: "Lucciano's Colegiales CABA" },
    { id: 34, nombre: "Lucciano's Nuñez CABA" },
    { id: 35, nombre: "Lucciano's Belgrano C CABA" },
    { id: 36, nombre: "Lucciano's Bajo Belgrano CABA" },
    { id: 38, nombre: "Lucciano's San Telmo CABA" },
    { id: 39, nombre: "Lucciano's Paseo del Angel CABA" },
    { id: 40, nombre: "Lucciano's Plaza Houssay CABA" },
    { id: 41, nombre: "Lucciano's Palermo Chico CABA" },
    { id: 44, nombre: "Lucciano's Almagro CABA" },
    { id: 48, nombre: "Lucciano's Baxar Mercado Buenos Aires" },
    { id: 49, nombre: "Lucciano's La Plata Buenos Aires" },
    { id: 50, nombre: "Lucciano's Pilar Buenos Aires" },
    { id: 51, nombre: "Lucciano's Pilar II Buenos Aires" },
    { id: 52, nombre: "Lucciano's City Bell Buenos Aires" },
    { id: 53, nombre: "Lucciano's Las Lomitas Buenos Aires" },
    { id: 54, nombre: "Lucciano's Lanus Buenos Aires" },
    { id: 55, nombre: "Lucciano's San Fernando Buenos Aires" },
    { id: 56, nombre: "Lucciano's Campana Buenos Aires" },
    { id: 57, nombre: "Lucciano's San Nicolas Buenos Aires" },
    { id: 58, nombre: "Lucciano's Tandil Buenos Aires" },
    { id: 59, nombre: "Lucciano's Carilo Buenos Aires" },
    { id: 60, nombre: "Lucciano's Pinamar Buenos Aires", inactiva: true },
    { id: 61, nombre: "Lucciano's Bahia Blanca Buenos Aires" },
    { id: 62, nombre: "Lucciano's Bahia Blanca Villa Mitre Buenos Aires" },
    { id: 65, nombre: "Lucciano's Ribera Shopping Santa Fe" },
    { id: 67, nombre: "Lucciano's Peatonal Sarmiento Mendoza" },
    { id: 68, nombre: "Lucciano's Palmares Mendoza" },
    { id: 69, nombre: "Lucciano's Chacras de Coria Mendoza" },
    { id: 70, nombre: "Lucciano's Shopping Mendoza" },
    { id: 71, nombre: "Lucciano's Resistencia Chaco" },
    { id: 72, nombre: "Lucciano's Av Argentina Neuquén" },
    { id: 73, nombre: "Lucciano's Paseo de la Costa Neuquén" },
    { id: 74, nombre: "Lucciano's Cipolletti Rio Negro" },
    { id: 75, nombre: "Lucciano's Gral Roca Rio Negro" },
    { id: 76, nombre: "Lucciano's Barrio Norte Tucuman" },
    { id: 77, nombre: "Lucciano's Yerba Buena Tucuman" },
    { id: 78, nombre: "Lucciano's Catamarca Catamarca" },
    { id: 82, nombre: "Lucciano's Madryn Chubut" },
    { id: 83, nombre: "Lucciano's Ushuaia Tierra del Fuego", inactiva: true },
    { id: 84, nombre: "Lucciano's Capital Corrientes" },
    { id: 100, nombre: "Lucciano's Cabildo y Juramento CABA" },
    { id: 101, nombre: "Lucciano's Castelar Buenos Aires" },
    { id: 102, nombre: "Lucciano's Palermo Buenos Aires" },
    { id: 103, nombre: "Lucciano's Mar de las Pampas Buenos Aires" },
    { id: 104, nombre: "Lucciano's General Pico Buenos Aires" },
    { id: 105, nombre: "Lucciano's Vista Pueblo Buenos Aires" },
    { id: 106, nombre: "Lucciano's Santa Fe Santa Fe" },
    { id: 85, nombre: "Lucciano's Pocitos Uruguay" },
    { id: 86, nombre: "Lucciano's Punta Carretas Uruguay" },
    { id: 87, nombre: "Lucciano's Punta del Este Uruguay" },
    { id: 88, nombre: "Lucciano's Carrasco Uruguay" },
    { id: 122, nombre: "Lucciano's Punta Carrasco Uruguay" },
    { id: 89, nombre: "Lucciano's Asuncion Paraguay", inactiva: true },
    { id: 91, nombre: "Lucciano's Parque Arauco Chile" },
    { id: 107, nombre: "Lucciano's Barcelona The Moon España" },
    { id: 108, nombre: "Lucciano's Barcelona España" },
    { id: 109, nombre: "Lucciano's Madrid España" },
    { id: 110, nombre: "Lucciano's Granada España" },
    { id: 111, nombre: "Lucciano's Valencia España" },
    { id: 112, nombre: "Lucciano's Málaga Uncibay III España" },
    { id: 113, nombre: "Lucciano's Alicante España" },
    { id: 114, nombre: "Lucciano's Málaga I España" },
    { id: 115, nombre: "Lucciano's Weston USA" },
    { id: 116, nombre: "Lucciano's American Dream USA" },
    { id: 117, nombre: "Lucciano's Adventure USA" },
    { id: 118, nombre: "Lucciano's Sawgrass USA" },
    { id: 119, nombre: "Lucciano's The Florida Mall USA" },
    { id: 120, nombre: "Lucciano's Roma Italia", propio: true },
];

/**
 * completarSucursalesFaltantes() — NO modifica nada. Muestra qué se
 * agregaría y qué locales de la hoja no reconoce.
 */
function completarSucursalesFaltantes() {
    _sucursalesFaltantes(false);
}

/**
 * agregarSucursalesFaltantes() — MODIFICA la hoja: agrega las que
 * faltan. No edita ni borra ninguna fila existente.
 *
 * Va como función aparte y no como completarSucursalesFaltantes(true):
 * el botón Ejecutar del editor de Apps Script no permite pasarle
 * argumentos a una función, así que la versión con parámetro se corría
 * SIEMPRE en modo previsualización y no había forma de aplicarla desde
 * ahí. Mismo patrón de dos funciones que ya usan propios y países.
 */
function agregarSucursalesFaltantes() {
    _sucursalesFaltantes(true);
}

function _sucursalesFaltantes(aplicar) {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sucursales');
    if (!hoja) { console.log('No existe la hoja Sucursales.'); return; }

    var filas = hoja.getDataRange().getValues();
    var enc = filas[0];
    var colNombre = enc.indexOf('nombre');
    var colId = enc.indexOf('id');
    if (colNombre === -1) { console.log('Falta la columna "nombre".'); return; }

    // Se comparan nombres normalizados y no texto crudo: una tilde o un
    // espacio de más alcanzarían para cargar un duplicado del mismo local.
    var yaEstan = {};
    var idsUsados = {};
    var maxId = 0;
    for (var i = 1; i < filas.length; i++) {
        var nom = String(filas[i][colNombre] || '').trim();
        if (!nom) continue;
        yaEstan[_normLocal(nom)] = nom;
        if (colId !== -1) {
            var id = Number(filas[i][colId]);
            if (isFinite(id)) { idsUsados[Math.round(id)] = true; if (id > maxId) maxId = Math.round(id); }
        }
    }

    var nuevas = PADRON_SUCURSALES.filter(function (s) { return !yaEstan[_normLocal(s.nombre)]; });

    // Al revés: lo que está en la hoja y no en el padrón. No se toca —
    // puede ser un local nuevo cargado a mano, o un nombre mal escrito
    // que hay que corregir con criterio, no automáticamente.
    var enPadron = {};
    PADRON_SUCURSALES.forEach(function (s) { enPadron[_normLocal(s.nombre)] = true; });
    var desconocidas = Object.keys(yaEstan)
        .filter(function (k) { return !enPadron[k]; })
        .map(function (k) { return yaEstan[k]; });

    console.log('En la hoja: ' + Object.keys(yaEstan).length + '   ·   Padrón: ' + PADRON_SUCURSALES.length);
    console.log('');

    if (!nuevas.length) {
        console.log('No falta ninguna. La hoja ya tiene el padrón completo.');
    } else {
        console.log('FALTAN ' + nuevas.length + ':');
        nuevas.forEach(function (s) {
            console.log('   + ' + s.nombre + (s.propio ? '   [propio]' : '') + (s.inactiva ? '   [inactiva]' : ''));
        });
    }

    if (desconocidas.length) {
        console.log('');
        console.log('⚠️  EN LA HOJA PERO NO EN EL PADRÓN (' + desconocidas.length + ') — NO se tocan:');
        // Cuánta gente quedaría huérfana si se borra o renombra cada una.
        // Es el dato que hay que tener ANTES de tocarlas: el nombre del
        // local es la clave con la que Usuarios lo enlaza, así que
        // borrarla deja a esa gente apuntando a un local inexistente y no
        // salta ningún error — simplemente dejan de verse donde deberían.
        var hojaU = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
        var porLocal = {};
        if (hojaU) {
            var fu = hojaU.getDataRange().getValues();
            var cs = fu[0].indexOf('sucursal');
            var cn = fu[0].indexOf('nombre');
            if (cs !== -1) {
                for (var u = 1; u < fu.length; u++) {
                    var k = _normLocal(fu[u][cs]);
                    if (!k) continue;
                    if (!porLocal[k]) porLocal[k] = [];
                    porLocal[k].push(cn !== -1 ? fu[u][cn] : '(sin nombre)');
                }
            }
        }
        desconocidas.forEach(function (n) {
            var gente = porLocal[_normLocal(n)] || [];
            console.log('   ? ' + n + '   —   ' + (gente.length ? gente.length + ' persona(s) asignada(s): ' + gente.join(', ') : 'sin gente asignada'));
        });
        console.log('');
        console.log('   Si NO tiene gente asignada, se puede borrar la fila y volver a');
        console.log('   correr esta función para que cargue el nombre correcto.');
        console.log('   Si SÍ tiene, hay que reasignar a esa gente PRIMERO.');
    }

    if (!aplicar) {
        console.log('');
        console.log('— Previsualización. No se modificó nada. —');
        if (nuevas.length) console.log('Para agregarlas, ejecutá: agregarSucursalesFaltantes()');
        return;
    }
    if (!nuevas.length) return;

    var colEstado = enc.indexOf('estado');
    var colPropio = enc.indexOf('esPropio');
    var colPais = enc.indexOf('pais');

    var aEscribir = nuevas.map(function (s) {
        var fila = [];
        for (var c = 0; c < enc.length; c++) fila.push('');
        // Se respeta el id del padrón si está libre; si no, se sigue
        // después del más alto para no pisar a nadie.
        if (colId !== -1) { if (idsUsados[s.id]) { maxId++; fila[colId] = maxId; } else { fila[colId] = s.id; idsUsados[s.id] = true; if (s.id > maxId) maxId = s.id; } }
        fila[colNombre] = s.nombre;
        if (colEstado !== -1) fila[colEstado] = s.inactiva ? 'Inactiva' : 'Activa';
        if (colPropio !== -1) fila[colPropio] = s.propio ? 'SI' : 'NO';
        if (colPais !== -1) fila[colPais] = _paisDelNombre(s.nombre);
        return fila;
    });

    hoja.getRange(hoja.getLastRow() + 1, 1, aEscribir.length, enc.length).setValues(aEscribir);
    console.log('');
    console.log('✓ Agregadas ' + aEscribir.length + '. La hoja queda con ' +
                (Object.keys(yaEstan).length + aEscribir.length) + ' sucursales.');
}

/**
 * diagnosticoSucursales() — NO modifica nada.
 *
 * Contesta por qué la app puede estar mostrando menos locales de los que
 * hay en la hoja. El sospechoso principal es el id: la caché local
 * (IndexedDB) guarda cada sucursal con el id como clave, así que dos
 * filas con el MISMO id, o con el id vacío, se pisan entre sí y en la
 * app quedan como una sola. En la planilla no se nota nada.
 */
function diagnosticoSucursales() {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sucursales');
    if (!hoja) { console.log('No existe la hoja Sucursales.'); return; }

    var filas = hoja.getDataRange().getValues();
    var enc = filas[0];
    console.log('Encabezados: ' + enc.join(' | '));

    var colId = enc.indexOf('id');
    var colNombre = enc.indexOf('nombre');
    var colPropio = enc.indexOf('esPropio');
    var colPais = enc.indexOf('pais');
    console.log('Columnas → id:' + colId + '  nombre:' + colNombre + '  esPropio:' + colPropio + '  pais:' + colPais);
    if (colId === -1) console.log('⚠️  NO hay columna "id". Sin id la app no puede distinguir una sucursal de otra.');
    console.log('');

    var vistos = {}, duplicados = [], sinId = [], sinPais = [];
    var propios = 0, franquicias = 0, otros = [], filasReales = 0;

    for (var i = 1; i < filas.length; i++) {
        var nombre = String(filas[i][colNombre] || '').trim();
        if (!nombre) continue;
        filasReales++;

        if (colId !== -1) {
            var id = String(filas[i][colId] || '').trim();
            if (!id) sinId.push(nombre);
            else if (vistos[id]) duplicados.push('id ' + id + ': "' + vistos[id] + '" y "' + nombre + '"');
            else vistos[id] = nombre;
        }
        if (colPais !== -1 && !String(filas[i][colPais] || '').trim()) sinPais.push(nombre);

        if (colPropio !== -1) {
            var v = String(filas[i][colPropio] || '').trim().toUpperCase();
            if (v === 'SI') propios++;
            else if (v === 'NO' || v === '') franquicias++;
            else otros.push(nombre + ' → "' + filas[i][colPropio] + '"');
        }
    }

    console.log('Filas con nombre: ' + filasReales);
    console.log('Propios: ' + propios + '   ·   Franquicias: ' + franquicias);
    console.log('');

    if (duplicados.length) {
        console.log('❌ IDs DUPLICADOS (' + duplicados.length + ') — la app muestra UNA sola de cada par:');
        duplicados.forEach(function (d) { console.log('   ' + d); });
    } else if (colId !== -1) {
        console.log('✓ Sin ids duplicados');
    }

    if (sinId.length) {
        console.log('');
        console.log('❌ SIN ID (' + sinId.length + ') — todas colapsan en un solo registro:');
        sinId.forEach(function (n) { console.log('   ' + n); });
    }

    if (otros.length) {
        console.log('');
        console.log('⚠️  esPropio con un valor que no es SI ni NO (' + otros.length + '):');
        otros.forEach(function (n) { console.log('   ' + n); });
    }

    if (sinPais.length) {
        console.log('');
        console.log('⚠️  SIN PAÍS (' + sinPais.length + ') — ejecutá completarPaises():');
        sinPais.slice(0, 15).forEach(function (n) { console.log('   ' + n); });
        if (sinPais.length > 15) console.log('   …y ' + (sinPais.length - 15) + ' más');
    }

    console.log('');
    console.log('La app debería mostrar ' + (filasReales - duplicados.length - Math.max(0, sinId.length - 1)) + ' locales.');
}

/* ══════════════════════════════════════════════════════════════════
   PAÍS DE CADA SUCURSAL
   ══════════════════════════════════════════════════════════════════

   La columna "pais" es lo que hace funcionar el alcance por país de
   cursos y lecciones (js/services/alcance.js): a nadie se le pregunta
   de qué país es, se deduce de su local.

   No hace falta cargarla a mano: el país YA está en el sufijo del
   nombre — "Lucciano's Pocitos Uruguay", "Lucciano's Weston USA". Todo
   lo que no tenga sufijo de país extranjero es Argentina, porque los
   locales argentinos terminan en provincia (CABA, GBA, Mendoza…).

   Se guardan los nombres COMPLETOS, no abreviaturas. El valor de esta
   columna es el mismo texto que después se escribe en el campo
   "aplicaA" de un curso, y ahí alguien va a tipear "Uruguay", no
   "uru".                                                              */

var PAIS_POR_SUFIJO = {
    'uruguay': 'Uruguay',
    'paraguay': 'Paraguay',
    'chile': 'Chile',
    'espana': 'España',
    'usa': 'Estados Unidos',
    'italia': 'Italia',
};

function _paisDelNombre(nombre) {
    var t = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    var ultima = t.split(' ').pop();
    return PAIS_POR_SUFIJO[ultima] || 'Argentina';
}

/** previsualizarPaises() — NO modifica nada. Ejecutar PRIMERO. */
function previsualizarPaises() {
    _paises(false);
}

/** completarPaises() — MODIFICA la hoja Sucursales. Crea la columna
 *  "pais" si no existe y la completa. No pisa lo que ya esté cargado a
 *  mano: si una fila ya tiene país, se respeta. */
function completarPaises() {
    _paises(true);
}

function _paises(aplicar) {
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sucursales');
    if (!hoja) { console.log('No existe la hoja Sucursales.'); return; }

    var filas = hoja.getDataRange().getValues();
    var enc = filas[0];
    var colNombre = enc.indexOf('nombre');
    if (colNombre === -1) { console.log('Falta la columna "nombre".'); return; }

    var colPais = enc.indexOf('pais');
    if (colPais === -1) {
        if (!aplicar) {
            console.log('La columna "pais" todavía no existe — completarPaises() la crea.');
            console.log('');
        } else {
            colPais = hoja.getLastColumn();
            hoja.getRange(1, colPais + 1).setValue('pais');
            console.log('Columna "pais" creada.');
        }
    }

    var cuenta = {};
    var columna = [];
    var respetadas = 0;

    for (var i = 1; i < filas.length; i++) {
        var nombre = String(filas[i][colNombre] || '').trim();
        if (!nombre) { columna.push(['']); continue; }

        var yaCargado = colPais === -1 ? '' : String(filas[i][colPais] || '').trim();
        var pais = yaCargado || _paisDelNombre(nombre);
        if (yaCargado) respetadas++;

        columna.push([pais]);
        cuenta[pais] = (cuenta[pais] || 0) + 1;
        if (pais !== 'Argentina') console.log('  ' + nombre + '   →   ' + pais);
    }

    console.log('');
    Object.keys(cuenta).sort().forEach(function (p) {
        console.log('  ' + cuenta[p] + '  ' + p);
    });
    if (respetadas) console.log('(' + respetadas + ' filas ya tenían país cargado, no se tocaron)');

    if (!aplicar) {
        console.log('');
        console.log('— Previsualización. No se modificó nada. —');
        console.log('Si está bien, ejecutá completarPaises().');
        return;
    }

    hoja.getRange(2, colPais + 1, columna.length, 1).setValues(columna);
    console.log('');
    console.log('✓ Columna "pais" completada en ' + columna.length + ' filas.');
}

/**
 * renombrarCarpetasDeColaboradores() — MODIFICA Drive. Ejecutar una vez.
 *
 * Las carpetas de fotos se crearon con el id del colaborador
 * ("1786486477496"), así que abrir Drive es una lista de números sin
 * forma de saber de quién es cada una. Desde Code.gs v1.4.2 las nuevas
 * se llaman "Nombre (id)", pero eso solo aplica cuando la persona
 * vuelve a subir una foto — las que ya existen se quedan como están.
 * Esto las pasa todas de una.
 *
 * También reporta las carpetas cuyo id ya NO está en la hoja Usuarios:
 * son de gente eliminada antes de que el borrado limpiara Drive. No las
 * toca — solo las lista, para que se decida qué hacer.
 *
 * Es idempotente: correrla dos veces no rompe nada.
 */
function renombrarCarpetasDeColaboradores() {
  const raiz = DriveApp.getRootFolder();
  const recursos = raiz.getFoldersByName("Lucciano's Academy — Recursos");
  if (!recursos.hasNext()) { console.log('No existe la carpeta de Recursos.'); return; }
  const colab = recursos.next().getFoldersByName('Colaboradores');
  if (!colab.hasNext()) { console.log('No existe la subcarpeta Colaboradores.'); return; }

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const datos = hoja.getDataRange().getValues();
  const enc = datos[0];
  const colId = enc.indexOf('id');
  const colNombre = enc.indexOf('nombre');
  if (colId === -1 || colNombre === -1) { console.log('Faltan columnas id/nombre.'); return; }

  const porId = {};
  for (let i = 1; i < datos.length; i++) {
    const id = String(datos[i][colId]).split('.')[0].trim();
    if (id) porId[id] = String(datos[i][colNombre] || '').trim();
  }

  let renombradas = 0, yaEstaban = 0;
  const huerfanas = [];
  const it = colab.next().getFolders();

  while (it.hasNext()) {
    const c = it.next();
    const nombre = c.getName();
    // "Nombre (id)" o, en las viejas, el id solo (a veces con decimales)
    const m = nombre.match(/\((\d+)\)\s*$/);
    const id = m ? m[1] : nombre.trim().split('.')[0];

    const persona = porId[id];
    if (!persona) { huerfanas.push(nombre); continue; }

    const deseado = persona + ' (' + id + ')';
    if (nombre === deseado) { yaEstaban++; continue; }
    c.setName(deseado);
    console.log('  ' + nombre + '   →   ' + deseado);
    renombradas++;
  }

  console.log('');
  console.log('✓ ' + renombradas + ' carpeta(s) renombradas · ' + yaEstaban + ' ya estaban bien');

  if (huerfanas.length) {
    console.log('');
    console.log('⚠️  ' + huerfanas.length + ' carpeta(s) de gente que ya NO está en Usuarios:');
    huerfanas.forEach(function (n) { console.log('    ' + n); });
    console.log('    NO se tocaron. Son de usuarios eliminados antes de que');
    console.log('    el borrado limpiara Drive — se pueden mandar a la papelera a mano.');
  }
}

/**
 * dondeEstanLasFotos() — diagnóstico, no modifica nada.
 *
 * Responde "¿dónde carajo se guardan las fotos de perfil?" sin tener
 * que buscar a mano en Drive. Imprime en el log:
 *   - con qué cuenta de Google corre el script (define de QUIÉN es el
 *     "Mi unidad" donde termina todo);
 *   - el link directo a la carpeta de fotos;
 *   - qué usuario tiene qué archivo, con su fecha y su link.
 *
 * A propósito NO usa _obtenerOCrearFolder: busca sin crear. Un
 * diagnóstico que crea carpetas vacías al ejecutarse ensucia lo mismo
 * que está tratando de explicar.
 *
 * Ejecutar: elegir esta función en el desplegable y darle Ejecutar.
 * Después: Ver → Registros (o el panel "Registro de ejecución").
 */
function dondeEstanLasFotos() {
  console.log('Cuenta que ejecuta: ' + Session.getEffectiveUser().getEmail());
  console.log('Planilla vinculada: ' + SpreadsheetApp.getActiveSpreadsheet().getName());
  console.log('');

  function buscarSubcarpeta(padre, nombre) {
    const it = padre.getFoldersByName(nombre);
    return it.hasNext() ? it.next() : null;
  }

  const raiz = DriveApp.getRootFolder();
  const recursos = buscarSubcarpeta(raiz, "Lucciano's Academy — Recursos");
  if (!recursos) {
    console.log('No existe la carpeta "Lucciano\'s Academy — Recursos" en Mi unidad de esta cuenta.');
    console.log('Se crea sola en la primera subida. Si esperabas fotos acá, se subieron con OTRA cuenta.');
    return;
  }
  console.log('Carpeta Recursos:      ' + recursos.getUrl());

  const colaboradores = buscarSubcarpeta(recursos, 'Colaboradores');
  if (!colaboradores) {
    console.log('Todavía no hay ninguna foto de perfil subida (falta la subcarpeta "Colaboradores").');
    return;
  }
  console.log('Carpeta Colaboradores: ' + colaboradores.getUrl());
  console.log('');

  // Nombre de cada usuario, para no leer solo ids sueltos.
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  const datos = hoja ? hoja.getDataRange().getValues() : [];
  const encabezados = datos.length ? datos[0] : [];
  const colId = encabezados.indexOf('id');
  const colNombre = encabezados.indexOf('nombre');
  const colFoto = encabezados.indexOf('foto');
  const porId = {};
  for (let i = 1; i < datos.length; i++) {
    if (colId === -1) break;
    porId[String(datos[i][colId])] = {
      nombre: colNombre !== -1 ? datos[i][colNombre] : '(sin nombre)',
      foto: colFoto !== -1 ? String(datos[i][colFoto] || '') : ''
    };
  }

  let total = 0;
  const carpetas = colaboradores.getFolders();
  while (carpetas.hasNext()) {
    const carpeta = carpetas.next();
    const id = carpeta.getName();
    const usuario = porId[id] || { nombre: '(no está en la hoja Usuarios)', foto: '' };
    console.log('· id ' + id + ' — ' + usuario.nombre);

    const archivos = carpeta.getFiles();
    let hayArchivos = false;
    while (archivos.hasNext()) {
      const archivo = archivos.next();
      hayArchivos = true;
      total++;
      console.log('    archivo: ' + archivo.getName() + '  (' + archivo.getDateCreated().toLocaleString() + ')');
      console.log('    ver:     ' + archivo.getUrl());
      // El punto del diagnóstico: si el id de este archivo NO aparece en
      // la celda "foto", la app está mostrando otra cosa (una subida
      // vieja, o una URL cargada a mano en la planilla).
      const coincide = usuario.foto.indexOf(archivo.getId()) !== -1;
      console.log('    ¿es la que muestra la app?: ' + (coincide ? 'SÍ' : 'NO'));
    }
    if (!hayArchivos) console.log('    (carpeta vacía)');
    console.log('    celda "foto" en la hoja: ' + (usuario.foto || '(vacía)'));
    console.log('');
  }

  console.log('=== ' + total + ' archivo(s) de foto en total ===');
}

/**
 * Editar OnChange para que auto-actualice fechaModificacion
 * (Agregar a existentes onEdit/onChange handlers, o crear trigger manual)
 */
function actualizarFechaModificacion(e) {
  const hoja = e.source.getActiveSheet();
  const rango = e.range;
  
  if (!rango || rango.getRow() === 1) return; // Skip header
  
  // Buscar columna fechaModificacion
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  const indiceColumna = headers.findIndex(h => String(h).toLowerCase() === 'fechamodificacion');
  
  if (indiceColumna === -1) return; // Columna no existe
  
  // Actualizar la celda de fechaModificacion en esa fila
  const fila = rango.getRow();
  hoja.getRange(fila, indiceColumna + 1).setValue(new Date());
}
