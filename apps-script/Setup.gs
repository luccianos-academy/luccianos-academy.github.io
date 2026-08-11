/**
 * Setup.gs — Utilidades de inicialización para sincronización
 * 
 * Ejecutar una sola vez: Run > setupSyncColumns()
 * Agrega columna 'fechaModificacion' a todas las hojas de datos
 */

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
