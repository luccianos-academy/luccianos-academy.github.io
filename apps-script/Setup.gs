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
      
      // Buscar si ya existe la columna
      const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
      const existeFechaModificacion = headers.some(h => String(h).toLowerCase() === 'fechamodificacion');
      
      if (existeFechaModificacion) {
        console.log(`✓ ${nombreHoja}: columna fechaModificacion ya existe`);
        return;
      }
      
      // Agregar columna al final
      const ultimaColumna = hoja.getLastColumn() + 1;
      hoja.getRange(1, ultimaColumna).setValue('fechaModificacion');
      
      // Llenar con NOW() para todas las filas existentes
      const ultimaFila = hoja.getLastRow();
      if (ultimaFila > 1) {
        const rango = hoja.getRange(2, ultimaColumna, ultimaFila - 1);
        rango.setFormula('=NOW()');
      }
      
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
