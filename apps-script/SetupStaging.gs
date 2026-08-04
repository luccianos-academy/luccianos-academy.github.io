/**
 * SetupStaging.gs — Crea de una la estructura completa de Sheets para
 * un backend de STAGING (Lucciano's Academy — REPO), separado del de
 * producción. Pegar en un Apps Script atado a una planilla NUEVA y
 * vacía, correr crearEstructuraStaging() una sola vez, después seguir
 * con poblarDatosIniciales() (Seed.gs) como siempre.
 *
 * No toca ninguna hoja existente que ya tenga datos: si una hoja con
 * ese nombre ya existe, la deja como está (no la vacía ni le pisa
 * headers) — así se puede correr de nuevo sin miedo si se cortó a
 * mitad de camino.
 */

const ESTRUCTURA_HOJAS_STAGING = {
    "Usuarios": ["id", "nombre", "email", "rol", "encargado", "sucursal", "activo",
        "fechaVencimientoAcceso", "fechaAlta", "capacitador", "historiaVista", "foto"],

    "Sucursales": ["id", "nombre", "supervisor", "estado", "esPropio"],

    "Cursos": ["id", "nombre", "categoria", "obligatorio", "orden"],

    "Lecciones": ["id", "cursoId", "orden", "titulo", "objetivo", "duracionMinutos",
        "video", "manual", "manualLabel", "imagen", "procedimiento", "errores",
        "buenasPracticas", "consejo", "resumen", "estado"],

    "Evaluaciones": ["id", "cursoId", "pregunta", "opcion1", "opcion2", "opcion3", "correcta", "puntaje"],

    "Asignaciones": ["id", "colaboradorId", "cursoId", "fechaAlta", "fechaVencimiento", "estado", "progreso"],

    "Resultados": ["id", "colaboradorId", "cursoId", "nota", "aprobado", "fechaFinalizacion"],

    "Auditoria": ["id", "usuarioId", "accion", "detalle", "fecha"],

    "Noticias": ["id", "titulo", "fecha", "resumen", "detalle", "enlace",
        "adjuntos", "adjuntoUrl", "adjuntoLabel", "tipo", "prioridad", "hora",
        "dirigidoA", "sucursal", "visiblePara", "leidoPor", "usuariosEspecificos"],

    "Manuales": ["id", "titulo", "categoria", "url", "visiblePara", "sucursal"],

    "Publicaciones": ["id", "canal", "autorId", "autorNombre", "autorRol", "titulo", "mensaje",
        "adjuntoUrl", "adjuntoLabel", "destacado", "requiereConfirmacion",
        "fecha", "likesDe", "leidoPor"],

    "Comentarios": ["id", "publicacionId", "autorId", "autorNombre", "texto", "fecha", "likesDe"],

    "Canales": ["id", "nombre", "icono", "creadoPor", "restringidoA"],

    "Recursos": ["id", "nombre", "url", "icono", "visiblePara", "creadoPor"],

    "Tokens": ["id", "usuarioId", "usuarioNombre", "token", "creadoEn"],
};

function crearEstructuraStaging() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nombres = Object.keys(ESTRUCTURA_HOJAS_STAGING);
    const creadas = [];
    const yaExistian = [];

    nombres.forEach((nombre) => {
        let sheet = ss.getSheetByName(nombre);
        if (sheet) {
            yaExistian.push(nombre);
            return;
        }
        sheet = ss.insertSheet(nombre);
        const headers = ESTRUCTURA_HOJAS_STAGING[nombre];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
        creadas.push(nombre);
    });

    // La hoja "Hoja 1" que Google crea por default en toda planilla
    // nueva queda vacía y sin usar — molesta al navegar, se borra sola
    // si sigue ahí y ya existe al menos otra hoja real.
    const hojaDefault = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
    if (hojaDefault && ss.getSheets().length > 1) {
        ss.deleteSheet(hojaDefault);
    }

    Logger.log("Creadas (" + creadas.length + "): " + creadas.join(", "));
    Logger.log("Ya existían, sin tocar (" + yaExistian.length + "): " + yaExistian.join(", "));
    Logger.log("=== Listo. Ahora corré poblarDatosIniciales() (Seed.gs) para cargar los datos de muestra. ===");
}
