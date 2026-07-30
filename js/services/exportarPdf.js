/* ============================
   FARO v4
   services/exportarPdf.js — Exportar un bloque de la pantalla a PDF

   Pedido explícito del usuario, y el fix de un bug real que encontró
   probando el primer intento: el truco CSS clásico de "esconder todo
   menos .imprimible" (visibility:hidden + position:absolute) peleaba
   con el layout propio de la app (sidebar fijo, tema oscuro, banners)
   y los márgenes salían mal — el sidebar oculto seguía ocupando
   espacio (visibility:hidden no colapsa el layout), y position:absolute
   se posicionaba relativo al ancestro que tocara, no siempre la
   página entera.

   Solución más robusta: abrir una pestaña NUEVA, en blanco, con SOLO
   el contenido a exportar + una hoja de estilos propia y liviana (no
   hereda nada del tema oscuro de la app) — así el diálogo de
   impresión del navegador aplica sus márgenes de página por defecto
   sobre un documento limpio, sin nada más con lo que pelear. Reemplaza
   las clases oscuras del tema (badges, tarjetas, tabla) por su
   equivalente en blanco y negro, apto para papel/compartir.
=============================*/

const ESTILOS_IMPRESION = `
    * { box-sizing: border-box; }
    /* Fondo BLANCO explícito — sin esto, la pestaña hereda el modo
       oscuro del sistema/navegador (color-scheme del meta tag de
       abajo ayuda, pero un fondo explícito no depende de que ningún
       navegador lo respete) y el texto oscuro queda invisible sobre
       fondo oscuro. Bug real encontrado por el usuario probando. */
    html { background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 28px; margin: 0; }

    /* Membrete — identidad de marca + de qué es este reporte y de
       cuándo, pedido explícito del usuario ("no tiene identidad, no
       dice Lucciano's y no hay argumento"). */
    .membrete-impresion { margin: 0 0 24px; padding-bottom: 14px; border-bottom: 2px solid #c2a065; }
    .membrete-marca { font-size: 22px; font-weight: 700; color: #c2a065; letter-spacing: .5px; }
    .membrete-titulo { font-size: 15px; font-weight: 700; color: #111; margin-top: 4px; }
    .membrete-meta { font-size: 12px; color: #666; margin-top: 2px; }

    h2, h3, h4 { color: #111; margin: 22px 0 10px; }
    h3:first-child, h4:first-child { margin-top: 0; }
    p { margin: 4px 0; }
    .text-xs { font-size: 11px; }
    .text-sm { font-size: 13px; }
    .text-muted { color: #666; }

    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 14px 0; }
    .card, .kpi-card { background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 12px 16px; flex: 1 1 150px; page-break-inside: avoid; }
    .kpi-card h3 { font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 6px; letter-spacing: .5px; }
    .kpi-card span { font-size: 22px; font-weight: 700; }
    .kpi-icon { display: none; }

    .table-wrapper { overflow: visible; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 11px; page-break-inside: auto; background: #fff; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; background: #fff; }
    th { background: #f2f2f2; text-transform: uppercase; font-size: 9px; color: #333; letter-spacing: .3px; }

    .celda-curso { display: flex; flex-direction: column; gap: 3px; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; background: #fff; white-space: nowrap; }
    .badge-success { color: #1a7a3c; }
    .badge-warning { color: #a06a00; }
    .badge-danger { color: #b02a2a; }
    .badge-muted { color: #666; }

    button, .fila-acciones, input[type="checkbox"], .mod-tooltip,
    .table-toolbar, .galeria-pills, .barra-enviar-mail { display: none !important; }

    /* Horizontal por defecto — las tablas tienen 9+ columnas
       (Semáforo por módulo, Áreas a reforzar), en vertical quedaban
       muy apretadas/cortadas. */
    @page { margin: 1.2cm; size: landscape; }
`;

/** Membrete de marca — mismo bloque en cualquier PDF que se exporte
 *  de la app: quién es (Lucciano's Academy), qué reporte es, de
 *  cuándo, y opcionalmente el alcance activo (ej. una sucursal
 *  filtrada) — pedido explícito del usuario ("no tiene identidad, no
 *  dice Lucciano's y no hay argumento"). Se re-genera cada vez que el
 *  contenido se vuelve a armar (ver reportes.js actualizarSemaforo),
 *  no solo en el primer render, para no perderlo al cambiar un filtro. */
export function membreteHtml(titulo, alcance) {
    const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    return `
        <div class="membrete-impresion">
            <div class="membrete-marca">Lucciano's Academy</div>
            <div class="membrete-titulo">${titulo}</div>
            <div class="membrete-meta">${alcance ? `${alcance} · ` : ""}Estado al ${fecha}</div>
        </div>
    `;
}

/** Abre una pestaña nueva con el contenido de "elementId", lista para
 *  imprimir/guardar como PDF — sin arrastrar el sidebar/tema oscuro
 *  de la app. */
export function exportarAPdf(elementId, titulo) {
    const origen = document.getElementById(elementId);
    if (!origen) return;

    const ventana = window.open("", "_blank");
    if (!ventana) {
        alert("El navegador bloqueó la ventana de impresión — permití pop-ups para este sitio e intentá de nuevo.");
        return;
    }

    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="color-scheme" content="light">
            <title>${titulo}</title>
            <style>${ESTILOS_IMPRESION}</style>
        </head>
        <body>${origen.innerHTML}</body>
        </html>
    `);
    ventana.document.close();

    ventana.onload = () => {
        ventana.focus();
        ventana.print();
    };
}
