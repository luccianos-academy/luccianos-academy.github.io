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
